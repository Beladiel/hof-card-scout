from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')

# App version only. Worker remains unchanged.
s=s.replace('v5.8.0','v5.9.0')
s=s.replace('version:"5.8.0"','version:"5.9.0"')

css='''
/* v5.9.0 — collection value foundation */
.collection-value-panel{margin:12px 0;border:1px solid rgba(230,189,99,.38);border-radius:17px;background:linear-gradient(145deg,rgba(230,189,99,.08),rgba(255,255,255,.035));padding:13px}
.collection-value-panel[hidden]{display:none}
.collection-value-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px}
.collection-value-title{font-size:17px;font-weight:950;margin-top:2px}
.collection-value-sub{font-size:10px;color:var(--muted);line-height:1.45;margin-top:3px}
.collection-value-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.collection-value-stat{border:1px solid var(--line);border-radius:13px;padding:10px;background:rgba(0,0,0,.10);min-width:0}
.collection-value-stat .k{font-size:8px;font-weight:950;letter-spacing:.09em;color:var(--muted)}
.collection-value-stat .v{font-size:17px;font-weight:950;margin-top:4px;overflow-wrap:anywhere}
.collection-value-stat .v.up{color:#9ce8bb}.collection-value-stat .v.down{color:#ffaaa2}
.collection-value-status{font-size:10px;color:var(--muted);line-height:1.5;margin-top:9px}
.collection-value-status strong{color:var(--text)}
.collection-snapshot-saved{margin:9px 0 0;border:1px solid rgba(86,197,138,.36);border-radius:11px;background:rgba(86,197,138,.09);color:#9ce8bb;padding:8px 10px;font-size:10px;font-weight:850;line-height:1.4}
@media(max-width:620px){.collection-value-grid{grid-template-columns:repeat(2,1fr)}}
'''
marker='/* v5.8.0 — representative card photos */'
assert marker in s
s=s.replace(marker,css+'\n'+marker,1)

markup='''

      <div class="collection-value-panel" id="collectionValuePanel" hidden>
        <div class="collection-value-head">
          <div>
            <div class="section-eyebrow">📈 PERSONAL COLLECTION VALUE</div>
            <div class="collection-value-title">What you paid vs. Scout's current estimate</div>
            <div class="collection-value-sub">Purchase cost never changes when Scout refreshes market value. Reliable refreshes build a dated history for this exact representative card.</div>
          </div>
        </div>
        <div class="collection-value-grid">
          <div class="collection-value-stat"><div class="k">PRICE PAID</div><div class="v" id="collectionValuePaid">—</div></div>
          <div class="collection-value-stat"><div class="k">CURRENT EST. VALUE</div><div class="v" id="collectionValueCurrent">—</div></div>
          <div class="collection-value-stat"><div class="k">GAIN / LOSS</div><div class="v" id="collectionValueGain">—</div></div>
          <div class="collection-value-stat"><div class="k">VALUE SNAPSHOTS</div><div class="v" id="collectionValueSnapshots">0</div></div>
        </div>
        <div class="collection-value-status" id="collectionValueStatus"></div>
      </div>
'''
needle='''      <div class="detail-grid">
        <div class="metric"><div class="m-label">MEDIAN SOLD</div><div class="m-value" id="medianValue">Not priced yet</div></div>
        <div class="metric"><div class="m-label">LAST CHECKED</div><div class="m-value" id="lastChecked">—</div></div>
        <div class="metric"><div class="m-label">UPGRADE TARGET</div><div class="m-value" id="upgradeTarget">Scout research</div></div>
      </div>'''
assert needle in s
s=s.replace(needle,needle+markup,1)

needle='<script src="card-photo.js"></script>'
assert needle in s
s=s.replace(needle,'<script src="collection-value.js"></script>\n'+needle,1)

# Persist valuation history and the key for the current representative card.
needle='''    median:p.median??null,low:p.low??null,high:p.high??null,comps:p.comps??null,confidence:p.confidence||"",lastChecked:p.lastChecked||""
  };'''
replacement='''    median:p.median??null,low:p.low??null,high:p.high??null,comps:p.comps??null,confidence:p.confidence||"",lastChecked:p.lastChecked||"",
    valuationUpdatedAt:p.valuationUpdatedAt||"",valuationCardKey:p.valuationCardKey||"",
    valuationHistory:Array.isArray(p.valuationHistory)?p.valuationHistory.slice(-24):[]
  };'''
assert needle in s
s=s.replace(needle,replacement,1)

