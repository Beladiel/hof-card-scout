from pathlib import Path

worker_path = Path('src/index.js')
front_path = Path('sealed-product-scout.js')
index_path = Path('index.html')
test_path = Path('tests/sealed-product-vision.test.cjs')

worker = worker_path.read_text(encoding='utf-8')
front = front_path.read_text(encoding='utf-8')
index = index_path.read_text(encoding='utf-8')
tests = test_path.read_text(encoding='utf-8')


def repl(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing pattern: {label}')
    return text.replace(old, new, 1)

# ---------------------------------------------------------------------------
# Worker: exact-format access metric used by Shelf Showdown.
# ---------------------------------------------------------------------------
worker = repl(worker, 'const VERSION = "3.41.0";', 'const VERSION = "3.41.1";', 'worker version')
worker = repl(worker, 'return `sealed:intel:v9:${encodeURIComponent(parts.join("|")).slice(0, 420)}`;', 'return `sealed:intel:v10:${encodeURIComponent(parts.join("|")).slice(0, 420)}`;', 'intel cache')

old_exact = '''function sealedRipExactFormatKey(identity = {}) {
  const type = String(identity?.boxType || identity?.productType || "").trim().toLowerCase();
  if (/blaster/.test(type)) return "blaster";
'''
new_exact = '''function sealedRipExactFormatKey(identity = {}) {
  const type = `${identity?.variant || ""} ${identity?.boxType || identity?.productType || ""}`.trim().toLowerCase();
  if (/collector\s+booster/.test(type)) return "collector_booster";
  if (/play\s+booster/.test(type)) return "play_booster";
  if (/jumpstart\s+booster/.test(type)) return "jumpstart_booster";
  if (/blaster/.test(type)) return "blaster";
'''
worker = repl(worker, old_exact, new_exact, 'exact format specialized boosters')

old_rules = '''  const rules = [
    ["value_box", /\\bvalue\\s+box\\b/],
'''
new_rules = '''  const rules = [
    ["collector_booster", /\\bcollector\\s+boosters?(?:\\s+(?:box|pack|display))?\\b/],
    ["play_booster", /\\bplay\\s+boosters?(?:\\s+(?:box|pack|display))?\\b/],
    ["jumpstart_booster", /\\bjumpstart\\s+boosters?(?:\\s+(?:box|pack|display))?\\b/],
    ["value_box", /\\bvalue\\s+box\\b/],
'''
worker = repl(worker, old_rules, new_rules, 'explicit specialized booster formats')

old_format_terms = '''function sealedRipFormatTerms(identity) {
  const type = String(identity?.productType || identity?.boxType || "").trim().toLowerCase();
  if (type.includes("blaster")) return '("blaster" OR "value box")';
'''
new_format_terms = '''function sealedRipFormatTerms(identity) {
  const type = `${identity?.variant || ""} ${identity?.productType || identity?.boxType || ""}`.trim().toLowerCase();
  if (type.includes("collector booster")) return '"collector booster"';
  if (type.includes("play booster")) return '"play booster"';
  if (type.includes("jumpstart booster")) return '"jumpstart booster"';
  if (type.includes("blaster")) return '("blaster" OR "value box")';
'''
worker = repl(worker, old_format_terms, new_format_terms, 'format search terms specialized boosters')

old_barcode_rules = '''  const productRules = [
    [/\\bmega\\s+box\\b/i, "Mega Box"],
'''
new_barcode_rules = '''  const productRules = [
    [/\\bcollector\\s+booster(?:\\s+(?:box|pack|display))?\\b/i, "Collector Booster"],
    [/\\bplay\\s+booster(?:\\s+(?:box|pack|display))?\\b/i, "Play Booster"],
    [/\\bjumpstart\\s+booster(?:\\s+(?:box|pack|display))?\\b/i, "Jumpstart Booster"],
    [/\\bmega\\s+box\\b/i, "Mega Box"],
'''
worker = repl(worker, old_barcode_rules, new_barcode_rules, 'barcode specialized booster types')

format_anchor = '''function sealedRipOddsRowSupported(row, evidenceRows, identity = {}) {
'''
format_helper = r'''function sealedRipFormatAccessContextSupported(evidenceRows, identity = {}) {
  const compatible = sealedRipCompatibleFormatKeys(identity);
  if (!compatible.size) return false;
  const key = sealedRipCategoryKey(identity?.category);
  const signal = key === "magic"
    ? /\b(?:mythic(?: rare)?|borderless|showcase|serialized|special guests?|bonus sheet|foil|headliner|extended art|source material)\b/i
    : key === "pokemon"
      ? /\b(?:special illustration rare|illustration rare|hyper rare|secret rare|ultra rare|promo|special treatment)\b/i
      : /\b(?:rookies?|autographs?|signatures?|parallel|exclusive|numbered|case hit|ssp|short print|insert)\b/i;
  return (Array.isArray(evidenceRows) ? evidenceRows : []).some(row => {
    if (row?.sourceType === "community") return false;
    if (!sealedRipEvidenceRowMatchesIdentity(row, identity)) return false;
    const text = `${row?.title || ""} ${row?.snippet || ""} ${row?.pageText || ""}`;
    if (!sealedRipVariantTextCompatible(text, identity)) return false;
    const explicit = sealedRipExplicitFormatKeys(text);
    if (!explicit.size || !Array.from(explicit).some(format => compatible.has(format))) return false;
    return signal.test(text);
  });
}

'''
worker = repl(worker, format_anchor, format_helper + format_anchor, 'format access helper')

old_norm = '''  const chaseContextAvailable = sealedRipChaseContextSupported(evidenceRows, identity?.category);
  const chaseEvidenceAvailable = chaseCards.length > 0 || chaseContextAvailable;
  const pullEvidenceAvailable = pullOdds.length > 0;
'''
new_norm = '''  const chaseContextAvailable = sealedRipChaseContextSupported(evidenceRows, identity?.category);
  const chaseEvidenceAvailable = chaseCards.length > 0 || chaseContextAvailable;
  const pullEvidenceAvailable = pullOdds.length > 0;
  const formatAccessContextAvailable = sealedRipFormatAccessContextSupported(evidenceRows, identity);
  const formatAccessEvidenceAvailable = Boolean(raw?.formatAccessEvidenceAvailable) && formatAccessContextAvailable;
  const formatAccessScore = formatAccessEvidenceAvailable ? sealedRipClampScore(raw?.formatAccessScore) : null;
  const rawFormatSummary = String(raw?.formatAccessSummary || "").trim().slice(0, 500);
  const formatAccessSummary = formatAccessEvidenceAvailable && sealedRipFormatTextCompatible(rawFormatSummary, identity) && sealedRipVariantTextCompatible(rawFormatSummary, identity)
    ? rawFormatSummary
    : (formatAccessContextAvailable ? "Scout verified exact-format evidence, but could not safely summarize how deeply this configuration reaches the set's desirable cards." : "Scout could not verify exact-format access to the set's desirable cards or treatments.");
'''
worker = repl(worker, old_norm, new_norm, 'normalize format access')

old_return_piece = '''    namedChasesVerified: chaseCards.length,
    pullScore: parts.pullScore,
'''
new_return_piece = '''    namedChasesVerified: chaseCards.length,
    formatAccessScore,
    formatAccessEvidenceAvailable,
    formatAccessContextAvailable,
    formatAccessSummary,
    pullScore: parts.pullScore,
'''
worker = repl(worker, old_return_piece, new_return_piece, 'return format access')

old_schema = '''          chaseEvidenceAvailable: { type: "boolean" },
          pullScore: { type: "number" },
'''
new_schema = '''          chaseEvidenceAvailable: { type: "boolean" },
          formatAccessScore: { type: "number" },
          formatAccessEvidenceAvailable: { type: "boolean" },
          formatAccessSummary: { type: "string" },
          pullScore: { type: "number" },
'''
worker = repl(worker, old_schema, new_schema, 'schema format access props')

old_required = '''        required: ["qualitySummary", "chaseScore", "chaseEvidenceAvailable", "pullScore", "pullEvidenceAvailable", "sentimentScore", "sentimentEvidenceAvailable", "sentimentLabel", "chaseCards", "pullOdds", "collectorTake", "positives", "negatives", "confidence"]
'''
new_required = '''        required: ["qualitySummary", "chaseScore", "chaseEvidenceAvailable", "formatAccessScore", "formatAccessEvidenceAvailable", "formatAccessSummary", "pullScore", "pullEvidenceAvailable", "sentimentScore", "sentimentEvidenceAvailable", "sentimentLabel", "chaseCards", "pullOdds", "collectorTake", "positives", "negatives", "confidence"]
'''
worker = repl(worker, old_required, new_required, 'schema required format access')

prompt_anchor = '''Named items in chaseCards must be explicitly supported by the supplied evidence; do not invent card names, players, Pokémon, treatments, inserts, or variants.'''
prompt_replacement = '''Evaluate exact-format access separately for Shelf Showdown. Set formatAccessEvidenceAvailable=true ONLY when official/checklist/editorial evidence explicitly identifies this exact sealed format (including a clearly compatible retail alias) and describes desirable rarity/treatment/chase families that this configuration can contain. Score formatAccessScore 0-100 for how well THIS exact configuration reaches the desirable parts of the set, not for the set's overall quality. A format that excludes major desirable treatments should score lower; a format with broad access to the important chase structure can score higher. If the evidence is only set-level and does not establish exact-format access, set formatAccessEvidenceAvailable=false, formatAccessScore=0, and say so in formatAccessSummary. Never infer format access from another box type, retailer-exclusive variant, or community anecdote.\n\nNamed items in chaseCards must be explicitly supported by the supplied evidence; do not invent card names, players, Pokémon, treatments, inserts, or variants.'''
worker = repl(worker, prompt_anchor, prompt_replacement, 'prompt format access rule')

# ---------------------------------------------------------------------------
# Front-end: Shelf Showdown queue and ranking.
# ---------------------------------------------------------------------------
front = repl(front, '  const DRAFT_KEY="scoutSealedProductDraftV1";\n', '  const DRAFT_KEY="scoutSealedProductDraftV1";\n  const SHOWDOWN_KEY="scoutSealedShelfShowdownV1";\n  const SHOWDOWN_MAX=5;\n', 'showdown constants')

helpers_anchor = '''  function saveDraft(patch){const next={...readDraft(),...patch,updatedAt:new Date().toISOString()};localStorage.setItem(DRAFT_KEY,JSON.stringify(next));return next;}
'''
helpers = '''  function readShowdown(){try{const raw=JSON.parse(localStorage.getItem(SHOWDOWN_KEY)||"{}");return {items:Array.isArray(raw.items)?raw.items.slice(0,SHOWDOWN_MAX):[],results:Array.isArray(raw.results)?raw.results:[],updatedAt:raw.updatedAt||""};}catch{return {items:[],results:[]};}}
  function saveShowdown(patch){const current=readShowdown(),next={...current,...patch,updatedAt:new Date().toISOString()};localStorage.setItem(SHOWDOWN_KEY,JSON.stringify(next));return next;}
  function showdownIdentityKey(identity,barcode=""){if(barcode)return `barcode:${barcode}`;return `identity:${[identity?.category,identity?.year,identity?.set,identity?.boxType,identity?.variant].map(x=>String(x||"").trim().toLowerCase()).join("|")}`;}
'''
front = repl(front, helpers_anchor, helpers_anchor + helpers, 'showdown storage helpers')

style_anchor = '''      .sealed-rip-note{font-size:9px;color:var(--muted);line-height:1.45;margin-top:10px}.sealed-next{opacity:1}.sealed-next strong{color:var(--gold)}
'''
style_new = '''      .sealed-rip-note{font-size:9px;color:var(--muted);line-height:1.45;margin-top:10px}.sealed-next{opacity:1}.sealed-next strong{color:var(--gold)}
      .sealed-showdown-card{border-color:rgba(230,189,99,.55);background:linear-gradient(145deg,rgba(230,189,99,.11),rgba(86,197,138,.05))}.sealed-showdown-count{display:inline-flex;border-radius:999px;padding:5px 8px;margin-top:8px;background:rgba(230,189,99,.12);border:1px solid rgba(230,189,99,.28);font-size:9px;font-weight:950;color:#f4d58a}.sealed-showdown-list{display:grid;gap:8px;margin-top:11px}.sealed-showdown-empty{border:1px dashed var(--line);border-radius:13px;padding:14px;text-align:center;color:var(--muted);font-size:11px;line-height:1.5}.sealed-showdown-item{display:grid;grid-template-columns:1fr auto;gap:9px;align-items:center;border:1px solid var(--line);border-radius:13px;padding:10px;background:rgba(0,0,0,.10)}.sealed-showdown-name{font-size:12px;font-weight:950;line-height:1.35}.sealed-showdown-meta{font-size:9px;color:var(--muted);line-height:1.4;margin-top:3px}.sealed-showdown-remove{min-height:34px!important;padding:5px 9px!important;font-size:9px!important}.sealed-showdown-results{display:grid;gap:10px;margin-top:12px}.sealed-showdown-results[hidden]{display:none}.sealed-showdown-rank{border:1px solid var(--line);border-radius:16px;padding:12px;background:rgba(0,0,0,.10)}.sealed-showdown-rank.top{border-color:rgba(230,189,99,.58);background:linear-gradient(145deg,rgba(230,189,99,.16),rgba(86,197,138,.06))}.sealed-showdown-rank-head{display:flex;gap:9px;align-items:flex-start}.sealed-showdown-place{font-size:24px;font-weight:950;line-height:1}.sealed-showdown-rank-name{font-size:15px;font-weight:950;line-height:1.3}.sealed-showdown-score{font-size:24px;font-weight:950;color:var(--gold);margin-left:auto;white-space:nowrap}.sealed-showdown-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:9px}.sealed-showdown-metric{border:1px solid var(--line);border-radius:10px;padding:7px;background:rgba(0,0,0,.08)}.sealed-showdown-metric-label{font-size:7px;color:var(--muted);font-weight:950;letter-spacing:.06em}.sealed-showdown-metric-value{font-size:15px;font-weight:950;margin-top:2px}.sealed-showdown-copy{font-size:10px;color:var(--muted);line-height:1.5;margin-top:8px}.sealed-showdown-best{display:inline-flex;margin-top:7px;border-radius:999px;padding:5px 8px;background:rgba(230,189,99,.15);border:1px solid rgba(230,189,99,.32);font-size:8px;font-weight:950;color:#f4d58a;letter-spacing:.05em}
'''
front = repl(front, style_anchor, style_new, 'showdown styles')

# Make barcode the obvious first choice.
front = repl(front,
'''          <div class="sealed-sub">Scan a pack, hanger, tin, bundle, box, or other sealed product. Scout can read the photo and propose the exact product for you to confirm before any pricing research happens. Photo identification uses <strong>0 marketplace searches</strong>.</div>''',
'''          <div class="sealed-sub">Barcode first: scan up to five shelf choices, enter each shelf price, then let Scout rank the best buy. Front photos stay available as a fallback when the barcode database cannot identify the exact package type. Barcode identification uses <strong>0 marketplace searches</strong>.</div>''',
'hero barcode copy')
front = repl(front,
'''          <div class="section-eyebrow">STEP 1 · SHOW SCOUT THE PRODUCT</div>
          <div class="sealed-card-title">Start with a clear photo of the front.</div>
          <div class="sealed-card-sub">Take or choose a photo, then tap Identify Product. Scout sends a compressed copy to Cloudflare Workers AI for identification only when you ask. Manual entry remains available if the packaging is unclear.</div>
          <div class="sealed-actions three">
            <button type="button" class="primary" id="sealedTakePhotoBtn">📷 TAKE PHOTO</button>
            <button type="button" class="secondary" id="sealedChoosePhotoBtn">🖼️ CHOOSE PHOTO</button>
            <button type="button" class="ghost" id="sealedManualBtn">⌨️ ENTER PRODUCT</button>
          </div>
          <input type="file" id="sealedCameraInput" accept="image/*" capture="environment" hidden>
          <input type="file" id="sealedPhotoInput" accept="image/*" hidden>
          <input type="file" id="sealedBarcodeCameraInput" accept="image/*" capture="environment" hidden>
          <input type="file" id="sealedTypeCameraInput" accept="image/*" capture="environment" hidden>
          <div class="sealed-actions">
            <button type="button" class="secondary" id="sealedBarcodePhotoBtn">▥ SCAN BARCODE</button>
            <button type="button" class="ghost" id="sealedBarcodeManualBtn">123 ENTER UPC / EAN</button>
          </div>''',
'''          <div class="section-eyebrow">STEP 1 · SCAN THE PRODUCT</div>
          <div class="sealed-card-title">Start with the barcode.</div>
          <div class="sealed-card-sub">Scan the UPC/EAN first. If the barcode database identifies the product but not the package type, Scout can use a front photo for just that missing detail.</div>
          <div class="sealed-actions">
            <button type="button" class="primary" id="sealedBarcodePhotoBtn">▥ SCAN BARCODE</button>
            <button type="button" class="secondary" id="sealedBarcodeManualBtn">123 ENTER UPC / EAN</button>
          </div>
          <div class="sealed-actions three">
            <button type="button" class="secondary" id="sealedTakePhotoBtn">📷 FRONT PHOTO FALLBACK</button>
            <button type="button" class="ghost" id="sealedChoosePhotoBtn">🖼️ CHOOSE PHOTO</button>
            <button type="button" class="ghost" id="sealedManualBtn">⌨️ ENTER PRODUCT</button>
          </div>
          <input type="file" id="sealedCameraInput" accept="image/*" capture="environment" hidden>
          <input type="file" id="sealedPhotoInput" accept="image/*" hidden>
          <input type="file" id="sealedBarcodeCameraInput" accept="image/*" capture="environment" hidden>
          <input type="file" id="sealedTypeCameraInput" accept="image/*" capture="environment" hidden>''',
'barcode first actions')

front = repl(front,
'''<option>Elite Trainer Box</option><option>Booster Box</option><option>Booster Bundle</option><option>Booster Pack</option><option>Collection Box</option>''',
'''<option>Elite Trainer Box</option><option>Collector Booster</option><option>Play Booster</option><option>Jumpstart Booster</option><option>Booster Box</option><option>Booster Bundle</option><option>Booster Pack</option><option>Collection Box</option>''',
'front specialized booster options')

front = repl(front,
'''          <div class="sealed-card-sub">Enter the shelf price, then Scout can compare it with current matching eBay listings. Tapping Check Market Value saves the price automatically. A fresh market check uses <strong>at most 1 marketplace search</strong>; a recent cached check uses 0. This first value gate is price-only — checklist/chase quality comes next.</div>''',
'''          <div class="sealed-card-sub">For Shelf Showdown, enter the shelf price and tap <strong>Add to Showdown</strong> — no research runs yet. The individual Market Value button still works when you want a one-box check.</div>''',
'price showdown copy')

front = repl(front,
'''          <div class="sealed-actions">
            <button type="button" class="secondary" id="sealedSavePriceBtn">SAVE SHELF PRICE · 0 SEARCHES</button>
            <button type="button" class="primary" id="sealedResearchPreviewBtn">💰 CHECK MARKET VALUE · 1 SEARCH MAX</button>
          </div>
''',
'''          <div class="sealed-actions">
            <button type="button" class="secondary" id="sealedSavePriceBtn">SAVE SHELF PRICE · 0 SEARCHES</button>
            <button type="button" class="ghost" id="sealedResearchPreviewBtn">💰 CHECK MARKET VALUE · 1 SEARCH MAX</button>
          </div>
          <div class="sealed-actions one"><button type="button" class="primary" id="sealedShowdownAddBtn">➕ ADD TO SHELF SHOWDOWN · 0 SEARCHES</button></div>
''',
'add showdown button')

showdown_card = '''
        <div class="sealed-card sealed-showdown-card" id="sealedShowdownCard">
          <div class="section-eyebrow">🏆 SHELF SHOWDOWN · UP TO 5 PRODUCTS</div>
          <div class="sealed-card-title">Scan the shelf. Scout ranks the best buy.</div>
          <div class="sealed-card-sub">Add 2–5 confirmed products with their shelf prices. Scout waits until you tap Rank My Shelf, then compares current price, set/chase strength, exact-format access, and supporting pull/player/collector evidence. Missing odds or Reddit feedback do not automatically block a ranking.</div>
          <span class="sealed-showdown-count" id="sealedShowdownCount">0 / 5 ADDED</span>
          <div class="sealed-showdown-list" id="sealedShowdownList"></div>
          <div class="sealed-actions">
            <button type="button" class="primary" id="sealedShowdownRankBtn" disabled>🏆 RANK MY SHELF</button>
            <button type="button" class="ghost" id="sealedShowdownClearBtn" disabled>CLEAR SHOWDOWN</button>
          </div>
          <div class="sealed-status" id="sealedShowdownStatus">Add at least two products. Research runs only when you rank the shelf.</div>
          <div class="sealed-showdown-results" id="sealedShowdownResults" hidden></div>
        </div>

'''
front = repl(front,
'''        <div class="sealed-card sealed-next" id="sealedRipCard">''',
showdown_card + '''        <div class="sealed-card sealed-next" id="sealedRipCard">''',
'insert showdown card')
front = repl(front,
'''          <div class="section-eyebrow">STEP 4 · SHOULD I BUY THIS?</div>
          <div class="sealed-card-title">Good price + good product = the real decision.</div>''',
'''          <div class="section-eyebrow">OPTIONAL · SINGLE PRODUCT DEEP DIVE</div>
          <div class="sealed-card-title">Want the full report on one box?</div>''',
'single product optional copy')

# Showdown functions inserted before startOver.
showdown_anchor = '''  function startOver(){
'''
showdown_functions = r'''  function showdownPriceScore(shelfPrice,median){
    const shelf=Number(shelfPrice),market=Number(median);if(!Number.isFinite(shelf)||shelf<=0||!Number.isFinite(market)||market<=0)return 25;
    const ratio=shelf/market;if(ratio<=.75)return 100;if(ratio<=.85)return 92;if(ratio<=.95)return 82;if(ratio<=1.05)return 72;if(ratio<=1.10)return 62;if(ratio<=1.20)return 45;return 25;
  }
  function showdownMetric(v,fallback){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):fallback;}
  function showdownScore(item,market,analysis){
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
  }
  function showdownReason(row){
    const m=row.metrics||{},a=row.analysis||{},market=row.market||{},parts=[];
    const shelf=Number(row.item?.shelfPrice),median=Number(market?.median);
    if(Number.isFinite(shelf)&&Number.isFinite(median)&&median>0){const pct=Math.round((1-shelf/median)*100);if(pct>=8)parts.push(`${pct}% below the current competitive-listing median`);else if(pct<=-8)parts.push(`${Math.abs(pct)}% above the current competitive-listing median`);else parts.push("priced close to the current competitive-listing median");}
    if(a?.chaseEvidenceAvailable)parts.push(`set/chase strength ${m.set}/100`);else parts.push("set/chase evidence is still thin");
    if(a?.formatAccessEvidenceAvailable)parts.push(`exact-format access ${m.format}/100`);else parts.push("exact-format chase access was not verified");
    return parts.join(" · ")+".";
  }
  function renderShowdownResults(results){
    const box=byId("sealedShowdownResults");if(!box)return;
    const rows=Array.isArray(results)?results:[];
    if(!rows.length){box.hidden=true;box.innerHTML="";return;}
    box.hidden=false;
    box.innerHTML=rows.map((row,index)=>{
      const place=index+1,label=identityLabel(row.item?.identity||{})||row.item?.lookupTitle||"Sealed product",m=row.metrics||{},a=row.analysis||{};
      const trophy=place===1?"🥇":place===2?"🥈":place===3?"🥉":`#${place}`;
      const formatCopy=a?.formatAccessEvidenceAvailable?(a.formatAccessSummary||"Exact-format access verified."):"Exact-format access not verified; Scout applied a conservative ranking penalty.";
      const issue=row.error?`<div class="sealed-showdown-copy">⚠ ${esc(row.error)}</div>`:"";
      return `<div class="sealed-showdown-rank ${place===1?"top":""}"><div class="sealed-showdown-rank-head"><div class="sealed-showdown-place">${trophy}</div><div><div class="sealed-showdown-rank-name">${esc(label)}</div><div class="sealed-showdown-meta">Shelf ${money(row.item?.shelfPrice)||"—"} · ${esc(String(row.item?.identity?.category||""))} · ${esc(m.confidence||"LOW")} ranking confidence</div>${place===1?'<span class="sealed-showdown-best">BEST SHELF BUY</span>':""}</div><div class="sealed-showdown-score">${Math.round(Number(m.total)||0)}</div></div><div class="sealed-showdown-metrics"><div class="sealed-showdown-metric"><div class="sealed-showdown-metric-label">PRICE</div><div class="sealed-showdown-metric-value">${m.price}</div></div><div class="sealed-showdown-metric"><div class="sealed-showdown-metric-label">SET / CHASE</div><div class="sealed-showdown-metric-value">${m.set}</div></div><div class="sealed-showdown-metric"><div class="sealed-showdown-metric-label">FORMAT ACCESS</div><div class="sealed-showdown-metric-value">${a?.formatAccessEvidenceAvailable?m.format:"N/A"}</div></div><div class="sealed-showdown-metric"><div class="sealed-showdown-metric-label">SUPPORT</div><div class="sealed-showdown-metric-value">${(a?.pullEvidenceAvailable||a?.sentimentEvidenceAvailable)?m.support:"N/A"}</div></div></div><div class="sealed-showdown-copy"><strong>Why it ranks here:</strong> ${esc(showdownReason(row))}<br>${esc(formatCopy)}</div>${issue}</div>`;
    }).join("");
  }
  function renderShowdown(state=readShowdown()){
    const list=byId("sealedShowdownList"),count=byId("sealedShowdownCount"),rank=byId("sealedShowdownRankBtn"),clear=byId("sealedShowdownClearBtn");if(!list)return;
    const items=Array.isArray(state.items)?state.items:[];
    if(count)count.textContent=`${items.length} / ${SHOWDOWN_MAX} ADDED`;
    list.innerHTML=items.length?items.map((item,index)=>`<div class="sealed-showdown-item"><div><div class="sealed-showdown-name">${index+1}. ${esc(identityLabel(item.identity)||item.lookupTitle||"Sealed product")}</div><div class="sealed-showdown-meta">${esc(String(item.identity?.category||""))} · Shelf ${money(item.shelfPrice)||"—"}${item.store?` · ${esc(item.store)}`:""}</div></div><button type="button" class="ghost sealed-showdown-remove" data-showdown-remove="${esc(item.id)}">REMOVE</button></div>`).join(""):'<div class="sealed-showdown-empty">No products added yet.<br>Scan a barcode, enter its shelf price, then tap <strong>Add to Shelf Showdown</strong>.</div>';
    list.querySelectorAll('[data-showdown-remove]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.getAttribute('data-showdown-remove');const next=readShowdown().items.filter(x=>x.id!==id);const saved=saveShowdown({items:next,results:[]});renderShowdown(saved);const status=byId("sealedShowdownStatus");if(status){status.className="sealed-status";status.textContent=next.length>=2?"Ready to rank when you are.":"Add at least two products. Research runs only when you rank the shelf.";}}));
    if(rank)rank.disabled=items.length<2;
    if(clear)clear.disabled=!items.length;
    renderShowdownResults(state.results||[]);
  }
  function addCurrentToShowdown(){
    const status=byId("sealedShowdownStatus"),identity=identityFromFields(),draft=readDraft();
    if(!identity.category||!identity.set||!identity.boxType){status.className="sealed-status warn";status.textContent="Scan and confirm enough identity detail to fill Category, Brand / Set, and Product Type before adding this box.";byId("sealedIdentityCard")?.scrollIntoView({behavior:"smooth",block:"start"});return;}
    const raw=byId("sealedShelfPrice")?.value.trim()||String(draft.shelfPrice||"");const price=Number(raw.replace(/[$,]/g,""));
    if(!Number.isFinite(price)||price<=0){status.className="sealed-status warn";status.textContent="Enter this product's shelf price before adding it to the Showdown.";byId("sealedShelfPrice")?.focus();return;}
    const state=readShowdown(),barcode=String(draft.barcode||lastBarcodeData?.barcode||"").trim(),key=showdownIdentityKey(identity,barcode);
    const existing=state.items.findIndex(item=>item.key===key);
    if(existing<0&&state.items.length>=SHOWDOWN_MAX){status.className="sealed-status warn";status.textContent=`Shelf Showdown is full at ${SHOWDOWN_MAX} products. Remove one before adding another.`;return;}
    const item={id:existing>=0?state.items[existing].id:`sd-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,key,identity,barcode,lookupTitle:String(draft.barcodeTitle||lastBarcodeData?.lookupTitle||"").trim(),shelfPrice:Number(price.toFixed(2)),store:byId("sealedStore")?.value.trim()||draft.store||""};
    const items=state.items.slice();if(existing>=0)items[existing]=item;else items.push(item);
    const saved=saveShowdown({items,results:[]});renderShowdown(saved);
    status.className="sealed-status ok";status.textContent=`✓ ${existing>=0?"Updated":"Added"} product ${existing>=0?existing+1:items.length} of ${SHOWDOWN_MAX}. ${items.length>=2?"You can rank now or scan another box.":"Scan at least one more box."}`;
    startOver();renderShowdown(saved);
  }
  async function runShelfShowdown(){
    const state=readShowdown(),items=state.items||[],status=byId("sealedShowdownStatus"),btn=byId("sealedShowdownRankBtn");
    if(items.length<2){status.className="sealed-status warn";status.textContent="Add at least two products before ranking the shelf.";return;}
    const cfg=typeof pricingConfig==="function"?pricingConfig():{endpoint:"",accessKey:""};if(!cfg.endpoint||!cfg.accessKey){status.className="sealed-status warn";status.textContent="Scout's live connection is not configured on this device.";return;}
    btn.disabled=true;btn.textContent="🏆 SCOUT IS RANKING THE SHELF…";status.className="sealed-status";
    const endpoint=String(cfg.endpoint).replace(/\/+$/,"");const researched=[];let marketSearches=0,researchSearches=0;
    for(let i=0;i<items.length;i++){
      const item=items[i];status.textContent=`Researching ${i+1} of ${items.length}: ${identityLabel(item.identity)||item.lookupTitle||"sealed product"}…`;
      let market={},analysis={},error="";
      try{
        const marketRes=await fetch(`${endpoint}/sealed/value-check`,{method:"POST",headers:{"Content-Type":"application/json","X-Scout-Key":cfg.accessKey},body:JSON.stringify({identity:item.identity,shelfPrice:item.shelfPrice,lookupTitle:item.lookupTitle||""})});
        const marketData=await marketRes.json().catch(()=>({}));if(!marketRes.ok||!marketData.ok)throw new Error(marketData.message||"Market-price research failed.");
        market={shelfPrice:Number(marketData.shelfPrice||item.shelfPrice),median:Number(marketData.median),verdict:marketData.verdict||"",reason:marketData.reason||"",marketplaceSearchesUsed:Number(marketData.marketplaceSearchesUsed||0),cacheHit:!!marketData.cacheHit};marketSearches+=market.marketplaceSearchesUsed;
        if(Number.isFinite(market.median)&&market.median>0){
          try{
            const ripRes=await fetch(`${endpoint}/sealed/rip-quality`,{method:"POST",headers:{"Content-Type":"application/json","X-Scout-Key":cfg.accessKey},body:JSON.stringify({identity:item.identity,lookupTitle:item.lookupTitle||"",market:{shelfPrice:market.shelfPrice,median:market.median,verdict:market.verdict}})});
            const ripData=await ripRes.json().catch(()=>({}));if(!ripRes.ok||!ripData.ok)throw new Error(ripData.message||"Product research failed.");
            analysis=ripData.analysis||{};researchSearches+=Number(ripData.researchSearchesUsed||0);
          }catch(err){error=err?.message||"Product research failed.";}
        }else error="Scout could not establish a competitive market median for this product.";
      }catch(err){error=err?.message||"Market-price research failed.";}
      const metrics=showdownScore(item,market,analysis);researched.push({item,market,analysis,metrics,error});
    }
    researched.sort((a,b)=>(b.metrics?.total||0)-(a.metrics?.total||0)||(b.metrics?.price||0)-(a.metrics?.price||0));
    const compact=researched.map(row=>({item:row.item,market:row.market,analysis:{priceScore:row.analysis?.priceScore,chaseScore:row.analysis?.chaseScore,chaseEvidenceAvailable:!!row.analysis?.chaseEvidenceAvailable,formatAccessScore:row.analysis?.formatAccessScore,formatAccessEvidenceAvailable:!!row.analysis?.formatAccessEvidenceAvailable,formatAccessSummary:row.analysis?.formatAccessSummary||"",pullScore:row.analysis?.pullScore,pullEvidenceAvailable:!!row.analysis?.pullEvidenceAvailable,sentimentScore:row.analysis?.sentimentScore,sentimentEvidenceAvailable:!!row.analysis?.sentimentEvidenceAvailable,qualitySummary:row.analysis?.qualitySummary||"",researchProfile:row.analysis?.researchProfile||""},metrics:row.metrics,error:row.error}));
    saveShowdown({items,results:compact});renderShowdownResults(compact);
    status.className="sealed-status ok";status.textContent=`✓ Shelf ranked. ${marketSearches} marketplace search${marketSearches===1?"":"es"} + ${researchSearches} product-research search${researchSearches===1?"":"es"} used; cached products may use 0. Missing odds/community evidence did not automatically block the ranking.`;
    btn.disabled=false;btn.textContent="🏆 RANK MY SHELF";byId("sealedShowdownResults")?.scrollIntoView({behavior:"smooth",block:"start"});
  }
  function clearShelfShowdown(){localStorage.removeItem(SHOWDOWN_KEY);renderShowdown({items:[],results:[]});const status=byId("sealedShowdownStatus");if(status){status.className="sealed-status";status.textContent="Showdown cleared. Add at least two products to start another comparison.";}}

'''
front = repl(front, showdown_anchor, showdown_functions + showdown_anchor, 'showdown functions')

# Ensure fill/mount keep Showdown visible and bind buttons.
front = repl(front,
'''    renderRipQuality(draft.ripQuality);
  }
''',
'''    renderRipQuality(draft.ripQuality);
    renderShowdown(readShowdown());
  }
''',
'fill showdown render')
front = repl(front,
'''    byId("sealedResearchPreviewBtn").addEventListener("click",runValueResearch);
    byId("sealedRipResearchBtn").addEventListener("click",runRipQuality);
''',
'''    byId("sealedResearchPreviewBtn").addEventListener("click",runValueResearch);
    byId("sealedShowdownAddBtn").addEventListener("click",addCurrentToShowdown);
    byId("sealedShowdownRankBtn").addEventListener("click",runShelfShowdown);
    byId("sealedShowdownClearBtn").addEventListener("click",clearShelfShowdown);
    byId("sealedRipResearchBtn").addEventListener("click",runRipQuality);
''',
'bind showdown buttons')

# Cache-bust the front-end asset. Accept the known current value, and fail safely otherwise.
index = repl(index, 'sealed-product-scout.js?v=6.3.0', 'sealed-product-scout.js?v=6.4.0', 'sealed script cache bust')

# ---------------------------------------------------------------------------
# Tests / guardrails.
# ---------------------------------------------------------------------------
tests = repl(tests, 'assert.match(worker,/const VERSION = "3\\.41\\.0"/);', 'assert.match(worker,/const VERSION = "3\\.41\\.1"/);', 'test worker version')
tests = repl(tests, "assert.match(worker,/sealed:intel:v9:/,'sealed product intelligence must use a reusable product cache');", "assert.match(worker,/sealed:intel:v10:/,'sealed product intelligence must use a reusable product cache');", 'test cache version')
needle = "assert.match(worker,/function sealedRipVerifiedChaseScore/,'verified Magic structure must protect against contradictory zero set-value scores');\n"
if needle not in tests:
    raise SystemExit('missing Shelf Showdown test anchor')
extra = """assert.match(worker,/function sealedRipFormatAccessContextSupported/,'Shelf Showdown must locally verify exact-format chase access');
assert.ok(worker.includes('formatAccessEvidenceAvailable'),'rip analysis must expose exact-format access evidence');
assert.ok(worker.includes('formatAccessScore'),'rip analysis must expose an exact-format access score');
assert.ok(worker.includes('collector_booster'),'Magic Collector Booster must be a distinct sealed format');
assert.ok(worker.includes('play_booster'),'Magic Play Booster must be a distinct sealed format');
assert.ok(worker.includes('jumpstart_booster'),'Magic Jumpstart Booster must be a distinct sealed format');
"""
tests = tests.replace(needle, needle + extra, 1)

# Front-end source assertions live in the same smoke test file for now.
front_assert_anchor = "const front=fs.readFileSync('sealed-product-scout.js','utf8');\n"
if front_assert_anchor not in tests:
    # Older test file may name it differently; append safe direct reads/assertions.
    tests += "\nconst showdownFront=fs.readFileSync('sealed-product-scout.js','utf8');\n"
    front_var = 'showdownFront'
else:
    front_var = 'front'
front_asserts = f"""
assert.ok({front_var}.includes('scoutSealedShelfShowdownV1'),'front end must persist a Shelf Showdown queue');
assert.ok({front_var}.includes('ADD TO SHELF SHOWDOWN'),'front end must offer zero-search add-to-showdown flow');
assert.ok({front_var}.includes('RANK MY SHELF'),'front end must expose Shelf Showdown ranking');
assert.ok({front_var}.includes('function runShelfShowdown'),'front end must orchestrate multi-product research');
assert.ok({front_var}.includes('FORMAT ACCESS'),'ranking must show exact-format access separately');
assert.ok({front_var}.includes('SHOWDOWN_MAX=5'),'Shelf Showdown must cap the first version at five products');
"""
tests += front_asserts

worker_path.write_text(worker, encoding='utf-8')
front_path.write_text(front, encoding='utf-8')
index_path.write_text(index, encoding='utf-8')
test_path.write_text(tests, encoding='utf-8')
