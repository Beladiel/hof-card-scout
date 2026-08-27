from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')

old='''function targetPreferenceBits(p){\n  if(!p?.target)return [];\n  const bits=[];\n  const grader=String(p.targetGrader||"").trim();\n  const grade=String(p.targetGrade||"").trim();\n  const autoPref=String(p.targetAutoPreference||"").trim();\n  const max=Number(p.targetMaxPrice);\n  if(grader&&grader!=="Any / Raw OK")bits.push("Grade: "+grader+(grade?" "+grade:""));\n  else if(grade)bits.push("Condition: "+grade);\n  if(autoPref&&autoPref!=="No preference")bits.push(autoPref);\n  if(Number.isFinite(max)&&max>0)bits.push("Max delivered "+formatMoney(max));\n  if(p.targetNotes)bits.push(String(p.targetNotes));\n  return bits;\n}\n'''
new=old+'''function targetSearchHint(p){\n  if(!p?.target)return "";\n  const t=targetIdentity(p),parts=[];\n  if(t.year)parts.push(String(t.year));\n  if(t.set)parts.push(t.set);\n  if(t.cardNum)parts.push("#"+t.cardNum);\n  const grader=String(p.targetGrader||"").trim();\n  const grade=String(p.targetGrade||"").trim();\n  const autoPref=String(p.targetAutoPreference||"").trim();\n  if(grader&&grader!=="Any / Raw OK")parts.push(grader);\n  if(grade)parts.push(grade);\n  if(autoPref==="Autograph required")parts.push("autograph");\n  return parts.join(" ").trim()||String(p.target||"").trim();\n}\n'''
if 'function targetSearchHint(p)' not in s:
    if old not in s: raise SystemExit('targetPreferenceBits anchor not found')
    s=s.replace(old,new,1)

old='''  if(!$("findTargetBudget").value)$("findTargetBudget").value=localStorage.getItem(FIND_TARGET_BUDGET_KEY)||"";\n'''
new='''  const structuredMax=Number(currentPlayer.targetMaxPrice);\n  if(Number.isFinite(structuredMax)&&structuredMax>0)$("findTargetBudget").value=structuredMax.toFixed(2);\n  else if(!$("findTargetBudget").value)$("findTargetBudget").value=localStorage.getItem(FIND_TARGET_BUDGET_KEY)||"";\n'''
if old in s:
    s=s.replace(old,new,1)
elif 'const structuredMax=Number(currentPlayer.targetMaxPrice);' not in s:
    raise SystemExit('openFindTarget budget anchor not found')

old='''      searchHint:p.target||"",\n'''
new='''      searchHint:targetSearchHint(p),\n      targetSpec:p.target?{\n        year:targetIdentity(p).year,set:targetIdentity(p).set,cardNum:targetIdentity(p).cardNum,\n        grader:p.targetGrader||"Any / Raw OK",grade:p.targetGrade||"",\n        autographPreference:p.targetAutoPreference||"No preference",\n        maxDelivered:Number.isFinite(Number(p.targetMaxPrice))?Number(p.targetMaxPrice):null\n      }:null,\n'''
if old in s:
    s=s.replace(old,new,1)
elif 'targetSpec:p.target?' not in s:
    raise SystemExit('searchHint anchor not found')

s=s.replace('Scout’s rule: asking price is not market value. ⚾ · v5.0.3','Scout’s rule: asking price is not market value. ⚾ · v5.1.0',1)
p.write_text(s,encoding='utf-8')

Path('tests/structured-targets.test.cjs').write_text(r'''const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const html=fs.readFileSync("index.html","utf8");
function block(start,end){
  const a=html.indexOf(start),b=html.indexOf(end,a);
  assert.ok(a>=0&&b>a,`missing block ${start}`);
  return html.slice(a,b);
}
const parser=block("function phase3bParseTarget(label)","function phase3bScoutTarget(p)");
const helpers=block("function targetIdentity(p)","function purchaseSummary(p)");
const ctx={};vm.createContext(ctx);vm.runInContext(parser+"\n"+helpers+"\nthis.api={targetIdentity,targetIdentityLabel,targetPreferenceBits,targetSearchHint,targetPrimaryStatus,applyStructuredTarget,clearStructuredTarget};",ctx);
const api=ctx.api;
const legacy={target:"1980 Topps #482",targetNotes:"favorite rookie"};
assert.deepEqual(JSON.parse(JSON.stringify(api.targetIdentity(legacy))),{year:1980,set:"Topps",cardNum:"482"});
const p={target:""};
api.applyStructuredTarget(p,{year:1980,set:"Topps",cardNum:"482",grader:"PSA",grade:"7",autoPreference:"Autograph required",maxPrice:75,notes:"clean copy",listingUrl:"https://example.test",source:"Scout Target Finder"});
assert.equal(p.target,"1980 Topps #482");
assert.equal(p.targetMaxPrice,75);
assert.match(api.targetSearchHint(p),/1980 Topps #482 PSA 7 autograph/i);
assert.deepEqual(JSON.parse(JSON.stringify(api.targetPrimaryStatus({owned:false,incoming:false,target:p.target}))),{key:"target",label:"🎯 TARGET"});
assert.equal(api.targetPrimaryStatus({owned:true,incoming:false,target:p.target}).key,"owned");
assert.equal(api.targetPrimaryStatus({owned:true,incoming:true,target:p.target}).key,"incoming");
api.clearStructuredTarget(p);assert.equal(p.target,"");assert.equal(p.targetMaxPrice,null);
assert.match(html,/targetSpec:p\.target\?/);
assert.match(html,/const structuredMax=Number\(currentPlayer\.targetMaxPrice\)/);
assert.match(html,/id="editTargetBtn"/);
assert.match(html,/id="removeTargetBtn"/);
assert.match(html,/id="targetAutoPreference"/);
console.log("Structured target tests passed.");
''',encoding='utf-8')
print('structured target search patched')
