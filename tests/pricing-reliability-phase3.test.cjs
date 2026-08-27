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
const originalFunctions = {
  runEbaySearchAsync,
  runEbaySearch,
  searchSerpApi,
  searchCardApiEbaySold,
  searchApify,
  readValuationCache,
  valueCard,
};
globalThis.phase3 = {
  VERSION,
  buildQuery,
  buildBroadSoldQuery,
  searchSerpApi,
  valueCard,
  getValuationWithCache,
  targetPricingEvidenceDetails,
  dedupeSoldComps,
  isExplicitTeamCardListing,
  isObviousNonTradingCardListing,
  setMocks(mocks) {
    if (mocks.runEbaySearchAsync) runEbaySearchAsync = mocks.runEbaySearchAsync;
    if (mocks.runEbaySearch) runEbaySearch = mocks.runEbaySearch;
    if (mocks.searchSerpApi) searchSerpApi = mocks.searchSerpApi;
    if (mocks.searchCardApiEbaySold) searchCardApiEbaySold = mocks.searchCardApiEbaySold;
    if (mocks.searchApify) searchApify = mocks.searchApify;
    if (mocks.readValuationCache) readValuationCache = mocks.readValuationCache;
    if (mocks.valueCard) valueCard = mocks.valueCard;
  },
  resetMocks() {
    runEbaySearchAsync = originalFunctions.runEbaySearchAsync;
    runEbaySearch = originalFunctions.runEbaySearch;
    searchSerpApi = originalFunctions.searchSerpApi;
    searchCardApiEbaySold = originalFunctions.searchCardApiEbaySold;
    searchApify = originalFunctions.searchApify;
    readValuationCache = originalFunctions.readValuationCache;
    valueCard = originalFunctions.valueCard;
  },
};`, context, { filename: "src/index.js" });

const api = context.phase3;
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
};
const exactQuery = api.buildQuery(card);
const broadQuery = api.buildBroadSoldQuery(card);
const title = "1963 Topps #5 Sandy Koufax Bob Gibson Don Drysdale Baseball Card";
let cachedFallbackEvidence = null;

function serpRow(id, rowTitle=title, price=100) {
  return {
    product_id: id,
    title: rowTitle,
    price: { extracted: price },
    sold_date: "2026-08-01",
    link: `https://www.ebay.com/itm/${id}`,
  };
}

function comp(id, price=100, sourceName="The Card API") {
  return {
    id: sourceName === "The Card API" ? `cardapi:ebay:${id}` : id,
    title,
    price,
    soldDate: "2026-08-01",
    link: `https://www.ebay.com/itm/${id}`,
    condition: "",
    source: sourceName,
  };
}

function completed(rows) {
  return { search_metadata: { status: "Success" }, organic_results: rows, scout_async: true };
}

function processingTimeout(label="processing") {
  const error = new Error(`SerpApi async search timed out while still ${label} after 15s.`);
  error.code = "serp_async_incomplete";
  error.searchStatus = label;
  return error;
}

