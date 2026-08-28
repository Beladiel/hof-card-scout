from pathlib import Path
import re

worker_path = Path('src/index.js')
app_path = Path('sealed-product-scout.js')
index_path = Path('index.html')
test_path = Path('tests/sealed-product-vision.test.cjs')

worker = worker_path.read_text(encoding='utf-8')
app = app_path.read_text(encoding='utf-8')
index = index_path.read_text(encoding='utf-8')
tests = test_path.read_text(encoding='utf-8')

# Version/cache bump so no old mixed-lane intelligence is reused.
worker = worker.replace('const VERSION = "3.42.2";', 'const VERSION = "3.43.0";', 1)
worker = worker.replace('sealed:intel:v13:', 'sealed:intel:v14:', 1)

# Add explicit evidence-lane helpers before price-guide rows.
anchor = '''function sealedRipPriceGuideRows(evidenceRows = [], identity = {}) {
'''
helpers = '''function sealedRipAuthorityRows(evidenceRows = [], identity = {}) {
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

'''
if anchor not in worker:
    raise SystemExit('price-guide helper anchor not found')
worker = worker.replace(anchor, helpers + anchor, 1)

# Verified chase structure must be authority-lane only.
old = '''  const authorityText = (Array.isArray(evidenceRows) ? evidenceRows : [])
    .filter(row => row?.sourceType !== "community")
    .map(row => `${row?.title || ""} ${row?.snippet || ""} ${row?.pageText || ""}`)
'''
new = '''  const authorityText = sealedRipAuthorityRows(evidenceRows)
    .map(row => `${row?.title || ""} ${row?.snippet || ""} ${row?.pageText || ""}`)
'''
if old not in worker:
    raise SystemExit('verified chase authority text block not found')
worker = worker.replace(old, new, 1)

# Format access may only come from authority rows, never price-guide/community rows.
old = '''  return (Array.isArray(evidenceRows) ? evidenceRows : []).some(row => {
    if (row?.sourceType === "community") return false;
    if (!sealedRipEvidenceRowMatchesIdentity(row, identity)) return false;
'''
new = '''  return sealedRipAuthorityRows(evidenceRows, identity).some(row => {
'''
# Replace only first occurrence (format access context).
if old not in worker:
    raise SystemExit('format access context lane block not found')
worker = worker.replace(old, new, 1)

old = '''  const texts = (Array.isArray(evidenceRows) ? evidenceRows : []).filter(row => {
    if (row?.sourceType === "community") return false;
    if (!sealedRipEvidenceRowMatchesIdentity(row, identity)) return false;
'''
new = '''  const texts = sealedRipAuthorityRows(evidenceRows, identity).filter(row => {
'''
if old not in worker:
    raise SystemExit('format access fallback lane block not found')
worker = worker.replace(old, new, 1)

# Odds may use authority or compatible community evidence in single-product mode,
# but price-guide rows are categorically excluded.
old = '''  return (Array.isArray(evidenceRows) ? evidenceRows : []).some(source => {
    if (!sealedRipEvidenceRowMatchesIdentity(source, identity)) return false;
    if (wantsAuthority && source?.sourceType === "community") return false;
'''
new = '''  return sealedRipPullEvidenceRows(evidenceRows, identity).some(source => {
    if (wantsAuthority && (source?.sourceType === "community" || source?.queryKind !== "checklist-and-odds")) return false;
'''
if old not in worker:
    raise SystemExit('odds evidence lane block not found')
worker = worker.replace(old, new, 1)

