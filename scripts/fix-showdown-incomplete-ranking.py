from pathlib import Path
import re

app_path = Path('sealed-product-scout.js')
index_path = Path('index.html')
test_path = Path('tests/sealed-product-vision.test.cjs')

app = app_path.read_text(encoding='utf-8')
index = index_path.read_text(encoding='utf-8')
tests = test_path.read_text(encoding='utf-8')

# 1) Remove midrange fallback scoring. A product is rankable only when every
# required Showdown lane has usable evidence. Supporting pull/community evidence
# remains optional and is excluded from the denominator when missing.
pattern = re.compile(r'''  function showdownMetric\(v,fallback\)\{.*?\n  function showdownReason\(row\)\{''', re.S)
replacement = '''  function showdownMetric(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):null;}
  function showdownScore(item,market,analysis,error=""){
    const marketMedian=Number(market?.median);
    const price=Number.isFinite(marketMedian)&&marketMedian>0
      ? (showdownMetric(analysis?.priceScore)??showdownPriceScore(item.shelfPrice,marketMedian))
      : null;
    const depth=analysis?.chaseDepthEvidenceAvailable?showdownMetric(analysis?.chaseDepthScore):null;
    const format=analysis?.formatAccessEvidenceAvailable?showdownMetric(analysis?.formatAccessScore):null;
    const set=analysis?.chaseEvidenceAvailable?showdownMetric(analysis?.chaseScore):null;
    const supportValues=[];
    if(analysis?.pullEvidenceAvailable){const value=showdownMetric(analysis?.pullScore);if(value!==null)supportValues.push(value);}
    if(analysis?.sentimentEvidenceAvailable){const value=showdownMetric(analysis?.sentimentScore);if(value!==null)supportValues.push(value);}
    const support=supportValues.length?Math.round(supportValues.reduce((a,b)=>a+b,0)/supportValues.length):null;
    const missing=[];
    if(error)missing.push("Product research");
    if(price===null)missing.push("Market price");
    if(!analysis?.chaseDepthEvidenceAvailable||depth===null)missing.push("Chase Depth");
    if(!analysis?.formatAccessEvidenceAvailable||format===null)missing.push("Exact-format access");
    if(!analysis?.chaseEvidenceAvailable||set===null)missing.push("Set/chase evidence");
    const rankable=missing.length===0;
    let total=null;
    if(rankable){
      let weighted=depth*.35+format*.25+price*.20+set*.15;
      let weight=.95;
      if(support!==null){weighted+=support*.05;weight+=.05;}
      total=Math.max(0,Math.min(100,Math.round(weighted/weight)));
    }
    const confidence=rankable?(support!==null?"HIGH":"MEDIUM"):"INCOMPLETE";
    return {rankable,total,price,depth,format,set,support,confidence,missing};
  }
  function showdownIncompleteReason(row){
    const missing=Array.isArray(row?.metrics?.missing)?row.metrics.missing:[];
    const unique=[...new Set(missing.filter(Boolean))];
    if(row?.error&&!unique.includes("Product research"))unique.unshift("Product research");
    return unique.length
      ? `Scout could not verify ${unique.join(" · ")}. This product is excluded from the ranking.`
      : "Scout does not have enough complete evidence to rank this product safely.";
  }
  function showdownReason(row){'''
app, count = pattern.subn(replacement, app, count=1)
if count != 1:
    raise SystemExit(f'Could not replace showdown scoring block (matches={count})')

