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

worker_path = Path('src/index.js')
worker = worker_path.read_text(encoding='utf-8')
worker = replace_once(worker, 'const VERSION = "3.38.13";', 'const VERSION = "3.39.0";', 'worker version')

# Build a stable product-intelligence cache key that is independent of today's shelf price.
marker = 'function sealedRipPriceScore(shelfPrice, median) {'
helper = '''function sealedRipIntelligenceCacheKey(identity) {
  const parts = [
    String(identity?.category || "").trim(),
    String(identity?.year || "").trim(),
    sealedRipResearchSet(identity),
    String(identity?.productType || identity?.boxType || "").trim(),
    String(identity?.variant || "").trim(),
  ].map(value => value.toLowerCase().replace(/\\s+/g, " ").trim()).filter(Boolean);
  return `sealed:intel:v1:${encodeURIComponent(parts.join("|")).slice(0, 420)}`;
}

'''
worker = replace_once(worker, marker, helper + marker, 'product intelligence cache helper')

# New direction: exact pull odds are useful but optional. A recommendation needs two
# of the three product-quality pillars (chase quality, pull evidence, collector experience).
scoring = '''function sealedRipProductEvidenceCount(parts = {}) {
  return [parts.chaseEvidenceAvailable, parts.pullEvidenceAvailable, parts.sentimentEvidenceAvailable].filter(Boolean).length;
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

function sealedRipWeightedScore(parts) {
  if (sealedRipProductEvidenceCount(parts) < 2) return null;
  const available = [
    [Number(parts.priceScore), 35, parts.priceScore !== null && parts.priceScore !== undefined && Number.isFinite(Number(parts.priceScore))],
    [Number(parts.chaseScore), 35, Boolean(parts.chaseEvidenceAvailable) && Number.isFinite(Number(parts.chaseScore))],
    [Number(parts.pullScore), 10, Boolean(parts.pullEvidenceAvailable) && Number.isFinite(Number(parts.pullScore))],
    [Number(parts.sentimentScore), 20, Boolean(parts.sentimentEvidenceAvailable) && Number.isFinite(Number(parts.sentimentScore))],
  ].filter(row => row[2]);
  const weight = available.reduce((sum, row) => sum + row[1], 0);
  if (!weight) return null;
  return Math.round(available.reduce((sum, row) => sum + row[0] * row[1], 0) / weight);
}

function sealedRipQualityScore(parts) {
  if (sealedRipProductEvidenceCount(parts) < 2) return null;
  const available = [
    [Number(parts.chaseScore), 55, Boolean(parts.chaseEvidenceAvailable) && Number.isFinite(Number(parts.chaseScore))],
    [Number(parts.pullScore), 15, Boolean(parts.pullEvidenceAvailable) && Number.isFinite(Number(parts.pullScore))],
    [Number(parts.sentimentScore), 30, Boolean(parts.sentimentEvidenceAvailable) && Number.isFinite(Number(parts.sentimentScore))],
  ].filter(row => row[2]);
  const weight = available.reduce((sum, row) => sum + row[1], 0);
  if (!weight) return null;
  return Math.round(available.reduce((sum, row) => sum + row[0] * row[1], 0) / weight);
}
'''
worker = regex_once(
    worker,
    r'function sealedRipFinalVerdict\(score, parts = \{\}\) \{.*?\n\}\n\nfunction sealedRipWeightedScore\(parts\) \{.*?\n\}\n\nfunction sealedRipQualityScore\(parts\) \{.*?\n\}',
    scoring,
    'flexible rip scoring',
)

# A verified checklist can support a chase-quality score even when we cannot safely
# name individual chase cards. Names still require the stricter validator below.
normalize_helper_marker = 'function sealedRipNormalize(raw, evidenceRows, market) {'
normalize_helper = '''function sealedRipChaseContextSupported(evidenceRows) {
  const rows = (Array.isArray(evidenceRows) ? evidenceRows : []).filter(row => row?.queryKind === "checklist-and-odds" && row?.sourceType !== "community");
  if (!rows.length) return false;
  const text = rows.map(row => `${row?.title || ""} ${row?.snippet || ""} ${row?.pageText || ""}`).join(" ").toLowerCase();
  const signals = [
    /\\brookies?\\b/,
    /\\b(?:autograph|auto|signatures?|hyper signatures?|rookie signatures?)\\b/,
    /\\b(?:parallel|exclusive|numbered|green hoops|light burst)\\b/,
    /\\b(?:case hit|ssp|short print|block by block|boom shaka laka)\\b/,
    /\\b(?:insert|inserts)\\b/,
  ];
  return signals.some(pattern => pattern.test(text));
}

'''
worker = replace_once(worker, normalize_helper_marker, normalize_helper + normalize_helper_marker, 'chase context helper')

