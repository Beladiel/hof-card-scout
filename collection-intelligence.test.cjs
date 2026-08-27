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
assert.ok(genericModern.score>autoModern.score,'autograph/numbering should protect intentional modern representation');

const rookie=intel.evaluatePlayer(p({name:'Rookie',cardYear:1983,induction:2007,description:'Rookie'}),2026);
const samePlain=intel.evaluatePlayer(p({name:'Plain',cardYear:1983,induction:2007}),2026);
assert.ok(rookie.score<samePlain.score,'rookie designation should reduce upgrade urgency');

const incoming=intel.evaluatePlayer(p({name:'Incoming',incoming:true}),2026);
assert.equal(incoming,null,'incoming cards should not be recommended for immediate upgrades');

const ranked=intel.rankCollection([
  p({name:'B',cardYear:2025,induction:1980}),
  p({name:'A',cardYear:2025,induction:1980}),
  p({name:'Need',owned:false,cardYear:null}),
  p({name:'Old',cardYear:1960,induction:1980})
],{limit:2,currentYear:2026});
assert.deepEqual(ranked.map(x=>x.name),['A','B'],'ranking should be deterministic and ignore unowned cards');

console.log('Collection Intelligence tests passed:', 7, 'scenarios');