# Value panel rendering + reliable snapshot helper.
functions='''
function renderCollectionValuePanel(p){
  const panel=$("collectionValuePanel");
  if(!panel)return;
  panel.hidden=!p?.owned;
  if(!p?.owned)return;
  const api=window.ScoutCollectionValue;
  const paid=Number(p.pricePaid),current=Number(p.median);
  const paidKnown=p.pricePaid!==null&&p.pricePaid!==undefined&&p.pricePaid!==""&&Number.isFinite(paid)&&paid>=0;
  const currentKnown=Number.isFinite(current)&&current>0;
  const snapshots=api?api.currentCardSnapshots(p):[];
  const gain=api&&paidKnown&&currentKnown?api.gainLoss(paid,current):null;
  $("collectionValuePaid").textContent=paidKnown?formatMoney(paid):"Not recorded";
  $("collectionValueCurrent").textContent=currentKnown?formatMoney(current):"Not valued yet";
  const gainEl=$("collectionValueGain");
  gainEl.className="v";
  if(gain){
    const sign=gain.amount>0?"+":"";
    const pct=gain.pct===null?"":` (${gain.pct>0?"+":""}${gain.pct.toFixed(1)}%)`;
    gainEl.textContent=sign+formatMoney(gain.amount)+pct;
    if(gain.amount>0)gainEl.classList.add("up");
    if(gain.amount<0)gainEl.classList.add("down");
  }else gainEl.textContent="—";
  $("collectionValueSnapshots").textContent=String(snapshots.length);
  const status=$("collectionValueStatus");
  if(currentKnown){
    const bits=[];
    if(Number(p.comps)>0)bits.push(Number(p.comps)+" sold comp"+(Number(p.comps)===1?"":"s"));
    if(p.confidence)bits.push(String(p.confidence).toUpperCase()+" confidence");
    if(p.lastChecked)bits.push("valued "+p.lastChecked);
    status.innerHTML="<strong>Current estimate:</strong> "+escapeHtml(bits.join(" · ")||"Saved market estimate")+". Refreshing this exact representative card updates today's snapshot without changing what you paid.";
  }else{
    status.innerHTML="<strong>No tracked estimate yet.</strong> Tap Refresh Value below. Scout will load this representative card's grading, autograph, relic, serial, and card details so the valuation matches the card you actually own.";
  }
}
function collectionValueTrackRefresh(card,data,ctx){
  const api=window.ScoutCollectionValue,p=ctx?.p;
  if(!api||!p?.owned||!api.exactRepresentativeMatch(p,card))return false;
  const patch=api.buildTrackingPatch(p,data,new Date());
  if(!patch)return false;
  Object.assign(p,patch);
  savePlayerEdit(p);
  return true;
}
'''
needle='''function openPlayer(p,sourceScreen="homeScreen"){'''
assert needle in s
s=s.replace(needle,functions+'\n'+needle,1)

# Refresh panel every time a player detail page opens.
needle='''  $("lastChecked").textContent=p.lastChecked||"—";
  $("upgradeTarget").textContent=p.target?targetIdentityLabel(p):(!p.owned?"First card":"Scout research");'''
replacement='''  $("lastChecked").textContent=p.lastChecked||"—";
  $("upgradeTarget").textContent=p.target?targetIdentityLabel(p):(!p.owned?"First card":"Scout research");
  renderCollectionValuePanel(p);'''
assert needle in s
s=s.replace(needle,replacement,1)

# Reset only the current estimate when the representative identity changes; preserve old snapshots.
needle='''  const p=currentPlayer,wasOwned=p.owned,oldYear=p.cardYear;
  p.owned=true;p.cardYear=year;p.set=set;p.cardNum=$("manageNum").value.trim();'''
replacement='''  const p=currentPlayer,wasOwned=p.owned,oldYear=p.cardYear;
  const oldValueKey=window.ScoutCollectionValue&&wasOwned?ScoutCollectionValue.fingerprintForPlayer(p):"";
  p.owned=true;p.cardYear=year;p.set=set;p.cardNum=$("manageNum").value.trim();'''
assert needle in s
s=s.replace(needle,replacement,1)
needle='''  // A new representative card needs a fresh valuation later.
  if(manageMode==="upgrade" || !wasOwned){p.median=null;p.low=null;p.high=null;p.comps=null;p.confidence="";p.lastChecked="";}'''
replacement='''  // A new representative identity needs a fresh valuation, but old snapshots remain historical.
  const newValueKey=window.ScoutCollectionValue?ScoutCollectionValue.fingerprintForPlayer(p):"";
  if(manageMode==="upgrade" || !wasOwned || (oldValueKey&&newValueKey&&oldValueKey!==newValueKey)){
    p.median=null;p.low=null;p.high=null;p.comps=null;p.confidence="";p.lastChecked="";p.valuationUpdatedAt="";p.valuationCardKey="";
  }'''
assert needle in s
s=s.replace(needle,replacement,1)