# 2) Render incomplete products without medals, composite scores, or winner badge.
pattern = re.compile(r'''  function renderShowdownResults\(results\)\{.*?\n  function renderShowdown\(state=readShowdown\(\)\)\{''', re.S)
replacement = '''  function renderShowdownResults(results){
    const box=byId("sealedShowdownResults");if(!box)return;
    const rows=Array.isArray(results)?results:[];
    if(!rows.length){box.hidden=true;box.innerHTML="";return;}
    box.hidden=false;
    const rankableCount=rows.filter(row=>row?.metrics?.rankable===true).length;
    let rankablePlace=0;
    box.innerHTML=rows.map(row=>{
      const rankable=row?.metrics?.rankable===true;
      const place=rankable?++rankablePlace:null;
      const label=identityLabel(row.item?.identity||{})||row.item?.lookupTitle||"Sealed product",m=row.metrics||{},a=row.analysis||{};
      const trophy=rankable?(place===1?"🥇":place===2?"🥈":place===3?"🥉":`#${place}`):"⚠";
      const isWinner=rankable&&place===1&&rankableCount>=2;
      const formatCopy=a?.formatAccessEvidenceAvailable?(a.formatAccessSummary||"Exact-format access verified."):"Exact-format access not verified.";
      const depthCopy=a?.chaseDepthEvidenceAvailable?(a.chaseDepthSummary||"Set-level Chase Depth verified from aggregated singles pricing."):"Scout did not verify enough set-level singles prices to score Chase Depth.";
      const issue=row.error?`<div class="sealed-showdown-copy">⚠ ${esc(row.error)}</div>`:"";
      const meta=rankable?`${esc(m.confidence||"MEDIUM")} ranking confidence`:"INCOMPLETE · NOT RANKED";
      const badge=isWinner?'<span class="sealed-showdown-best">BEST SHELF BUY</span>':(rankable&&rankableCount<2?'<span class="sealed-showdown-best">RANKABLE · NEED ANOTHER COMPLETE PRODUCT</span>':"");
      const reason=rankable?`<strong>Why it ranks here:</strong> ${esc(showdownReason(row))}`:`<strong>Why it is not ranked:</strong> ${esc(showdownIncompleteReason(row))}`;
      return `<div class="sealed-showdown-rank ${isWinner?"top":""} ${rankable?"":"incomplete"}"><div class="sealed-showdown-rank-head"><div class="sealed-showdown-place">${trophy}</div><div><div class="sealed-showdown-rank-name">${esc(label)}</div><div class="sealed-showdown-meta">Shelf ${money(row.item?.shelfPrice)||"—"} · ${esc(String(row.item?.identity?.category||""))} · ${meta}</div>${badge}</div><div class="sealed-showdown-score">${rankable?Math.round(Number(m.total)||0):"—"}</div></div><div class="sealed-showdown-metrics"><div class="sealed-showdown-metric"><div class="sealed-showdown-metric-label">CHASE DEPTH</div><div class="sealed-showdown-metric-value">${a?.chaseDepthEvidenceAvailable&&m.depth!==null?m.depth:"N/A"}</div></div><div class="sealed-showdown-metric"><div class="sealed-showdown-metric-label">FORMAT ACCESS</div><div class="sealed-showdown-metric-value">${a?.formatAccessEvidenceAvailable&&m.format!==null?m.format:"N/A"}</div></div><div class="sealed-showdown-metric"><div class="sealed-showdown-metric-label">PRICE</div><div class="sealed-showdown-metric-value">${m.price!==null&&m.price!==undefined?m.price:"N/A"}</div></div><div class="sealed-showdown-metric"><div class="sealed-showdown-metric-label">SET</div><div class="sealed-showdown-metric-value">${a?.chaseEvidenceAvailable&&m.set!==null?m.set:"N/A"}</div></div><div class="sealed-showdown-metric"><div class="sealed-showdown-metric-label">SUPPORT</div><div class="sealed-showdown-metric-value">${m.support!==null&&m.support!==undefined?m.support:"N/A"}</div></div></div><div class="sealed-showdown-copy">${reason}</div><div class="sealed-showdown-copy"><strong>Chase Depth:</strong> ${esc(depthCopy)}</div><div class="sealed-showdown-copy"><strong>Format:</strong> ${esc(formatCopy)}</div>${issue}</div>`;
    }).join("");
  }
  function renderShowdown(state=readShowdown()){'''
app, count = pattern.subn(replacement, app, count=1)
if count != 1:
    raise SystemExit(f'Could not replace Showdown renderer (matches={count})')