# Normalize each lane independently. Price-guide evidence cannot affect set/chase,
# format access, or odds. Remove the Chase Depth -> Set Strength floor entirely.
pattern = re.compile(r'''function sealedRipNormalize\(raw, evidenceRows, market, identity = \{\}\) \{.*?\n  const overallScore = sealedRipWeightedScore\(parts, identity\?\.category\);''', re.S)
replacement = '''function sealedRipNormalize(raw, evidenceRows, market, identity = {}, researchMode = "single") {
  const authorityRows = sealedRipAuthorityRows(evidenceRows, identity);
  const priceGuideRows = sealedRipPriceGuideRows(evidenceRows, identity);
  const pullEvidenceRows = sealedRipPullEvidenceRows(evidenceRows, identity);
  const authorityText = authorityRows.map(row => `${row.title} ${row.snippet} ${row.pageText || ""}`).join("\\n");
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
  const aiFormatAccessScore = sealedRipClampScore(raw?.formatAccessScore);
  const formatAccessScore = formatAccessEvidenceAvailable
    ? (Boolean(raw?.formatAccessEvidenceAvailable) && aiFormatAccessScore > 0
      ? aiFormatAccessScore
      : sealedRipFormatAccessFallbackScore(authorityRows, identity))
    : null;
  const rawFormatSummary = String(raw?.formatAccessSummary || "").trim().slice(0, 500);
  const formatAccessSummary = formatAccessEvidenceAvailable && sealedRipFormatTextCompatible(rawFormatSummary, identity) && sealedRipVariantTextCompatible(rawFormatSummary, identity)
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
  const overallScore = sealedRipWeightedScore(parts, identity?.category);'''
worker, count = pattern.subn(replacement, worker, count=1)
if count != 1:
    raise SystemExit(f'normalize replacement failed ({count})')

# Add lane diagnostics to normalized output.
needle = '''    researchProfile: sealedRipCategoryKey(identity?.category),
    scoreLabels: sealedRipScoreLabels(identity?.category),
'''
repl = '''    researchProfile: sealedRipCategoryKey(identity?.category),
    researchMode,
    lanes,
    scoreLabels: sealedRipScoreLabels(identity?.category),
'''
if needle not in worker:
    raise SystemExit('normalized output lane anchor not found')
worker = worker.replace(needle, repl, 1)

# Remove obsolete floor helper; the price-guide lane must never raise Set Strength.
worker, count = re.subn(r'''\nfunction sealedRipChaseDepthSetFloor\(chaseDepth = \{\}\) \{.*?\n\}\n\nfunction sealedRipPriceGuideEvidenceText''', '\nfunction sealedRipPriceGuideEvidenceText', worker, count=1, flags=re.S)
if count != 1:
    raise SystemExit('could not remove Chase Depth Set floor')

# Pass researchMode into both normalization paths.
worker = worker.replace('sealedRipNormalize(cached.analysis, Array.isArray(cached.evidenceRows) ? cached.evidenceRows : [], market, identity)', 'sealedRipNormalize(cached.analysis, Array.isArray(cached.evidenceRows) ? cached.evidenceRows : [], market, identity, researchMode)', 1)
worker = worker.replace('sealedRipNormalize(aiObject, evidenceRows, market, identity)', 'sealedRipNormalize(aiObject, evidenceRows, market, identity, researchMode)', 1)

# Main synthesis never extracts price-guide data; a dedicated price-only pass does it.
old = '''For Shelf Showdown Chase Depth, chaseValueCards may be populated ONLY from evidence rows marked SEARCH=singles-price-guide. Each row must preserve an exact card name and a literal current singles market/guide price shown together in that evidence. marketPrice is the single-card price, never the sealed box price. Return no more than 15 of the strongest supported values and return [] when no singles price guide evidence exists. This is SET-LEVEL value depth; do not claim a card is accessible from the exact box unless the separate format-access evidence supports that conclusion.'''
new = '''For Shelf Showdown, the main synthesis receives NO singles-price-guide lane. Always return chaseValueCards=[] here. Chase Depth is populated later by a dedicated PRICE-GUIDE-ONLY extraction pass. Never use price/value text from this authority prompt as singles pricing.'''
if old not in worker:
    raise SystemExit('main prompt chase-depth paragraph not found')
worker = worker.replace(old, new, 1)

