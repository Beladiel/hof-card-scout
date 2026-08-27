from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')

# Release version: footer + manual backup payload version.
if '5.6.0' not in s:
    raise SystemExit('v5.6.0 anchors not found')
s=s.replace('5.6.0','5.7.0')

# Load the local, dependency-free XLSX writer before the app script.
old_script='''<script>\nconst PLAYERS ='''
new_script='''<script src="shopping-report.js"></script>\n<script>\nconst PLAYERS ='''
if old_script not in s:
    raise SystemExit('inline script anchor not found')
s=s.replace(old_script,new_script,1)

# Expand Data / Backup with the offline Excel report.
old_modal='''<div class="data-modal-backdrop" id="dataMenuModal" hidden>
  <div class="data-modal" role="dialog" aria-modal="true" aria-labelledby="dataMenuTitle">
    <div class="data-modal-head">
      <div class="data-modal-icon">↕️</div>
      <div>
        <div class="section-eyebrow">DATA TOOLS</div>
        <div class="data-modal-title" id="dataMenuTitle">Export or import?</div>
        <div class="data-modal-sub">Move your HOF Card Scout updates between this device and a backup file. Scout Cloud Backup stays separate.</div>
      </div>
    </div>
    <div class="data-modal-actions">
      <button type="button" class="secondary" id="dataExportBtn"><strong>📤 EXPORT UPDATES</strong><span>Save your current app updates to a file.</span></button>
      <button type="button" class="primary" id="dataImportBtn"><strong>📥 IMPORT UPDATES</strong><span>Load a previously exported Scout updates file.</span></button>
    </div>
    <button type="button" class="ghost data-modal-cancel" id="dataMenuCancelBtn">CANCEL</button>
  </div>
</div>'''
new_modal='''<div class="data-modal-backdrop" id="dataMenuModal" hidden>
  <div class="data-modal" role="dialog" aria-modal="true" aria-labelledby="dataMenuTitle">
    <div class="data-modal-head">
      <div class="data-modal-icon">↕️</div>
      <div>
        <div class="section-eyebrow">DATA & REPORTING</div>
        <div class="data-modal-title" id="dataMenuTitle">Backup or report?</div>
        <div class="data-modal-sub">Back up Scout data or create a print-friendly offline Excel shopping report. Scout Cloud Backup stays separate.</div>
      </div>
    </div>
    <div class="data-modal-actions">
      <button type="button" class="secondary" id="dataExportBtn"><strong>📤 EXPORT BACKUP</strong><span>Save your current Scout data to a backup file.</span></button>
      <button type="button" class="primary" id="dataImportBtn"><strong>📥 IMPORT BACKUP</strong><span>Restore a previously exported Scout backup file.</span></button>
      <button type="button" class="ghost" id="dataShoppingReportBtn"><strong>📊 OFFLINE SHOPPING REPORT (.XLSX)</strong><span>Need, Target, Incoming, and combined Hunt Sheet tabs — ready to print.</span></button>
    </div>
    <button type="button" class="ghost data-modal-cancel" id="dataMenuCancelBtn">CANCEL</button>
  </div>
</div>'''
if old_modal not in s:
    raise SystemExit('data modal anchor not found')
s=s.replace(old_modal,new_modal,1)

