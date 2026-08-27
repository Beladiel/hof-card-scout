const assert=require("node:assert/strict");
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
assert.match(html,/v6\.1\.0/);
assert.match(html,/<script src="collection-value\.js"><\/script>/);
assert.match(html,/id="collectionValuePanel"/);
assert.match(html,/id="collectionValuePaid"/);
assert.match(html,/id="collectionValueCurrent"/);
assert.match(html,/id="collectionValueGain"/);
assert.match(html,/id="collectionValueSnapshots"/);
assert.match(html,/valuationHistory:Array\.isArray\(p\.valuationHistory\)/);
assert.match(html,/api\.exactRepresentativeMatch\(p,card\)/);
assert.match(html,/collectionSnapshotSaved=collectionValueTrackRefresh\(card,data,ctx\)/);
assert.match(html,/ScoutCollectionValue\.representativeVariant\(prefill\)/);
assert.match(html,/COLLECTION VALUE SNAPSHOT SAVED/);
console.log("Collection value foundation tests passed.");
