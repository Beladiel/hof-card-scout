const assert=require('assert');
const chart=require('../collection-value-chart.js');

assert.strictEqual(chart.buildModel([]),null,'empty history should not invent a chart');

const one=chart.buildModel([{at:'2026-08-27T12:00:00.000Z',value:100,cardKey:'abc'}]);
assert(one,'one real snapshot should produce a chart model');
assert.strictEqual(one.points.length,1);
assert.strictEqual(one.first.value,100);
assert.strictEqual(one.delta.amount,0);
assert(Number.isFinite(one.points[0].x)&&Number.isFinite(one.points[0].y));

const many=chart.buildModel([
  {at:'2026-08-27T12:00:00.000Z',value:100,cardKey:'abc'},
  {at:'2026-09-10T12:00:00.000Z',value:115,cardKey:'abc'},
  {at:'2026-10-05T12:00:00.000Z',value:90,cardKey:'abc'}
]);
assert.strictEqual(many.points.length,3);
assert.strictEqual(many.delta.amount,-10);
assert.strictEqual(many.delta.pct,-10);
assert(many.path.startsWith('M')&&many.path.includes('L'),'multi-point history should create a line path');
assert.strictEqual(many.grid.length,3);
assert(many.points[0].x<many.points[1].x&&many.points[1].x<many.points[2].x,'dates should progress left to right');

const dirty=chart.cleanRows([
  {at:'bad-date',value:20},
  {at:'2026-08-29T12:00:00.000Z',value:0},
  {at:'2026-08-28T12:00:00.000Z',value:80},
  {at:'2026-08-27T12:00:00.000Z',value:70}
]);
assert.deepStrictEqual(dirty.map(x=>x.value),[70,80],'invalid history rows should be ignored and dates sorted');

console.log('collection value chart model tests passed');
