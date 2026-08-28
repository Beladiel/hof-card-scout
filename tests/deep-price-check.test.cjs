const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("src/index.js", "utf8");
const context = {
  console,
  URL,
  URLSearchParams,
  Request,
  Response,
  Headers,
  AbortController,
  fetch,
  setTimeout,
  clearTimeout,
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source.replace("export default", "const workerDefault =") + `
const deepOriginals = { searchApify, readValuationCache, getValuationWithCache };
globalThis.deepApi = {
  VERSION,
  workerDefault,
  deepPriceCheck,
  targetRecommendationMarketCheck,
  isComparable,
  isExplicitTeamCardListing,
  isObviousNonTradingCardListing,
  setMocks(mocks) {
    if (mocks.searchApify) searchApify = mocks.searchApify;
    if (mocks.readValuationCache) readValuationCache = mocks.readValuationCache;
    if (mocks.getValuationWithCache) getValuationWithCache = mocks.getValuationWithCache;
  },
  resetMocks() {
    searchApify = deepOriginals.searchApify;
    readValuationCache = deepOriginals.readValuationCache;
    getValuationWithCache = deepOriginals.getValuationWithCache;
  },
};`, context, { filename: "src/index.js" });

const api = context.deepApi;
const card = {
  year: 1963,
  set: "Topps",
  player: "Sandy Koufax",
  cardNum: "5",
  grader: "Raw",
  grade: "",
  autograph: false,
  relic: false,
  serial: "",
  shopPrice: 80,
  notes: "",
  fastMode: true,
};
const exactTitle = "1963 Topps #5 Sandy Koufax Bob Gibson Don Drysdale Baseball Card";

function comp(id, price=100, title=exactTitle, sourceName="SerpApi") {
  return {
    id: `${sourceName.toLowerCase().replace(/\s+/g, "-")}:${id}`,
    title,
    price,
    soldDate: "2026-08-01",
    link: `https://www.ebay.com/itm/${id}`,
    condition: "",
    source: sourceName,
  };
}

function baseline(items) {
  const prices = items.map(item => item.price).sort((a, b) => a - b);
  return {
    provider: "eBay sold results via The Card API",
    query: exactTitle,
    searchMode: "The Card API eBay sold sales",
    matchMode: "strict",
    searched: items.length,
    matched: items.length,
    used: items.length,
    median: prices[Math.floor(prices.length / 2)] || null,
    low: prices[0] || null,
    high: prices[prices.length - 1] || null,
    min: prices[0] || null,
    max: prices[prices.length - 1] || null,
    confidence: items.length >= 4 ? "medium" : items.length >= 2 ? "low" : "insufficient",
    notes: ["Verified cached evidence."],
    comps: items,
    checkedAt: "2026-08-20T00:00:00.000Z",
    mode: "fast",
    bestOfferRecovered: 0,
    bestOfferRecoveryAttempted: 0,
  };
}

function cacheEntry(items) {
  return { result: baseline(items), ageSeconds: 600, fresh: true, stale: false };
}

function apifyResult(items, options={}) {
  return {
    matchedItems: items,
    cleaned: items,
    searched: options.searched ?? items.length,
    matched: items.length,
    confidence: items.length >= 4 ? "medium" : items.length >= 2 ? "low" : "insufficient",
    matchMode: "strict",
    searchMode: options.searchMode || "Apify sold + completed",
    notes: [],
    bestOfferRecovered: options.bestOfferRecovered || 0,
    bestOfferRecoveryAttempted: options.bestOfferRecoveryAttempted || 0,
  };
}

async function test(name, fn) {
  api.resetMocks();
  try {
    await fn();
    console.log(`PASS ${name}`);
  } finally {
    api.resetMocks();
  }
}

