from pathlib import Path
import re


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing expected text for {label}")
    return text.replace(old, new, 1)


def regex_once(text, pattern, replacement, label):
    out, count = re.subn(pattern, lambda _m: replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"Expected one match for {label}; got {count}")
    return out


worker_path = Path("src/index.js")
worker = worker_path.read_text(encoding="utf-8")
worker = replace_once(worker, 'const VERSION = "3.39.0";', 'const VERSION = "3.40.0";', "worker version")
worker = replace_once(worker, "sealed:intel:v1:", "sealed:intel:v2:", "sealed intelligence cache version")

scoring = r'''function sealedRipProductEvidenceCount(parts = {}) {
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
    authority: "checklist rookies autographs parallels case hits odds",
    community: "pulls review quality control collation",
  };
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
}'''

worker = regex_once(
    worker,
    r'function sealedRipProductEvidenceCount\(parts = \{\}\) \{.*?(?=\n\nfunction sealedRipSourceType)',
    scoring,
    "category-aware scoring block",
)

worker = replace_once(
    worker,
    'if (/checklist|beckett|cardboardconnection|cardboardconnection|tcgplayer|sportscollectorsdaily/.test(text)) return "checklist/editorial";',
    'if (/checklist|beckett|cardboardconnection|tcgplayer|sportscollectorsdaily|pokebeach|justinbasil|mtggoldfish|scryfall/.test(text)) return "checklist/editorial";',
    "category editorial sources",
)

page_signals = r'''function sealedRipPageHasUsefulSignals(text) {
  const value = String(text || "");
  return /\b1\s*:\s*\d{1,7}\b|\b(?:value box|blaster|retail[- ]only|case hit|rookie|autograph|parallel|ssp|short print|sir|special illustration rare|illustration rare|hyper rare|pull rate|hit rate|mythic|borderless|showcase|serialized|special guests?|bonus sheet|foil|playable|staple)\b/i.test(value);
}'''
worker = regex_once(
    worker,
    r'function sealedRipPageHasUsefulSignals\(text\) \{.*?\n\}',
    page_signals,
    "cross-category page signals",
)

worker = replace_once(
    worker,
    '(?:beckett\\.com|topps\\.com|checklistinsider\\.com|cardboardconnection\\.com|pokemon\\.com|pokebeach\\.com|magic\\.wizards\\.com|wizards\\.com)',
    '(?:beckett\\.com|topps\\.com|checklistinsider\\.com|cardboardconnection\\.com|pokemon\\.com|pokebeach\\.com|justinbasil\\.com|magic\\.wizards\\.com|wizards\\.com|mtggoldfish\\.com|scryfall\\.com)',
    "trusted category reader domains",
)

chase_context = r'''function sealedRipChaseContextSupported(evidenceRows, category = "") {
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
}'''
worker = regex_once(
    worker,
    r'function sealedRipChaseContextSupported\(evidenceRows\) \{.*?\n\}',
    chase_context,
    "category chase context",
)

worker = replace_once(worker, "function sealedRipNormalize(raw, evidenceRows, market) {", "function sealedRipNormalize(raw, evidenceRows, market, identity = {}) {", "normalize signature")
worker = replace_once(worker, "const chaseContextAvailable = sealedRipChaseContextSupported(evidenceRows);", "const chaseContextAvailable = sealedRipChaseContextSupported(evidenceRows, identity?.category);", "category chase context call")
worker = replace_once(worker, "const overallScore = sealedRipWeightedScore(parts);", "const overallScore = sealedRipWeightedScore(parts, identity?.category);", "category overall score")
worker = replace_once(worker, "const ripScore = sealedRipQualityScore(parts);", "const ripScore = sealedRipQualityScore(parts, identity?.category);", "category rip score")
worker = replace_once(
    worker,
    "    recommendationConfidence,\n    qualitySummary,",
    "    recommendationConfidence,\n    researchProfile: sealedRipCategoryKey(identity?.category),\n    scoreLabels: sealedRipScoreLabels(identity?.category),\n    qualitySummary,",
    "analysis research profile",
)

worker = replace_once(
    worker,
    "const analysis = sealedRipNormalize(cached.analysis, Array.isArray(cached.evidenceRows) ? cached.evidenceRows : [], market);",
    "const analysis = sealedRipNormalize(cached.analysis, Array.isArray(cached.evidenceRows) ? cached.evidenceRows : [], market, identity);",
    "cached normalize identity",
)
worker = replace_once(
    worker,
    "const analysis = sealedRipNormalize(aiObject, evidenceRows, market);",
    "const analysis = sealedRipNormalize(aiObject, evidenceRows, market, identity);",
    "fresh normalize identity",
)