normalize = '''function sealedRipNormalize(raw, evidenceRows, market) {
  const evidenceText = evidenceRows.map(row => `${row.title} ${row.snippet} ${row.pageText || ""}`).join("\\n");
  const chaseCards = (Array.isArray(raw?.chaseCards) ? raw.chaseCards : []).slice(0, 5).map(row => ({
    name: String(row?.name || "").trim().slice(0, 140),
    why: String(row?.why || "").trim().slice(0, 240),
  })).filter(row => row.name && sealedRipChaseSupported(row.name, evidenceText));
  const pullOdds = (Array.isArray(raw?.pullOdds) ? raw.pullOdds : []).slice(0, 8).map(row => ({
    item: String(row?.item || "").trim().slice(0, 160),
    odds: String(row?.odds || "").trim().slice(0, 80),
    sourceType: String(row?.sourceType || "reported").trim().slice(0, 50),
    note: String(row?.note || "").trim().slice(0, 260),
  })).filter(row => row.item && row.odds && sealedRipOddsSupported(row.odds, evidenceText));

  const chaseContextAvailable = sealedRipChaseContextSupported(evidenceRows);
  const chaseEvidenceAvailable = chaseCards.length > 0 || chaseContextAvailable;
  const pullEvidenceAvailable = pullOdds.length > 0;
  const hasCommunitySource = evidenceRows.some(row => row?.sourceType === "community");
  const sentimentEvidenceAvailable = Boolean(raw?.sentimentEvidenceAvailable) && hasCommunitySource;
  const priceScore = sealedRipPriceScore(market?.shelfPrice, market?.median);
  const parts = {
    priceScore,
    chaseScore: chaseEvidenceAvailable ? sealedRipClampScore(raw?.chaseScore) : null,
    chaseEvidenceAvailable,
    pullScore: pullEvidenceAvailable ? sealedRipClampScore(raw?.pullScore) : null,
    pullEvidenceAvailable,
    sentimentScore: sentimentEvidenceAvailable ? sealedRipClampScore(raw?.sentimentScore) : null,
    sentimentEvidenceAvailable,
  };
  const overallScore = sealedRipWeightedScore(parts);
  const ripScore = sealedRipQualityScore(parts);
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
    pullScore: parts.pullScore,
    pullEvidenceAvailable,
    sentimentScore: parts.sentimentScore,
    sentimentEvidenceAvailable,
    sentimentLabel: sentimentEvidenceAvailable ? String(raw?.sentimentLabel || "mixed").slice(0, 40) : "unknown",
    evidenceCount,
    recommendationConfidence,
    qualitySummary,
    chaseCards,
    pullOdds,
    collectorTake: sentimentEvidenceAvailable ? String(raw?.collectorTake || "").trim().slice(0, 700) : "Scout did not find enough recurring exact-product collector discussion to score sentiment.",
    positives: (Array.isArray(raw?.positives) ? raw.positives : []).map(x => String(x || "").trim().slice(0, 220)).filter(Boolean).slice(0, 4),
    negatives: (Array.isArray(raw?.negatives) ? raw.negatives : []).map(x => String(x || "").trim().slice(0, 220)).filter(Boolean).slice(0, 4),
    confidence: evidenceCount < 2 ? "low" : (["high", "medium", "low"].includes(confidenceRaw) ? confidenceRaw : recommendationConfidence),
  };
}

function sealedBarcodeDigits'''
worker = regex_once(
    worker,
    r'function sealedRipNormalize\(raw, evidenceRows, market\) \{.*?\n\}\n\nfunction sealedBarcodeDigits',
    normalize,
    'rip normalization',
)