# Replace mixed recovery with two typed, independent recovery passes.
pattern = re.compile(r'''      // If the broad synthesis misses named chases or literal odds, make one compact\n.*?      \}\n      const analysis = sealedRipNormalize''', re.S)
replacement = '''      // Recovery is lane-typed. Authority recovery can only produce set/chase and
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
        const authorityRecoveryPrompt = `AUTHORITY-ONLY RECOVERY for ${productLabel} (${String(identity?.productType || identity?.boxType || "")}). Extract only category-appropriate named chase/set signals and literal pull odds from the AUTHORITY evidence below. Do not output singles prices. Preserve literal rates exactly. Omit any odds for an incompatible format or retailer variant. Never invent names or rates.\\n\\nAUTHORITY EVIDENCE:\\n${evidenceSignals}`;
        try {
          const recoveredRaw = await env.AI.run(SEALED_RIP_MODEL, {
            prompt: authorityRecoveryPrompt,
            max_tokens: 700,
            temperature: 0,
            response_format: { type: "json_schema", json_schema: authorityRecoverySchema }
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
        const priceGuideRecoveryPrompt = `PRICE-GUIDE-ONLY RECOVERY for ${productLabel}. Extract only exact card name + literal current raw/market singles price records from the price-guide evidence below. Do not output set strength, format access, chase claims, or pull odds. Never use sealed box/pack prices. Never infer a price that is not literally paired with the card in the supplied evidence.\\n\\nPRICE-GUIDE EVIDENCE:\\n${priceGuideSignals}`;
        try {
          const recoveredRaw = await env.AI.run(SEALED_RIP_MODEL, {
            prompt: priceGuideRecoveryPrompt,
            max_tokens: 700,
            temperature: 0,
            response_format: { type: "json_schema", json_schema: priceGuideRecoverySchema }
          });
          const recovered = sealedRipAiJson(recoveredRaw);
          if (Array.isArray(recovered?.chaseValueCards) && recovered.chaseValueCards.length) {
            aiObject.chaseValueCards = recovered.chaseValueCards;
          }
        } catch (err) {
          console.warn("sealed price-guide-only recovery skipped", err);
        }
      }
      const analysis = sealedRipNormalize'''
worker, count = pattern.subn(replacement, worker, count=1)
if count != 1:
    raise SystemExit(f'recovery split replacement failed ({count})')

# Frontend: preserve and display typed lane status. Also require any explicit lane
# state to be complete for ranking.
old = '''    if(!analysis?.chaseEvidenceAvailable||set===null)missing.push("Set/chase evidence");
    const rankable=missing.length===0;
'''
new = '''    if(!analysis?.chaseEvidenceAvailable||set===null)missing.push("Set/chase evidence");
    const lanes=analysis?.lanes||{};
    if(lanes.authority?.status&&lanes.authority.status!=="complete")missing.push("Authority lane");
    if(lanes.priceGuide?.status&&lanes.priceGuide.status!=="complete")missing.push("Price-guide lane");
    if(lanes.market?.status&&lanes.market.status!=="complete")missing.push("Market lane");
    const rankable=missing.length===0;
'''
if old not in app:
    raise SystemExit('frontend rankability lane anchor not found')
app = app.replace(old, new, 1)

old = '''      const issue=row.error?`<div class="sealed-showdown-copy">⚠ ${esc(row.error)}</div>`:"";
      const meta=rankable?`${esc(m.confidence||"MEDIUM")} ranking confidence`:"INCOMPLETE · NOT RANKED";
'''
new = '''      const issue=row.error?`<div class="sealed-showdown-copy">⚠ ${esc(row.error)}</div>`:"";
      const lanes=a?.lanes||{};
      const laneLabel=value=>String(value||"unknown").replace(/_/g," ").toUpperCase();
      const laneCopy=`Authority ${laneLabel(lanes.authority?.status)} · Price Guide ${laneLabel(lanes.priceGuide?.status)} · Market ${laneLabel(lanes.market?.status)}`;
      const meta=rankable?`${esc(m.confidence||"MEDIUM")} ranking confidence`:"INCOMPLETE · NOT RANKED";
'''
if old not in app:
    raise SystemExit('frontend renderer lane variable anchor not found')
app = app.replace(old, new, 1)

old = '''<div class="sealed-showdown-copy">${reason}</div><div class="sealed-showdown-copy"><strong>Chase Depth:</strong> ${esc(depthCopy)}</div>'''
new = '''<div class="sealed-showdown-copy"><strong>Evidence lanes:</strong> ${esc(laneCopy)}</div><div class="sealed-showdown-copy">${reason}</div><div class="sealed-showdown-copy"><strong>Chase Depth:</strong> ${esc(depthCopy)}</div>'''
if old not in app:
    raise SystemExit('frontend lane display insertion anchor not found')
app = app.replace(old, new, 1)

