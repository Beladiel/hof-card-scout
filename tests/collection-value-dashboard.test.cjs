const assert=require('assert');
const valueApi=require('../collection-value.js');
const dashboard=require('../collection-value-dashboard.js');

function player(name,year,set,paid,value){
  const p={name,owned:true,cardYear:year,set,cardNum:'1',grader:'Raw',gradeCondition:'',serial:'',autograph:false,relic:false,description:'',pricePaid:paid,valuationHistory:[]};
  if(value!==null){
    const cardKey=valueApi.fingerprintForPlayer(p);
    p.valuationHistory=[{at:'2026-08-27T12:00:00.000Z',value,low:value-2,high:value+2,comps:4,confidence:'medium',cardKey}];
  }
  return p;
}

const a=player('A',1990,'Topps',50,75);
const b=player('B',1991,'Topps',null,20);
const c=player('C',1992,'Topps',10,null);
c.valuationHistory=[{at:'2026-08-27T12:00:00.000Z',value:999,comps:9,confidence:'high',cardKey:'old-card'}];
const need={name:'Need',owned:false,pricePaid:5,valuationHistory:[]};

const s=dashboard.summarize([a,b,c,need],valueApi);
assert.equal(s.ownedCount,3);
assert.equal(s.valuedCount,2);
assert.equal(s.unvaluedCount,1);
assert.equal(s.coveragePct,66.7);
assert.equal(s.estimatedValue,95);
assert.equal(s.matchedCount,1);
assert.equal(s.matchedCostBasis,50);
assert.equal(s.matchedCurrentValue,75);
assert.equal(s.gainLoss,25);
assert.equal(s.gainLossPct,50);

const empty=dashboard.summarize([c],valueApi);
assert.equal(empty.estimatedValue,null);
assert.equal(empty.matchedCostBasis,null);
assert.equal(empty.gainLoss,null);
assert.equal(empty.coveragePct,0);

console.log('collection value dashboard tests passed');
