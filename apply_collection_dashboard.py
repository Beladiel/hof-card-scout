from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')

css=r'''
/* v5.3.0 — Collection Dashboard / Insights */
.dashboard-wrap{background:rgba(255,255,255,.045);border:1px solid var(--line);border-radius:18px;padding:14px}
.dashboard-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:13px}
.dashboard-title{font-size:27px;font-weight:950;letter-spacing:-.5px;margin:2px 0 0}
.dashboard-sub{font-size:12px;color:var(--muted);line-height:1.5;margin-top:4px;max-width:620px}
.dashboard-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}
.dashboard-kpi{border:1px solid var(--line);border-radius:14px;padding:11px;background:rgba(255,255,255,.027);min-height:77px}
.dashboard-kpi .k{font-size:8px;font-weight:950;letter-spacing:.09em;color:var(--muted)}
.dashboard-kpi .v{font-size:25px;font-weight:950;line-height:1;margin-top:6px}
.dashboard-kpi.gold{border-color:rgba(230,189,99,.34);background:rgba(230,189,99,.055)}
.dashboard-progress-card,.dashboard-section{border:1px solid var(--line);border-radius:15px;background:rgba(0,0,0,.10);padding:13px;margin-top:11px}
.dashboard-section-title{font-size:10px;color:var(--gold);font-weight:950;letter-spacing:.11em}
.dashboard-progress-copy{display:flex;justify-content:space-between;gap:12px;align-items:end;margin-top:5px}
.dashboard-progress-big{font-size:22px;font-weight:950}
.dashboard-progress-small{font-size:10px;color:var(--muted);text-align:right;line-height:1.4}
.dashboard-bar{height:12px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden;margin-top:10px;border:1px solid rgba(255,255,255,.05)}
.dashboard-bar span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--green2),var(--gold));width:0}
.dashboard-money-grid,.dashboard-mix-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}
.dashboard-money-grid{grid-template-columns:repeat(3,1fr)}
.dashboard-mini{border:1px solid var(--line);border-radius:12px;padding:10px;background:rgba(255,255,255,.025)}
.dashboard-mini .k{font-size:8px;color:var(--muted);font-weight:950;letter-spacing:.07em}
.dashboard-mini .v{font-size:18px;font-weight:950;margin-top:4px;overflow-wrap:anywhere}
.dashboard-mini .s{font-size:9px;color:var(--muted);line-height:1.35;margin-top:3px}
.dashboard-insights{display:grid;gap:8px;margin-top:10px}
.dashboard-insight{display:grid;grid-template-columns:34px 1fr;gap:9px;align-items:start;border:1px solid var(--line);border-radius:12px;padding:10px;background:rgba(255,255,255,.025)}
.dashboard-insight-icon{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:rgba(230,189,99,.09);font-size:17px}
.dashboard-insight strong{display:block;font-size:12px;line-height:1.35}
.dashboard-insight span{display:block;font-size:10px;color:var(--muted);line-height:1.45;margin-top:2px}
.dashboard-recent-list{display:grid;gap:8px;margin-top:10px}
.dashboard-recent{width:100%;text-align:left;border:1px solid var(--line);border-radius:12px;padding:10px;background:rgba(255,255,255,.025);color:var(--text)}
.dashboard-recent:hover{background:rgba(255,255,255,.05)}
.dashboard-recent-top{display:flex;justify-content:space-between;gap:10px;align-items:start}
.dashboard-recent-name{font-size:13px;font-weight:950}
.dashboard-recent-date{font-size:9px;color:var(--muted);white-space:nowrap}
.dashboard-recent-card{font-size:10px;color:var(--muted);line-height:1.4;margin-top:3px}
.dashboard-recent-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}
.dashboard-tag{font-size:8px;font-weight:900;border:1px solid var(--line);border-radius:999px;padding:4px 6px;color:var(--muted)}
.dashboard-tag.money{color:#f4d58a;border-color:rgba(230,189,99,.3)}
.dashboard-tag.incoming{color:#9cc7f0;border-color:rgba(117,174,233,.3)}
.dashboard-empty{font-size:11px;color:var(--muted);line-height:1.5;padding:9px 0 2px}
.dashboard-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}
@media(max-width:650px){
  .dashboard-kpis{grid-template-columns:repeat(2,1fr)}
  .dashboard-money-grid{grid-template-columns:1fr}
  .dashboard-mix-grid{grid-template-columns:repeat(2,1fr)}
  .dashboard-progress-copy{display:block}.dashboard-progress-small{text-align:left;margin-top:5px}
}
'''.strip()
css_marker='/* Phase 5 — Hunt List / Shopping Mode */'
if '/* v5.3.0 — Collection Dashboard / Insights */' not in s:
    if css_marker not in s: raise SystemExit('Dashboard CSS marker not found')
    s=s.replace(css_marker,css+'\n\n'+css_marker,1)

