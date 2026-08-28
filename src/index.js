const VERSION = "3.48.0";
const DEFAULT_ORIGIN = "https://beladiel.github.io";
const VALUATION_CACHE_VERSION = 1;
const TARGET_RANKING_VERSION = 1;
const VALUATION_CACHE_FRESH_SECONDS = 6 * 60 * 60;
const VALUATION_CACHE_RETENTION_SECONDS = 48 * 60 * 60;
const SERP_TIMEOUT_MS = 8000;
const SERP_COMPLETED_FAST_TIMEOUT_MS = 5000;
// Target/value sold-comps discovery gets its own request, so it can afford
// a little more provider time than live Deal Finder searches.
const SERP_SOLD_STRICT_TIMEOUT_MS = 10000;
// Broad sold searches use SerpApi async submission + Search Archive polling.
// This avoids holding one slow HTTP connection open until eBay finishes rendering.
const SERP_ASYNC_POLL_INTERVAL_MS = 1800;
const SERP_ASYNC_MAX_WAIT_MS = 30000;
const TARGET_EVIDENCE_GOAL = 4;
const TARGET_ENRICHMENT_WAIT_MS = 15000;
const TARGET_MARKET_CHECK_VERSION = 5;
const APIFY_FAST_COUNT = 12;
const APIFY_DEEP_COUNT = 15;
const APIFY_FAST_TIMEOUT_SECONDS = 20;
const APIFY_DEEP_TIMEOUT_SECONDS = 35;
const PSA_TIMEOUT_MS = 8000;
const PSA_CACHE_TTL_SECONDS = 24 * 60 * 60;
const CARD_API_TIMEOUT_MS = 7000;
const CARD_API_PER_PLATFORM_LIMIT = 5;
const CARD_API_EBAY_SOLD_LIMIT = 45;
const CARD_API_EBAY_FALLBACK_LIMIT = 25;
const CARD_API_TARGET_ROW_LIMIT = 70;
const CARD_API_BEST_OFFER_LIMIT = 15;
const BEST_OFFER_BRIDGE_APIFY_COUNT = 12;
const BEST_OFFER_BRIDGE_MAX_CANDIDATES = 3;
const LIVE_BO_FAST_MAX_CANDIDATES = 1;
const LIVE_BO_DEEP_MAX_CANDIDATES = 3;
const LIVE_BO_FAST_TIMEOUT_MS = 3500;
const LIVE_BO_DEEP_TIMEOUT_MS = 5000;
const CARD_API_PLATFORMS = ["goldin", "lelands", "scp", "hakes", "rea"];
const DEALS_TIMEOUT_MS = 9000;
const DEALS_SEARCH_COUNT = 50;
const ACTIVE_EBAY_SHIP_TO_ZIP = "87114";
const DEALS_BIN_LIMIT = 8;
const DEALS_AUCTION_LIMIT = 6;
const DEALS_REJECT_LIMIT = 10;
const COLLECTION_KV_KEY = "collection:primary:v1";
const COLLECTION_VALUE_HISTORY_META_KEY = "__scoutCollectionValueHistoryV1";
const COLLECTION_MAX_BYTES = 512 * 1024;
const COLLECTION_MAX_PLAYERS = 500;
const CARD_PHOTO_PREFIX = "card-photo:v1:";
const AUTOMATION_STATE_KEY = "automation:state:v1";
const AUTOMATION_CATALOG_KEY = "automation:catalog:v1";
const AUTOMATION_CATALOG_MAX_BYTES = 256 * 1024;
const PUSH_VAPID_KEY = "push:vapid:v1";
const PUSH_SUBSCRIPTIONS_KEY = "push:subscriptions:v1";
const PUSH_MAX_SUBSCRIPTIONS = 5;
const AUTOMATION_DEFAULT_SETTINGS = Object.freeze({
  monthlySerpCap: 30,
  targetMonitoringEnabled: true,
  targetCadenceDays: 7,
  collectionRefreshEnabled: true,
  collectionCardsPerMonth: 10,
});
const CARD_PHOTO_MAX_BYTES = 1200 * 1024;
const CARD_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const SEALED_VISION_MODEL = "@cf/moondream/moondream3.1-9B-A2B";
const SEALED_VISION_MAX_BYTES = 1500 * 1024;
const SEALED_VISION_CATEGORIES = new Set(["Pokémon", "Magic: The Gathering", "Baseball", "Basketball", "Football", "Other"]);
const SEALED_VISION_PRODUCT_TYPES = new Set(["Blaster Box", "Mega Box", "Hobby Box", "Retail Box", "Hanger Box", "Hanger Pack", "Value / Fat Pack", "Single Pack", "Multi-Pack", "Elite Trainer Box", "Collector Booster", "Play Booster", "Jumpstart Booster", "Booster Box", "Booster Bundle", "Booster Pack", "Collection Box", "Tin", "Other"]);

function sealedVisionJsonFromResponse(raw) {
  let value = raw?.response ?? raw?.result ?? raw?.answer ?? raw;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if ("category" in value || "productType" in value || "set" in value) return value;
    throw new Error("Unexpected sealed vision response envelope.");
  }
  let text = String(value || "").trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) text = text.slice(first, last + 1);
  return JSON.parse(text);
}

function sealedVisionNormalize(raw) {
  const categoryRaw = String(raw?.category || "").trim();
  const typeRaw = String(raw?.productType || raw?.boxType || "").trim();
  const confidenceRaw = String(raw?.confidence || "low").trim().toLowerCase();
  const visibleText = String(raw?.visibleText || raw?.text || "").trim().slice(0, 800);
  const clues = Array.isArray(raw?.clues) ? raw.clues.map(x => String(x || "").trim()).filter(Boolean).slice(0, 4) : [];
  const evidence = [visibleText, raw?.set, raw?.brandSet, raw?.variant, ...clues].map(x => String(x || "")).join(" ");
  let category = SEALED_VISION_CATEGORIES.has(categoryRaw) ? categoryRaw : (categoryRaw ? "Other" : "");
  if (/\bNBA\b|\bbasketball\b|\bNBA\s+Hoops\b/i.test(evidence)) category = "Basketball";
  else if (/\bNFL\b|\bfootball\b/i.test(evidence)) category = "Football";
  else if (/\bMLB\b|\bbaseball\b/i.test(evidence)) category = "Baseball";
  else if (/Pok[eé]mon|Trading Card Game|\bTCG\b/i.test(evidence)) category = "Pokémon";
  else if (/Magic:\s*The Gathering|\bMTG\b|Wizards of the Coast/i.test(evidence)) category = "Magic: The Gathering";

  let year = String(raw?.year || "").trim().slice(0, 40);
  if (!year) {
    const ym = evidence.match(/\b(20\d{2})(?:\s*[-–/]\s*(\d{2,4}))?\b/);
    if (ym) year = ym[2] ? `${ym[1]}-${ym[2].length === 2 ? ym[2] : ym[2].slice(-2)}` : ym[1];
  }
  let set = String(raw?.set || raw?.brandSet || "").trim().slice(0, 120);
  if (!set && /\bNBA\s+Hoops\b/i.test(evidence)) set = "NBA Hoops";

  const productType = SEALED_VISION_PRODUCT_TYPES.has(typeRaw) ? typeRaw : (typeRaw ? "Other" : "");
  const incomplete = !category || !set || !productType || productType === "Other";
  return {
    category,
    year,
    set,
    productType,
    variant: String(raw?.variant || "").trim().slice(0, 120),
    confidence: ["high", "medium", "low"].includes(confidenceRaw) ? confidenceRaw : "low",
    clues,
    visibleText,
    needsAnotherPhoto: Boolean(raw?.needsAnotherPhoto) || incomplete,
    followUp: String(raw?.followUp || (incomplete ? "Take another straight-on photo closer to the product name, year/season, and pack-count wording." : "")).trim().slice(0, 180),
  };
}


function sealedTypeJsonFromResponse(raw) {
  let value = raw?.response ?? raw?.result ?? raw?.answer ?? raw;
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  let text = String(value || "").trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try { return JSON.parse(text.slice(first, last + 1)); } catch {}
  }
  const productType = Array.from(SEALED_VISION_PRODUCT_TYPES)
    .filter(type => type !== "Other")
    .find(type => text.toLowerCase().includes(type.toLowerCase())) || "";
  const confidenceMatch = text.match(/\b(high|medium|low)\b/i);
  return {
    productType,
    confidence: confidenceMatch ? confidenceMatch[1].toLowerCase() : (productType ? "medium" : "low"),
    clues: [],
    followUp: "",
  };
}

function sealedTypeNormalize(raw) {
  const typeRaw = String(raw?.productType || raw?.boxType || "").trim();
  const confidenceRaw = String(raw?.confidence || "low").trim().toLowerCase();
  const productType = SEALED_VISION_PRODUCT_TYPES.has(typeRaw) ? typeRaw : "";
  const confidence = ["high", "medium", "low"].includes(confidenceRaw) ? confidenceRaw : "low";
  const clues = Array.isArray(raw?.clues) ? raw.clues.map(x => String(x || "").trim()).filter(Boolean).slice(0, 4) : [];
  const accepted = Boolean(productType && productType !== "Other" && confidence !== "low");
  return {
    productType,
    confidence,
    clues,
    accepted,
    followUp: String(raw?.followUp || "").trim().slice(0, 180),
  };
}


function sealedMarketPrice(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (value && typeof value === "object") {
    for (const key of ["extracted", "value", "amount", "raw"]) {
      const parsed = sealedMarketPrice(value[key]);
      if (parsed) return parsed;
    }
  }
  const text = String(value || "").replace(/,/g, "");
  const match = text.match(/(?:\$|USD\s*)?(\d+(?:\.\d{1,2})?)/i);
  const number = match ? Number(match[1]) : NaN;
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function sealedMarketMedian(values) {
  const sorted = values.filter(x => Number.isFinite(x) && x > 0).slice().sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function sealedMarketTypeMatches(title, type) {
  const text = String(title || "");
  const rules = {
    "Blaster Box": /\bblaster\b/i,
    "Mega Box": /\bmega\b/i,
    "Hobby Box": /\bhobby\b/i,
    "Retail Box": /\bretail\b/i,
    "Hanger Box": /\bhanger\b/i,
    "Hanger Pack": /\bhanger\b/i,
    "Value / Fat Pack": /\b(?:value|fat)\s*pack\b/i,
    "Single Pack": /\b(?:single|1)\s*pack\b|\bpack\b/i,
    "Multi-Pack": /\bmulti[- ]?pack\b|\b\d+\s*pack\b/i,
    "Elite Trainer Box": /\belite\s+trainer\s+box\b|\bETB\b/i,
    "Collector Booster": /\bcollector\s+boosters?(?:\s+(?:box|pack|display))?\b/i,
    "Play Booster": /\bplay\s+boosters?(?:\s+(?:box|pack|display))?\b/i,
    "Jumpstart Booster": /\bjumpstart\s+boosters?(?:\s+(?:box|pack|display))?\b/i,
    "Booster Box": /\bbooster\s+box\b/i,
    "Booster Bundle": /\bbooster\s+bundle\b/i,
    "Booster Pack": /\bbooster\s+pack\b/i,
    "Collection Box": /\bcollection\s+box\b/i,
    "Tin": /\btin\b/i,
  };
  const rule = rules[String(type || "")];
  return rule ? rule.test(text) : true;
}

function sealedMarketQuery(identity, lookupTitle) {
  const type = String(identity?.boxType || identity?.productType || "").trim();
  const set = String(identity?.set || "").trim();
  const year = String(identity?.year || "").trim();
  const variant = String(identity?.variant || "").trim();
  const knownTitle = String(lookupTitle || "").trim();
  let base = knownTitle || [year, set].filter(Boolean).join(" ");
  if (type && !base.toLowerCase().includes(type.toLowerCase())) base += ` ${type}`;
  if (variant && !base.toLowerCase().includes(variant.toLowerCase())) base += ` ${variant}`;
  return base.replace(/\s+/g, " ").trim().slice(0, 220);
}

function sealedMarketVerdict(shelfPrice, median, sampleCount) {
  if (!Number.isFinite(shelfPrice) || shelfPrice <= 0 || !Number.isFinite(median) || median <= 0 || sampleCount < 3) {
    return { verdict: "CHECK MANUALLY", reason: "Scout found too few competitive matching listings for a reliable price verdict." };
  }
  const ratio = shelfPrice / median;
  const differencePct = Math.round(Math.abs(1 - ratio) * 100);
  if (ratio <= 0.85) return { verdict: "GOOD BUY", reason: `Shelf price is about ${differencePct}% below the competitive current-listing median.` };
  if (ratio <= 1.10) return { verdict: "FAIR", reason: `Shelf price is within about ${differencePct}% of the competitive current-listing median.` };
  return { verdict: "PASS", reason: `Shelf price is about ${differencePct}% above the competitive current-listing median.` };
}

function sealedMarketCompetitiveSummary(listings) {
  const all = (Array.isArray(listings) ? listings : [])
    .filter(row => Number.isFinite(Number(row?.price)) && Number(row.price) > 0)
    .slice()
    .sort((a, b) => Number(a.price) - Number(b.price));
  if (!all.length) {
    return { median: null, low: null, high: null, sampleCount: 0, totalCleanCount: 0, listings: [] };
  }

  // Active asking-price pages often contain stale sellers priced far above the amount
  // a buyer can actually choose today. Use the cheapest ten clean single-unit matches
  // as the competitive market band, then take the median of that band. One unusually
  // cheap listing cannot control the result, while a wall of unrealistic high asks
  // cannot make an ordinary shelf price look like a bargain.
  const competitive = all.slice(0, Math.min(10, all.length));
  const prices = competitive.map(row => Number(row.price));
  const median = sealedMarketMedian(prices);
  return {
    median: Number.isFinite(median) ? Number(median.toFixed(2)) : null,
    low: prices.length ? Number(Math.min(...prices).toFixed(2)) : null,
    high: prices.length ? Number(Math.max(...prices).toFixed(2)) : null,
    sampleCount: competitive.length,
    totalCleanCount: all.length,
    listings: competitive.slice(0, 5),
  };
}

function sealedMarketIdentityTokens(value) {
  const stop = new Set([
    "nba", "nfl", "mlb", "basketball", "football", "baseball", "trading", "card", "cards",
    "value", "blaster", "box", "boxes", "hobby", "retail", "mega", "hanger", "booster",
    "elite", "trainer", "collection", "tin", "pack", "packs", "factory", "sealed", "brand",
    "new", "qty", "available"
  ]);
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter(token => !/^20\d{2}$/.test(token) && !/^\d{1,3}$/.test(token) && !stop.has(token));
}

function sealedMarketIdentityMatches(title, identity, lookupTitle) {
  const text = String(title || "");
  const known = [lookupTitle, identity?.set, identity?.variant].filter(Boolean).join(" ");
  const wanted = Array.from(new Set(sealedMarketIdentityTokens(known)));
  if (wanted.length) {
    const actual = new Set(sealedMarketIdentityTokens(text));
    const required = Math.min(2, wanted.length);
    const overlap = wanted.filter(token => actual.has(token)).length;
    if (overlap < required) return false;
  }

  const knownLower = known.toLowerCase();
  if (/\bfanatics\b/i.test(text) && !/\bfanatics\b/.test(knownLower)) return false;
  if (/\bchrome\b/i.test(text) && !/\bchrome\b/.test(knownLower)) return false;
  if (/\bsignature\s+class\b/i.test(text) && !/\bsignature\s+class\b/.test(knownLower)) return false;
  return true;
}

function sealedMarketIsMultiUnit(title) {
  const text = String(title || "");
  return /(?:^|\s)(?:[2-9]\d*)x\b|\blot\s+of\s+(?:[2-9]\d*|two|three|four|five|six|seven|eight|nine|ten)\b|\bcase\s+of\b|\b(?:[2-9]\d*)\s*(?:boxes|blasters|tins|etbs|bundles)\b/i.test(text);
}

function sealedMarketResultRows(data, identity, lookupTitle = "") {
  const rows = Array.isArray(data?.organic_results) ? data.organic_results : (Array.isArray(data?.results) ? data.results : []);
  const type = String(identity?.boxType || identity?.productType || "").trim();
  const seen = new Set();
  const clean = [];
  for (const row of rows) {
    const title = String(row?.title || row?.name || "").trim();
    if (!title || /\b(?:case\s+break|break\s+spot|rip\s*(?:&|and)\s*ship|live\s+rip|rip\s+ship|personal\s+break|team\s+break|random\s+team|empty\s+box|box\s+only|opened|wrapper|digital|you\s+pick|single\s+card)\b/i.test(title)) continue;
    if (sealedMarketIsMultiUnit(title)) continue;
    if (!sealedMarketTypeMatches(title, type)) continue;
    if (!sealedMarketIdentityMatches(title, identity, lookupTitle)) continue;
    const formatText = JSON.stringify([row?.buying_format, row?.buying_options, row?.bids, row?.bid_count, row?.time_left] || []).toLowerCase();
    if (/auction|\bbid\b/.test(formatText)) continue;
    const price = sealedMarketPrice(row?.price ?? row?.current_price ?? row?.displayed_price);
    if (!price || price < 3 || price > 5000) continue;
    const link = String(row?.link || row?.url || "").trim();
    const key = `${title.toLowerCase()}|${price.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push({ title: title.slice(0, 220), price: Number(price.toFixed(2)), link: /^https?:\/\//i.test(link) ? link : "" });
  }
  if (clean.length >= 5) {
    const firstMedian = sealedMarketMedian(clean.map(x => x.price));
    if (firstMedian) {
      return clean.filter(x => x.price >= firstMedian * 0.45 && x.price <= firstMedian * 2.2).slice(0, 20);
    }
  }
  return clean.slice(0, 20);
}


const SEALED_RIP_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

function sealedRipProductLabel(identity, lookupTitle = "") {
  const year = String(identity?.year || "").trim();
  const set = String(identity?.set || "").trim();
  const type = String(identity?.boxType || identity?.productType || "").trim();
  const variant = String(identity?.variant || "").trim();
  return String(lookupTitle || [year, set, type, variant].filter(Boolean).join(" "))
    .replace(/\s+/g, " ").trim().slice(0, 220);
}

function sealedRipIntelligenceCacheKey(identity, mode = "single") {
  const parts = [
    String(mode || "single").trim(),
    String(identity?.category || "").trim(),
    String(identity?.year || "").trim(),
    sealedRipResearchSet(identity),
    String(identity?.productType || identity?.boxType || "").trim(),
    String(identity?.variant || "").trim(),
  ].map(value => value.toLowerCase().replace(/\s+/g, " ").trim()).filter(Boolean);
  return `sealed:intel:v19:${encodeURIComponent(parts.join("|")).slice(0, 420)}`;
}

function sealedRipPriceScore(shelfPrice, median) {
  const shelf = Number(shelfPrice), market = Number(median);
  if (!Number.isFinite(shelf) || shelf <= 0 || !Number.isFinite(market) || market <= 0) return null;
  const ratio = shelf / market;
  if (ratio <= 0.75) return 100;
  if (ratio <= 0.85) return 92;
  if (ratio <= 0.95) return 82;
  if (ratio <= 1.05) return 72;
  if (ratio <= 1.10) return 62;
  if (ratio <= 1.20) return 45;
  return 25;
}

function sealedRipGrade(score) {
  if (score === null || score === undefined || score === "") return "—";
  const n = Number(score);
  if (!Number.isFinite(n)) return "—";
  if (n >= 90) return "A";
  if (n >= 82) return "A-";
  if (n >= 75) return "B+";
  if (n >= 68) return "B";
  if (n >= 60) return "B-";
  if (n >= 52) return "C+";
  if (n >= 44) return "C";
  if (n >= 36) return "C-";
  if (n >= 28) return "D";
  return "F";
}

function sealedRipProductEvidenceCount(parts = {}) {
  return [parts.chaseEvidenceAvailable, parts.pullEvidenceAvailable, parts.sentimentEvidenceAvailable].filter(Boolean).length;
}

function sealedRipCategoryKey(category) {
  const value = String(category || "").toLowerCase();
  if (["basketball", "baseball", "football"].includes(value)) return "sports";
  if (value.includes("pok")) return "pokemon";
  if (value.includes("magic")) return "magic";
  return "general";
}

function sealedRipWeightProfile(category) {
  const key = sealedRipCategoryKey(category);
  if (key === "pokemon") {
    return { price: 30, chase: 35, pull: 20, sentiment: 15, qualityChase: 45, qualityPull: 35, qualitySentiment: 20 };
  }
  if (key === "magic") {
    return { price: 30, chase: 45, pull: 10, sentiment: 15, qualityChase: 65, qualityPull: 10, qualitySentiment: 25 };
  }
  if (key === "sports") {
    return { price: 35, chase: 35, pull: 10, sentiment: 20, qualityChase: 55, qualityPull: 15, qualitySentiment: 30 };
  }
  return { price: 35, chase: 35, pull: 10, sentiment: 20, qualityChase: 55, qualityPull: 15, qualitySentiment: 30 };
}

function sealedRipScoreLabels(category) {
  const key = sealedRipCategoryKey(category);
  if (key === "pokemon") return { chase: "CHASES", pull: "PULL EXPERIENCE", sentiment: "COLLECTORS" };
  if (key === "magic") return { chase: "SET / VALUE", pull: "PULL EXPERIENCE", sentiment: "PLAYERS" };
  return { chase: "CHASES", pull: "PULL ODDS", sentiment: "COLLECTORS" };
}

function sealedRipResearchTerms(category) {
  const key = sealedRipCategoryKey(category);
  if (key === "pokemon") {
    return {
      authority: 'set cards "special illustration rare" "illustration rare" "hyper rare" product',
      community: 'chases SIR IR "hyper rare" "pull rates" "hit rates" openings review',
    };
  }
  if (key === "magic") {
    return {
      authority: '"card image gallery" mythic rare borderless showcase "special guests" serialized foil',
      community: 'value playable staples mythic borderless showcase pulls openings review',
    };
  }
  return {
    authority: "checklist",
    community: "pulls review quality control collation",
  };
}

function sealedRipPriceGuideSite(category) {
  const key = sealedRipCategoryKey(category);
  if (key === "magic") return "site:tcgplayer.com";
  if (key === "pokemon") return "site:tcgplayer.com";
  if (key === "sports") return "site:sportscardspro.com";
  return "";
}

function sealedRipPriceGuideQuery(identity, researchSet = "") {
  const key = sealedRipCategoryKey(identity?.category);
  const year = String(identity?.year || "").replace(/[^0-9]+/g, " ").trim();
  const cleanSet = String(researchSet || sealedRipResearchSet(identity)).replace(/\b(?:trading|cards?|nba|nfl|mlb)\b/gi, " ").replace(/\s+/g, " ").trim();
  const site = sealedRipPriceGuideSite(identity?.category);
  if (key === "magic") return `"${cleanSet}" ${site} "Market Price" Magic`.replace(/\s+/g, " ").trim();
  if (key === "pokemon") return `${year} "${cleanSet}" ${site} "price guide" "Market Price"`.replace(/\s+/g, " ").trim();
  if (key === "sports") return `${year} "${cleanSet}" ${String(identity?.category || "").toLowerCase()} ${site} Ungraded price`.replace(/\s+/g, " ").trim();
  return `${year} "${cleanSet}" ${site} card prices`.replace(/\s+/g, " ").trim();
}

function sealedRipCategoryGuidance(category) {
  const key = sealedRipCategoryKey(category);
  if (key === "pokemon") {
    return `CATEGORY PLAYBOOK — POKÉMON:
Judge this as Pokémon TCG, not as a sports-card box. Focus on desirable Pokémon/cards and set-specific chase tiers such as Special Illustration Rares (SIRs), Illustration Rares (IRs), Hyper Rares, special treatments, illustration cards, and other clearly supported chase rarities. Evaluate whether the exact sealed format gives a satisfying opening experience. Manufacturer odds are often unavailable; clearly labeled community pull-rate or hit-rate samples MAY be used when the exact rate is literally present in the evidence and the source is identified as community/reported rather than official. Never convert anecdotes into official odds. Weight chase quality and observed pull experience more heavily than sports-style case-hit language.`;
  }
  if (key === "magic") {
    return `CATEGORY PLAYBOOK — MAGIC: THE GATHERING:
Judge this as Magic, and respect the exact sealed format (Collector Booster, Play Booster, Booster Box, Bundle, Commander product, etc.). Focus on valuable or desirable mythics/rares, borderless/showcase treatments, serialized cards when applicable, Special Guests/bonus sheets, desirable foils, and playable staples. For chaseScore, include the DEPTH and PLAYABLE/VALUE QUALITY of the set, not only jackpot cards. A product with many cards people actively want for decks can score well even without a sports-style case hit. Keep Collector Booster, Play Booster, Bundle, Commander, and other configurations distinct. Wizards product/set pages are primary identity/mechanics evidence; community evidence can inform opening experience and player value.`;
  }
  if (key === "sports") {
    return `CATEGORY PLAYBOOK — SPORTS:
Judge this in sports-card terms: major rookies and stars, autographs, numbered/color parallels, SSPs/case hits, retail or format exclusives, checklist depth, product-format differences, recurring collector reports, and exact odds when published. Prefer evidence that applies to this exact retail/hobby format rather than Hobby-only hits that cannot come from the scanned product.`;
  }
  return `CATEGORY PLAYBOOK — GENERAL:
Use the vocabulary and value signals appropriate to the identified trading-card category and exact sealed format. Do not force sports-card concepts onto a non-sports product.`;
}

function sealedRipConfidence(parts = {}) {
  const count = sealedRipProductEvidenceCount(parts);
  if (count >= 3) return "high";
  if (count >= 2) return "medium";
  return "low";
}

function sealedRipFinalVerdict(score, parts = {}) {
  if (sealedRipProductEvidenceCount(parts) < 2) return "NEED MORE DATA";
  const n = Number(score);
  if (!Number.isFinite(n)) return "NEED MORE DATA";
  if (n >= 82) return "BUY IT";
  if (n >= 70) return "BUY ONE";
  if (n >= 58) return "MAYBE";
  return "PASS";
}

function sealedRipWeightedScore(parts, category = "") {
  if (sealedRipProductEvidenceCount(parts) < 2) return null;
  const weights = sealedRipWeightProfile(category);
  const available = [
    [Number(parts.priceScore), weights.price, parts.priceScore !== null && parts.priceScore !== undefined && Number.isFinite(Number(parts.priceScore))],
    [Number(parts.chaseScore), weights.chase, Boolean(parts.chaseEvidenceAvailable) && Number.isFinite(Number(parts.chaseScore))],
    [Number(parts.pullScore), weights.pull, Boolean(parts.pullEvidenceAvailable) && Number.isFinite(Number(parts.pullScore))],
    [Number(parts.sentimentScore), weights.sentiment, Boolean(parts.sentimentEvidenceAvailable) && Number.isFinite(Number(parts.sentimentScore))],
  ].filter(row => row[2]);
  const weight = available.reduce((sum, row) => sum + row[1], 0);
  if (!weight) return null;
  return Math.round(available.reduce((sum, row) => sum + row[0] * row[1], 0) / weight);
}

function sealedRipQualityScore(parts, category = "") {
  if (sealedRipProductEvidenceCount(parts) < 2) return null;
  const weights = sealedRipWeightProfile(category);
  const available = [
    [Number(parts.chaseScore), weights.qualityChase, Boolean(parts.chaseEvidenceAvailable) && Number.isFinite(Number(parts.chaseScore))],
    [Number(parts.pullScore), weights.qualityPull, Boolean(parts.pullEvidenceAvailable) && Number.isFinite(Number(parts.pullScore))],
    [Number(parts.sentimentScore), weights.qualitySentiment, Boolean(parts.sentimentEvidenceAvailable) && Number.isFinite(Number(parts.sentimentScore))],
  ].filter(row => row[2]);
  const weight = available.reduce((sum, row) => sum + row[1], 0);
  if (!weight) return null;
  return Math.round(available.reduce((sum, row) => sum + row[0] * row[1], 0) / weight);
}

function sealedRipSourceType(row) {
  const link = String(row?.link || "").toLowerCase();
  const source = String(row?.source || "").toLowerCase();
  const text = `${link} ${source}`;
  if (/topps\.com|paniniamerica\.net|pokemon\.com|magic\.wizards\.com|wizards\.com/.test(text)) return "official";
  if (/reddit\.com|blowoutforums\.com|sportscardforum\.com|elitefourum\.com/.test(text)) return "community";
  if (/checklist|beckett|cardboardconnection|tcgplayer|pricecharting|sportscardspro|sportscollectorsdaily|pokebeach|justinbasil|mtggoldfish|scryfall/.test(text)) return "checklist/editorial";
  return "editorial";
}

function sealedRipIsShoppingSource(row) {
  const text = `${row?.link || ""} ${row?.source || ""} ${row?.title || ""}`.toLowerCase();
  return /ebay\.|amazon\.|walmart\.|target\.|bestbuy\.|mercari\.|whatnot\.|fanatics\.com\/.*(?:product|shop)|etsy\.|blowoutcards\.com|dacardworld\.com|steelcitycollectibles\.com|dickssportinggoods\.com|shop\.app|vortextcg\.com/.test(text);
}

function sealedRipEvidenceRows(data, queryKind) {
  const rows = Array.isArray(data?.organic_results) ? data.organic_results : [];
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const title = String(row?.title || "").trim();
    const link = String(row?.link || "").trim();
    const rich = row?.rich_snippet ? JSON.stringify(row.rich_snippet) : "";
    const richTable = row?.rich_snippet_table ? JSON.stringify(row.rich_snippet_table) : "";
    const about = row?.about_this_result ? JSON.stringify(row.about_this_result) : "";
    const answers = row?.answers ? JSON.stringify(row.answers) : "";
    const related = row?.related_questions ? JSON.stringify(row.related_questions) : "";
    const sitelinks = row?.sitelinks ? JSON.stringify(row.sitelinks) : "";
    const extensions = row?.extensions ? JSON.stringify(row.extensions) : "";
    const snippet = [row?.snippet, row?.snippet_highlighted_words?.join(" "), rich, richTable, answers, related, sitelinks, extensions, about]
      .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    if (!title || !/^https?:\/\//i.test(link) || sealedRipIsShoppingSource(row) || /facebook\.com|instagram\.com|tiktok\.com/i.test(link)) continue;
    const key = link.replace(/[?#].*$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      title: title.slice(0, 220),
      link: link.slice(0, 500),
      snippet: snippet.slice(0, 900),
      source: String(row?.source || "").trim().slice(0, 120),
      sourceType: sealedRipSourceType(row),
      queryKind,
      ampLink: /^https?:\/\//i.test(String(row?.amp_link || "")) ? String(row.amp_link).slice(0, 700) : "",
      cachedPageLink: /^https?:\/\//i.test(String(row?.cached_page_link || "")) ? String(row.cached_page_link).slice(0, 1000) : "",
    });
    if (out.length >= 12) break;
  }
  return out;
}

function sealedRipSerpEvidenceText(data) {
  const chunks = [];
  const add = value => {
    if (value === null || value === undefined || value === "") return;
    const text = typeof value === "string" ? value : JSON.stringify(value);
    if (text && text !== "{}" && text !== "[]") chunks.push(text);
  };
  add(data?.answer_box);
  add(data?.ai_overview);
  add(data?.related_questions);
  const rows = Array.isArray(data?.organic_results) ? data.organic_results.slice(0, 8) : [];
  for (const row of rows) {
    add({
      title: row?.title,
      link: row?.link,
      snippet: row?.snippet,
      highlighted: row?.snippet_highlighted_words,
      rich: row?.rich_snippet,
      richTable: row?.rich_snippet_table,
      answers: row?.answers,
      relatedQuestions: row?.related_questions,
      sitelinks: row?.sitelinks,
      extensions: row?.extensions,
    });
  }
  return chunks.join("\n---\n").replace(/\s+/g, " ").slice(0, 24000);
}

async function sealedRipGoogleSearch(query, apiKey, timeoutMs = 15000, device = "") {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("num", "20");
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "us");
  if (device) url.searchParams.set("device", device);
  url.searchParams.set("api_key", apiKey);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(8000, Number(timeoutMs) || 15000));
  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.error) throw new Error("research_search_failed");
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function sealedRipCommunitySite(category) {
  const value = String(category || "").toLowerCase();
  if (value === "basketball") return "site:reddit.com/r/basketballcards";
  if (value === "baseball") return "site:reddit.com/r/baseballcards";
  if (value === "football") return "site:reddit.com/r/footballcards";
  if (value.includes("pok")) return "site:reddit.com/r/PokemonTCG";
  if (value.includes("magic")) return "site:reddit.com/r/magicTCG";
  return "site:reddit.com";
}

function sealedRipPrimaryAuthoritySite(category) {
  const value = String(category || "").toLowerCase();
  // A single site: filter is substantially more reliable in Google than a long
  // parenthesized OR-chain of domains. Beckett is the primary sports checklist
  // and odds source; the second planned search stays reserved for community sentiment.
  if (["basketball", "baseball", "football"].includes(value)) return "site:beckett.com";
  if (value.includes("pok")) return "site:pokemon.com";
  if (value.includes("magic")) return "site:magic.wizards.com";
  return "";
}

function sealedRipAuthorityQuery(identity, researchSet, authoritySite, formatTerms, researchTerms) {
  const key = sealedRipCategoryKey(identity?.category);
  const authorityYear = String(identity?.year || "").replace(/[^0-9]+/g, " ").trim();
  const setText = String(researchSet || "").replace(/\bmagic\s*:?\s*the\s+gathering\b/ig, " ").replace(/\s+/g, " ").trim();
  if (key === "magic") {
    // Wizards organizes useful evidence around the set/product hub, card-image gallery,
    // collecting guide, and set archive. Requiring an exact box phrase during discovery
    // can hide those canonical pages, so discover the set first and enforce format later.
    return `${setText || researchSet} ${authoritySite} product "card image gallery" collecting booster contents`.replace(/\s+/g, " ").trim();
  }
  if (key === "pokemon") {
    // Pokémon official pages are likewise set-first; exact pack/box experience belongs
    // in extraction/community validation rather than in the authority discovery query.
    return `${authorityYear} ${setText || researchSet} ${authoritySite} set cards product`.replace(/\s+/g, " ").trim();
  }
  const authorityCategory = String(identity?.category || "").trim().toLowerCase();
  // Sports discovery is set-first too. Requiring Blaster/Mega/Hanger wording in
  // the one Beckett search can hide the canonical set checklist entirely. Exact
  // configuration is enforced later by section-local Format Access validation.
  return `${authorityYear} ${researchSet} ${authorityCategory} ${authoritySite} ${researchTerms.authority}`.replace(/\s+/g, " ").trim();
}

function sealedRipFormatTerms(identity) {
  const type = `${identity?.variant || ""} ${identity?.productType || identity?.boxType || ""}`.trim().toLowerCase();
  if (type.includes("collector booster")) return '"collector booster"';
  if (type.includes("play booster")) return '"play booster"';
  if (type.includes("jumpstart booster")) return '"jumpstart booster"';
  if (type.includes("blaster")) return '("blaster" OR "value box")';
  if (type.includes("mega")) return '"mega box"';
  if (type.includes("hanger")) return 'hanger';
  if (type.includes("hobby")) return '"hobby box"';
  if (type.includes("elite trainer")) return '("elite trainer box" OR ETB)';
  if (type.includes("booster")) return `"${type}"`;
  return type ? `"${type}"` : "retail";
}

function sealedRipResearchSet(identity) {
  let text = String(identity?.set || "").trim();
  const year = String(identity?.year || "").trim();
  if (year) text = text.replace(new RegExp(year.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ");
  text = text
    .replace(/\b(?:collector|play|jumpstart)\s+booster(?:\s+(?:box|pack|display))?\b/gi, " ")
    .replace(/\b20\d{2}(?:\s*[-–/]\s*\d{2,4})?\b/g, " ")
    .replace(/\b(?:basketball|baseball|football|trading\s+cards?|cards?)\b/gi, " ")
    .replace(/\b(?:value|retail|hobby|mega|blaster|hanger|booster|collection)\s*(?:box|pack|bundle)?\b/gi, " ")
    .replace(/\b(?:factory|brand\s+new|new|sealed|qty|available)\b/gi, " ")
    .replace(/\b\d+\s*(?:cards?|packs?)\b/gi, " ")
    .replace(/[()\[\]{}|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.split(/\s+/).slice(0, 7).join(" ");
}

function sealedRipSetKeywords(identity) {
  const stop = new Set(["topps", "panini", "upper", "deck", "pokemon", "pokémon", "magic", "gathering", "nba", "nfl", "mlb", "basketball", "baseball", "football", "cards", "card", "trading", "the", "and", "value", "retail", "hobby", "mega", "blaster", "hanger", "booster", "box", "pack", "bundle", "factory", "sealed", "new"]);
  return sealedRipResearchSet(identity).toLowerCase().match(/[a-z0-9]+/g)?.filter(token => token.length >= 3 && !/^\d+$/.test(token) && !stop.has(token)) || [];
}

function sealedRipEvidenceYearConflict(text, identity) {
  const wanted = String(identity?.year || "").match(/\b(20\d{2})\b/);
  if (!wanted) return false;
  const rowYears = Array.from(String(text || "").matchAll(/\b(20\d{2})\b/g), match => match[1]);
  return rowYears.length > 0 && !rowYears.includes(wanted[1]);
}

function sealedRipEvidenceBrandConflict(text, identity) {
  const wantedText = String(identity?.set || "").toLowerCase();
  const rowText = String(text || "").toLowerCase();
  const groups = [
    { key: "topps", re: /\b(?:topps|bowman)\b/i },
    { key: "panini", re: /\b(?:panini|donruss|prizm|select|mosaic)\b/i },
    { key: "upperdeck", re: /\b(?:upper\s+deck|o-pee-chee|opc)\b/i },
  ];
  const wantedGroups = groups.filter(group => group.re.test(wantedText)).map(group => group.key);
  if (!wantedGroups.length) return false;
  const rowGroups = groups.filter(group => group.re.test(rowText)).map(group => group.key);
  if (!rowGroups.length) return false;
  return !rowGroups.some(group => wantedGroups.includes(group));
}

function sealedRipFilterRelevantEvidence(rows, identity) {
  const tokens = sealedRipSetKeywords(identity);
  if (!tokens.length) return Array.isArray(rows) ? rows : [];
  const requiredMatches = Math.min(2, tokens.length);
  return (Array.isArray(rows) ? rows : []).filter(row => {
    const hardIdentityText = `${row?.title || ""} ${row?.link || ""}`;
    if (sealedRipEvidenceYearConflict(hardIdentityText, identity)) return false;
    if (sealedRipEvidenceBrandConflict(hardIdentityText, identity)) return false;
    const text = `${row?.title || ""} ${row?.snippet || ""} ${row?.link || ""}`.toLowerCase();
    const matched = tokens.filter(token => text.includes(token)).length;
    return matched >= requiredMatches;
  });
}

function sealedRipDecodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function sealedRipPageExcerpt(html) {
  let text = String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  text = sealedRipDecodeHtml(text).replace(/\s+/g, " ").trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  const needles = [
    "1:", "odds", "blaster", "value box", "what to expect in a value box", "rookie", "signature", "hyper signatures", "autograph", "case hit", "block by block", "boom shaka laka", "green hoops", "light burst", "parallel", "exclusive", "short print", "ssp",
    "mythic", "rare", "borderless", "showcase", "serialized", "special guest", "bonus sheet", "foil", "collector booster", "play booster", "booster contents", "headliner", "extended art", "source material", "commander",
    "special illustration rare", "illustration rare", "hyper rare", "secret rare", "ultra rare", "pull rate", "hit rate",
    "market price", "most expensive", "ungraded", "price guide", "$"
  ];
  const chunks = [];
  const used = new Set();
  for (const needle of needles) {
    let from = 0;
    let hits = 0;
    while (hits < 4) {
      const at = lower.indexOf(needle, from);
      if (at < 0) break;
      const start = Math.max(0, at - 700);
      const end = Math.min(text.length, at + 1500);
      const key = `${Math.floor(start / 500)}:${Math.floor(end / 500)}`;
      if (!used.has(key)) {
        used.add(key);
        chunks.push(text.slice(start, end));
      }
      from = at + needle.length;
      hits++;
    }
  }
  return (chunks.length ? chunks.join("\n---\n") : text.slice(0, 5000)).slice(0, 9000);
}

function sealedRipPriceGuideExcerpt(raw) {
  let text = String(raw || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(?:tr|p|div|li|section|article|h[1-6])>/gi, "\n")
    .replace(/<(?:br|hr)\b[^>]*>/gi, "\n")
    .replace(/<\/(?:td|th)>/gi, " | ")
    .replace(/<[^>]+>/g, " ");
  text = sealedRipDecodeHtml(text).replace(/\r/g, "\n");
  const lines = text
    .split(/\n+/)
    .map(line => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 6000);
  const blocks = [];
  const seen = new Set();
  const hasPrice = value => /(?:\$|usd\s*)\s*\d+(?:\.\d{1,2})?\b/i.test(String(value || ""));
  const hasBasis = value => /\b(?:market\s+price|ungraded|near\s+mint)\b/i.test(String(value || ""));
  const add = value => {
    const block = String(value || "").replace(/[ \t]+/g, " ").trim().slice(0, 900);
    if (!block || !hasPrice(block)) return;
    const key = block.toLowerCase().replace(/[^a-z0-9$]+/g, " ").slice(0, 320);
    if (seen.has(key)) return;
    seen.add(key);
    blocks.push(block);
  };
  for (let i = 0; i < lines.length && blocks.length < 60; i++) {
    const line = lines[i];
    if (hasPrice(line)) {
      const prev = i > 0 ? lines[i - 1] : "";
      add(!hasBasis(line) && hasBasis(prev) && prev.length <= 260 ? `${prev} | ${line}` : line);
      continue;
    }
    if (hasBasis(line) && i + 1 < lines.length && hasPrice(lines[i + 1])) {
      add(`${line} | ${lines[i + 1]}`);
    }
  }
  return blocks.join("\n---\n").slice(0, 14000);
}

function sealedRipPageHasUsefulSignals(text) {
  const value = String(text || "");
  return /\b1\s*:\s*\d{1,7}\b|\$\s*\d+(?:\.\d{1,2})?|\b(?:market price|most expensive|ungraded|price guide|value box|blaster|retail[- ]only|case hit|rookie|autograph|parallel|ssp|short print|sir|special illustration rare|illustration rare|hyper rare|pull rate|hit rate|mythic|borderless|showcase|serialized|special guests?|bonus sheet|foil|playable|staple)\b/i.test(value);
}

function sealedRipCanUseReader(row) {
  const link = String(row?.link || "").toLowerCase();
  return /https?:\/\/(?:www\.)?(?:beckett\.com|topps\.com|checklistinsider\.com|cardboardconnection\.com|pokemon\.com|pokebeach\.com|justinbasil\.com|magic\.wizards\.com|wizards\.com|mtggoldfish\.com|tcgplayer\.com|pricecharting\.com|sportscardspro\.com|scryfall\.com)\//.test(link);
}

async function sealedRipReaderPageText(row) {
  if (!sealedRipCanUseReader(row)) return "";
  const target = String(row.link || "").trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 14000);
  try {
    // Jina Reader renders difficult public pages and returns LLM-friendly text.
    // It is a fallback only; direct source fetching remains the first choice.
    const response = await fetch(`https://r.jina.ai/${target}`, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "Accept": "text/plain,text/markdown;q=0.9,*/*;q=0.1", "User-Agent": "HOF-Card-Scout/1.0" },
    });
    if (!response.ok) return "";
    const text = (await response.text()).slice(0, 1200000);
    return row?.queryKind === "singles-price-guide" ? sealedRipPriceGuideExcerpt(text) : sealedRipPageExcerpt(text);
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function sealedRipFetchPageText(row) {
  if (!row || row.sourceType === "community" || !/^https?:\/\//i.test(String(row.link || ""))) return "";
  let bestExcerpt = "";
  const candidates = [row?.ampLink, row?.cachedPageLink, row?.link]
    .map(value => String(value || "").trim())
    .filter((value, index, all) => /^https?:\/\//i.test(value) && all.indexOf(value) === index);
  for (const target of candidates) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8500);
    try {
      const response = await fetch(target, {
        signal: controller.signal,
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 HOF-Card-Scout/1.0", "Accept": "text/html,application/xhtml+xml,text/plain;q=0.8" },
      });
      if (response.ok) {
        const contentType = String(response.headers.get("content-type") || "").toLowerCase();
        if (!contentType || /text\/(?:html|plain)|application\/xhtml/.test(contentType)) {
          const body = (await response.text()).slice(0, 1000000);
          const excerpt = row?.queryKind === "singles-price-guide" ? sealedRipPriceGuideExcerpt(body) : sealedRipPageExcerpt(body);
          if (excerpt.length > bestExcerpt.length) bestExcerpt = excerpt;
          if (sealedRipPageHasUsefulSignals(excerpt)) return excerpt;
        }
      }
    } catch {
      // Try the next Google-provided/publisher URL.
    } finally {
      clearTimeout(timeout);
    }
  }

  const readerExcerpt = await sealedRipReaderPageText(row);
  if (sealedRipPageHasUsefulSignals(readerExcerpt)) return readerExcerpt;
  return readerExcerpt || bestExcerpt;
}

function sealedRipEvidencePriority(row) {
  if (row?.queryKind === "singles-price-guide") return 0.5;
  const type = String(row?.sourceType || "");
  const link = String(row?.link || "").toLowerCase();
  if (type === "official") return 0;
  if (type === "checklist/editorial") return 1;
  if (/beckett\.com|cardboardconnection\.com|checklistinsider\.com/.test(link)) return 1;
  if (type === "editorial") return 2;
  return 3;
}

async function sealedRipExpandEvidenceRows(rows) {
  const list = Array.isArray(rows) ? rows.slice(0, 20) : [];
  const candidates = list
    .map((row, index) => ({ row, index }))
    .filter(x => x.row.sourceType !== "community");
  // Showdown uses the second research search for a singles price guide. Those rich
  // pages must never crowd the authoritative set/checklist page out of the reader
  // budget. Reserve most expansion slots for product evidence and only a small lane
  // for price-guide extraction.
  const authorityCandidates = candidates
    .filter(x => x.row.queryKind !== "singles-price-guide")
    .sort((a, b) => sealedRipEvidencePriority(a.row) - sealedRipEvidencePriority(b.row) || a.index - b.index)
    .slice(0, 6);
  const priceGuideCandidates = candidates
    .filter(x => x.row.queryKind === "singles-price-guide")
    .sort((a, b) => a.index - b.index)
    .slice(0, 2);
  const fetchable = [...authorityCandidates, ...priceGuideCandidates];
  const expanded = await Promise.all(fetchable.map(async ({ row, index }) => ({ index, pageText: await sealedRipFetchPageText(row) })));
  const byIndex = new Map(expanded.map(x => [x.index, x.pageText]));
  return list.map((row, index) => ({ ...row, pageText: byIndex.get(index) || "" }));
}

function sealedRipPromptSignals(rows, category = "") {
  const ordered = (Array.isArray(rows) ? rows.slice() : [])
    .sort((a, b) => sealedRipEvidencePriority(a) - sealedRipEvidencePriority(b));
  const chunks = [];
  const seen = new Set();
  const key = sealedRipCategoryKey(category);
  const common = [/\b1\s*:\s*\d{1,7}\b/ig];
  const sports = [
    /\b(?:retail[- ]only|retail exclusive|value box|blaster|case hit|rookie signatures?|hyper signatures?|autographs?|light burst|green hoops|numbered|parallel|ssp|short print|rookies?)\b/ig,
  ];
  const pokemon = [
    /\b(?:special illustration rare|illustration rare|hyper rare|secret rare|ultra rare|full art|special treatment|sir|ir|pull rate|hit rate|booster bundle|elite trainer box|etb)\b/ig,
  ];
  const magic = [
    /\b(?:mythic(?: rare)?|rare|borderless|showcase|serialized|special guests?|bonus sheet|foil|cosmic foil|collector boosters?|play boosters?|booster contents|headliner|extended art|source material|commander|playable|staple)\b/ig,
  ];
  const patterns = [...common, ...(key === "magic" ? magic : key === "pokemon" ? pokemon : sports)];
  for (const row of ordered) {
    const text = `${row?.snippet || ""} ${row?.pageText || ""}`.replace(/\s+/g, " ").trim();
    if (!text) continue;
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      let hits = 0;
      while ((match = pattern.exec(text)) && hits < 7) {
        const start = Math.max(0, match.index - 260);
        const end = Math.min(text.length, match.index + match[0].length + 700);
        const excerpt = text.slice(start, end).trim();
        const dedupeKey = excerpt.toLowerCase().replace(/[^a-z0-9]+/g, " ").slice(0, 180);
        if (excerpt && !seen.has(dedupeKey)) {
          seen.add(dedupeKey);
          chunks.push(`[${row.sourceType}] ${row.title}: ${excerpt}`);
        }
        hits++;
        if (chunks.length >= 22) break;
      }
      if (chunks.length >= 22) break;
    }
    if (chunks.length >= 22) break;
  }
  return chunks.join("\\n---\\n").slice(0, 18000);
}

function sealedRipChaseSupported(name, evidenceText) {
  const stop = new Set(["rookie", "rookies", "card", "cards", "parallel", "parallels", "insert", "inserts", "autograph", "autographs", "auto", "case", "hit", "short", "print", "ssp"]);
  const tokens = String(name || "").toLowerCase().match(/[a-z0-9]+/g)?.filter(token => token.length >= 4 && !stop.has(token)) || [];
  if (!tokens.length) return false;
  const haystack = String(evidenceText || "").toLowerCase();
  const matched = tokens.filter(token => haystack.includes(token)).length;
  return matched >= Math.min(2, tokens.length);
}

function sealedRipAiJson(raw) {
  let value = raw?.response ?? raw?.result ?? raw?.answer ?? raw;
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  let text = String(value || "").trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) text = text.slice(first, last + 1);
  return JSON.parse(text);
}

function sealedRipClampScore(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}

function sealedRipOddsDenominator(value) {
  const text = String(value || "").trim();
  const match = text.match(/\b1\s*(?::|\/)\s*(\d{1,6})\b/i) || text.match(/\b1\s+(?:in|per)\s+(\d{1,6})\b/i);
  const n = match ? Number(match[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function sealedRipVerifiedPullScore(rawScore, pullOdds = []) {
  const aiScore = sealedRipClampScore(rawScore);
  const denominators = (Array.isArray(pullOdds) ? pullOdds : [])
    .map(row => sealedRipOddsDenominator(row?.odds))
    .filter(n => Number.isFinite(n) && n > 0);
  if (!denominators.length) return aiScore;

  // Pull score measures how frequently supported non-base outcomes can appear;
  // chase desirability/value is scored separately. Verified literal odds therefore
  // prevent a contradictory 0/100 when the same response lists real pull odds.
  const best = Math.min(...denominators);
  let floor = best <= 3 ? 50
    : best <= 5 ? 46
    : best <= 8 ? 42
    : best <= 12 ? 38
    : best <= 20 ? 34
    : best <= 50 ? 30
    : 22;
  floor += Math.min(8, Math.max(0, denominators.length - 1) * 2);
  return Math.max(aiScore, Math.min(70, floor));
}

function sealedRipTemperCollectorLanguage(value, communitySourceCount = 0) {
  let text = String(value || "").trim();
  if (communitySourceCount < 3) {
    text = text
      .replace(/\bmany collectors\b/gi, "the collector discussions Scout found")
      .replace(/\bmost collectors\b/gi, "the collector discussions Scout found")
      .replace(/\bcollector consensus\b/gi, "the available collector discussions")
      .replace(/\boverall, the collector sentiment is\b/gi, "In the available collector discussions, sentiment is");
  }
  return text;
}

function sealedRipOddsSupported(odds, evidenceText) {
  const raw = String(odds || "").trim();
  if (!raw) return false;
  const simplify = value => String(value || "").toLowerCase().replace(/\s+/g, "").replace(/[–—]/g, "-");
  return simplify(evidenceText).includes(simplify(raw));
}

function sealedRipEvidenceIdentityTokens(identity = {}) {
  const stop = new Set([
    "the", "and", "with", "cards", "card", "trading", "tcg", "nba", "nfl", "mlb",
    "basketball", "football", "baseball", "pokemon", "pokémon", "magic", "gathering",
    "topps", "panini", "upper", "deck"
  ]);
  return String(identity?.set || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(token => token.length >= 3 && !stop.has(token));
}

function sealedRipEvidenceRowMatchesIdentity(row, identity = {}) {
  const text = `${row?.title || ""} ${row?.snippet || ""} ${row?.pageText || ""}`.toLowerCase();
  const tokens = sealedRipEvidenceIdentityTokens(identity);
  if (tokens.length) {
    const matches = tokens.filter(token => text.includes(token)).length;
    if (matches < Math.min(2, tokens.length)) return false;
  }
  const season = String(identity?.year || "").trim().replace(/[–—/]/g, "-");
  const year = season.match(/\b20\d{2}\b/)?.[0] || "";
  if (year && /\b20\d{2}\b/.test(text) && !text.includes(year)) return false;
  return true;
}

function sealedRipExactFormatKey(identity = {}) {
  const type = `${identity?.variant || ""} ${identity?.boxType || identity?.productType || ""}`.trim().toLowerCase();
  if (/collector\s+booster/.test(type)) return "collector_booster";
  if (/play\s+booster/.test(type)) return "play_booster";
  if (/jumpstart\s+booster/.test(type)) return "jumpstart_booster";
  if (/blaster/.test(type)) return "blaster";
  if (/mega/.test(type)) return "mega";
  if (/hobby/.test(type)) return "hobby";
  if (/retail\s+box/.test(type)) return "retail_box";
  if (/hanger\s+box/.test(type)) return "hanger_box";
  if (/hanger\s+pack/.test(type)) return "hanger_pack";
  if (/(?:value|fat)\s+pack/.test(type)) return "value_pack";
  if (/elite\s+trainer|\betb\b/.test(type)) return "etb";
  if (/booster\s+bundle/.test(type)) return "booster_bundle";
  if (/booster\s+box/.test(type)) return "booster_box";
  if (/booster\s+pack/.test(type)) return "booster_pack";
  if (/collection\s+box/.test(type)) return "collection_box";
  if (/\btin\b/.test(type)) return "tin";
  if (/multi[- ]?pack/.test(type)) return "multi_pack";
  if (/single\s+pack/.test(type)) return "single_pack";
  return "";
}

function sealedRipFormatMentionRules() {
  // Specialized Magic booster phrases intentionally come before generic booster
  // box/pack rules. Overlapping generic matches are discarded so "Play Booster
  // Box" remains Play Booster evidence rather than simultaneously becoming a
  // generic Booster Box claim.
  return [
    ["collector_booster", /\bcollector\s+boosters?(?:\s+(?:box|pack|display))?\b/i],
    ["play_booster", /\bplay\s+boosters?(?:\s+(?:box|pack|display))?\b/i],
    ["jumpstart_booster", /\bjumpstart\s+boosters?(?:\s+(?:box|pack|display))?\b/i],
    ["value_box", /\bvalue\s+box\b/i],
    ["blaster", /\bblaster(?:\s+box)?\b/i],
    ["mega", /\bmega(?:\s+box)?\b/i],
    ["hobby", /\bhobby(?:\s+box)?\b/i],
    ["retail_box", /\bretail\s+box\b/i],
    ["hanger_box", /\bhanger\s+box\b/i],
    ["hanger_pack", /\bhanger\s+pack\b/i],
    ["value_pack", /\b(?:value|fat)\s+pack\b/i],
    ["etb", /\belite\s+trainer\s+box\b|\betb\b/i],
    ["booster_bundle", /\bbooster\s+bundle\b/i],
    ["booster_box", /\bbooster\s+box\b/i],
    ["booster_pack", /\bbooster\s+pack\b/i],
    ["collection_box", /\bcollection\s+box\b/i],
    ["tin", /\btin\b/i],
    ["multi_pack", /\bmulti[- ]?pack\b/i],
    ["single_pack", /\bsingle\s+pack\b/i],
  ];
}

function sealedRipFormatMentions(value) {
  const text = String(value || "").replace(/[–—]/g, "-");
  const hits = [];
  sealedRipFormatMentionRules().forEach(([key, pattern], priority) => {
    const flags = pattern.flags.includes("i") ? "ig" : "g";
    const rx = new RegExp(pattern.source, flags);
    let match;
    while ((match = rx.exec(text))) {
      hits.push({ key, index: match.index, end: match.index + match[0].length, priority });
      if (rx.lastIndex === match.index) rx.lastIndex += 1;
      if (hits.length >= 120) break;
    }
  });
  hits.sort((a, b) => a.index - b.index || a.priority - b.priority || (b.end - b.index) - (a.end - a.index));
  const kept = [];
  for (const hit of hits) {
    if (kept.some(prev => hit.index < prev.end && hit.end > prev.index)) continue;
    kept.push(hit);
  }
  return kept.sort((a, b) => a.index - b.index);
}

function sealedRipExplicitFormatKeys(value) {
  return new Set(sealedRipFormatMentions(value).map(hit => hit.key));
}

function sealedRipCompatibleFormatKeys(identity = {}) {
  const exact = sealedRipExactFormatKey(identity);
  const keys = new Set(exact ? [exact] : []);
  const category = String(identity?.category || "");
  // UPC catalogs often call ordinary sports retail blasters "Value Box".
  // Treat that wording as the same retail configuration, but never Hanger/Hobby/Mega.
  if (exact === "blaster" && ["Baseball", "Basketball", "Football"].includes(category)) keys.add("value_box");
  return keys;
}

function sealedRipFormatTextCompatible(value, identity = {}) {
  const explicit = sealedRipExplicitFormatKeys(value);
  if (!explicit.size) return true;
  const compatible = sealedRipCompatibleFormatKeys(identity);
  if (!compatible.size) return true;
  return Array.from(explicit).some(key => compatible.has(key));
}

function sealedRipVariantTextCompatible(value, identity = {}) {
  const text = String(value || "").toLowerCase();
  const identityText = `${identity?.variant || ""} ${identity?.boxType || identity?.productType || ""}`.toLowerCase();
  for (const marker of ["fanatics", "walmart", "target"]) {
    if (new RegExp(`\\b${marker}\\b`, "i").test(text) && !identityText.includes(marker)) return false;
  }
  return true;
}

function sealedRipFormatAccessSignalPattern(category = "") {
  const key = sealedRipCategoryKey(category);
  if (key === "magic") return /\b(?:mythic(?: rare)?|borderless|showcase|serialized|special guests?|bonus sheet|foil|headliner|extended art|source material|cosmic foil)\b/i;
  if (key === "pokemon") return /\b(?:special illustration rare|illustration rare|hyper rare|secret rare|ultra rare|promo|special treatment|full art)\b/i;
  return /\b(?:rookies?|autographs?|signatures?|parallel|exclusive|numbered|case hit|ssp|short print|insert|green hoops|light burst|rainbow|pandora)\b|\b1\s*:\s*\d{1,7}\b/i;
}

function sealedRipRegexHitRanges(pattern, value) {
  const text = String(value || "");
  const flags = pattern.flags.includes("i") ? "ig" : "g";
  const rx = new RegExp(pattern.source, flags);
  const hits = [];
  let match;
  while ((match = rx.exec(text))) {
    hits.push({ index: match.index, end: match.index + match[0].length });
    if (rx.lastIndex === match.index) rx.lastIndex += 1;
    if (hits.length >= 120) break;
  }
  return hits;
}

function sealedRipSpanDistance(a, b) {
  if (a.end < b.index) return b.index - a.end;
  if (b.end < a.index) return a.index - b.end;
  return 0;
}

function sealedRipFormatAccessSections(row = {}) {
  const sections = [];
  const seen = new Set();
  const add = value => {
    const text = String(value || "").replace(/[ \t]+/g, " ").trim().slice(0, 5000);
    if (!text) return;
    const key = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").slice(0, 500);
    if (!key || seen.has(key)) return;
    seen.add(key);
    sections.push(text);
  };
  add(`${row?.title || ""}\n${row?.snippet || ""}`);
  const pageText = String(row?.pageText || "");
  for (const piece of pageText.split(/\n\s*---\s*\n+/)) add(piece);
  return sections.slice(0, 40);
}

function sealedRipFormatAccessSectionSupported(value, identity = {}) {
  const text = String(value || "").trim();
  if (!text || !sealedRipVariantTextCompatible(text, identity)) return false;
  const compatible = sealedRipCompatibleFormatKeys(identity);
  if (!compatible.size) return false;
  const mentions = sealedRipFormatMentions(text);
  if (!mentions.some(hit => compatible.has(hit.key))) return false;
  const signals = sealedRipRegexHitRanges(sealedRipFormatAccessSignalPattern(identity?.category), text);
  if (!signals.length) return false;

  // A chase/treatment signal belongs to this exact format only when the nearest
  // explicit sealed-format label in the same local excerpt is compatible and no
  // more than 950 characters away. This prevents a Play Booster heading near the
  // top of a Wizards page from inheriting a Headliner/Cosmic Foil claim in a later
  // Collector Booster section, and likewise blocks Hobby-only sports claims from
  // leaking into Blaster/Mega access.
  for (const signal of signals) {
    const distances = mentions.map(hit => ({ hit, distance: sealedRipSpanDistance(hit, signal) }));
    const nearestDistance = Math.min(...distances.map(row => row.distance));
    if (!Number.isFinite(nearestDistance) || nearestDistance > 950) continue;
    const nearest = distances.filter(row => row.distance === nearestDistance);
    if (nearest.some(row => compatible.has(row.hit.key))) return true;
  }
  return false;
}

function sealedRipFormatAccessLocalEvidence(evidenceRows, identity = {}) {
  const out = [];
  const seen = new Set();
  for (const row of sealedRipAuthorityRows(evidenceRows, identity)) {
    for (const section of sealedRipFormatAccessSections(row)) {
      if (!sealedRipFormatAccessSectionSupported(section, identity)) continue;
      const key = section.toLowerCase().replace(/[^a-z0-9]+/g, " ").slice(0, 600);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(section);
      if (out.length >= 16) return out;
    }
  }
  return out;
}

function sealedRipFormatAccessContextSupported(evidenceRows, identity = {}) {
  return sealedRipFormatAccessLocalEvidence(evidenceRows, identity).length > 0;
}

function sealedRipFormatAccessFallbackScore(evidenceRows, identity = {}) {
  const texts = sealedRipFormatAccessLocalEvidence(evidenceRows, identity).join(" ");
  if (!texts) return 0;
  const key = sealedRipCategoryKey(identity?.category);
  const families = key === "magic" ? [
    /\b(?:mythic(?: rare)?|rare)\b/i,
    /\b(?:borderless|showcase|extended art|source material)\b/i,
    /\bfoils?\b/i,
    /\b(?:special guests?|bonus sheet)\b/i,
    /\b(?:serialized|headliner|cosmic foil)\b/i,
  ] : key === "pokemon" ? [
    /\b(?:special illustration rare|sir|illustration rare|ir)\b/i,
    /\b(?:hyper rare|secret rare|ultra rare)\b/i,
    /\b(?:special treatment|promo|full art)\b/i,
    /\b(?:pull rate|hit rate)\b/i,
  ] : [
    /\brookies?\b/i,
    /\b(?:autographs?|signatures?)\b/i,
    /\b(?:parallel|exclusive|numbered|green hoops|light burst|rainbow|pandora)\b/i,
    /\b(?:case hit|ssp|short print)\b/i,
    /\b1\s*:\s*\d{1,7}\b/i,
  ];
  const count = families.filter(pattern => pattern.test(texts)).length;
  return Math.min(80, 42 + Math.max(1, count) * 8);
}

function sealedRipOddsRowSupported(row, evidenceRows, identity = {}) {
  const simplify = value => String(value || "").toLowerCase().replace(/\s+/g, "").replace(/[–—]/g, "-");
  const item = simplify(row?.item);
  const odds = simplify(row?.odds);
  if (!item || !odds) return false;
  const rowFormatText = `${row?.note || ""} ${row?.item || ""}`;
  if (!sealedRipFormatTextCompatible(rowFormatText, identity)) return false;
  if (!sealedRipVariantTextCompatible(rowFormatText, identity)) return false;
  const wantsAuthority = /official|checklist|manufacturer/i.test(String(row?.sourceType || ""));
  return sealedRipPullEvidenceRows(evidenceRows, identity).some(source => {
    if (wantsAuthority && (source?.sourceType === "community" || source?.queryKind !== "checklist-and-odds")) return false;
    const sourceText = simplify(`${source?.title || ""} ${source?.snippet || ""} ${source?.pageText || ""}`);
    const itemAt = sourceText.indexOf(item);
    if (itemAt < 0) return false;
    let oddsAt = sourceText.indexOf(odds, Math.max(0, itemAt - 700));
    if (oddsAt < 0) oddsAt = sourceText.indexOf(odds);
    if (oddsAt < 0) return false;
    return Math.abs(oddsAt - itemAt) <= 900;
  });
}

function sealedRipCommunityRowCompatible(row, identity = {}) {
  if (row?.sourceType !== "community") return false;
  if (!sealedRipEvidenceRowMatchesIdentity(row, identity)) return false;
  // A community thread whose title explicitly names another sealed format is not
  // evidence about this exact product's opening experience. Generic set-level
  // threads remain useful for card-design/quality sentiment.
  const hardScopeText = `${row?.title || ""} ${row?.link || ""}`;
  if (!sealedRipFormatTextCompatible(hardScopeText, identity)) return false;
  if (!sealedRipVariantTextCompatible(hardScopeText, identity)) return false;
  return true;
}

function sealedRipCommunitySentenceCompatible(value, identity = {}) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (!sealedRipFormatTextCompatible(text, identity)) return false;
  if (!sealedRipVariantTextCompatible(text, identity)) return false;
  return true;
}

function sealedRipCommunityEvidenceText(evidenceRows = [], identity = {}) {
  return (Array.isArray(evidenceRows) ? evidenceRows : [])
    .filter(row => sealedRipCommunityRowCompatible(row, identity))
    .map(row => {
      const title = String(row?.title || "").trim();
      const body = `${row?.snippet || ""} ${row?.pageText || ""}`.trim();
      const bodyPieces = body
        .split(/(?<=[.!?])\s+|\n+/)
        .map(piece => piece.trim())
        .filter(piece => sealedRipCommunitySentenceCompatible(piece, identity));
      return [title, ...bodyPieces].filter(Boolean).join(" ").trim();
    })
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 12000);
}

function sealedRipFilterCollectorText(value, identity = {}) {
  return String(value || "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence && sealedRipCommunitySentenceCompatible(sentence, identity))
    .join(" ")
    .trim();
}

function sealedRipFilterCollectorItems(values, identity = {}) {
  return (Array.isArray(values) ? values : [])
    .map(value => String(value || "").trim())
    .filter(value => value && sealedRipCommunitySentenceCompatible(value, identity))
    .slice(0, 4);
}

function sealedRipCollectorFormatConflict(raw, identity = {}) {
  const pieces = [
    String(raw?.collectorTake || ""),
    ...(Array.isArray(raw?.positives) ? raw.positives : []),
    ...(Array.isArray(raw?.negatives) ? raw.negatives : []),
  ].map(value => String(value || "").trim()).filter(Boolean);
  return pieces.some(piece => {
    const explicit = sealedRipExplicitFormatKeys(piece);
    if (!explicit.size && !/\b(?:fanatics|walmart|target)\b/i.test(piece)) return false;
    return !sealedRipCommunitySentenceCompatible(piece, identity);
  });
}

function sealedRipTemperCollectorSummary(value, communitySourceCount = 0) {
  let text = sealedRipTemperCollectorLanguage(value, communitySourceCount);
  const sentences = text.split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean);
  const promotional = /\b(?:great option|excellent option|fantastic option|ideal option|fun and affordable|add some excitement|exciting addition|accessible to a wider range)\b/i;
  const kept = sentences.filter(sentence => !promotional.test(sentence));
  text = kept.join(" ").trim();
  return text || "Scout found exact-product community discussion, but not enough recurring opinion detail to summarize a reliable collector theme.";
}

function sealedRipChaseContextSupported(evidenceRows, category = "") {
  const rows = (Array.isArray(evidenceRows) ? evidenceRows : []).filter(row => row?.queryKind === "checklist-and-odds" && row?.sourceType !== "community");
  if (!rows.length) return false;
  const text = rows.map(row => `${row?.title || ""} ${row?.snippet || ""} ${row?.pageText || ""}`).join(" ").toLowerCase();
  const key = sealedRipCategoryKey(category);
  const sportsSignals = [
    /\brookies?\b/,
    /\b(?:autograph|auto|signatures?)\b/,
    /\b(?:parallel|exclusive|numbered)\b/,
    /\b(?:case hit|ssp|short print)\b/,
    /\b(?:insert|inserts)\b/,
  ];
  const pokemonSignals = [
    /\b(?:special illustration rare|sir)\b/,
    /\b(?:illustration rare|ir)\b/,
    /\bhyper rare\b/,
    /\b(?:secret rare|ultra rare|full art|special treatment)\b/,
    /\b(?:pull rate|hit rate)\b/,
  ];
  const magicSignals = [
    /\b(?:mythic|mythic rare|rare)\b/,
    /\b(?:borderless|showcase|serialized)\b/,
    /\b(?:special guests?|bonus sheet)\b/,
    /\b(?:foil|playable|staple)\b/,
    /\b(?:collector booster|play booster|commander)\b/,
  ];
  const signals = key === "pokemon" ? pokemonSignals : key === "magic" ? magicSignals : sportsSignals;
  return signals.some(pattern => pattern.test(text));
}

function sealedRipVerifiedChaseScore(rawScore, evidenceRows = [], category = "") {
  const aiScore = sealedRipClampScore(rawScore);
  const key = sealedRipCategoryKey(category);
  if (key !== "magic") return aiScore;
  const authorityText = sealedRipAuthorityRows(evidenceRows)
    .map(row => `${row?.title || ""} ${row?.snippet || ""} ${row?.pageText || ""}`)
    .join(" ")
    .toLowerCase();
  if (!authorityText) return aiScore;
  const families = [
    /\bmythic(?: rare)?s?\b/,
    /\b(?:borderless|showcase|extended art|source material)\b/,
    /\b(?:serialized|headliner|cosmic foil)\b/,
    /\b(?:special guests?|bonus sheet)\b/,
    /\bfoils?\b/,
    /\b(?:collector boosters?|play boosters?|commander)\b/,
  ];
  const count = families.filter(pattern => pattern.test(authorityText)).length;
  // This is only a contradiction guard, not a declaration that the set is valuable.
  // Verified Magic rarity/treatment/product structure should not display as 0/100 just
  // because the synthesis model emitted zero. Community/player evidence can raise it.
  const floor = count >= 4 ? 25 : count >= 2 ? 18 : count >= 1 ? 10 : 0;
  return Math.max(aiScore, floor);
}

function sealedRipAuthorityRows(evidenceRows = [], identity = {}) {
  return (Array.isArray(evidenceRows) ? evidenceRows : []).filter(row =>
    row?.queryKind === "checklist-and-odds" &&
    row?.sourceType !== "community" &&
    sealedRipEvidenceRowMatchesIdentity(row, identity)
  );
}

function sealedRipPullEvidenceRows(evidenceRows = [], identity = {}) {
  return (Array.isArray(evidenceRows) ? evidenceRows : []).filter(row =>
    (row?.queryKind === "checklist-and-odds" || row?.queryKind === "collector-reports") &&
    sealedRipEvidenceRowMatchesIdentity(row, identity)
  );
}

function sealedRipLaneState(rows = [], usable = false, requested = true) {
  if (!requested) return { status: "not_requested", sourceCount: 0 };
  const sourceCount = Array.isArray(rows) ? rows.length : 0;
  if (!sourceCount) return { status: "failed", sourceCount: 0 };
  return { status: usable ? "complete" : "partial", sourceCount };
}

function sealedRipPriceGuideRows(evidenceRows = [], identity = {}) {
  return (Array.isArray(evidenceRows) ? evidenceRows : []).filter(row =>
    row?.queryKind === "singles-price-guide" &&
    row?.sourceType !== "community" &&
    sealedRipEvidenceRowMatchesIdentity(row, identity)
  );
}

function sealedRipFailureLanes(evidenceRows = [], identity = {}, market = {}, researchMode = "single") {
  const authorityRows = sealedRipAuthorityRows(evidenceRows, identity);
  const priceGuideRows = sealedRipPriceGuideRows(evidenceRows, identity);
  const marketOk = Number.isFinite(Number(market?.median)) && Number(market?.median) > 0;
  return {
    authority: { status: authorityRows.length ? "partial" : "failed", sourceCount: authorityRows.length },
    priceGuide: researchMode === "showdown"
      ? { status: priceGuideRows.length ? "partial" : "failed", sourceCount: priceGuideRows.length }
      : { status: "not_requested", sourceCount: 0 },
    market: { status: marketOk ? "complete" : "failed", sourceCount: marketOk ? 1 : 0 },
    community: { status: researchMode === "showdown" ? "not_requested" : "partial", sourceCount: 0 },
  };
}

function sealedRipShowdownAnalysisComplete(analysis = {}) {
  const lanes = analysis?.lanes || {};
  return Boolean(
    analysis?.chaseEvidenceAvailable &&
    analysis?.chaseDepthEvidenceAvailable &&
    analysis?.formatAccessEvidenceAvailable &&
    lanes?.authority?.status === "complete" &&
    lanes?.priceGuide?.status === "complete" &&
    lanes?.market?.status === "complete"
  );
}

function sealedRipChaseValueNameTokens(value) {
  const stop = new Set(["the", "and", "card", "cards", "foil", "market", "price", "showcase", "borderless", "parallel", "autograph", "auto", "rookie"]);
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter(token => token.length >= 2 && !stop.has(token));
}

function sealedRipPriceTextPositions(price, text) {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return [];
  const values = new Set([n.toFixed(2)]);
  if (Math.abs(n - Math.round(n)) < 0.001) values.add(String(Math.round(n)));
  const source = String(text || "");
  const hits = [];
  for (const value of values) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(`(?:\\$|usd\\s*)\\s*${escaped}\\b|(?:market\\s+price\\s*:?\\s*)\\$?\\s*${escaped}\\b`, "ig");
    let match;
    while ((match = rx.exec(source))) {
      hits.push(match.index + Math.floor(match[0].length / 2));
      if (hits.length >= 12) break;
    }
  }
  return [...new Set(hits)].sort((a, b) => a - b);
}

function sealedRipPriceTextSupported(price, text) {
  return sealedRipPriceTextPositions(price, text).length > 0;
}

function sealedRipPriceGuideHost(row) {
  try { return new URL(String(row?.link || "")).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

function sealedRipPriceGuideAtomicBlocks(row) {
  const out = [];
  const seen = new Set();
  const add = (value, origin) => {
    const block = String(value || "").replace(/[ \t]+/g, " ").replace(/\n+/g, " ").trim().slice(0, 1000);
    if (!block || !/(?:\$|usd\s*)\s*\d+(?:\.\d{1,2})?\b/i.test(block)) return;
    const key = block.toLowerCase().replace(/[^a-z0-9$]+/g, " ").slice(0, 360);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ text: block, origin });
  };
  const page = String(row?.pageText || "");
  for (const block of page.split(/\n\s*---\s*\n|\n{2,}/)) add(block, "page");
  add(`${row?.title || ""} | ${row?.snippet || ""}`, "search");
  return out.slice(0, 80);
}

function sealedRipPriceGuideBlockLooksSealed(value) {
  const text = String(value || "");
  return /\b(?:factory\s+sealed|sealed\s+(?:box|pack|case)|booster\s+(?:box|pack|bundle|display)|blaster\s+box|mega\s+box|hobby\s+box|hanger\s+(?:box|pack)|value\s+box|retail\s+box|elite\s+trainer\s+box|\betb\b|display\s+box|case\s+of|box\s+of\s+\d+\s+packs?)\b/i.test(text);
}

function sealedRipPriceGuideGradedContext(value) {
  return /\b(?:psa|bgs|sgc|cgc|graded|grading|gem\s+mint|grade\s*(?:7|8|9|10)|mint\s*(?:9|10))\b/i.test(String(value || ""));
}

function sealedRipPriceGuidePriceBasis(context, row) {
  const text = String(context || "");
  const host = sealedRipPriceGuideHost(row);
  if (host.endsWith("sportscardspro.com")) return /\bungraded\b/i.test(text) ? "ungraded" : "";
  if (host.endsWith("tcgplayer.com")) return /\bmarket\s+price\b/i.test(text) ? "market_price" : "";
  if (/\bmarket\s+price\b/i.test(text)) return "market_price";
  if (/\bungraded\b/i.test(text)) return "ungraded";
  return "";
}

function sealedRipChaseNameSupportedInBlock(tokens, block) {
  const lower = String(block || "").toLowerCase();
  const matched = tokens.filter(token => lower.includes(token)).length;
  const required = tokens.length <= 2 ? tokens.length : Math.min(4, Math.max(2, Math.ceil(tokens.length * 0.55)));
  return matched >= required;
}

function sealedRipChaseValueProof(candidate, evidenceRows = [], identity = {}) {
  const name = String(candidate?.name || "").trim();
  const price = Number(candidate?.marketPrice);
  const tokens = sealedRipChaseValueNameTokens(name);
  if (!name || !Number.isFinite(price) || price < 3 || price > 25000 || !tokens.length) return null;
  for (const row of sealedRipPriceGuideRows(evidenceRows, identity)) {
    for (const record of sealedRipPriceGuideAtomicBlocks(row)) {
      const block = record.text;
      if (sealedRipPriceGuideBlockLooksSealed(block)) continue;
      if (!sealedRipChaseNameSupportedInBlock(tokens, block)) continue;
      const pricePositions = sealedRipPriceTextPositions(price, block);
      for (const at of pricePositions) {
        const basisContext = block.slice(Math.max(0, at - 280), Math.min(block.length, at + 280));
        const tightContext = block.slice(Math.max(0, at - 130), Math.min(block.length, at + 130));
        if (sealedRipPriceGuideGradedContext(tightContext)) continue;
        const priceBasis = sealedRipPriceGuidePriceBasis(basisContext, row);
        if (!priceBasis) continue;
        return {
          priceBasis,
          sourceHost: sealedRipPriceGuideHost(row),
          sourceLink: String(row?.link || "").slice(0, 500),
          evidenceOrigin: record.origin,
        };
      }
    }
  }
  return null;
}

function sealedRipChaseValueSupported(candidate, evidenceRows = [], identity = {}) {
  return Boolean(sealedRipChaseValueProof(candidate, evidenceRows, identity));
}

function sealedRipNormalizeChaseValues(raw, evidenceRows = [], identity = {}) {
  const seen = new Set();
  const out = [];
  for (const row of (Array.isArray(raw?.chaseValueCards) ? raw.chaseValueCards : []).slice(0, 20)) {
    const item = {
      name: String(row?.name || "").trim().slice(0, 150),
      marketPrice: Number(Number(row?.marketPrice).toFixed(2)),
      treatment: String(row?.treatment || "").trim().slice(0, 120),
      sourceType: String(row?.sourceType || "price guide").trim().slice(0, 60),
    };
    const proof = sealedRipChaseValueProof(item, evidenceRows, identity);
    if (!proof) continue;
    item.priceBasis = proof.priceBasis;
    item.verifiedSource = proof.sourceHost;
    item.cardNumber = sealedRipChaseCardNumber(item.name);
    item.canonicalKey = sealedRipChaseCanonicalKey(item);
    const key = `${item.name}|${item.treatment}`.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.sort((a,b) => b.marketPrice - a.marketPrice).slice(0, 15);
}

function sealedRipChaseTreatmentSegment(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (/\b(?:parallel|refractor|prizm|foil|holo(?:graphic)?|rainbow|wave|shimmer|mojo|cracked ice|laser|disco|pulsar|velocity|checkerboard|negative|sepia|x-fractor|borderless|showcase|extended art|cosmic foil|etched foil|surge|galaxy|neon|hyper|scope|fractal|color match|numbered|serial(?:ized)?|image variation|printing plate|superfractor)\b/i.test(text)) return true;
  return /^(?:red|blue|green|gold|silver|black|purple|orange|pink|teal|aqua|white|yellow|bronze)(?:\s+(?:red|blue|green|gold|silver|black|purple|orange|pink|teal|aqua|white|yellow|bronze))*$/i.test(text);
}

function sealedRipChaseCardNumber(value) {
  const text = String(value || "");
  let match = text.match(/#\s*([A-Z0-9][A-Z0-9-]{0,15})\b/i);
  if (!match) match = text.match(/\b(?:CN|collector\s*(?:no\.?|number)?|card\s*(?:no\.?|number))\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{0,15})\b/i);
  if (!match) match = text.match(/\b(\d{1,4}\/\d{1,4})\b/);
  return match ? String(match[1] || '').toUpperCase() : '';
}

function sealedRipChaseCanonicalIdentity(card = {}) {
  const original = String(card?.name || "").trim();
  const treatment = String(card?.treatment || "").trim();
  const cardNumber = String(card?.cardNumber || sealedRipChaseCardNumber(original)).trim().toUpperCase();
  let base = original;

  // Remove only an explicitly extracted treatment phrase, never generic player-name words.
  if (treatment) {
    const escaped = treatment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    base = base.replace(new RegExp(`(?:\\[|\\()?\\s*${escaped}\\s*(?:\\]|\\))?`, "ig"), " ");
  }

  // Bracketed/parenthetical and pipe/dash segments are safe places to remove obvious treatments.
  base = base.replace(/\[([^\]]{1,100})\]|\(([^)]{1,100})\)/g, (whole, square, paren) => {
    const inner = square || paren || "";
    return sealedRipChaseTreatmentSegment(inner) ? " " : whole;
  });
  base = base.split(/\s+(?:\||·|[-–—])\s+/).filter(segment => !sealedRipChaseTreatmentSegment(segment)).join(" ");

  // Sports serial numbering is usually presented as " /249". Preserve collector numbers such as 199/165.
  base = base.replace(/\s+\/\s*\d{1,6}\b/g, " ");

  if (cardNumber) {
    const escapedNumber = cardNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    base = base
      .replace(new RegExp(`#\\s*${escapedNumber}\\b`, "ig"), " ")
      .replace(new RegExp(`\\b(?:CN|collector\\s*(?:no\\.?|number)?|card\\s*(?:no\\.?|number))\\s*[:#-]?\\s*${escapedNumber}\\b`, "ig"), " ")
      .replace(new RegExp(`\\b${escapedNumber}\\b`, "ig"), " ");
  }

  // These are treatment nouns, not identity-bearing card concepts. Keep autograph/relic/rookie/insert wording.
  base = base.replace(/\b(?:parallel|refractor|foil|holo(?:graphic)?|borderless|showcase|extended art|numbered)\b/ig, " ");
  base = base.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  if (!base) base = original.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  const key = `${base}${cardNumber ? `|#${cardNumber.toLowerCase()}` : ""}`;
  const label = `${base}${cardNumber ? ` #${cardNumber}` : ""}`.trim();
  return { key, label, cardNumber };
}

function sealedRipChaseCanonicalKey(card = {}) {
  return sealedRipChaseCanonicalIdentity(card).key;
}

function sealedRipChaseIdentityGroups(cards = []) {
  const groups = new Map();
  for (const row of (Array.isArray(cards) ? cards : [])) {
    const price = Number(row?.marketPrice);
    if (!Number.isFinite(price) || price <= 0) continue;
    const canonical = sealedRipChaseCanonicalIdentity(row);
    const key = canonical.key || String(row?.name || "").toLowerCase();
    if (!groups.has(key)) groups.set(key, { key, label: canonical.label, variants: [], representative: null });
    const group = groups.get(key);
    group.variants.push(row);
    if (!group.representative || price > Number(group.representative.marketPrice || 0)) group.representative = row;
  }
  return [...groups.values()].filter(group => group.representative);
}

function sealedRipChaseDepthMetrics(cards = []) {
  const verifiedRows = (Array.isArray(cards) ? cards : [])
    .filter(row => Number.isFinite(Number(row?.marketPrice)) && Number(row.marketPrice) > 0)
    .slice()
    .sort((a,b) => Number(b.marketPrice)-Number(a.marketPrice));
  if (verifiedRows.length < 2) return {
    available:false, score:null, label:"N/A",
    summary:"Scout could not verify enough set-level singles prices to measure chase depth yet.",
    count20:0, count50:0, count100:0, top5Total:null, top10Total:null, concentration:null,
    uniqueCount:verifiedRows.length, variantCount:verifiedRows.length, parallelBreadth:0, diversityRatio:null,
  };

  const groups = sealedRipChaseIdentityGroups(verifiedRows);
  const uniqueRows = groups.map(group => group.representative)
    .sort((a,b) => Number(b.marketPrice)-Number(a.marketPrice));
  const variantCount = verifiedRows.length;
  const uniqueCount = uniqueRows.length;
  const parallelBreadth = Math.max(0, variantCount - uniqueCount);
  const diversityRatio = variantCount > 0 ? uniqueCount / variantCount : 0;
  const prices = uniqueRows.map(row => Number(row.marketPrice));
  const count20 = prices.filter(x => x >= 20).length;
  const count50 = prices.filter(x => x >= 50).length;
  const count100 = prices.filter(x => x >= 100).length;
  const top5Total = Number(prices.slice(0,5).reduce((a,b)=>a+b,0).toFixed(2));
  const top10Total = Number(prices.slice(0,10).reduce((a,b)=>a+b,0).toFixed(2));
  const concentration = top10Total > 0 && prices.length ? prices[0] / top10Total : 1;

  // Score only canonical chase identities. Extra parallels are reported as breadth, not counted as extra $20/$50/$100 chases.
  let score = 20;
  score += Math.min(24, count20 * 3);
  score += Math.min(18, count50 * 5);
  score += Math.min(14, count100 * 7);
  score += top10Total >= 1500 ? 20 : top10Total >= 750 ? 16 : top10Total >= 400 ? 12 : top10Total >= 200 ? 8 : top10Total >= 100 ? 4 : 0;
  if (concentration >= .75) score -= 18;
  else if (concentration >= .60) score -= 12;
  else if (concentration >= .45) score -= 6;
  if (uniqueCount < 2) score = Math.min(score, 35);
  else if (uniqueCount < 4) score = Math.min(score, 58);
  score = Math.max(0, Math.min(100, Math.round(score)));

  const label = uniqueCount <= 1 && variantCount >= 2 ? "CONCENTRATED"
    : concentration >= .68 && count20 <= 4 ? "LOTTERY-TICKET"
    : score >= 78 ? "DEEP" : score >= 62 ? "SOLID" : score >= 45 ? "MODERATE" : "THIN";
  const top = uniqueRows[0];
  const summary = `${label} set-level chase pool · ${uniqueCount} unique chase identit${uniqueCount===1?"y":"ies"} across ${variantCount} verified priced variant${variantCount===1?"":"s"} · ${parallelBreadth} extra parallel/treatment variant${parallelBreadth===1?"":"s"} · ${count100} unique at $100+ · ${count50} at $50+ · ${count20} at $20+ · top 10 unique values total $${top10Total.toFixed(2)}${top?.name?` · top canonical chase: ${top.name} ($${Number(top.marketPrice).toFixed(2)})`:""}. Exact-format access is scored separately.`;
  return {
    available:true, score, label, summary, count20, count50, count100, top5Total, top10Total,
    concentration:Number(concentration.toFixed(3)), uniqueCount, variantCount, parallelBreadth,
    diversityRatio:Number(diversityRatio.toFixed(3)),
  };
}

function sealedRipPriceGuideEvidenceText(evidenceRows = [], identity = {}) {
  return sealedRipPriceGuideRows(evidenceRows, identity)
    .map(row => `${row?.title || ""} ${row?.snippet || ""} ${row?.pageText || ""}`.trim())
    .filter(Boolean).join("\n---\n").slice(0, 12000);
}

function sealedRipNormalize(raw, evidenceRows, market, identity = {}, researchMode = "single") {
  const authorityRows = sealedRipAuthorityRows(evidenceRows, identity);
  const priceGuideRows = sealedRipPriceGuideRows(evidenceRows, identity);
  const pullEvidenceRows = sealedRipPullEvidenceRows(evidenceRows, identity);
  const authorityText = authorityRows.map(row => `${row.title} ${row.snippet} ${row.pageText || ""}`).join("\n");
  const chaseCards = (Array.isArray(raw?.chaseCards) ? raw.chaseCards : []).slice(0, 5).map(row => ({
    name: String(row?.name || "").trim().slice(0, 140),
    why: String(row?.why || "").trim().slice(0, 240),
  })).filter(row => row.name && sealedRipChaseSupported(row.name, authorityText));
  const pullOdds = (Array.isArray(raw?.pullOdds) ? raw.pullOdds : []).slice(0, 8).map(row => ({
    item: String(row?.item || "").trim().slice(0, 160),
    odds: String(row?.odds || "").trim().slice(0, 80),
    sourceType: String(row?.sourceType || "reported").trim().slice(0, 50),
    note: String(row?.note || "").trim().slice(0, 260),
  })).filter(row => row.item && row.odds && sealedRipOddsRowSupported(row, pullEvidenceRows, identity));
  const chaseValueCards = sealedRipNormalizeChaseValues(raw, priceGuideRows, identity);
  const chaseDepth = sealedRipChaseDepthMetrics(chaseValueCards);

  const chaseContextAvailable = sealedRipChaseContextSupported(authorityRows, identity?.category);
  const chaseEvidenceAvailable = chaseCards.length > 0 || chaseContextAvailable;
  const pullEvidenceAvailable = pullOdds.length > 0;
  const formatAccessContextAvailable = sealedRipFormatAccessContextSupported(authorityRows, identity);
  const formatAccessEvidenceAvailable = formatAccessContextAvailable;
  const formatAccessScore = formatAccessEvidenceAvailable
    ? sealedRipFormatAccessFallbackScore(authorityRows, identity)
    : null;
  const rawFormatSummary = String(raw?.formatAccessSummary || "").trim().slice(0, 500);
  const formatAccessSummary = formatAccessEvidenceAvailable && sealedRipFormatAccessSectionSupported(rawFormatSummary, identity)
    ? rawFormatSummary
    : (formatAccessContextAvailable ? "Scout verified exact-format authority evidence, but could not safely summarize how deeply this configuration reaches the set's desirable cards." : "Scout could not verify exact-format access from the authority lane.");
  const communitySourceCount = evidenceRows.filter(row => sealedRipCommunityRowCompatible(row, identity)).length;
  const communityEvidenceText = sealedRipCommunityEvidenceText(evidenceRows, identity);
  const collectorFormatConflict = sealedRipCollectorFormatConflict(raw, identity);
  const collectorTakeFiltered = sealedRipFilterCollectorText(raw?.collectorTake, identity);
  const collectorTakeClean = collectorTakeFiltered ? sealedRipTemperCollectorSummary(collectorTakeFiltered, communitySourceCount).slice(0, 700) : "";
  const positivesClean = sealedRipFilterCollectorItems(raw?.positives, identity).map(x => x.slice(0, 220));
  const negativesClean = sealedRipFilterCollectorItems(raw?.negatives, identity).map(x => x.slice(0, 220));
  const collectorContentAvailable = Boolean(collectorTakeClean || positivesClean.length || negativesClean.length);
  const sentimentEvidenceAvailable = Boolean(raw?.sentimentEvidenceAvailable)
    && communitySourceCount >= 2
    && communityEvidenceText.length >= 80
    && collectorContentAvailable
    && !collectorFormatConflict;
  const priceScore = sealedRipPriceScore(market?.shelfPrice, market?.median);
  const verifiedChaseScore = chaseEvidenceAvailable ? sealedRipVerifiedChaseScore(raw?.chaseScore, authorityRows, identity?.category) : null;
  const parts = {
    priceScore,
    chaseScore: chaseEvidenceAvailable ? (Number(verifiedChaseScore) || 0) : null,
    chaseEvidenceAvailable,
    pullScore: pullEvidenceAvailable ? sealedRipVerifiedPullScore(raw?.pullScore, pullOdds) : null,
    pullEvidenceAvailable,
    sentimentScore: sentimentEvidenceAvailable ? sealedRipClampScore(raw?.sentimentScore) : null,
    sentimentEvidenceAvailable,
  };
  const lanes = {
    authority: sealedRipLaneState(authorityRows, chaseEvidenceAvailable, true),
    priceGuide: sealedRipLaneState(priceGuideRows, chaseDepth.available, researchMode === "showdown"),
    market: { status: Number.isFinite(Number(market?.median)) && Number(market?.median) > 0 ? "complete" : "failed", sourceCount: Number.isFinite(Number(market?.median)) && Number(market?.median) > 0 ? 1 : 0 },
    community: sealedRipLaneState(evidenceRows.filter(row => row?.queryKind === "collector-reports"), sentimentEvidenceAvailable, researchMode !== "showdown"),
  };
  const overallScore = sealedRipWeightedScore(parts, identity?.category);
  const ripScore = sealedRipQualityScore(parts, identity?.category);
  const evidenceCount = sealedRipProductEvidenceCount(parts);
  const recommendationConfidence = sealedRipConfidence(parts);
  const confidenceRaw = String(raw?.confidence || "low").toLowerCase();
  const qualitySummary = chaseEvidenceAvailable
    ? String(raw?.qualitySummary || "Scout found enough trustworthy checklist/chase structure to judge the product, even though every individual chase may not be named.").trim().slice(0, 700)
    : "Scout found price data, but not enough trustworthy chase/checklist information to make a buy recommendation yet.";
  return {
    overallScore,
    finalVerdict: sealedRipFinalVerdict(overallScore, parts),
    ripScore,
    ripGrade: sealedRipGrade(ripScore),
    priceScore,
    chaseScore: parts.chaseScore,
    chaseEvidenceAvailable,
    chaseContextAvailable,
    namedChasesVerified: chaseCards.length,
    chaseDepthScore: chaseDepth.score,
    chaseDepthEvidenceAvailable: chaseDepth.available,
    chaseDepthLabel: chaseDepth.label,
    chaseDepthSummary: chaseDepth.summary,
    chaseDepthCount20: chaseDepth.count20,
    chaseDepthCount50: chaseDepth.count50,
    chaseDepthCount100: chaseDepth.count100,
    chaseDepthTop5Total: chaseDepth.top5Total,
    chaseDepthTop10Total: chaseDepth.top10Total,
    chaseDepthConcentration: chaseDepth.concentration,
    chaseDepthUniqueCount: chaseDepth.uniqueCount,
    chaseDepthVariantCount: chaseDepth.variantCount,
    chaseDepthParallelBreadth: chaseDepth.parallelBreadth,
    chaseDepthDiversityRatio: chaseDepth.diversityRatio,
    chaseValueCards,
    formatAccessScore,
    formatAccessEvidenceAvailable,
    formatAccessContextAvailable,
    formatAccessSummary,
    pullScore: parts.pullScore,
    pullEvidenceAvailable,
    sentimentScore: parts.sentimentScore,
    sentimentEvidenceAvailable,
    sentimentLabel: sentimentEvidenceAvailable ? String(raw?.sentimentLabel || "mixed").slice(0, 40) : "unknown",
    evidenceCount,
    recommendationConfidence,
    researchProfile: sealedRipCategoryKey(identity?.category),
    researchMode,
    lanes,
    scoreLabels: sealedRipScoreLabels(identity?.category),
    qualitySummary,
    chaseCards,
    pullOdds,
    collectorTake: sentimentEvidenceAvailable ? collectorTakeClean : (collectorFormatConflict ? "Scout discarded collector sentiment because the synthesized comments mixed a different sealed format into this product." : "Scout did not find enough recurring exact-product collector discussion to score sentiment."),
    positives: sentimentEvidenceAvailable ? positivesClean : [],
    negatives: sentimentEvidenceAvailable ? negativesClean : [],
    confidence: evidenceCount < 2 ? "low" : (["high", "medium", "low"].includes(confidenceRaw) ? confidenceRaw : recommendationConfidence),
  };
}

function sealedBarcodeDigits(value) {
  const text = String(value || "");
  const candidates = text.match(/\b\d{8,14}\b/g) || [];
  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, "");
    if ([8, 12, 13, 14].includes(digits.length)) return digits;
  }
  const all = text.replace(/\D/g, "");
  return [8, 12, 13, 14].includes(all.length) ? all : "";
}

function sealedBarcodeIdentity(item, barcode) {
  const title = String(item?.title || "").trim();
  const brand = String(item?.brand || "").trim();
  const text = `${title} ${brand}`;
  let category = "";
  if (/Pok[eé]mon|Trading Card Game|\bTCG\b/i.test(text)) category = "Pokémon";
  else if (/Magic:\s*The Gathering|\bMTG\b|Wizards of the Coast/i.test(text)) category = "Magic: The Gathering";
  else if (/\bNBA\b|basketball/i.test(text)) category = "Basketball";
  else if (/\bNFL\b|football/i.test(text)) category = "Football";
  else if (/\bMLB\b|baseball|Topps|Bowman/i.test(text)) category = "Baseball";

  let year = "";
  const ym = text.match(/\b(20\d{2})(?:\s*[-–/]\s*(\d{2,4}))?\b/);
  if (ym) year = ym[2] ? `${ym[1]}-${ym[2].length === 2 ? ym[2] : ym[2].slice(-2)}` : ym[1];

  let productType = "";
  const productRules = [
    [/\bcollector\s+booster(?:\s+(?:box|pack|display))?\b/i, "Collector Booster"],
    [/\bplay\s+booster(?:\s+(?:box|pack|display))?\b/i, "Play Booster"],
    [/\bjumpstart\s+booster(?:\s+(?:box|pack|display))?\b/i, "Jumpstart Booster"],
    [/\bmega\s+box\b/i, "Mega Box"],
    [/\bblaster\s+box\b|\bblaster\b/i, "Blaster Box"],
    [/\bhobby\s+box\b/i, "Hobby Box"],
    [/\bretail\s+box\b/i, "Retail Box"],
    [/\bhanger\s+box\b/i, "Hanger Box"],
    [/\bhanger\s+pack\b|\bhanger\b/i, "Hanger Pack"],
    [/\bfat\s+pack\b|\bvalue\s+pack\b/i, "Value / Fat Pack"],
    [/\belite\s+trainer\s+box\b|\bETB\b/i, "Elite Trainer Box"],
    [/\bbooster\s+bundle\b/i, "Booster Bundle"],
    [/\bbooster\s+box\b/i, "Booster Box"],
    [/\bbooster\s+pack\b/i, "Booster Pack"],
    [/\bcollection\s+box\b/i, "Collection Box"],
    [/\btin\b/i, "Tin"],
    [/\bmulti[- ]?pack\b/i, "Multi-Pack"],
    [/\bsingle\s+pack\b/i, "Single Pack"],
  ];
  for (const [re, type] of productRules) {
    if (re.test(text)) { productType = type; break; }
  }
  // Topps and other sports manufacturers sometimes call the ordinary retail blaster
  // a "Value Box" in UPC catalogs. Preserve the scanner's supported taxonomy while
  // still filling Product Type automatically for those sports products.
  if (!productType && ["Baseball", "Basketball", "Football"].includes(category) && /\bvalue\s+box\b/i.test(text)) {
    productType = "Blaster Box";
  }

  return {
    category,
    year,
    set: title || brand,
    productType,
    variant: "",
    confidence: title ? "high" : "medium",
    clues: [barcode ? `UPC/EAN ${barcode}` : "", brand ? `Brand: ${brand}` : ""].filter(Boolean),
    needsAnotherPhoto: !title,
    followUp: title ? "" : "Barcode read successfully, but the product database did not return a title. Enter the product details manually.",
  };
}

async function sealedBarcodeLookup(barcode, env) {
  const cacheKey = `sealed:barcode:v1:${barcode}`;
  if (env.SCOUT_DATA) {
    try {
      const cached = await env.SCOUT_DATA.get(cacheKey, { type: "json" });
      if (cached?.barcode === barcode) return cached;
    } catch {}
  }

  let item = null;
  let lookupError = "";
  try {
    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`, {
      headers: { "Accept": "application/json", "User-Agent": "HOF-Card-Scout/1.0" },
    });
    if (res.ok) {
      const data = await res.json();
      item = Array.isArray(data?.items) ? data.items[0] || null : null;
    } else if (res.status === 404) {
      lookupError = "not_found";
    } else if (res.status === 429) {
      lookupError = "rate_limited";
    } else {
      lookupError = `lookup_${res.status}`;
    }
  } catch {
    lookupError = "lookup_failed";
  }

  const result = {
    barcode,
    item: item ? {
      title: String(item.title || "").trim().slice(0, 220),
      brand: String(item.brand || "").trim().slice(0, 120),
      model: String(item.model || "").trim().slice(0, 120),
      ean: String(item.ean || "").trim(),
      upc: String(item.upc || "").trim(),
    } : null,
    lookupError,
  };
  if (env.SCOUT_DATA && item) {
    try { await env.SCOUT_DATA.put(cacheKey, JSON.stringify(result), { expirationTtl: 30 * 24 * 60 * 60 }); } catch {}
  }
  return result;
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = env.ALLOWED_ORIGIN || DEFAULT_ORIGIN;
    const corsOrigin = origin === allowedOrigin ? origin : allowedOrigin;
    const cors = {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,X-Scout-Key,X-Scout-Card-Fingerprint",
      "Access-Control-Expose-Headers": "X-Scout-Photo-Fingerprint,X-Scout-Photo-Updated-At",
      "Vary": "Origin",
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (url.pathname === "/health") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized" }, 401, cors);
      }
      return json({
        ok: true,
        version: VERSION,
        configured: Boolean(env.SERPAPI_KEY || env.APIFY_TOKEN),
        providers: {
          serpapi: Boolean(env.SERPAPI_KEY),
          apify: Boolean(env.APIFY_TOKEN),
          psa: Boolean(env.PSA_API_TOKEN),
          cardapi: Boolean(env.CARD_API_KEY),
          cloudStorage: Boolean(env.SCOUT_DATA),
          vision: Boolean(env.AI),
        }
      }, 200, cors);
    }

    if (url.pathname === "/sealed/barcode-identify" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      let body = {};
      try { body = await request.json(); }
      catch { return json({ ok: false, error: "bad_json", message: "Scout could not read that barcode request." }, 400, cors); }

      let barcode = sealedBarcodeDigits(body?.barcode || "");
      let barcodeSource = barcode ? "entered_or_device" : "";
      if (!barcode) {
        if (!env.AI) {
          return json({ ok: false, error: "vision_not_configured", message: "Scout barcode photo reading is not configured on the Worker." }, 503, cors);
        }
        const imageDataUrl = String(body?.imageDataUrl || "");
        const match = imageDataUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/i);
        if (!match) return json({ ok: false, error: "bad_image", message: "Scout needs a clear JPEG, PNG, or WebP barcode photo." }, 400, cors);
        const approxBytes = Math.floor(match[2].length * 3 / 4);
        if (approxBytes <= 0 || approxBytes > SEALED_VISION_MAX_BYTES) {
          return json({ ok: false, error: "image_too_large", message: "That barcode photo is too large. Retake it closer so the barcode fills more of the frame." }, 413, cors);
        }
        try {
          const raw = await env.AI.run(SEALED_VISION_MODEL, {
            task: "query",
            image: imageDataUrl,
            question: "Read the UPC, EAN, or GTIN barcode number in this image. Use the human-readable digits printed directly under or beside the barcode bars. Return ONLY the digits with no spaces, punctuation, JSON, or explanation. If you cannot read a complete 8, 12, 13, or 14 digit code, return an empty answer.",
            reasoning: false,
            stream: false,
            temperature: 0,
            max_tokens: 40
          });
          barcode = sealedBarcodeDigits(raw?.answer ?? raw?.response ?? raw?.result ?? raw);
          barcodeSource = barcode ? "cloudflare_ocr" : "";
        } catch (err) {
          console.error("sealed barcode OCR failed", err);
        }
      }

      if (!barcode) {
        return json({ ok: false, error: "barcode_unreadable", message: "Scout could not read the barcode number. Move closer so the bars and printed digits fill the photo, or type the UPC/EAN number manually.", searchUsed: 0, marketplaceSearchesUsed: 0 }, 422, cors);
      }

      const lookup = await sealedBarcodeLookup(barcode, env);
      const identity = sealedBarcodeIdentity(lookup.item, barcode);
      return json({
        ok: true,
        version: VERSION,
        barcode,
        barcodeSource,
        lookupTitle: lookup.item?.title || "",
        lookupBrand: lookup.item?.brand || "",
        lookupError: lookup.lookupError || "",
        identity,
        searchUsed: 0,
        marketplaceSearchesUsed: 0
      }, 200, cors);
    }

    if (url.pathname === "/sealed/value-check" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SERPAPI_KEY) {
        return json({ ok: false, error: "market_not_configured", message: "Scout market pricing is not configured on the Worker.", searchUsed: 0, marketplaceSearchesUsed: 0 }, 503, cors);
      }
      let body = {};
      try { body = await request.json(); }
      catch { return json({ ok: false, error: "bad_json", message: "Scout could not read that sealed-product market request.", searchUsed: 0, marketplaceSearchesUsed: 0 }, 400, cors); }

      const identity = body?.identity && typeof body.identity === "object" ? body.identity : {};
      const shelfPrice = Number(body?.shelfPrice);
      const lookupTitle = String(body?.lookupTitle || "").trim().slice(0, 220);
      const query = sealedMarketQuery(identity, lookupTitle);
      const productType = String(identity?.boxType || identity?.productType || "").trim();
      if (!query || !productType || !Number.isFinite(shelfPrice) || shelfPrice <= 0) {
        return json({ ok: false, error: "missing_fields", message: "Confirm the product type and save the shelf price before checking market value.", searchUsed: 0, marketplaceSearchesUsed: 0 }, 400, cors);
      }

      const cacheKey = `sealed:value:v3:${encodeURIComponent(query.toLowerCase()).slice(0, 300)}`;
      if (env.SCOUT_DATA) {
        try {
          const cached = await env.SCOUT_DATA.get(cacheKey, { type: "json" });
          const cachedListings = Array.isArray(cached?.allListings) ? cached.allListings : (Array.isArray(cached?.listings) ? cached.listings : []);
          if (cached?.query === query && cachedListings.length) {
            const summary = sealedMarketCompetitiveSummary(cachedListings);
            const verdict = sealedMarketVerdict(shelfPrice, Number(summary.median), summary.sampleCount);
            return json({ ok: true, version: VERSION, query, shelfPrice, ...summary, checkedAt: cached.checkedAt || new Date().toISOString(), ...verdict, cacheHit: true, searchUsed: 0, marketplaceSearchesUsed: 0 }, 200, cors);
          }
        } catch {}
      }

      const serpUrl = new URL("https://serpapi.com/search.json");
      serpUrl.searchParams.set("engine", "ebay");
      serpUrl.searchParams.set("ebay_domain", "ebay.com");
      serpUrl.searchParams.set("_nkw", query);
      serpUrl.searchParams.set("_ipg", "50");
      serpUrl.searchParams.set("api_key", env.SERPAPI_KEY);

      let data = {};
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(serpUrl.toString(), { signal: controller.signal });
        clearTimeout(timeout);
        data = await response.json().catch(() => ({}));
        if (!response.ok || data?.error) {
          return json({ ok: false, error: "market_search_failed", message: "Scout could not complete the sealed-product market search right now.", searchUsed: 1, marketplaceSearchesUsed: 1 }, 502, cors);
        }
      } catch (err) {
        console.error("sealed market search failed", err);
        return json({ ok: false, error: "market_search_failed", message: "Scout could not complete the sealed-product market search right now.", searchUsed: 1, marketplaceSearchesUsed: 1 }, 502, cors);
      }

      const listings = sealedMarketResultRows(data, identity, lookupTitle);
      const summary = sealedMarketCompetitiveSummary(listings);
      const verdict = sealedMarketVerdict(shelfPrice, Number(summary.median), summary.sampleCount);
      const checkedAt = new Date().toISOString();
      const market = { query, ...summary, checkedAt };
      if (env.SCOUT_DATA && listings.length) {
        try { await env.SCOUT_DATA.put(cacheKey, JSON.stringify({ query, allListings: listings, checkedAt }), { expirationTtl: 6 * 60 * 60 }); } catch {}
      }
      return json({ ok: true, version: VERSION, shelfPrice, ...market, ...verdict, cacheHit: false, searchUsed: 1, marketplaceSearchesUsed: 1 }, 200, cors);
    }

    if (url.pathname === "/sealed/rip-quality" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SERPAPI_KEY || !env.AI) {
        return json({ ok: false, error: "rip_research_not_configured", message: "Scout's rip-quality research is not configured on the Worker.", researchSearchesUsed: 0, marketplaceSearchesUsed: 0 }, 503, cors);
      }
      let body = {};
      try { body = await request.json(); }
      catch { return json({ ok: false, error: "bad_json", message: "Scout could not read that rip-quality request.", researchSearchesUsed: 0, marketplaceSearchesUsed: 0 }, 400, cors); }

      const identity = body?.identity && typeof body.identity === "object" ? body.identity : {};
      const researchMode = body?.researchMode === "showdown" ? "showdown" : "single";
      const intelligenceTtlDays = researchMode === "showdown" ? 3 : 14;
      const lookupTitle = String(body?.lookupTitle || "").trim().slice(0, 220);
      const productLabel = sealedRipProductLabel(identity, lookupTitle);
      const market = body?.market && typeof body.market === "object" ? {
        shelfPrice: Number(body.market.shelfPrice),
        median: Number(body.market.median),
        verdict: String(body.market.verdict || "").slice(0, 40),
      } : {};
      if (!productLabel || !String(identity?.productType || identity?.boxType || "").trim()) {
        return json({ ok: false, error: "missing_identity", message: "Confirm the exact sealed product before checking rip quality.", researchSearchesUsed: 0, marketplaceSearchesUsed: 0 }, 400, cors);
      }
      if (!Number.isFinite(market.shelfPrice) || market.shelfPrice <= 0 || !Number.isFinite(market.median) || market.median <= 0) {
        return json({ ok: false, error: "missing_market", message: "Run the market-price check first so Scout can combine price and rip quality.", researchSearchesUsed: 0, marketplaceSearchesUsed: 0 }, 400, cors);
      }

      const cacheKey = sealedRipIntelligenceCacheKey(identity, researchMode);
      if (env.SCOUT_DATA) {
        try {
          const cached = await env.SCOUT_DATA.get(cacheKey, { type: "json" });
          if (cached?.analysis) {
            const analysis = sealedRipNormalize(cached.analysis, Array.isArray(cached.evidenceRows) ? cached.evidenceRows : [], market, identity, researchMode);
            const cacheUsable = researchMode !== "showdown" || sealedRipShowdownAnalysisComplete(analysis);
            if (cacheUsable) {
              return json({ ok: true, version: VERSION, productLabel, market, analysis, sources: cached.sources || [], checkedAt: cached.checkedAt || new Date().toISOString(), cacheHit: true, intelligenceCacheHit: true, intelligenceTtlDays, researchMode, researchSearchesUsed: 0, marketplaceSearchesUsed: 0 }, 200, cors);
            }
          }
        } catch {}
      }

      const formatTerms = sealedRipFormatTerms(identity);
      const researchSet = sealedRipResearchSet(identity);
      const exactSet = [String(identity?.year || "").trim(), researchSet].filter(Boolean).join(" ");
      // Keep the authoritative search intentionally broad. Requiring odds + checklist +
      // rookies + autos + parallels + case-hit language all at once caused Google to
      // return no non-community results for valid products such as 2025-26 Topps Hoops.
      // We instead ask for any of the core authoritative research signals, then rank and
      // validate the returned sources locally. This still spends exactly one research
      // search for product/checklist evidence and one for collector sentiment.
      const authoritySite = sealedRipPrimaryAuthoritySite(identity?.category);
      // Authority discovery should identify the SET page, not require the page title/snippet
      // to mention the exact retail format. Beckett's set page contains the Value/Blaster
      // odds in the body, but forcing "blaster"/"value box" into discovery can suppress it.
      // Avoid a quoted season string too: sources may write 2025-26, 2025/26, or 2025 26.
      const researchTerms = sealedRipResearchTerms(identity?.category);
      const checklistQuery = sealedRipAuthorityQuery(identity, researchSet, authoritySite, formatTerms, researchTerms);
      const communityQuery = `"${exactSet}" ${formatTerms} ${researchTerms.community} ${sealedRipCommunitySite(identity?.category)}`;
      const priceGuideQuery = sealedRipPriceGuideQuery(identity, researchSet);
      const secondaryQuery = researchMode === "showdown" ? priceGuideQuery : communityQuery;
      const secondaryKind = researchMode === "showdown" ? "singles-price-guide" : "collector-reports";
      let checklistData = {}, secondaryData = {};
      let researchSearchesUsed = 0;
      try {
        const results = await Promise.allSettled([
          sealedRipGoogleSearch(checklistQuery, env.SERPAPI_KEY, 18000, "mobile"),
          sealedRipGoogleSearch(secondaryQuery, env.SERPAPI_KEY, 14000),
        ]);
        researchSearchesUsed = 2;
        if (results[0].status === "fulfilled") checklistData = results[0].value;
        if (results[1].status === "fulfilled") secondaryData = results[1].value;
      } catch {}

      let evidenceRows = [
        ...sealedRipEvidenceRows(checklistData, "checklist-and-odds"),
        ...sealedRipEvidenceRows(secondaryData, secondaryKind),
      ];
      evidenceRows = sealedRipFilterRelevantEvidence(evidenceRows, identity);
      evidenceRows = await sealedRipExpandEvidenceRows(evidenceRows);
      const authoritySerpEvidence = sealedRipSerpEvidenceText(checklistData);
      if (authoritySerpEvidence) {
        evidenceRows.push({
          title: "Authoritative search evidence",
          link: "",
          snippet: authoritySerpEvidence.slice(0, 1400),
          pageText: authoritySerpEvidence,
          source: "Google structured result",
          sourceType: "checklist/editorial",
          queryKind: "checklist-and-odds",
          synthetic: true,
        });
      }
      const secondarySerpEvidence = sealedRipSerpEvidenceText(secondaryData);
      if (researchMode === "showdown" && secondarySerpEvidence) {
        evidenceRows.push({
          title: "Singles price-guide search evidence",
          link: "",
          snippet: secondarySerpEvidence.slice(0, 1800),
          pageText: secondarySerpEvidence,
          source: "Google structured result",
          sourceType: "checklist/editorial",
          queryKind: "singles-price-guide",
          synthetic: true,
        });
      }
      const researchMix = {
        authoritative: evidenceRows.filter(row => row.queryKind === "checklist-and-odds").length,
        community: evidenceRows.filter(row => row.queryKind === "collector-reports" && sealedRipCommunityRowCompatible(row, identity)).length,
        priceGuides: evidenceRows.filter(row => row.queryKind === "singles-price-guide").length,
        expandedPages: evidenceRows.filter(row => String(row.pageText || "").trim()).length,
      };
      const failureLanes = sealedRipFailureLanes(evidenceRows, identity, market, researchMode);
      if (!evidenceRows.length) {
        return json({ ok: false, error: "rip_research_too_thin", message: "Scout could not find even one trustworthy product-specific rip source yet. Try again later or judge this one manually.", failureStage: "evidence", lanes: failureLanes, researchMix, researchSearchesUsed, marketplaceSearchesUsed: 0 }, 502, cors);
      }

      const sources = evidenceRows
        .filter(row => /^https?:\/\//i.test(String(row?.link || "")) && (row?.sourceType !== "community" || sealedRipCommunityRowCompatible(row, identity)))
        .slice(0, 12)
        .map(row => ({ title: row.title, link: row.link, sourceType: row.sourceType, queryKind: row.queryKind }));
      // In Showdown, singles price-guide evidence has exactly one job: Chase Depth.
      // Keep it out of the main set/format synthesis prompt so a large pricing page
      // cannot overload or distract the model. The compact recovery/extraction pass
      // below receives priceGuideSignals separately and spends zero extra searches.
      const mainEvidenceRows = researchMode === "showdown"
        ? evidenceRows.filter(row => row.queryKind !== "singles-price-guide")
        : evidenceRows;
      const evidenceSignals = sealedRipPromptSignals(mainEvidenceRows, identity?.category);
      const priceGuideSignals = sealedRipPriceGuideEvidenceText(evidenceRows, identity);
      const evidenceForPrompt = mainEvidenceRows.slice(0, 14).map((row, index) =>
        `[${index + 1}] TYPE=${row.sourceType}; SEARCH=${row.queryKind}; TITLE=${row.title}; SOURCE=${row.source}; URL=${row.link}; SNIPPET=${row.snippet}; PAGE=${row.pageText || ""}`
      ).join("\n\n").slice(0, 26000);

      const schema = {
        type: "object",
        properties: {
          qualitySummary: { type: "string" },
          chaseScore: { type: "number" },
          chaseEvidenceAvailable: { type: "boolean" },
          formatAccessScore: { type: "number" },
          formatAccessEvidenceAvailable: { type: "boolean" },
          formatAccessSummary: { type: "string" },
          pullScore: { type: "number" },
          pullEvidenceAvailable: { type: "boolean" },
          sentimentScore: { type: "number" },
          sentimentEvidenceAvailable: { type: "boolean" },
          sentimentLabel: { type: "string", enum: ["positive", "mixed", "negative", "unknown"] },
          chaseCards: { type: "array", items: { type: "object", properties: { name: { type: "string" }, why: { type: "string" } }, required: ["name", "why"] }, maxItems: 5 },
          chaseValueCards: { type: "array", items: { type: "object", properties: { name: { type: "string" }, marketPrice: { type: "number" }, treatment: { type: "string" }, sourceType: { type: "string" } }, required: ["name", "marketPrice", "treatment", "sourceType"] }, maxItems: 15 },
          pullOdds: { type: "array", items: { type: "object", properties: { item: { type: "string" }, odds: { type: "string" }, sourceType: { type: "string" }, note: { type: "string" } }, required: ["item", "odds", "sourceType", "note"] }, maxItems: 8 },
          collectorTake: { type: "string" },
          positives: { type: "array", items: { type: "string" }, maxItems: 4 },
          negatives: { type: "array", items: { type: "string" }, maxItems: 4 },
          confidence: { type: "string", enum: ["high", "medium", "low"] }
        },
        required: ["qualitySummary", "chaseScore", "chaseEvidenceAvailable", "formatAccessScore", "formatAccessEvidenceAvailable", "formatAccessSummary", "pullScore", "pullEvidenceAvailable", "sentimentScore", "sentimentEvidenceAvailable", "sentimentLabel", "chaseCards", "chaseValueCards", "pullOdds", "collectorTake", "positives", "negatives", "confidence"]
      };
      const prompt = `You are evaluating whether a collector should OPEN/RIP an exact sealed trading-card product, not whether it is good for sealed resale. Product: ${productLabel}. Exact format: ${String(identity?.productType || identity?.boxType || "")}. Category: ${String(identity?.category || "")}. Year: ${String(identity?.year || "")}. Set: ${String(identity?.set || "")}.

${sealedRipCategoryGuidance(identity?.category)}

Use ONLY the research evidence below. Do not rely on memory. NEVER invent, estimate, calculate, or extrapolate an exact pull odd. Only include an odds string in pullOdds when that exact odds text is literally supported by the supplied evidence and applies to this exact product format. Every pullOdds.note MUST name the applicable sealed format/configuration when the source distinguishes formats (for example Value Box, Blaster, Hanger Box, Hobby, Mega, Fanatics, Booster Box, Bundle, or ETB). Never return odds labeled for a different format or retailer-exclusive variant. If reliable format-specific odds are not supported, set pullEvidenceAvailable=false and return an empty pullOdds array. Clearly distinguish official/checklist odds from community-reported observations; community anecdotes are not official odds.

Evaluate exact-format access separately for Shelf Showdown. Set formatAccessEvidenceAvailable=true ONLY when official/checklist/editorial evidence explicitly identifies this exact sealed format (including a clearly compatible retail alias) and describes desirable rarity/treatment/chase families that this configuration can contain. Score formatAccessScore 0-100 for how well THIS exact configuration reaches the desirable parts of the set, not for the set's overall quality. A format that excludes major desirable treatments should score lower; a format with broad access to the important chase structure can score higher. If the evidence is only set-level and does not establish exact-format access, set formatAccessEvidenceAvailable=false, formatAccessScore=0, and say so in formatAccessSummary. Never infer format access from another box type, retailer-exclusive variant, or community anecdote.

For Shelf Showdown, the main synthesis receives NO singles-price-guide lane. Always return chaseValueCards=[] here. Chase Depth is populated later by a dedicated PRICE-GUIDE-ONLY extraction pass. Never use price/value text from this authority prompt as singles pricing.

Named items in chaseCards must be explicitly supported by the supplied evidence; do not invent card names, players, Pokémon, treatments, inserts, or variants. Use the CATEGORY PLAYBOOK above to decide what counts as strong chase/set quality for this product. chaseCards may contain named chase cards, characters/players, treatment or insert families, or other category-appropriate named targets when the evidence supports them. Separately, set chaseEvidenceAvailable=true when trustworthy official/checklist/editorial evidence supports meaningful chase or set structure for this category even if individual names cannot be safely validated. Score chaseScore 0-100 only when chaseEvidenceAvailable=true, following the category playbook rather than a universal sports-card rubric. Preserve any exact pull-rate/odds notation literally as written in evidence. Community-reported pull rates are allowed only when clearly labeled as community/reported and supported by the exact evidence; they are never official manufacturer odds unless an official source says so. Missing exact odds are not by themselves a reason to withhold a recommendation. For collector/player sentiment, summarize recurring product-specific themes rather than one lucky or angry opening. Set sentimentEvidenceAvailable=false when community evidence is too thin; require recurring support from at least two independent community sources. Product/checklist facts are not collector sentiment by themselves. collectorTake, positives, and negatives must describe opinions, complaints, praise, price/value reactions, quality-control reports, collation reports, or opening experiences that are actually present in COMMUNITY EVIDENCE. Generic set-level opinions about card design, card stock, photography, or overall set appeal may be summarized. Format-specific claims about autograph guarantees, pack counts, pull experience, exclusives, or box value may be used only when the community evidence applies to the exact requested sealed format. Never import Hobby, Mega, Hanger, Fanatics, or another format's opening economics into a different product. Do not copy checklist features into the collector-sentiment fields. Never say "many collectors", "most collectors", "collector consensus", or make another broad consensus claim unless at least three independent community sources support the same recurring theme. Keep conclusions conservative when evidence is thin.

COMMUNITY EVIDENCE — use ONLY this section for collectorTake / positives / negatives:\
${sealedRipCommunityEvidenceText(evidenceRows, identity) || "No compatible community evidence available."}\
\
High-signal excerpts extracted from the best sources (read these first):\n${evidenceSignals || "No compact signals extracted."}\n\nFull research evidence:\n${evidenceForPrompt}`;

      const compactSynthesisPrompt = `Evaluate ${productLabel} (${String(identity?.productType || identity?.boxType || "")}) using ONLY the compact evidence below. Return the requested JSON schema. ${sealedRipCategoryGuidance(identity?.category)} Never invent card names, odds, pull rates, guarantees, or format access. Exact pull odds must be literal and exact-format compatible. In Shelf Showdown, singles-price extraction is handled separately, so return chaseValueCards=[] here. If community evidence is absent, set sentimentEvidenceAvailable=false and leave collector fields conservative.\n\nCOMPACT AUTHORITY EVIDENCE:\n${evidenceSignals || evidenceForPrompt.slice(0, 12000) || "No compact authority evidence available."}`;
      const showdownSchema = {
        type: "object",
        properties: {
          qualitySummary: { type: "string" },
          chaseScore: { type: "number" },
          chaseEvidenceAvailable: { type: "boolean" },
          chaseCards: { type: "array", items: { type: "object", properties: { name: { type: "string" }, why: { type: "string" } }, required: ["name", "why"] }, maxItems: 5 },
          pullScore: { type: "number" },
          pullEvidenceAvailable: { type: "boolean" },
          pullOdds: { type: "array", items: { type: "object", properties: { item: { type: "string" }, odds: { type: "string" }, sourceType: { type: "string" }, note: { type: "string" } }, required: ["item", "odds", "sourceType", "note"] }, maxItems: 8 },
          confidence: { type: "string", enum: ["high", "medium", "low"] }
        },
        required: ["qualitySummary", "chaseScore", "chaseEvidenceAvailable", "chaseCards", "pullScore", "pullEvidenceAvailable", "pullOdds", "confidence"]
      };
      const showdownSynthesisPrompt = `SHOWDOWN AUTHORITY-ONLY ANALYSIS for ${productLabel} (${String(identity?.productType || identity?.boxType || "")}). Use ONLY the authority/checklist evidence below. Judge category-appropriate set/chase strength. Named chase cards or families must be explicitly supported. Exact pull odds must be literal and exact-format compatible; otherwise return pullEvidenceAvailable=false and pullOdds=[]. Do not score format access here; local section-aware code does that separately. Do not output singles prices; Chase Depth is extracted from its separate price-guide lane. Never invent names, guarantees, odds, or format claims.\n\nAUTHORITY EVIDENCE:\n${evidenceSignals || evidenceForPrompt.slice(0, 12000) || "No compact authority evidence available."}`;
      const activeSynthesisSchema = researchMode === "showdown" ? showdownSchema : schema;
      const activePrimaryPrompt = researchMode === "showdown" ? showdownSynthesisPrompt : prompt;
      const showdownJsonInstruction = `Return ONE valid JSON object only. Required keys: qualitySummary, chaseScore, chaseEvidenceAvailable, chaseCards, pullScore, pullEvidenceAvailable, pullOdds, confidence. chaseCards and pullOdds must be arrays. confidence must be high, medium, or low. No markdown or commentary outside the JSON object.`;
      const activeRetryPrompt = researchMode === "showdown" ? `${showdownSynthesisPrompt}\n\n${showdownJsonInstruction}` : compactSynthesisPrompt;
      let aiObject;
      let synthesisRetryUsed = false;
      try {
        const primaryOptions = {
          prompt: researchMode === "showdown" ? `${activePrimaryPrompt}\n\n${showdownJsonInstruction}` : activePrimaryPrompt,
          max_tokens: researchMode === "showdown" ? 850 : 1400,
          temperature: 0.1,
          response_format: researchMode === "showdown"
            ? { type: "json_object" }
            : { type: "json_schema", json_schema: activeSynthesisSchema }
        };
        const primaryRaw = await env.AI.run(SEALED_RIP_MODEL, primaryOptions);
        aiObject = sealedRipAiJson(primaryRaw);
      } catch (err) {
        console.warn("sealed rip primary synthesis/parse failed; trying compact authority-only retry", err);
        synthesisRetryUsed = true;
        try {
          const retryOptions = {
            prompt: activeRetryPrompt,
            max_tokens: researchMode === "showdown" ? 750 : 1200,
            temperature: 0,
          };
          // If Showdown JSON mode itself fails, the single retry deliberately avoids
          // response_format entirely and relies on the explicit JSON-only instruction
          // plus sealedRipAiJson(). This prevents repeating the same provider failure.
          if (researchMode !== "showdown") {
            retryOptions.response_format = { type: "json_schema", json_schema: activeSynthesisSchema };
          }
          const retryRaw = await env.AI.run(SEALED_RIP_MODEL, retryOptions);
          aiObject = sealedRipAiJson(retryRaw);
        } catch (retryErr) {
          console.error("sealed rip compact synthesis/parse retry failed", retryErr);
          return json({ ok: false, error: "rip_analysis_failed", message: "Scout found the research but could not finish the rip-quality analysis right now.", failureStage: "synthesis", lanes: failureLanes, researchMix: { ...researchMix, synthesisRetryUsed }, researchSearchesUsed, marketplaceSearchesUsed: 0 }, 502, cors);
        }
      }

      if (researchMode === "showdown") {
        aiObject = {
          formatAccessScore: 0,
          formatAccessEvidenceAvailable: false,
          formatAccessSummary: "",
          sentimentScore: 0,
          sentimentEvidenceAvailable: false,
          sentimentLabel: "unknown",
          collectorTake: "",
          positives: [],
          negatives: [],
          chaseValueCards: [],
          ...aiObject,
        };
      }

      // Recovery is lane-typed. Authority recovery can only produce set/chase and
      // pull-odds fields. Price-guide recovery can only produce singles values.
      const missingChases = !Array.isArray(aiObject?.chaseCards) || !aiObject.chaseCards.length;
      const missingOdds = !Array.isArray(aiObject?.pullOdds) || !aiObject.pullOdds.length;
      const missingChaseValues = !Array.isArray(aiObject?.chaseValueCards) || !aiObject.chaseValueCards.length;

      if (evidenceSignals && (missingChases || missingOdds)) {
        const authorityRecoverySchema = {
          type: "object",
          properties: {
            chaseScore: { type: "number" },
            pullScore: { type: "number" },
            chaseCards: { type: "array", items: { type: "object", properties: { name: { type: "string" }, why: { type: "string" } }, required: ["name", "why"] }, maxItems: 5 },
            pullOdds: { type: "array", items: { type: "object", properties: { item: { type: "string" }, odds: { type: "string" }, sourceType: { type: "string" }, note: { type: "string" } }, required: ["item", "odds", "sourceType", "note"] }, maxItems: 8 },
          },
          required: ["chaseScore", "pullScore", "chaseCards", "pullOdds"]
        };
        const authorityRecoveryPrompt = `AUTHORITY-ONLY RECOVERY for ${productLabel} (${String(identity?.productType || identity?.boxType || "")}). Extract only category-appropriate named chase/set signals and literal pull odds from the AUTHORITY evidence below. Do not output singles prices. Preserve literal rates exactly. Omit any odds for an incompatible format or retailer variant. Never invent names or rates.\n\nAUTHORITY EVIDENCE:\n${evidenceSignals}`;
        try {
          const recoveredRaw = await env.AI.run(SEALED_RIP_MODEL, {
            prompt: authorityRecoveryPrompt,
            max_tokens: 700,
            temperature: 0,
            response_format: researchMode === "showdown"
              ? { type: "json_object" }
              : { type: "json_schema", json_schema: authorityRecoverySchema }
          });
          const recovered = sealedRipAiJson(recoveredRaw);
          if (missingChases && Array.isArray(recovered?.chaseCards) && recovered.chaseCards.length) {
            aiObject.chaseCards = recovered.chaseCards;
            aiObject.chaseScore = recovered.chaseScore;
            aiObject.chaseEvidenceAvailable = true;
          }
          if (missingOdds && Array.isArray(recovered?.pullOdds) && recovered.pullOdds.length) {
            aiObject.pullOdds = recovered.pullOdds;
            aiObject.pullScore = recovered.pullScore;
            aiObject.pullEvidenceAvailable = true;
          }
        } catch (err) {
          console.warn("sealed authority-only recovery skipped", err);
        }
      }

      if (researchMode === "showdown" && priceGuideSignals && missingChaseValues) {
        const priceGuideRecoverySchema = {
          type: "object",
          properties: {
            chaseValueCards: { type: "array", items: { type: "object", properties: { name: { type: "string" }, marketPrice: { type: "number" }, treatment: { type: "string" }, sourceType: { type: "string" } }, required: ["name", "marketPrice", "treatment", "sourceType"] }, maxItems: 15 },
          },
          required: ["chaseValueCards"]
        };
        const priceGuideRecoveryPrompt = `PRICE-GUIDE-ONLY RECOVERY for ${productLabel}. Extract only exact card name + literal current raw/market singles price records from the price-guide evidence below. Do not output set strength, format access, chase claims, or pull odds. Never use sealed box/pack prices. Never infer a price that is not literally paired with the card in the supplied evidence.\n\nPRICE-GUIDE EVIDENCE:\n${priceGuideSignals}`;
        try {
          const recoveredRaw = await env.AI.run(SEALED_RIP_MODEL, {
            prompt: priceGuideRecoveryPrompt,
            max_tokens: 700,
            temperature: 0,
            response_format: { type: "json_object" }
          });
          const recovered = sealedRipAiJson(recoveredRaw);
          if (Array.isArray(recovered?.chaseValueCards) && recovered.chaseValueCards.length) {
            aiObject.chaseValueCards = recovered.chaseValueCards;
          }
        } catch (err) {
          console.warn("sealed price-guide-only recovery skipped", err);
        }
      }
      const analysis = sealedRipNormalize(aiObject, evidenceRows, market, identity, researchMode);
      const checkedAt = new Date().toISOString();
      const cacheableIntelligence = researchMode !== "showdown" || sealedRipShowdownAnalysisComplete(analysis);
      if (env.SCOUT_DATA && cacheableIntelligence) {
        try { await env.SCOUT_DATA.put(cacheKey, JSON.stringify({ productLabel, analysis: aiObject, evidenceRows, sources, checkedAt, researchMode }), { expirationTtl: intelligenceTtlDays * 24 * 60 * 60 }); } catch {}
      }
      return json({ ok: true, version: VERSION, productLabel, market, analysis, sources, researchMix: { ...researchMix, synthesisRetryUsed, synthesisMode: researchMode === "showdown" ? "json_object_with_plain_retry" : "json_schema" }, checkedAt, cacheHit: false, intelligenceCacheHit: false, cacheableIntelligence, intelligenceTtlDays, researchMode, researchSearchesUsed, marketplaceSearchesUsed: 0 }, 200, cors);
    }

    if (url.pathname === "/sealed/classify-type" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.AI) {
        return json({ ok: false, error: "vision_not_configured", message: "Scout product-type photo reading is not configured on the Worker." }, 503, cors);
      }
      let body = {};
      try { body = await request.json(); }
      catch { return json({ ok: false, error: "bad_json", message: "Scout could not read that product-type request." }, 400, cors); }

      const imageDataUrl = String(body?.imageDataUrl || "");
      const match = imageDataUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/i);
      if (!match) return json({ ok: false, error: "bad_image", message: "Scout needs a clear front JPEG, PNG, or WebP photo to classify the package type." }, 400, cors);
      const approxBytes = Math.floor(match[2].length * 3 / 4);
      if (approxBytes <= 0 || approxBytes > SEALED_VISION_MAX_BYTES) {
        return json({ ok: false, error: "image_too_large", message: "That front photo is too large. Retake it a little closer." }, 413, cors);
      }

      const known = body?.identity && typeof body.identity === "object" ? body.identity : {};
      const knownCategory = String(known.category || "").trim().slice(0, 60);
      const knownYear = String(known.year || "").trim().slice(0, 40);
      const knownSet = String(known.set || "").trim().slice(0, 160);
      const knownTitle = String(known.lookupTitle || "").trim().slice(0, 220);
      const knownBarcode = sealedBarcodeDigits(known.barcode || "");
      if (!knownSet && !knownTitle) {
        return json({ ok: false, error: "missing_identity", message: "Scan the barcode first so Scout knows which product it is before classifying the package type." }, 400, cors);
      }

      const allowedTypes = Array.from(SEALED_VISION_PRODUCT_TYPES).join(", ");
      const knownLabel = [knownYear, knownSet || knownTitle, knownCategory].filter(Boolean).join(" · ");
      const question = `The barcode has ALREADY identified this sealed trading-card product as: ${knownLabel || knownTitle}. ${knownBarcode ? `Barcode: ${knownBarcode}.` : ""} Do NOT re-identify the product, set, sport, or year. Your only job is to classify the PACKAGE FORMAT visible in this front photo. Choose productType from exactly this list: ${allowedTypes}. Look first for explicit packaging words such as Blaster, Mega, Hobby, Retail, Hanger, Value Pack, Fat Pack, Elite Trainer Box, Booster Bundle, Booster Box, Booster Pack, Collection Box, Tin, Multi-Pack, or Single Pack. Use the physical box/pack shape only as secondary evidence. Return ONLY one JSON object with keys productType, confidence, clues, followUp. confidence must be high, medium, or low. If the type is not supported by the photo, use productType Other and confidence low instead of guessing.`;
      try {
        const raw = await env.AI.run(SEALED_VISION_MODEL, {
          task: "query",
          image: imageDataUrl,
          question,
          reasoning: false,
          stream: false,
          temperature: 0,
          max_tokens: 220
        });
        const classification = sealedTypeNormalize(sealedTypeJsonFromResponse(raw));
        return json({ ok: true, version: VERSION, classification, searchUsed: 0, marketplaceSearchesUsed: 0 }, 200, cors);
      } catch (err) {
        console.error("sealed product type classify failed", err);
        return json({ ok: false, error: "type_classify_failed", message: "Scout knows the product, but could not classify the package type from that front photo. Try another front photo or choose the type manually.", searchUsed: 0, marketplaceSearchesUsed: 0 }, 502, cors);
      }
    }

    if (url.pathname === "/sealed/identify" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.AI) {
        return json({ ok: false, error: "vision_not_configured", message: "Scout photo identification is not configured on the Worker." }, 503, cors);
      }
      let body = {};
      try { body = await request.json(); }
      catch { return json({ ok: false, error: "bad_json", message: "Scout could not read that photo request." }, 400, cors); }
      const imageDataUrl = String(body?.imageDataUrl || "");
      const match = imageDataUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/i);
      if (!match) return json({ ok: false, error: "bad_image", message: "Scout needs a JPEG, PNG, or WebP photo." }, 400, cors);
      const approxBytes = Math.floor(match[2].length * 3 / 4);
      if (approxBytes <= 0 || approxBytes > SEALED_VISION_MAX_BYTES) {
        return json({ ok: false, error: "image_too_large", message: "That photo is too large for Scout to analyze. Please retake it a little closer." }, 413, cors);
      }

      const schema = {
        type: "object",
        properties: {
          category: { type: "string" },
          year: { type: "string" },
          set: { type: "string" },
          productType: { type: "string" },
          variant: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          clues: { type: "array", items: { type: "string" }, maxItems: 4 },
          needsAnotherPhoto: { type: "boolean" },
          followUp: { type: "string" }
        },
        required: ["category", "year", "set", "productType", "variant", "confidence", "clues", "needsAnotherPhoto", "followUp"]
      };
      const productTypes = Array.from(SEALED_VISION_PRODUCT_TYPES).join(", ");
      const prompt = `Identify the exact sealed trading-card product shown in this front photo. Categories: Pokémon, Magic: The Gathering, Baseball, Basketball, Football, Other. Product type MUST be one of: ${productTypes}. Read visible packaging text carefully and use those words as primary evidence: year/season, league/category, brand/set, format, pack/card counts, retail-exclusive wording, and variant clues. Distinguish blaster, mega, hobby, retail, hanger, value/fat pack, single pack, multi-pack, booster formats, tins, and collection boxes. Do not guess when the photo does not support a field. If product type is uncertain, use Other and set needsAnotherPhoto=true. If another side/back photo would resolve ambiguity, say exactly what wording or panel to photograph in followUp. Return only the requested structured fields.`;
      try {
        const moondreamQuestion = `${prompt} First transcribe ALL readable packaging text you can see, especially league/category words (NBA, NFL, MLB, Pokémon, Magic), the year/season, product/set name, and pack/card counts. Then return ONLY one JSON object with keys category, year, set, productType, variant, confidence, clues, visibleText, needsAnotherPhoto, followUp. Never infer Pokémon from artwork alone. NBA or NBA Hoops means Basketball. If a required field is unreadable, leave it blank and request another photo instead of guessing.`;
        const raw = await env.AI.run(SEALED_VISION_MODEL, {
          task: "query",
          image: imageDataUrl,
          question: moondreamQuestion,
          reasoning: false,
          stream: false,
          temperature: 0.1,
          max_tokens: 700
        });
        const parsed = sealedVisionJsonFromResponse(raw);
        const identity = sealedVisionNormalize(parsed);
        return json({ ok: true, version: VERSION, identity, searchUsed: 0, marketplaceSearchesUsed: 0 }, 200, cors);
      } catch (err) {
        console.error("sealed vision identify failed", err);
        return json({ ok: false, error: "vision_identify_failed", message: "Scout could not confidently read that photo. Try another front photo or enter the product manually.", searchUsed: 0, marketplaceSearchesUsed: 0 }, 502, cors);
      }
    }

    if (url.pathname === "/automation/status" && request.method === "GET") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SCOUT_DATA) {
        return json({ ok: false, error: "cloud_storage_not_configured", message: "SCOUT_DATA KV binding is not configured on the Worker." }, 503, cors);
      }
      try {
        const state = await readAutomationState(env.SCOUT_DATA);
        const catalog = await readAutomationCatalog(env.SCOUT_DATA);
        return json({ ok: true, version: VERSION, runnerEnabled: true, targetRunnerEnabled: true, collectionRunnerEnabled: true, ...automationPublicState(state), catalog: automationCatalogSummary(catalog) }, 200, cors);
      } catch (err) {
        console.error(err);
        return json({ ok: false, error: "automation_status_failed", message: "Scout could not load the automation search budget." }, 502, cors);
      }
    }

    if (url.pathname === "/automation/settings" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SCOUT_DATA) {
        return json({ ok: false, error: "cloud_storage_not_configured", message: "SCOUT_DATA KV binding is not configured on the Worker." }, 503, cors);
      }
      let body;
      try { body = await request.json(); }
      catch { return json({ ok: false, error: "bad_json", message: "Automation settings are not valid JSON." }, 400, cors); }
      try {
        const existing = await readAutomationState(env.SCOUT_DATA);
        const settings = normalizeAutomationSettings(body);
        const next = { ...existing, settings, updatedAt: new Date().toISOString() };
        await writeAutomationState(env.SCOUT_DATA, next);
        return json({ ok: true, version: VERSION, runnerEnabled: true, targetRunnerEnabled: true, collectionRunnerEnabled: true, ...automationPublicState(next) }, 200, cors);
      } catch (err) {
        console.error(err);
        return json({ ok: false, error: "automation_settings_failed", message: "Scout could not save the automation search budget." }, 502, cors);
      }
    }

    if (url.pathname === "/automation/catalog" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SCOUT_DATA) {
        return json({ ok: false, error: "cloud_storage_not_configured", message: "SCOUT_DATA KV binding is not configured on the Worker." }, 503, cors);
      }
      let body;
      try { body = await request.json(); }
      catch { return json({ ok: false, error: "bad_json", message: "Automation catalog is not valid JSON." }, 400, cors); }
      try {
        const catalog = normalizeAutomationCatalog(body);
        const serialized = JSON.stringify(catalog);
        if (new TextEncoder().encode(serialized).byteLength > AUTOMATION_CATALOG_MAX_BYTES) {
          return json({ ok: false, error: "automation_catalog_too_large", message: "Automation catalog is larger than Scout allows." }, 413, cors);
        }
        await env.SCOUT_DATA.put(AUTOMATION_CATALOG_KEY, serialized);
        return json({ ok: true, version: VERSION, ...automationCatalogSummary(catalog), searchUsed: 0 }, 200, cors);
      } catch (err) {
        console.error(err);
        return json({ ok: false, error: "automation_catalog_failed", message: err?.message || "Scout could not save the automation catalog." }, 502, cors);
      }
    }

    if (url.pathname === "/automation/run-once" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SCOUT_DATA) {
        return json({ ok: false, error: "cloud_storage_not_configured", message: "SCOUT_DATA KV binding is not configured on the Worker." }, 503, cors);
      }
      let body = {};
      try { body = await request.json(); } catch {}
      const kind = String(body?.kind || "target");
      if (!["target", "collection"].includes(kind)) {
        return json({ ok: false, error: "unsupported_automation_kind", message: "Scout only supports protected target or collection safety checks here." }, 400, cors);
      }
      try {
        let state = await readAutomationState(env.SCOUT_DATA);
        const catalog = await readAutomationCatalog(env.SCOUT_DATA);
        const run = kind === "collection"
          ? await runOneAutomationCollectionCheck(env, state, catalog)
          : await runOneAutomationTargetCheck(env, state, catalog);
        state = run.state;
        state = automationRecordActivity(state, kind, run.result, new Date(), "manual-test");
        await writeAutomationState(env.SCOUT_DATA, state);
        return json({ ok: true, version: VERSION, runnerEnabled: true, targetRunnerEnabled: true, collectionRunnerEnabled: true, result: run.result, ...automationPublicState(state), catalog: automationCatalogSummary(catalog) }, 200, cors);
      } catch (err) {
        console.error(err);
        return json({ ok: false, error: "automation_run_failed", message: err?.message || "Scout could not complete the protected automation check." }, 502, cors);
      }
    }

    if (url.pathname === "/push/config" && request.method === "GET") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SCOUT_DATA) return json({ ok: false, error: "cloud_storage_not_configured" }, 503, cors);
      try {
        const vapid = await pushGetOrCreateVapid(env.SCOUT_DATA);
        const subscriptions = await pushReadSubscriptions(env.SCOUT_DATA);
        return json({ ok: true, version: VERSION, publicKey: vapid.publicKey, subscriptionCount: subscriptions.length }, 200, cors);
      } catch (err) {
        console.error(err);
        return json({ ok: false, error: "push_config_failed", message: "Scout could not prepare phone notifications." }, 502, cors);
      }
    }

    if (url.pathname === "/push/subscribe" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SCOUT_DATA) return json({ ok: false, error: "cloud_storage_not_configured" }, 503, cors);
      let body = {};
      try { body = await request.json(); } catch { return json({ ok: false, error: "bad_json" }, 400, cors); }
      try {
        const saved = await pushSaveSubscription(env.SCOUT_DATA, body?.deviceToken, body?.subscription);
        return json({ ok: true, version: VERSION, deviceToken: saved.deviceToken, subscriptionCount: saved.subscriptionCount }, 200, cors);
      } catch (err) {
        return json({ ok: false, error: "push_subscribe_failed", message: err?.message || "Scout could not save this phone for notifications." }, 400, cors);
      }
    }

    if (url.pathname === "/push/unsubscribe" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SCOUT_DATA) return json({ ok: false, error: "cloud_storage_not_configured" }, 503, cors);
      let body = {};
      try { body = await request.json(); } catch {}
      const count = await pushRemoveSubscription(env.SCOUT_DATA, body?.deviceToken);
      return json({ ok: true, version: VERSION, subscriptionCount: count }, 200, cors);
    }

    if (url.pathname === "/push/test" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SCOUT_DATA) return json({ ok: false, error: "cloud_storage_not_configured" }, 503, cors);
      let body = {};
      try { body = await request.json(); } catch {}
      try {
        const result = await pushSendTest(env, body?.deviceToken);
        return json({ ok: true, version: VERSION, ...result, searchUsed: 0 }, 200, cors);
      } catch (err) {
        return json({ ok: false, error: "push_test_failed", message: err?.message || "Scout could not send the test notification." }, 502, cors);
      }
    }

    if (url.pathname === "/push/latest" && request.method === "GET") {
      if (!env.SCOUT_DATA) return json({ ok: false, error: "cloud_storage_not_configured" }, 503, cors);
      const deviceToken = url.searchParams.get("token") || "";
      const subscriptions = await pushReadSubscriptions(env.SCOUT_DATA);
      if (!subscriptions.some(row => row.deviceToken === deviceToken)) {
        return json({ ok: false, error: "unknown_push_device" }, 401, cors);
      }
      const state = await readAutomationState(env.SCOUT_DATA);
      const latest = Array.isArray(state.activity) && state.activity.length ? state.activity[state.activity.length - 1] : null;
      const payload = pushActivityPayload(latest);
      return json({ ok: true, version: VERSION, ...payload }, 200, cors);
    }

    if (url.pathname === "/psa/verify" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.PSA_API_TOKEN) {
        return json({ ok: false, error: "psa_not_configured", message: "PSA_API_TOKEN is not configured on the Worker." }, 503, cors);
      }

      let body;
      try { body = await request.json(); }
      catch { return json({ ok: false, error: "bad_json" }, 400, cors); }

      const certNumber = normalizePsaCertNumber(body?.certNumber);
      if (!certNumber) {
        return json({ ok: false, error: "invalid_cert", message: "Enter a numeric PSA certification number." }, 400, cors);
      }

      try {
        const cached = await readPsaCache(certNumber);
        if (cached) return json({ ok: true, version: VERSION, cached: true, ...cached }, 200, cors);

        const result = await verifyPsaCert(certNumber, env.PSA_API_TOKEN);
        if (result.verified) {
          const put = writePsaCache(certNumber, result);
          if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(put);
          else await put;
        }
        return json({ ok: true, version: VERSION, cached: false, ...result }, 200, cors);
      } catch (err) {
        console.error(err);
        const status = Number(err?.status) || 502;
        return json({ ok: false, error: err?.code || "psa_lookup_failed", message: err?.message || "PSA verification failed." }, status, cors);
      }
    }

    if (url.pathname === "/cardapi/test" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.CARD_API_KEY) {
        return json({ ok: false, error: "cardapi_not_configured", message: "CARD_API_KEY is not configured on the Worker." }, 503, cors);
      }

      let card;
      try { card = await request.json(); }
      catch { return json({ ok: false, error: "bad_json" }, 400, cors); }

      const valid = validateCard(card);
      if (!valid.ok) return json({ ok: false, error: "invalid_card", message: valid.message }, 400, cors);

      try {
        const result = await testCardApiSecondarySources(card, env.CARD_API_KEY);
        return json({
          ok: true,
          version: VERSION,
          provider: "The Card API",
          cachePolicy: "session-only / not persisted",
          ...result,
        }, 200, cors);
      } catch (err) {
        console.error(err);
        const status = Number(err?.status) || 502;
        return json({ ok: false, error: err?.code || "cardapi_test_failed", message: err?.message || "The Card API test failed." }, status, cors);
      }
    }

    if (url.pathname === "/cardapi/bestoffer" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.CARD_API_KEY) {
        return json({ ok: false, error: "cardapi_not_configured", message: "CARD_API_KEY is not configured on the Worker." }, 503, cors);
      }

      let card;
      try { card = await request.json(); }
      catch { return json({ ok: false, error: "bad_json" }, 400, cors); }

      const valid = validateCard(card);
      if (!valid.ok) return json({ ok: false, error: "invalid_card", message: valid.message }, 400, cors);

      try {
        const result = await testCardApiBestOffers(card, env.CARD_API_KEY);
        return json({
          ok: true,
          version: VERSION,
          provider: "The Card API — eBay Best Offer",
          cachePolicy: "session-only / not persisted",
          ...result,
        }, 200, cors);
      } catch (err) {
        console.error(err);
        const status = Number(err?.status) || 502;
        return json({ ok: false, error: err?.code || "cardapi_bestoffer_failed", message: err?.message || "The Card API Best Offer test failed." }, status, cors);
      }
    }


    if (url.pathname === "/cardapi/recover-bestoffers" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.APIFY_TOKEN || !env.CARD_API_KEY) {
        return json({
          ok: false,
          error: "bridge_not_configured",
          message: "Both APIFY_TOKEN and CARD_API_KEY are required for Best Offer recovery."
        }, 503, cors);
      }

      let card;
      try { card = await request.json(); }
      catch { return json({ ok: false, error: "bad_json" }, 400, cors); }

      const valid = validateCard(card);
      if (!valid.ok) return json({ ok: false, error: "invalid_card", message: valid.message }, 400, cors);

      try {
        const result = await testBestOfferRecoveryBridge(card, env.APIFY_TOKEN, env.CARD_API_KEY);
        return json({
          ok: true,
          version: VERSION,
          provider: "Apify → The Card API Best Offer Bridge",
          cachePolicy: "test-only / not persisted",
          ...result,
        }, 200, cors);
      } catch (err) {
        console.error(err);
        const status = Number(err?.status) || 502;
        return json({
          ok: false,
          error: err?.code || "bestoffer_bridge_failed",
          message: err?.message || "Best Offer recovery bridge failed."
        }, status, cors);
      }
    }


    if (url.pathname === "/confidence/explain" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SERPAPI_KEY && !env.CARD_API_KEY && !env.APIFY_TOKEN) {
        return json({ ok: false, error: "provider_not_configured", message: "No sold-comps provider is configured." }, 503, cors);
      }

      let card;
      try { card = await request.json(); }
      catch { return json({ ok: false, error: "bad_json" }, 400, cors); }

      const valid = validateCard(card);
      if (!valid.ok) return json({ ok: false, error: "invalid_card", message: valid.message }, 400, cors);

      try {
        // Phase 2C should explain the exact valuation Scout already produced,
        // not make a second set of paid/slow provider calls. Read the normal
        // six-hour cache only. The lab therefore costs zero additional
        // SerpApi, Apify, or Card API usage.
        const fastMode = Boolean(card.fastMode);
        const cacheEntry = await readValuationCache(card, fastMode);
        const cached = cacheEntry?.fresh ? cacheEntry.result : null;
        if (!cached) {
          return json({
            ok: false,
            error: "no_cached_valuation",
            message: fastMode
              ? "No cached Fast Mode valuation is available. Run this card once in normal HOF Card Scout with Fast Mode ON, then try Explain Confidence again."
              : "No cached Deep Mode valuation is available. Run this card once in normal HOF Card Scout with Fast Mode OFF, then try Explain Confidence again."
          }, 409, cors);
        }

        const result = withCurrentShopVerdict(cached, card, true);
        const experimental = explainExperimentalConfidence(result, card);
        return json({
          ok: true,
          version: VERSION,
          phase: "2C confidence model",
          cachePolicy: "read-only explanation of Scout's existing 6-hour valuation cache",
          current: {
            confidence: result.confidence,
            verdictTier: result.verdictTier,
            provider: result.provider,
            used: result.used,
            median: result.median,
            low: result.low,
            high: result.high,
            bestOfferRecovered: result.bestOfferRecovered || 0,
            bestOfferRecoveryAttempted: result.bestOfferRecoveryAttempted || 0,
          },
          experimental,
          comps: result.comps,
          notes: result.notes,
        }, 200, cors);
      } catch (err) {
        console.error(err);
        return json({ ok: false, error: "confidence_lab_failed", message: err?.message || "Confidence lab failed." }, 502, cors);
      }
    }



    if (url.pathname === "/monthly-pick" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SERPAPI_KEY) {
        return json({
          ok: false,
          error: "monthly_pick_provider_not_configured",
          message: "Scout's Monthly Pick needs the existing SERPAPI_KEY configured on the Worker."
        }, 503, cors);
      }

      let body;
      try { body = await request.json(); }
      catch { return json({ ok: false, error: "bad_json" }, 400, cors); }

      const player = String(body?.player || "").trim();
      const budget = Number(body?.budget);
      const mode = body?.mode === "upgrade" ? "upgrade" : "need";
      const currentCard = body?.currentCard && typeof body.currentCard === "object" ? body.currentCard : null;
      const excludeIds = Array.isArray(body?.excludeIds)
        ? body.excludeIds.map(x => String(x || "")).filter(Boolean).slice(0, 25)
        : [];
      const preferredSellers = Array.isArray(body?.preferredSellers)
        ? body.preferredSellers.map(x => String(x || "").trim()).filter(Boolean).slice(0, 100)
        : [];

      if (player.length < 2 || player.length > 100) {
        return json({ ok: false, error: "invalid_player", message: "Monthly Pick needs a valid Hall of Famer name." }, 400, cors);
      }
      if (!Number.isFinite(budget) || budget < 1 || budget > 10000) {
        return json({ ok: false, error: "invalid_budget", message: "Enter a monthly budget between $1 and $10,000." }, 400, cors);
      }

      try {
        const result = await searchMonthlyPickListing({
          player,
          budget,
          mode,
          currentCard,
          excludeIds,
          preferredSellers,
          apiKey: env.SERPAPI_KEY,
          purpose: "monthly"
        });
        return json({
          ok: true,
          version: VERSION,
          phase: "6 Scout's Monthly Pick lab",
          provider: "Active eBay listings via SerpApi",
          ...result,
        }, 200, cors);
      } catch (err) {
        console.error(err);
        const status = Number(err?.status) || 502;
        return json({
          ok: false,
          error: err?.code || "monthly_pick_failed",
          message: err?.message || "Scout could not find this month's recommendation."
        }, status, cors);
      }
    }


    if (url.pathname === "/find-target" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SERPAPI_KEY) {
        return json({
          ok: false,
          error: "find_target_provider_not_configured",
          message: "Find a Target needs the existing SERPAPI_KEY configured on the Worker."
        }, 503, cors);
      }

      let body;
      try { body = await request.json(); }
      catch { return json({ ok: false, error: "bad_json" }, 400, cors); }

      const player = String(body?.player || "").trim();
      const budget = Number(body?.budget);
      const mode = body?.mode === "upgrade" ? "upgrade" : "need";
      const currentCard = body?.currentCard && typeof body.currentCard === "object" ? body.currentCard : null;
      const searchHint = String(body?.searchHint || "").trim().slice(0, 180);
      const futureHof = body?.futureHof === true;
      const excludeIds = Array.isArray(body?.excludeIds)
        ? body.excludeIds.map(x => String(x || "")).filter(Boolean).slice(0, 25)
        : [];
      const preferredSellers = Array.isArray(body?.preferredSellers)
        ? body.preferredSellers.map(x => String(x || "").trim()).filter(Boolean).slice(0, 100)
        : [];

      if (player.length < 2 || player.length > 100) {
        return json({ ok: false, error: "invalid_player", message: "Find a Target needs a valid Hall of Famer name." }, 400, cors);
      }
      if (!Number.isFinite(budget) || budget < 1 || budget > 10000) {
        return json({ ok: false, error: "invalid_budget", message: "Enter a target budget between $1 and $10,000." }, 400, cors);
      }
      if (mode === "upgrade" && !currentCard) {
        return json({ ok: false, error: "current_card_required", message: "Scout needs the current representative card to judge an upgrade." }, 400, cors);
      }

      try {
        const result = await searchMonthlyPickListing({
          player,
          budget,
          mode,
          currentCard,
          excludeIds,
          preferredSellers,
          apiKey: env.SERPAPI_KEY,
          purpose: "target",
          searchHint,
          futureHof
        });
        if (result?.suggestion) {
          const shortlist = Array.isArray(result._targetShortlist) && result._targetShortlist.length
            ? result._targetShortlist.slice(0, 5)
            : [result.suggestion];
          delete result._targetShortlist;
          const preliminary = shortlist[0];
          preliminary.marketCheck = await targetRecommendationMarketCheck(preliminary, player, env);
          let selected = preliminary;
          let checksPerformed = 1;
          const alternative = targetRankingAlternative(preliminary, shortlist.slice(1));
          if (alternative && targetShouldMarketCheckAlternative(preliminary, alternative)) {
            alternative.marketCheck = await targetRecommendationMarketCheck(alternative, player, env);
            checksPerformed++;
            selected = targetChooseRecommendation(preliminary, alternative);
          }
          targetFinalizeSelection(selected, preliminary, checksPerformed);
          const ranked = [selected, ...shortlist.filter(candidate => candidate !== selected)].slice(0, 5);
          result.suggestions = ranked.map((candidate, index) => ({ ...candidate, rank: index + 1 }));
          result.suggestion = result.suggestions[0] || selected;
        } else {
          delete result._targetShortlist;
        }
        return json({
          ok: true,
          version: VERSION,
          phase: "6 Find a Target lab",
          provider: "Active eBay listings via SerpApi",
          ...result,
        }, 200, cors);
      } catch (err) {
        console.error(err);
        const status = Number(err?.status) || 502;
        return json({
          ok: false,
          error: err?.code || "find_target_failed",
          message: err?.message || "Scout could not find a target recommendation."
        }, status, cors);
      }
    }

    if (url.pathname === "/deep-price-check" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.APIFY_TOKEN) {
        return json({
          ok: false,
          error: "apify_not_configured",
          message: "Scout's Deep Price Check is not configured in Cloudflare."
        }, 503, cors);
      }

      let body;
      try { body = await request.json(); }
      catch { return json({ ok: false, error: "bad_json" }, 400, cors); }

      const card = body?.card || body;
      const valid = validateCard(card);
      if (!valid.ok) return json({ ok: false, error: "invalid_card", message: valid.message }, 400, cors);

      try {
        const result = await deepPriceCheck(card, env);
        return json({
          ok: true,
          version: VERSION,
          cachePolicy: "on-demand Deep Price Check; not persisted to the normal valuation cache",
          ...result,
        }, 200, cors);
      } catch (err) {
        if (isApifyAuthenticationError(err)) {
          return json({
            ok: false,
            error: "apify_auth_invalid",
            message: "Scout's Deep Price Check needs its Apify connection refreshed."
          }, 502, cors);
        }
        console.error("Deep Price Check failed without exposing provider details.");
        return json({
          ok: false,
          error: "deep_price_check_failed",
          message: "Scout could not complete the Deep Price Check. Try again later."
        }, 502, cors);
      }
    }

    if (url.pathname === "/deals" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SERPAPI_KEY) {
        return json({
          ok: false,
          error: "deal_provider_not_configured",
          message: "Deal Finder needs the existing SERPAPI_KEY configured on the Worker."
        }, 503, cors);
      }

      let body;
      try { body = await request.json(); }
      catch { return json({ ok: false, error: "bad_json" }, 400, cors); }

      const card = body?.card || body;
      const targets = body?.targets || {};
      const valid = validateCard(card);
      if (!valid.ok) return json({ ok: false, error: "invalid_card", message: valid.message }, 400, cors);
      if (!String(card.cardNum || "").trim()) {
        return json({
          ok: false,
          error: "card_number_required",
          message: "Deal Finder needs the card number so Scout can safely match active listings."
        }, 400, cors);
      }

      const targetCheck = validateDealTargets(targets);
      if (!targetCheck.ok) {
        return json({ ok: false, error: "invalid_targets", message: targetCheck.message }, 400, cors);
      }

      try {
        const result = await searchActiveEbayDeals(card, targetCheck.targets, env.SERPAPI_KEY);
        return json({
          ok: true,
          version: VERSION,
          phase: "4A Deal Finder live lab",
          provider: "Active eBay listings via SerpApi",
          ...result,
        }, 200, cors);
      } catch (err) {
        console.error(err);
        const status = Number(err?.status) || 502;
        return json({
          ok: false,
          error: err?.code || "deal_search_failed",
          message: err?.message || "Active listing search failed."
        }, status, cors);
      }
    }


    if (url.pathname === "/card-photo" && ["GET", "POST", "DELETE"].includes(request.method)) {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SCOUT_DATA) {
        return json({ ok: false, error: "cloud_storage_not_configured", message: "SCOUT_DATA KV binding is not configured on the Worker." }, 503, cors);
      }
      const player = normalizeCardPhotoPlayer(url.searchParams.get("player"));
      if (!player) {
        return json({ ok: false, error: "invalid_player", message: "Scout needs a valid Hall of Famer name for the photo." }, 400, cors);
      }
      const key = cardPhotoKey(player);

      if (request.method === "GET") {
        try {
          const stored = await env.SCOUT_DATA.getWithMetadata(key, { type: "arrayBuffer" });
          if (!stored?.value) return json({ ok: false, error: "photo_not_found", message: "No representative card photo is saved for this player." }, 404, cors);
          const metadata = stored.metadata && typeof stored.metadata === "object" ? stored.metadata : {};
          return new Response(stored.value, {
            status: 200,
            headers: {
              ...cors,
              "Content-Type": CARD_PHOTO_TYPES.has(metadata.contentType) ? metadata.contentType : "image/jpeg",
              "Cache-Control": "private, max-age=300",
              "X-Scout-Photo-Fingerprint": String(metadata.fingerprint || ""),
              "X-Scout-Photo-Updated-At": String(metadata.updatedAt || "")
            }
          });
        } catch (err) {
          console.error(err);
          return json({ ok: false, error: "photo_load_failed", message: "Scout could not load that card photo." }, 502, cors);
        }
      }

      if (request.method === "DELETE") {
        try {
          await env.SCOUT_DATA.delete(key);
          return json({ ok: true, version: VERSION, player }, 200, cors);
        } catch (err) {
          console.error(err);
          return json({ ok: false, error: "photo_delete_failed", message: "Scout could not remove that card photo." }, 502, cors);
        }
      }

      const contentType = String(request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
      if (!CARD_PHOTO_TYPES.has(contentType)) {
        return json({ ok: false, error: "invalid_photo_type", message: "Scout accepts JPEG, PNG, or WebP card photos." }, 415, cors);
      }
      let bytes;
      try { bytes = await request.arrayBuffer(); }
      catch { return json({ ok: false, error: "photo_read_failed", message: "Scout could not read that card photo." }, 400, cors); }
      if (!bytes.byteLength || bytes.byteLength > CARD_PHOTO_MAX_BYTES) {
        return json({ ok: false, error: "photo_too_large", message: "That card photo is too large after compression. Please try another photo." }, 413, cors);
      }
      const fingerprint = normalizeCardPhotoFingerprint(request.headers.get("X-Scout-Card-Fingerprint"));
      const updatedAt = new Date().toISOString();
      try {
        await env.SCOUT_DATA.put(key, bytes, { metadata: { contentType, fingerprint, updatedAt, bytes: bytes.byteLength } });
        return json({ ok: true, version: VERSION, player, updatedAt, bytes: bytes.byteLength }, 200, cors);
      } catch (err) {
        console.error(err);
        return json({ ok: false, error: "photo_save_failed", message: "Scout could not save that card photo." }, 502, cors);
      }
    }


    if (url.pathname === "/collection/load" && request.method === "GET") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SCOUT_DATA) {
        return json({
          ok: false,
          error: "cloud_storage_not_configured",
          message: "SCOUT_DATA KV binding is not configured on the Worker."
        }, 503, cors);
      }

      try {
        const saved = await env.SCOUT_DATA.get(COLLECTION_KV_KEY, { type: "json" });
        if (!saved) {
          return json({
            ok: true,
            version: VERSION,
            found: false,
            message: "No Scout cloud backup exists yet."
          }, 200, cors);
        }

        return json({
          ok: true,
          version: VERSION,
          found: true,
          schema: Number(saved.schema) || 1,
          savedAt: saved.savedAt || null,
          clientUpdatedAt: saved.clientUpdatedAt || null,
          playerCount: saved.playerUpdates && typeof saved.playerUpdates === "object"
            ? Object.keys(saved.playerUpdates).length
            : 0,
          playerUpdates: saved.playerUpdates && typeof saved.playerUpdates === "object"
            ? saved.playerUpdates
            : {},
          monthlyPick: saved.monthlyPick && typeof saved.monthlyPick === "object" && !Array.isArray(saved.monthlyPick)
            ? saved.monthlyPick
            : null,
          futureHof: saved.futureHof && typeof saved.futureHof === "object" && !Array.isArray(saved.futureHof)
            ? saved.futureHof
            : null
        }, 200, cors);
      } catch (err) {
        console.error(err);
        return json({
          ok: false,
          error: "cloud_load_failed",
          message: err?.message || "Scout could not load the cloud backup."
        }, 502, cors);
      }
    }

    if (url.pathname === "/collection/save" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SCOUT_DATA) {
        return json({
          ok: false,
          error: "cloud_storage_not_configured",
          message: "SCOUT_DATA KV binding is not configured on the Worker."
        }, 503, cors);
      }

      let body;
      try { body = await request.json(); }
      catch { return json({ ok: false, error: "bad_json", message: "Cloud backup payload is not valid JSON." }, 400, cors); }

      const playerUpdates = body?.playerUpdates;
      if (!playerUpdates || typeof playerUpdates !== "object" || Array.isArray(playerUpdates)) {
        return json({
          ok: false,
          error: "invalid_collection",
          message: "playerUpdates must be an object keyed by Hall of Famer name."
        }, 400, cors);
      }

      const monthlyPick = body?.monthlyPick == null
        ? null
        : (typeof body.monthlyPick === "object" && !Array.isArray(body.monthlyPick) ? body.monthlyPick : undefined);
      if (body?.monthlyPick != null && monthlyPick === undefined) {
        return json({
          ok: false,
          error: "invalid_monthly_pick",
          message: "monthlyPick must be an object or null."
        }, 400, cors);
      }

      const futureHof = body?.futureHof == null
        ? null
        : (typeof body.futureHof === "object" && !Array.isArray(body.futureHof) ? body.futureHof : undefined);
      if (body?.futureHof != null && futureHof === undefined) {
        return json({
          ok: false,
          error: "invalid_future_hof",
          message: "futureHof must be an object or null."
        }, 400, cors);
      }

      const playerCount = Object.keys(playerUpdates).length;
      if (playerCount > COLLECTION_MAX_PLAYERS) {
        return json({
          ok: false,
          error: "collection_too_large",
          message: "Scout received more player records than expected."
        }, 413, cors);
      }

      const record = {
        schema: 3,
        savedAt: new Date().toISOString(),
        clientUpdatedAt: body?.clientUpdatedAt || null,
        appVersion: body?.appVersion || null,
        playerUpdates,
        monthlyPick,
        futureHof
      };
      const serialized = JSON.stringify(record);

      if (new TextEncoder().encode(serialized).byteLength > COLLECTION_MAX_BYTES) {
        return json({
          ok: false,
          error: "collection_too_large",
          message: "Scout cloud backup is larger than the allowed safety limit."
        }, 413, cors);
      }

      try {
        await env.SCOUT_DATA.put(COLLECTION_KV_KEY, serialized);
        return json({
          ok: true,
          version: VERSION,
          savedAt: record.savedAt,
          playerCount,
          bytes: new TextEncoder().encode(serialized).byteLength
        }, 200, cors);
      } catch (err) {
        console.error(err);
        return json({
          ok: false,
          error: "cloud_save_failed",
          message: err?.message || "Scout could not save the cloud backup."
        }, 502, cors);
      }
    }

    if (url.pathname !== "/value" || request.method !== "POST") {
      return json({ ok: false, error: "not_found" }, 404, cors);
    }

    const supplied = request.headers.get("X-Scout-Key") || "";
    if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
      return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
    }
    if (!env.SERPAPI_KEY && !env.CARD_API_KEY && !env.APIFY_TOKEN) {
      return json({
        ok: false,
        error: "provider_not_configured",
        message: "No SerpApi, The Card API, or Apify sold-comps provider is configured on the Worker."
      }, 503, cors);
    }

    let card;
    try { card = await request.json(); }
    catch { return json({ ok: false, error: "bad_json" }, 400, cors); }

    const valid = validateCard(card);
    if (!valid.ok) return json({ ok: false, error: "invalid_card", message: valid.message }, 400, cors);

    try {
      const fastMode = Boolean(card.fastMode);
      const result = await getValuationWithCache(card, env, fastMode, ctx);
      return json({ ok: true, version: VERSION, ...result }, 200, cors);
    } catch (err) {
      console.error(err);
      return json({ ok: false, error: "valuation_failed", message: err?.message || "Valuation failed." }, 502, cors);
    }
  },
  async scheduled(controller, env, ctx) {
    const now = new Date(Number(controller?.scheduledTime) || Date.now());
    const task = runScheduledAutomation(env, now).catch(err => console.error("Scheduled Scout automation failed", err));
    if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(task);
    else await task;
  },
};

function automationMonthKey(now=new Date()) {
  return now.toISOString().slice(0, 7);
}

function automationClampInt(value, min, max, fallback) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function normalizeAutomationSettings(input={}) {
  return {
    monthlySerpCap: automationClampInt(input?.monthlySerpCap, 1, 500, AUTOMATION_DEFAULT_SETTINGS.monthlySerpCap),
    targetMonitoringEnabled: input?.targetMonitoringEnabled !== false,
    targetCadenceDays: automationClampInt(input?.targetCadenceDays, 1, 30, AUTOMATION_DEFAULT_SETTINGS.targetCadenceDays),
    collectionRefreshEnabled: input?.collectionRefreshEnabled !== false,
    collectionCardsPerMonth: automationClampInt(input?.collectionCardsPerMonth, 0, 100, AUTOMATION_DEFAULT_SETTINGS.collectionCardsPerMonth),
  };
}

function normalizeAutomationUsage(raw={}, period=automationMonthKey()) {
  if (String(raw?.period || "") !== period) {
    return { period, serpSuccessful: 0, cardApiRequests: 0, apifyRuns: 0, collectionCardsChecked: 0 };
  }
  return {
    period,
    serpSuccessful: Math.max(0, Math.floor(Number(raw?.serpSuccessful) || 0)),
    cardApiRequests: Math.max(0, Math.floor(Number(raw?.cardApiRequests) || 0)),
    apifyRuns: Math.max(0, Math.floor(Number(raw?.apifyRuns) || 0)),
    collectionCardsChecked: Math.max(0, Math.floor(Number(raw?.collectionCardsChecked) || 0)),
  };
}

function normalizeAutomationState(raw={}) {
  const period = automationMonthKey();
  return {
    schema: 3,
    settings: normalizeAutomationSettings(raw?.settings || AUTOMATION_DEFAULT_SETTINGS),
    usage: normalizeAutomationUsage(raw?.usage || {}, period),
    alerts: Array.isArray(raw?.alerts) ? raw.alerts.slice(-50) : [],
    activity: Array.isArray(raw?.activity) ? raw.activity.slice(-50) : [],
    targetChecks: raw?.targetChecks && typeof raw.targetChecks === "object" && !Array.isArray(raw.targetChecks) ? raw.targetChecks : {},
    collectionChecks: raw?.collectionChecks && typeof raw.collectionChecks === "object" && !Array.isArray(raw.collectionChecks) ? raw.collectionChecks : {},
    collectionCooldownUntil: raw?.collectionCooldownUntil || "",
    lastRunAt: raw?.lastRunAt || "",
    updatedAt: raw?.updatedAt || "",
  };
}

function automationSerpRemaining(state) {
  const normalized = normalizeAutomationState(state);
  return Math.max(0, normalized.settings.monthlySerpCap - normalized.usage.serpSuccessful);
}

function automationCanSpendSerp(state, count=1) {
  const needed = Math.max(0, Math.floor(Number(count) || 0));
  return automationSerpRemaining(state) >= needed;
}

function automationReserveSerp(state, count=1) {
  const normalized = normalizeAutomationState(state);
  const needed = Math.max(0, Math.floor(Number(count) || 0));
  if (!automationCanSpendSerp(normalized, needed)) return { ok: false, state: normalized };
  normalized.usage.serpSuccessful += needed;
  return { ok: true, state: normalized };
}

function automationPublicState(state) {
  const normalized = normalizeAutomationState(state);
  return {
    schema: normalized.schema,
    period: normalized.usage.period,
    settings: normalized.settings,
    usage: normalized.usage,
    remaining: { serpSuccessful: automationSerpRemaining(normalized) },
    lastRunAt: normalized.lastRunAt || null,
    updatedAt: normalized.updatedAt || null,
    alerts: normalized.alerts.slice(-20),
    activity: normalized.activity.slice(-30),
    note: "Saved-target monitoring and paced collection-value rotation are scheduled under the same hard monthly search cap.",
  };
}

function pushBase64UrlBytes(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pushBase64UrlText(text) {
  return pushBase64UrlBytes(new TextEncoder().encode(String(text || "")));
}

async function pushGetOrCreateVapid(kv) {
  let existing = null;
  try { existing = await kv.get(PUSH_VAPID_KEY, { type: "json" }); } catch {}
  if (existing?.publicKey && existing?.privateJwk) return existing;
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const rawPublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const record = { schema: 1, publicKey: pushBase64UrlBytes(rawPublic), privateJwk, publicJwk, createdAt: new Date().toISOString() };
  await kv.put(PUSH_VAPID_KEY, JSON.stringify(record));
  return record;
}

function pushNormalizeToken(value) {
  const token = String(value || "").trim();
  return /^[A-Za-z0-9_-]{20,160}$/.test(token) ? token : "";
}

function pushNormalizeSubscription(value) {
  const endpoint = String(value?.endpoint || "").trim();
  if (!endpoint || endpoint.length > 1400) throw new Error("This phone returned an invalid push endpoint.");
  let parsed;
  try { parsed = new URL(endpoint); } catch { throw new Error("This phone returned an invalid push endpoint."); }
  if (parsed.protocol !== "https:") throw new Error("Scout only accepts secure push endpoints.");
  return {
    endpoint,
    expirationTime: Number.isFinite(Number(value?.expirationTime)) ? Number(value.expirationTime) : null,
    keys: {
      p256dh: automationText(value?.keys?.p256dh, 300),
      auth: automationText(value?.keys?.auth, 200),
    },
  };
}

async function pushReadSubscriptions(kv) {
  let raw = null;
  try { raw = await kv.get(PUSH_SUBSCRIPTIONS_KEY, { type: "json" }); } catch {}
  if (!Array.isArray(raw)) return [];
  return raw.filter(row => pushNormalizeToken(row?.deviceToken) && row?.subscription?.endpoint).slice(-PUSH_MAX_SUBSCRIPTIONS);
}

async function pushWriteSubscriptions(kv, rows) {
  const safe = Array.isArray(rows) ? rows.slice(-PUSH_MAX_SUBSCRIPTIONS) : [];
  await kv.put(PUSH_SUBSCRIPTIONS_KEY, JSON.stringify(safe));
  return safe;
}

async function pushSaveSubscription(kv, tokenValue, subscriptionValue) {
  const deviceToken = pushNormalizeToken(tokenValue);
  if (!deviceToken) throw new Error("Scout could not create a secure device token.");
  const subscription = pushNormalizeSubscription(subscriptionValue);
  const now = new Date().toISOString();
  const rows = await pushReadSubscriptions(kv);
  const previous = rows.find(row => row.deviceToken === deviceToken || row.subscription?.endpoint === subscription.endpoint);
  const next = [...rows.filter(row => row.deviceToken !== deviceToken && row.subscription?.endpoint !== subscription.endpoint), {
    deviceToken,
    subscription,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  }].slice(-PUSH_MAX_SUBSCRIPTIONS);
  await pushWriteSubscriptions(kv, next);
  return { deviceToken, subscriptionCount: next.length };
}

async function pushRemoveSubscription(kv, tokenValue) {
  const deviceToken = pushNormalizeToken(tokenValue);
  const rows = await pushReadSubscriptions(kv);
  const next = deviceToken ? rows.filter(row => row.deviceToken !== deviceToken) : rows;
  if (next.length !== rows.length) await pushWriteSubscriptions(kv, next);
  return next.length;
}

async function pushVapidJwt(endpoint, vapid) {
  const aud = new URL(endpoint).origin;
  const header = pushBase64UrlText(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = pushBase64UrlText(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: "https://beladiel.github.io/hof-card-scout/" }));
  const signingInput = `${header}.${claims}`;
  const key = await crypto.subtle.importKey("jwk", vapid.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(signingInput)));
  return `${signingInput}.${pushBase64UrlBytes(signature)}`;
}

async function pushSendEndpoint(endpoint, vapid) {
  const jwt = await pushVapidJwt(endpoint, vapid);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "TTL": "300",
      "Urgency": "normal",
      "Authorization": `vapid t=${jwt}, k=${vapid.publicKey}`,
    },
  });
  return { ok: response.ok, status: response.status, stale: response.status === 404 || response.status === 410 };
}

function pushActivityPayload(activity) {
  if (!activity) return { id: "ready", title: "HOF Card Scout notifications are ready", body: "Future real automated searches will send a recap here.", url: "./?automation=1" };
  const player = automationText(activity.player, 120) || "Scout search";
  let title = `🔎 Scout checked ${player}`;
  if (activity.outcome === "deal-found") title = `🎯 Target deal — ${player}`;
  else if (activity.outcome === "value-updated") title = `📈 Value updated — ${player}`;
  else if (activity.outcome === "error") title = `⚠️ Scout search issue — ${player}`;
  return {
    id: automationText(activity.id, 220) || activity.at || "activity",
    title,
    body: automationText(activity.summary || "Automated search completed.", 320),
    url: "./?automation=1",
  };
}

async function pushNotifySubscribers(env, state) {
  if (!env?.SCOUT_DATA) return { sent: 0, failed: 0 };
  const rows = await pushReadSubscriptions(env.SCOUT_DATA);
  if (!rows.length) return { sent: 0, failed: 0 };
  const vapid = await pushGetOrCreateVapid(env.SCOUT_DATA);
  let sent = 0, failed = 0, changed = false;
  const keep = [];
  for (const row of rows) {
    try {
      const result = await pushSendEndpoint(row.subscription.endpoint, vapid);
      if (result.stale) { changed = true; continue; }
      if (result.ok) sent++; else failed++;
      keep.push(row);
    } catch (err) {
      console.error("Scout push send failed", err);
      failed++;
      keep.push(row);
    }
  }
  if (changed) await pushWriteSubscriptions(env.SCOUT_DATA, keep);
  return { sent, failed };
}

async function pushSendTest(env, tokenValue) {
  const deviceToken = pushNormalizeToken(tokenValue);
  if (!deviceToken) throw new Error("This phone is not registered for Scout notifications.");
  const rows = await pushReadSubscriptions(env.SCOUT_DATA);
  const row = rows.find(item => item.deviceToken === deviceToken);
  if (!row) throw new Error("This phone is not registered for Scout notifications.");
  const vapid = await pushGetOrCreateVapid(env.SCOUT_DATA);
  const result = await pushSendEndpoint(row.subscription.endpoint, vapid);
  if (result.stale) {
    await pushWriteSubscriptions(env.SCOUT_DATA, rows.filter(item => item.deviceToken !== deviceToken));
    throw new Error("This phone's old notification subscription expired. Enable notifications again.");
  }
  if (!result.ok) throw new Error(`Push service returned ${result.status}.`);
  return { sent: 1 };
}

function automationActivityMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "";
}

function automationRecordActivity(inputState, kind, result, now=new Date(), source="scheduled") {
  const state = normalizeAutomationState(inputState || {});
  const searchUsed = Math.max(0, Math.floor(Number(result?.searchUsed) || 0));
  if (searchUsed < 1) return state;

  const at = (now instanceof Date ? now : new Date(now || Date.now())).toISOString();
  const safeKind = kind === "collection" ? "collection" : "target";
  const player = automationText(safeKind === "target" ? result?.target?.name : result?.card?.name, 120) || (safeKind === "target" ? "Saved target" : "Collection card");
  let outcome = "checked";
  let summary = automationText(result?.message || "Search completed.", 320);
  let updated = false;
  let listingUrl = "";
  let value = null;
  let delivered = null;
  let maxPrice = null;

  if (safeKind === "target") {
    maxPrice = Number.isFinite(Number(result?.target?.maxPrice)) ? Number(result.target.maxPrice) : null;
    if (result?.status === "error") {
      outcome = "error";
      summary = automationText(result?.message || `${player} target search failed after one protected search.`, 320);
    } else if (result?.alert) {
      outcome = "deal-found";
      delivered = Number.isFinite(Number(result.alert.delivered)) ? Number(result.alert.delivered) : null;
      maxPrice = Number.isFinite(Number(result.alert.maxPrice)) ? Number(result.alert.maxPrice) : maxPrice;
      listingUrl = automationText(result.alert.listingUrl, 500);
      summary = `Found ${automationActivityMoney(delivered) || "an affordable listing"}${maxPrice !== null ? ` delivered vs. your ${automationActivityMoney(maxPrice)} max` : ""}.`;
    } else {
      outcome = "checked-no-deal";
      summary = `${player} was checked${maxPrice !== null ? ` against your ${automationActivityMoney(maxPrice)} max` : ""}; no qualifying listing was found.`;
    }
  } else {
    value = Number.isFinite(Number(result?.valuation?.median)) ? Number(result.valuation.median) : null;
    if (result?.status === "error") {
      outcome = "error";
      summary = automationText(result?.message || `${player} value search failed after one protected search.`, 320);
    } else if (result?.saved) {
      updated = result?.persisted !== false;
      outcome = updated ? "value-updated" : "value-found-not-saved";
      const comps = Math.max(0, Math.floor(Number(result?.valuation?.used) || 0));
      summary = updated
        ? `${player} value updated${value !== null ? ` to ${automationActivityMoney(value)}` : ""}${comps ? ` using ${comps} comps` : ""}.`
        : `${player} produced a reliable value${value !== null ? ` of ${automationActivityMoney(value)}` : ""}, but Scout could not save it to cloud history.`;
    } else {
      outcome = "checked-no-update";
      summary = automationText(result?.message || `${player} was checked, but the evidence was not strong enough to update its value.`, 320);
    }
  }

  const entry = {
    id: `${at}|${safeKind}|${player}|${state.activity.length}`,
    at,
    source: source === "manual-test" ? "manual-test" : "scheduled",
    kind: safeKind,
    player,
    searchUsed,
    outcome,
    summary,
    updated,
    value,
    delivered,
    maxPrice,
    listingUrl,
  };
  state.activity = [...state.activity, entry].slice(-50);
  return state;
}

async function readAutomationState(kv) {
  const raw = await kv.get(AUTOMATION_STATE_KEY, { type: "json" });
  return normalizeAutomationState(raw || {});
}

async function writeAutomationState(kv, state) {
  const normalized = normalizeAutomationState(state);
  normalized.updatedAt = state?.updatedAt || new Date().toISOString();
  await kv.put(AUTOMATION_STATE_KEY, JSON.stringify(normalized));
  return normalized;
}

function automationText(value, max=220) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function automationNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeAutomationCatalogEntry(raw={}, kind="official") {
  return {
    kind: kind === "future" ? "future" : "official",
    name: automationText(raw?.name, 120),
    owned: Boolean(raw?.owned),
    incoming: Boolean(raw?.incoming),
    cardYear: automationNumber(raw?.cardYear),
    set: automationText(raw?.set, 180),
    cardNum: automationText(raw?.cardNum, 80),
    grader: automationText(raw?.grader || "Raw", 40) || "Raw",
    gradeCondition: automationText(raw?.gradeCondition, 40),
    autograph: Boolean(raw?.autograph),
    relic: Boolean(raw?.relic),
    serial: automationText(raw?.serial, 80),
    cardKey: automationText(raw?.cardKey, 40),
    median: automationNumber(raw?.median),
    low: automationNumber(raw?.low),
    high: automationNumber(raw?.high),
    comps: automationNumber(raw?.comps),
    confidence: automationText(raw?.confidence, 40),
    lastChecked: automationText(raw?.lastChecked, 80),
    valuationUpdatedAt: automationText(raw?.valuationUpdatedAt, 80),
    valuationCardKey: automationText(raw?.valuationCardKey, 40),
    valuationHistory: Array.isArray(raw?.valuationHistory) ? raw.valuationHistory.slice(-24) : [],
    target: automationText(raw?.target, 260),
    targetNotes: automationText(raw?.targetNotes, 500),
    targetYear: automationNumber(raw?.targetYear),
    targetSet: automationText(raw?.targetSet, 180),
    targetCardNum: automationText(raw?.targetCardNum, 80),
    targetGrader: automationText(raw?.targetGrader || "Any / Raw OK", 60) || "Any / Raw OK",
    targetGrade: automationText(raw?.targetGrade, 40),
    targetAutoPreference: automationText(raw?.targetAutoPreference || "No preference", 80) || "No preference",
    targetMaxPrice: automationNumber(raw?.targetMaxPrice),
    targetListingUrl: automationText(raw?.targetListingUrl, 500),
    targetSource: automationText(raw?.targetSource, 120),
    targetUpdatedAt: automationText(raw?.targetUpdatedAt, 80),
  };
}

function normalizeAutomationCatalog(raw={}) {
  const official = (Array.isArray(raw?.official) ? raw.official : []).slice(0, 500).map(x => normalizeAutomationCatalogEntry(x, "official")).filter(x => x.name);
  const future = (Array.isArray(raw?.future) ? raw.future : []).slice(0, 100).map(x => normalizeAutomationCatalogEntry(x, "future")).filter(x => x.name);
  return { schema: 1, generatedAt: automationText(raw?.generatedAt, 80) || new Date().toISOString(), official, future };
}

async function readAutomationCatalog(kv) {
  const raw = await kv.get(AUTOMATION_CATALOG_KEY, { type: "json" });
  return normalizeAutomationCatalog(raw || {});
}

async function writeAutomationCatalog(kv, catalog) {
  const normalized = normalizeAutomationCatalog(catalog || {});
  const serialized = JSON.stringify(normalized);
  if (new TextEncoder().encode(serialized).byteLength > AUTOMATION_CATALOG_MAX_BYTES) {
    throw new Error("Automation catalog is larger than Scout allows.");
  }
  await kv.put(AUTOMATION_CATALOG_KEY, serialized);
  return normalized;
}

function automationCatalogSummary(catalog) {
  const normalized = normalizeAutomationCatalog(catalog || {});
  const targets = [...normalized.official, ...normalized.future].filter(x => x.target && !x.incoming).length;
  return { catalogGeneratedAt: normalized.generatedAt || null, ownedCards: normalized.official.filter(x => x.owned).length, targets };
}

function automationTargetKey(target) {
  return [target.kind, target.name, target.targetYear || "", target.targetSet || "", target.targetCardNum || "", target.targetGrader || "", target.targetGrade || ""].join("|").toLowerCase();
}

function automationTargetSearchHint(target) {
  const bits = [target.targetYear, target.targetSet, target.targetCardNum ? `#${target.targetCardNum}` : ""];
  const grader = automationText(target.targetGrader);
  if (grader && grader !== "Any / Raw OK") bits.push(grader);
  if (target.targetGrade) bits.push(target.targetGrade);
  if (target.targetAutoPreference === "Autograph required") bits.push("autograph");
  return bits.filter(Boolean).join(" ").trim();
}

function automationCurrentCard(target) {
  if (!target.owned) return null;
  return {
    cardYear: target.cardYear || null, year: target.cardYear || null, set: target.set || "", cardNum: target.cardNum || "",
    description: "", notes: "", grader: target.grader || "Raw", grade: target.gradeCondition || "", gradeCondition: target.gradeCondition || "",
    autograph: Boolean(target.autograph), relic: Boolean(target.relic), serial: target.serial || ""
  };
}

function automationEligibleTargets(catalog) {
  const normalized = normalizeAutomationCatalog(catalog || {});
  return [...normalized.official, ...normalized.future].filter(x => {
    const max = Number(x.targetMaxPrice);
    return Boolean(x.target) && !x.incoming && Number.isFinite(max) && max > 0 && Number.isFinite(Number(x.targetYear)) && Boolean(x.targetSet);
  });
}

function automationChooseTarget(catalog, state, options={}) {
  let targets = automationEligibleTargets(catalog);
  if (!targets.length) return null;
  const checks = state?.targetChecks && typeof state.targetChecks === "object" ? state.targetChecks : {};
  if (options?.dueOnly) {
    const now = options?.now instanceof Date ? options.now : new Date(options?.now || Date.now());
    const cadenceDays = Math.max(1, Number(state?.settings?.targetCadenceDays) || 7);
    const cadenceMs = cadenceDays * 24 * 60 * 60 * 1000;
    targets = targets.filter(target => {
      const last = Date.parse(checks[automationTargetKey(target)] || "") || 0;
      return !last || now.getTime() - last >= cadenceMs;
    });
    if (!targets.length) return null;
  }
  targets.sort((a,b) => {
    const at = Date.parse(checks[automationTargetKey(a)] || "") || 0;
    const bt = Date.parse(checks[automationTargetKey(b)] || "") || 0;
    return at - bt || a.name.localeCompare(b.name);
  });
  return targets[0];
}

function automationAlertFromSuggestion(target, suggestion, now) {
  if (!suggestion) return null;
  const delivered = Number(suggestion.delivered);
  const maxPrice = Number(target.targetMaxPrice);
  if (!Number.isFinite(delivered) || !Number.isFinite(maxPrice) || delivered > maxPrice) return null;
  const listingUrl = automationText(suggestion.link || suggestion.url || suggestion.listingUrl, 500);
  const listingId = automationText(suggestion.productId || suggestion.id || listingUrl, 220);
  return {
    id: `${automationTargetKey(target)}|${listingId || now.toISOString().slice(0,10)}`,
    targetKey: automationTargetKey(target), player: target.name,
    cardLabel: [suggestion.year || target.targetYear, suggestion.set || target.targetSet, (suggestion.cardNum || target.targetCardNum) ? `#${suggestion.cardNum || target.targetCardNum}` : ""].filter(Boolean).join(" "),
    delivered: Math.round(delivered * 100) / 100, maxPrice: Math.round(maxPrice * 100) / 100,
    listingUrl, seller: automationText(suggestion?.seller?.username || suggestion?.seller || "", 120),
    foundAt: now.toISOString(), tier: delivered <= maxPrice * 0.85 ? "unusually-affordable" : "under-max"
  };
}

async function runOneAutomationTargetCheck(env, inputState, catalog, now=new Date(), options={}) {
  let state = normalizeAutomationState(inputState || {});
  if (!state.settings.targetMonitoringEnabled) return { state, result: { status: "skipped", searchUsed: 0, message: "Saved-target monitoring is turned off in your guardrails." } };
  if (!env.SERPAPI_KEY) return { state, result: { status: "skipped", searchUsed: 0, message: "SerpApi is not configured, so Scout used zero searches." } };
  const target = automationChooseTarget(catalog, state, { dueOnly: Boolean(options?.dueOnly), now });
  if (!target) return { state, result: { status: "skipped", searchUsed: 0, message: options?.dueOnly ? "No saved target is due yet. Scout used zero searches." : "No saved target has enough identity plus a maximum price for an automatic affordability check." } };
  const reserved = automationReserveSerp(state, 1);
  if (!reserved.ok) return { state: reserved.state, result: { status: "skipped", searchUsed: 0, message: "Monthly automatic-search cap reached. Scout stopped without searching." } };
  state = reserved.state;
  const key = automationTargetKey(target);
  state.targetChecks[key] = now.toISOString();
  state.lastRunAt = now.toISOString();
  let result;
  try {
    const market = await searchMonthlyPickListing({
      player: target.name, budget: Number(target.targetMaxPrice), mode: target.owned ? "upgrade" : "need", currentCard: automationCurrentCard(target),
      excludeIds: [], preferredSellers: [], apiKey: env.SERPAPI_KEY, purpose: "target", searchHint: automationTargetSearchHint(target), futureHof: target.kind === "future", maxQueries: 1
    });
    const suggestion = market?.suggestion || (Array.isArray(market?.suggestions) ? market.suggestions[0] : null);
    const alert = automationAlertFromSuggestion(target, suggestion, now);
    if (alert) {
      state.alerts = [...state.alerts.filter(x => x?.id !== alert.id), alert].slice(-50);
    }
    result = { status: "checked", searchUsed: 1, target: { name: target.name, label: target.target, maxPrice: Number(target.targetMaxPrice) }, alert };
  } catch (err) {
    result = { status: "error", searchUsed: 1, target: { name: target.name, label: target.target, maxPrice: Number(target.targetMaxPrice) }, message: err?.message || "Protected target search failed." };
  }
  state.updatedAt = now.toISOString();
  return { state, result };
}

const AUTOMATION_COLLECTION_MIN_GAP_MS = 3 * 24 * 60 * 60 * 1000;
const AUTOMATION_COLLECTION_TIMEOUT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function automationLatestCollectionCheckMs(state) {
  const checks = state?.collectionChecks && typeof state.collectionChecks === "object" ? state.collectionChecks : {};
  const stamps = Object.values(checks).map(v => Date.parse(v || "") || 0);
  return stamps.length ? Math.max(0, ...stamps) : 0;
}

function automationCollectionNextAllowedAt(state, now=new Date()) {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const latest = automationLatestCollectionCheckMs(state);
  const pacedUntil = latest ? latest + AUTOMATION_COLLECTION_MIN_GAP_MS : 0;
  const cooldownUntil = Date.parse(state?.collectionCooldownUntil || "") || 0;
  const next = Math.max(pacedUntil, cooldownUntil);
  return Number.isFinite(nowMs) && next > nowMs ? new Date(next) : null;
}

function automationCollectionKey(entry) {
  return [entry?.kind || "official", entry?.name || "", entry?.cardKey || ""].join("|").toLowerCase();
}

function automationEligibleCollectionCards(catalog) {
  const normalized = normalizeAutomationCatalog(catalog || {});
  return normalized.official.filter(entry =>
    entry.owned === true &&
    Number.isInteger(Number(entry.cardYear)) &&
    Boolean(entry.set) &&
    Boolean(entry.cardNum) &&
    Boolean(entry.cardKey)
  );
}

function automationHasCurrentCollectionValue(entry) {
  return Boolean(entry?.cardKey) &&
    entry.valuationCardKey === entry.cardKey &&
    Number.isFinite(Number(entry.median)) && Number(entry.median) > 0;
}

function automationChooseCollectionCard(catalog, state) {
  const cards = automationEligibleCollectionCards(catalog);
  if (!cards.length) return null;
  const checks = state?.collectionChecks && typeof state.collectionChecks === "object" ? state.collectionChecks : {};
  cards.sort((a,b) => {
    const av = automationHasCurrentCollectionValue(a) ? 1 : 0;
    const bv = automationHasCurrentCollectionValue(b) ? 1 : 0;
    if (av !== bv) return av - bv;
    const at = Date.parse(checks[automationCollectionKey(a)] || "") || 0;
    const bt = Date.parse(checks[automationCollectionKey(b)] || "") || 0;
    return at - bt || a.name.localeCompare(b.name);
  });
  return cards[0];
}

function automationCollectionCard(entry) {
  return {
    player: entry.name,
    year: Number(entry.cardYear),
    set: entry.set || "",
    cardNum: entry.cardNum || "",
    grader: entry.grader || "Raw",
    grade: entry.gradeCondition || "",
    autograph: Boolean(entry.autograph),
    relic: Boolean(entry.relic),
    serial: entry.serial || "",
    notes: "",
    shopPrice: null,
    fastMode: true,
  };
}

function automationReliableCollectionValuation(value) {
  const median = Number(value?.median);
  const used = valuationEvidenceCount(value);
  const confidence = String(value?.confidence || "insufficient").toLowerCase();
  return Number.isFinite(median) && median > 0 && used >= 2 && confidence !== "insufficient";
}

function automationCollectionValuationResult(value) {
  return {
    median: Number.isFinite(Number(value?.median)) ? Number(value.median) : null,
    low: Number.isFinite(Number(value?.low)) ? Number(value.low) : null,
    high: Number.isFinite(Number(value?.high)) ? Number(value.high) : null,
    used: valuationEvidenceCount(value),
    confidence: String(value?.confidence || "insufficient").toLowerCase(),
    checkedAt: value?.checkedAt || null,
    cacheHit: value?.cacheHit === true,
  };
}

async function runOneAutomationCollectionCheck(env, inputState, catalog, now=new Date()) {
  let state = normalizeAutomationState(inputState || {});
  if (!state.settings.collectionRefreshEnabled) {
    return { state, result: { status: "skipped", searchUsed: 0, message: "Collection-value rotation is turned off in your guardrails." } };
  }
  const nextAllowedAt = automationCollectionNextAllowedAt(state, now);
  if (nextAllowedAt) {
    return { state, result: { status: "skipped", searchUsed: 0, nextEligibleAt: nextAllowedAt.toISOString(), message: `Collection-value automation is pacing itself to protect your search budget. Next eligible check: ${nextAllowedAt.toISOString()}.` } };
  }
  const monthlyLimit = Math.max(0, Number(state.settings.collectionCardsPerMonth) || 0);
  if (monthlyLimit < 1) {
    return { state, result: { status: "skipped", searchUsed: 0, message: "Collection cards/month is set to 0, so Scout used zero searches." } };
  }
  if (Number(state.usage.collectionCardsChecked || 0) >= monthlyLimit) {
    return { state, result: { status: "skipped", searchUsed: 0, message: "This month's collection-card rotation limit is already reached. Scout used zero searches." } };
  }

  const entry = automationChooseCollectionCard(catalog, state);
  if (!entry) {
    return { state, result: { status: "skipped", searchUsed: 0, message: "No owned representative card has enough exact identity for a safe automatic value check." } };
  }

  const card = automationCollectionCard(entry);
  const key = automationCollectionKey(entry);
  state.collectionChecks[key] = now.toISOString();
  state.usage.collectionCardsChecked += 1;
  state.lastRunAt = now.toISOString();

  let valuation = null;
  let searchUsed = 0;
  let cacheHit = false;
  try {
    const cached = await readValuationCache(card, true);
    if (cached?.fresh) {
      valuation = withCurrentShopVerdict(cached.result, card, true);
      cacheHit = true;
    } else {
      if (!env.SERPAPI_KEY) {
        state.updatedAt = now.toISOString();
        return { state, result: { status: "skipped", searchUsed: 0, card: { name: entry.name, cardKey: entry.cardKey }, message: "SerpApi is not configured, so Scout used zero searches." } };
      }
      const reserved = automationReserveSerp(state, 1);
      if (!reserved.ok) {
        state = reserved.state;
        state.updatedAt = now.toISOString();
        return { state, result: { status: "skipped", searchUsed: 0, card: { name: entry.name, cardKey: entry.cardKey }, message: "Monthly automatic-search cap reached. Scout stopped without searching." } };
      }
      state = reserved.state;
      searchUsed = 1;
      const query = buildQuery(card);
      const data = await runEbaySearch(query, env.SERPAPI_KEY, "Sold", false, SERP_SOLD_STRICT_TIMEOUT_MS);
      const raw = Array.isArray(data?.organic_results) ? data.organic_results : [];
      const normalized = dedupeSoldComps(raw.map(normalizeResult).filter(Boolean));
      const evaluation = evaluateComparableResults(normalized, card);
      const notes = buildNotes(card, raw.length, evaluation.matchedItems.length, evaluation.cleaned.length, evaluation.confidence);
      notes.unshift("Automation used one strict SerpApi Sold search only. No broad retry, The Card API, or Apify was allowed.");
      const rawValue = finalizeValuation(card, query, evaluation.matchedItems, {
        provider: "eBay sold results via SerpApi",
        searchMode: "Sold-automation-strict",
        matchMode: evaluation.matchMode,
        searched: raw.length,
        matched: evaluation.matchedItems.length,
        providerDiagnostics: {},
        notes,
        mode: "automation-fast",
        bestOfferRecovered: 0,
        bestOfferRecoveryAttempted: 0,
      });
      valuation = withCurrentShopVerdict(rawValue, card, false);
      if (valuationEvidenceCount(valuation) > 0) {
        await writeValuationCache(card, true, cacheableValuationResult(valuation));
      }
    }

    const saved = automationReliableCollectionValuation(valuation);
    const publicValue = automationCollectionValuationResult(valuation);
    const used = publicValue.used;
    const message = saved
      ? `COLLECTION VALUE READY — ${entry.name} has ${used} reliable sold comp${used === 1 ? "" : "s"}.`
      : `VALUE NOT SAVED — only ${used} reliable sold comp${used === 1 ? "" : "s"}; Scout needs at least 2 before adding collection history.`;
    state.collectionCooldownUntil = "";
    state.updatedAt = now.toISOString();
    return {
      state,
      result: {
        status: "checked",
        searchUsed,
        cacheHit,
        saved,
        checkedAt: now.toISOString(),
        card: {
          name: entry.name,
          cardKey: entry.cardKey,
          label: [entry.cardYear, entry.set, entry.cardNum ? `#${entry.cardNum}` : "", entry.grader && entry.grader !== "Raw" ? `${entry.grader} ${entry.gradeCondition || ""}`.trim() : "Raw"].filter(Boolean).join(" "),
        },
        valuation: publicValue,
        message,
      }
    };
  } catch (err) {
    const rawMessage = err?.message || "Protected collection-value search failed.";
    const timeoutLike = /timed out|timeout|aborted/i.test(rawMessage);
    if (timeoutLike) {
      state.collectionCooldownUntil = new Date(now.getTime() + AUTOMATION_COLLECTION_TIMEOUT_COOLDOWN_MS).toISOString();
    }
    state.updatedAt = now.toISOString();
    return {
      state,
      result: {
        status: "error",
        searchUsed,
        cacheHit,
        saved: false,
        checkedAt: now.toISOString(),
        cooldownUntil: timeoutLike ? state.collectionCooldownUntil : null,
        card: { name: entry.name, cardKey: entry.cardKey },
        message: timeoutLike
          ? `SerpApi timed out. Scout stopped after this one search and paused collection-value automation for 7 days to protect your allowance.`
          : rawMessage
      }
    };
  }
}

function automationCents(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function automationMergeCardHistory(history, snapshot, max=24) {
  const rows = (Array.isArray(history) ? history : [])
    .filter(x => x && x.at && x.cardKey && Number.isFinite(Number(x.value)))
    .map(x => ({ ...x, value: automationCents(x.value) }));
  const day = String(snapshot.at).slice(0, 10);
  const idx = rows.findIndex(x => x.cardKey === snapshot.cardKey && String(x.at).slice(0, 10) === day);
  if (idx >= 0) rows[idx] = snapshot;
  else rows.push(snapshot);
  rows.sort((a,b) => String(a.at).localeCompare(String(b.at)));
  return rows.slice(-Math.max(3, Number(max) || 24));
}

function automationMergeCollectionHistory(history, snapshot, max=48) {
  const rows = (Array.isArray(history) ? history : [])
    .filter(x => x && x.at && Number.isFinite(Number(x.value)) && Number(x.value) > 0)
    .map(x => ({ ...x, value: automationCents(x.value) }));
  const day = String(snapshot.at).slice(0, 10);
  const idx = rows.findIndex(x => String(x.at).slice(0, 10) === day);
  if (idx >= 0) rows[idx] = snapshot;
  else rows.push(snapshot);
  rows.sort((a,b) => String(a.at).localeCompare(String(b.at)));
  return rows.slice(-Math.max(3, Number(max) || 48));
}

function automationApplyValuationToCatalog(catalog, card, valuation, now) {
  const normalized = normalizeAutomationCatalog(catalog || {});
  const entry = normalized.official.find(x => x.name === card?.name && x.cardKey === card?.cardKey);
  if (!entry) return normalized;
  const at = now.toISOString();
  const snapshot = {
    at,
    value: automationCents(valuation?.median),
    low: automationCents(valuation?.low),
    high: automationCents(valuation?.high),
    comps: Math.max(0, Math.floor(Number(valuation?.used) || 0)),
    confidence: automationText(valuation?.confidence || "low", 40).toLowerCase(),
    cardKey: entry.cardKey,
  };
  entry.median = snapshot.value;
  entry.low = snapshot.low;
  entry.high = snapshot.high;
  entry.comps = snapshot.comps;
  entry.confidence = snapshot.confidence;
  entry.lastChecked = now.toLocaleDateString("en-US");
  entry.valuationUpdatedAt = at;
  entry.valuationCardKey = entry.cardKey;
  entry.valuationHistory = automationMergeCardHistory(entry.valuationHistory, snapshot, 24);
  normalized.generatedAt = at;
  return normalized;
}

function automationCollectionSummaryFromCatalog(catalog, playerUpdates={}) {
  const normalized = normalizeAutomationCatalog(catalog || {});
  const owned = normalized.official.filter(x => x.owned);
  const valued = owned.filter(x => x.cardKey && x.valuationCardKey === x.cardKey && Number.isFinite(Number(x.median)) && Number(x.median) > 0);
  let value = 0, matchedCostBasis = 0, matchedCount = 0;
  for (const entry of valued) {
    value += Number(entry.median);
    const paid = playerUpdates?.[entry.name]?.pricePaid;
    if (paid !== null && paid !== undefined && paid !== "" && Number.isFinite(Number(paid)) && Number(paid) >= 0) {
      matchedCostBasis += Number(paid);
      matchedCount++;
    }
  }
  return {
    ownedCount: owned.length,
    valuedCount: valued.length,
    coveragePct: owned.length ? Math.round((valued.length / owned.length) * 1000) / 10 : 0,
    estimatedValue: valued.length ? automationCents(value) : null,
    matchedCostBasis: matchedCount ? automationCents(matchedCostBasis) : null,
    matchedCount,
  };
}

async function automationPersistScheduledValuation(kv, catalog, result, now=new Date()) {
  if (!kv || !result?.saved || !result?.card?.name || !result?.card?.cardKey || !result?.valuation) {
    return { ok: false, catalog: normalizeAutomationCatalog(catalog || {}), reason: "nothing_to_persist" };
  }
  const at = now.toISOString();
  const updatedCatalog = automationApplyValuationToCatalog(catalog, result.card, result.valuation, now);
  const catalogEntry = updatedCatalog.official.find(x => x.name === result.card.name && x.cardKey === result.card.cardKey);
  if (!catalogEntry) return { ok: false, catalog: updatedCatalog, reason: "catalog_card_not_found" };

  const existing = await kv.get(COLLECTION_KV_KEY, { type: "json" });
  const record = existing && typeof existing === "object" ? existing : {};
  const playerUpdates = record.playerUpdates && typeof record.playerUpdates === "object" && !Array.isArray(record.playerUpdates)
    ? { ...record.playerUpdates }
    : {};
  const prior = playerUpdates[catalogEntry.name] && typeof playerUpdates[catalogEntry.name] === "object" && !Array.isArray(playerUpdates[catalogEntry.name])
    ? playerUpdates[catalogEntry.name]
    : {};
  const snapshot = catalogEntry.valuationHistory[catalogEntry.valuationHistory.length - 1];
  playerUpdates[catalogEntry.name] = {
    ...prior,
    median: catalogEntry.median,
    low: catalogEntry.low,
    high: catalogEntry.high,
    comps: catalogEntry.comps,
    confidence: catalogEntry.confidence,
    lastChecked: catalogEntry.lastChecked,
    valuationUpdatedAt: catalogEntry.valuationUpdatedAt,
    valuationCardKey: catalogEntry.valuationCardKey,
    valuationHistory: automationMergeCardHistory(prior.valuationHistory || catalogEntry.valuationHistory, snapshot, 24),
  };

  const summary = automationCollectionSummaryFromCatalog(updatedCatalog, playerUpdates);
  if (Number.isFinite(Number(summary.estimatedValue)) && Number(summary.estimatedValue) > 0 && summary.valuedCount > 0) {
    const meta = playerUpdates[COLLECTION_VALUE_HISTORY_META_KEY] && typeof playerUpdates[COLLECTION_VALUE_HISTORY_META_KEY] === "object" && !Array.isArray(playerUpdates[COLLECTION_VALUE_HISTORY_META_KEY])
      ? playerUpdates[COLLECTION_VALUE_HISTORY_META_KEY]
      : { schema: 1, history: [], updatedAt: "" };
    const collectionSnapshot = {
      at,
      value: summary.estimatedValue,
      valuedCount: summary.valuedCount,
      ownedCount: summary.ownedCount,
      coveragePct: summary.coveragePct,
      matchedCostBasis: summary.matchedCostBasis,
      matchedCount: summary.matchedCount,
    };
    playerUpdates[COLLECTION_VALUE_HISTORY_META_KEY] = {
      schema: 1,
      history: automationMergeCollectionHistory(meta.history, collectionSnapshot, 48),
      updatedAt: at,
    };
  }

  const nextRecord = {
    ...record,
    schema: Math.max(3, Number(record.schema) || 3),
    savedAt: at,
    clientUpdatedAt: at,
    appVersion: record.appVersion || "5.9.0",
    playerUpdates,
    monthlyPick: record.monthlyPick && typeof record.monthlyPick === "object" && !Array.isArray(record.monthlyPick) ? record.monthlyPick : null,
    futureHof: record.futureHof && typeof record.futureHof === "object" && !Array.isArray(record.futureHof) ? record.futureHof : null,
  };
  const serialized = JSON.stringify(nextRecord);
  if (new TextEncoder().encode(serialized).byteLength > COLLECTION_MAX_BYTES) {
    throw new Error("Scout cloud backup is larger than the allowed safety limit after an automatic valuation.");
  }

  await kv.put(COLLECTION_KV_KEY, serialized);
  await writeAutomationCatalog(kv, updatedCatalog);
  return { ok: true, catalog: updatedCatalog, savedAt: at, summary };
}

async function runScheduledAutomation(env, now=new Date()) {
  if (!env?.SCOUT_DATA) return { status: "skipped", searchUsed: 0, message: "SCOUT_DATA is not configured." };
  let state = await readAutomationState(env.SCOUT_DATA);
  let catalog = await readAutomationCatalog(env.SCOUT_DATA);

  // Targets always get first claim on a scheduler wake-up. If a target actually
  // spends the one allowed search, the collection side does not run that day.
  const targetRun = await runOneAutomationTargetCheck(env, state, catalog, now, { dueOnly: true });
  state = targetRun.state;
  if (Number(targetRun.result?.searchUsed) > 0 || targetRun.result?.status === "error") {
    state = automationRecordActivity(state, "target", targetRun.result, now, "scheduled");
    await writeAutomationState(env.SCOUT_DATA, state);
    if (Number(targetRun.result?.searchUsed) > 0) {
      try { await pushNotifySubscribers(env, state); } catch (err) { console.error("Scheduled target push failed", err); }
    }
    return { kind: "target", ...targetRun.result };
  }

  // No due target spent a search. The paced collection runner may now use
  // fresh cache for zero searches or one strict sold search maximum.
  const collectionRun = await runOneAutomationCollectionCheck(env, state, catalog, now);
  state = collectionRun.state;
  if (collectionRun.result?.saved) {
    try {
      const persisted = await automationPersistScheduledValuation(env.SCOUT_DATA, catalog, collectionRun.result, now);
      catalog = persisted.catalog || catalog;
      collectionRun.result.persisted = persisted.ok === true;
      collectionRun.result.collectionSummary = persisted.summary || null;
    } catch (err) {
      console.error("Scheduled collection valuation persistence failed", err);
      collectionRun.result.persisted = false;
      collectionRun.result.persistenceMessage = "Scout found a reliable value but could not save it to cloud history on this run.";
    }
  }
  state = automationRecordActivity(state, "collection", collectionRun.result, now, "scheduled");
  await writeAutomationState(env.SCOUT_DATA, state);
  if (Number(collectionRun.result?.searchUsed) > 0) {
    try { await pushNotifySubscribers(env, state); } catch (err) { console.error("Scheduled collection push failed", err); }
  }
  return { kind: "collection", ...collectionRun.result };
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}


function normalizeCardPhotoPlayer(value) {
  const player = String(value || "").trim().replace(/\s+/g, " ");
  return player.length >= 2 && player.length <= 100 ? player : "";
}

function normalizeCardPhotoFingerprint(value) {
  const fp = String(value || "").trim().toLowerCase();
  return /^[a-f0-9]{8,64}$/.test(fp) ? fp : "";
}

function cardPhotoKey(player) {
  return CARD_PHOTO_PREFIX + encodeURIComponent(String(player || "").trim().toLowerCase());
}

function validateCard(c) {
  if (!c || typeof c !== "object") return { ok: false, message: "Card data is missing." };
  if (!String(c.player || "").trim()) return { ok: false, message: "Player is required." };
  const year = Number(c.year);
  if (!Number.isInteger(year) || year < 1880 || year > new Date().getFullYear() + 1) return { ok: false, message: "A valid card year is required." };
  if (!String(c.set || "").trim()) return { ok: false, message: "Set is required." };
  return { ok: true };
}

function normalizePsaCertNumber(value) {
  const raw = String(value ?? "").trim().replace(/[\s-]+/g, "");
  if (!/^\d{4,12}$/.test(raw)) return "";
  return raw;
}

async function verifyPsaCert(certNumber, token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PSA_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`https://api.psacard.com/publicapi/cert/GetByCertNumber/${encodeURIComponent(certNumber)}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
      },
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      const e = new Error("PSA did not respond within 8 seconds. Please try again.");
      e.code = "psa_timeout";
      e.status = 504;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) {
    return { verified: false, certNumber, message: "PSA returned no certification data for that number." };
  }

  if (response.status === 429) {
    const e = new Error("PSA's 100-call daily API quota has been reached. Try again after PSA resets the daily quota.");
    e.code = "psa_daily_quota";
    e.status = 429;
    throw e;
  }

  if (response.status === 401 || response.status === 403) {
    const e = new Error("PSA rejected the API authorization. Generate a fresh PSA token if this continues after the quota resets.");
    e.code = "psa_auth_rejected";
    e.status = 502;
    throw e;
  }

  let data = null;
  try { data = await response.json(); }
  catch {
    const e = new Error(`PSA returned an unreadable response (HTTP ${response.status}).`);
    e.code = "psa_bad_response";
    e.status = 502;
    throw e;
  }

  if (!response.ok) {
    const e = new Error(response.status >= 500
      ? "PSA rejected the API request or is temporarily unavailable."
      : `PSA request failed (HTTP ${response.status}).`);
    e.code = response.status >= 500 ? "psa_auth_or_server_error" : "psa_http_error";
    e.status = 502;
    throw e;
  }

  const psa = data?.PSACert || data?.PsaCert || data?.psaCert || null;
  const validRequest = data?.IsValidRequest ?? data?.isValidRequest;
  const serverMessage = String(data?.ServerMessage ?? data?.serverMessage ?? "").trim();

  if (validRequest === false) {
    return { verified: false, certNumber, message: serverMessage || "PSA says that certification number is invalid." };
  }
  if (!psa) {
    return { verified: false, certNumber, message: serverMessage || "No PSA certification record was found." };
  }

  const year = firstText(psa.YearIssued, psa.Year, psa.yearIssued, psa.year);
  const brand = firstText(psa.Brand, psa.BrandTitle, psa.brand, psa.brandTitle);
  const variety = firstText(psa.Variety, psa.variety);
  const subject = firstText(psa.Subject, psa.subject);
  const cardNumber = firstText(psa.CardNumber, psa.cardNumber);
  const grade = firstText(psa.CardGrade, psa.Grade, psa.cardGrade, psa.grade);
  const gradeDescription = firstText(psa.GradeDescription, psa.gradeDescription);
  const category = firstText(psa.Category, psa.category);
  const cardAttributes = firstText(psa.CardAttributes, psa.SpecAttr, psa.cardAttributes, psa.specAttr);
  const labelType = firstText(psa.LabelType, psa.labelType);
  const imageUrl = firstText(psa.ImageURL, psa.ImageUrl, psa.imageURL, psa.imageUrl);
  const returnedCert = firstText(psa.CertNumber, psa.CertNo, psa.certNumber, psa.certNo, certNumber);
  const setName = [brand, variety].filter(Boolean).join(" ").trim();

  return {
    verified: true,
    certNumber: returnedCert || certNumber,
    message: serverMessage || "Request successful",
    card: {
      year,
      brand,
      variety,
      set: setName,
      subject,
      cardNumber,
      grade,
      gradeDescription,
      category,
      cardAttributes,
      labelType,
      imageUrl,
    },
    psaUrl: `https://www.psacard.com/cert/${encodeURIComponent(returnedCert || certNumber)}/psa`,
  };
}

function firstText(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function psaCacheKey(certNumber) {
  return new Request(`https://hof-card-scout-cache.invalid/psa?cert=${encodeURIComponent(certNumber)}&v=${encodeURIComponent(VERSION)}`, { method: "GET" });
}

async function readPsaCache(certNumber) {
  try {
    const hit = await caches.default.match(psaCacheKey(certNumber));
    if (!hit) return null;
    return await hit.json();
  } catch {
    return null;
  }
}

async function writePsaCache(certNumber, result) {
  try {
    const response = new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": `public, max-age=${PSA_CACHE_TTL_SECONDS}`,
      }
    });
    await caches.default.put(psaCacheKey(certNumber), response);
  } catch (err) {
    console.warn("PSA cache write failed", err);
  }
}


function buildCardApiQuery(card) {
  const parts = [
    card.year,
    String(card.set || "").trim(),
    String(card.player || "").trim(),
    card.cardNum ? String(card.cardNum).replace(/^#/, "").trim() : "",
  ];
  if (card.autograph) parts.push("autograph");
  if (card.relic) parts.push("relic");
  const denom = serialDenominator(card.serial);
  if (denom) parts.push(`/${denom}`);
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function buildCardApiEbaySoldQuery(card) {
  const parts = [buildCardApiQuery(card)];
  const grader = canonicalGrader(card.grader);
  const grade = normalizeGrade(card.grade, grader);
  if (grader && grader !== "Raw") parts.push(grader, grade);
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function buildCardApiEbayFallbackQuery(card) {
  const playerTokens = normalizeText(card.player).split(" ").filter(Boolean);
  const lastName = playerTokens[playerTokens.length - 1] || "";
  return [
    card.year,
    String(card.set || "").trim(),
    lastName,
    card.cardNum ? String(card.cardNum).replace(/^#/, "").trim() : "",
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function applyCardApiGradingFilters(params, card) {
  const grader = canonicalGrader(card.grader);
  const grade = normalizeGrade(card.grade, grader);
  if (grader === "Raw") {
    params.set("graded", "false");
  } else if (grader) {
    params.set("graded", "true");
    params.set("grader", grader);
    if (grade) params.set("grade", grade);
  }
}

async function fetchCardApiEbaySoldRows(card, query, apiKey, limit, label) {
  const params = new URLSearchParams({
    q: query,
    platform: "ebay",
    sort: "date_desc",
    limit: String(limit),
  });
  applyCardApiGradingFilters(params, card);
  const response = await fetchWithTimeout(
    `https://thecardapi.com/api/v1/market/sales?${params.toString()}`,
    { method: "GET", headers: { "x-market-api-key": apiKey, "Accept": "application/json" } },
    CARD_API_TIMEOUT_MS,
    `${label} timed out`
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(String(payload?.message || payload?.error || `The Card API returned HTTP ${response.status}`));
    err.status = response.status;
    err.code = response.status === 429 ? "cardapi_rate_limit" : "cardapi_http_error";
    throw err;
  }
  return Array.isArray(payload?.data) ? payload.data : [];
}

async function searchCardApiEbaySold(card, apiKey, options={}) {
  const targetEnrichment = options?.targetEnrichment === true;
  const evidenceGoal = targetEnrichment ? Math.max(TARGET_EVIDENCE_GOAL, Number(options?.evidenceGoal) || 0) : 0;
  const query = buildCardApiEbaySoldQuery(card);
  const initialRows = await fetchCardApiEbaySoldRows(
    card,
    query,
    apiKey,
    CARD_API_EBAY_SOLD_LIMIT,
    "The Card API eBay sold search"
  );

  let rows = [...initialRows];
  let normalized = rows
    .map(normalizeCardApiResult)
    .filter(Boolean)
    .filter(item => normalizeText(item.platform) === "ebay");
  const initialEvaluation = evaluateComparableResults(normalized, card, isProductionCardApiComparable);
  let evaluation = initialEvaluation;
  let fallbackQuery = "";
  let fallbackError = "";
  let fallbackRowsReturned = 0;
  let fallbackMatches = 0;
  let fallbackStatus = "not_attempted";

  if (targetEnrichment && evaluation.cleaned.length < evidenceGoal) {
    fallbackQuery = buildCardApiEbayFallbackQuery(card);
    if (fallbackQuery && normalizeText(fallbackQuery) !== normalizeText(query)) {
      const remainingRowBudget = Math.max(0, CARD_API_TARGET_ROW_LIMIT - CARD_API_EBAY_SOLD_LIMIT);
      const fallbackLimit = Math.min(CARD_API_EBAY_FALLBACK_LIMIT, remainingRowBudget);
      if (fallbackLimit > 0) {
        fallbackStatus = "started";
        try {
          const fallbackRows = await fetchCardApiEbaySoldRows(
            card,
            fallbackQuery,
            apiKey,
            fallbackLimit,
            "The Card API target fallback search"
          );
          fallbackRowsReturned = fallbackRows.length;
          const fallbackNormalized = fallbackRows
            .map(normalizeCardApiResult)
            .filter(Boolean)
            .filter(item => normalizeText(item.platform) === "ebay");
          fallbackMatches = evaluateComparableResults(
            fallbackNormalized,
            card,
            isProductionCardApiComparable
          ).matchedItems.length;
          rows = [...initialRows, ...fallbackRows];
          normalized = dedupeSoldComps(rows
            .map(normalizeCardApiResult)
            .filter(Boolean)
            .filter(item => normalizeText(item.platform) === "ebay"));
          evaluation = evaluateComparableResults(normalized, card, isProductionCardApiComparable);
          fallbackStatus = "completed";
        } catch (err) {
          fallbackError = err?.message || "The Card API target fallback failed.";
          fallbackStatus = /timed out/i.test(fallbackError) ? "timed_out" : "failed";
        }
      }
    }
  }

  const notes = buildNotes(card, rows.length, evaluation.matchedItems.length, evaluation.cleaned.length, evaluation.confidence);
  const unconfirmed = rows.filter(row => row?.price_confirmed === false).length;
  if (unconfirmed) {
    notes.push(`${unconfirmed} The Card API sale${unconfirmed === 1 ? " was" : "s were"} rejected because the transaction price was not confirmed.`);
  }
  if (evaluation.matchMode === "relaxed") {
    notes.push("Scout used a controlled relaxed title match on The Card API results because marketplace titles format grades/card numbers inconsistently.");
  }
  if (fallbackQuery) {
    notes.unshift("The Card API exact-title search remained below the target evidence goal, so Scout tried one last-name/card-number discovery query and reapplied every exact-card rule.");
  }
  if (fallbackError) notes.push(`The Card API target fallback was unavailable: ${fallbackError} Scout kept the verified initial-query evidence.`);

  return {
    ...evaluation,
    searched: rows.length,
    matched: evaluation.matchedItems.length,
    searchMode: fallbackQuery ? "The Card API eBay sold sales + target fallback" : "The Card API eBay sold sales",
    discoveryQuery: fallbackQuery ? `${query} | ${fallbackQuery}` : query,
    providerDiagnostics: {
      cardApi: {
        initial: {
          rows: initialRows.length,
          matches: initialEvaluation.matchedItems.length,
          status: "completed",
        },
        fallback: {
          rows: fallbackRowsReturned,
          matches: fallbackMatches,
          status: fallbackStatus,
          note: fallbackError,
        },
        total: {
          rows: rows.length,
          matches: evaluation.matchedItems.length,
          status: "completed",
        },
      },
    },
    notes,
  };
}

async function testCardApiSecondarySources(card, apiKey) {
  const query = buildCardApiQuery(card);
  const settled = await Promise.allSettled(
    CARD_API_PLATFORMS.map(platform => searchCardApiPlatform(card, query, platform, apiKey))
  );

  const all = [];
  const failures = [];
  const platformStats = {};

  settled.forEach((entry, index) => {
    const platform = CARD_API_PLATFORMS[index];
    if (entry.status === "fulfilled") {
      const value = entry.value;
      platformStats[platform] = { returned: value.returned, matched: value.matched.length };
      all.push(...value.matched);
    } else {
      const err = entry.reason || {};
      platformStats[platform] = { returned: 0, matched: 0, error: err.message || "request failed" };
      failures.push(`${platform}: ${err.message || "request failed"}`);
    }
  });

  const matched = dedupeCardApiSales(all)
    .sort((a, b) => new Date(b.soldDate || 0) - new Date(a.soldDate || 0));

  const byPlatform = {};
  for (const item of matched) byPlatform[item.platform] = (byPlatform[item.platform] || 0) + 1;

  return {
    query,
    lookbackNote: "The Card API Free plan automatically limits this test to the most recent 3 days.",
    rowBudgetMax: CARD_API_PLATFORMS.length * CARD_API_PER_PLATFORM_LIMIT,
    platformsSearched: CARD_API_PLATFORMS,
    platformStats,
    matched: matched.length,
    byPlatform,
    comps: matched.map(x => ({
      platform: x.platform,
      title: x.title,
      price: x.price,
      soldDate: x.soldDate,
      listingType: x.listingType,
      priceConfirmed: x.priceConfirmed,
      link: x.link,
      grader: x.grader,
      grade: x.grade,
      cardNumber: x.cardNumber,
    })),
    notes: uniqueStrings([
      "This Phase 2B test intentionally excludes eBay so it measures independent auction-house evidence only.",
      "No The Card API transaction response is written to Cloudflare cache or other persistent storage.",
      failures.length ? `Some source checks failed: ${failures.join(" | ")}` : "",
    ]),
  };
}

async function searchCardApiPlatform(card, query, platform, apiKey) {
  const params = new URLSearchParams({
    q: query,
    platform,
    sort: "date_desc",
    limit: String(CARD_API_PER_PLATFORM_LIMIT),
  });

  const grader = canonicalGrader(card.grader);
  const grade = normalizeGrade(card.grade, grader);
  if (grader === "Raw") {
    params.set("graded", "false");
  } else if (grader) {
    params.set("graded", "true");
    params.set("grader", grader);
    if (grade) params.set("grade", grade);
  }

  let response;
  try {
    response = await fetchWithTimeout(
      `https://thecardapi.com/api/v1/market/sales?${params.toString()}`,
      { method: "GET", headers: { "x-market-api-key": apiKey, "Accept": "application/json" } },
      CARD_API_TIMEOUT_MS,
      `The Card API ${platform} search timed out`
    );
  } catch (err) {
    throw err;
  }

  let payload = null;
  try { payload = await response.json(); } catch {}

  if (!response.ok) {
    const message = payload?.message || payload?.error || `The Card API returned HTTP ${response.status}`;
    const err = new Error(String(message));
    err.status = response.status;
    err.code = response.status === 429 ? "cardapi_rate_limit" : "cardapi_http_error";
    throw err;
  }

  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const normalized = rows.map(normalizeCardApiResult).filter(Boolean);
  const matched = normalized.filter(item => isCardApiComparable(item, card));
  return { returned: rows.length, matched };
}

function normalizeCardApiResult(r) {
  if (!r || !r.title) return null;
  const price = extractPrice(r.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  const currency = String(r.currency || "USD").toUpperCase();
  if (currency && currency !== "USD") return null;
  if (r.price_confirmed === false) return null;
  const soldDate = r.sale_date || r.sold_at || null;
  if (!isReasonableSoldDate(soldDate, true)) return null;

  return {
    id: `cardapi:${r.platform || "unknown"}:${r.id || r.listing_url || r.title}`,
    title: String(r.title),
    price,
    originalPrice: extractPrice(r.original_price),
    soldDate,
    condition: r.condition || "",
    link: r.listing_url || "",
    thumbnail: r.thumbnail_url || r.image_url || "",
    source: "The Card API",
    platform: String(r.platform || "").trim(),
    listingType: r.listing_type || "",
    priceConfirmed: r.price_confirmed !== false,
    player: r.player || "",
    cardSet: r.card_set || "",
    cardNumber: r.card_number || "",
    year: r.year ?? "",
    grader: r.grader || "",
    grade: r.grade || "",
    features: Array.isArray(r.features) ? r.features : [],
  };
}

function isCardApiComparable(item, card, relaxed=false) {
  const structuredBits = [
    item.year,
    item.cardSet,
    item.player,
    item.cardNumber ? `#${item.cardNumber}` : "",
    item.grader,
    item.grade,
    ...(item.features || []),
  ].filter(Boolean).join(" ");

  const comparisonItem = { ...item, title: `${item.title} ${structuredBits}`.trim() };
  return isComparable(comparisonItem, card, relaxed);
}

function isProductionCardApiComparable(item, card, relaxed=false) {
  return isComparable(item, card, relaxed) && isCardApiComparable(item, card, relaxed);
}

function dedupeCardApiSales(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = String(item.id || `${item.platform}|${item.link}|${item.title}|${item.price}|${item.soldDate}`);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

async function testCardApiBestOffers(card, apiKey) {
  const baseQuery = buildCardApiQuery(card);
  const graderText = String(card?.grader || "").trim();
  const gradeText = String(card?.grade || "").trim();
  const gradedSuffix =
    graderText && graderText.toLowerCase() !== "raw"
      ? ` ${graderText}${gradeText ? " " + gradeText : ""}`
      : "";
  const query = `${baseQuery}${gradedSuffix}`.trim();

  // Deliberately keep the upstream request simple. We previously sent
  // listing_type=best_offer plus grading filters to The Card API; that
  // combination produced a network-level failure for a real test.
  // v3.6.2 fetches a small recent eBay sample and performs Best Offer +
  // card/grade matching locally instead.
  const params = new URLSearchParams({
    q: query,
    platform: "ebay",
    sort: "date_desc",
    limit: String(CARD_API_BEST_OFFER_LIMIT),
  });

  const endpoint = `https://thecardapi.com/api/v1/market/sales?${params.toString()}`;

  let response;
  try {
    response = await fetchWithTimeout(
      endpoint,
      { method: "GET", headers: { "x-market-api-key": apiKey, "Accept": "application/json" } },
      CARD_API_TIMEOUT_MS,
      "The Card API eBay search timed out"
    );
  } catch (firstErr) {
    // One lightweight retry for a transient upstream connection reset.
    await new Promise(resolve => setTimeout(resolve, 350));
    try {
      response = await fetchWithTimeout(
        endpoint,
        { method: "GET", headers: { "x-market-api-key": apiKey, "Accept": "application/json" } },
        CARD_API_TIMEOUT_MS,
        "The Card API eBay retry timed out"
      );
    } catch (secondErr) {
      const err = new Error(`The Card API connection failed twice: ${secondErr?.message || firstErr?.message || "network error"}`);
      err.code = "cardapi_network_error";
      err.status = 502;
      throw err;
    }
  }

  let payload = null;
  let rawText = "";
  try {
    rawText = await response.text();
    payload = rawText ? JSON.parse(rawText) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const message = payload?.message || payload?.error || rawText?.slice(0, 240) || `The Card API returned HTTP ${response.status}`;
    const err = new Error(String(message));
    err.status = response.status;
    err.code = response.status === 429 ? "cardapi_rate_limit" : "cardapi_http_error";
    throw err;
  }

  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const normalized = rows.map(normalizeCardApiResult).filter(Boolean);

  const bestOfferRows = normalized.filter(item =>
    String(item.listingType || "").trim().toLowerCase() === "best_offer"
  );

  const matched = dedupeCardApiSales(
    bestOfferRows.filter(item => isCardApiComparable(item, card))
  ).sort((a, b) => new Date(b.soldDate || 0) - new Date(a.soldDate || 0));

  const offers = matched.map(x => {
    const original = Number(x.originalPrice);
    const accepted = Number(x.price);
    const hasOriginal = Number.isFinite(original) && original > 0;
    const discount = hasOriginal && Number.isFinite(accepted) && accepted > 0 && original >= accepted
      ? Math.round(((original - accepted) / original) * 1000) / 10
      : null;
    return {
      platform: x.platform || "eBay",
      title: x.title,
      acceptedPrice: accepted,
      originalPrice: hasOriginal ? original : null,
      discountPct: discount,
      soldDate: x.soldDate,
      listingType: x.listingType,
      priceConfirmed: x.priceConfirmed,
      link: x.link,
      grader: x.grader,
      grade: x.grade,
      cardNumber: x.cardNumber,
    };
  });

  const meta = payload?.meta || {};
  return {
    query,
    strategy: "recent eBay sample; Best Offer + grade matching performed locally",
    lookbackNote: "The Card API Free plan limits this check to the most recent 3 days.",
    rowBudgetMax: CARD_API_BEST_OFFER_LIMIT,
    platform: "ebay",
    listingType: "best_offer",
    returned: rows.length,
    bestOfferRows: bestOfferRows.length,
    matched: offers.length,
    coverage: {
      from: meta.coverage_date_from || null,
      to: meta.coverage_date_to || null,
    },
    offers,
    notes: [
      "v3.6.3 adds grader/grade to the eBay text query, while still avoiding The Card API's server-side Best Offer filter.",
      "Only records labeled best_offer are eligible for recovery.",
      "The Card API documents price as the transaction price; original_price, when present, is shown as the pre-negotiation ask.",
      "No The Card API transaction response is written to Cloudflare cache or other persistent storage.",
    ],
  };
}


function extractEbayItemId(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  const direct = s.match(/^\d{9,16}$/);
  if (direct) return direct[0];
  const fromUrl = s.match(/\/itm\/(?:[^/?#]+\/)?(\d{9,16})(?:[/?#]|$)/i);
  if (fromUrl) return fromUrl[1];
  const ebayPrefixed = s.match(/^ebay[-_:](\d{9,16})$/i);
  if (ebayPrefixed) return ebayPrefixed[1];
  const embeddedSuffix = s.match(/(?:^|[-_:])(\d{9,16})$/);
  return embeddedSuffix ? embeddedSuffix[1] : "";
}

function normalizeApifyBestOfferCandidate(r) {
  if (!r || !r.title) return null;
  const isBO = r.isBestOfferAccepted === true ||
    String(r.listingType || "").trim().toLowerCase() === "best_offer_accepted";
  if (!isBO) return null;

  const currency = String(r.soldCurrency || "USD").toUpperCase();
  if (currency && currency !== "USD") return null;

  const soldDate = r.endedAt || null;
  if (!isReasonableSoldDate(soldDate, true)) return null;

  const itemId = extractEbayItemId(r.itemId || r.itemNumber || r.url || "");
  if (!itemId) return null;

  return {
    itemId,
    title: String(r.title),
    soldDate,
    askingPrice: extractPrice(r.soldPrice),
    link: r.url || `https://www.ebay.com/itm/${itemId}`,
    listingType: "best_offer_accepted",
  };
}

async function fetchApifyBestOfferCandidates(card, token) {
  const input = {
    keywords: [buildApifyQuery(card)],
    categoryId: "212",
    daysToScrape: 7,
    count: BEST_OFFER_BRIDGE_APIFY_COUNT,
    ebaySite: "ebay.com",
    sortOrder: "endedRecently",
    itemLocation: "default",
    itemCondition: "any",
    includeCompletedListings: true,
  };

  const endpoint = new URL("https://api.apify.com/v2/acts/caffein.dev~ebay-sold-listings/run-sync-get-dataset-items");
  endpoint.searchParams.set("timeout", "25");
  endpoint.searchParams.set("maxItems", String(BEST_OFFER_BRIDGE_APIFY_COUNT));
  endpoint.searchParams.set("maxTotalChargeUsd", "0.10");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("clean", "true");

  const res = await fetch(endpoint.toString(), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(input),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error?.message || data?.message || `Apify returned HTTP ${res.status}.`);
    err.status = res.status;
    err.code = "apify_bridge_search_failed";
    throw err;
  }
  if (!Array.isArray(data)) throw new Error("Apify returned an unexpected response.");

  const candidates = data
    .map(normalizeApifyBestOfferCandidate)
    .filter(Boolean)
    .filter(item => isComparable({ ...item, price: item.askingPrice || 1 }, card, false))
    .sort((a, b) => dateValue(b.soldDate) - dateValue(a.soldDate));

  return {
    searched: data.length,
    candidates: dedupeByKey(candidates, x => x.itemId).slice(0, BEST_OFFER_BRIDGE_MAX_CANDIDATES),
  };
}

function dedupeByKey(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = String(keyFn(item) || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

async function fetchCardApiSaleByExactEbayId(itemId, apiKey, timeoutMs=CARD_API_TIMEOUT_MS) {
  // The Card API documents sale IDs as platform-prefixed (for example ebay-123...).
  // Try that form first; keep the bare ID as a compatibility fallback.
  const variants = [`ebay-${itemId}`, itemId];
  const attempts = [];

  for (const saleId of variants) {
    const endpoint = `https://thecardapi.com/api/v1/market/sales/${encodeURIComponent(saleId)}`;
    let response;
    try {
      response = await fetchWithTimeout(
        endpoint,
        { method: "GET", headers: { "x-market-api-key": apiKey, "Accept": "application/json" } },
        timeoutMs,
        "The Card API exact-sale lookup timed out"
      );
    } catch (err) {
      attempts.push({ saleId, status: "network_error", message: err?.message || "network error" });
      continue;
    }

    let rawText = "";
    let payload = {};
    try {
      rawText = await response.text();
      payload = rawText ? JSON.parse(rawText) : {};
    } catch {}

    attempts.push({
      saleId,
      status: response.status,
      message: response.ok ? "ok" : (payload?.message || payload?.error || rawText.slice(0, 120) || `HTTP ${response.status}`)
    });

    if (response.status === 404) continue;
    if (!response.ok) {
      const err = new Error(payload?.message || payload?.error || `The Card API returned HTTP ${response.status}.`);
      err.status = response.status;
      err.code = response.status === 429 ? "cardapi_rate_limit" : "cardapi_exact_lookup_failed";
      err.attempts = attempts;
      throw err;
    }

    const rawSale =
      (payload?.data && !Array.isArray(payload.data) ? payload.data : null) ||
      (Array.isArray(payload?.data) ? payload.data[0] : null) ||
      payload?.sale ||
      payload;

    return { rawSale, attempts };
  }

  return { rawSale: null, attempts };
}

function exactSaleMatchesCandidate(rawSale, candidate, card) {
  if (!rawSale || typeof rawSale !== "object") return false;
  const platform = String(rawSale.platform || "").toLowerCase();
  if (platform && platform !== "ebay") return false;

  const rawId = extractEbayItemId(rawSale.id || rawSale.listing_url || "");
  if (rawId && rawId !== candidate.itemId) return false;

  const normalized = normalizeCardApiResult(rawSale);
  if (!normalized) return false;
  if (String(normalized.listingType || "").toLowerCase() !== "best_offer") return false;
  return isCardApiComparable(normalized, card);
}


async function recoverBestOffersFromExistingApifyRows(card, rawRows, cardApiKey, fastMode=false) {
  if (!cardApiKey || !Array.isArray(rawRows) || !rawRows.length) {
    return { attempted: 0, recovered: [], misses: [] };
  }

  const maxCandidates = fastMode ? LIVE_BO_FAST_MAX_CANDIDATES : LIVE_BO_DEEP_MAX_CANDIDATES;
  const timeoutMs = fastMode ? LIVE_BO_FAST_TIMEOUT_MS : LIVE_BO_DEEP_TIMEOUT_MS;

  const candidates = dedupeByKey(
    rawRows
      .map(normalizeApifyBestOfferCandidate)
      .filter(Boolean)
      .filter(item => isComparable({ ...item, price: item.askingPrice || 1 }, card, false))
      .sort((a, b) => dateValue(b.soldDate) - dateValue(a.soldDate)),
    x => x.itemId
  ).slice(0, maxCandidates);

  const recovered = [];
  const misses = [];

  for (const candidate of candidates) {
    try {
      const exact = await fetchCardApiSaleByExactEbayId(candidate.itemId, cardApiKey, timeoutMs);
      if (!exact.rawSale || !exactSaleMatchesCandidate(exact.rawSale, candidate, card)) {
        misses.push(candidate.itemId);
        continue;
      }

      const sale = normalizeCardApiResult(exact.rawSale);
      if (!sale || String(sale.listingType || "").toLowerCase() !== "best_offer" || sale.priceConfirmed === false) {
        misses.push(candidate.itemId);
        continue;
      }

      // Shape it like the normal sold-comps rows so the existing matching,
      // outlier, confidence, and verdict math can remain unchanged.
      recovered.push({
        id: candidate.itemId,
        title: sale.title || candidate.title,
        price: Number(sale.price),
        soldDate: sale.soldDate || candidate.soldDate,
        condition: sale.condition || "",
        link: sale.link || candidate.link,
        thumbnail: sale.thumbnail || "",
        source: "Card API Best Offer",
        listingType: "best_offer_recovered",
        originalPrice: Number.isFinite(Number(sale.originalPrice)) ? Number(sale.originalPrice) : candidate.askingPrice,
        priceConfirmed: true,
      });
    } catch (err) {
      // Recovery is enrichment only. A Card API timeout/rate-limit must never
      // break a valuation that already has valid SerpApi/Apify sold comps.
      misses.push(candidate.itemId);
    }
  }

  return { attempted: candidates.length, recovered, misses };
}

async function testBestOfferRecoveryBridge(card, apifyToken, cardApiKey) {
  const apify = await fetchApifyBestOfferCandidates(card, apifyToken);
  const recoveries = [];
  const misses = [];

  for (const candidate of apify.candidates) {
    const exact = await fetchCardApiSaleByExactEbayId(candidate.itemId, cardApiKey);
    if (!exact.rawSale) {
      misses.push({
        itemId: candidate.itemId,
        title: candidate.title,
        soldDate: candidate.soldDate,
        askingPriceSeenByApify: candidate.askingPrice,
        reason: "Exact sale ID was not found in The Card API free-window data.",
        attempts: exact.attempts,
      });
      continue;
    }

    if (!exactSaleMatchesCandidate(exact.rawSale, candidate, card)) {
      misses.push({
        itemId: candidate.itemId,
        title: candidate.title,
        soldDate: candidate.soldDate,
        askingPriceSeenByApify: candidate.askingPrice,
        reason: "The Card API returned the ID, but it was not a confirmed matching best_offer record for this card.",
        attempts: exact.attempts,
      });
      continue;
    }

    const sale = normalizeCardApiResult(exact.rawSale);
    const accepted = Number(sale.price);
    const apiOriginal = Number(sale.originalPrice);
    const apifyAsk = Number(candidate.askingPrice);
    const original =
      Number.isFinite(apiOriginal) && apiOriginal > 0 ? apiOriginal :
      Number.isFinite(apifyAsk) && apifyAsk > 0 ? apifyAsk : null;
    const discountPct =
      Number.isFinite(original) && original >= accepted && accepted > 0
        ? Math.round(((original - accepted) / original) * 1000) / 10
        : null;

    recoveries.push({
      itemId: candidate.itemId,
      title: sale.title || candidate.title,
      soldDate: sale.soldDate || candidate.soldDate,
      acceptedPrice: accepted,
      originalAsk: original,
      originalAskSource: Number.isFinite(apiOriginal) && apiOriginal > 0 ? "The Card API" : "Apify asking-price placeholder",
      discountPct,
      listingType: sale.listingType,
      priceConfirmed: sale.priceConfirmed,
      link: sale.link || candidate.link,
      grader: sale.grader,
      grade: sale.grade,
      attempts: exact.attempts,
    });
  }

  return {
    query: buildApifyQuery(card),
    apifySearched: apify.searched,
    bestOfferCandidates: apify.candidates.length,
    recovered: recoveries.length,
    recoveries,
    misses,
    limits: {
      apifyRows: BEST_OFFER_BRIDGE_APIFY_COUNT,
      exactCandidatesChecked: BEST_OFFER_BRIDGE_MAX_CANDIDATES,
      apifyMaxChargeUsd: 0.10,
    },
    notes: [
      "This is a test-only bridge; recovered prices do not affect Scout's live valuation yet.",
      "Apify identifies Best Offer Accepted listings and supplies the eBay item ID; The Card API is asked for that exact sale.",
      "Only The Card API records labeled best_offer with confirmed transaction pricing are accepted.",
      "The Card API free plan can only recover sales that are still inside its current lookback window.",
      "No The Card API transaction response is written to Cloudflare cache or other persistent storage.",
    ],
  };
}

function normalizeValuationProfile(options={}) {
  const targetEnrichment = options?.targetEnrichment === true;
  return {
    targetEnrichment,
    evidenceGoal: targetEnrichment
      ? Math.max(TARGET_EVIDENCE_GOAL, Number(options?.evidenceGoal) || 0)
      : 0,
    extraWaitMs: targetEnrichment
      ? Math.min(16000, Math.max(14000, Number(options?.extraWaitMs) || TARGET_ENRICHMENT_WAIT_MS))
      : 0,
    fallbackEvidenceCount: targetEnrichment
      ? Math.max(0, Number(options?.fallbackEvidenceCount) || 0)
      : 0,
  };
}

async function valueCard(card, env, fastMode=false, options={}) {
  const profile = normalizeValuationProfile(options);
  const query = buildQuery(card);
  const sourceNotes = [];
  let serp = null;
  let cardApi = null;
  let apify = null;
  let serpError = "";
  let cardApiError = "";
  let apifyError = "";
  const providerDiagnostics = {};

  // SerpApi and The Card API are independent primary sources. Starting both
  // together prevents one provider's latency from delaying the other.
  const primarySearches = [];
  if (env.SERPAPI_KEY) {
    primarySearches.push({
      key: "serp",
      promise: searchSerpApi(card, query, env.SERPAPI_KEY, fastMode, profile),
    });
  }
  if (env.CARD_API_KEY) {
    primarySearches.push({
      key: "cardApi",
      promise: searchCardApiEbaySold(card, env.CARD_API_KEY, profile),
    });
  }

  const primarySettled = await Promise.allSettled(primarySearches.map(source => source.promise));
  primarySettled.forEach((entry, index) => {
    const key = primarySearches[index].key;
    if (entry.status === "fulfilled") {
      if (key === "serp") serp = entry.value;
      else cardApi = entry.value;
      return;
    }
    const message = entry.reason?.message || "search failed.";
    if (key === "serp") {
      serpError = message;
      if (entry.reason?.providerDiagnostics?.serpApi) {
        providerDiagnostics.serpApi = entry.reason.providerDiagnostics.serpApi;
      }
      sourceNotes.push(`SerpApi was unavailable: ${message}`);
    } else {
      cardApiError = message;
      sourceNotes.push(`The Card API was unavailable: ${message}`);
    }
  });

  if (serp?.providerDiagnostics?.serpApi) {
    providerDiagnostics.serpApi = serp.providerDiagnostics.serpApi;
  }
  if (cardApi?.providerDiagnostics?.cardApi) {
    providerDiagnostics.cardApi = cardApi.providerDiagnostics.cardApi;
  }

  const primaryResults = [serp, cardApi].filter(Boolean);
  const primaryItems = dedupeSoldComps(primaryResults.flatMap(result => result.matchedItems || []));
  const primaryEvaluation = evaluateComparableResults(primaryItems, card);
  const evidenceAvailableBeforeApify = profile.targetEnrichment
    ? Math.max(primaryEvaluation.cleaned.length, profile.fallbackEvidenceCount)
    : primaryEvaluation.cleaned.length;

  // Fast Mode can stop with two clean exact-card comps across the primary
  // sources. Deep mode keeps the stronger four-comp threshold before Apify.
  const needsApify = Boolean(env.APIFY_TOKEN) && (
    fastMode
      ? (evidenceAvailableBeforeApify < 2 || (primaryEvaluation.confidence === "insufficient" && profile.fallbackEvidenceCount < 2))
      : (primaryEvaluation.cleaned.length < 4 || primaryEvaluation.confidence === "low" || primaryEvaluation.confidence === "insufficient")
  );

  if (needsApify) {
    try {
      apify = await searchApify(card, query, env.APIFY_TOKEN, fastMode, env.CARD_API_KEY || "");
    } catch (err) {
      apifyError = err?.message || "Apify search failed.";
      sourceNotes.push(`Apify tertiary backup was unavailable: ${apifyError} Scout kept usable primary-source evidence.`);
    }
  }

  const availableResults = [serp, cardApi, apify].filter(Boolean);
  if (!availableResults.length) {
    const parts = [];
    if (serpError) parts.push(`SerpApi: ${serpError}`);
    if (cardApiError) parts.push(`The Card API: ${cardApiError}`);
    if (apifyError) parts.push(`Apify: ${apifyError}`);
    const error = new Error(parts.length
      ? `All sold-comps sources failed. ${parts.join(" ")}`
      : "No sold-comps source is available.");
    if (Object.keys(providerDiagnostics).length) {
      error.providerDiagnostics = providerDiagnostics;
    }
    throw error;
  }

  const combinedItems = dedupeSoldComps(availableResults.flatMap(result => result.matchedItems || []));
  const combinedEvaluation = evaluateComparableResults(combinedItems, card);
  const providerNames = [];
  if (serp) providerNames.push("SerpApi");
  if (cardApi) providerNames.push("The Card API");
  if (apify) providerNames.push("Apify");
  let provider = `eBay sold results via ${providerNames.join(" + ")}`;
  if (apify?.bestOfferRecovered > 0) provider += " + Best Offer recovery";

  const combinedNotes = uniqueStrings([
    ...availableResults.flatMap(result => result.notes || []),
    ...sourceNotes,
    needsApify && apify ? "Scout used Apify only as a tertiary backup because the combined primary-source evidence was still weak." : "",
    fastMode && !profile.targetEnrichment && !needsApify && combinedEvaluation.cleaned.length < 4
      ? "Fast Mode returned after the primary sources produced at least two clean exact-card comps; Deep Mode can seek more evidence."
      : "",
    profile.targetEnrichment && combinedEvaluation.cleaned.length < profile.evidenceGoal
      ? `Target enrichment finished with ${combinedEvaluation.cleaned.length} clean exact-card comp${combinedEvaluation.cleaned.length === 1 ? "" : "s"}; Scout kept the existing confidence standard.`
      : "",
  ]);
  const searchModes = availableResults.map(result => result.searchMode).filter(Boolean).join(" + ");

  return finalizeValuation(card, query, combinedEvaluation.matchedItems, {
    provider,
    searchMode: searchModes,
    matchMode: combinedEvaluation.matchMode,
    searched: availableResults.reduce((sum, result) => sum + Number(result.searched || 0), 0),
    matched: combinedEvaluation.matchedItems.length,
    providerDiagnostics,
    notes: combinedNotes,
    mode: fastMode ? "fast" : "deep",
    bestOfferRecovered: apify?.bestOfferRecovered || 0,
    bestOfferRecoveryAttempted: apify?.bestOfferRecoveryAttempted || 0,
  });
}



function targetDealClamp(v,min,max){return Math.max(min,Math.min(max,v))}
function targetDealStep(v){
  if(v<10)return .25;
  if(v<25)return .50;
  if(v<100)return 1;
  if(v<250)return 2;
  if(v<1000)return 5;
  return 10;
}
function targetDealRound(v){
  if(!Number.isFinite(v))return null;
  const step=targetDealStep(v);
  return Math.round(v/step)*step;
}
function targetSmartBuyTargets(data){
  const median=Number(data?.median);
  if(!Number.isFinite(median)||median<=0)return null;

  const market=data?.confidenceLab?.market||{};
  const score=Number.isFinite(Number(market.score))?Number(market.score):Number(data?.confidenceScore||50);
  const conf=targetDealClamp(score/100,0,1);
  const spreadRaw=Number(market?.components?.priceConsistency?.iqrToMedian);
  const low=Number(data?.low),high=Number(data?.high);
  const fallbackSpread=Number.isFinite(low)&&Number.isFinite(high)&&median>0?(high-low)/median:.60;
  const spread=targetDealClamp(Number.isFinite(spreadRaw)?spreadRaw:fallbackSpread,0,1.5);
  const spreadForBuffer=Math.min(spread,1);

  const greatDiscount=targetDealClamp(.12+.12*(1-conf)+.08*spreadForBuffer,.14,.32);
  const ceilingDiscount=targetDealClamp(.02+.08*(1-conf)+.05*spreadForBuffer,.04,.18);
  const walkPremium=targetDealClamp(.08*conf-.05*spreadForBuffer,-.03,.06);

  let greatRaw=median*(1-greatDiscount);
  if(Number.isFinite(low)&&low>0&&low<greatRaw){
    const softenedLow=low*1.02;
    greatRaw=(greatRaw*.75)+(softenedLow*.25);
  }
  greatRaw=Math.max(greatRaw,median*.68);

  const ceilingRaw=median*(1-ceilingDiscount);
  let walkRaw=median*(1+walkPremium);
  if(Number.isFinite(high)&&high>0)walkRaw=Math.min(walkRaw,high*1.02);

  let greatBuy=targetDealRound(greatRaw);
  let buyCeiling=targetDealRound(ceilingRaw);
  let walkAway=targetDealRound(walkRaw);

  if(buyCeiling<=greatBuy)buyCeiling=greatBuy+targetDealStep(greatBuy);
  if(walkAway<=buyCeiling)walkAway=buyCeiling+targetDealStep(buyCeiling);

  return {median,greatBuy,buyCeiling,walkAway,confidenceScore:score};
}
function targetPriceVerdict(delivered,targets){
  const total=Number(delivered);
  if(!targets||!Number.isFinite(total)||total<=0){
    return {tier:"market_check",label:"MARKET CHECK",message:"Scout likes the target, but does not have enough pricing evidence to judge this listing."};
  }
  if(total<=targets.greatBuy)return {tier:"great_buy",label:"GREAT BUY",message:"This listing is at or below Scout's Great Buy price."};
  if(total<=targets.buyCeiling)return {tier:"buy",label:"BUY",message:"This listing is below Scout's Buy Ceiling."};
  if(total<=targets.median)return {tier:"fair",label:"FAIR PRICE",message:"The listing is reasonable, but it is not a bargain."};
  if(total<=targets.walkAway)return {tier:"negotiate",label:"NEGOTIATE",message:"Scout likes the card, but would try for a lower price."};
  return {tier:"pass",label:"PASS",message:"Good target, bad price. Scout would wait for another copy."};
}
function targetRecommendationCanonicalSet(suggestion) {
  const verifiedSet = String(suggestion?.traits?.rookieVerification?.set || "").trim();
  if (verifiedSet) return verifiedSet;

  const parsed = monthlyPickSet(suggestion?.title || "");
  if (parsed) return parsed;

  return String(suggestion?.set || "").trim();
}

function sanitizePricingDiagnosticText(value, maxLength=280) {
  let text = String(value || "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return "";
  text = text
    .replace(/https?:\/\/[^\s)\]}]+/gi, "[redacted URL]")
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/((?:api[_\s-]?key|access[_\s-]?token|token|authorization|x-scout-key|x-market-api-key)\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]")
    .replace(/([?&](?:api_key|access_token|token|key)=)[^&\s]+/gi, "$1[redacted]");
  return text.slice(0, maxLength);
}

function pricingDiagnosticCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function pricingProviderSearchDetail(value) {
  if (!value || typeof value !== "object") return null;
  return {
    rows: pricingDiagnosticCount(value.rows),
    matches: pricingDiagnosticCount(value.matches),
    status: sanitizePricingDiagnosticText(value.status || "unknown", 40),
    note: sanitizePricingDiagnosticText(value.note || ""),
  };
}

function targetPricingProviderDetails(live={}) {
  const currentAttempt = live?.liveEnrichmentProviderDiagnostics;
  const valuationDiagnostics = live?.providerDiagnostics && typeof live.providerDiagnostics === "object"
    ? live.providerDiagnostics
    : {};
  const raw = currentAttempt && typeof currentAttempt === "object"
    ? currentAttempt
    : valuationDiagnostics;
  const details = {};
  if (raw.serpApi) {
    details.serpApi = {
      exact: pricingProviderSearchDetail(raw.serpApi.exact),
      broad: pricingProviderSearchDetail(raw.serpApi.broad),
    };
  }
  if (raw.cardApi) {
    details.cardApi = {
      initial: pricingProviderSearchDetail(raw.cardApi.initial),
      fallback: pricingProviderSearchDetail(raw.cardApi.fallback),
      total: pricingProviderSearchDetail(raw.cardApi.total),
    };
  }
  return details;
}

function targetPricingEvidenceDetails(live={}, targetEnrichmentAttempted=false) {
  const noteSource = live?.targetEnrichmentFallback && Array.isArray(live?.liveEnrichmentNotes)
    ? live.liveEnrichmentNotes
    : (Array.isArray(live?.notes) ? live.notes : []);
  const notes = uniqueStrings(noteSource
    .map(note => sanitizePricingDiagnosticText(note))
    .filter(Boolean))
    .slice(0, 8);
  return {
    providers: sanitizePricingDiagnosticText(live?.provider),
    searchModes: sanitizePricingDiagnosticText(live?.searchMode),
    listingsSearched: pricingDiagnosticCount(live?.searched),
    exactMatches: pricingDiagnosticCount(live?.matched),
    soldCompsUsed: pricingDiagnosticCount(live?.used),
    cacheHit: live?.cacheHit === true,
    staleFallback: live?.staleCacheFallback === true,
    targetEnrichmentAttempted: targetEnrichmentAttempted === true,
    providerDetails: targetPricingProviderDetails(live),
    notes,
  };
}

function targetEnrichmentWasAttempted(live) {
  const strongFreshCache = live?.cacheHit === true &&
    live?.staleCacheFallback !== true &&
    live?.targetEnrichmentFallback !== true &&
    valuationEvidenceCount(live) >= TARGET_EVIDENCE_GOAL;
  return !strongFreshCache;
}

async function targetRecommendationMarketCheck(suggestion,player,env){
  const delivered=Number(suggestion?.delivered);
  const year=Number(suggestion?.year);
  const set=targetRecommendationCanonicalSet(suggestion);
  const cardNum=String(suggestion?.cardNum||"").trim();

  if(!Number.isFinite(delivered)||delivered<=0){
    return {
      version:TARGET_MARKET_CHECK_VERSION,
      rated:false,tier:"market_check",label:"MARKET CHECK",
      pricingEvidence:targetPricingEvidenceDetails({},false),
      reason:"Delivered listing price is unavailable."
    };
  }
  if(!Number.isInteger(year)||!set){
    return {
      version:TARGET_MARKET_CHECK_VERSION,
      rated:false,tier:"market_check",label:"MARKET CHECK",delivered,
      pricingEvidence:targetPricingEvidenceDetails({},false),
      reason:"Scout likes the target, but the listing identity is not specific enough for a trustworthy sold-comps price check."
    };
  }

  const gradeInfo=suggestion?.gradeInfo||{};
  const traits=suggestion?.traits||{};
  const card={
    year,set,player,cardNum,
    grader:gradeInfo?.grader||"Raw",
    grade:gradeInfo?.grade??"",
    autograph:!!traits.autograph,
    relic:false,
    serial:"",
    shopPrice:delivered,
    notes:"",
    fastMode:true
  };

  try{
    const live=await getValuationWithCache(card,env,true,null,{
      evidenceGoal:TARGET_EVIDENCE_GOAL,
      targetEnrichment:true,
      extraWaitMs:TARGET_ENRICHMENT_WAIT_MS
    });

    const used=Number(live?.used||0);
    const confidence=String(live?.confidence||"insufficient");
    const median=Number(live?.median);
    const pricingEvidence=targetPricingEvidenceDetails(live,targetEnrichmentWasAttempted(live));

    if(used<2||confidence==="insufficient"||!Number.isFinite(median)||median<=0){
      return {
        version:TARGET_MARKET_CHECK_VERSION,
        rated:false,tier:"market_check",label:"MARKET CHECK",delivered,used,confidence,
        confidenceScore:Number(live?.confidenceScore||0),
        median:Number.isFinite(median)?median:null,
        low:Number.isFinite(Number(live?.low))?Number(live.low):null,
        high:Number.isFinite(Number(live?.high))?Number(live.high):null,
        pricingIdentity:{year,set,player,cardNum},
        pricingEvidence,
        reason:"Scout likes the target, but there are not enough reliable sold comps to call this listing a bargain or a pass."
      };
    }

    const targets=targetSmartBuyTargets(live);
    const verdict=targetPriceVerdict(delivered,targets);
    return {
      version:TARGET_MARKET_CHECK_VERSION,
      rated:true,...verdict,delivered,
      median:Number(live.median),
      low:Number(live.low),
      high:Number(live.high),
      used,
      confidence,
      confidenceScore:Number(live.confidenceScore||0),
      greatBuy:targets?.greatBuy??null,
      buyCeiling:targets?.buyCeiling??null,
      walkAway:targets?.walkAway??null,
      provider:live.provider||"",
      pricingIdentity:{year,set,player,cardNum},
      pricingEvidence,
      checkedAt:live.checkedAt||new Date().toISOString(),
      reason:verdict.message
    };
  }catch(err){
    const safeError=sanitizePricingDiagnosticText(err?.message||err||"Live sold sources were unavailable.");
    return {
      version:TARGET_MARKET_CHECK_VERSION,
      rated:false,tier:"market_check",label:"MARKET CHECK",delivered,
      pricingIdentity:{year,set,player,cardNum},
      pricingEvidence:targetPricingEvidenceDetails({
        notes:[safeError||"Live sold sources were unavailable."]
      },true),
      reason:"Scout found a target, but the sold-comps price check could not be completed for this listing.",
      error:safeError
    };
  }
}

function validateDealTargets(t) {
  const supplied = t && typeof t === "object" &&
    ["greatBuy","buyCeiling","walkAway"].some(k => t[k] !== undefined && t[k] !== null && t[k] !== "");
  if (!supplied) {
    return { ok: true, targets: null, rated: false };
  }

  const greatBuy = Number(t?.greatBuy);
  const buyCeiling = Number(t?.buyCeiling);
  const walkAway = Number(t?.walkAway);
  if (![greatBuy, buyCeiling, walkAway].every(v => Number.isFinite(v) && v > 0)) {
    return { ok: false, message: "Deal Finder received incomplete Smart Buy Targets." };
  }
  if (!(greatBuy < buyCeiling && buyCeiling <= walkAway)) {
    return { ok: false, message: "Deal Finder target prices must be ordered Great Buy < Buy Ceiling ≤ Walk-Away." };
  }
  return { ok: true, targets: { greatBuy, buyCeiling, walkAway }, rated: true };
}

function extractActiveShipping(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value === "object") {
    if (value.extracted != null && value.extracted !== "") {
      const extracted = Number(value.extracted);
      if (Number.isFinite(extracted) && extracted >= 0) return extracted;
    }
    if (value.raw != null) return extractActiveShipping(value.raw);
  }
  const text = String(value).trim();
  if (!text) return null;
  if (/\bfree\b/i.test(text)) return 0;
  const parsed = parseMoney(text);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function extractActiveItemPrice(result) {
  // SerpApi's primary price is Scout's standard item price. Coupon and
  // promotional fields are intentionally ignored because they may be
  // account-specific, conditional, or unavailable at checkout.
  return extractPrice(result?.price);
}

function activeBuyingFormat(r) {
  const pieces = [
    r?.buying_format,
    r?.buying_format_text,
    r?.buying_options?.text,
    r?.format
  ].flat().filter(Boolean).map(String).join(" ").toLowerCase();

  if (/auction/.test(pieces) || r?.bids) return "auction";
  if (/offer/.test(pieces)) return "buy_it_now_offer";
  return "buy_it_now";
}

function normalizeActiveEbayResult(r) {
  if (!r || !r.title) return null;
  const price = extractActiveItemPrice(r);
  if (!Number.isFinite(price) || price <= 0) return null;

  const shipping = extractActiveShipping(r.shipping);
  const seller = r.seller && typeof r.seller === "object" ? r.seller : {};
  const format = activeBuyingFormat(r);
  const bids = r.bids && typeof r.bids === "object" ? r.bids : {};

  return {
    id: String(r.product_id || r.epid || r.link || r.title),
    productId: String(r.product_id || ""),
    title: String(r.title),
    price,
    shipping,
    delivered: Number.isFinite(shipping) ? round2(price + shipping) : null,
    condition: String(r.condition || ""),
    link: String(r.link || ""),
    thumbnail: String(r.thumbnail || ""),
    seller: {
      username: String(seller.username || ""),
      reviews: Number.isFinite(Number(seller.reviews)) ? Number(seller.reviews) : null,
      positivePct: Number.isFinite(Number(seller.positive_feedback_in_percentage))
        ? Number(seller.positive_feedback_in_percentage)
        : null,
    },
    format,
    acceptsOffers: format === "buy_it_now_offer" || /offer/i.test(String(r.buying_format_text || "")),
    bidCount: Number.isFinite(Number(bids.count)) ? Number(bids.count) : null,
    timeLeft: String(bids.time_left || bids.timeLeft || r.time_left || ""),
    sponsored: Boolean(r.sponsored),
    source: "SerpApi",
  };
}

function activeDealMismatchReason(item, card) {
  const title = normalizeText(item.title);
  const rawTitle = String(item.title || "").toLowerCase();
  const year = String(card.year);

  if (!title.includes(year)) return "Wrong or missing card year.";

  const names = normalizeText(card.player).split(" ").filter(Boolean);
  const last = names[names.length - 1];
  if (last && !title.includes(last)) return "Player name does not match the target.";

  const setTokens = meaningfulTokens(card.set);
  if (setTokens.length && setTokens.filter(t => title.includes(t)).length < Math.min(setTokens.length, 2)) {
    return "Set does not match the target closely enough.";
  }

  if (card.cardNum && !cardNumberMatches(rawTitle, String(card.cardNum), false)) {
    return "Card number does not match the target.";
  }

  const grader = canonicalGrader(card.grader);
  const grade = normalizeGrade(card.grade, grader);
  const gradingWords = /\b(psa|sgc|bgs|beckett|cgc|csg|bccg|gma|tag)\b/i;
  if (grader && grader !== "Raw") {
    if (!graderRegex(grader).test(rawTitle)) return `Wrong grading company — target is ${grader}.`;
    if (grade && !gradeMatches(rawTitle, grade, grader, false)) return `Grade does not match target ${grader} ${grade}.`;
  } else if (grader === "Raw" && gradingWords.test(rawTitle)) {
    return "Graded listing does not match a Raw target.";
  }

  const autoRx = /\b(auto(?:graph)?|autographed|signed)\b/i;
  if (card.autograph ? !autoRx.test(rawTitle) : autoRx.test(rawTitle)) {
    return card.autograph ? "Target is autographed but listing does not say autograph." : "Autographed version does not match the target.";
  }

  const relicRx = /\b(relic|memorabilia|jersey|patch|game[ -]?used|bat piece|piece of bat)\b/i;
  if (card.relic ? !relicRx.test(rawTitle) : relicRx.test(rawTitle)) {
    return card.relic ? "Target is a relic but listing does not say relic/memorabilia." : "Relic/memorabilia version does not match the target.";
  }

  const denom = serialDenominator(card.serial);
  if (denom && !new RegExp(`\\/\\s*${escapeRegExp(denom)}\\b`).test(rawTitle)) {
    return `Serial-number denominator does not match /${denom}.`;
  }

  if (/\bbonus\s+cards?\b|\+\s*(?:bonus\s+)?cards?\b|\bwith\s+extra\s+cards?\b/i.test(rawTitle)) {
    return "Multi-card / bonus-card listing — Scout is hunting one exact card.";
  }
  if (looksLikeLot(rawTitle)) return "Multi-card lot / set / You Pick listing.";
  if (isObviousNonTradingCardListing(rawTitle)) {
    return "Listing is not the single physical card Scout is hunting.";
  }

  const setText = String(card.set || "").toLowerCase();
  const allowReprint = /archives|reprint/.test(setText) || /reprint/i.test(String(card.notes || ""));
  if (!allowReprint && /\b(reprint|replica|facsimile|custom card)\b/i.test(rawTitle)) {
    return "Reprint / replica / custom card does not match the original target.";
  }

  if (!Number.isFinite(item.shipping)) {
    return "Shipping cost is unclear, so Scout cannot calculate a trustworthy delivered price.";
  }

  return "";
}


function monthlyPickYear(title) {
  const years = String(title || "").match(/\b(?:18|19|20)\d{2}\b/g) || [];
  const currentYear = new Date().getUTCFullYear() + 1;
  for (const y of years) {
    const n = Number(y);
    if (n >= 1860 && n <= currentYear) return n;
  }
  return null;
}

function monthlyPickPlayerMatches(title, player) {
  const titleTokens = normalizeText(title).split(" ").filter(Boolean);
  const playerTokens = normalizeText(player).split(" ").filter(Boolean)
    .filter(t => !["jr", "sr", "ii", "iii", "iv"].includes(t));
  if (!playerTokens.length) return false;
  const required = playerTokens.length === 1
    ? playerTokens
    : [playerTokens[0], playerTokens[playerTokens.length - 1]];
  return required.every(t => titleTokens.includes(t));
}

const SCOUT_VERIFIED_ROOKIE_KNOWLEDGE = {
  "buster posey": {
    rookieYear: 2010,
    cards: [
      {
        year: 2010,
        cardNum: "294",
        set: "Topps Allen & Ginter",
        titlePattern: /\ballen\s*(?:&|and)\s*ginter\b/i,
        label: "2010 Topps Allen & Ginter #294",
        verification: "PSA CardFacts + Beckett"
      },
      {
        year: 2010,
        cardNum: "2",
        set: "Topps",
        titlePattern: /\btopps\b/i,
        rejectPattern: /\b(opening day|heritage|chrome|206|national chicle|allen\s*(?:&|and)\s*ginter)\b/i,
        label: "2010 Topps #2",
        verification: "PSA CardFacts + Beckett"
      }
    ]
  }
};

function monthlyPickVerifiedRookieKnowledge(player, title, year, cardNum) {
  const playerKey = normalizeText(player);
  const knowledge = SCOUT_VERIFIED_ROOKIE_KNOWLEDGE[playerKey];
  if (!knowledge) return { verified: false, rookieYear: null, card: null };

  const raw = String(title || "");
  const number = normalizeText(cardNum).replace(/\s+/g, "");
  const card = knowledge.cards.find(rule => {
    if (Number(rule.year) !== Number(year)) return false;
    if (rule.cardNum && normalizeText(rule.cardNum).replace(/\s+/g, "") !== number) return false;
    if (rule.titlePattern && !rule.titlePattern.test(raw)) return false;
    if (rule.rejectPattern && rule.rejectPattern.test(raw)) return false;
    return true;
  }) || null;

  return {
    verified: !!card,
    rookieYear: Number(knowledge.rookieYear) || null,
    card
  };
}

function monthlyPickApplyCardKnowledge(player, title, year, cardNum, traits) {
  const knowledge = monthlyPickVerifiedRookieKnowledge(player, title, year, cardNum);
  const raw = String(title || "");
  const prospectClaimed = /\b(prospect|draft(?:ed|\s+pick)?|minor\s+league|pre[-\s]?rookie)\b/i.test(raw);

  return {
    ...traits,
    rookieVerified: knowledge.verified,
    rookie: knowledge.verified,
    rookieVerification: knowledge.card ? {
      label: knowledge.card.label,
      source: knowledge.card.verification,
      set: knowledge.card.set || ""
    } : null,
    knownRookieYear: knowledge.rookieYear,
    prospectClaimed
  };
}

function monthlyPickEraInfo(year, traits, futureHof = false) {
  if (traits?.rookieVerified) {
    return {
      type: "verified_rookie",
      label: "VERIFIED ROOKIE",
      rookieYear: traits.knownRookieYear || year,
      verified: true
    };
  }

  const knownRookieYear = Number(traits?.knownRookieYear);
  if (futureHof && Number.isFinite(knownRookieYear) && Number(year) < knownRookieYear) {
    return {
      type: "pre_rookie_era",
      label: "EARLIER PRE-ROOKIE ERA",
      rookieYear: knownRookieYear,
      verified: true
    };
  }

  if (futureHof && traits?.prospectClaimed) {
    return {
      type: "prospect_claim",
      label: "PROSPECT / PRE-ROOKIE CLAIM",
      rookieYear: Number.isFinite(knownRookieYear) ? knownRookieYear : null,
      verified: false
    };
  }

  return null;
}

function monthlyPickTraits(title) {
  const raw = String(title || "");
  const graded = /\b(PSA|SGC|CGC|BGS|BVG|CSG|GMA|HGA|ISA)\s*(?:\d+(?:\.\d+)?|AUTHENTIC)\b|\bgraded\b|\bslab\b/i.test(raw);
  const autograph = /\b(auto(?:graph(?:ed)?)?|signed)\b/i.test(raw);
  const shortPrint = /\b(?:SP|SSP|short\s*print|super\s*short\s*print)\b|(?:^|\s)\d{1,4}\s*\/\s*\d{1,4}(?:\s|$)/i.test(raw);

  // Seller wording such as "Rookie" or "RC" is a discovery clue, not proof.
  // Until Scout has independent rookie-card metadata for a player/card,
  // never award a rookie badge or ranking/upgrade bonus from title claims alone.
  const rookieClaimed = /\brookie\b|\bRC\b/i.test(raw);
  const rookieVerified = false;
  const rookie = rookieVerified;

  return { graded, autograph, shortPrint, rookie, rookieClaimed, rookieVerified };
}

function monthlyPickCardNumber(title) {
  const m = String(title || "").match(/#\s*([A-Z0-9-]{1,12})\b/i);
  return m ? m[1] : "";
}


function monthlyPickSet(title) {
  const raw = String(title || "");

  // Specific products first. Seller titles often insert punctuation
  // ("Topps - Allen & Ginter's"), so do not depend on whitespace-only matches.
  const specific = [
    { rx: /\btopps\b[\s\-–—:]*\ballen\s*(?:&|and)\s*ginter(?:'s)?\b/i, set: "Topps Allen & Ginter" },
    { rx: /\ballen\s*(?:&|and)\s*ginter(?:'s)?\b/i, set: "Topps Allen & Ginter" },
    { rx: /\btopps\b[\s\-–—:]*\bopening\s+day\b/i, set: "Topps Opening Day" },
    { rx: /\btopps\b[\s\-–—:]*\bheritage\b/i, set: "Topps Heritage" },
    { rx: /\btopps\b[\s\-–—:]*\bchrome\b/i, set: "Topps Chrome" },
    { rx: /\btopps\b[\s\-–—:]*\bupdate\b/i, set: "Topps Update" },
    { rx: /\bbowman\b[\s\-–—:]*\bchrome\b[\s\-–—:]*\bdraft\b/i, set: "Bowman Chrome Draft" },
    { rx: /\bbowman\b[\s\-–—:]*\bdraft\b/i, set: "Bowman Draft" },
    { rx: /\bbowman\b[\s\-–—:]*\bchrome\b/i, set: "Bowman Chrome" },
    { rx: /\bbowman\b[\s\-–—:]*\bplatinum\b/i, set: "Bowman Platinum" },
    { rx: /\btristar\b[\s\-–—:]*\bprospects?\s+plus\b/i, set: "TriStar Prospects Plus" },
    { rx: /\btopps\b[\s\-–—:]*\b206\b/i, set: "Topps 206" },
    { rx: /\btopps\b[\s\-–—:]*\bnational\s+chicle\b/i, set: "Topps National Chicle" },
  ];
  const hit = specific.find(x => x.rx.test(raw));
  if (hit) return hit.set;

  const known = [
    "Topps", "Fleer", "Bowman", "Donruss", "Upper Deck", "Score", "Leaf",
    "Panini", "Goudey", "Play Ball", "Finest", "Heritage", "Chrome", "TriStar"
  ];
  return known.find(x => new RegExp(`\\b${x.replace(/\s+/g, "\\s+")}\\b`, "i").test(raw)) || "";
}

function monthlyPickGradeInfo(title) {
  const raw = String(title || "");
  const m = raw.match(/\b(PSA|SGC|CGC|BGS|BVG|CSG|GMA|HGA|ISA)\s*(10|9\.5|9|8\.5|8|7\.5|7|6\.5|6|5\.5|5|4\.5|4|3\.5|3|2\.5|2|1\.5|1|AUTHENTIC)\b/i);
  if (!m) return { grader: "Raw", grade: null, label: "Raw" };
  const grader = m[1].toUpperCase();
  const grade = m[2].toUpperCase() === "AUTHENTIC" ? null : Number(m[2]);
  return { grader, grade, label: `${grader}${grade !== null ? " " + grade : " AUTHENTIC"}` };
}

function monthlyPickNumericGrade(v) {
  if (v === null || v === undefined || v === "") return null;
  const direct = Number(v);
  if (Number.isFinite(direct) && direct >= 1 && direct <= 10) return direct;
  const m = String(v).match(/(?:^|\s)(10|9\.5|9|8\.5|8|7\.5|7|6\.5|6|5\.5|5|4\.5|4|3\.5|3|2\.5|2|1\.5|1)(?:\s|$)/);
  return m ? Number(m[1]) : null;
}


function monthlyPickNormalizeCardNum(v) {
  return String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function monthlyPickSameCard(candidate, currentCard) {
  const currentSet = normalizeText(currentCard?.set || "");
  const candidateSet = normalizeText(candidate?.set || "");
  const currentNum = monthlyPickNormalizeCardNum(currentCard?.cardNum);
  const candidateNum = monthlyPickNormalizeCardNum(candidate?.cardNum);

  const sameSet = currentSet && candidateSet && (
    currentSet === candidateSet ||
    currentSet.includes(candidateSet) ||
    candidateSet.includes(currentSet)
  );
  const sameNum = currentNum && candidateNum && currentNum === candidateNum;

  return !!(sameSet && sameNum);
}

function monthlyPickCurrentLikelyRookie(currentCard) {
  // Reserved hook for future independently verified rookie metadata.
  // Do not infer rookie status from collection notes, set names, or seller language.
  return false;
}

function monthlyPickCurrentTraits(currentCard) {
  const grader = String(currentCard?.grader || "Raw").trim();
  const grade = monthlyPickNumericGrade(currentCard?.grade) ?? monthlyPickNumericGrade(currentCard?.gradeCondition);
  const raw = `${currentCard?.description || ""} ${currentCard?.notes || ""}`;
  return {
    graded: !!grader && grader.toLowerCase() !== "raw",
    grader: grader || "Raw",
    grade,
    autograph: !!currentCard?.autograph || /\b(auto(?:graph(?:ed)?)?|signed)\b/i.test(raw),
    shortPrint: !!String(currentCard?.serial || "").trim() || /\b(?:SP|SSP|short\s*print|super\s*short\s*print)\b/i.test(raw),
    rookie: monthlyPickCurrentLikelyRookie(currentCard),
  };
}

function monthlyPickUpgradeAssessment({ raw, year, cardNum, set, traits, gradeInfo, currentCard }) {
  const currentYear = Number(currentCard?.cardYear || currentCard?.year);
  if (!Number.isFinite(currentYear) || currentYear <= 0) {
    return { qualifies: true, strength: 1, reason: "Scout could not determine your current card year, so this candidate needs your review." };
  }

  if (year < currentYear) {
    return {
      qualifies: true,
      strength: 1000 + Math.min(100, currentYear - year),
      reason: `${year} is older than your current ${currentYear} representative — Scout's strongest upgrade signal.`
    };
  }

  if (year > currentYear) {
    return { qualifies: false, strength: 0, reason: `Newer than your current ${currentYear} representative.` };
  }

  const cur = monthlyPickCurrentTraits(currentCard);
  const candidate = { set, cardNum };
  const sameCard = monthlyPickSameCard(candidate, currentCard);
  const reasons = [];
  let strength = 0;

  // Same exact card: higher numerical grade is a direct, unambiguous upgrade.
  if (sameCard && traits.graded && cur.graded &&
      gradeInfo.grade !== null && cur.grade !== null &&
      gradeInfo.grade > cur.grade) {
    const delta = gradeInfo.grade - cur.grade;
    strength += 180 + Math.round(delta * 25);
    reasons.push(`same card at a higher grade: ${cur.grader}${cur.grade !== null ? " " + cur.grade : ""} → ${gradeInfo.label}`);
  }

  // Same exact card: raw -> graded is also a meaningful upgrade.
  if (sameCard && !cur.graded && traits.graded) {
    strength += 130;
    reasons.push(`same card upgraded from raw to ${gradeInfo.label}`);
  }

  // A different card from the same year must be materially better, not merely different.
  // Do not let a raw alternate rookie beat an already graded current card.
  if (!sameCard) {
    if (!cur.graded && traits.graded) {
      strength += 70;
      reasons.push(`graded ${gradeInfo.label} versus your raw current card`);
    }

    if (traits.autograph && !cur.autograph) {
      strength += 50;
      reasons.push("autograph");
    }
    if (traits.shortPrint && !cur.shortPrint) {
      strength += 45;
      reasons.push("short print / numbered scarcity");
    }
  }

  if (!strength) {
    return {
      qualifies: false,
      strength: 0,
      reason: sameCard
        ? `Same card and year, but Scout did not find a higher grade or other meaningful improvement.`
        : `Same year as your current ${currentYear} card, but Scout did not find a meaningful improvement strong enough to replace your current representative.`
    };
  }

  return {
    qualifies: true,
    strength,
    sameCard,
    reason: `Same-year upgrade: ${reasons.join("; ")}.`
  };
}

function monthlyPickConditionInfo(item) {
  const title = String(item?.title || "");
  const listed = String(item?.condition || "");
  const text = `${title} ${listed}`;
  const slab = monthlyPickGradeInfo(title);

  const hardPassPatterns = [
    /\bpoor\s+(?:condition|shape)\b/i,
    /\bcondition\s*:\s*poor\b/i,
    /\bdamaged\b/i,
    /\bheav(?:y|ily)\s+creas(?:e|ed|ing)\b/i,
    /\bmultiple\s+creases\b/i,
    /\baltered\b/i,
    /\btrimmed\b/i,
    /\bwater\s+damage\b/i,
    /\btorn\b/i,
    /\bpaper\s+loss\b/i
  ];
  for (const rx of hardPassPatterns) {
    if (rx.test(text)) {
      return { ok: false, score: 0, label: "PASS", reason: "Condition is too compromised for a Scout recommendation." };
    }
  }

  if (/^\s*poor\s*$/i.test(listed) || /\b(?:condition|cond)\s*[-:]\s*poor\b/i.test(title) || /\bpoor\s*$/i.test(title)) {
    return { ok: false, score: 0, label: "PASS", reason: "Listing is described as Poor condition." };
  }

  let score = 50;
  let label = listed || "Condition not stated";

  const titleConditionChecks = [
    { rx: /\bgem[\s-]*(?:mint|mt)\b/i, label: "Gem Mint", score: 100 },
    { rx: /\bnm[\s\/-]*mt\b|\bnear[\s-]*mint\b/i, label: "NM-MT", score: 94 },
    { rx: /\bnm\b/i, label: "NM", score: 90 },
    { rx: /\bex[\s\/-]*mt\b|\bexcellent[\s-]*mint\b/i, label: "EX-MT", score: 84 },
    { rx: /\bvg[\s\/-]*ex\b|\bvery[\s-]*good[\s-]*excellent\b/i, label: "VG-EX", score: 68 },
    { rx: /\bgd[\s\/-]*vg\b|\bgood[\s-]*very[\s-]*good\b/i, label: "GD-VG", score: 52 },
    { rx: /\bfr[\s\/-]*gd\b|\bfair[\s-]*good\b/i, label: "FR-GD", score: 36 },
    { rx: /\bex\b|\bexcellent\b/i, label: "EX", score: 76 },
    { rx: /\bvg\b|\bvery[\s-]*good\b/i, label: "VG", score: 60 },
    { rx: /\bgd\b|\bgood\b/i, label: "GD", score: 45 },
    { rx: /\bfr\b|\bfair\b/i, label: "FR", score: 30 },
    { rx: /\bmint\b/i, label: "Mint", score: 98 },
  ];

  if (/\blow[-\s]*grade\b/i.test(title)) {
    score = 12;
    label = "Low grade";
  } else {
    const titleCondition = titleConditionChecks.find(x => x.rx.test(title));

    // For graded cards, slab grade is the primary condition display.
    // Collector wording in the title is appended when useful.
    if (slab.grader && slab.grader !== "Raw") {
      const slabScore = slab.grade !== null
        ? Math.max(55, Math.min(100, 50 + slab.grade * 5))
        : 70;
      score = titleCondition ? Math.max(slabScore, titleCondition.score) : slabScore;
      label = slab.label;
      if (titleCondition && !normalizeText(label).includes(normalizeText(titleCondition.label))) {
        label += ` · ${titleCondition.label}`;
      }
    } else if (titleCondition) {
      score = titleCondition.score;
      label = titleCondition.label;
    } else if (/\b(?:gem mint|mint)\b/i.test(listed)) { score = 100; label = listed || "Mint"; }
    else if (/\bnear mint\b|\bnm-mt\b|\bnm\b/i.test(listed)) { score = 92; label = listed || "Near Mint"; }
    else if (/\bexcellent[- ]mint\b|\bex-mt\b/i.test(listed)) { score = 84; label = listed || "EX-MT"; }
    else if (/\bexcellent\b|\bex\b/i.test(listed)) { score = 76; label = listed || "Excellent"; }
    else if (/\bvery good[- ]excellent\b|\bvg-ex\b|\bvgex\b/i.test(listed)) { score = 68; label = listed || "VG-EX"; }
    else if (/\bvery good\b|\bvg\b/i.test(listed)) { score = 60; label = listed || "Very Good"; }
    else if (/\bgood\b/i.test(listed)) { score = 45; label = listed || "Good"; }
    else if (/\bfair\b/i.test(listed)) { score = 30; label = listed || "Fair"; }
  }

  if (/\bcrease\b|\bcreased\b|\bcorner wear\b|\bsoft corners?\b|\bsurface wear\b/i.test(text)) {
    score = Math.min(score, 35);
    if (!/\blow[-\s]*grade\b/i.test(text) && !listed) label = "Visible wear";
  }

  let reason;
  if (/\blow[-\s]*grade\b/i.test(title)) {
    reason = "Listing is explicitly described as low grade; Scout keeps it eligible only as a lower-priority vintage option.";
  } else if (slab.grader && slab.grader !== "Raw") {
    reason = `Graded condition: ${label}.`;
  } else if (label && label !== listed && label !== "Condition not stated") {
    reason = `Collector condition found in listing title: ${label}.`;
  } else {
    reason = listed ? `Listed condition: ${listed}.` : "Condition was not clearly stated.";
  }

  return { ok: true, score, label, reason };
}

function monthlyPickSellerTrust(item, preferredSellers = []) {
  const seller = item?.seller || {};
  const username = String(seller.username || "").trim();
  const reviews = Number.isFinite(Number(seller.reviews)) ? Number(seller.reviews) : null;
  const positivePct = Number.isFinite(Number(seller.positivePct)) ? Number(seller.positivePct) : null;
  const preferredSet = new Set((preferredSellers || []).map(x => normalizeText(x)).filter(Boolean));
  const previousSeller = username && preferredSet.has(normalizeText(username));

  // A prior successful seller gets flexibility on feedback count, but not a truly bad rating.
  if (previousSeller) {
    if (positivePct !== null && positivePct < 95) {
      return {
        ok: false,
        reason: "Previously used seller, but current positive rating is below 95%.",
        previousSeller,
        username,
        reviews,
        positivePct,
        score: 0,
        label: "PASS"
      };
    }
    return {
      ok: true,
      reason: "You have bought from this seller before.",
      previousSeller,
      username,
      reviews,
      positivePct,
      score: 110 + Math.min(20, Math.log10(Math.max(1, reviews || 1)) * 5),
      label: "PREFERRED"
    };
  }

  // For an unfamiliar seller, Scout requires both a rating and a meaningful history.
  if (!username) {
    return { ok: false, reason: "Seller identity unavailable.", previousSeller: false, username, reviews, positivePct, score: 0, label: "PASS" };
  }
  if (reviews === null || reviews < 100) {
    return { ok: false, reason: "Seller has too little feedback history for a Scout recommendation.", previousSeller: false, username, reviews, positivePct, score: 0, label: "PASS" };
  }
  if (positivePct === null) {
    return { ok: false, reason: "Seller positive-feedback rating is unavailable.", previousSeller: false, username, reviews, positivePct, score: 0, label: "PASS" };
  }
  if (positivePct < 98) {
    return { ok: false, reason: "Seller positive-feedback rating is below Scout's 98% trust floor.", previousSeller: false, username, reviews, positivePct, score: 0, label: "PASS" };
  }

  let score = 60;
  let label = "GOOD";
  if (positivePct >= 99.8 && reviews >= 1000) { score = 100; label = "HIGH"; }
  else if (positivePct >= 99.5 && reviews >= 500) { score = 92; label = "HIGH"; }
  else if (positivePct >= 99.0 && reviews >= 250) { score = 82; label = "STRONG"; }
  else if (positivePct >= 98.5 && reviews >= 150) { score = 72; label = "GOOD"; }

  // Add a small volume bonus without letting volume overwhelm rating.
  score += Math.min(8, Math.max(0, Math.log10(Math.max(100, reviews)) - 2) * 4);

  return {
    ok: true,
    reason: `${positivePct.toFixed(1)}% positive with ${reviews.toLocaleString()} feedback.`,
    previousSeller: false,
    username,
    reviews,
    positivePct,
    score,
    label
  };
}

function monthlyPickRejectReason(item, player, budget, mode, currentCard, preferredSellers) {
  const raw = String(item.title || "");
  if (!monthlyPickPlayerMatches(raw, player)) return { reason: "Player name did not match." };
  if (item.format === "auction") return { reason: "Scout recommendations use directly buyable listings, not auctions." };
  if (!Number.isFinite(item.shipping) || !Number.isFinite(item.delivered)) return { reason: "Shipping was unclear." };
  if (item.delivered > budget) return { reason: "Over budget." };
  if (looksLikeLot(raw) || /\b(set|team set|complete set|you pick|choose|lot of|collection)\b/i.test(raw)) return { reason: "Multi-card / set listing." };
  if (isExplicitTeamCardListing(raw)) return { reason: "Team card / checklist listing." };
  if (isObviousNonTradingCardListing(raw)) return { reason: "Not a single physical card." };
  if (/\b(reprint|replica|facsimile|custom card|reissue|archives)\b/i.test(raw)) return { reason: "Reprint / replica / archive issue." };

  const year = monthlyPickYear(raw);
  if (!year) return { reason: "Card year could not be identified." };
  const cardNum = monthlyPickCardNumber(raw);
  const set = monthlyPickSet(raw);
  const traits = monthlyPickApplyCardKnowledge(player, raw, year, cardNum, monthlyPickTraits(raw));
  const gradeInfo = monthlyPickGradeInfo(raw);

  let upgrade = null;
  if (mode === "upgrade") {
    upgrade = monthlyPickUpgradeAssessment({
      raw,
      year,
      set,
      cardNum,
      traits,
      gradeInfo,
      currentCard
    });
    if (!upgrade.qualifies) return { reason: upgrade.reason, upgrade };
  }

  const conditionInfo = monthlyPickConditionInfo(item);
  if (!conditionInfo.ok) return { reason: conditionInfo.reason, conditionInfo, upgrade };

  const sellerTrust = monthlyPickSellerTrust(item, preferredSellers);
  if (!sellerTrust.ok) return { reason: sellerTrust.reason, sellerTrust, conditionInfo, upgrade };
  return { reason: "", sellerTrust, conditionInfo, upgrade, year, set, traits, gradeInfo, cardNum };
}

function monthlyPickTraitScore(traits) {
  // Age remains the primary collectible rule. These rank cards within the same year.
  // Only independently verified rookie status earns the rookie bonus.
  return (traits.rookieVerified ? 4 : 0) +
    (traits.graded ? 3 : 0) +
    (traits.autograph ? 2 : 0) +
    (traits.shortPrint ? 2 : 0);
}

function monthlyPickRepresentationInfo(title, player) {
  const raw = String(title || "");
  const normalized = normalizeText(raw);
  const requested = normalizeText(player);
  if (/\b(?:league\s+leaders?|leaders?|duo|trio|southpaws?|multi[\s-]*player|combo|battery mates?)\b/i.test(raw)) {
    return { type: "shared", label: "Shared player card", score: 84 };
  }
  const withoutPlayer = requested
    ? raw.replace(new RegExp(escapeRegExp(String(player || "").trim()), "ig"), " ")
    : raw;
  const stop = new Set([
    "topps","bowman","fleer","donruss","leaf","score","upper","deck","panini","goudey","play","ball",
    "vintage","baseball","card","hof","rookie","rc","graded","raw","excellent","mint","near","good","very",
    "los","angeles","new","york","san","francisco","dodgers","yankees","giants","cardinals","cubs","mets",
    "braves","reds","red","sox","white","tigers","orioles","pirates","phillies","athletics","indians","guardians"
  ]);
  const tokens = withoutPlayer.match(/\b[A-Z][a-z][A-Za-z'.-]*\b/g) || [];
  let run = 0;
  for (const token of tokens) {
    if (stop.has(token.toLowerCase())) run = 0;
    else if (++run >= 2) return { type: "shared", label: "Shared player card", score: 84 };
  }
  if (requested && normalized.includes(requested)) return { type: "individual", label: "Individual player card", score: 100 };
  return { type: "unknown", label: "Representation unclear", score: 92 };
}

function targetClampScore(value) {
  return Math.round(Math.max(0, Math.min(100, Number(value) || 0)) * 10) / 10;
}

function targetRankingInfo(candidate, oldestYear, budget, mode) {
  const yearGap = Math.max(0, Number(candidate.year) - Number(oldestYear));
  const traits = candidate.traits || {};
  const verifiedTraitScore =
    (traits.rookieVerified ? 35 : 0) +
    (traits.graded ? 20 : 0) +
    (traits.autograph ? 35 : 0) +
    (traits.shortPrint ? 20 : 0);
  const components = {
    // Age is deliberately the strongest factor. Each year away from the oldest
    // qualifying card costs 8 age points, but nearby premium cards can still win.
    age: targetClampScore(100 - yearGap * 8),
    upgradeStrength: targetClampScore(mode === "upgrade" ? Number(candidate.upgrade?.strength || 0) / 2.5 : 0),
    representation: targetClampScore(candidate.representationInfo?.score || 92),
    condition: targetClampScore(candidate.conditionInfo?.score || 0),
    sellerTrust: targetClampScore(candidate.sellerTrust?.score || 0),
    verifiedTraits: targetClampScore(verifiedTraitScore),
    deliveredPriceEfficiency: targetClampScore((1 - Number(candidate.delivered) / Number(budget)) * 100),
  };
  const total = targetClampScore(
    components.age * .50 + components.upgradeStrength * .03 + components.representation * .10 +
    components.condition * .12 + components.sellerTrust * .10 + components.verifiedTraits * .10 +
    components.deliveredPriceEfficiency * .05
  );
  return { oldestYear, yearGap, components, total };
}

function targetCandidateQualitySort(a, b) {
  return (b.ranking.total - a.ranking.total) ||
    (Number(a.year) - Number(b.year)) ||
    ((b.conditionInfo?.score || 0) - (a.conditionInfo?.score || 0)) ||
    ((b.sellerTrust?.score || 0) - (a.sellerTrust?.score || 0)) ||
    (a.delivered - b.delivered);
}

function targetBuildCandidateShortlist(candidates, budget, mode, player) {
  if (!candidates.length) return [];
  const oldestYear = Math.min(...candidates.map(x => Number(x.year)));
  // Rank every qualifying listing from the existing discovery searches. The
  // previous implementation discarded anything more than one year newer than
  // the oldest result, which could collapse a "Top 5" into a single card.
  for (const candidate of candidates) {
    candidate.representationInfo = monthlyPickRepresentationInfo(candidate.title, player);
    candidate.ranking = targetRankingInfo(candidate, oldestYear, budget, mode);
  }
  return candidates.slice().sort(targetCandidateQualitySort).slice(0, 5);
}

function targetMarketVerdictRank(marketCheck) {
  const label = String(marketCheck?.label || "").toUpperCase();
  if (label.includes("GREAT BUY")) return 4;
  if (label === "BUY" || label.includes(" BUY")) return 3;
  if (label.includes("FAIR") || label.includes("NEGOTIATE")) return 2;
  if (label.includes("PASS")) return 0;
  return 1;
}

function targetRankingAlternative(primary, alternatives) {
  const eligible = alternatives.filter(x => Number(x.year) - Number(primary.year) <= 1);
  if (!eligible.length) return null;
  const sameYear = eligible.filter(x => Number(x.year) === Number(primary.year)).sort(targetCandidateQualitySort)[0];
  const newer = eligible.filter(x => Number(x.year) === Number(primary.year) + 1).sort(targetCandidateQualitySort)[0];
  if (sameYear && sameYear.ranking.total >= primary.ranking.total - 12) return sameYear;
  return newer || sameYear || null;
}

function targetShouldMarketCheckAlternative(primary, alternative) {
  if (!primary || !alternative || Number(alternative.year) - Number(primary.year) > 1) return false;
  const condition = Number(primary.conditionInfo?.score || 0);
  const altCondition = Number(alternative.conditionInfo?.score || 0);
  const verdict = targetMarketVerdictRank(primary.marketCheck);
  const trustedCleanIndividual = condition >= 68 && Number(primary.sellerTrust?.score || 0) >= 70 &&
    primary.representation?.type === "individual" && verdict >= 2;
  if (trustedCleanIndividual) return false;
  if (Number(alternative.year) === Number(primary.year) && alternative.ranking.total >= primary.ranking.total - 12) return true;
  if (condition < 45 || verdict === 0) return true;
  if (primary.representation?.type === "shared" && alternative.representation?.type === "individual" && altCondition >= condition) return true;
  const savings = Number(primary.delivered) - Number(alternative.delivered);
  return savings >= Math.max(10, Number(primary.delivered) * .25);
}

function targetChooseRecommendation(primary, alternative) {
  if (!alternative) return primary;
  const yearGap = Number(alternative.year) - Number(primary.year);
  if (yearGap < 0 || yearGap > 1) return primary;
  const pCondition = Number(primary.conditionInfo?.score || 0);
  const aCondition = Number(alternative.conditionInfo?.score || 0);
  const pVerdict = targetMarketVerdictRank(primary.marketCheck);
  const aVerdict = targetMarketVerdictRank(alternative.marketCheck);
  if (yearGap === 0) {
    if (aVerdict >= pVerdict + 2 && aCondition >= pCondition - 10) {
      alternative.selectionMode = "same_year_best_value";
      alternative.selectionBadge = "BEST VALUE";
      alternative.selectionReason = `${alternative.marketCheck?.label || "Stronger market value"} beat the same-year alternative while collectible quality remained comparable.`;
      return alternative;
    }
    return primary;
  }
  const lowGradeUpgrade = pCondition < 45 && aCondition >= 45 && aCondition >= pCondition + 15;
  const passUpgrade = pVerdict === 0 && aVerdict >= 2 && aCondition >= pCondition - 5;
  const representationUpgrade = primary.representation?.type === "shared" && alternative.representation?.type === "individual" &&
    aCondition >= pCondition && aVerdict >= pVerdict;
  if (lowGradeUpgrade || passUpgrade || representationUpgrade) {
    alternative.selectionMode = "one_year_quality_upgrade";
    alternative.selectionBadge = "SMARTER PICK";
    alternative.selectionReason = lowGradeUpgrade
      ? "Scout chose the cleaner one-year-newer card over an oldest-year option below its 45-point condition standard."
      : passUpgrade
        ? `Scout chose the one-year-newer card because the oldest option was a market PASS and this card rated ${alternative.marketCheck?.label || "better"}.`
        : "Scout chose the individual one-year-newer card over a shared oldest-year card with no loss in condition or market verdict.";
    return alternative;
  }
  return primary;
}

function targetFinalizeSelection(selected, preliminary, checksPerformed) {
  selected.rankingVersion = TARGET_RANKING_VERSION;
  selected.marketChecksPerformed = Math.min(2, Number(checksPerformed) || 0);
  if (!selected.selectionMode) selected.selectionMode = "ranked_best_fit";
  if (!selected.selectionBadge) selected.selectionBadge = "SCOUT BEST FIT";
  if (!selected.selectionReason) {
    selected.selectionReason = "Scout ranked every qualifying listing from this search, with age carrying the most weight and collectible quality, seller trust, and price breaking close decisions.";
  }
  selected.why = `${selected.why || ""} ${selected.selectionReason}`.trim();
}

function monthlyPickWhy(suggestion, mode, currentCard, budget, purpose = "monthly") {
  const traits = suggestion.traits || {};
  const extras = [];
  if (traits.rookieVerified) extras.push("verified rookie");
  if (traits.graded) extras.push(suggestion.gradeInfo?.label || "graded");
  if (traits.autograph) extras.push("autograph");
  if (traits.shortPrint) extras.push("short print / numbered");

  let line;
  if (mode === "upgrade") {
    line = suggestion.upgrade?.reason || `Scout found a meaningful upgrade from your current ${currentCard?.cardYear || currentCard?.year || ""} representative.`;
  } else {
    line = purpose === "target"
      ? "Scout prioritized the oldest trustworthy directly buyable target it found for this player."
      : "Scout prioritized the oldest trustworthy directly buyable card it found for this player.";
  }

  if (suggestion.sellerTrust?.previousSeller) {
    line += " This is a seller you have successfully bought from before.";
  } else if (suggestion.sellerTrust?.reason) {
    line += ` Seller check: ${suggestion.sellerTrust.reason}`;
  }
  if (extras.length && mode !== "upgrade") line += ` Bonus traits: ${extras.join(", ")}.`;
  if (suggestion.eraInfo?.type === "pre_rookie_era") {
    line += ` This card predates Scout's verified ${suggestion.eraInfo.rookieYear} rookie-year cards, so Scout treats it as an earlier pre-rookie-era issue rather than an MLB rookie card.`;
  } else if (suggestion.eraInfo?.type === "verified_rookie" && suggestion.traits?.rookieVerification?.source) {
    line += ` Rookie status independently verified by ${suggestion.traits.rookieVerification.source}.`;
  }
  line += ` Delivered price is within your $${Number(budget).toFixed(2)} ${purpose === "target" ? "target" : "monthly"} budget.`;
  return line;
}

async function searchMonthlyPickListing({ player, budget, mode, currentCard, excludeIds, preferredSellers, apiKey, purpose = "monthly", searchHint = "", futureHof = false, maxQueries = 0 }) {
  // Monthly Pick intentionally remains one active-market search.
  // Find a Target may use a more focused discovery query so popular players
  // are not overwhelmed by modern cards that cannot qualify as upgrades.
  const currentYear = Number(currentCard?.cardYear || currentCard?.year);
  const cleanedHint = String(searchHint || "")
    .replace(new RegExp(escapeRegExp(player), "ig"), " ")
    .replace(/\s+/g, " ")
    .trim();

  let queries;
  if (purpose === "target" && mode === "upgrade") {
    const curGrade = monthlyPickCurrentTraits(currentCard);
    const sameCardQuery = [player, currentYear, currentCard?.set, currentCard?.cardNum ? `#${currentCard.cardNum}` : "", curGrade.graded ? "graded" : "", "baseball card"]
      .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

    if (cleanedHint) {
      queries = [
        `${player} ${cleanedHint} baseball card`,
        sameCardQuery
      ];
    } else if (curGrade.graded) {
      queries = [
        sameCardQuery,
        `${player} rookie baseball card`
      ];
    } else {
      queries = [
        `${player} rookie baseball card`,
        `${player} vintage baseball card`
      ];
    }
  } else if (purpose === "target" && mode === "need" && futureHof) {
    // Future HOF candidates can have meaningful prospect/pre-rookie issues that
    // predate their recognized MLB rookie cards. Search that era first.
    if (cleanedHint) {
      queries = [
        `${player} ${cleanedHint} baseball card`,
        `${player} prospect baseball card`
      ];
    } else {
      queries = [
        `${player} prospect baseball card`,
        `${player} rookie baseball card`
      ];
    }
  } else if (purpose === "target" && mode === "need") {
    // Need-player discovery should not drown in cheap modern/reprint-era listings.
    // Start with a saved target clue when present; otherwise search rookie-era first,
    // then broader vintage listings. Age-first ranking happens after these searches.
    if (cleanedHint) {
      queries = [
        `${player} ${cleanedHint} baseball card`,
        `${player} rookie baseball card`
      ];
    } else {
      queries = [
        `${player} rookie baseball card`,
        `${player} vintage baseball card`
      ];
    }
  } else {
    queries = [`${player} baseball card`];
  }

  queries = uniqueStrings(queries.map(q => q.replace(/\s+/g, " ").trim()).filter(Boolean)).slice(0, purpose === "target" ? 2 : 1);

  const excluded = new Set((excludeIds || []).map(String));
  const accepted = [];
  const rejected = [];
  let rawCount = 0;
  const usedQueries = [];

  const queryBatch = Number(maxQueries) > 0 ? queries.slice(0, Math.max(1, Math.floor(Number(maxQueries)))) : queries;

  for (const query of queryBatch) {
    const data = await runActiveEbaySearch(query, apiKey);
    usedQueries.push(query);
    const raw = Array.isArray(data.organic_results) ? data.organic_results : [];
    rawCount += raw.length;
    const normalized = dedupe(raw.map(normalizeActiveEbayResult).filter(Boolean));

    for (const item of normalized) {
      if (excluded.has(String(item.id)) || (item.productId && excluded.has(String(item.productId)))) continue;

      const screening = monthlyPickRejectReason(item, player, budget, mode, currentCard, preferredSellers);
      if (screening.reason) {
        rejected.push({
          id: item.id,
          title: item.title,
          reason: screening.reason,
          seller: item.seller || null
        });
        continue;
      }

      const year = screening.year || monthlyPickYear(item.title);
      const cardNum = screening.cardNum || monthlyPickCardNumber(item.title);
      const traits = screening.traits || monthlyPickApplyCardKnowledge(player, item.title, year, cardNum, monthlyPickTraits(item.title));
      const gradeInfo = screening.gradeInfo || monthlyPickGradeInfo(item.title);
      accepted.push({
        ...item,
        year,
        set: screening.set || monthlyPickSet(item.title),
        cardNum,
        traits,
        eraInfo: monthlyPickEraInfo(year, traits, futureHof),
        gradeInfo,
        traitScore: monthlyPickTraitScore(traits),
        sellerTrust: screening.sellerTrust,
        conditionInfo: screening.conditionInfo || monthlyPickConditionInfo(item),
        upgrade: screening.upgrade || null,
        discoveryQuery: query,
      });
    }

    // If a saved-target hint produced good-condition qualifying choices, do not
    // burn a second provider search. But a rough/low-grade result is only a
    // fallback, so keep searching for a cleaner qualifying copy.
    if (accepted.length && cleanedHint) {
      const bestConditionScore = Math.max(...accepted.map(x => Number(x.conditionInfo?.score) || 0));
      if (bestConditionScore >= 45) break;
    }
  }

  // Dedupe across multiple discovery queries.
  const uniqueAccepted = dedupe(accepted);

  let targetCandidates = [];
  if (purpose === "target") {
    targetCandidates = targetBuildCandidateShortlist(uniqueAccepted, budget, mode, player);
  } else {
    // Monthly Pick deliberately keeps its established oldest-first ordering.
    uniqueAccepted.sort((a, b) =>
      (a.year - b.year) ||
      (mode === "upgrade" ? ((b.upgrade?.strength || 0) - (a.upgrade?.strength || 0)) : 0) ||
      ((b.conditionInfo?.score || 0) - (a.conditionInfo?.score || 0)) ||
      ((b.sellerTrust?.score || 0) - (a.sellerTrust?.score || 0)) ||
      (b.traitScore - a.traitScore) ||
      (a.delivered - b.delivered)
    );
  }

  const best = purpose === "target" ? (targetCandidates[0] || null) : (uniqueAccepted[0] || null);
  if (!best) {
    return {
      query: usedQueries.join(" | "),
      queries: usedQueries,
      searched: rawCount,
      eligible: 0,
      suggestion: null,
      suggestions: [],
      alternatesAvailable: 0,
      checkedAt: new Date().toISOString(),
      shippingDestinationZip: ACTIVE_EBAY_SHIP_TO_ZIP,
      message: `Scout did not find a trustworthy directly buyable ${mode === "upgrade" ? "upgrade for " : ""}${player} under $${Number(budget).toFixed(2)} in this search.`,
      notes: [`Shipping calculated for ZIP ${ACTIVE_EBAY_SHIP_TO_ZIP}.`]
    };
  }

  const buildSuggestion = candidate => {
    const lowConditionFallback = (Number(candidate.conditionInfo?.score) || 0) < 45;
    const suggestion = {
    id: candidate.id,
    productId: candidate.productId,
    title: candidate.title,
    year: candidate.year,
    set: candidate.set,
    cardNum: candidate.cardNum,
    gradeInfo: candidate.gradeInfo,
    upgrade: candidate.upgrade,
    price: candidate.price,
    shipping: candidate.shipping,
    delivered: candidate.delivered,
    condition: candidate.condition,
    link: candidate.link,
    thumbnail: candidate.thumbnail,
    seller: candidate.seller,
    sellerTrust: candidate.sellerTrust,
    conditionInfo: candidate.conditionInfo,
    acceptsOffers: candidate.acceptsOffers,
    traits: candidate.traits,
    eraInfo: candidate.eraInfo || null,
    discoveryQuery: candidate.discoveryQuery,
    lowConditionFallback,
    ...(purpose === "target" ? {
      rankingVersion: TARGET_RANKING_VERSION,
      ranking: candidate.ranking,
      representation: candidate.representationInfo,
      selectionMode: "oldest_best_fit",
      selectionBadge: "OLDEST BEST FIT"
    } : {})
  };
    suggestion.why = monthlyPickWhy(suggestion, mode, currentCard, budget, purpose);
    if (lowConditionFallback) {
      suggestion.why += " Condition warning: this is a lower-condition fallback. Scout checked its available focused searches and did not find a cleaner qualifying option within the current budget.";
    }
    return suggestion;
  };
  const targetShortlist = purpose === "target" ? targetCandidates.map(buildSuggestion) : [];
  const rankedPool = purpose === "target"
    ? targetShortlist
    : uniqueAccepted.slice(0, 5).map(buildSuggestion);
  const suggestions = rankedPool.slice(0, 5).map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
  }));
  const suggestion = suggestions[0] || buildSuggestion(best);

  return {
    query: usedQueries.join(" | "),
    queries: usedQueries,
    searched: rawCount,
    eligible: uniqueAccepted.length,
    suggestion,
    suggestions,
    ...(purpose === "target" ? { _targetShortlist: targetShortlist } : {}),
    alternatesAvailable: Math.max(0, uniqueAccepted.length - 1),
    checkedAt: new Date().toISOString(),
    shippingDestinationZip: ACTIVE_EBAY_SHIP_TO_ZIP,
    notes: [
      `Shipping calculated for ZIP ${ACTIVE_EBAY_SHIP_TO_ZIP}.`,
      purpose === "target" ? "Find a Target uses focused active eBay discovery queries for upgrade hunts." : "Monthly Pick uses one active eBay search per recommendation attempt.",
      purpose === "target" && cleanedHint ? "Scout used your existing saved target as a discovery clue before falling back to rookie-era listings." : "",
      purpose === "target" && !cleanedHint && mode === "upgrade" ? "Without a saved target clue, Scout searches rookie-era and vintage listings instead of a generic modern-heavy result pool." : "",
      purpose === "target" && mode === "need" && futureHof ? "Future HOF target searches check prospect/pre-rookie listings before recognized rookie-era listings." : "",
      purpose === "target" && mode === "need" && !futureHof ? "Need-player searches use rookie-era and vintage discovery instead of a generic modern-heavy result pool." : "",
      "The word Rookie/RC in an eBay title is only a discovery clue unless Scout's independent card knowledge verifies the exact card.",
      "Independently verified rookie cards may earn a verified-rookie badge and same-year trait bonus; an earlier issue still ranks ahead because age remains primary.",
      "Listings described as Poor, Damaged, heavily creased, altered, trimmed, torn, water-damaged, or with paper loss are rejected.",
      "Listings explicitly described as Low Grade remain eligible for vintage collecting, but receive a major condition penalty so cleaner same-year copies rank ahead of them.",
      "A low-grade result does not stop Find a Target's focused discovery early; Scout checks its fallback search for a cleaner qualifying copy before settling for rough condition.",
      "Unfamiliar sellers normally need at least 100 feedback and 98% positive feedback.",
      "A seller you have successfully bought from before is treated as preferred, unless the current rating is materially poor.",
      "Collector-style title conditions such as GD-VG, VG-EX, EX-MT, and NM override generic marketplace labels such as Pre-Owned.",
      "For graded cards, Scout displays the slab company and numerical grade first, with collector condition wording appended when present.",
      "After the condition and seller trust gates, age is ranked first; condition only breaks otherwise comparable choices.",
      "For an owned player, an older card qualifies automatically.",
      "For same-year upgrades, the same card at a higher numerical grade is a direct upgrade; seller rookie claims do not count as upgrade evidence.",
      purpose === "target" ? "A new batch keeps the same player and excludes the prior ranked choices." : "A new batch keeps the same monthly Hall of Famer and excludes the prior ranked choices."
    ].filter(Boolean)
  };
}

function activeDealVerdict(total, targets) {
  if (total <= targets.greatBuy) return { tier: "great", label: "GREAT BUY", rank: 4 };
  if (total <= targets.buyCeiling) return { tier: "buy", label: "BUY", rank: 3 };
  if (total <= targets.walkAway) return { tier: "fair", label: "FAIR / NEGOTIATE", rank: 2 };
  return { tier: "pass", label: "PASS", rank: 1 };
}

async function runActiveEbaySearch(query, apiKey) {
  const params = new URLSearchParams({
    engine: "ebay",
    ebay_domain: "ebay.com",
    _nkw: query,
    _ipg: String(DEALS_SEARCH_COUNT),
    _sop: "15",
    _salic: "1",
    _stpos: ACTIVE_EBAY_SHIP_TO_ZIP,
    api_key: apiKey,
  });

  const endpoint = `https://serpapi.com/search.json?${params.toString()}`;
  const res = await fetchWithTimeout(
    endpoint,
    { headers: { "Accept": "application/json" } },
    DEALS_TIMEOUT_MS,
    "Active eBay search timed out"
  );
  const data = await res.json().catch(() => ({}));
  const status = data?.search_metadata?.status;
  const providerError = String(data?.error || "");
  const noResults = /hasn['’]?t returned any results|no results|did not return any results/i.test(providerError);

  // SerpApi sometimes expresses a legitimate zero-result eBay search in the
  // "error" field. That is not a provider outage and should not fail Scout.
  if (noResults) {
    return {
      ...data,
      error: undefined,
      organic_results: [],
      scout_no_results: true
    };
  }

  if (!res.ok || status === "Error" || data.error) {
    const err = new Error(data.error || `Active eBay provider returned HTTP ${res.status}.`);
    err.status = res.status >= 400 ? res.status : 502;
    throw err;
  }
  return data;
}


function buildActiveFallbackQuery(card) {
  // Broaden discovery only. Scout's identity filter below still requires the
  // correct player/year/set/card number before a listing can be accepted.
  return [card.player, card.year, card.set].filter(Boolean).join(" ");
}

async function searchActiveEbayDeals(card, targets, apiKey) {
  const query = buildQuery(card);
  let data = await runActiveEbaySearch(query, apiKey);
  let raw = Array.isArray(data.organic_results) ? data.organic_results : [];
  let fallbackQuery = "";
  let usedFallback = false;

  if (!raw.length) {
    fallbackQuery = buildActiveFallbackQuery(card);
    if (fallbackQuery && normalizeText(fallbackQuery) !== normalizeText(query)) {
      const fallbackData = await runActiveEbaySearch(fallbackQuery, apiKey);
      const fallbackRaw = Array.isArray(fallbackData.organic_results) ? fallbackData.organic_results : [];
      if (fallbackRaw.length) {
        data = fallbackData;
        raw = fallbackRaw;
        usedFallback = true;
      }
    }
  }

  const normalized = dedupe(raw.map(normalizeActiveEbayResult).filter(Boolean));

  const accepted = [];
  const rejected = [];

  for (const item of normalized) {
    const reason = activeDealMismatchReason(item, card);
    if (reason) {
      rejected.push({
        id: item.id,
        title: item.title,
        price: item.price,
        shipping: item.shipping,
        delivered: item.delivered,
        link: item.link,
        seller: item.seller,
        reason,
      });
      continue;
    }

    if (item.format === "auction") {
      if (targets) {
        const maxBid = Math.max(0, targets.buyCeiling - item.shipping);
        const biddingRoom = maxBid - item.price;
        accepted.push({
          ...item,
          maxBid,
          biddingRoom,
          watch: biddingRoom >= 0,
          dealTier: biddingRoom >= 0 ? "watch" : "pass",
          dealLabel: biddingRoom >= 0 ? "WATCH AUCTION" : "PASS",
        });
      } else {
        accepted.push({
          ...item,
          maxBid: null,
          biddingRoom: null,
          watch: false,
          dealTier: "unrated",
          dealLabel: "UNRATED",
        });
      }
    } else {
      if (targets) {
        const v = activeDealVerdict(item.delivered, targets);
        accepted.push({
          ...item,
          dealTier: v.tier,
          dealLabel: v.label,
          dealRank: v.rank,
        });
      } else {
        accepted.push({
          ...item,
          dealTier: "unrated",
          dealLabel: "UNRATED",
          dealRank: 0,
        });
      }
    }
  }

  const bins = accepted
    .filter(x => x.format !== "auction")
    .sort((a, b) => targets
      ? ((b.dealRank - a.dealRank) || (a.delivered - b.delivered))
      : (a.delivered - b.delivered))
    .slice(0, DEALS_BIN_LIMIT);

  const auctions = accepted
    .filter(x => x.format === "auction")
    .sort((a, b) => targets
      ? ((Number(b.watch) - Number(a.watch)) || (b.biddingRoom - a.biddingRoom) || (a.delivered - b.delivered))
      : (a.delivered - b.delivered))
    .slice(0, DEALS_AUCTION_LIMIT);

  return {
    query,
    fallbackQuery: usedFallback ? fallbackQuery : "",
    usedFallback,
    searched: raw.length,
    normalized: normalized.length,
    matched: accepted.length,
    rated: Boolean(targets),
    targets,
    buyItNow: bins,
    auctions,
    rejected: rejected.slice(0, DEALS_REJECT_LIMIT),
    rejectedCount: rejected.length,
    checkedAt: new Date().toISOString(),
    shippingDestinationZip: ACTIVE_EBAY_SHIP_TO_ZIP,
    notes: [
      `Shipping calculated for ZIP ${ACTIVE_EBAY_SHIP_TO_ZIP}.`,
      "Deal Finder uses active eBay search results and includes visible shipping in delivered price.",
      usedFallback
        ? "The strict active search returned no results, so Scout retried with a broader discovery query and still applied the full exact-card identity filter."
        : "The strict active search returned usable discovery results.",
      "Tax is not included because the final tax depends on the buyer's checkout location.",
      "Scout rejects title mismatches, lots, wrong grading state, reprints, and listings with unclear shipping before ranking.",
      targets
        ? "Auction MAX BID equals Buy Ceiling minus visible shipping; the current bid is never treated as a guaranteed purchase price."
        : "Sold evidence was insufficient for Smart Buy Targets, so Scout sorted active listings by delivered price without assigning Buy/Pass or MAX BID labels."
    ]
  };
}


function serpApiTargetAttempt(kind, settledEntry, card) {
  if (settledEntry.status === "rejected") {
    const error = settledEntry.reason || new Error("SerpApi target search failed.");
    const message = String(error?.message || error || "SerpApi target search failed.");
    const timedOut = error?.code === "serp_async_incomplete" || /timed out while still|still (?:queued|processing)/i.test(message);
    return {
      kind,
      ok: false,
      raw: [],
      normalized: [],
      evaluation: evaluateComparableResults([], card),
      diagnostic: {
        rows: 0,
        matches: 0,
        status: timedOut ? "timed_out" : "failed",
        note: message,
      },
    };
  }

  const raw = Array.isArray(settledEntry.value?.organic_results)
    ? settledEntry.value.organic_results
    : [];
  const normalized = dedupeSoldComps(raw.map(normalizeResult).filter(Boolean));
  const evaluation = evaluateComparableResults(normalized, card);
  return {
    kind,
    ok: true,
    raw,
    normalized,
    evaluation,
    diagnostic: {
      rows: raw.length,
      matches: evaluation.matchedItems.length,
      status: "completed",
      note: "",
    },
  };
}

async function searchSerpApiTargetEnrichment(card, query, broadQuery, apiKey, profile) {
  const maxWaitMs = profile.extraWaitMs || TARGET_ENRICHMENT_WAIT_MS;
  const startedAt = Date.now();
  const settled = await Promise.allSettled([
    runEbaySearchAsync(query, apiKey, "Sold", maxWaitMs, true),
    runEbaySearchAsync(broadQuery, apiKey, "Sold", maxWaitMs, true),
  ]);

  const exact = serpApiTargetAttempt("exact", settled[0], card);
  const broad = serpApiTargetAttempt("broad", settled[1], card);
  const providerDiagnostics = {
    serpApi: {
      exact: exact.diagnostic,
      broad: broad.diagnostic,
      wallClockMs: Math.max(0, Date.now() - startedAt),
      budgetMs: maxWaitMs,
    },
  };

  if (!exact.ok && !broad.ok) {
    const error = new Error(
      `SerpApi target enrichment did not complete. Exact: ${exact.diagnostic.note} Broad: ${broad.diagnostic.note}`
    );
    error.code = "serp_target_enrichment_incomplete";
    error.providerDiagnostics = providerDiagnostics;
    throw error;
  }

  const normalized = dedupeSoldComps([
    ...(exact.ok ? exact.normalized : []),
    ...(broad.ok ? broad.normalized : []),
  ]);
  const evaluation = evaluateComparableResults(normalized, card);
  const searched = exact.diagnostic.rows + broad.diagnostic.rows;
  const attempts = [exact, broad].map(attempt => {
    const label = attempt.kind === "exact" ? "Exact Sold" : "Broad Sold";
    if (attempt.ok) {
      return `${label}: ${attempt.diagnostic.rows} rows / ${attempt.diagnostic.matches} exact-card matches (async completed)`;
    }
    return `${label}: ${attempt.diagnostic.note}`;
  });
  const notes = buildNotes(card, searched, evaluation.matchedItems.length, evaluation.cleaned.length, evaluation.confidence);
  notes.unshift(`SerpApi parallel target discovery: ${attempts.join(" | ")}`);
  notes.unshift(`Scout started the exact and broad SerpApi Sold searches concurrently with one ${Math.round(maxWaitMs/1000)}-second wall-clock budget, then deduped their rows and reapplied every card-matching and outlier rule.`);
  if (!exact.ok || !broad.ok) {
    notes.unshift("One SerpApi target search did not finish, so Scout preserved the completed search evidence instead of treating the provider as wholly unavailable.");
  }
  if (evaluation.matchMode === "relaxed") {
    notes.push("Scout used a controlled relaxed title match because eBay sellers format grades/card numbers inconsistently.");
  }

  return {
    ...evaluation,
    searched,
    matched: evaluation.matchedItems.length,
    searchMode: "Sold-target-parallel-async-exact+broad",
    discoveryQuery: `${query} | ${broadQuery}`,
    providerDiagnostics,
    notes,
  };
}

async function searchSerpApi(card, query, apiKey, fastMode=false, options={}) {
  const profile = normalizeValuationProfile(options);
  const broadQuery = buildBroadSoldQuery(card);
  if (profile.targetEnrichment) {
    return searchSerpApiTargetEnrichment(card, query, broadQuery, apiKey, profile);
  }
  const attempts = [];
  let data = null;
  let emptyData = null;
  let searchMode = "";
  let usedQuery = query;

  async function syncAttempt(q, mode, timeoutMs, label) {
    try {
      const result = await runEbaySearch(q, apiKey, mode, false, timeoutMs);
      const count = Array.isArray(result?.organic_results) ? result.organic_results.length : 0;
      attempts.push(`${label}: ${count} result${count === 1 ? "" : "s"}`);
      return { ok: true, data: result, count };
    } catch (err) {
      attempts.push(`${label}: ${err?.message || "failed"}`);
      return { ok: false, error: err };
    }
  }

  async function asyncAttempt(q, mode, label, maxWaitMs=SERP_ASYNC_MAX_WAIT_MS, totalBudget=false) {
    try {
      const result = await runEbaySearchAsync(q, apiKey, mode, maxWaitMs, totalBudget);
      const count = Array.isArray(result?.organic_results) ? result.organic_results.length : 0;
      attempts.push(`${label}: ${count} result${count === 1 ? "" : "s"} (async)`);
      return { ok: true, data: result, count };
    } catch (err) {
      attempts.push(`${label}: ${err?.message || "failed"}`);
      return { ok: false, error: err };
    }
  }

  // 1) Exact search stays synchronous so cache hits / quick responses return fast.
  const strictSold = await syncAttempt(
    query,
    "Sold",
    SERP_SOLD_STRICT_TIMEOUT_MS,
    "Strict Sold"
  );

  if (strictSold.ok) {
    if (strictSold.count > 0) {
      data = strictSold.data;
      searchMode = "Sold";
      usedQuery = query;
    } else {
      emptyData = strictSold.data;
    }
  }

  // Fast Mode never starts the slow 30-second broad poll. The parallel Card API
  // primary can answer from two clean exact-card comps while SerpApi stays quick.
  if (!data && fastMode) {
    if (emptyData) {
      data = emptyData;
      searchMode = "Sold-fast-no-results";
      usedQuery = query;
    } else {
      throw new Error(`Fast sold search failed. ${attempts.join(" | ")}`);
    }
  }

  // 2) Deep Mode broad discovery uses SerpApi's async mode. Sold and Completed
  // are submitted together, then each is polled through Search Archive.
  if (!data) {
    const [broadSold, broadCompleted] = await Promise.all([
      asyncAttempt(broadQuery, "Sold", "Broad Sold"),
      asyncAttempt(broadQuery, "Complete", "Broad Completed")
    ]);

    if (broadSold.ok && broadSold.count > 0) {
      data = broadSold.data;
      searchMode = "Sold-broad-async";
      usedQuery = broadQuery;
    } else if (broadCompleted.ok && broadCompleted.count > 0) {
      data = broadCompleted.data;
      searchMode = "Complete-broad-async-sold-only";
      usedQuery = broadQuery;
    } else {
      if (!emptyData && broadSold.ok) emptyData = broadSold.data;
      if (!emptyData && broadCompleted.ok) emptyData = broadCompleted.data;
    }
  }

  if (!data && emptyData) {
    data = emptyData;
    searchMode = "Sold-no-results";
    usedQuery = broadQuery;
  }

  if (!data) {
    throw new Error(`Sold search attempts failed. ${attempts.join(" | ")}`);
  }

  let raw = Array.isArray(data.organic_results) ? data.organic_results : [];
  if (searchMode === "Complete-broad-async-sold-only") {
    raw = raw.filter(r => Boolean(r && r.sold_date));
  }

  const normalized = raw.map(normalizeResult).filter(Boolean);
  const evaluation = evaluateComparableResults(normalized, card);

  const notes = buildNotes(card, raw.length, evaluation.matchedItems.length, evaluation.cleaned.length, evaluation.confidence);
  notes.unshift(`Sold discovery: ${attempts.join(" | ")}`);

  if (usedQuery !== query) {
    notes.unshift("The strict sold search did not produce usable discovery, so Scout broadened the eBay query and then reapplied the full exact-card identity filter.");
  }
  if (searchMode === "Sold-broad-async" || searchMode === "Complete-broad-async-sold-only") {
    notes.unshift("Scout used SerpApi asynchronous eBay discovery and Search Archive polling so slow sold searches could finish without timing out the individual provider connection.");
  }
  if (searchMode === "Complete-broad-async-sold-only") {
    notes.unshift("Scout kept only Completed entries explicitly marked sold.");
  }
  if (searchMode === "Sold-no-results" || searchMode === "Sold-fast-no-results") {
    notes.unshift("SerpApi returned no sold listings for the available searches; Scout preserved that as a thin-market result instead of reporting a provider outage.");
  }
  if (evaluation.matchMode === "relaxed") {
    notes.push("Scout used a controlled relaxed title match because eBay sellers format grades/card numbers inconsistently.");
  }
  return {
    ...evaluation,
    searched: raw.length,
    matched: evaluation.matchedItems.length,
    searchMode,
    discoveryQuery: usedQuery,
    notes,
  };
}

function isApifyAuthenticationError(error) {
  const status = Number(error?.status);
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || error || "");
  return status === 401 || status === 403 || code === "apify_auth_invalid" ||
    /user was not found|authentication token is not valid|invalid authentication token|invalid apify token|unauthori[sz]ed/i.test(message);
}

async function deepPriceCheck(card, env) {
  const baselineEntry = await readValuationCache(card, true);
  const baseline = baselineEntry?.result
    ? withCurrentShopVerdict(baselineEntry.result, card, true)
    : null;
  const baselineComps = Array.isArray(baseline?.comps) ? baseline.comps : [];
  const baselineUsed = valuationEvidenceCount(baseline);

  const apify = await searchApify(
    card,
    buildQuery(card),
    env.APIFY_TOKEN,
    false,
    env.CARD_API_KEY || ""
  );

  // Cache entries contain comps that already passed Scout's identity rules,
  // but re-run the current rules after combining them with on-demand evidence.
  const combinedRows = dedupeSoldComps([
    ...baselineComps,
    ...(Array.isArray(apify?.matchedItems) ? apify.matchedItems : []),
  ]);
  const combinedEvaluation = evaluateComparableResults(combinedRows, card);
  const provider = baseline
    ? `${baseline.provider || "cached verified eBay sold results"} + Apify`
    : "eBay sold results via Apify";
  const searchMode = [baseline?.searchMode, apify?.searchMode]
    .filter(Boolean)
    .join(" + ");
  const candidateRaw = finalizeValuation(card, buildQuery(card), combinedEvaluation.matchedItems, {
    provider,
    searchMode,
    matchMode: combinedEvaluation.matchMode,
    searched: Number(baseline?.searched || 0) + Number(apify?.searched || 0),
    matched: combinedEvaluation.matchedItems.length,
    providerDiagnostics: baseline?.providerDiagnostics || {},
    notes: uniqueStrings([
      ...(Array.isArray(baseline?.notes) ? baseline.notes : []),
      ...(Array.isArray(apify?.notes) ? apify.notes : []),
      "Deep Price Check was requested explicitly and was not written to Scout's normal valuation cache.",
    ]),
    mode: "deep-price-check",
    bestOfferRecovered: Number(baseline?.bestOfferRecovered || 0) + Number(apify?.bestOfferRecovered || 0),
    bestOfferRecoveryAttempted: Number(baseline?.bestOfferRecoveryAttempted || 0) + Number(apify?.bestOfferRecoveryAttempted || 0),
  });
  const candidate = {
    ...withCurrentShopVerdict(candidateRaw, card, false),
    cachePolicy: "on-demand Deep Price Check; not persisted to the normal valuation cache",
  };
  const improved = baseline
    ? isValuationEvidenceStronger(candidate, baseline)
    : valuationEvidenceCount(candidate) > 0;
  const valuation = improved || !baseline ? candidate : baseline;
  const uniqueCompsAdded = improved
    ? Math.max(0, valuationEvidenceCount(candidate) - baselineUsed)
    : 0;
  const diagnostics = {
    baselineComps: baselineUsed,
    baselineCacheStatus: baselineEntry ? (baselineEntry.fresh ? "fresh" : "retained") : "not_available",
    apifyRowsSearched: pricingDiagnosticCount(apify?.searched),
    apifyExactMatches: pricingDiagnosticCount(apify?.matchedItems?.length),
    uniqueCompsAdded,
    finalCompsUsed: valuationEvidenceCount(valuation),
    bestOfferPricesRecovered: pricingDiagnosticCount(apify?.bestOfferRecovered),
    improved,
    status: "completed",
  };

  return { valuation, diagnostics };
}

async function searchApify(card, query, token, fastMode=false, cardApiKey="") {
  const count = fastMode ? APIFY_FAST_COUNT : APIFY_DEEP_COUNT;
  const timeoutSeconds = fastMode ? APIFY_FAST_TIMEOUT_SECONDS : APIFY_DEEP_TIMEOUT_SECONDS;
  const input = {
    keywords: [buildApifyQuery(card)],
    categoryId: "212",
    daysToScrape: 90,
    count,
    ebaySite: "ebay.com",
    sortOrder: "endedRecently",
    itemLocation: "default",
    itemCondition: "any",
    includeCompletedListings: true,
  };

  const endpoint = new URL("https://api.apify.com/v2/acts/caffein.dev~ebay-sold-listings/run-sync-get-dataset-items");
  endpoint.searchParams.set("timeout", String(timeoutSeconds));
  endpoint.searchParams.set("maxItems", String(count));
  endpoint.searchParams.set("maxTotalChargeUsd", "0.25");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("clean", "true");

  const res = await fetch(endpoint.toString(), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(input),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || `Apify returned HTTP ${res.status}.`;
    const error = new Error(msg);
    error.status = res.status;
    if (isApifyAuthenticationError(error)) {
      error.code = "apify_auth_invalid";
      error.message = "Apify authentication is invalid.";
    }
    throw error;
  }
  if (!Array.isArray(data)) throw new Error("Apify returned an unexpected response.");

  const normalized = data.map(normalizeApifyResult).filter(Boolean);

  let recovery = { attempted: 0, recovered: [], misses: [] };
  if (cardApiKey) {
    recovery = await recoverBestOffersFromExistingApifyRows(card, data, cardApiKey, fastMode);
  }

  const normalizedWithRecovered = [...normalized, ...recovery.recovered];
  const evaluation = evaluateComparableResults(normalizedWithRecovered, card);
  const rejectedBeforeMatching = data.length - normalized.length;
  const notes = buildNotes(card, data.length, evaluation.matchedItems.length, evaluation.cleaned.length, evaluation.confidence);

  if (rejectedBeforeMatching > 0) {
    notes.push(`${rejectedBeforeMatching} Apify result${rejectedBeforeMatching === 1 ? " was" : "s were"} rejected before card matching (for example Best Offer, unknown price range, non-USD, or invalid/future sale date).`);
  }
  if (recovery.recovered.length > 0) {
    notes.push(`${recovery.recovered.length} Best Offer accepted price${recovery.recovered.length === 1 ? " was" : "s were"} recovered from The Card API and included as confirmed sold comps.`);
    notes.push("Because this valuation contains The Card API transaction data, Scout will not persist it in the six-hour Cloudflare valuation cache.");
  } else if (recovery.attempted > 0) {
    notes.push(`Scout tried to recover ${recovery.attempted} Best Offer accepted price${recovery.attempted === 1 ? "" : "s"}, but no exact confirmed Card API match was available; the valuation continues without them.`);
  }

  if (evaluation.matchMode === "relaxed") {
    notes.push("Scout used a controlled relaxed title match on the Apify results because eBay sellers format card numbers inconsistently.");
  }

  return {
    ...evaluation,
    searched: data.length,
    matched: evaluation.matchedItems.length,
    searchMode: recovery.recovered.length > 0 ? "Apify sold + completed + Best Offer recovery" : "Apify sold + completed",
    notes,
    bestOfferRecovered: recovery.recovered.length,
    bestOfferRecoveryAttempted: recovery.attempted,
  };
}

function evaluateComparableResults(normalized, card, comparable=isComparable) {
  let matchedItems = dedupe(
    normalized.filter(item => isReasonableSoldDate(item.soldDate, false) && comparable(item, card, false))
  );
  let matchMode = "strict";

  if (matchedItems.length < 2 && normalized.length) {
    const relaxed = dedupe(
      normalized.filter(item => isReasonableSoldDate(item.soldDate, false) && comparable(item, card, true))
    );
    if (relaxed.length > matchedItems.length) {
      matchedItems = relaxed;
      matchMode = "relaxed";
    }
  }

  const priced = matchedItems.filter(x => Number.isFinite(x.price) && x.price > 0);
  const cleaned = removePriceOutliers(priced);
  const stats = summarize(cleaned.map(x => x.price).sort((a,b)=>a-b));
  const confidence = confidenceFor(cleaned, stats, card);

  return { matchedItems, cleaned, stats, confidence, matchMode };
}

function finalizeValuation(card, query, items, meta) {
  const cleaned = removePriceOutliers(dedupe(items).filter(x => Number.isFinite(x.price) && x.price > 0));
  const prices = cleaned.map(x => x.price).sort((a,b)=>a-b);
  const stats = summarize(prices);
  const confidence = confidenceFor(cleaned, stats, card);
  const tier = verdictTier(Number(card.shopPrice), stats.median, stats.low, stats.high, confidence);
  const newestFirst = [...cleaned].sort((a,b) => dateValue(b.soldDate)-dateValue(a.soldDate));

  return {
    provider: meta.provider,
    query,
    searchMode: meta.searchMode,
    matchMode: meta.matchMode,
    searched: meta.searched,
    matched: meta.matched,
    used: cleaned.length,
    providerDiagnostics: meta.providerDiagnostics || {},
    median: stats.median,
    low: stats.low,
    high: stats.high,
    min: stats.min,
    max: stats.max,
    confidence,
    verdictTier: tier,
    notes: uniqueStrings(meta.notes || []),
    comps: newestFirst.slice(0, 12),
    checkedAt: new Date().toISOString(),
    mode: meta.mode || "deep",
    bestOfferRecovered: Number(meta.bestOfferRecovered || 0),
    bestOfferRecoveryAttempted: Number(meta.bestOfferRecoveryAttempted || 0),
    cachePolicy: Number(meta.bestOfferRecovered || 0) > 0
      ? "not persisted — contains Card API negotiated-price data"
      : "fresh for 6 hours; retained up to 48 hours for provider-outage fallback",
    cacheHit: false,
  };
}

async function runEbaySearchAsync(query, apiKey, showOnly, maxWaitMs=SERP_ASYNC_MAX_WAIT_MS, totalBudget=false) {
  const budgetStarted = Date.now();
  const params = new URLSearchParams({
    engine: "ebay",
    ebay_domain: "ebay.com",
    _nkw: query,
    show_only: showOnly,
    _ipg: "50",
    async: "true",
    api_key: apiKey,
  });

  // SerpApi documents async and no_cache as mutually exclusive, so async
  // broad-discovery requests intentionally use normal cache behavior.
  const submitUrl = `https://serpapi.com/search.json?${params.toString()}`;
  const submitRes = await fetchWithTimeout(
    submitUrl,
    { headers: { "Accept": "application/json" } },
    totalBudget ? Math.max(1, Math.min(8000, maxWaitMs)) : 8000,
    "SerpApi async submission timed out"
  );
  const submitData = await submitRes.json().catch(() => ({}));
  if (!submitRes.ok || submitData?.error) {
    throw new Error(submitData?.error || `SerpApi async submission returned ${submitRes.status}.`);
  }

  const searchId = String(submitData?.search_metadata?.id || "").trim();
  if (!searchId) {
    // A cache hit may occasionally return a completed payload immediately.
    if (Array.isArray(submitData?.organic_results)) return submitData;
    throw new Error("SerpApi async submission did not return a search ID.");
  }

  const pollStarted = Date.now();
  const deadlineStarted = totalBudget ? budgetStarted : pollStarted;
  let lastStatus = String(submitData?.search_metadata?.status || "Queued");

  while ((Date.now() - deadlineStarted) < maxWaitMs) {
    const beforeWaitRemaining = maxWaitMs - (Date.now() - deadlineStarted);
    await new Promise(resolve => setTimeout(resolve, Math.min(SERP_ASYNC_POLL_INTERVAL_MS, beforeWaitRemaining)));
    const pollRemaining = maxWaitMs - (Date.now() - deadlineStarted);
    if (pollRemaining <= 0) break;

    const archiveUrl = `https://serpapi.com/searches/${encodeURIComponent(searchId)}.json?api_key=${encodeURIComponent(apiKey)}`;
    const pollRes = await fetchWithTimeout(
      archiveUrl,
      { headers: { "Accept": "application/json" } },
      totalBudget ? Math.max(1, Math.min(7000, pollRemaining)) : 7000,
      "SerpApi Search Archive poll timed out"
    );
    const data = await pollRes.json().catch(() => ({}));

    if (!pollRes.ok) {
      throw new Error(data?.error || `SerpApi Search Archive returned ${pollRes.status}.`);
    }

    lastStatus = String(data?.search_metadata?.status || lastStatus);
    const providerError = String(data?.error || "");
    const noResults = /hasn['’]?t returned any results|no results|did not return any results/i.test(providerError);

    if (noResults) {
      return {
        ...data,
        error: undefined,
        organic_results: [],
        scout_no_results: true,
        scout_async: true,
      };
    }

    if (lastStatus === "Success") {
      return { ...data, scout_async: true };
    }

    if (lastStatus === "Error" || data?.error) {
      throw new Error(data?.error || `SerpApi async search ended with status ${lastStatus}.`);
    }
    if (lastStatus === "Queued" || lastStatus === "Processing") {
      continue;
    }
    // Unknown nonterminal statuses are allowed one more poll rather than
    // being mistaken for success or failure.
  }

  const incomplete = new Error(
    `SerpApi async search timed out while still ${String(lastStatus || "processing").toLowerCase()} after ${Math.round(maxWaitMs/1000)}s.`
  );
  incomplete.code = "serp_async_incomplete";
  incomplete.searchStatus = lastStatus;
  throw incomplete;
}

async function runEbaySearch(query, apiKey, showOnly, noCache, timeoutMs=SERP_TIMEOUT_MS) {
  const params = new URLSearchParams({
    engine: "ebay",
    ebay_domain: "ebay.com",
    _nkw: query,
    show_only: showOnly,
    _ipg: "50",
    api_key: apiKey,
  });
  if (noCache) params.set("no_cache", "true");
  const endpoint = `https://serpapi.com/search.json?${params.toString()}`;
  const res = await fetchWithTimeout(endpoint, { headers: { "Accept": "application/json" } }, timeoutMs, "SerpApi search timed out");
  const data = await res.json().catch(() => ({}));
  const status = data?.search_metadata?.status;
  const providerError = String(data?.error || "");
  const noResults = /hasn['’]?t returned any results|no results|did not return any results/i.test(providerError);

  // eBay/SerpApi often reports a legitimate zero-result search in the error field.
  // Treat that as an empty search, not a provider outage, so Scout can broaden discovery.
  if (noResults) {
    return {
      ...data,
      error: undefined,
      organic_results: [],
      scout_no_results: true
    };
  }

  if (!res.ok || status === "Error" || data.error) {
    throw new Error(data.error || `Sold-comps provider returned ${res.status}.`);
  }
  return data;
}

async function fetchWithTimeout(url, options={}, timeoutMs=8000, label="Request timed out") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err && (err.name === "AbortError" || String(err.message || "").toLowerCase().includes("abort"))) {
      throw new Error(`${label} after ${Math.round(timeoutMs/1000)}s.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function cacheKeyFor(card, fastMode) {
  const grader = canonicalGrader(card.grader);
  const grade = normalizeGrade(card.grade, grader);
  const bits = [
    VALUATION_CACHE_VERSION,
    fastMode ? "fast" : "deep",
    Number(card.year) || "",
    normalizeText(card.set),
    normalizeText(card.player),
    normalizeCardNum(card.cardNum),
    grader,
    grade,
    serialDenominator(card.serial),
    card.autograph ? "auto" : "noauto",
    card.relic ? "relic" : "norelic",
  ];
  return new Request(`https://hof-card-scout-cache.invalid/value?key=${encodeURIComponent(bits.join("|"))}`, { method: "GET" });
}

async function readValuationCache(card, fastMode) {
  try {
    if (typeof caches === "undefined" || !caches.default) return null;
    const hit = await caches.default.match(cacheKeyFor(card, fastMode));
    if (!hit) return null;
    const data = await hit.json().catch(() => null);
    return valuationCacheEntry(data);
  } catch {
    return null;
  }
}

function valuationCacheEntry(data, nowMs=Date.now()) {
  if (!data || typeof data !== "object") return null;
  if (Number(data.schemaVersion) !== VALUATION_CACHE_VERSION) return null;
  if (!data.result || typeof data.result !== "object") return null;
  const cachedAtMs = Date.parse(data.cachedAt || "");
  if (!Number.isFinite(cachedAtMs)) return null;
  const ageSeconds = Math.max(0, (nowMs - cachedAtMs) / 1000);
  if (ageSeconds > VALUATION_CACHE_RETENTION_SECONDS) return null;
  return {
    result: data.result,
    ageSeconds,
    fresh: ageSeconds <= VALUATION_CACHE_FRESH_SECONDS,
    stale: ageSeconds > VALUATION_CACHE_FRESH_SECONDS,
  };
}

async function writeValuationCache(card, fastMode, result) {
  try {
    if (typeof caches === "undefined" || !caches.default) return;
    const response = new Response(JSON.stringify({
      schemaVersion: VALUATION_CACHE_VERSION,
      cachedAt: new Date().toISOString(),
      result,
    }), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": `public, max-age=${VALUATION_CACHE_RETENTION_SECONDS}`,
      }
    });
    await caches.default.put(cacheKeyFor(card, fastMode), response);
  } catch (err) {
    console.warn("Scout cache write skipped:", err?.message || err);
  }
}

function cacheableValuationResult(result) {
  const cacheable = { ...result };
  delete cacheable.verdictTier;
  delete cacheable.cacheHit;
  delete cacheable.staleCacheFallback;
  delete cacheable.cacheAgeHours;
  delete cacheable.liveProviderError;
  return cacheable;
}

function valuationEvidenceCount(result) {
  const used = Number(result?.used);
  return Number.isFinite(used) && used >= 0 ? used : 0;
}

function valuationConfidenceRank(result) {
  const level = String(result?.confidence || result?.legacyConfidence || "insufficient").toLowerCase();
  return ({ insufficient: 0, low: 1, medium: 2, high: 3 })[level] || 0;
}

function isValuationEvidenceStronger(candidate, baseline) {
  const candidateUsed = valuationEvidenceCount(candidate);
  const baselineUsed = valuationEvidenceCount(baseline);
  if (candidateUsed !== baselineUsed) return candidateUsed > baselineUsed;
  return valuationConfidenceRank(candidate) > valuationConfidenceRank(baseline);
}

function targetEnrichmentCacheFallback(cacheEntry, liveResult=null, liveError=null) {
  const detail = liveError?.message || String(liveError || "Live enrichment did not improve the verified evidence.");
  const attempt = liveResult || liveError;
  const providerDiagnostics = attempt?.providerDiagnostics && typeof attempt.providerDiagnostics === "object"
    ? attempt.providerDiagnostics
    : {};
  const diagnosticNote = "Scout kept the existing verified valuation, but the provider diagnostics below describe this search's live enrichment attempt.";
  const liveEnrichmentNotes = uniqueStrings([
    diagnosticNote,
    ...(Array.isArray(liveResult?.notes) ? liveResult.notes : []),
    liveError ? detail : "",
  ]);
  return {
    ...cacheEntry.result,
    providerDiagnostics,
    liveEnrichmentProviderDiagnostics: providerDiagnostics,
    liveEnrichmentNotes,
    notes: uniqueStrings([
      ...(cacheEntry.result.notes || []),
      "Target enrichment did not produce stronger verified evidence, so Scout kept the existing fresh sold-comps valuation.",
      diagnosticNote,
    ]),
    targetEnrichmentFallback: true,
    liveProviderError: detail,
  };
}

function staleValuationFallback(cacheEntry, liveError) {
  const ageHours = Math.max(0.1, Math.round((cacheEntry.ageSeconds / 3600) * 10) / 10);
  const note = `Live sold sources were temporarily unavailable. Scout is using previously verified sold comps from ${ageHours} hours ago; recheck before buying.`;
  return {
    ...cacheEntry.result,
    notes: uniqueStrings([...(cacheEntry.result.notes || []), note]),
    cachePolicy: "stale cache fallback from the 6–48-hour retention window",
    staleCacheFallback: true,
    cacheAgeHours: ageHours,
    liveProviderError: liveError?.message || String(liveError || "Live sold sources unavailable."),
  };
}

async function getValuationWithCache(card, env, fastMode=false, ctx=null, options={}) {
  const profile = normalizeValuationProfile(options);
  const cached = await readValuationCache(card, fastMode);
  if (cached?.fresh && (
    !profile.targetEnrichment ||
    valuationEvidenceCount(cached.result) >= profile.evidenceGoal
  )) {
    return withCurrentShopVerdict(cached.result, card, true);
  }

  try {
    const raw = await valueCard(card, env, fastMode, {
      ...profile,
      fallbackEvidenceCount: cached?.fresh ? valuationEvidenceCount(cached.result) : 0,
    });
    if (cached?.fresh && profile.targetEnrichment && !isValuationEvidenceStronger(raw, cached.result)) {
      return withCurrentShopVerdict(targetEnrichmentCacheFallback(cached, raw), card, true);
    }
    const cacheable = cacheableValuationResult(raw);
    if (Number(cacheable.used) > 0 && Number(cacheable.bestOfferRecovered || 0) === 0) {
      const put = writeValuationCache(card, fastMode, cacheable);
      if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(put);
      else await put;
    }
    return withCurrentShopVerdict(cacheable, card, false);
  } catch (err) {
    if (cached?.fresh && profile.targetEnrichment) {
      return withCurrentShopVerdict(targetEnrichmentCacheFallback(cached, null, err), card, true);
    }
    if (cached?.stale) {
      return withCurrentShopVerdict(staleValuationFallback(cached, err), card, true);
    }
    throw err;
  }
}

function withCurrentShopVerdict(result, card, cacheHit=false) {
  const legacyConfidence = String(result.confidence || "insufficient");
  const base = {
    ...result,
    cachePolicy: result.cachePolicy || (cacheHit
      ? "fresh valuation cache (6 hours)"
      : "fresh for 6 hours; retained up to 48 hours for provider-outage fallback"),
    cacheHit,
  };

  // Insufficient evidence remains insufficient. Otherwise Phase 2C becomes
  // Scout's official Low/Medium/High label. Verdict price thresholds are unchanged.
  const confidenceLab = explainExperimentalConfidence(base, card);
  const confidence =
    legacyConfidence === "insufficient"
      ? "insufficient"
      : String(confidenceLab?.market?.proposedLevel || legacyConfidence);

  return {
    ...base,
    legacyConfidence,
    confidence,
    confidenceModel: "Phase 2C evidence score",
    confidenceScore: Number(confidenceLab?.market?.score || 0),
    confidenceLab,
    verdictTier: verdictTier(Number(card.shopPrice), Number(result.median), Number(result.low), Number(result.high), confidence),
  };
}

function buildQuery(card) {
  const parts = [
    card.year,
    card.set,
    card.player,
    card.cardNum ? `#${card.cardNum}` : "",
    "baseball card",
  ];
  const grader = canonicalGrader(card.grader);
  const grade = String(card.grade || "").trim();
  if (grader && grader !== "Raw") parts.push(grader, grade.replace(new RegExp(`^${escapeRegExp(grader)}\\s*`, "i"), ""));
  if (card.autograph) parts.push("autograph");
  if (card.relic) parts.push("relic");
  const denom = serialDenominator(card.serial);
  if (denom) parts.push(`/${denom}`);
  if (grader === "Raw") parts.push("-PSA", "-SGC", "-BGS", "-CGC", "-CSG", "-graded");
  return parts.filter(Boolean).join(" ").replace(/\s+/g," ").trim();
}

function buildBroadSoldQuery(card) {
  const parts = [
    card.year,
    card.set,
    card.player,
    card.cardNum ? String(card.cardNum).replace(/^#/, "") : "",
  ];
  const grader = canonicalGrader(card.grader);
  const grade = String(card.grade || "").trim();
  if (grader && grader !== "Raw") {
    parts.push(grader, grade.replace(new RegExp(`^${escapeRegExp(grader)}\\s*`, "i"), ""));
  }
  if (card.autograph) parts.push("autograph");
  if (card.relic) parts.push("relic");
  const denom = serialDenominator(card.serial);
  if (denom) parts.push(`/${denom}`);
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function buildApifyQuery(card) {
  const parts = [
    card.year,
    card.set,
    card.player,
    card.cardNum ? String(card.cardNum).replace(/^#/, "") : "",
    "baseball card",
  ];
  const grader = canonicalGrader(card.grader);
  const grade = String(card.grade || "").trim();
  if (grader && grader !== "Raw") parts.push(grader, grade.replace(new RegExp(`^${escapeRegExp(grader)}\\s*`, "i"), ""));
  if (card.autograph) parts.push("autograph");
  if (card.relic) parts.push("relic");
  const denom = serialDenominator(card.serial);
  if (denom) parts.push(`/${denom}`);
  return parts.filter(Boolean).join(" ").replace(/\s+/g," ").trim();
}

function normalizeResult(r) {
  if (!r || !r.title) return null;
  const price = extractPrice(r.price);
  const soldDate = r.sold_date || r.ended_date || null;
  if (!isReasonableSoldDate(soldDate, true)) return null;
  return {
    id: r.product_id || r.epid || r.link || r.title,
    title: String(r.title),
    price,
    soldDate,
    condition: r.condition || "",
    link: r.link || "",
    thumbnail: r.thumbnail || "",
    source: "SerpApi",
  };
}

function normalizeApifyResult(r) {
  if (!r || !r.title) return null;

  // eBay hides the actual accepted price for Best Offer sales; Apify correctly
  // exposes that fact, so Scout excludes those asking-price placeholders.
  if (r.isBestOfferAccepted === true || r.listingType === "best_offer_accepted") return null;

  // A multi-variant range is not an exact transaction price.
  if (r.soldPriceMax != null && String(r.soldPriceMax).trim() !== "" &&
      Number(extractPrice(r.soldPriceMax)) !== Number(extractPrice(r.soldPrice))) return null;

  const currency = String(r.soldCurrency || "USD").toUpperCase();
  if (currency && currency !== "USD") return null;

  const soldDate = r.endedAt || null;
  if (!isReasonableSoldDate(soldDate, true)) return null;

  const price = extractPrice(r.soldPrice);
  if (!Number.isFinite(price) || price <= 0) return null;

  return {
    id: r.itemId || r.itemNumber || r.url || r.title,
    title: String(r.title),
    price,
    soldDate,
    condition: r.condition || "",
    link: r.url || "",
    thumbnail: r.thumbnailUrl || r.fullResThumbnailUrl || "",
    source: "Apify",
    listingType: r.listingType || "",
  };
}

function extractPrice(p) {
  if (p == null) return null;
  if (typeof p === "number") return p;
  if (typeof p === "object") {
    if (Number.isFinite(Number(p.extracted))) return Number(p.extracted);
    if (p.raw) return parseMoney(p.raw);
  }
  return parseMoney(String(p));
}
function parseMoney(s) {
  const text = String(s || "").replace(/,/g,"").trim();
  const money = text.match(/(?:US\s*)?\$\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  if (money) return Number(money[1]);
  const plain = text.match(/^([0-9]+(?:\.[0-9]{1,4})?)$/);
  return plain ? Number(plain[1]) : null;
}

function isComparable(item, card, relaxed=false) {
  const title = normalizeText(item.title);
  const rawTitle = item.title.toLowerCase();
  const year = String(card.year);
  if (!title.includes(year)) return false;

  const names = normalizeText(card.player).split(" ").filter(Boolean);
  const last = names[names.length-1];
  if (last && !title.includes(last)) return false;

  const setTokens = meaningfulTokens(card.set);
  if (setTokens.length && setTokens.filter(t=>title.includes(t)).length < Math.min(setTokens.length, 2)) return false;

  if (card.cardNum && !cardNumberMatches(rawTitle, String(card.cardNum), relaxed)) return false;

  const grader = canonicalGrader(card.grader);
  const grade = normalizeGrade(card.grade, grader);
  const gradingWords = /\b(psa|sgc|bgs|beckett|cgc|csg|bccg|gma|tag)\b/i;
  if (grader && grader !== "Raw") {
    const graderRx = graderRegex(grader);
    if (!graderRx.test(rawTitle)) return false;
    if (grade && !gradeMatches(rawTitle, grade, grader, relaxed)) return false;
  } else if (grader === "Raw" && gradingWords.test(rawTitle)) return false;

  const autoRx = /\b(auto(?:graph)?|autographed|signed)\b/i;
  if (card.autograph ? !autoRx.test(rawTitle) : autoRx.test(rawTitle)) return false;

  const relicRx = /\b(relic|memorabilia|jersey|patch|game[ -]?used|bat piece|piece of bat)\b/i;
  if (card.relic ? !relicRx.test(rawTitle) : relicRx.test(rawTitle)) return false;

  const denom = serialDenominator(card.serial);
  if (denom && !new RegExp(`\\/\\s*${escapeRegExp(denom)}\\b`).test(rawTitle)) return false;

  if (looksLikeLot(rawTitle)) return false;
  if (isExplicitTeamCardListing(rawTitle)) return false;
  if (isObviousNonTradingCardListing(rawTitle)) return false;

  const setText = String(card.set||"").toLowerCase();
  const allowReprint = /archives|reprint/.test(setText) || /reprint/i.test(String(card.notes||""));
  if (!allowReprint && /\b(reprint|replica|facsimile|custom card)\b/i.test(rawTitle)) return false;

  return true;
}

function meaningfulTokens(s) {
  const stop = new Set(["the","and","baseball","card","cards","series"]);
  return normalizeText(s).split(" ").filter(t=>t.length>1&&!stop.has(t));
}
function normalizeText(s) { return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim(); }
function normalizeCardNum(s){ return String(s||"").toLowerCase().replace(/^#/,'').replace(/\s+/g,'').replace(/[^a-z0-9-]/g,''); }
function cardNumberMatches(title, num, relaxed=false) {
  const n = normalizeCardNum(num);
  if (!n) return true;
  const lower = title.toLowerCase();
  const compact = lower.replace(/\s+/g,'');
  const escaped = escapeRegExp(n);
  const strict = new RegExp(`(?:#|no\\.?\\s*|card\\s*#?\\s*)${escaped}(?![a-z0-9])`,"i");
  if (strict.test(lower) || compact.includes(`#${n}`) || compact.includes(`no.${n}`)) return true;
  if (!relaxed) return false;
  // Relaxed pass: allow a standalone card number even when the seller omitted #/No.
  const loose = new RegExp(`(^|[^a-z0-9])${escaped}(?![a-z0-9])`,"i");
  return loose.test(lower);
}
function canonicalGrader(g){
  const s=String(g||"").trim().toUpperCase();
  if(!s||s==="RAW")return "Raw";
  if(s.startsWith("BGS")||s.includes("BECKETT"))return "BGS";
  if(s.startsWith("PSA"))return "PSA";
  if(s.startsWith("SGC"))return "SGC";
  if(s.startsWith("CGC"))return "CGC";
  if(s.startsWith("CSG"))return "CSG";
  return s.replace(/\s*\/.*$/,'');
}
function graderRegex(g){
  if(g==="BGS") return /\b(bgs|beckett)\b/i;
  return new RegExp(`\\b${escapeRegExp(g)}\\b`,"i");
}
function normalizeGrade(g, grader){
  let s=String(g||"").trim();
  if(!s)return "";
  if(grader&&grader!=="Raw")s=s.replace(new RegExp(`^${escapeRegExp(grader)}\\s*`,"i"),"");
  const m=s.match(/\b(10|9\.5|9|8\.5|8|7\.5|7|6\.5|6|5\.5|5|4\.5|4|3\.5|3|2\.5|2|1\.5|1)\b/);
  return m?m[1]:"";
}
function gradeMatches(title, grade, grader, relaxed=false){
  const g=escapeRegExp(grade);
  const gr=grader==="BGS"?"(?:bgs|beckett)":escapeRegExp(grader);
  // Common seller formats include “PSA 9”, “PSA MINT 9”, “PSA NM-MT 8”, etc.
  const nearGrader = new RegExp(`\\b${gr}\\b(?:\\s+[a-z-]+){0,4}\\s*${g}(?![0-9.])`,"i");
  if (nearGrader.test(title)) return true;
  if (!relaxed) return false;
  // Relax only to a standalone grade token when the correct grader is already present.
  const standalone = new RegExp(`(^|[^0-9.])${g}(?![0-9.])`,"i");
  return graderRegex(grader).test(title) && standalone.test(title);
}
function serialDenominator(s){ const m=String(s||"").match(/\/\s*(\d+)/); return m?m[1]:""; }
function looksLikeLot(t){
  return /\blot\s+of\s+\d+\b|\b\d+\s*card\s+lot\b|\bcard\s+lot\b|\bcomplete\s+(?:baseball\s+)?set\b|\bteam\s+set\b|\byou\s+pick\b|\bpick\s+your\s+card\b|\bmultiple\s+cards?\b/i.test(t);
}
function isExplicitTeamCardListing(title) {
  const text = String(title || "");
  const labeledTeamCard = /\bteam\b[\s:./\-–—]+(?:photo[\s:./\-–—]+)?(?:cards?|checklists?)\b/i;
  const numberedTeamCard = /\bteam\b[\s:./\-–—]*(?:#\s*)?\d{1,3}\b/i;
  return labeledTeamCard.test(text) || numberedTeamCard.test(text);
}
function isObviousNonTradingCardListing(title) {
  const text = String(title || "");
  const nonCardTerms = /\b(?:digital|nfts?|photos?|photographs?|photographic|pictures?|portraits?|postcards?|lithographs?|posters?|magazines?|wrappers?|empty\s+box(?:es)?|unopened\s+packs?|wax\s+packs?)\b/i;
  const photoPrintWording = /\b(?:glossy|matte)\s+(?:photo\s+)?(?:re)?prints?\b|\b(?:re)?prints?\s+on\s+(?:photo|photographic)\s+paper\b/i;
  const displayDimensions = /(?:^|[^\d.])(?:4\s*[x×]\s*6|5\s*[x×]\s*7|8\s*[x×]\s*10|8\s*\.\s*5\s*[x×]\s*11|11\s*[x×]\s*14|16\s*[x×]\s*20)(?:[^\d]|$)/i;
  return nonCardTerms.test(text) || photoPrintWording.test(text) || displayDimensions.test(text);
}
function isReasonableSoldDate(v, requireDate=false){
  if(!v)return !requireDate;
  const n=Date.parse(v);
  if(!Number.isFinite(n))return !requireDate;
  // Allow a little clock/time-zone slop, but never accept a sale dated in the future.
  return n <= Date.now() + 36*60*60*1000;
}
function uniqueStrings(items){
  const seen=new Set();
  return items.filter(Boolean).filter(x=>{const k=String(x);if(seen.has(k))return false;seen.add(k);return true;});
}
function dedupe(items){
  const seen=new Set();return items.filter(x=>{const k=x.id||`${x.title}|${x.price}`;if(seen.has(k))return false;seen.add(k);return true;});
}
function dedupeSoldComps(items){
  const seen=new Set();
  const out=[];
  for(const item of items){
    const ebayId=extractEbayItemId(item?.id)||extractEbayItemId(item?.link);
    const date=String(item?.soldDate||"").slice(0,10);
    const fallback=`${normalizeText(item?.title)}|${Number(item?.price)||""}|${date}`;
    const key=ebayId?`ebay:${ebayId}`:fallback;
    if(!key||seen.has(key))continue;
    seen.add(key);out.push(item);
  }
  return out;
}
function removePriceOutliers(items){
  if(items.length<6)return items;
  const prices=items.map(x=>x.price).sort((a,b)=>a-b);
  const q1=quantile(prices,.25), q3=quantile(prices,.75), iqr=q3-q1;
  if(!Number.isFinite(iqr)||iqr<=0)return items;
  const lo=Math.max(0,q1-1.5*iqr), hi=q3+1.5*iqr;
  const kept=items.filter(x=>x.price>=lo&&x.price<=hi);
  return kept.length>=3?kept:items;
}
function summarize(prices){
  if(!prices.length)return {median:null,low:null,high:null,min:null,max:null};
  return {median:round2(quantile(prices,.5)),low:round2(quantile(prices,.25)),high:round2(quantile(prices,.75)),min:round2(prices[0]),max:round2(prices[prices.length-1])};
}
function quantile(arr,q){
  if(!arr.length)return null; const pos=(arr.length-1)*q,base=Math.floor(pos),rest=pos-base;
  return arr[base+1]!==undefined?arr[base]+rest*(arr[base+1]-arr[base]):arr[base];
}

function sourceBucket(source) {
  const s = String(source || "").toLowerCase();
  if (s.includes("serp")) return "SerpApi";
  if (s.includes("apify")) return "Apify";
  if (s.includes("best offer")) return "Best Offer recovery";
  if (s.includes("card api")) return "The Card API";
  return source ? String(source) : "Unknown";
}

function medianOfNumbers(values) {
  const nums = values.map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
  return nums.length ? round2(quantile(nums, .5)) : null;
}

function explainExperimentalConfidence(result, card) {
  const comps = Array.isArray(result?.comps) ? result.comps : [];
  const n = Number(result?.used || comps.length || 0);
  const median = Number(result?.median);
  const low = Number(result?.low);
  const high = Number(result?.high);
  const spread = Number.isFinite(median) && median > 0 && Number.isFinite(low) && Number.isFinite(high)
    ? (high - low) / median
    : Infinity;

  // Market evidence score: 100 points total. PSA verification is deliberately
  // excluded; it establishes identity, not the strength of sold-price evidence.
  let countScore = 0;
  if (n >= 8) countScore = 35;
  else if (n >= 6) countScore = 31;
  else if (n >= 4) countScore = 26;
  else if (n === 3) countScore = 20;
  else if (n === 2) countScore = 12;

  let consistencyScore = 0;
  if (spread <= .25) consistencyScore = 35;
  else if (spread <= .50) consistencyScore = 30;
  else if (spread <= .75) consistencyScore = 23;
  else if (spread <= 1.00) consistencyScore = 16;
  else if (spread <= 1.50) consistencyScore = 8;
  else if (Number.isFinite(spread)) consistencyScore = 3;

  const groups = {};
  for (const comp of comps) {
    const bucket = sourceBucket(comp?.source);
    if (bucket === "Best Offer recovery" || bucket === "Unknown") continue;
    if (!groups[bucket]) groups[bucket] = [];
    if (Number.isFinite(Number(comp?.price))) groups[bucket].push(Number(comp.price));
  }
  const sourceMedians = Object.fromEntries(
    Object.entries(groups).map(([name, prices]) => [name, { count: prices.length, median: medianOfNumbers(prices) }])
  );
  const corroborating = Object.entries(sourceMedians).filter(([,v]) => v.count >= 1 && Number.isFinite(v.median));

  let agreementScore = 0;
  let agreementText = "No usable retrieval-source comparison.";
  let agreementGapPct = null;
  if (corroborating.length >= 2) {
    const a = corroborating[0][1].median;
    const b = corroborating[1][1].median;
    const midpoint = (a + b) / 2;
    const gap = midpoint > 0 ? Math.abs(a - b) / midpoint : Infinity;
    agreementGapPct = Number.isFinite(gap) ? Math.round(gap * 1000) / 10 : null;
    if (gap <= .10) agreementScore = 20;
    else if (gap <= .20) agreementScore = 16;
    else if (gap <= .35) agreementScore = 10;
    else if (gap <= .50) agreementScore = 5;
    else agreementScore = 0;
    agreementText = `The first two retrieval-source medians differ by ${agreementGapPct ?? "?"}%.`;
  } else if (corroborating.length === 1) {
    agreementScore = 8;
    agreementText = "Only one retrieval source contributed usable comps, so cross-source agreement is unknown.";
  }

  const recovered = Number(result?.bestOfferRecovered || 0);
  const attempted = Number(result?.bestOfferRecoveryAttempted || 0);
  const transactionScore = recovered >= 2 ? 10 : recovered === 1 ? 6 : 0;

  const marketScore = Math.max(0, Math.min(100, countScore + consistencyScore + agreementScore + transactionScore));

  // High confidence must be earned, not merely crossed numerically.
  // Route A: 8+ comps with solid price consistency.
  // Route B: 6+ comps with solid consistency AND strong cross-source corroboration.
  const highGateA = n >= 8 && consistencyScore >= 23;
  const highGateB = n >= 6 && consistencyScore >= 23 && agreementScore >= 16;
  const highGatePassed = highGateA || highGateB;
  const proposedMarketLevel =
    marketScore >= 78 && highGatePassed ? "high" :
    marketScore >= 45 ? "medium" :
    "low";

  let highGateReason = "";
  if (highGatePassed) {
    highGateReason = highGateA
      ? "High-confidence safeguard passed: 8+ comps with solid price consistency."
      : "High-confidence safeguard passed: 6+ comps with solid price consistency and strong retrieval-source agreement.";
  } else if (marketScore >= 78) {
    highGateReason = "Score reached the High range, but Scout held it at Medium because the High-confidence evidence safeguard was not met.";
  }

  // Identity is scored separately so a verified PSA cert never inflates the
  // market-price evidence score.
  let identityScore = 0;
  const identityReasons = [];
  if (String(card?.player || "").trim()) { identityScore += 15; identityReasons.push("player supplied"); }
  if (Number.isInteger(Number(card?.year))) { identityScore += 15; identityReasons.push("year supplied"); }
  if (String(card?.set || "").trim()) { identityScore += 15; identityReasons.push("set supplied"); }
  if (String(card?.cardNum || "").trim()) { identityScore += 15; identityReasons.push("card number supplied"); }
  if (String(card?.grader || "").trim()) { identityScore += 10; identityReasons.push("grader/raw state supplied"); }
  if (result?.matchMode === "strict") { identityScore += 20; identityReasons.push("strict title/card match"); }
  else if (result?.matchMode === "relaxed") { identityScore += 8; identityReasons.push("relaxed title/card match"); }
  if (card?.psaVerified === true) { identityScore += 10; identityReasons.push("PSA cert verified"); }
  identityScore = Math.min(100, identityScore);
  const identityLevel = identityScore >= 85 ? "high" : identityScore >= 65 ? "medium" : "low";

  const reasons = [
    `${n} clean sold comp${n === 1 ? "" : "s"}.`,
    Number.isFinite(spread) ? `Middle-50% price spread is ${Math.round(spread * 100)}% of the median.` : "Price spread could not be calculated.",
    agreementText,
    recovered > 0
      ? `${recovered} negotiated Best Offer price${recovered === 1 ? "" : "s"} recovered and confirmed.`
      : attempted > 0
        ? `${attempted} Best Offer recovery attempt${attempted === 1 ? "" : "s"}; none confirmed.`
        : "No Best Offer recovery evidence in this valuation.",
    ...(highGateReason ? [highGateReason] : []),
  ];

  return {
    market: {
      score: marketScore,
      proposedLevel: proposedMarketLevel,
      currentLevel: result?.confidence || "unknown",
      components: {
        compCount: { score: countScore, max: 35, count: n },
        priceConsistency: { score: consistencyScore, max: 35, iqrToMedian: Number.isFinite(spread) ? Math.round(spread * 1000) / 1000 : null },
        retrievalSourceAgreement: { score: agreementScore, max: 20, medianGapPct: agreementGapPct, sources: sourceMedians },
        confirmedBestOfferPricing: { score: transactionScore, max: 10, attempted, recovered },
      },
      highConfidenceSafeguard: {
        passed: highGatePassed,
        route: highGateA ? "8+ solid comps" : highGateB ? "6+ solid comps + strong source agreement" : null,
        reason: highGateReason || "Not applicable below the High score range.",
      },
      reasons,
    },
    identity: {
      score: identityScore,
      level: identityLevel,
      psaVerified: card?.psaVerified === true,
      reasons: identityReasons,
      note: "Identity confidence is intentionally separate and does not raise the market-price score.",
    },
    verdictImpact: "Official confidence label only — BUY/NEGOTIATE/PASS pricing thresholds are unchanged.",
  };
}

function confidenceFor(items,stats,card){
  const n=items.length;if(n<2)return "insufficient";
  const spread=stats.median?((stats.high-stats.low)/stats.median):Infinity;
  const core=Boolean(card.cardNum)&&Boolean(card.year)&&Boolean(card.set);
  if(n>=8&&spread<=.55&&core)return "high";
  // Four clean comps qualify for Medium only when the middle 50% of prices
  // are reasonably consistent. A very wide spread stays Low so Deep Mode
  // can ask the Apify/Best-Offer backup for more evidence.
  if(n>=4&&spread<=1.0)return "medium";
  return "low";
}
function verdictTier(shop,median,low,high,confidence){
  if(!Number.isFinite(shop)||shop<=0||!Number.isFinite(median)||confidence==="insufficient")return "value_only";
  const ratio=shop/median;
  if(ratio<=.65 || (low&&shop<=low*.82))return "steal";
  if(ratio<=.82)return "great_buy";
  if(ratio<=.98)return "good_buy";
  if(ratio<=1.10)return "fair";
  if(ratio<=1.25)return "high";
  return "walk";
}
function buildNotes(card,searched,matched,used,confidence){
  const notes=[];
  if(searched&&!matched)notes.push("Sold results were found, but none passed Scout’s card-matching rules.");
  if(used<4)notes.push("Few close comps were available, so treat the estimate cautiously.");
  if(confidence==="low"&&used>=4)notes.push("Scout found enough comps by count, but their prices are too spread out for Medium confidence. Deep Mode can check the backup source for more evidence.");
  if(canonicalGrader(card.grader)==="Raw"&&String(card.grade||"").trim())notes.push("Raw-card condition is hard to normalize from listing titles; condition can move the real value materially.");
  if(confidence==="insufficient")notes.push("Scout needs at least two usable sold comps before calling a median trustworthy.");
  return notes;
}
function dateValue(v){const n=Date.parse(v||"");return Number.isFinite(n)?n:0;}
function round2(n){return Number.isFinite(n)?Math.round((n+Number.EPSILON)*100)/100:null;}
function escapeRegExp(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");}