# Product intelligence is reusable for two weeks; today's price is always supplied
# separately and rescored on every request.
worker = replace_once(
    worker,
    '      const cacheKey = `sealed:rip:v10:${encodeURIComponent(productLabel.toLowerCase()).slice(0, 300)}`;',
    '      const cacheKey = sealedRipIntelligenceCacheKey(identity);',
    'product intelligence cache key',
)
worker = replace_once(
    worker,
    '          if (cached?.productLabel === productLabel && cached?.analysis) {',
    '          if (cached?.analysis) {',
    'product intelligence cache reuse',
)
worker = replace_once(
    worker,
    '            return json({ ok: true, version: VERSION, productLabel, market, analysis, sources: cached.sources || [], checkedAt: cached.checkedAt || new Date().toISOString(), cacheHit: true, researchSearchesUsed: 0, marketplaceSearchesUsed: 0 }, 200, cors);',
    '            return json({ ok: true, version: VERSION, productLabel, market, analysis, sources: cached.sources || [], checkedAt: cached.checkedAt || new Date().toISOString(), cacheHit: true, intelligenceCacheHit: true, intelligenceTtlDays: 14, researchSearchesUsed: 0, marketplaceSearchesUsed: 0 }, 200, cors);',
    'cached intelligence response',
)
worker = replace_once(
    worker,
    '        try { await env.SCOUT_DATA.put(cacheKey, JSON.stringify({ productLabel, analysis: aiObject, evidenceRows, sources, checkedAt }), { expirationTtl: 24 * 60 * 60 }); } catch {}',
    '        try { await env.SCOUT_DATA.put(cacheKey, JSON.stringify({ productLabel, analysis: aiObject, evidenceRows, sources, checkedAt }), { expirationTtl: 14 * 24 * 60 * 60 }); } catch {}',
    'product intelligence ttl',
)
worker = replace_once(
    worker,
    '      return json({ ok: true, version: VERSION, productLabel, market, analysis, sources, researchMix, checkedAt, cacheHit: false, researchSearchesUsed, marketplaceSearchesUsed: 0 }, 200, cors);',
    '      return json({ ok: true, version: VERSION, productLabel, market, analysis, sources, researchMix, checkedAt, cacheHit: false, intelligenceCacheHit: false, intelligenceTtlDays: 14, researchSearchesUsed, marketplaceSearchesUsed: 0 }, 200, cors);',
    'fresh intelligence response',
)

# Tell the model that chase quality can be scored from verified product structure even
# when named chase cards cannot be safely extracted. Pull odds remain optional.
worker = replace_once(
    worker,
    'Set chaseEvidenceAvailable=false and return an empty chaseCards array only if you truly cannot support any named chase from the evidence. Score chaseScore 0-100 only when chaseEvidenceAvailable=true, for breadth and quality of meaningful rookies, stars, inserts, case hits, autographs, numbered/color parallels, and format exclusives.',
    'chaseCards must stay empty when individual names are not source-supported. Separately, set chaseEvidenceAvailable=true when trustworthy checklist/official evidence clearly supports meaningful chase STRUCTURE for this exact product family—such as rookies, inserts, case hits, autographs, numbered/color parallels, or retail exclusives—even if no individual chaseCards names can be safely validated. Set chaseEvidenceAvailable=false only when even that product-level chase structure is not supported. Score chaseScore 0-100 only when chaseEvidenceAvailable=true, for breadth and quality of meaningful rookies, stars, inserts, case hits, autographs, numbered/color parallels, and format exclusives.',
    'chase structure prompt',
)
worker = replace_once(
    worker,
    'Score pullScore 0-100 only when the evidence supports a realistic assessment for this exact format; otherwise set pullEvidenceAvailable=false.',
    'Score pullScore 0-100 only when the evidence supports a realistic assessment for this exact format; otherwise set pullEvidenceAvailable=false. Missing exact pull odds are NOT a reason by themselves to withhold a buy/maybe/pass recommendation.',
    'optional pull odds prompt',
)
worker_path.write_text(worker, encoding='utf-8')

