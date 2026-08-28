from pathlib import Path

worker_path=Path('src/index.js')
front_path=Path('sealed-product-scout.js')
index_path=Path('index.html')
test_path=Path('tests/sealed-product-vision.test.cjs')

worker=worker_path.read_text(encoding='utf-8')
front=front_path.read_text(encoding='utf-8')
index=index_path.read_text(encoding='utf-8')
tests=test_path.read_text(encoding='utf-8')

def repl(text, old, new, label, count=1):
    if old not in text:
        raise SystemExit(f'missing pattern: {label}')
    return text.replace(old,new,count)

# Version/cache.
worker=repl(worker,'const VERSION = "3.41.1";','const VERSION = "3.42.0";','worker version')
worker=repl(worker,
'''const SEALED_VISION_PRODUCT_TYPES = new Set(["Blaster Box", "Mega Box", "Hobby Box", "Retail Box", "Hanger Box", "Hanger Pack", "Value / Fat Pack", "Single Pack", "Multi-Pack", "Elite Trainer Box", "Booster Box", "Booster Bundle", "Booster Pack", "Collection Box", "Tin", "Other"]);''',
'''const SEALED_VISION_PRODUCT_TYPES = new Set(["Blaster Box", "Mega Box", "Hobby Box", "Retail Box", "Hanger Box", "Hanger Pack", "Value / Fat Pack", "Single Pack", "Multi-Pack", "Elite Trainer Box", "Collector Booster", "Play Booster", "Jumpstart Booster", "Booster Box", "Booster Bundle", "Booster Pack", "Collection Box", "Tin", "Other"]);''','specialized booster types')

old_cache='''function sealedRipIntelligenceCacheKey(identity) {
  const parts = [
    String(identity?.category || "").trim(),
    String(identity?.year || "").trim(),
    sealedRipResearchSet(identity),
    String(identity?.productType || identity?.boxType || "").trim(),
    String(identity?.variant || "").trim(),
  ].map(value => value.toLowerCase().replace(/\\s+/g, " ").trim()).filter(Boolean);
  return `sealed:intel:v10:${encodeURIComponent(parts.join("|")).slice(0, 420)}`;
}
'''
new_cache='''function sealedRipIntelligenceCacheKey(identity, mode = "single") {
  const parts = [
    String(mode || "single").trim(),
    String(identity?.category || "").trim(),
    String(identity?.year || "").trim(),
    sealedRipResearchSet(identity),
    String(identity?.productType || identity?.boxType || "").trim(),
    String(identity?.variant || "").trim(),
  ].map(value => value.toLowerCase().replace(/\\s+/g, " ").trim()).filter(Boolean);
  return `sealed:intel:v11:${encodeURIComponent(parts.join("|")).slice(0, 420)}`;
}
'''
worker=repl(worker,old_cache,new_cache,'mode scoped cache')

# Exact-market matching for specialized Magic boosters.
worker=repl(worker,
'''    "Elite Trainer Box": /\\belite\\s+trainer\\s+box\\b|\\bETB\\b/i,
    "Booster Box": /\\bbooster\\s+box\\b/i,''',
'''    "Elite Trainer Box": /\\belite\\s+trainer\\s+box\\b|\\bETB\\b/i,
    "Collector Booster": /\\bcollector\\s+boosters?(?:\\s+(?:box|pack|display))?\\b/i,
    "Play Booster": /\\bplay\\s+boosters?(?:\\s+(?:box|pack|display))?\\b/i,
    "Jumpstart Booster": /\\bjumpstart\\s+boosters?(?:\\s+(?:box|pack|display))?\\b/i,
    "Booster Box": /\\bbooster\\s+box\\b/i,''','market specialized booster matching')

# Search-set cleanup must remove the full specialized booster phrase before generic booster stripping.
worker=repl(worker,
'''  text = text
    .replace(/\\b20\\d{2}(?:\\s*[-–/]\\s*\\d{2,4})?\\b/g, " ")''',
'''  text = text
    .replace(/\\b(?:collector|play|jumpstart)\\s+booster(?:\\s+(?:box|pack|display))?\\b/gi, " ")
    .replace(/\\b20\\d{2}(?:\\s*[-–/]\\s*\\d{2,4})?\\b/g, " ")''','research set specialized booster cleanup')

# Price guide domains are research/editorial sources, not shopping listings.
worker=repl(worker,
'''  if (/checklist|beckett|cardboardconnection|tcgplayer|sportscollectorsdaily|pokebeach|justinbasil|mtggoldfish|scryfall/.test(text)) return "checklist/editorial";''',
'''  if (/checklist|beckett|cardboardconnection|tcgplayer|pricecharting|sportscollectorsdaily|pokebeach|justinbasil|mtggoldfish|scryfall/.test(text)) return "checklist/editorial";''','pricecharting source classification')

# Price pages need useful excerpts/readers too.
worker=repl(worker,
'''    "special illustration rare", "illustration rare", "hyper rare", "secret rare", "ultra rare", "pull rate", "hit rate"
  ];''',
'''    "special illustration rare", "illustration rare", "hyper rare", "secret rare", "ultra rare", "pull rate", "hit rate",
    "market price", "most expensive", "ungraded", "price guide", "$"
  ];''','price excerpt needles')