worker = replace_once(
    worker,
    '      const authorityCategory = String(identity?.category || "").trim().toLowerCase();',
    '      const authorityCategory = String(identity?.category || "").trim().toLowerCase();\n      const researchTerms = sealedRipResearchTerms(identity?.category);',
    "research term router",
)
worker = replace_once(
    worker,
    '      const checklistQuery = `${authorityYear} ${researchSet} ${authorityCategory} ${authoritySite} ${formatTerms} odds chases`.replace(/\\s+/g, " ").trim();',
    '      const checklistQuery = `${authorityYear} ${researchSet} ${authorityCategory} ${authoritySite} ${formatTerms} ${researchTerms.authority}`.replace(/\\s+/g, " ").trim();',
    "category authority query",
)
worker = replace_once(
    worker,
    '      const communityQuery = `"${exactSet}" ${formatTerms} pulls review ${sealedRipCommunitySite(identity?.category)}`;',
    '      const communityQuery = `"${exactSet}" ${formatTerms} ${researchTerms.community} ${sealedRipCommunitySite(identity?.category)}`;',
    "category community query",
)

worker = replace_once(
    worker,
    'Set: ${String(identity?.set || "")}.\n\nUse ONLY the research evidence below.',
    'Set: ${String(identity?.set || "")}.\n\n${sealedRipCategoryGuidance(identity?.category)}\n\nUse ONLY the research evidence below.',
    "category playbook prompt",
)

generic_prompt = r'''Named items in chaseCards must be explicitly supported by the supplied evidence; do not invent card names, players, Pokémon, treatments, inserts, or variants. Use the CATEGORY PLAYBOOK above to decide what counts as strong chase/set quality for this product. chaseCards may contain named chase cards, characters/players, treatment or insert families, or other category-appropriate named targets when the evidence supports them. Separately, set chaseEvidenceAvailable=true when trustworthy official/checklist/editorial evidence supports meaningful chase or set structure for this category even if individual names cannot be safely validated. Score chaseScore 0-100 only when chaseEvidenceAvailable=true, following the category playbook rather than a universal sports-card rubric. Preserve any exact pull-rate/odds notation literally as written in evidence. Community-reported pull rates are allowed only when clearly labeled as community/reported and supported by the exact evidence; they are never official manufacturer odds unless an official source says so. Missing exact odds are not by themselves a reason to withhold a recommendation. For collector/player sentiment, summarize recurring product-specific themes rather than one lucky or angry opening. Set sentimentEvidenceAvailable=false when community evidence is too thin. Keep conclusions conservative when evidence is thin.'''
worker = regex_once(
    worker,
    r'Only put a card/player/insert in chaseCards.*?Keep conclusions conservative when evidence is thin\.',
    generic_prompt,
    "category-neutral synthesis instructions",
)

worker = regex_once(
    worker,
    r'const recoveryPrompt = `Extract only source-supported CHASES and exact-format PULL ODDS for \$\{productLabel\}.*?\$\{evidenceSignals\}`;',
    'const recoveryPrompt = `Extract only source-supported category-appropriate CHASES / SET VALUE signals and literal PULL ODDS or PULL-RATE samples for ${productLabel} (${String(identity?.productType || identity?.boxType || "")}). ${sealedRipCategoryGuidance(identity?.category)} Use ONLY the excerpts below. Preserve any rate exactly as written (for example 1:7 or 1 hit per 8 packs) and label community samples as community/reported, never official. Do not estimate, infer, or invent names or rates. If no literal rate is present, return pullOdds=[].\\\n\\\n${evidenceSignals}`;',
    "category recovery prompt",
)

worker_path.write_text(worker, encoding="utf-8")

app_path = Path("sealed-product-scout.js")
app = app_path.read_text(encoding="utf-8")
app = replace_once(
    app,
    '    const confidence=String(a.recommendationConfidence||a.confidence||"low").toUpperCase();',
    '    const confidence=String(a.recommendationConfidence||a.confidence||"low").toUpperCase();\n    const profile=String(a.researchProfile||"general").toUpperCase();',
    "front-end research profile",
)
app = replace_once(app, '<div class="sealed-score-label">CHASES</div>', '<div class="sealed-score-label">${esc(String(a.scoreLabels?.chase||"CHASES"))}</div>', "dynamic chase label")
app = replace_once(app, '<div class="sealed-score-label">PULL ODDS</div>', '<div class="sealed-score-label">${esc(String(a.scoreLabels?.pull||"PULL ODDS"))}</div>', "dynamic pull label")
app = replace_once(app, '<div class="sealed-score-label">COLLECTORS</div>', '<div class="sealed-score-label">${esc(String(a.scoreLabels?.sentiment||"COLLECTORS"))}</div>', "dynamic sentiment label")
app = replace_once(
    app,
    ' · Confidence: <strong>${esc(confidence)}</strong>${a.qualitySummary?',
    ' · Confidence: <strong>${esc(confidence)}</strong> · Research profile: <strong>${esc(profile)}</strong>${a.qualitySummary?',
    "show research profile",
)
app_path.write_text(app, encoding="utf-8")