(async () => {
  await test("Worker version is 3.30.0", () => {
    assert.equal(api.VERSION, "3.37.0");
  });

  await test("Apify adds two unique comps to a three-comp baseline", async () => {
    const cached = [comp("100000000001", 90), comp("100000000002", 100), comp("100000000003", 110)];
    api.setMocks({
      readValuationCache: async () => cacheEntry(cached),
      searchApify: async () => apifyResult([comp("100000000004", 95, exactTitle, "Apify"), comp("100000000005", 105, exactTitle, "Apify")], { searched: 15 }),
    });
    const result = await api.deepPriceCheck(card, { APIFY_TOKEN: "secret-token", CARD_API_KEY: "market-key" });
    assert.equal(result.diagnostics.baselineComps, 3);
    assert.equal(result.diagnostics.uniqueCompsAdded, 2);
    assert.equal(result.diagnostics.finalCompsUsed, 5);
    assert.equal(result.diagnostics.improved, true);
    assert.equal(result.valuation.used, 5);
  });

  await test("duplicate Apify eBay sale does not increase the comp count", async () => {
    const cached = [comp("200000000001", 90), comp("200000000002", 100), comp("200000000003", 110)];
    api.setMocks({
      readValuationCache: async () => cacheEntry(cached),
      searchApify: async () => apifyResult([
        comp("200000000001", 90, exactTitle, "Apify"),
        comp("200000000004", 105, exactTitle, "Apify"),
      ]),
    });
    const result = await api.deepPriceCheck(card, { APIFY_TOKEN: "secret-token" });
    assert.equal(result.diagnostics.uniqueCompsAdded, 1);
    assert.equal(result.valuation.used, 4);
  });

  await test("wrong-card Apify result is rejected when evidence is recombined", async () => {
    const cached = [comp("300000000001", 90), comp("300000000002", 100), comp("300000000003", 110)];
    api.setMocks({
      readValuationCache: async () => cacheEntry(cached),
      searchApify: async () => apifyResult([comp("300000000004", 105, "1963 Topps #6 Sandy Koufax Baseball Card", "Apify")]),
    });
    const result = await api.deepPriceCheck(card, { APIFY_TOKEN: "secret-token" });
    assert.equal(result.diagnostics.uniqueCompsAdded, 0);
    assert.equal(result.diagnostics.improved, false);
    assert.equal(result.valuation.used, 3);
  });

  await test("team-card and 5x7 non-card regressions remain rejected", () => {
    assert.equal(api.isExplicitTeamCardListing("1962 Topps DODGERS TEAM #43 Sandy Koufax Vintage Baseball Card"), true);
    assert.equal(api.isObviousNonTradingCardListing("Sandy Koufax 5×7 picture print"), true);
    assert.equal(api.isComparable(comp("400000000001", 100, "1962 Topps DODGERS TEAM #43 Sandy Koufax Vintage Baseball Card"), { ...card, year: 1962, cardNum: "43" }, false), false);
    assert.equal(api.isComparable(comp("400000000002", 100, "1963 Sandy Koufax 5x7 collectible"), card, false), false);
  });

  await test("Best Offer recovery is included and Card API key reaches deep Apify", async () => {
    const cached = [comp("500000000001", 90), comp("500000000002", 100), comp("500000000003", 110)];
    let receivedCardApiKey = "";
    api.setMocks({
      readValuationCache: async () => cacheEntry(cached),
      searchApify: async (_card, _query, _token, fastMode, cardApiKey) => {
        assert.equal(fastMode, false);
        receivedCardApiKey = cardApiKey;
        return apifyResult([comp("500000000004", 97, exactTitle, "Best Offer recovery")], {
          bestOfferRecovered: 1,
          bestOfferRecoveryAttempted: 1,
        });
      },
    });
    const result = await api.deepPriceCheck(card, { APIFY_TOKEN: "secret-token", CARD_API_KEY: "market-key" });
    assert.equal(receivedCardApiKey, "market-key");
    assert.equal(result.diagnostics.bestOfferPricesRecovered, 1);
    assert.equal(result.valuation.bestOfferRecovered, 1);
  });

  await test("no stronger evidence preserves the original cached valuation", async () => {
    const cached = [comp("600000000001", 90), comp("600000000002", 100), comp("600000000003", 110)];
    const original = cacheEntry(cached);
    api.setMocks({
      readValuationCache: async () => original,
      searchApify: async () => apifyResult([]),
    });
    const result = await api.deepPriceCheck(card, { APIFY_TOKEN: "secret-token" });
    assert.equal(result.diagnostics.improved, false);
    assert.equal(result.valuation.used, original.result.used);
    assert.equal(result.valuation.median, original.result.median);
    assert.deepEqual(result.valuation.comps.map(item => item.link), original.result.comps.map(item => item.link));
  });

  await test("missing Apify token returns a safe configuration message", async () => {
    const request = new Request("https://worker.test/deep-price-check", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Scout-Key": "scout-key" },
      body: JSON.stringify({ card }),
    });
    const response = await api.workerDefault.fetch(request, { SCOUT_ACCESS_KEY: "scout-key" }, {});
    const data = await response.json();
    assert.equal(response.status, 503);
    assert.equal(data.error, "apify_not_configured");
    assert.doesNotMatch(JSON.stringify(data), /token|authorization|bearer/i);
  });

  await test("Deep Price Check requires the existing Scout access key", async () => {
    const request = new Request("https://worker.test/deep-price-check", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Scout-Key": "wrong-key" },
      body: JSON.stringify({ card }),
    });
    const response = await api.workerDefault.fetch(request, {
      SCOUT_ACCESS_KEY: "scout-key",
      APIFY_TOKEN: "secret-token",
    }, {});
    const data = await response.json();
    assert.equal(response.status, 401);
    assert.equal(data.error, "unauthorized");
  });

  await test("invalid Apify authentication returns apify_auth_invalid without provider details", async () => {
    api.setMocks({
      readValuationCache: async () => null,
      searchApify: async () => {
        const error = new Error("User was not found or authentication token is not valid: secret-token");
        error.status = 401;
        throw error;
      },
    });
    const request = new Request("https://worker.test/deep-price-check", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Scout-Key": "scout-key" },
      body: JSON.stringify({ card }),
    });
    const response = await api.workerDefault.fetch(request, { SCOUT_ACCESS_KEY: "scout-key", APIFY_TOKEN: "secret-token" }, {});
    const data = await response.json();
    assert.equal(data.error, "apify_auth_invalid");
    assert.equal(data.message, "Scout's Deep Price Check needs its Apify connection refreshed.");
    assert.doesNotMatch(JSON.stringify(data), /secret-token|user was not found|authorization|bearer/i);
  });

  await test("diagnostics never contain provider credentials", async () => {
    api.setMocks({
      readValuationCache: async () => cacheEntry([comp("700000000001"), comp("700000000002"), comp("700000000003")]),
      searchApify: async () => apifyResult([comp("700000000004", 105, exactTitle, "Apify")], { searched: 15 }),
    });
    const result = await api.deepPriceCheck(card, { APIFY_TOKEN: "do-not-leak", CARD_API_KEY: "also-secret" });
    const serialized = JSON.stringify(result.diagnostics);
    assert.doesNotMatch(serialized, /do-not-leak|also-secret|authorization|bearer|api[_-]?key/i);
  });

  await test("normal target market check does not invoke Deep Price Check", async () => {
    let apifyCalls = 0;
    api.setMocks({
      searchApify: async () => { apifyCalls += 1; throw new Error("Deep Apify should not run"); },
      getValuationWithCache: async () => ({
        ...baseline([comp("800000000001"), comp("800000000002"), comp("800000000003")]),
        confidenceScore: 40,
        cacheHit: true,
      }),
    });
    const suggestion = {
      delivered: 80,
      year: 1963,
      set: "Topps",
      cardNum: "5",
      gradeInfo: { grader: "Raw", grade: "" },
      traits: {},
    };
    const market = await api.targetRecommendationMarketCheck(suggestion, "Sandy Koufax", {});
    assert.equal(market.used, 3);
    assert.equal(apifyCalls, 0);
  });

  const html = fs.readFileSync("index.html", "utf8");
  await test("button visibility follows weak-evidence rules and remains click-only", () => {
    const eligibilityBody = html.match(/function scoutDeepPriceCheckEligible\(m\)\{([\s\S]*?)\n\}/)?.[0];
    assert.ok(eligibilityBody, "eligibility helper should be present");
    const uiContext = {};
    vm.createContext(uiContext);
    vm.runInContext(`${eligibilityBody};globalThis.check=scoutDeepPriceCheckEligible;`, uiContext);
    assert.equal(uiContext.check({ used: 4, confidence: "medium" }), false);
    assert.equal(uiContext.check({ used: 3, confidence: "low" }), true);
    assert.equal(uiContext.check({ used: 2, confidence: "medium" }), true);
    assert.equal(uiContext.check({ used: 4, confidence: "low" }), true);
    assert.match(html, /🔎 CHECK MORE SALES/);
    assert.match(html, /addEventListener\("click",runFindTargetDeepPriceCheck\)/);
    assert.doesNotMatch(html, /renderFindTargetSuggestion\(s\)\{[\s\S]{0,2000}await runFindTargetDeepPriceCheck/);
  });
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