worker=repl(worker,
'''  return /\\b1\\s*:\\s*\\d{1,7}\\b|\\b(?:value box|blaster|retail[- ]only|case hit|rookie|autograph|parallel|ssp|short print|sir|special illustration rare|illustration rare|hyper rare|pull rate|hit rate|mythic|borderless|showcase|serialized|special guests?|bonus sheet|foil|playable|staple)\\b/i.test(value);''',
'''  return /\\b1\\s*:\\s*\\d{1,7}\\b|\\$\\s*\\d+(?:\\.\\d{1,2})?|\\b(?:market price|most expensive|ungraded|price guide|value box|blaster|retail[- ]only|case hit|rookie|autograph|parallel|ssp|short print|sir|special illustration rare|illustration rare|hyper rare|pull rate|hit rate|mythic|borderless|showcase|serialized|special guests?|bonus sheet|foil|playable|staple)\\b/i.test(value);''','price pages useful signals')
worker=repl(worker,
'''  return /https?:\\/\\/(?:www\\.)?(?:beckett\\.com|topps\\.com|checklistinsider\\.com|cardboardconnection\\.com|pokemon\\.com|pokebeach\\.com|justinbasil\\.com|magic\\.wizards\\.com|wizards\\.com|mtggoldfish\\.com|scryfall\\.com)\\//.test(link);''',
'''  return /https?:\\/\\/(?:www\\.)?(?:beckett\\.com|topps\\.com|checklistinsider\\.com|cardboardconnection\\.com|pokemon\\.com|pokebeach\\.com|justinbasil\\.com|magic\\.wizards\\.com|wizards\\.com|mtggoldfish\\.com|tcgplayer\\.com|pricecharting\\.com|scryfall\\.com)\\//.test(link);''','price guide reader allowlist')
worker=repl(worker,
'''function sealedRipEvidencePriority(row) {
  const type = String(row?.sourceType || "");''',
'''function sealedRipEvidencePriority(row) {
  if (row?.queryKind === "singles-price-guide") return 0.5;
  const type = String(row?.sourceType || "");''','price guide expansion priority')
worker=repl(worker,'.slice(0, 6);','.slice(0, 8);','expand more source pages')

# Price-guide query selection: one aggregate search, no card-by-card eBay.
anchor='''function sealedRipCategoryGuidance(category) {'''
helpers='''function sealedRipPriceGuideSite(category) {
  const key = sealedRipCategoryKey(category);
  if (key === "magic") return "site:mtggoldfish.com/sets";
  if (key === "pokemon") return "site:tcgplayer.com";
  if (key === "sports") return "site:pricecharting.com";
  return "";
}

function sealedRipPriceGuideQuery(identity, researchSet = "") {
  const key = sealedRipCategoryKey(identity?.category);
  const year = String(identity?.year || "").replace(/[^0-9]+/g, " ").trim();
  const cleanSet = String(researchSet || sealedRipResearchSet(identity)).replace(/\\b(?:trading|cards?|nba|nfl|mlb)\\b/gi, " ").replace(/\\s+/g, " ").trim();
  const site = sealedRipPriceGuideSite(identity?.category);
  if (key === "magic") return `"${cleanSet}" ${site} prices tabletop "All Cards"`.replace(/\\s+/g, " ").trim();
  if (key === "pokemon") return `${year} "${cleanSet}" ${site} "price guide" "Market Price"`.replace(/\\s+/g, " ").trim();
  if (key === "sports") return `${year} "${cleanSet}" ${String(identity?.category || "").toLowerCase()} ${site} Ungraded price`.replace(/\\s+/g, " ").trim();
  return `${year} "${cleanSet}" ${site} card prices`.replace(/\\s+/g, " ").trim();
}

'''
worker=repl(worker,anchor,helpers+anchor,'price guide query helpers')

# Exact-format evidence: literal published format odds establish access to that treatment family.
worker=repl(worker,
'''      : /\\b(?:rookies?|autographs?|signatures?|parallel|exclusive|numbered|case hit|ssp|short print|insert)\\b/i;''',
'''      : /\\b(?:rookies?|autographs?|signatures?|parallel|exclusive|numbered|case hit|ssp|short print|insert|green hoops|light burst|rainbow)\\b|\\b1\\s*:\\s*\\d{1,7}\\b/i;''','sports odds establish format access')