index_path = Path("index.html")
index = index_path.read_text(encoding="utf-8")
index = replace_once(index, 'sealed-product-scout.js?v=6.2.0', 'sealed-product-scout.js?v=6.3.0', "sealed scanner cache bust")
index_path.write_text(index, encoding="utf-8")

test_path = Path("tests/sealed-product-vision.test.cjs")
test = test_path.read_text(encoding="utf-8")
test = replace_once(test, 'const VERSION = "3\\.39\\.0"', 'const VERSION = "3\\.40\\.0"', "test worker version")
test = replace_once(test, 'sealed:intel:v1:', 'sealed:intel:v2:', "test cache version")
test = replace_once(test, 'sealed-product-scout\\.js\\?v=6\\.2\\.0', 'sealed-product-scout\\.js\\?v=6\\.3\\.0', "test cache bust")
test = replace_once(
    test,
    "assert.match(worker,/\\[Number\\(parts\\.pullScore\\), 10/,'pull odds must be optional rather than dominate the buy recommendation');",
    "assert.match(worker,/sealedRipWeightProfile/,'sealed research must route scoring weights by category');\nassert.ok(worker.includes('price: 30, chase: 35, pull: 20, sentiment: 15'),'Pokémon must emphasize chase quality plus observed pull experience');\nassert.ok(worker.includes('price: 30, chase: 45, pull: 10, sentiment: 15'),'Magic must emphasize set/playable value more heavily');\nassert.ok(worker.includes('price: 35, chase: 35, pull: 10, sentiment: 20'),'sports must retain the sports-card weighting profile');",
    "test category weights",
)
test = replace_once(
    test,
    "assert.match(worker,/const checklistQuery = `\\$\\{authorityYear\\} \\$\\{researchSet\\} \\$\\{authorityCategory\\} \\$\\{authoritySite\\} \\$\\{formatTerms\\} odds chases`/,'authority discovery must nudge Google toward exact-format odds and chase snippets');",
    "assert.match(worker,/sealedRipResearchTerms/,'research query vocabulary must route by category');\nassert.ok(worker.includes('special illustration rare'),'Pokémon research must know SIR terminology');\nassert.ok(worker.includes('illustration rare'),'Pokémon research must know IR terminology');\nassert.ok(worker.includes('hyper rare'),'Pokémon research must know Hyper Rare terminology');\nassert.ok(worker.includes('community pull-rate or hit-rate samples'),'Pokémon guidance must allow clearly labeled community pull-rate evidence');\nassert.ok(worker.includes('borderless/showcase treatments'),'Magic guidance must know borderless/showcase treatments');\nassert.ok(worker.includes('Special Guests/bonus sheets'),'Magic guidance must know Special Guests and bonus sheets');\nassert.ok(worker.includes('PLAYABLE/VALUE QUALITY'),'Magic chase scoring must include playable/set value');\nassert.match(worker,/researchTerms\\.authority/,'authority query must use category-specific research terms');\nassert.match(worker,/researchTerms\\.community/,'community query must use category-specific research terms');",
    "test category research",
)

insertion = r'''
assert.match(worker,/sealedRipCategoryGuidance/,'sealed analysis prompt must inject a category-specific playbook');
assert.match(worker,/sealedRipScoreLabels/,'sealed response must expose category-specific score labels');
assert.match(worker,/sealedRipChaseContextSupported\(evidenceRows, category = ""\)/,'chase evidence detection must understand category vocabulary');
assert.match(app,/researchProfile/,'sealed UI must show which research profile made the recommendation');
assert.match(app,/scoreLabels\?\.chase/,'sealed UI must render category-specific score labels');
'''
test = replace_once(test, "\nconst typeRouteStart=worker.indexOf('url.pathname === \"/sealed/classify-type\"');", insertion + "\nconst typeRouteStart=worker.indexOf('url.pathname === \"/sealed/classify-type\"');", "category router regression assertions")
test_path.write_text(test, encoding="utf-8")