old_buttons='''        <button class="ghost" id="targetsBtn">🎯 TARGET CARDS (<span id="targetCount">2</span>)</button>\n        <button class="ghost" id="dataMenuBtn">↕️ DATA / BACKUP</button>'''
new_buttons='''        <button class="ghost" id="targetsBtn">🎯 TARGET CARDS (<span id="targetCount">2</span>)</button>\n        <button class="ghost" id="dashboardBtn">📊 MY COLLECTION</button>\n        <button class="ghost" id="dataMenuBtn">↕️ DATA / BACKUP</button>'''
if 'id="dashboardBtn"' not in s:
    if old_buttons not in s: raise SystemExit('Dashboard home button anchor not found')
    s=s.replace(old_buttons,new_buttons,1)

screen=r'''
    <section class="screen" id="dashboardScreen">
      <button class="back" id="dashboardBack">← Back home</button>
      <div class="dashboard-wrap">
        <div class="dashboard-hero">
          <div>
            <div class="section-eyebrow">📊 COLLECTION DASHBOARD</div>
            <div class="dashboard-title">How’s the Hall coming along?</div>
            <div class="dashboard-sub">One-screen view of your Hall progress, active shopping work, tracked spending, collection mix, and the latest purchases Scout knows about.</div>
          </div>
        </div>

        <div class="dashboard-kpis">
          <div class="dashboard-kpi gold"><div class="k">HALL REPRESENTED</div><div class="v" id="dashboardOwned">0</div></div>
          <div class="dashboard-kpi"><div class="k">STILL NEED</div><div class="v" id="dashboardNeed">0</div></div>
          <div class="dashboard-kpi"><div class="k">ACTIVE TARGETS</div><div class="v" id="dashboardTargets">0</div></div>
          <div class="dashboard-kpi"><div class="k">ON THE WAY</div><div class="v" id="dashboardIncoming">0</div></div>
        </div>

        <div class="dashboard-progress-card">
          <div class="dashboard-section-title">HALL COMPLETION</div>
          <div class="dashboard-progress-copy">
            <div class="dashboard-progress-big" id="dashboardPct">0%</div>
            <div class="dashboard-progress-small" id="dashboardProgressCopy"></div>
          </div>
          <div class="dashboard-bar"><span id="dashboardProgressFill"></span></div>
        </div>

        <div class="dashboard-section">
          <div class="dashboard-section-title">💵 TRACKED SPENDING</div>
          <div class="dashboard-sub">Only purchases where you recorded an actual paid price are included. Older collection cards without a saved price are not guessed.</div>
          <div class="dashboard-money-grid">
            <div class="dashboard-mini"><div class="k">TOTAL LOGGED</div><div class="v" id="dashboardSpent">—</div><div class="s">Recorded purchase totals</div></div>
            <div class="dashboard-mini"><div class="k">PURCHASES LOGGED</div><div class="v" id="dashboardPaidCount">0</div><div class="s">Cards with a paid price</div></div>
            <div class="dashboard-mini"><div class="k">AVERAGE LOGGED</div><div class="v" id="dashboardAvgPaid">—</div><div class="s">Average of recorded purchases</div></div>
          </div>
        </div>

        <div class="dashboard-section">
          <div class="dashboard-section-title">⚾ COLLECTION MIX</div>
          <div class="dashboard-mix-grid">
            <div class="dashboard-mini"><div class="k">VINTAGE REPS</div><div class="v" id="dashboardVintage">0</div><div class="s">Representative cards from 1979 or earlier</div></div>
            <div class="dashboard-mini"><div class="k">GRADED</div><div class="v" id="dashboardGraded">0</div><div class="s">Known graded representatives</div></div>
            <div class="dashboard-mini"><div class="k">AUTOGRAPHS</div><div class="v" id="dashboardAutos">0</div><div class="s">Known signed representatives</div></div>
            <div class="dashboard-mini"><div class="k">PRICE HISTORY</div><div class="v" id="dashboardPriceCoverage">0%</div><div class="s">Owned cards with paid price recorded</div></div>
          </div>
        </div>

        <div class="dashboard-section">
          <div class="dashboard-section-title">🧭 SCOUT READ</div>
          <div class="dashboard-insights" id="dashboardInsights"></div>
        </div>

        <div class="dashboard-section">
          <div class="dashboard-section-title">🧾 RECENT PURCHASES</div>
          <div class="dashboard-sub">Newest saved purchase dates first. Tap a row to open that Hall of Famer.</div>
          <div class="dashboard-recent-list" id="dashboardRecent"></div>
        </div>

        <div class="dashboard-actions">
          <button type="button" class="secondary" id="dashboardHuntBtn">🛒 OPEN HUNT LIST</button>
          <button type="button" class="ghost" id="dashboardTargetsBtn">🎯 VIEW TARGETS</button>
        </div>
      </div>
    </section>

'''
screen_marker='    <section class="screen" id="forecastScreen">'
if 'id="dashboardScreen"' not in s:
    if screen_marker not in s: raise SystemExit('Dashboard screen marker not found')
    s=s.replace(screen_marker,screen+screen_marker,1)

