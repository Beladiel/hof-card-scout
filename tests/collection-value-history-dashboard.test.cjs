const assert=require('assert');
const fs=require('fs');
const dashboard=require('../collection-value-dashboard.js');

const summary={
  ownedCount:100,valuedCount:3,unvaluedCount:97,coveragePct:3,
  estimatedValue:250.25,matchedCount:2,matchedCostBasis:180,
  matchedCurrentValue:210,gainLoss:30,gainLossPct:16.7
};
const first=dashboard.snapshotForSummary(summary,new Date('2026-08-27T12:00:00Z'));
assert(first,'reliable collection summary should produce a checkpoint');
assert.strictEqual(first.value,250.25);
assert.strictEqual(first.valuedCount,3);
assert.strictEqual(first.ownedCount,100);
assert.strictEqual(first.coveragePct,3);

let history=dashboard.mergeHistory([],first);
assert.strictEqual(history.length,1);
const sameDay=dashboard.snapshotForSummary({...summary,estimatedValue:275.50,valuedCount:4,coveragePct:4},new Date('2026-08-27T20:00:00Z'));
history=dashboard.mergeHistory(history,sameDay);
assert.strictEqual(history.length,1,'same-day collection checkpoints must update rather than duplicate');
assert.strictEqual(history[0].value,275.50);
assert.strictEqual(history[0].valuedCount,4);

const nextDay=dashboard.snapshotForSummary({...summary,estimatedValue:300},new Date('2026-08-28T12:00:00Z'));
history=dashboard.mergeHistory(history,nextDay);
assert.strictEqual(history.length,2,'later-day checkpoint should append');
assert.strictEqual(dashboard.snapshotForSummary({...summary,estimatedValue:null,valuedCount:0},new Date()),null,'empty valuation summary should not create history');

let many=[];
for(let i=0;i<80;i++){
  many=dashboard.mergeHistory(many,{at:new Date(Date.UTC(2026,0,1+i)).toISOString(),value:100+i,valuedCount:5,ownedCount:100,coveragePct:5,matchedCostBasis:null,matchedCount:0});
}
assert(many.length<=dashboard.MAX_HISTORY,'history should stay capped');

const html=fs.readFileSync('index.html','utf8');
assert(html.includes('COLLECTION_VALUE_HISTORY_META_KEY="__scoutCollectionValueHistoryV1"'),'durable metadata key must exist');
assert(html.includes('id="dashboardCollectionHistoryChart"'),'dashboard collection history chart must render');
assert(html.includes('collectionValueSaveCollectionSnapshot(now)'),'reliable refresh must save whole-collection checkpoint');
assert(html.includes('if(purchaseValueSaved)collectionValueSaveCollectionSnapshot(purchaseValueNow)'),'reliable purchase valuation must save whole-collection checkpoint');
assert(html.includes('hasCollectionHistory'),'backup import/export must preserve collection history metadata');
assert(html.includes('Opening this dashboard never triggers a marketplace search.'),'dashboard remains zero-search');

console.log('collection value history dashboard tests passed');