# Front end: make the decision goal explicit and show confidence/missing evidence clearly.
app_path = Path('sealed-product-scout.js')
app = app_path.read_text(encoding='utf-8')
old_step = '''        <div class="sealed-card sealed-next" id="sealedRipCard">
          <div class="section-eyebrow">STEP 4 · IS IT WORTH RIPPING?</div>
          <div class="sealed-card-title">A fair price can still be a bad box.</div>
          <div class="sealed-card-sub">Scout researches the chase cards, trustworthy pull odds for this exact format, and recurring collector reports. It then combines rip quality with the price you just checked. Fresh analysis uses at most 2 research searches and 0 marketplace searches; cached analysis uses 0.</div>
          <div class="sealed-actions one"><button type="button" class="primary" id="sealedRipResearchBtn">🎯 CHECK RIP QUALITY · 2 RESEARCH SEARCHES MAX</button></div>
          <div class="sealed-status" id="sealedRipStatus">Run the market-price check first, then Scout can judge whether opening this product is actually worth it.</div>
          <div class="sealed-rip-result" id="sealedRipResult" hidden></div>
        </div>'''
new_step = '''        <div class="sealed-card sealed-next" id="sealedRipCard">
          <div class="section-eyebrow">STEP 4 · SHOULD I BUY THIS?</div>
          <div class="sealed-card-title">Good price + good product = the real decision.</div>
          <div class="sealed-card-sub">Scout combines the market price with chase/checklist quality and recurring collector experience. Exact pull odds are used when trustworthy odds exist, but they are optional—not a requirement for a recommendation. Product intelligence is reused for 14 days; the market price stays separate and can be refreshed anytime.</div>
          <div class="sealed-actions one"><button type="button" class="primary" id="sealedRipResearchBtn">🎯 GET SCOUT'S BUY CALL · 2 RESEARCH SEARCHES MAX</button></div>
          <div class="sealed-status" id="sealedRipStatus">Run the market-price check first, then Scout can combine price with what the product is actually like to open.</div>
          <div class="sealed-rip-result" id="sealedRipResult" hidden></div>
        </div>'''
app = replace_once(app, old_step, new_step, 'buy-call step')

app = replace_once(
    app,
    '    const searches=Number(result.researchSearchesUsed||0),cached=result.cacheHit?" · cached result":"";',
    '    const searches=Number(result.researchSearchesUsed||0),cached=result.cacheHit?" · product intelligence cache":"";\n    const confidence=String(a.recommendationConfidence||a.confidence||"low").toUpperCase();',
    'recommendation confidence',
)
app = replace_once(
    app,
    '    const pullBlock=a.pullEvidenceAvailable&&odds?odds:`<div class="sealed-rip-copy">Scout did not find reliable exact-format pull odds, so pull odds were not scored. No made-up odds.</div>`;',
    '    const pullBlock=a.pullEvidenceAvailable&&odds?odds:`<div class="sealed-rip-copy">Exact-format pull odds were not reliably verified. Scout treats odds as optional, leaves this score N/A, and does not make them up.</div>`;\n    const chaseFallback=a.chaseEvidenceAvailable?`<div class="sealed-rip-copy">Scout found enough trustworthy checklist/chase structure to score this product, but could not verify a clean named Top Chases list yet.</div>`:`<div class="sealed-rip-copy">Scout did not find enough trustworthy chase/checklist evidence to score this part yet.</div>`;',
    'optional odds and chase fallback',
)
app = replace_once(
    app,
    ' · Evidence: <strong>${Number(a.evidenceCount||0)}/3</strong>${a.qualitySummary?',
    ' · Product evidence: <strong>${Number(a.evidenceCount||0)}/3</strong> · Confidence: <strong>${esc(confidence)}</strong>${a.qualitySummary?',
    'confidence summary',
)
app = replace_once(
    app,
    "${chase||'<div class=\"sealed-rip-copy\">No well-supported chase list found yet.</div>'}",
    '${chase||chaseFallback}',
    'chase fallback display',
)
app = replace_once(
    app,
    'Official/checklist odds are kept separate from community observations. Opening is still chance; a strong chase list does not guarantee value in one box.',
    'Product intelligence is reused for up to 14 days while price is checked separately. Exact pull odds are optional and are never invented. Opening is still chance; no recommendation guarantees value in one box.',
    'product intelligence note',
)
app = replace_once(
    app,
    'btn.disabled=true;btn.textContent="🎯 SCOUT IS RESEARCHING THE RIP…";status.className="sealed-status";status.textContent="Checking chase cards, exact-format pull odds, and recurring collector reports. Up to 2 research searches; 0 marketplace searches.";',
    'btn.disabled=true;btn.textContent="🎯 SCOUT IS BUILDING THE BUY CALL…";status.className="sealed-status";status.textContent="Checking chase/checklist quality and recurring collector experience. Exact pull odds are used when available, not required. Up to 2 research searches; 0 marketplace searches.";',
    'buy call loading copy',
)
app = replace_once(
    app,
    'finally{btn.disabled=false;btn.textContent="🎯 CHECK RIP QUALITY · 2 RESEARCH SEARCHES MAX";}',
    'finally{btn.disabled=false;btn.textContent="🎯 GET SCOUT\'S BUY CALL · 2 RESEARCH SEARCHES MAX";}',
    'buy call button reset',
)
app_path.write_text(app, encoding='utf-8')

