const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");

const html = fs.readFileSync("index.html", "utf8");
const moduleSource = fs.readFileSync("photo-mission.js", "utf8");
const cardPhotoSource = fs.readFileSync("card-photo.js", "utf8");

function harness(fetcher) {
  const elements = new Map();
  const listeners = new Map();
  const stored = new Map();
  class Element {
    constructor(id) {
      this.id = id;
      this.listeners = {};
      this.dataset = {};
      this.value = "";
      this.textContent = "";
      this.innerHTML = "";
      this.hidden = false;
      this.style = {};
    }
    addEventListener(type, listener) { this.listeners[type] = listener; }
    setAttribute(name, value) { this[name] = value; }
    insertAdjacentElement(position, node) { elements.set(node.id, node); }
    insertAdjacentHTML(position, source) {
      for (const match of source.matchAll(/id="([^"]+)"/g)) elements.set(match[1], new Element(match[1]));
    }
    appendChild(node) { if (node.id) elements.set(node.id, node); }
  }

  elements.set("specialCollectionBtn", new Element("specialCollectionBtn"));
  const main = new Element("main");
  const grid = new Element("grid");
  const document = {
    head: new Element("head"),
    createElement: () => new Element("created"),
    getElementById: id => elements.get(id) || null,
    querySelector: selector => selector === "main" ? main : selector === "#homeScreen .quick-grid" ? grid : null,
    addEventListener: (type, listener) => listeners.set(type, listener)
  };
  const localStorage = {
    getItem: key => stored.get(key) || null,
    setItem: (key, val) => stored.set(key, String(val))
  };
  class AbortController {
    constructor() { this.signal = { aborted: false }; }
    abort() { this.signal.aborted = true; }
  }
  const ctx = { document, localStorage, AbortController, fetch: fetcher, console, Date, Math, String };
  vm.runInNewContext(moduleSource, ctx, { filename: "photo-mission.js" });
  let navigation = "";
  let opened = "";
  const roster = [
    { name: "Hank Aaron", owned: true, cardYear: 1994, set: "Upper Deck", cardNum: "1" },
    { name: "Yogi Berra", owned: true, cardYear: 1961, set: "Topps", cardNum: "425" },
    { name: "In Transit", owned: true, incoming: true },
    { name: "Not Owned", owned: false }
  ];
  ctx.ScoutPhotoMission.init({
    players: () => roster,
    connection: () => ({ endpoint: "https://example.invalid", accessKey: "test-secret" }),
    navigate: page => { navigation = page; },
    openPlayer: card => { opened = card.name; }
  });
  const element = id => {
    const el = elements.get(id);
    assert.ok(el, "missing expected element: " + id);
    return el;
  };
  return {
    ctx, element, listeners, stored,
    get navigation() { return navigation; },
    get opened() { return opened; },
    click: async id => element(id).listeners.click()
  };
}

test("main app compiles, retires Sealed Product Scout, and loads Photo Mission", () => {
  const inline = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(inline, "inline app code missing");
  new vm.Script(inline[1]);
  new vm.Script(moduleSource);
  new vm.Script(cardPhotoSource);
  assert.match(html, /photo-mission\.js\?v=/);
  assert.match(html, /ScoutPhotoMission\.init\(\{players:\(\)=>PLAYERS/);
  assert.doesNotMatch(html, /<script src="sealed-product-scout\.js/);
  assert.doesNotMatch(html, /zxing-browser\.min\.js/);
  assert.match(cardPhotoSource, /scout:card-photo-changed/);
});

test("photo inventory checks only arrived owned cards and counts cloud successes", async () => {
  const requests = [];
  const app = harness(async url => {
    requests.push(url);
    return { ok: url.includes("Hank%20Aaron"), status: url.includes("Hank%20Aaron") ? 200 : 404, body: { cancel: async () => {} } };
  });
  app.ctx.ScoutPhotoMission.open();
  assert.equal(app.navigation, "photoMissionScreen");
  await app.click("pmScanBtn");
  assert.equal(requests.length, 2, "must not query unowned or in-transit cards");
  assert.equal(app.element("pmWith").textContent, 1);
  assert.equal(app.element("pmMissing").textContent, 1);
  assert.equal(app.element("pmChecked").textContent, "2 / 2");
  assert.equal(JSON.parse(app.stored.get("scoutPhotoMissionInventoryV1")).photos["Hank Aaron"].hasPhoto, true);
  app.listeners.get("scout:card-photo-changed")({ detail: { player: "Yogi Berra", hasPhoto: true } });
  assert.equal(app.element("pmWith").textContent, 2, "upload should immediately refresh count");
  assert.equal(app.element("pmMissing").textContent, 0);
});

test("missing cloud connection cannot be mistaken for zero photos", async () => {
  const app = harness(async () => ({ ok: false, status: 503 }));
  app.ctx.ScoutPhotoMission.open();
  await app.click("pmScanBtn");
  assert.equal(app.element("pmWith").textContent, 0);
  assert.equal(app.element("pmMissing").textContent, 0);
  assert.equal(app.element("pmChecked").textContent, "0 / 2");
  assert.match(app.element("photoMissionScanStatus").textContent, /unavailable/i);
});

test("invalid cloud key stops scanning and does not mark cards missing", async () => {
  const app = harness(async () => ({ ok: false, status: 401 }));
  app.ctx.ScoutPhotoMission.open();
  await app.click("pmScanBtn");
  assert.equal(app.element("pmMissing").textContent, 0);
  assert.equal(app.element("pmChecked").textContent, "0 / 2");
  assert.match(app.element("photoMissionScanStatus").textContent, /rejected the connection key/i);
});

test("manual photo deletion changes cached status without changing Hall ownership", async () => {
  const app = harness(async () => ({ ok: true, status: 200 }));
  app.ctx.ScoutPhotoMission.open();
  await app.click("pmScanBtn");
  assert.equal(app.element("pmWith").textContent, 2);
  app.listeners.get("scout:card-photo-changed")({ detail: { player: "Hank Aaron", hasPhoto: false } });
  assert.equal(app.element("pmWith").textContent, 1);
  assert.equal(app.element("pmMissing").textContent, 1);
});