js=r'''
function dashboardTargetCount(){
  const official=PLAYERS.filter(p=>!!p.target&&!p.incoming).length;
  const future=typeof futureHofActiveTargetEntries==="function"?futureHofActiveTargetEntries().length:0;
  return official+future;
}
function dashboardPaidPlayers(){
  return PLAYERS.filter(p=>p.owned&&p.pricePaid!==null&&p.pricePaid!==undefined&&p.pricePaid!==""&&Number.isFinite(Number(p.pricePaid))&&Number(p.pricePaid)>=0);
}
function dashboardIsGraded(p){
  const grader=String(p?.grader||"").trim();
  if(grader&&grader!=="Raw")return true;
  return /\b(?:PSA|SGC|BGS|CGC|CSG|HGA|TAG|ISA)\b/i.test(String(p?.description||""));
}
function dashboardIsAuto(p){
  return !!p?.autograph||/\b(?:autograph|auto|signed)\b/i.test(String(p?.description||""));
}
function dashboardRecentPlayers(){
  return PLAYERS.filter(p=>p.owned&&/^\d{4}-\d{2}-\d{2}$/.test(String(p.purchaseDate||"")))
    .sort((a,b)=>String(b.purchaseDate).localeCompare(String(a.purchaseDate))||String(a.name).localeCompare(String(b.name)))
    .slice(0,6);
}
function dashboardInsight(icon,title,text){
  return '<div class="dashboard-insight"><div class="dashboard-insight-icon">'+icon+'</div><div><strong>'+escapeHtml(title)+'</strong><span>'+escapeHtml(text)+'</span></div></div>';
}
function renderDashboard(){
  if(!$("dashboardScreen"))return;
  const owned=ownedCount(),need=needCount(),pct=completion(),targets=dashboardTargetCount();
  const incoming=PLAYERS.filter(p=>p.incoming).length;
  const paid=dashboardPaidPlayers();
  const spent=paid.reduce((sum,p)=>sum+Number(p.pricePaid),0);
  const avg=paid.length?spent/paid.length:null;
  const vintage=PLAYERS.filter(p=>p.owned&&Number.isFinite(Number(p.cardYear))&&Number(p.cardYear)<=1979).length;
  const graded=PLAYERS.filter(p=>p.owned&&dashboardIsGraded(p)).length;
  const autos=PLAYERS.filter(p=>p.owned&&dashboardIsAuto(p)).length;
  const coverage=owned?Math.round(paid.length/owned*100):0;

  $("dashboardOwned").textContent=owned;
  $("dashboardNeed").textContent=need;
  $("dashboardTargets").textContent=targets;
  $("dashboardIncoming").textContent=incoming;
  $("dashboardPct").textContent=pct.toFixed(1)+"%";
  $("dashboardProgressFill").style.width=Math.max(0,Math.min(100,pct)).toFixed(1)+"%";
  $("dashboardProgressCopy").textContent=owned+" of "+TOTAL+" Hall of Famers represented · "+need+" still open";
  $("dashboardSpent").textContent=paid.length?formatMoney(spent):"—";
  $("dashboardPaidCount").textContent=paid.length;
  $("dashboardAvgPaid").textContent=avg!==null?formatMoney(avg):"—";
  $("dashboardVintage").textContent=vintage;
  $("dashboardGraded").textContent=graded;
  $("dashboardAutos").textContent=autos;
  $("dashboardPriceCoverage").textContent=coverage+"%";

  const milestones=[50,60,75,90,100];
  const nextMilestone=milestones.find(m=>pct<m-0.05)||100;
  const milestoneOwned=Math.min(TOTAL,Math.ceil(TOTAL*nextMilestone/100));
  const toMilestone=Math.max(0,milestoneOwned-owned);
  const openNoTarget=PLAYERS.filter(p=>!p.owned&&!p.incoming&&!p.target).length;
  const futureTargets=typeof futureHofActiveTargetEntries==="function"?futureHofActiveTargetEntries().length:0;
  const insights=[];
  if(pct<100)insights.push(dashboardInsight("🏛️",nextMilestone+"% is the next milestone",toMilestone+" more represented Hall of Famer"+(toMilestone===1?"":"s")+" gets you there."));
  else insights.push(dashboardInsight("🏆","The Hall is complete","Every Hall of Famer in Scout has a representative card."));
  if(openNoTarget>0)insights.push(dashboardInsight("🎯",openNoTarget+" open spots have no saved target","Those are the best places to use Find a Target when you want Scout to narrow the shopping list."));
  else insights.push(dashboardInsight("🎯","Every open Hall spot has a plan","There are no target-less Hall needs right now."));
  if(targets>0)insights.push(dashboardInsight("🛒",targets+" active target"+(targets===1?"":"s")+" on the board",futureTargets?futureTargets+" of those are Future HOF targets and stay outside Hall completion.":"They are ready in Hunt List 2.0."));
  if(incoming>0)insights.push(dashboardInsight("📦",incoming+" card"+(incoming===1?" is":"s are")+" on the way","They are already treated as represented, but remain flagged Incoming until you mark them received."));
  if(paid.length)insights.push(dashboardInsight("💵","Tracked spending is "+formatMoney(spent),"That covers "+paid.length+" recorded purchase"+(paid.length===1?"":"s")+" at an average of "+formatMoney(avg)+". Scout is not estimating missing prices."));
  else insights.push(dashboardInsight("💵","No purchase prices are logged yet","Future purchases you save with an actual order total will automatically start building this spending history."));
  $("dashboardInsights").innerHTML=insights.slice(0,5).join("");

  const recent=dashboardRecentPlayers();
  if(!recent.length){
    $("dashboardRecent").innerHTML='<div class="dashboard-empty">No dated purchases are recorded yet. New purchases saved through Scout will appear here automatically.</div>';
  }else{
    $("dashboardRecent").innerHTML=recent.map(p=>{
      const paidKnown=p.pricePaid!==null&&p.pricePaid!==undefined&&p.pricePaid!==""&&Number.isFinite(Number(p.pricePaid));
      const source=String(p.purchaseSource||"").trim();
      const tags=[];
      if(paidKnown)tags.push('<span class="dashboard-tag money">'+escapeHtml(formatMoney(Number(p.pricePaid)))+'</span>');
      if(source)tags.push('<span class="dashboard-tag">'+escapeHtml(source)+'</span>');
      if(p.incoming)tags.push('<span class="dashboard-tag incoming">📦 INCOMING</span>');
      return '<button type="button" class="dashboard-recent" data-dashboard-player="'+encodeURIComponent(p.name)+'"><div class="dashboard-recent-top"><div class="dashboard-recent-name">'+escapeHtml(p.name)+'</div><div class="dashboard-recent-date">'+escapeHtml(formatPurchaseDate(p.purchaseDate))+'</div></div><div class="dashboard-recent-card">'+escapeHtml(cardLabel(p))+'</div><div class="dashboard-recent-meta">'+tags.join("")+'</div></button>';
    }).join("");
    document.querySelectorAll("[data-dashboard-player]").forEach(btn=>btn.addEventListener("click",()=>{
      const name=decodeURIComponent(btn.dataset.dashboardPlayer||"");
      const player=PLAYERS.find(p=>p.name===name);
      if(player){currentPlayer=player;openPlayer(player,"dashboardScreen");}
    }));
  }
}
function openDashboard(){
  renderDashboard();
  showScreen("dashboardScreen");
  window.scrollTo({top:0,behavior:"smooth"});
}
'''.strip()+"\n"
js_marker='function showTargets(){'
if 'function renderDashboard(){' not in s:
    if js_marker not in s: raise SystemExit('Dashboard JS marker not found')
    s=s.replace(js_marker,js+'\n'+js_marker,1)