# Cache-bust the PWA/front-end script without depending on the previous patch version.
index_path = Path('index.html')
html = index_path.read_text(encoding='utf-8')
html, count = re.subn(r'sealed-product-scout\.js\?v=[0-9.]+', 'sealed-product-scout.js?v=6.2.0', html, count=1)
if count != 1:
    raise SystemExit(f'Expected one sealed scanner cache-bust tag; got {count}')
index_path.write_text(html, encoding='utf-8')

# Replace legacy rip tests with the new recommendation rules and cache architecture.
test_path = Path('tests/sealed-product-vision.test.cjs')
test = test_path.read_text(encoding='utf-8')
test = test.replace('3\\.38\\.13', '3\\.39\\.0', 1)
test = test.replace("assert.match(worker,/sealed:rip:v10:/,'rip-quality research must be cached');", "assert.match(worker,/sealed:intel:v1:/,'sealed product intelligence must use a reusable product cache');")
test = test.replace("assert.match(worker,/const chaseEvidenceAvailable = chaseCards\\.length > 0/,'validated named chases must establish chase evidence even if the model boolean is inconsistent');", "assert.match(worker,/const chaseEvidenceAvailable = chaseCards\\.length > 0 \\|\\| chaseContextAvailable/,'chase quality may use verified checklist structure even when named chases are unavailable');")
anchor = "assert.match(worker,/sealedRipWeightedScore/,'final verdict must combine price, chases, pull evidence, and sentiment');\n"
extra = anchor + "assert.match(worker,/sealedRipProductEvidenceCount/,'buy recommendation must count the three product-quality evidence pillars');\nassert.match(worker,/sealedRipProductEvidenceCount\\(parts\\) < 2/,'buy recommendation must require two of three product-quality pillars');\nassert.match(worker,/\\[Number\\(parts\\.pullScore\\), 10/,'pull odds must be optional rather than dominate the buy recommendation');\nassert.match(worker,/sealedRipIntelligenceCacheKey/,'product intelligence must be cached independently of shelf price');\nassert.match(worker,/14 \\* 24 \\* 60 \\* 60/,'product intelligence should be reusable for fourteen days');\nassert.match(worker,/sealedRipChaseContextSupported/,'verified checklist structure must support chase-quality scoring without invented chase names');\nassert.match(app,/STEP 4 · SHOULD I BUY THIS\\?/,'sealed scanner must frame the final step as the purchase decision');\nassert.match(app,/Confidence: <strong>/,'sealed scanner must show recommendation confidence');\nassert.match(app,/Exact-format pull odds were not reliably verified/,'missing exact odds must be shown as optional instead of blocking a recommendation');\nassert.match(index,/sealed-product-scout\\.js\\?v=6\\.2\\.0/,'sealed scanner cache-bust must advance for the new buy-call UI');\n"
if 'buy recommendation must count the three product-quality evidence pillars' not in test:
    test = replace_once(test, anchor, extra, 'new recommendation regression checks')
test_path.write_text(test, encoding='utf-8')
