const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("src/index.js", "utf8");
const originalFetch = fetch;
const context = {
  console,
  URL,
  URLSearchParams,
  Request,
  Response,
  Headers,
  AbortController,
  fetch: originalFetch,
  setTimeout,
  clearTimeout,
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source.replace("export default", "const workerDefault =") + `
const shippingOriginals = { runActiveEbaySearch, searchApify, readValuationCache };
globalThis.shippingApi = {
  VERSION,
  ACTIVE_EBAY_SHIP_TO_ZIP,
  normalizeActiveEbayResult,
  activeDealMismatchReason,
  runActiveEbaySearch,
  searchMonthlyPickListing,
  searchActiveEbayDeals,
  deepPriceCheck,
  isExplicitTeamCardListing,
  isObviousNonTradingCardListing,
  setMocks(mocks) {
    if (mocks.runActiveEbaySearch) runActiveEbaySearch = mocks.runActiveEbaySearch;
    if (mocks.searchApify) searchApify = mocks.searchApify;
    if (mocks.readValuationCache) readValuationCache = mocks.readValuationCache;
  },
  resetMocks() {
    runActiveEbaySearch = shippingOriginals.runActiveEbaySearch;
    searchApify = shippingOriginals.searchApify;
    readValuationCache = shippingOriginals.readValuationCache;
  },
};`, context, { filename: "src/index.js" });

const api = context.shippingApi;
const title = "1963 Topps #5 Sandy Koufax Bob Gibson Don Drysdale HOF Vintage Baseball Card";
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
  shopPrice: 15.85,
  notes: "",
  fastMode: true,
};

function activeRow(overrides={}) {
  return {
    product_id: "397088803039",
    title,
    price: { raw: "$14.00", extracted: 14 },
    shipping: { raw: "+$1.85 shipping", extracted: 1.85 },
    condition: "Pre-Owned",
    link: "https://www.ebay.com/itm/397088803039",
    seller: { username: "trusted-seller", reviews: 1000, positive_feedback_in_percentage: 99.8 },
    ...overrides,
  };
}

function soldComp(id, price=100) {
  return {
    id: `apify:${id}`,
    title,
    price,
    soldDate: "2026-08-01",
    link: `https://www.ebay.com/itm/${id}`,
    condition: "",
    source: "Apify",
  };
}

function emptyApifyResult(items=[]) {
  return {
    matchedItems: items,
    cleaned: items,
    searched: items.length,
    matched: items.length,
    confidence: items.length >= 4 ? "medium" : items.length >= 2 ? "low" : "insufficient",
    matchMode: "strict",
    searchMode: "Apify sold + completed",
    notes: [],
    bestOfferRecovered: 0,
    bestOfferRecoveryAttempted: 0,
  };
}

async function test(name, fn) {
  api.resetMocks();
  context.fetch = originalFetch;
  try {
    await fn();
    console.log(`PASS ${name}`);
  } finally {
    api.resetMocks();
    context.fetch = originalFetch;
  }
}