report_code=r'''function shoppingReportSortKey(name){
  const parts=String(name||"").trim().split(/\s+/).filter(Boolean);
  const last=parts.pop()||"";
  return (last+" "+parts.join(" ")).toLowerCase();
}
function shoppingReportSortPlayers(rows){
  return [...rows].sort((a,b)=>shoppingReportSortKey(a.name).localeCompare(shoppingReportSortKey(b.name))||String(a.name).localeCompare(String(b.name)));
}
function shoppingReportMoneyCell(value){
  const n=Number(value);
  return Number.isFinite(n)&&n>=0?{value:n,type:"number",style:"money"}:"";
}
function shoppingReportOfficialPreference(p){
  const bits=[];
  const grader=String(p.targetGrader||"").trim();
  const grade=String(p.targetGrade||"").trim();
  const auto=String(p.targetAutoPreference||"").trim();
  if(grader&&grader!=="Any / Raw OK")bits.push(grader+(grade?" "+grade:""));
  else if(grade)bits.push(grade);
  if(auto&&auto!=="No preference")bits.push(auto);
  return bits.join(" · ");
}
function shoppingReportFuturePreference(t){
  const bits=[];
  const grader=String(t?.grader||"").trim();
  const grade=String(t?.grade||"").trim();
  const auto=String(t?.autoPreference||"").trim();
  if(grader&&grader!=="Any / Raw OK")bits.push(grader+(grade?" "+grade:""));
  else if(grade)bits.push(grade);
  if(auto&&auto!=="No preference")bits.push(auto);
  return bits.join(" · ");
}
function shoppingReportFutureTargets(){
  const state=typeof futureHofGetState==="function"?futureHofGetState():{targets:{},purchases:{}};
  const purchases=state?.purchases||{};
  return Object.entries(state?.targets||{})
    .filter(([name,t])=>t&&!t.promotedAt&&!purchases[name])
    .map(([name,t])=>({name,target:t}))
    .sort((a,b)=>shoppingReportSortKey(a.name).localeCompare(shoppingReportSortKey(b.name))||a.name.localeCompare(b.name));
}
function shoppingReportTargetLabel(t){
  if(!t)return "";
  return [t.year,t.set,t.cardNum?"#"+t.cardNum:""].filter(Boolean).join(" ")||String(t.label||t.title||"Saved target");
}
function shoppingReportDateStamp(){
  const d=new Date();
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
}
function shoppingReportBuildSheets(){
  const needs=shoppingReportSortPlayers(PLAYERS.filter(p=>!p.owned&&!p.incoming));
  const officialTargets=shoppingReportSortPlayers(PLAYERS.filter(p=>!!p.target&&!p.incoming));
  const futureTargets=shoppingReportFutureTargets();
  const incoming=shoppingReportSortPlayers(PLAYERS.filter(p=>!!p.incoming));
  const openNeeds=needs.filter(p=>!p.target);
  const generated=new Date().toLocaleString();
  const targetCount=officialTargets.length+futureTargets.length;
  const summary=`Generated ${generated} · ${needs.length} official Hall needs · ${targetCount} active targets (${futureTargets.length} Future HOF) · ${incoming.length} incoming.`;

  const huntRows=[];
  officialTargets.forEach(p=>huntRows.push([
    p.owned?"UPGRADE TARGET":"TARGET",p.name,"Hall of Fame",targetIdentityLabel(p)||p.target,
    shoppingReportOfficialPreference(p),shoppingReportMoneyCell(p.targetMaxPrice),p.targetNotes||""
  ]));
  futureTargets.forEach(({name,target:t})=>huntRows.push([
    "FUTURE HOF TARGET",name,"Future HOF",shoppingReportTargetLabel(t),
    shoppingReportFuturePreference(t),shoppingReportMoneyCell(t.maxPrice),t.notes||""
  ]));
  openNeeds.forEach(p=>huntRows.push([
    "NEED",p.name,"Hall of Fame","Any representative card","","","No saved target yet"
  ]));
  incoming.forEach(p=>huntRows.push([
    "INCOMING — DON'T REBUY",p.name,"Hall of Fame",cardLabel(p),"",shoppingReportMoneyCell(p.pricePaid),
    [p.purchaseSource||"",p.purchaseDate?formatPurchaseDate(p.purchaseDate):"",p.userNotes||""].filter(Boolean).join(" · ")
  ]));

  const needRows=needs.map(p=>[
    p.name,p.induction||"",p.target?"YES":"NO",p.target?(targetIdentityLabel(p)||p.target):"",
    shoppingReportMoneyCell(p.targetMaxPrice),p.targetNotes||""
  ]);
  const targetRows=[
    ...officialTargets.map(p=>[
      "Hall of Fame",p.name,p.owned?"Owned · upgrade target":"Need",targetIdentityLabel(p)||p.target,
      shoppingReportOfficialPreference(p),shoppingReportMoneyCell(p.targetMaxPrice),p.targetNotes||""
    ]),
    ...futureTargets.map(({name,target:t})=>[
      "Future HOF",name,"Watchlist",shoppingReportTargetLabel(t),shoppingReportFuturePreference(t),
      shoppingReportMoneyCell(t.maxPrice),t.notes||""
    ])
  ];
  const incomingRows=incoming.map(p=>[
    p.name,cardLabel(p),shoppingReportMoneyCell(p.pricePaid),p.purchaseDate?formatPurchaseDate(p.purchaseDate):"",
    p.purchaseSource||"",p.userNotes||""
  ]);

  return {
    counts:{needs:needs.length,targets:targetCount,futureTargets:futureTargets.length,incoming:incoming.length},
    sheets:[
      {name:"Hunt Sheet",title:"HOF Card Scout — Offline Hunt Sheet",subtitle:summary,
       headers:["STATUS","PLAYER","SCOPE","CARD / TARGET","GRADE / PREFERENCE","MAX DELIVERED / PAID","NOTES"],rows:huntRows,widths:[24,24,15,34,27,18,42],orientation:"landscape"},
      {name:"Need List",title:"HOF Card Scout — Need List",subtitle:`Generated ${generated} · Official Hall roster only · ${needs.length} players still need representation.`,
       headers:["PLAYER","INDUCTED","TARGET SAVED?","TARGET CARD","MAX DELIVERED","NOTES"],rows:needRows,widths:[25,12,16,34,18,42],orientation:"portrait"},
      {name:"Target List",title:"HOF Card Scout — Target List",subtitle:`Generated ${generated} · ${officialTargets.length} Hall targets + ${futureTargets.length} Future HOF targets. Future HOF targets do not count toward Hall completion.`,
       headers:["SCOPE","PLAYER","CURRENT STATUS","TARGET CARD","GRADE / PREFERENCE","MAX DELIVERED","NOTES"],rows:targetRows,widths:[15,25,20,34,28,18,42],orientation:"landscape"},
      {name:"Incoming",title:"HOF Card Scout — Incoming Cards",subtitle:`Generated ${generated} · ${incoming.length} cards already purchased and on the way. Use this tab to avoid accidental duplicate buys.`,
       headers:["PLAYER","CARD","PAID","PURCHASE DATE","SOURCE","NOTES"],rows:incomingRows,widths:[25,34,15,18,28,42],orientation:"landscape"}
    ]
  };
}
function exportShoppingReport(){
  const api=window.ScoutShoppingReport;
  if(!api||typeof api.downloadWorkbook!=="function"){
    toast("Scout could not load the Excel report generator. Refresh the app and try again.");
    return;
  }
  try{
    const report=shoppingReportBuildSheets();
    api.downloadWorkbook(report.sheets,"HOF-Card-Scout-Shopping-Report-"+shoppingReportDateStamp()+".xlsx",{
      creator:"HOF Card Scout",subject:"Offline card-show and card-shop shopping report"
    });
    toast("📊 Excel report downloaded · "+report.counts.needs+" needs · "+report.counts.targets+" targets.");
  }catch(err){
    console.warn("Scout shopping report failed",err);
    toast("Scout could not create the Excel report: "+(err.message||"unknown error"));
  }
}

'''
anchor='function openDataMenu(){'
if anchor not in s:
    raise SystemExit('openDataMenu anchor not found')