# Deterministic Chase Depth validation/scoring. AI may propose values; local code must verify name + price together.
normalize_anchor='''function sealedRipNormalize(raw, evidenceRows, market, identity = {}) {'''
depth_helpers=r'''function sealedRipPriceGuideRows(evidenceRows = [], identity = {}) {
  return (Array.isArray(evidenceRows) ? evidenceRows : []).filter(row =>
    row?.queryKind === "singles-price-guide" &&
    row?.sourceType !== "community" &&
    sealedRipEvidenceRowMatchesIdentity(row, identity)
  );
}

function sealedRipChaseValueNameTokens(value) {
  const stop = new Set(["the", "and", "card", "cards", "foil", "market", "price", "showcase", "borderless", "parallel", "autograph", "auto", "rookie"]);
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter(token => token.length >= 2 && !stop.has(token));
}

function sealedRipPriceTextSupported(price, text) {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return false;
  const fixed = n.toFixed(2).replace(/\./g, "\\.");
  const whole = Math.round(n);
  const rx = new RegExp(`(?:\\$|usd\\s*)\\s*${fixed}\\b|(?:market\\s+price\\s*:?\\s*)\\$?\\s*${fixed}\\b${Math.abs(n-whole)<0.001?`|(?:\\$|usd\\s*)\\s*${whole}\\b`:""}`, "i");
  return rx.test(String(text || ""));
}

function sealedRipChaseValueSupported(candidate, evidenceRows = [], identity = {}) {
  const name = String(candidate?.name || "").trim();
  const price = Number(candidate?.marketPrice);
  const tokens = sealedRipChaseValueNameTokens(name);
  if (!name || !Number.isFinite(price) || price < 3 || price > 25000 || !tokens.length) return false;
  return sealedRipPriceGuideRows(evidenceRows, identity).some(row => {
    const rawText = `${row?.title || ""} ${row?.snippet || ""} ${row?.pageText || ""}`.replace(/\s+/g, " ");
    const lower = rawText.toLowerCase();
    const first = tokens.find(token => lower.includes(token));
    if (!first) return false;
    let at = lower.indexOf(first);
    while (at >= 0) {
      const window = rawText.slice(Math.max(0, at - 500), Math.min(rawText.length, at + 850));
      const windowLower = window.toLowerCase();
      const matched = tokens.filter(token => windowLower.includes(token)).length;
      if (matched >= Math.min(2, tokens.length) && sealedRipPriceTextSupported(price, window)) return true;
      at = lower.indexOf(first, at + first.length);
    }
    return false;
  });
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
    if (!sealedRipChaseValueSupported(item, evidenceRows, identity)) continue;
    const key = `${item.name}|${item.treatment}`.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.sort((a,b) => b.marketPrice - a.marketPrice).slice(0, 15);
}

function sealedRipChaseDepthMetrics(cards = []) {
  const rows = (Array.isArray(cards) ? cards : []).filter(row => Number.isFinite(Number(row?.marketPrice)) && Number(row.marketPrice) > 0).slice().sort((a,b) => Number(b.marketPrice)-Number(a.marketPrice));
  if (rows.length < 2) return { available:false, score:null, label:"N/A", summary:"Scout could not verify enough set-level singles prices to measure chase depth yet.", count20:0, count50:0, count100:0, top5Total:null, top10Total:null, concentration:null };
  const prices = rows.map(row => Number(row.marketPrice));
  const count20 = prices.filter(x => x >= 20).length;
  const count50 = prices.filter(x => x >= 50).length;
  const count100 = prices.filter(x => x >= 100).length;
  const top5Total = Number(prices.slice(0,5).reduce((a,b)=>a+b,0).toFixed(2));
  const top10Total = Number(prices.slice(0,10).reduce((a,b)=>a+b,0).toFixed(2));
  const concentration = top10Total > 0 ? prices[0] / top10Total : 1;
  let score = 20;
  score += Math.min(24, count20 * 3);
  score += Math.min(18, count50 * 5);
  score += Math.min(14, count100 * 7);
  score += top10Total >= 1500 ? 20 : top10Total >= 750 ? 16 : top10Total >= 400 ? 12 : top10Total >= 200 ? 8 : top10Total >= 100 ? 4 : 0;
  if (concentration >= .75) score -= 18;
  else if (concentration >= .60) score -= 12;
  else if (concentration >= .45) score -= 6;
  if (rows.length < 4) score = Math.min(score, 58);
  score = Math.max(0, Math.min(100, Math.round(score)));
  const label = concentration >= .68 && count20 <= 4 ? "LOTTERY-TICKET" : score >= 78 ? "DEEP" : score >= 62 ? "SOLID" : score >= 45 ? "MODERATE" : "THIN";
  const top = rows[0];
  const summary = `${label} set-level chase pool · ${count100} verified at $100+ · ${count50} at $50+ · ${count20} at $20+ · top 10 verified values total $${top10Total.toFixed(2)}${top?.name?` · top verified card: ${top.name} ($${Number(top.marketPrice).toFixed(2)})`:""}. Exact-format access is scored separately.`;
  return { available:true, score, label, summary, count20, count50, count100, top5Total, top10Total, concentration:Number(concentration.toFixed(3)) };
}

function sealedRipPriceGuideEvidenceText(evidenceRows = [], identity = {}) {
  return sealedRipPriceGuideRows(evidenceRows, identity)
    .map(row => `${row?.title || ""} ${row?.snippet || ""} ${row?.pageText || ""}`.trim())
    .filter(Boolean).join("\n---\n").slice(0, 18000);
}

'''
worker=repl(worker,normalize_anchor,depth_helpers+normalize_anchor,'chase depth helpers')