old = '''qualitySummary:row.analysis?.qualitySummary||"",researchProfile:row.analysis?.researchProfile||""},metrics:row.metrics,error:row.error}));'''
new = '''qualitySummary:row.analysis?.qualitySummary||"",researchProfile:row.analysis?.researchProfile||"",researchMode:row.analysis?.researchMode||"",lanes:row.analysis?.lanes||{}},metrics:row.metrics,error:row.error}));'''
if old not in app:
    raise SystemExit('frontend compact analysis anchor not found')
app = app.replace(old, new, 1)

# Frontend cache-bust.
index, count = re.subn(r'sealed-product-scout\.js\?v=6\.5\.1', 'sealed-product-scout.js?v=6.5.2', index, count=1)
if count != 1:
    raise SystemExit(f'frontend cache bump failed ({count})')

# Regression tests.
tests = tests.replace('assert.match(worker,/const VERSION = "3\\.42\\.2"/);', 'assert.match(worker,/const VERSION = "3\\.43\\.0"/);', 1)
tests = tests.replace("assert.match(worker,/sealed:intel:v13:/,'sealed product intelligence must use a reusable mode-scoped product cache');", "assert.match(worker,/sealed:intel:v14:/,'sealed product intelligence must use a reusable mode-scoped product cache');", 1)
tests = tests.replace("assert.match(index,/sealed-product-scout\\.js\\?v=6\\.5\\.1/,'sealed scanner cache-bust must advance for incomplete-ranking safety');", "assert.match(index,/sealed-product-scout\\.js\\?v=6\\.5\\.2/,'sealed scanner cache-bust must advance for typed evidence lanes');", 1)

old_assert = "assert.match(worker,/function sealedRipChaseDepthSetFloor/,'verified Chase Depth must provide a conservative Set-strength contradiction floor');"
new_assert = '''assert.match(worker,/function sealedRipAuthorityRows/,'authority evidence must have an explicit typed lane');
assert.match(worker,/function sealedRipPullEvidenceRows/,'pull evidence must explicitly exclude the singles-price lane');
assert.match(worker,/function sealedRipLaneState/,'normalized analysis must expose lane completeness');
assert.ok(worker.includes('row?.queryKind === "checklist-and-odds"'),'authority lane must be checklist/authority only');
assert.ok(worker.includes('row?.queryKind === "checklist-and-odds" || row?.queryKind === "collector-reports"'),'pull evidence may use authority/community but never price-guide rows');
assert.doesNotMatch(worker,/function sealedRipChaseDepthSetFloor/,'price-guide Chase Depth must not impose a Set Strength floor');'''
if old_assert not in tests:
    raise SystemExit('old Set floor assertion not found')
tests = tests.replace(old_assert, new_assert, 1)

tests = tests.replace("assert.ok(worker.includes('chaseCards.length > 0 || chaseContextAvailable || chaseDepth.available'),'verified singles depth must count as real chase evidence');", "assert.ok(worker.includes('const chaseEvidenceAvailable = chaseCards.length > 0 || chaseContextAvailable'),'Set/chase evidence must come only from the authority lane');", 1)

anchor = "assert.ok(worker.includes('synthesisRetryUsed'),'rip response must expose whether the compact synthesis fallback was needed');"
extra = '''\nassert.ok(worker.includes('AUTHORITY-ONLY RECOVERY'),'recovery for set/chase and odds must be authority-only');
assert.ok(worker.includes('PRICE-GUIDE-ONLY RECOVERY'),'Chase Depth recovery must be price-guide-only');
assert.ok(worker.includes('const authorityRows = sealedRipAuthorityRows'),'normalization must split authority evidence before validation');
assert.ok(worker.includes('const priceGuideRows = sealedRipPriceGuideRows'),'normalization must split price-guide evidence before validation');
assert.ok(worker.includes('lanes,'),'normalized response must expose lane status');
assert.ok(app.includes('Evidence lanes:'),'Showdown UI must display evidence-lane status');
assert.ok(app.includes('lanes:row.analysis?.lanes||{}'),'Showdown persistence must preserve lane status');'''
if anchor not in tests:
    raise SystemExit('test lane assertion anchor missing')
tests = tests.replace(anchor, anchor + extra, 1)

worker_path.write_text(worker, encoding='utf-8')
app_path.write_text(app, encoding='utf-8')
index_path.write_text(index, encoding='utf-8')
test_path.write_text(tests, encoding='utf-8')
print('Typed Showdown evidence lanes applied.')