event_anchor='$("targetsBtn").addEventListener("click",showTargets);'
event_new='''$("targetsBtn").addEventListener("click",showTargets);\n$("dashboardBtn").addEventListener("click",openDashboard);\n$("dashboardBack").addEventListener("click",()=>showScreen("homeScreen"));\n$("dashboardHuntBtn").addEventListener("click",()=>openHuntList("all"));\n$("dashboardTargetsBtn").addEventListener("click",()=>{showScreen("homeScreen");showTargets();});'''
if '$("dashboardBtn").addEventListener("click",openDashboard);' not in s:
    if event_anchor not in s: raise SystemExit('Dashboard event anchor not found')
    s=s.replace(event_anchor,event_new,1)

s=s.replace('· v5.2.1</div>','· v5.3.0</div>',1)

p.write_text(s,encoding='utf-8')

t=Path('tests/collection-dashboard.test.cjs')
t.write_text(r'''const assert=require("node:assert/strict");
const fs=require("node:fs");
const html=fs.readFileSync("index.html","utf8");

assert.match(html,/v5\.3\.0/);
assert.match(html,/id="dashboardBtn">📊 MY COLLECTION/);
assert.match(html,/id="dashboardScreen"/);
assert.match(html,/id="dashboardOwned"/);
assert.match(html,/id="dashboardSpent"/);
assert.match(html,/id="dashboardInsights"/);
assert.match(html,/id="dashboardRecent"/);
assert.match(html,/function dashboardTargetCount\(\)/);
assert.match(html,/function dashboardPaidPlayers\(\)/);
assert.match(html,/function renderDashboard\(\)/);
assert.match(html,/function openDashboard\(\)/);
assert.match(html,/dashboardBtn"\)\.addEventListener\("click",openDashboard\)/);
assert.match(html,/dashboardHuntBtn"\)\.addEventListener\("click",\(\)=>openHuntList\("all"\)\)/);
assert.match(html,/dashboardTargetsBtn"\)\.addEventListener/);
assert.match(html,/Only purchases where you recorded an actual paid price are included/);
assert.match(html,/Future HOF targets and stay outside Hall completion/);
assert.doesNotMatch(html,/id="exportBtn"/);
assert.doesNotMatch(html,/id="importBtn"/);
console.log("Collection Dashboard tests passed.");
''',encoding='utf-8')
print('Collection Dashboard / Insights patched')