function providerResult(items, provider="The Card API") {
  return {
    matchedItems: items,
    cleaned: items,
    confidence: items.length >= 4 ? "medium" : items.length >= 2 ? "low" : "insufficient",
    matchMode: "strict",
    searched: items.length,
    matched: items.length,
    searchMode: `${provider} test`,
    notes: [],
    providerDiagnostics: provider === "The Card API" ? {
      cardApi: {
        initial: { rows: items.length, matches: items.length, status: "completed" },
        fallback: { rows: 0, matches: 0, status: "not_attempted", note: "" },
        total: { rows: items.length, matches: items.length, status: "completed" },
      },
    } : {},
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
    assert.equal(api.VERSION, "3.33.0");
  });

  await test("target exact and broad async searches start concurrently", async () => {
    const starts = [];
    let releaseExact;
    const exactGate = new Promise(resolve => { releaseExact = resolve; });
    let syncCalls = 0;
    api.setMocks({
      runEbaySearch: async () => { syncCalls += 1; return completed([]); },
      runEbaySearchAsync: async (query, _key, mode, maxWaitMs, totalBudget) => {
        starts.push({ query, mode, maxWaitMs, totalBudget, at: Date.now() });
        if (query === exactQuery) return exactGate;
        return completed([serpRow("111111111111")]);
      },
    });

    const pending = api.searchSerpApi(card, exactQuery, "test-key", true, {
      targetEnrichment: true,
      evidenceGoal: 4,
      extraWaitMs: 15000,
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(starts.length, 2, "both async submissions should start before exact resolves");
    assert.equal(starts[0].query, exactQuery);
    assert.equal(starts[1].query, broadQuery);
    assert.equal(starts[0].mode, "Sold");
    assert.equal(starts[1].mode, "Sold");
    assert.equal(starts[0].maxWaitMs, 15000);
    assert.equal(starts[1].maxWaitMs, 15000);
    assert.equal(starts[0].totalBudget, true);
    assert.equal(starts[1].totalBudget, true);
    assert.ok(starts[1].at - starts[0].at < 100, "broad should not wait behind strict timeout");
    assert.equal(syncCalls, 0, "target enrichment must not use synchronous Strict Sold");
    releaseExact(completed([serpRow("222222222222", title, 110)]));
    const result = await pending;
    assert.equal(result.cleaned.length, 2);
  });

  await test("exact completion survives broad processing timeout", async () => {
    api.setMocks({
      runEbaySearchAsync: async query => {
        if (query === broadQuery) throw processingTimeout();
        return completed([serpRow("111111111111")]);
      },
    });
    const result = await api.searchSerpApi(card, exactQuery, "test-key", true, { targetEnrichment: true });
    assert.equal(result.cleaned.length, 1);
    assert.equal(result.providerDiagnostics.serpApi.exact.status, "completed");
    assert.equal(result.providerDiagnostics.serpApi.broad.status, "timed_out");
    assert.match(result.providerDiagnostics.serpApi.broad.note, /timed out while still processing/i);
  });

  await test("broad completion survives exact processing timeout", async () => {
    api.setMocks({
      runEbaySearchAsync: async query => {
        if (query === exactQuery) throw processingTimeout("queued");
        return completed([serpRow("222222222222", title, 110)]);
      },
    });
    const result = await api.searchSerpApi(card, exactQuery, "test-key", true, { targetEnrichment: true });
    assert.equal(result.cleaned.length, 1);
    assert.equal(result.providerDiagnostics.serpApi.exact.status, "timed_out");
    assert.equal(result.providerDiagnostics.serpApi.broad.status, "completed");
  });

  await test("both completed searches merge and dedupe overlapping eBay IDs", async () => {
    api.setMocks({
      runEbaySearchAsync: async query => query === exactQuery
        ? completed([serpRow("111111111111", title, 100), serpRow("222222222222", title, 110)])
        : completed([serpRow("111111111111", title, 100), serpRow("333333333333", title, 120)]),
    });
    const result = await api.searchSerpApi(card, exactQuery, "test-key", true, { targetEnrichment: true });
    assert.equal(result.searched, 4);
    assert.equal(result.matched, 3);
    assert.equal(result.cleaned.length, 3);
    assert.equal(result.providerDiagnostics.serpApi.exact.rows, 2);
    assert.equal(result.providerDiagnostics.serpApi.broad.rows, 2);
  });

  await test("both SerpApi timeouts preserve three-comp Card API evidence and skip Apify", async () => {
    let apifyCalls = 0;
    const cardItems = [
      comp("411111111111", 90),
      comp("422222222222", 100),
      comp("433333333333", 110),
    ];
    api.setMocks({
      runEbaySearchAsync: async () => { throw processingTimeout(); },
      searchCardApiEbaySold: async () => providerResult(cardItems),
      searchApify: async () => { apifyCalls += 1; throw new Error("Apify should not run"); },
    });
    const result = await api.valueCard(card, {
      SERPAPI_KEY: "serp-test",
      CARD_API_KEY: "card-test",
      APIFY_TOKEN: "apify-test",
    }, true, { targetEnrichment: true, evidenceGoal: 4 });
    assert.equal(result.used, 3);
    assert.equal(result.confidence, "low");
    assert.equal(result.median, 100);
    assert.equal(apifyCalls, 0);
    assert.equal(result.providerDiagnostics.serpApi.exact.status, "timed_out");
    assert.equal(result.providerDiagnostics.serpApi.broad.status, "timed_out");
    assert.equal(result.providerDiagnostics.cardApi.total.matches, 3);
  });

  await test("an already-rated two-comp target also skips the long Apify fallback", async () => {
    let apifyCalls = 0;
    api.setMocks({
      runEbaySearchAsync: async () => { throw processingTimeout(); },
      searchCardApiEbaySold: async () => providerResult([
        comp("444444444444", 95),
        comp("455555555555", 105),
      ]),
      searchApify: async () => { apifyCalls += 1; return providerResult([], "Apify"); },
    });
    const result = await api.valueCard(card, {
      SERPAPI_KEY: "serp-test",
      CARD_API_KEY: "card-test",
      APIFY_TOKEN: "apify-test",
    }, true, { targetEnrichment: true, evidenceGoal: 4 });
    assert.equal(result.used, 2);
    assert.equal(result.confidence, "low");
    assert.equal(apifyCalls, 0);
  });

  await test("both provider timeouts preserve a verified fresh target cache", async () => {
    const cachedResult = {
      provider: "The Card API",
      searchMode: "cached",
      searched: 3,
      matched: 3,
      used: 3,
      median: 100,
      low: 90,
      high: 110,
      confidence: "low",
      notes: [],
      comps: [comp("511111111111", 90), comp("522222222222", 100), comp("533333333333", 110)],
    };
    api.setMocks({
      readValuationCache: async () => ({ result: cachedResult, fresh: true, stale: false, ageSeconds: 60 }),
      valueCard: async () => { throw new Error("All live sources timed out while still processing"); },
    });
    const result = await api.getValuationWithCache(card, {}, true, null, {
      targetEnrichment: true,
      evidenceGoal: 4,
    });
    assert.equal(result.used, 3);
    assert.equal(result.median, 100);
    assert.equal(result.cacheHit, true);
    assert.equal(result.targetEnrichmentFallback, true);
  });

  await test("aggregate live-provider failure carries Phase 3 timeout diagnostics into cache fallback", async () => {
    const cachedResult = {
      provider: "Cached verified valuation",
      searchMode: "cached",
      searched: 3,
      matched: 3,
      used: 3,
      median: 100,
      low: 90,
      high: 110,
      confidence: "low",
      notes: [],
      comps: [comp("531111111111", 90), comp("532222222222", 100), comp("533333333333", 110)],
    };
    api.setMocks({
      readValuationCache: async () => ({ result: cachedResult, fresh: true, stale: false, ageSeconds: 60 }),
      runEbaySearchAsync: async () => { throw processingTimeout(); },
      searchCardApiEbaySold: async () => { throw new Error("The Card API unavailable"); },
    });
    const result = await api.getValuationWithCache(card, {
      SERPAPI_KEY: "serp-test",
      CARD_API_KEY: "card-test",
    }, true, null, { targetEnrichment: true, evidenceGoal: 4 });
    const evidence = api.targetPricingEvidenceDetails(result, true);
    assert.equal(result.used, 3);
    assert.equal(result.median, 100);
    assert.equal(result.cacheHit, true);
    assert.equal(evidence.providerDetails.serpApi.exact.status, "timed_out");
    assert.equal(evidence.providerDetails.serpApi.broad.status, "timed_out");
  });

  await test("equal live enrichment keeps cached price and comps but exposes live diagnostics", async () => {
    const cachedComps = [
      comp("541111111111", 90),
      comp("542222222222", 100),
      comp("543333333333", 110),
    ];
    const cachedResult = {
      provider: "Cached verified Card API valuation",
      searchMode: "cached verified search",
      searched: 7,
      matched: 3,
      used: 3,
      median: 100,
      low: 90,
      high: 110,
      confidence: "low",
      notes: ["Cached valuation note."],
      comps: cachedComps,
      providerDiagnostics: {
        serpApi: {
          exact: { rows: 99, matches: 9, status: "completed" },
          broad: { rows: 99, matches: 9, status: "completed" },
        },
      },
    };
    const liveResult = {
      provider: "Current weaker SerpApi valuation",
      searchMode: "Sold-target-parallel-async-exact+broad",
      searched: 40,
      matched: 3,
      used: 3,
      median: 40,
      low: 30,
      high: 50,
      confidence: "low",
      notes: ["Current live attempt note."],
      comps: [comp("544444444444", 30, "SerpApi"), comp("545555555555", 40, "SerpApi"), comp("546666666666", 50, "SerpApi")],
      providerDiagnostics: {
        serpApi: {
          exact: { rows: 12, matches: 2, status: "completed", note: "" },
          broad: { rows: 18, matches: 1, status: "completed", note: "" },
        },
        cardApi: {
          initial: { rows: 7, matches: 3, status: "completed", note: "" },
          fallback: { rows: 3, matches: 0, status: "completed", note: "" },
          total: { rows: 10, matches: 3, status: "completed", note: "" },
        },
      },
    };
    api.setMocks({
      readValuationCache: async () => ({ result: cachedResult, fresh: true, stale: false, ageSeconds: 60 }),
      valueCard: async () => liveResult,
    });
    const result = await api.getValuationWithCache(card, {}, true, null, {
      targetEnrichment: true,
      evidenceGoal: 4,
    });

    assert.equal(result.provider, cachedResult.provider);
    assert.equal(result.searchMode, cachedResult.searchMode);
    assert.equal(result.used, 3);
    assert.equal(result.median, 100);
    assert.equal(result.low, 90);
    assert.equal(result.high, 110);
    assert.equal(result.legacyConfidence, "low");
    assert.equal(JSON.stringify(result.comps), JSON.stringify(cachedComps));
    assert.equal(result.cacheHit, true);
    assert.equal(result.targetEnrichmentFallback, true);
    assert.equal(result.providerDiagnostics.serpApi.exact.rows, 12);
    assert.equal(result.liveEnrichmentProviderDiagnostics.serpApi.broad.matches, 1);
    assert.match(result.notes.join(" "), /provider diagnostics below describe this search's live enrichment attempt/i);

    const evidence = api.targetPricingEvidenceDetails(result, true);
    cachedFallbackEvidence = evidence;
    assert.equal(evidence.cacheHit, true);
    assert.equal(evidence.soldCompsUsed, 3);
    assert.equal(evidence.providerDetails.serpApi.exact.rows, 12);
    assert.equal(evidence.providerDetails.serpApi.exact.matches, 2);
    assert.equal(evidence.providerDetails.serpApi.broad.rows, 18);
    assert.equal(evidence.providerDetails.serpApi.broad.matches, 1);
    assert.equal(evidence.providerDetails.cardApi.total.rows, 10);
    assert.equal(evidence.providerDetails.cardApi.total.matches, 3);
    assert.match(evidence.notes.join(" "), /Current live attempt note/);
    assert.doesNotMatch(evidence.notes.join(" "), /Cached valuation note/);
  });

  await test("stronger live enrichment still replaces the fresh cache normally", async () => {
    const cachedResult = {
      provider: "Cached verified valuation",
      searchMode: "cached",
      searched: 3,
      matched: 3,
      used: 3,
      median: 100,
      low: 90,
      high: 110,
      confidence: "low",
      notes: [],
      comps: [comp("551111111111", 90), comp("552222222222", 100), comp("553333333333", 110)],
    };
    const liveComps = [
      comp("554444444444", 80, "SerpApi"),
      comp("555555555555", 90, "SerpApi"),
      comp("556666666666", 100, "The Card API"),
      comp("557777777777", 110, "The Card API"),
    ];
    const liveResult = {
      provider: "Live SerpApi + The Card API valuation",
      searchMode: "Sold-target-parallel-async-exact+broad",
      searched: 30,
      matched: 4,
      used: 4,
      median: 95,
      low: 87.5,
      high: 102.5,
      confidence: "medium",
      notes: [],
      comps: liveComps,
      providerDiagnostics: {
        serpApi: {
          exact: { rows: 10, matches: 2, status: "completed" },
          broad: { rows: 10, matches: 1, status: "completed" },
        },
      },
    };
    api.setMocks({
      readValuationCache: async () => ({ result: cachedResult, fresh: true, stale: false, ageSeconds: 60 }),
      valueCard: async () => liveResult,
    });
    const result = await api.getValuationWithCache(card, {}, true, null, {
      targetEnrichment: true,
      evidenceGoal: 4,
    });
    assert.equal(result.provider, liveResult.provider);
    assert.equal(result.used, 4);
    assert.equal(result.median, 95);
    assert.equal(result.cacheHit, false);
    assert.equal(result.targetEnrichmentFallback, undefined);
    assert.equal(JSON.stringify(result.comps), JSON.stringify(liveComps));
  });

  await test("live timeout diagnostics and credential redaction survive fresh-cache fallback", async () => {
    const cachedResult = {
      provider: "Cached verified Card API valuation",
      searchMode: "cached",
      searched: 7,
      matched: 3,
      used: 3,
      median: 100,
      low: 90,
      high: 110,
      confidence: "low",
      notes: [],
      comps: [comp("561111111111", 90), comp("562222222222", 100), comp("563333333333", 110)],
    };
    const timeout = new Error("Live enrichment failed with api_key=ERROR-SECRET");
    timeout.providerDiagnostics = {
      serpApi: {
        exact: { rows: 4, matches: 1, status: "completed", note: "Bearer EXACT-SECRET" },
        broad: { rows: 0, matches: 0, status: "timed_out", note: "https://serpapi.com/searches/123.json?api_key=BROAD-SECRET timed out while still processing" },
      },
      cardApi: {
        initial: { rows: 7, matches: 3, status: "completed", note: "x-market-api-key=CARD-SECRET" },
        fallback: { rows: 0, matches: 0, status: "timed_out", note: "" },
        total: { rows: 7, matches: 3, status: "completed", note: "" },
      },
    };
    api.setMocks({
      readValuationCache: async () => ({ result: cachedResult, fresh: true, stale: false, ageSeconds: 60 }),
      valueCard: async () => { throw timeout; },
    });
    const result = await api.getValuationWithCache(card, {}, true, null, {
      targetEnrichment: true,
      evidenceGoal: 4,
    });
    const evidence = api.targetPricingEvidenceDetails(result, true);
    assert.equal(result.provider, cachedResult.provider);
    assert.equal(result.used, 3);
    assert.equal(result.median, 100);
    assert.equal(result.cacheHit, true);
    assert.equal(evidence.cacheHit, true);
    assert.equal(evidence.soldCompsUsed, 3);
    assert.equal(evidence.providerDetails.serpApi.exact.rows, 4);
    assert.equal(evidence.providerDetails.serpApi.exact.matches, 1);
    assert.equal(evidence.providerDetails.serpApi.broad.status, "timed_out");
    assert.equal(evidence.providerDetails.cardApi.total.rows, 7);
    assert.equal(evidence.providerDetails.cardApi.total.matches, 3);
    assert.match(evidence.notes.join(" "), /provider diagnostics below describe this search's live enrichment attempt/i);
    const serialized = JSON.stringify(evidence);
    for (const secret of ["ERROR-SECRET", "EXACT-SECRET", "BROAD-SECRET", "CARD-SECRET", "serpapi.com/searches"]) {
      assert.equal(serialized.includes(secret), false, `fallback diagnostics leaked ${secret}`);
    }
  });

  await test("duplicate eBay IDs across exact, broad, and Card API count once", async () => {
    const duplicateId = "611111111111";
    api.setMocks({
      runEbaySearchAsync: async () => completed([serpRow(duplicateId, title, 100)]),
      searchCardApiEbaySold: async () => providerResult([
        comp(duplicateId, 100),
        comp("622222222222", 120),
      ]),
    });
    const result = await api.valueCard(card, {
      SERPAPI_KEY: "serp-test",
      CARD_API_KEY: "card-test",
    }, true, { targetEnrichment: true, evidenceGoal: 4 });
    assert.equal(result.used, 2);
    assert.equal(JSON.stringify(Array.from(result.comps, item => item.price).sort((a,b) => a-b)), "[100,120]");
  });

  await test("wrong-card broad rows remain rejected", async () => {
    api.setMocks({
      runEbaySearchAsync: async query => query === exactQuery
        ? completed([serpRow("711111111111", title, 100)])
        : completed([
            serpRow("722222222222", "1963 Topps #6 Sandy Koufax Baseball Card", 10),
            serpRow("733333333333", "1962 Topps #5 Sandy Koufax Baseball Card", 20),
          ]),
    });
    const result = await api.searchSerpApi(card, exactQuery, "test-key", true, { targetEnrichment: true });
    assert.equal(result.searched, 3);
    assert.equal(result.matched, 1);
    assert.equal(result.cleaned.length, 1);
    assert.equal(result.cleaned[0].price, 100);
  });

  await test("ordinary Fast Mode keeps synchronous Strict Sold behavior", async () => {
    let syncCalls = 0;
    let asyncCalls = 0;
    api.setMocks({
      runEbaySearch: async (query, _key, mode) => {
        syncCalls += 1;
        assert.equal(query, exactQuery);
        assert.equal(mode, "Sold");
        return completed([serpRow("811111111111")]);
      },
      runEbaySearchAsync: async () => { asyncCalls += 1; return completed([]); },
    });
    const result = await api.searchSerpApi(card, exactQuery, "test-key", true, {});
    assert.equal(syncCalls, 1);
    assert.equal(asyncCalls, 0);
    assert.equal(result.searchMode, "Sold");
  });

  await test("Deep Mode keeps synchronous strict then parallel Sold/Completed broad discovery", async () => {
    const asyncModes = [];
    let syncCalls = 0;
    api.setMocks({
      runEbaySearch: async () => { syncCalls += 1; return completed([]); },
      runEbaySearchAsync: async (_query, _key, mode) => {
        asyncModes.push(mode);
        return mode === "Sold"
          ? completed([serpRow("911111111111")])
          : completed([]);
      },
    });
    const result = await api.searchSerpApi(card, exactQuery, "test-key", false, {});
    assert.equal(syncCalls, 1);
    assert.deepEqual(asyncModes.sort(), ["Complete", "Sold"]);
    assert.equal(result.searchMode, "Sold-broad-async");
    assert.equal(result.cleaned.length, 1);
  });

  await test("team-card and 5x7 rejection regressions remain protected", () => {
    assert.equal(api.isExplicitTeamCardListing("1962 Topps DODGERS TEAM #43 “SANDY KOUFAX”"), true);
    assert.equal(api.isExplicitTeamCardListing("1961 Topps #86 Los Angeles Team Card Sandy Koufax"), true);
    assert.equal(api.isExplicitTeamCardListing("1963 Topps #5 Sandy Koufax Bob Gibson Don Drysdale"), false);
    assert.equal(api.isObviousNonTradingCardListing("Sandy Koufax 5 × 7 picture"), true);
  });

  await test("pricing diagnostics expose provider counts without credentials", () => {
    const evidence = api.targetPricingEvidenceDetails({
      provider: "SerpApi + The Card API api_key=SERP-SECRET",
      searchMode: "parallel https://serpapi.com/searches/123.json?api_key=URL-SECRET",
      searched: 7,
      matched: 3,
      used: 3,
      providerDiagnostics: {
        serpApi: {
          exact: { rows: 4, matches: 2, status: "completed", note: "Bearer TOKEN-SECRET" },
          broad: { rows: 0, matches: 0, status: "timed_out", note: "x-scout-key=SCOUT-SECRET timed out while still processing" },
        },
        cardApi: {
          initial: { rows: 7, matches: 3, status: "completed" },
          fallback: { rows: 0, matches: 0, status: "not_attempted" },
          total: { rows: 7, matches: 3, status: "completed" },
        },
      },
      notes: ["Authorization: Bearer AUTH-SECRET"],
    }, true);
    assert.equal(evidence.providerDetails.serpApi.exact.rows, 4);
    assert.equal(evidence.providerDetails.serpApi.exact.matches, 2);
    assert.equal(evidence.providerDetails.serpApi.broad.status, "timed_out");
    assert.equal(evidence.providerDetails.cardApi.total.rows, 7);
    assert.equal(evidence.providerDetails.cardApi.total.matches, 3);
    const serialized = JSON.stringify(evidence);
    for (const secret of ["SERP-SECRET", "URL-SECRET", "TOKEN-SECRET", "SCOUT-SECRET", "AUTH-SECRET", "serpapi.com/searches"]) {
      assert.equal(serialized.includes(secret), false, `diagnostics leaked ${secret}`);
    }
  });

  const html = fs.readFileSync("index.html", "utf8");
  const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/i);
  assert.ok(inlineScript, "index.html inline script should be present");
  new vm.Script(inlineScript[1], { filename: "index.html inline script" });
  assert.match(html, /SerpApi exact rows:/);
  assert.match(html, /SerpApi exact matches:/);
  assert.match(html, /SerpApi broad rows:/);
  assert.match(html, /SerpApi broad matches:/);
  assert.match(html, /Card API matches:/);

  function extractHtmlFunction(name) {
    const start = html.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `missing ${name}`);
    const end = html.indexOf("\nfunction ", start + 1);
    assert.notEqual(end, -1, `missing end of ${name}`);
    return html.slice(start, end).trim();
  }
  const uiContext = {
    escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    },
  };
  uiContext.globalThis = uiContext;
  vm.createContext(uiContext);
  for (const name of [
    "scoutPricingDiagnosticText",
    "scoutPricingEvidenceCount",
    "scoutPricingProviderSearchDetail",
    "scoutPricingProviderDetails",
    "scoutPricingEvidenceHtml",
  ]) {
    vm.runInContext(`${extractHtmlFunction(name)}\nglobalThis.${name}=${name};`, uiContext);
  }
  const fallbackMarkup = uiContext.scoutPricingEvidenceHtml({ pricingEvidence: cachedFallbackEvidence });
  assert.match(fallbackMarkup, /Sold comps used:<\/b> 3/);
  assert.match(fallbackMarkup, /Cache:<\/b> hit · fresh\/verified/);
  assert.match(fallbackMarkup, /SerpApi exact rows:<\/b> 12/);
  assert.match(fallbackMarkup, /SerpApi exact matches:<\/b> 2 · completed/);
  assert.match(fallbackMarkup, /SerpApi broad rows:<\/b> 18/);
  assert.match(fallbackMarkup, /SerpApi broad matches:<\/b> 1 · completed/);
  assert.match(fallbackMarkup, /Card API returned:<\/b> 10/);
  assert.match(fallbackMarkup, /Card API matches:<\/b> 3 · completed/);

  console.log("All Pricing Reliability Phase 3 tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