(async () => {
  await test("Worker version and destination ZIP are current", () => {
    assert.equal(api.VERSION, "3.30.0");
    assert.equal(api.ACTIVE_EBAY_SHIP_TO_ZIP, "87114");
  });

  await test("$14.00 plus $1.85 shipping equals $15.85 delivered", () => {
    const item = api.normalizeActiveEbayResult(activeRow());
    assert.equal(item.productId, "397088803039");
    assert.equal(item.price, 14);
    assert.equal(item.shipping, 1.85);
    assert.equal(item.delivered, 15.85);
  });

  await test("active SerpApi request includes _stpos=87114", async () => {
    let requestedUrl = "";
    context.fetch = async url => {
      requestedUrl = String(url);
      return new Response(JSON.stringify({
        search_metadata: { status: "Success" },
        organic_results: [],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    const data = await api.runActiveEbaySearch("Sandy Koufax baseball card", "private-serp-key");
    const request = new URL(requestedUrl);
    assert.equal(request.searchParams.get("_stpos"), "87114");
    assert.equal(request.searchParams.get("_salic"), "1");
    assert.doesNotMatch(JSON.stringify(data), /private-serp-key/);
  });

  await test("free shipping keeps delivered equal to item price", () => {
    const item = api.normalizeActiveEbayResult(activeRow({ shipping: "Free shipping" }));
    assert.equal(item.shipping, 0);
    assert.equal(item.delivered, 14);
  });

  await test("unclear shipping remains unknown and is rejected", () => {
    const item = api.normalizeActiveEbayResult(activeRow({
      shipping: { extracted: null, raw: "Calculated at checkout" },
    }));
    assert.equal(item.shipping, null);
    assert.equal(item.delivered, null);
    assert.match(api.activeDealMismatchReason(item, card), /Shipping cost is unclear/);
  });

  await test("coupon and promotional prices do not replace the normal item price", () => {
    const item = api.normalizeActiveEbayResult(activeRow({
      coupon: { raw: "Save 50% with code", discounted_price: 7 },
      discount_price: { raw: "$7.00", extracted: 7 },
      sale_price: { raw: "$9.00", extracted: 9 },
      sales_tax: { raw: "$12.77", extracted: 12.77 },
      checkout_total: { raw: "$28.62", extracted: 28.62 },
    }));
    assert.equal(item.price, 14);
    assert.equal(item.shipping, 1.85);
    assert.equal(item.delivered, 15.85);
  });

  await test("Deep Price Check cannot alter the active listing price or shipping", async () => {
    const listing = { price: 14, shipping: 1.85, delivered: 15.85 };
    const before = JSON.stringify(listing);
    api.setMocks({
      readValuationCache: async () => null,
      searchApify: async () => emptyApifyResult([
        soldComp("910000000001", 90),
        soldComp("910000000002", 100),
      ]),
    });
    await api.deepPriceCheck({ ...card, shopPrice: listing.delivered }, { APIFY_TOKEN: "secret" });
    assert.equal(JSON.stringify(listing), before);

    const html = fs.readFileSync("index.html", "utf8");
    const start = html.indexOf("async function runFindTargetDeepPriceCheck()");
    const end = html.indexOf("async function searchFindTarget()", start);
    const handler = html.slice(start, end);
    assert.ok(start >= 0 && end > start);
    assert.match(handler, /s\.marketCheck=next/);
    assert.doesNotMatch(handler, /\bs\.(?:price|shipping|delivered)\s*=/);
  });

  await test("Find a Target, Monthly Pick, and Deal Finder share the active search function", async () => {
    const calls = [];
    api.setMocks({
      runActiveEbaySearch: async query => {
        calls.push(query);
        return { organic_results: [] };
      },
    });
    const common = {
      player: "Sandy Koufax",
      budget: 50,
      mode: "need",
      currentCard: null,
      excludeIds: [],
      preferredSellers: [],
      apiKey: "private-serp-key",
    };

    const monthlyStart = calls.length;
    const monthly = await api.searchMonthlyPickListing({ ...common, purpose: "monthly" });
    assert.ok(calls.length > monthlyStart);
    assert.equal(monthly.shippingDestinationZip, "87114");
    assert.ok(monthly.notes.includes("Shipping calculated for ZIP 87114."));

    const targetStart = calls.length;
    const target = await api.searchMonthlyPickListing({ ...common, purpose: "target" });
    assert.ok(calls.length > targetStart);
    assert.equal(target.shippingDestinationZip, "87114");
    assert.ok(target.notes.includes("Shipping calculated for ZIP 87114."));

    const dealsStart = calls.length;
    const deals = await api.searchActiveEbayDeals(card, null, "private-serp-key");
    assert.ok(calls.length > dealsStart);
    assert.equal(deals.shippingDestinationZip, "87114");
    assert.ok(deals.notes.includes("Shipping calculated for ZIP 87114."));
    assert.doesNotMatch(JSON.stringify({ monthly, target, deals }), /private-serp-key/);
  });

  await test("team-card and 5x7 listing rejections remain active", () => {
    assert.equal(api.isExplicitTeamCardListing("1962 Topps DODGERS TEAM #43 Sandy Koufax Vintage Baseball Card"), true);
    assert.equal(api.isObviousNonTradingCardListing("Sandy Koufax 5×7 picture print"), true);
  });
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