needle='''  p.median=null;p.low=null;p.high=null;p.comps=null;p.confidence="";p.lastChecked="";
  savePlayerEdit(p);stats();rotateMission();buildAlphabet();renderList();openPlayer(p);'''
replacement='''  p.median=null;p.low=null;p.high=null;p.comps=null;p.confidence="";p.lastChecked="";p.valuationUpdatedAt="";p.valuationCardKey="";
  savePlayerEdit(p);stats();rotateMission();buildAlphabet();renderList();openPlayer(p);'''
assert needle in s
s=s.replace(needle,replacement,1)

# Load the exact representative variant into Card Shop Mode for a real value refresh.
old='''function openShop(prefill){
  phase3bActiveTargetPlayer=null;
  $("shopNum").placeholder="482";
  returnScreen=document.querySelector(".screen.active")?.id||"homeScreen";
  if(prefill){
    $("shopPlayer").value=prefill.name||"";
    $("shopYear").value=prefill.cardYear||"";
    setShopSetValue(prefill.set||"");
    $("shopNum").value=prefill.cardNum||"";
    $("shopNotes").value=prefill.description||"";
  }else{
    $("shopForm").reset();
    setShopSetValue("");
  }
  syncShopGrader();
  resetPsaVerification(true);
  renderRecentSearches();
  applyFastMode(localStorage.getItem(FAST_MODE_KEY)==="1");
  $("shopResult").hidden=true;showScreen("shopScreen");
}'''
new='''function openShop(prefill){
  phase3bActiveTargetPlayer=null;
  $("shopNum").placeholder="482";
  returnScreen=document.querySelector(".screen.active")?.id||"homeScreen";
  if(prefill){
    const variant=window.ScoutCollectionValue?ScoutCollectionValue.representativeVariant(prefill):{
      grader:prefill.grader||"Raw",grade:prefill.gradeCondition||"",serial:prefill.serial||"",autograph:!!prefill.autograph,relic:!!prefill.relic
    };
    $("shopPlayer").value=prefill.name||"";
    $("shopYear").value=prefill.cardYear||"";
    setShopSetValue(prefill.set||"");
    $("shopNum").value=prefill.cardNum||"";
    $("shopPrice").value="";
    const known=["Raw","PSA","SGC","CGC","BGS / Beckett","CSG","HGA","TAG","ISA"];
    if(known.includes(variant.grader)){$("shopGrade").value=variant.grader;$("shopGradeOther").value="";}
    else{$("shopGrade").value="__other__";$("shopGradeOther").value=variant.grader||"";}
    $("shopGradeNum").value=variant.grader==="Raw"?"":(variant.grade||"");
    $("shopSerial").value=variant.serial||"";
    $("shopAuto").checked=!!variant.autograph;
    $("shopRelic").checked=!!variant.relic;
    $("shopNotes").value=prefill.userNotes||prefill.description||"";
  }else{
    $("shopForm").reset();
    setShopSetValue("");
  }
  syncShopGrader();
  resetPsaVerification(true);
  renderRecentSearches();
  applyFastMode(localStorage.getItem(FAST_MODE_KEY)==="1");
  $("shopResult").hidden=true;showScreen("shopScreen");
}'''
assert old in s
s=s.replace(old,new,1)

# On purchase/replacement, snapshot the newly selected representative only when sold evidence is reliable.
old='''  // We just priced this exact card, so keep that fresh valuation with the representative card.
  p.median=Number.isFinite(Number(data.median))?Number(data.median):null;
  p.low=Number.isFinite(Number(data.low))?Number(data.low):null;
  p.high=Number.isFinite(Number(data.high))?Number(data.high):null;
  p.comps=Number(data.used)||null;
  p.confidence=data.confidence||"";
  p.lastChecked=new Date().toLocaleDateString();'''
new='''  // The representative changed. Preserve old snapshots, clear the old current estimate, then track this exact card if the sold evidence is reliable.
  p.median=null;p.low=null;p.high=null;p.comps=null;p.confidence="";p.lastChecked="";p.valuationUpdatedAt="";p.valuationCardKey="";
  if(window.ScoutCollectionValue){
    const valuePatch=ScoutCollectionValue.buildTrackingPatch(p,data,new Date());
    if(valuePatch)Object.assign(p,valuePatch);
  }'''
assert old in s
s=s.replace(old,new,1)

# Save a snapshot after any successful deliberate pricing run that exactly matches the owned representative.
needle='''    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data.ok) throw new Error(data.message||data.error||("Pricing service returned "+res.status));
    renderLiveResult(card,data,ctx);'''
replacement='''    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data.ok) throw new Error(data.message||data.error||("Pricing service returned "+res.status));
    data.collectionSnapshotSaved=collectionValueTrackRefresh(card,data,ctx);
    renderLiveResult(card,data,ctx);'''