s=s.replace(anchor,report_code+anchor,1)

old_event='''$("dataExportBtn").addEventListener("click",()=>{closeDataMenu();exportUpdates();});
$("dataImportBtn").addEventListener("click",()=>{closeDataMenu();$("importFile").click();});
$("dataMenuModal").addEventListener("click",e=>{if(e.target===$("dataMenuModal"))closeDataMenu();});'''
new_event='''$("dataExportBtn").addEventListener("click",()=>{closeDataMenu();exportUpdates();});
$("dataImportBtn").addEventListener("click",()=>{closeDataMenu();$("importFile").click();});
$("dataShoppingReportBtn").addEventListener("click",()=>{closeDataMenu();exportShoppingReport();});
$("dataMenuModal").addEventListener("click",e=>{if(e.target===$("dataMenuModal"))closeDataMenu();});'''
if old_event not in s:
    raise SystemExit('data menu event anchor not found')
s=s.replace(old_event,new_event,1)

p.write_text(s,encoding='utf-8')

# Current release-version regressions should follow the app release.
for test_path in Path('tests').glob('*.test.cjs'):
    text=test_path.read_text(encoding='utf-8')
    changed=text.replace('5\\.6\\.0','5\\.7\\.0').replace('5.6.0','5.7.0')
    if changed!=text:
        test_path.write_text(changed,encoding='utf-8')

# Expand the existing Data menu contract.
data_test=Path('tests/data-menu.test.cjs')
dt=data_test.read_text(encoding='utf-8')
needle='''assert.match(html,/id="dataImportBtn"/);\n'''
if needle not in dt:
    raise SystemExit('data menu test insertion anchor not found')
dt=dt.replace(needle,needle+'''assert.match(html,/id="dataShoppingReportBtn"/);\nassert.match(html,/shopping-report\\.js/);\nassert.match(html,/dataShoppingReportBtn[\\s\\S]*exportShoppingReport\\(\\)/);\n''',1)
data_test.write_text(dt,encoding='utf-8')