# Normalize and return chase-depth metrics.
worker=repl(worker,
'''  const pullOdds = (Array.isArray(raw?.pullOdds) ? raw.pullOdds : []).slice(0, 8).map(row => ({
    item: String(row?.item || "").trim().slice(0, 160),
    odds: String(row?.odds || "").trim().slice(0, 80),
    sourceType: String(row?.sourceType || "reported").trim().slice(0, 50),
    note: String(row?.note || "").trim().slice(0, 260),
  })).filter(row => row.item && row.odds && sealedRipOddsRowSupported(row, evidenceRows, identity));

  const chaseContextAvailable''',
'''  const pullOdds = (Array.isArray(raw?.pullOdds) ? raw.pullOdds : []).slice(0, 8).map(row => ({
    item: String(row?.item || "").trim().slice(0, 160),
    odds: String(row?.odds || "").trim().slice(0, 80),
    sourceType: String(row?.sourceType || "reported").trim().slice(0, 50),
    note: String(row?.note || "").trim().slice(0, 260),
  })).filter(row => row.item && row.odds && sealedRipOddsRowSupported(row, evidenceRows, identity));
  const chaseValueCards = sealedRipNormalizeChaseValues(raw, evidenceRows, identity);
  const chaseDepth = sealedRipChaseDepthMetrics(chaseValueCards);

  const chaseContextAvailable''','normalize chase depth')
worker=repl(worker,
'''    namedChasesVerified: chaseCards.length,
    formatAccessScore,''',
'''    namedChasesVerified: chaseCards.length,
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
    chaseValueCards,
    formatAccessScore,''','return chase depth')

# Route mode: Showdown swaps low-value community search for aggregate singles price guide, keeping exactly 2 research searches.
worker=repl(worker,
'''      const identity = body?.identity && typeof body.identity === "object" ? body.identity : {};
      const lookupTitle''',
'''      const identity = body?.identity && typeof body.identity === "object" ? body.identity : {};
      const researchMode = body?.researchMode === "showdown" ? "showdown" : "single";
      const intelligenceTtlDays = researchMode === "showdown" ? 3 : 14;
      const lookupTitle''','research mode')
worker=repl(worker,'const cacheKey = sealedRipIntelligenceCacheKey(identity);','const cacheKey = sealedRipIntelligenceCacheKey(identity, researchMode);','mode scoped cache call')
worker=repl(worker,
'''return json({ ok: true, version: VERSION, productLabel, market, analysis, sources: cached.sources || [], checkedAt: cached.checkedAt || new Date().toISOString(), cacheHit: true, intelligenceCacheHit: true, intelligenceTtlDays: 14, researchSearchesUsed: 0, marketplaceSearchesUsed: 0 }, 200, cors);''',
'''return json({ ok: true, version: VERSION, productLabel, market, analysis, sources: cached.sources || [], checkedAt: cached.checkedAt || new Date().toISOString(), cacheHit: true, intelligenceCacheHit: true, intelligenceTtlDays, researchMode, researchSearchesUsed: 0, marketplaceSearchesUsed: 0 }, 200, cors);''','cached mode response')

old_search='''      const checklistQuery = sealedRipAuthorityQuery(identity, researchSet, authoritySite, formatTerms, researchTerms);
      const communityQuery = `"${exactSet}" ${formatTerms} ${researchTerms.community} ${sealedRipCommunitySite(identity?.category)}`;
      let checklistData = {}, communityData = {};
      let researchSearchesUsed = 0;
      try {
        const results = await Promise.allSettled([
          sealedRipGoogleSearch(checklistQuery, env.SERPAPI_KEY, 18000, "mobile"),
          sealedRipGoogleSearch(communityQuery, env.SERPAPI_KEY, 12000),
        ]);
        researchSearchesUsed = 2;
        if (results[0].status === "fulfilled") checklistData = results[0].value;
        if (results[1].status === "fulfilled") communityData = results[1].value;
      } catch {}

      let evidenceRows = [
        ...sealedRipEvidenceRows(checklistData, "checklist-and-odds"),
        ...sealedRipEvidenceRows(communityData, "collector-reports"),
      ];'''
new_search='''      const checklistQuery = sealedRipAuthorityQuery(identity, researchSet, authoritySite, formatTerms, researchTerms);
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
      ];'''
worker=repl(worker,old_search,new_search,'showdown price guide search')

# Preserve Google structured price snippets as evidence too.
worker=repl(worker,
'''      if (authoritySerpEvidence) {
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
      if (!evidenceRows.length)''',
'''      if (authoritySerpEvidence) {
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
      if (!evidenceRows.length)''','structured price guide evidence')
worker=repl(worker,
'''        community: evidenceRows.filter(row => row.queryKind === "collector-reports" && sealedRipCommunityRowCompatible(row, identity)).length,
        expandedPages:''',
'''        community: evidenceRows.filter(row => row.queryKind === "collector-reports" && sealedRipCommunityRowCompatible(row, identity)).length,
        priceGuides: evidenceRows.filter(row => row.queryKind === "singles-price-guide").length,
        expandedPages:''','research mix price guides')
