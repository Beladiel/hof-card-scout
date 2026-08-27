const assert=require('node:assert/strict');
const intel=require('./collection-intelligence.js');

function p(overrides={}){
  return {name:'Test Player',owned:true,incoming:false,cardYear:1995,set:'Topps',cardNum:'1',induction:1980,description:'',grader:'Raw',gradeCondition:'',autograph:false,relic:false,serial:'',target:'',targetNotes:'',...overrides};
}

const modern=intel.evaluatePlayer(p({name:'Modern',cardYear:2025,induction:1980,set:'Topps'}),2026);
const vintageLow=intel.evaluatePlayer(p({name:'Vintage Low',cardYear:1962,induction:1980,set:'Topps',grader:'PSA',gradeCondition:'PSA 2'}),2026);
assert.ok(modern.score>vintageLow.score,'modern generic card should outrank low-grade vintage');

const target=intel.evaluatePlayer(p({name:'Targeted',cardYear:2005,induction:2022,target:'1997 Topps #1'}),2026);
const untargeted=intel.evaluatePlayer(p({name:'Untargeted',cardYear:2005,induction:2022}),2026);
assert.ok(target.score>untargeted.score,'saved older target should raise upgrade priority');
assert.equal(target.targetYear,1997);

const rough=intel.evaluatePlayer(p({name:'Rough',cardYear:1975,induction:1990,description:'Rough Shape'}),2026);
const clean=intel.evaluatePlayer(p({name:'Clean',cardYear:1975,induction:1990}),2026);
assert.ok(rough.score>clean.score,'severe condition should raise upgrade priority');

const genericModern=intel.evaluatePlayer(p({name:'Generic',cardYear:2025,induction:2000,set:'Topps'}),2026);
const autoModern=intel.evaluatePlayer(p({name:'Auto',cardYear:2025,induction:2000,set:'Topps Finest',autograph:true,serial:'38/99'}),2026);
assert.ok(genericModern.score>autoModern.score,'an owned autograph/numbered card should remain protected from routine replacement');

const authenticatedOwned=intel.evaluatePlayer(p({name:'Authenticated Auto',cardYear:2025,induction:2000,set:'Topps',autograph:true,grader:'PSA',gradeCondition:'PSA 8'}),2026);
assert.ok(authenticatedOwned.score<genericModern.score,'an owned graded autograph should get stronger protection');

const rookie=intel.evaluatePlayer(p({name:'Rookie',cardYear:1983,induction:2007,description:'Rookie'}),2026);
const samePlain=intel.evaluatePlayer(p({name:'Plain',cardYear:1983,induction:2007}),2026);
assert.ok(rookie.score<samePlain.score,'rookie designation should reduce upgrade urgency');

const savedAuto=intel.evaluatePlayer(p({name:'Saved Auto',cardYear:2005,induction:2022,target:'1997 Topps JSA Authenticated Autograph'}),2026);
assert.ok(savedAuto.score>target.score,'a saved authenticated autograph target should receive a major preference boost');

const current={cardYear:2025};
const olderBase=intel.candidatePreferenceScore({cardYear:1975,description:'Topps base card',price:60},current,{budget:100,currentYear:2026});
const affordableAuthAuto=intel.candidatePreferenceScore({cardYear:1990,description:'JSA Authenticated Autograph',autograph:true,grader:'PSA',gradeCondition:'PSA 8',price:65},current,{budget:100,currentYear:2026});
assert.ok(affordableAuthAuto.score>olderBase.score,'an affordable authenticated/graded autograph may outrank an older non-auto base card');

const overBudgetAuthAuto=intel.candidatePreferenceScore({cardYear:1990,description:'JSA Authenticated Autograph',autograph:true,grader:'PSA',gradeCondition:'PSA 8',price:140},current,{budget:100,currentYear:2026});
assert.ok(overBudgetAuthAuto.score<olderBase.score,'over-budget autograph candidates should lose the affordability advantage');

const farVintage=intel.candidatePreferenceScore({cardYear:1955,description:'Topps base card',price:60},current,{budget:100,currentYear:2026});
assert.ok(farVintage.score>affordableAuthAuto.score,'substantially older true-vintage cardboard should still be able to beat a much newer autograph');

const newerPsa10=intel.candidatePreferenceScore({cardYear:2018,description:'Topps',grader:'PSA',gradeCondition:'PSA 10',price:40},current,{budget:100,currentYear:2026});
assert.ok(olderBase.score>newerPsa10.score,'grading alone should not make a newer PSA 10 outrank a much older card');

const incoming=intel.evaluatePlayer(p({name:'Incoming',incoming:true}),2026);
assert.equal(incoming,null,'incoming cards should not be recommended for immediate upgrades');

const ranked=intel.rankCollection([
  p({name:'B',cardYear:2025,induction:1980}),
  p({name:'A',cardYear:2025,induction:1980}),
  p({name:'Need',owned:false,cardYear:null}),
  p({name:'Old',cardYear:1960,induction:1980})
],{limit:2,currentYear:2026});
assert.deepEqual(ranked.map(x=>x.name),['A','B'],'ranking should be deterministic and ignore unowned cards');

console.log('Collection Intelligence tests passed:', 12, 'scenarios');