# Add a permanent feature test that validates both the app integration and the generated XLSX package.
Path('tests/offline-shopping-report.test.cjs').write_text(r'''const assert=require("node:assert/strict");
const fs=require("node:fs");
const report=require("../shopping-report.js");

function storedZipEntries(bytes){
  const b=Buffer.from(bytes),out=new Map();
  let off=0;
  while(off+30<=b.length&&b.readUInt32LE(off)===0x04034b50){
    const method=b.readUInt16LE(off+8);
    const size=b.readUInt32LE(off+18);
    const nameLen=b.readUInt16LE(off+26),extraLen=b.readUInt16LE(off+28);
    assert.equal(method,0,"shopping workbook ZIP should use dependency-free store mode");
    const name=b.subarray(off+30,off+30+nameLen).toString("utf8");
    const start=off+30+nameLen+extraLen,end=start+size;
    out.set(name,b.subarray(start,end));
    off=end;
  }
  return out;
}

const sheets=[
  {name:"Hunt Sheet",title:"Hunt",subtitle:"Offline",headers:["STATUS","PLAYER","MAX"],rows:[["TARGET","Sandy Koufax",{value:25,type:"number",style:"money"}]],widths:[20,25,15],orientation:"landscape"},
  {name:"Need List",title:"Need",subtitle:"Official Hall",headers:["PLAYER"],rows:[["Pete Hill"]],widths:[25],orientation:"portrait"},
  {name:"Target List",title:"Targets",subtitle:"Hall + Future",headers:["PLAYER"],rows:[["Buster Posey"]],widths:[25],orientation:"landscape"},
  {name:"Incoming",title:"Incoming",subtitle:"Do not rebuy",headers:["PLAYER"],rows:[["Dave Bancroft"]],widths:[25],orientation:"landscape"}
];
const bytes=report.buildWorkbook(sheets,{creator:"HOF Card Scout",now:new Date("2026-08-27T12:00:00Z")});
assert.equal(bytes[0],0x50);assert.equal(bytes[1],0x4b);
const entries=storedZipEntries(bytes);
for(const name of ["[Content_Types].xml","_rels/.rels","docProps/core.xml","docProps/app.xml","xl/workbook.xml","xl/_rels/workbook.xml.rels","xl/styles.xml","xl/worksheets/sheet1.xml","xl/worksheets/sheet4.xml"]){
  assert.ok(entries.has(name),"missing XLSX part "+name);
}
const workbook=entries.get("xl/workbook.xml").toString("utf8");
assert.match(workbook,/sheet name="Hunt Sheet"/);assert.match(workbook,/sheet name="Need List"/);assert.match(workbook,/sheet name="Target List"/);assert.match(workbook,/sheet name="Incoming"/);
assert.match(workbook,/_xlnm\.Print_Titles/);
const hunt=entries.get("xl/worksheets/sheet1.xml").toString("utf8");
assert.match(hunt,/fitToWidth="1"/);assert.match(hunt,/state="frozen"/);assert.match(hunt,/Sandy Koufax/);assert.match(hunt,/<v>25<\/v>/);
assert.ok(entries.get("xl/styles.xml").toString("utf8").includes('$#,##0.00'));

const html=fs.readFileSync("index.html","utf8");
assert.match(html,/v5\.7\.0/);
assert.match(html,/id="dataShoppingReportBtn"/);
assert.match(html,/OFFLINE SHOPPING REPORT \(\.XLSX\)/);
assert.match(html,/<script src="shopping-report\.js"><\/script>/);
assert.match(html,/function shoppingReportBuildSheets\(\)/);
assert.match(html,/PLAYERS\.filter\(p=>!p\.owned&&!p\.incoming\)/);
assert.match(html,/PLAYERS\.filter\(p=>!!p\.target&&!p\.incoming\)/);
assert.match(html,/function shoppingReportFutureTargets\(\)/);
assert.match(html,/Future HOF targets do not count toward Hall completion/);
assert.match(html,/function exportShoppingReport\(\)/);
assert.match(html,/dataShoppingReportBtn[\s\S]*exportShoppingReport\(\)/);
assert.match(html,/HOF-Card-Scout-Shopping-Report-/);

const fnBlock=html.match(/function exportShoppingReport\(\)\{[\s\S]*?\n\}\n\nfunction openDataMenu/);
assert.ok(fnBlock,"exportShoppingReport function block missing");
assert.doesNotMatch(fnBlock[0],/fetch\s*\(/,"offline report must not spend a marketplace/API search");

console.log("Offline shopping report tests passed.");
''',encoding='utf-8')