worker=repl(worker,
'''      const evidenceSignals = sealedRipPromptSignals(evidenceRows, identity?.category);
      const evidenceForPrompt''',
'''      const evidenceSignals = sealedRipPromptSignals(evidenceRows, identity?.category);
      const priceGuideSignals = sealedRipPriceGuideEvidenceText(evidenceRows, identity);
      const evidenceForPrompt''','price guide signals')

# AI extracts candidate name+price pairs but local normalization independently verifies them.
worker=repl(worker,
'''          chaseCards: { type: "array", items: { type: "object", properties: { name: { type: "string" }, why: { type: "string" } }, required: ["name", "why"] }, maxItems: 5 },
          pullOdds:''',
'''          chaseCards: { type: "array", items: { type: "object", properties: { name: { type: "string" }, why: { type: "string" } }, required: ["name", "why"] }, maxItems: 5 },
          chaseValueCards: { type: "array", items: { type: "object", properties: { name: { type: "string" }, marketPrice: { type: "number" }, treatment: { type: "string" }, sourceType: { type: "string" } }, required: ["name", "marketPrice", "treatment", "sourceType"] }, maxItems: 15 },
          pullOdds:''','schema chase values')
worker=repl(worker,
'''required: ["qualitySummary", "chaseScore", "chaseEvidenceAvailable", "formatAccessScore", "formatAccessEvidenceAvailable", "formatAccessSummary", "pullScore", "pullEvidenceAvailable", "sentimentScore", "sentimentEvidenceAvailable", "sentimentLabel", "chaseCards", "pullOdds", "collectorTake", "positives", "negatives", "confidence"]''',
'''required: ["qualitySummary", "chaseScore", "chaseEvidenceAvailable", "formatAccessScore", "formatAccessEvidenceAvailable", "formatAccessSummary", "pullScore", "pullEvidenceAvailable", "sentimentScore", "sentimentEvidenceAvailable", "sentimentLabel", "chaseCards", "chaseValueCards", "pullOdds", "collectorTake", "positives", "negatives", "confidence"]''','schema required chase values')

prompt_insert='''Named items in chaseCards must be explicitly supported by the supplied evidence; do not invent card names, players, Pokémon, treatments, inserts, or variants.'''
prompt_new='''For Shelf Showdown Chase Depth, chaseValueCards may be populated ONLY from evidence rows marked SEARCH=singles-price-guide. Each row must preserve an exact card name and a literal current singles market/guide price shown together in that evidence. marketPrice is the single-card price, never the sealed box price. Return no more than 15 of the strongest supported values and return [] when no singles price guide evidence exists. This is SET-LEVEL value depth; do not claim a card is accessible from the exact box unless the separate format-access evidence supports that conclusion.\n\nNamed items in chaseCards must be explicitly supported by the supplied evidence; do not invent card names, players, Pokémon, treatments, inserts, or variants.'''
worker=repl(worker,prompt_insert,prompt_new,'prompt chase depth extraction')

# Recovery pass also gets price-guide excerpts without spending another search.
worker=repl(worker,
'''      const missingChases = !Array.isArray(aiObject?.chaseCards) || !aiObject.chaseCards.length;
      const missingOdds = !Array.isArray(aiObject?.pullOdds) || !aiObject.pullOdds.length;
      if (evidenceSignals && (missingChases || missingOdds)) {''',
'''      const missingChases = !Array.isArray(aiObject?.chaseCards) || !aiObject.chaseCards.length;
      const missingOdds = !Array.isArray(aiObject?.pullOdds) || !aiObject.pullOdds.length;
      const missingChaseValues = !Array.isArray(aiObject?.chaseValueCards) || !aiObject.chaseValueCards.length;
      if ((evidenceSignals || priceGuideSignals) && (missingChases || missingOdds || missingChaseValues)) {''','recovery chase values condition')
worker=repl(worker,
'''            chaseCards: { type: "array", items: { type: "object", properties: { name: { type: "string" }, why: { type: "string" } }, required: ["name", "why"] }, maxItems: 5 },
            pullOdds:''',
'''            chaseCards: { type: "array", items: { type: "object", properties: { name: { type: "string" }, why: { type: "string" } }, required: ["name", "why"] }, maxItems: 5 },
            chaseValueCards: { type: "array", items: { type: "object", properties: { name: { type: "string" }, marketPrice: { type: "number" }, treatment: { type: "string" }, sourceType: { type: "string" } }, required: ["name", "marketPrice", "treatment", "sourceType"] }, maxItems: 15 },
            pullOdds:''','recovery schema chase values')