# 3) Score with the error state, sort rankable products first, and do not declare
# a winner unless at least two products have complete required evidence.
old = '''      const metrics=showdownScore(item,market,analysis);researched.push({item,market,analysis,metrics,error});
    }
    researched.sort((a,b)=>(b.metrics?.total||0)-(a.metrics?.total||0)||(b.metrics?.price||0)-(a.metrics?.price||0));
    const compact=researched.map(row=>({item:row.item,market:row.market,analysis:{priceScore:row.analysis?.priceScore,chaseDepthScore:row.analysis?.chaseDepthScore,chaseDepthEvidenceAvailable:!!row.analysis?.chaseDepthEvidenceAvailable,chaseDepthLabel:row.analysis?.chaseDepthLabel||"",chaseDepthSummary:row.analysis?.chaseDepthSummary||"",chaseDepthCount20:Number(row.analysis?.chaseDepthCount20||0),chaseDepthCount50:Number(row.analysis?.chaseDepthCount50||0),chaseDepthCount100:Number(row.analysis?.chaseDepthCount100||0),chaseScore:row.analysis?.chaseScore,chaseEvidenceAvailable:!!row.analysis?.chaseEvidenceAvailable,formatAccessScore:row.analysis?.formatAccessScore,formatAccessEvidenceAvailable:!!row.analysis?.formatAccessEvidenceAvailable,formatAccessSummary:row.analysis?.formatAccessSummary||"",pullScore:row.analysis?.pullScore,pullEvidenceAvailable:!!row.analysis?.pullEvidenceAvailable,sentimentScore:row.analysis?.sentimentScore,sentimentEvidenceAvailable:!!row.analysis?.sentimentEvidenceAvailable,qualitySummary:row.analysis?.qualitySummary||"",researchProfile:row.analysis?.researchProfile||""},metrics:row.metrics,error:row.error}));
    saveShowdown({items,results:compact});renderShowdownResults(compact);
    status.className="sealed-status ok";status.textContent=`✓ Shelf ranked. ${marketSearches} marketplace search${marketSearches===1?"":"es"} + ${researchSearches} product-research search${researchSearches===1?"":"es"} used; cached products may use 0. Chase Depth uses aggregated set pricing; no card-by-card eBay searches are used. Missing odds/community evidence did not automatically block the ranking.`;
'''
new = '''      const metrics=showdownScore(item,market,analysis,error);researched.push({item,market,analysis,metrics,error,order:i});
    }
    researched.sort((a,b)=>{
      const rankDiff=Number(b.metrics?.rankable===true)-Number(a.metrics?.rankable===true);if(rankDiff)return rankDiff;
      if(a.metrics?.rankable&&b.metrics?.rankable){const totalDiff=(Number(b.metrics?.total)||0)-(Number(a.metrics?.total)||0);if(totalDiff)return totalDiff;}
      return Number(a.order||0)-Number(b.order||0);
    });
    const compact=researched.map(row=>({status:row.metrics?.rankable?"ranked":"incomplete",item:row.item,market:row.market,analysis:{priceScore:row.analysis?.priceScore,chaseDepthScore:row.analysis?.chaseDepthScore,chaseDepthEvidenceAvailable:!!row.analysis?.chaseDepthEvidenceAvailable,chaseDepthLabel:row.analysis?.chaseDepthLabel||"",chaseDepthSummary:row.analysis?.chaseDepthSummary||"",chaseDepthCount20:Number(row.analysis?.chaseDepthCount20||0),chaseDepthCount50:Number(row.analysis?.chaseDepthCount50||0),chaseDepthCount100:Number(row.analysis?.chaseDepthCount100||0),chaseScore:row.analysis?.chaseScore,chaseEvidenceAvailable:!!row.analysis?.chaseEvidenceAvailable,formatAccessScore:row.analysis?.formatAccessScore,formatAccessEvidenceAvailable:!!row.analysis?.formatAccessEvidenceAvailable,formatAccessSummary:row.analysis?.formatAccessSummary||"",pullScore:row.analysis?.pullScore,pullEvidenceAvailable:!!row.analysis?.pullEvidenceAvailable,sentimentScore:row.analysis?.sentimentScore,sentimentEvidenceAvailable:!!row.analysis?.sentimentEvidenceAvailable,qualitySummary:row.analysis?.qualitySummary||"",researchProfile:row.analysis?.researchProfile||""},metrics:row.metrics,error:row.error}));
    saveShowdown({items,results:compact});renderShowdownResults(compact);
    const rankableCount=compact.filter(row=>row.metrics?.rankable===true).length;
    status.className=rankableCount>=2?"sealed-status ok":"sealed-status warn";
    status.textContent=rankableCount>=2
      ? `✓ Shelf ranked. ${rankableCount} of ${items.length} products had complete required evidence. ${marketSearches} marketplace search${marketSearches===1?"":"es"} + ${researchSearches} product-research search${researchSearches===1?"":"es"} used; cached products may use 0. No card-by-card eBay searches are used.`
      : `Research finished, but only ${rankableCount} of ${items.length} products had complete required evidence. Scout did not name a Best Shelf Buy. ${marketSearches} marketplace search${marketSearches===1?"":"es"} + ${researchSearches} product-research search${researchSearches===1?"":"es"} used; cached products may use 0.`;
'''
if old not in app:
    raise SystemExit('Could not find Showdown run/sort block')