assert needle in s
s=s.replace(needle,replacement,1)

# Tell the user when the deliberate valuation was actually preserved as collection history.
needle='''    <p style="margin:8px 0 0;font-size:11px;color:var(--muted)"><strong>Pricing source:</strong> ${escapeHtml(provider)}${speedBits?" · "+escapeHtml(speedBits):""}</p>
    ${labHtml}'''
replacement='''    <p style="margin:8px 0 0;font-size:11px;color:var(--muted)"><strong>Pricing source:</strong> ${escapeHtml(provider)}${speedBits?" · "+escapeHtml(speedBits):""}</p>
    ${data.collectionSnapshotSaved?'<div class="collection-snapshot-saved">✓ COLLECTION VALUE SNAPSHOT SAVED · This exact representative card now has a dated value point.</div>':''}
    ${labHtml}'''
assert needle in s
s=s.replace(needle,replacement,1)

p.write_text(s,encoding='utf-8')

# Add focused regression coverage.
test=Path('tests/collection-value-foundation.test.cjs')
test.write_text(r'''const assert=require("node:assert/strict");
const fs=require("node:fs");
const value=require("../collection-value.js");

const mantle={name:"Mickey Mantle",owned:true,cardYear:1968,set:"Topps",cardNum:"280",description:"Graded CSG 1.5",grader:"Raw",gradeCondition:"",serial:"",autograph:false,relic:false,pricePaid:40};
const variant=value.representativeVariant(mantle);
assert.equal(variant.grader,"CSG");
assert.equal(variant.grade,"1.5");
const exact={player:"Mickey Mantle",year:1968,set:"Topps",cardNum:"280",grader:"CSG",grade:"1.5",serial:"",autograph:false,relic:false};
assert.equal(value.exactRepresentativeMatch(mantle,exact),true);
assert.equal(value.exactRepresentativeMatch(mantle,{...exact,grade:"2"}),false);
assert.equal(value.exactRepresentativeMatch(mantle,{...exact,autograph:true}),false);

const good={median:62.5,low:52,high:75,used:6,confidence:"medium"};
assert.equal(value.reliableValuation(good),true);
assert.equal(value.reliableValuation({...good,used:1}),false);
assert.equal(value.reliableValuation({...good,confidence:"insufficient"}),false);

const p1={...mantle,valuationHistory:[]};
const patch1=value.buildTrackingPatch(p1,good,new Date("2026-08-27T12:00:00Z"));
assert.equal(patch1.median,62.5);
assert.equal(patch1.valuationHistory.length,1);
const p2={...p1,...patch1};
const patchSameDay=value.buildTrackingPatch(p2,{...good,median:64},new Date("2026-08-27T20:00:00Z"));
assert.equal(patchSameDay.valuationHistory.length,1);
assert.equal(patchSameDay.valuationHistory[0].value,64);
const p3={...p2,...patchSameDay};
const patchNext=value.buildTrackingPatch(p3,{...good,median:66},new Date("2026-08-28T12:00:00Z"));
assert.equal(patchNext.valuationHistory.length,2);

let history=[];
for(let i=0;i<40;i++){
  const snap={at:new Date(Date.UTC(2026,0,i+1)).toISOString(),value:50+i,low:45,high:60,comps:5,confidence:"medium",cardKey:"abc"};
  history=value.mergeSnapshot(history,snap);
}
assert.ok(history.length<=value.MAX_HISTORY);
assert.equal(history.at(-1).value,89);

assert.deepEqual(value.gainLoss(40,64),{amount:24,pct:60});
assert.equal(value.gainLoss(null,64),null);

const html=fs.readFileSync("index.html","utf8");
assert.match(html,/v5\.9\.0/);
assert.match(html,/<script src="collection-value\.js"><\/script>/);
assert.match(html,/id="collectionValuePanel"/);
assert.match(html,/id="collectionValuePaid"/);
assert.match(html,/id="collectionValueCurrent"/);
assert.match(html,/id="collectionValueGain"/);
assert.match(html,/id="collectionValueSnapshots"/);
assert.match(html,/valuationHistory:Array\.isArray\(p\.valuationHistory\)/);
assert.match(html,/ScoutCollectionValue\.exactRepresentativeMatch\(p,card\)/);
assert.match(html,/collectionSnapshotSaved=collectionValueTrackRefresh\(card,data,ctx\)/);
assert.match(html,/ScoutCollectionValue\.representativeVariant\(prefill\)/);
assert.match(html,/COLLECTION VALUE SNAPSHOT SAVED/);
console.log("Collection value foundation tests passed.");
''',encoding='utf-8')