worker=repl(worker,
'''          required: ["chaseScore", "pullScore", "chaseCards", "pullOdds"]''',
'''          required: ["chaseScore", "pullScore", "chaseCards", "chaseValueCards", "pullOdds"]''','recovery required chase values')
worker=repl(worker,
'''${evidenceSignals}`;''',
'''${evidenceSignals}\n\nSINGLES PRICE-GUIDE EVIDENCE — extract chaseValueCards only from here:\n${priceGuideSignals || "No singles price-guide evidence available."}`;''','recovery price evidence')
worker=repl(worker,
'''          if (missingOdds && Array.isArray(recovered?.pullOdds) && recovered.pullOdds.length) {
            aiObject.pullOdds = recovered.pullOdds;
            aiObject.pullScore = recovered.pullScore;
            aiObject.pullEvidenceAvailable = true;
          }''',
'''          if (missingOdds && Array.isArray(recovered?.pullOdds) && recovered.pullOdds.length) {
            aiObject.pullOdds = recovered.pullOdds;
            aiObject.pullScore = recovered.pullScore;
            aiObject.pullEvidenceAvailable = true;
          }
          if (missingChaseValues && Array.isArray(recovered?.chaseValueCards) && recovered.chaseValueCards.length) {
            aiObject.chaseValueCards = recovered.chaseValueCards;
          }''','recovery apply chase values')

# Mode-scoped TTL and response metadata.
worker=repl(worker,
'''try { await env.SCOUT_DATA.put(cacheKey, JSON.stringify({ productLabel, analysis: aiObject, evidenceRows, sources, checkedAt }), { expirationTtl: 14 * 24 * 60 * 60 }); } catch {}''',
'''try { await env.SCOUT_DATA.put(cacheKey, JSON.stringify({ productLabel, analysis: aiObject, evidenceRows, sources, checkedAt, researchMode }), { expirationTtl: intelligenceTtlDays * 24 * 60 * 60 }); } catch {}''','mode ttl cache')
worker=repl(worker,
'''return json({ ok: true, version: VERSION, productLabel, market, analysis, sources, researchMix, checkedAt, cacheHit: false, intelligenceCacheHit: false, intelligenceTtlDays: 14, researchSearchesUsed, marketplaceSearchesUsed: 0 }, 200, cors);''',
'''return json({ ok: true, version: VERSION, productLabel, market, analysis, sources, researchMix, checkedAt, cacheHit: false, intelligenceCacheHit: false, intelligenceTtlDays, researchMode, researchSearchesUsed, marketplaceSearchesUsed: 0 }, 200, cors);''','fresh mode response')

# Front end: 5-factor Showdown with Chase Depth at 35%.
front=repl(front,
'''Scout waits until you tap Rank My Shelf, then compares current price, set/chase strength, exact-format access, and supporting pull/player/collector evidence.''',
'''Scout waits until you tap Rank My Shelf, then compares set-level Chase Depth, exact-format access, current shelf value, set strength, and supporting evidence.''','showdown description')

old_score='''  function showdownScore(item,market,analysis){
    const price=showdownMetric(analysis?.priceScore,showdownPriceScore(item.shelfPrice,market?.median));
    const set=analysis?.chaseEvidenceAvailable?showdownMetric(analysis?.chaseScore,25):25;
    const format=analysis?.formatAccessEvidenceAvailable?showdownMetric(analysis?.formatAccessScore,35):35;
    const supportValues=[];
    if(analysis?.pullEvidenceAvailable)supportValues.push(showdownMetric(analysis?.pullScore,40));
    if(analysis?.sentimentEvidenceAvailable)supportValues.push(showdownMetric(analysis?.sentimentScore,40));
    const support=supportValues.length?Math.round(supportValues.reduce((a,b)=>a+b,0)/supportValues.length):40;
    let total=Math.round(price*.25+set*.35+format*.30+support*.10);
    if(!analysis?.chaseEvidenceAvailable)total-=8;
    if(!analysis?.formatAccessEvidenceAvailable)total-=7;
    total=Math.max(0,Math.min(100,total));
    const major=[true,!!analysis?.chaseEvidenceAvailable,!!analysis?.formatAccessEvidenceAvailable];
    const supportKnown=!!analysis?.pullEvidenceAvailable||!!analysis?.sentimentEvidenceAvailable;
    const known=major.filter(Boolean).length;
    const confidence=known>=3&&supportKnown?"HIGH":known>=2?"MEDIUM":"LOW";
    return {total,price,set,format,support,confidence};
  }'''
new_score='''  function showdownScore(item,market,analysis){
    const price=showdownMetric(analysis?.priceScore,showdownPriceScore(item.shelfPrice,market?.median));
    const depth=analysis?.chaseDepthEvidenceAvailable?showdownMetric(analysis?.chaseDepthScore,30):30;
    const format=analysis?.formatAccessEvidenceAvailable?showdownMetric(analysis?.formatAccessScore,35):35;
    const set=analysis?.chaseEvidenceAvailable?showdownMetric(analysis?.chaseScore,25):25;
    const supportValues=[];
    if(analysis?.pullEvidenceAvailable)supportValues.push(showdownMetric(analysis?.pullScore,40));
    if(analysis?.sentimentEvidenceAvailable)supportValues.push(showdownMetric(analysis?.sentimentScore,40));
    const support=supportValues.length?Math.round(supportValues.reduce((a,b)=>a+b,0)/supportValues.length):40;
    let total=Math.round(depth*.35+format*.25+price*.20+set*.15+support*.05);
    if(!analysis?.chaseDepthEvidenceAvailable)total-=10;
    if(!analysis?.formatAccessEvidenceAvailable)total-=7;
    if(!analysis?.chaseEvidenceAvailable)total-=5;
    total=Math.max(0,Math.min(100,total));
    const known=[true,!!analysis?.chaseDepthEvidenceAvailable,!!analysis?.formatAccessEvidenceAvailable,!!analysis?.chaseEvidenceAvailable].filter(Boolean).length;
    const confidence=known>=4?"HIGH":known>=2?"MEDIUM":"LOW";
    return {total,price,depth,format,set,support,confidence};
  }'''