app = app.replace(old, new, 1)

# 4) Give incomplete cards a visibly different treatment.
old_css = '.sealed-showdown-rank{border:1px solid var(--line);border-radius:16px;padding:12px;background:rgba(0,0,0,.10)}.sealed-showdown-rank.top{border-color:rgba(230,189,99,.58);background:linear-gradient(145deg,rgba(230,189,99,.16),rgba(86,197,138,.06))}'
new_css = '.sealed-showdown-rank{border:1px solid var(--line);border-radius:16px;padding:12px;background:rgba(0,0,0,.10)}.sealed-showdown-rank.top{border-color:rgba(230,189,99,.58);background:linear-gradient(145deg,rgba(230,189,99,.16),rgba(86,197,138,.06))}.sealed-showdown-rank.incomplete{border-style:dashed;opacity:.88}'
if old_css not in app:
    raise SystemExit('Could not find Showdown result CSS')
app = app.replace(old_css, new_css, 1)

# 5) Cache-bust the frontend so phones receive this safety fix immediately.
index, count = re.subn(r'sealed-product-scout\.js\?v=6\.5\.0', 'sealed-product-scout.js?v=6.5.1', index, count=1)
if count != 1:
    raise SystemExit(f'Could not bump sealed frontend cache version (matches={count})')

# 6) Update targeted regression expectations.
old_test = "assert.match(index,/sealed-product-scout\\.js\\?v=6\\.5\\.0/,'sealed scanner cache-bust must advance for Chase Depth UI');"
new_test = "assert.match(index,/sealed-product-scout\\.js\\?v=6\\.5\\.1/,'sealed scanner cache-bust must advance for incomplete-ranking safety');"
if old_test not in tests:
    raise SystemExit('Could not find frontend cache-bust regression assertion')
tests = tests.replace(old_test, new_test, 1)

old_weight = "assert.ok(app.includes('depth*.35+format*.25+price*.20+set*.15+support*.05'),'Showdown weights must prioritize Chase Depth without over-weighting support');"
new_weight = '''assert.ok(app.includes('let weighted=depth*.35+format*.25+price*.20+set*.15'),'Showdown weights must prioritize Chase Depth without inventing missing support');
assert.ok(app.includes('const rankable=missing.length===0'),'Showdown must explicitly mark incomplete products unrankable');
assert.ok(app.includes('INCOMPLETE · NOT RANKED'),'Showdown must visibly label incomplete products');
assert.ok(app.includes('rankable&&place===1&&rankableCount>=2'),'Best Shelf Buy must require at least two rankable products');
assert.ok(app.includes('status:row.metrics?.rankable?"ranked":"incomplete"'),'stored Showdown results must preserve ranked vs incomplete status');
assert.ok(app.includes('showdownScore(item,market,analysis,error)'),'research failures must flow into rankability instead of receiving fallback scores');
assert.doesNotMatch(app,/const depth=analysis\?\.chaseDepthEvidenceAvailable\?showdownMetric\(analysis\?\.chaseDepthScore,30\):30/,'missing Chase Depth must not receive a synthetic score');
assert.doesNotMatch(app,/const format=analysis\?\.formatAccessEvidenceAvailable\?showdownMetric\(analysis\?\.formatAccessScore,35\):35/,'missing Format Access must not receive a synthetic score');'''
if old_weight not in tests:
    raise SystemExit('Could not find Showdown weight regression assertion')
tests = tests.replace(old_weight, new_weight, 1)

app_path.write_text(app, encoding='utf-8')
index_path.write_text(index, encoding='utf-8')
test_path.write_text(tests, encoding='utf-8')
print('Showdown incomplete-ranking safety migration applied.')