front=repl(front,old_score,new_score,'showdown chase depth weights')
front=repl(front,
'''    if(a?.chaseEvidenceAvailable)parts.push(`set/chase strength ${m.set}/100`);else parts.push("set/chase evidence is still thin");
    if(a?.formatAccessEvidenceAvailable)parts.push(`exact-format access ${m.format}/100`);else parts.push("exact-format chase access was not verified");''',
'''    if(a?.chaseDepthEvidenceAvailable)parts.push(`Chase Depth ${m.depth}/100`);else parts.push("singles Chase Depth was not verified");
    if(a?.formatAccessEvidenceAvailable)parts.push(`exact-format access ${m.format}/100`);else parts.push("exact-format chase access was not verified");
    if(a?.chaseEvidenceAvailable)parts.push(`set strength ${m.set}/100`);else parts.push("set/chase evidence is still thin");''','showdown reason chase depth')

# Render five metrics and depth summary.
front=repl(front,
'''      const formatCopy=a?.formatAccessEvidenceAvailable?(a.formatAccessSummary||"Exact-format access verified."):"Exact-format access not verified; Scout applied a conservative ranking penalty.";''',
'''      const formatCopy=a?.formatAccessEvidenceAvailable?(a.formatAccessSummary||"Exact-format access verified."):"Exact-format access not verified; Scout applied a conservative ranking penalty.";
      const depthCopy=a?.chaseDepthEvidenceAvailable?(a.chaseDepthSummary||"Set-level Chase Depth verified from aggregated singles pricing."):"Scout did not verify enough set-level singles prices to score Chase Depth.";''','showdown depth copy')
front=repl(front,
'''<div class="sealed-showdown-metric"><div class="sealed-showdown-metric-label">PRICE</div><div class="sealed-showdown-metric-value">${m.price}</div></div><div class="sealed-showdown-metric"><div class="sealed-showdown-metric-label">SET / CHASE</div><div class="sealed-showdown-metric-value">${m.set}</div></div><div class="sealed-showdown-metric"><div class="sealed-showdown-metric-label">FORMAT ACCESS</div><div class="sealed-showdown-metric-value">${a?.formatAccessEvidenceAvailable?m.format:"N/A"}</div></div><div class="sealed-showdown-metric"><div class="sealed-showdown-metric-label">SUPPORT</div><div class="sealed-showdown-metric-value">${(a?.pullEvidenceAvailable||a?.sentimentEvidenceAvailable)?m.support:"N/A"}</div></div>''',
'''<div class="sealed-showdown-metric"><div class="sealed-showdown-metric-label">CHASE DEPTH</div><div class="sealed-showdown-metric-value">${a?.chaseDepthEvidenceAvailable?m.depth:"N/A"}</div></div><div class="sealed-showdown-metric"><div class="sealed-showdown-metric-label">FORMAT ACCESS</div><div class="sealed-showdown-metric-value">${a?.formatAccessEvidenceAvailable?m.format:"N/A"}</div></div><div class="sealed-showdown-metric"><div class="sealed-showdown-metric-label">PRICE</div><div class="sealed-showdown-metric-value">${m.price}</div></div><div class="sealed-showdown-metric"><div class="sealed-showdown-metric-label">SET</div><div class="sealed-showdown-metric-value">${m.set}</div></div><div class="sealed-showdown-metric"><div class="sealed-showdown-metric-label">SUPPORT</div><div class="sealed-showdown-metric-value">${(a?.pullEvidenceAvailable||a?.sentimentEvidenceAvailable)?m.support:"N/A"}</div></div>''','showdown five metrics')
front=repl(front,
'''<div class="sealed-showdown-copy">${esc(formatCopy)}</div>${issue}''',
'''<div class="sealed-showdown-copy"><strong>Chase Depth:</strong> ${esc(depthCopy)}</div><div class="sealed-showdown-copy"><strong>Format:</strong> ${esc(formatCopy)}</div>${issue}''','showdown depth summary')

# Showdown calls the dedicated mode; compact results retain depth data.
front=repl(front,
'''body:JSON.stringify({identity:item.identity,lookupTitle:item.lookupTitle||"",market:{shelfPrice:market.shelfPrice,median:market.median,verdict:market.verdict}})''',
'''body:JSON.stringify({identity:item.identity,lookupTitle:item.lookupTitle||"",researchMode:"showdown",market:{shelfPrice:market.shelfPrice,median:market.median,verdict:market.verdict}})''','showdown research mode')
front=repl(front,
'''analysis:{priceScore:row.analysis?.priceScore,chaseScore:row.analysis?.chaseScore,chaseEvidenceAvailable:!!row.analysis?.chaseEvidenceAvailable,formatAccessScore:''',
'''analysis:{priceScore:row.analysis?.priceScore,chaseDepthScore:row.analysis?.chaseDepthScore,chaseDepthEvidenceAvailable:!!row.analysis?.chaseDepthEvidenceAvailable,chaseDepthLabel:row.analysis?.chaseDepthLabel||"",chaseDepthSummary:row.analysis?.chaseDepthSummary||"",chaseDepthCount20:Number(row.analysis?.chaseDepthCount20||0),chaseDepthCount50:Number(row.analysis?.chaseDepthCount50||0),chaseDepthCount100:Number(row.analysis?.chaseDepthCount100||0),chaseScore:row.analysis?.chaseScore,chaseEvidenceAvailable:!!row.analysis?.chaseEvidenceAvailable,formatAccessScore:''','compact chase depth')
front=repl(front,
'''Missing odds/community evidence did not automatically block the ranking.`;''',
'''Chase Depth uses aggregated set pricing; no card-by-card eBay searches are used. Missing odds/community evidence did not automatically block the ranking.`;''','showdown status no card ebay')

# Mobile metric layout.
front=repl(front,
'''.sealed-showdown-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:9px}''',
'''.sealed-showdown-metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:9px}''','five metric css')
front=repl(front,
'''@media(max-width:620px){.sealed-actions,.sealed-actions.three,.sealed-form{grid-template-columns:1fr}.sealed-field.full{grid-column:auto}}''',
'''@media(max-width:620px){.sealed-actions,.sealed-actions.three,.sealed-form{grid-template-columns:1fr}.sealed-field.full{grid-column:auto}.sealed-showdown-metrics{grid-template-columns:repeat(2,1fr)}}''','mobile showdown metrics')

# Cache bust.
index=repl(index,'sealed-product-scout.js?v=6.4.0','sealed-product-scout.js?v=6.5.0','frontend cache bust')

# Tests.
tests=repl(tests,'assert.match(worker,/const VERSION = "3\\.41\\.1"/);','assert.match(worker,/const VERSION = "3\\.42\\.0"/);','test version')
tests=repl(tests,"assert.match(worker,/sealed:intel:v10:/,'sealed product intelligence must use a reusable product cache');","assert.match(worker,/sealed:intel:v11:/,'sealed product intelligence must use a reusable mode-scoped product cache');",'test cache')
tests=repl(tests,"assert.match(index,/sealed-product-scout\\.js\\?v=6\\.4\\.0/,'sealed scanner cache-bust must advance for Shelf Showdown UI');","assert.match(index,/sealed-product-scout\\.js\\?v=6\\.5\\.0/,'sealed scanner cache-bust must advance for Chase Depth UI');",'test frontend cache')
append_anchor="assert.match(worker,/function sealedRipFormatAccessContextSupported/,'Shelf Showdown must locally verify exact-format chase access');\n"
extra="""assert.match(worker,/function sealedRipPriceGuideQuery/,'Shelf Showdown must use one aggregate singles price-guide search');
assert.ok(worker.includes('site:mtggoldfish.com/sets'),'Magic Chase Depth should use MTGGoldfish set pricing');
assert.ok(worker.includes('site:tcgplayer.com'),'Pokemon Chase Depth should use TCGplayer set pricing');
assert.ok(worker.includes('site:pricecharting.com'),'sports Chase Depth should use PriceCharting set pricing');
assert.match(worker,/function sealedRipChaseValueSupported/,'candidate card prices must be locally validated against price-guide evidence');
assert.match(worker,/function sealedRipChaseDepthMetrics/,'verified singles values must produce a deterministic Chase Depth score');
assert.ok(worker.includes('researchMode === \"showdown\"'),'Showdown must swap community research for aggregate price-guide research');
assert.ok(front.includes('researchMode:\"showdown\"'),'front end must request Showdown research mode');
assert.ok(front.includes('CHASE DEPTH'),'Showdown must display Chase Depth');
assert.ok(front.includes('depth*.35+format*.25+price*.20+set*.15+support*.05'),'Showdown weights must prioritize Chase Depth without over-weighting support');
assert.ok(worker.includes('Collector Booster')&&worker.includes('Play Booster')&&worker.includes('Jumpstart Booster'),'specialized Magic boosters must remain first-class product types');
"""
if append_anchor not in tests: raise SystemExit('missing chase depth test anchor')
tests=tests.replace(append_anchor,append_anchor+extra,1)

worker_path.write_text(worker,encoding='utf-8')
front_path.write_text(front,encoding='utf-8')
index_path.write_text(index,encoding='utf-8')
test_path.write_text(tests,encoding='utf-8')
