const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const worker=fs.readFileSync('src/index.js','utf8');
assert.match(worker,/COLLECTION_VALUE_HISTORY_META_KEY = "__scoutCollectionValueHistoryV1"/);
assert.match(worker,/async function automationPersistScheduledValuation/);
assert.match(worker,/await kv\.put\(COLLECTION_KV_KEY, serialized\)/,'scheduled reliable values must persist to cloud collection data');
assert.match(worker,/await writeAutomationCatalog\(kv, updatedCatalog\)/,'automation catalog must also retain the new valuation');
assert.match(worker,/clientUpdatedAt: at/,'scheduled cloud change must be visible as newer to the browser sync');
assert.match(worker,/valuationCardKey: catalogEntry\.valuationCardKey/,'scheduled patch must remain tied to the exact representative card');
assert.match(worker,/automationMergeCollectionHistory\(meta\.history, collectionSnapshot, 48\)/,'scheduled valuation must build overall collection checkpoints');

const context={console,URL,URLSearchParams,Request,Response,Headers,AbortController,fetch:async()=>{throw new Error('network should not be needed')},setTimeout,clearTimeout,TextEncoder,TextDecoder,caches:{default:{match:async()=>null,put:async()=>{}}}};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(worker.replace('export default','const workerDefault =')+`\nglobalThis.cronPersistApi={automationPersistScheduledValuation};`,context,{filename:'src/index.js'});

const store=new Map();
const kv={
  async get(key,opts){const v=store.get(key);if(v==null)return null;return opts&&opts.type==='json'?JSON.parse(v):v;},
  async put(key,value){store.set(key,typeof value==='string'?value:JSON.stringify(value));}
};
const catalog={schema:1,generatedAt:new Date(0).toISOString(),official:[{kind:'official',name:'Jeff Bagwell',owned:true,incoming:false,cardYear:1991,set:'Topps Traded',cardNum:'4T',grader:'PSA',gradeCondition:'9',autograph:false,relic:false,serial:'',cardKey:'bagwell-test',median:null,low:null,high:null,comps:null,confidence:'',lastChecked:'',valuationUpdatedAt:'',valuationCardKey:'',valuationHistory:[],target:'',targetNotes:'',targetYear:null,targetSet:'',targetCardNum:'',targetGrader:'Any / Raw OK',targetGrade:'',targetAutoPreference:'No preference',targetMaxPrice:null,targetListingUrl:'',targetSource:'',targetUpdatedAt:''}],future:[]};
store.set('collection:primary:v1',JSON.stringify({schema:3,savedAt:'2026-08-01T00:00:00.000Z',clientUpdatedAt:'2026-08-01T00:00:00.000Z',appVersion:'5.9.0',playerUpdates:{'Jeff Bagwell':{pricePaid:8.5}},monthlyPick:null,futureHof:null}));
const result={saved:true,card:{name:'Jeff Bagwell',cardKey:'bagwell-test'},valuation:{median:15,low:14,high:16,used:2,confidence:'low'}};
const now=new Date('2026-08-31T16:15:00.000Z');

(async()=>{
  const persisted=await context.cronPersistApi.automationPersistScheduledValuation(kv,catalog,result,now);
  assert.equal(persisted.ok,true);
  const cloud=JSON.parse(store.get('collection:primary:v1'));
  const patch=cloud.playerUpdates['Jeff Bagwell'];
  assert.equal(patch.median,15);
  assert.equal(patch.valuationCardKey,'bagwell-test');
  assert.equal(patch.valuationHistory.length,1);
  assert.equal(patch.valuationHistory[0].value,15);
  assert.equal(patch.pricePaid,8.5,'scheduled valuation must preserve purchase history');
  const overall=cloud.playerUpdates['__scoutCollectionValueHistoryV1'];
  assert.ok(overall&&Array.isArray(overall.history));
  assert.equal(overall.history.length,1);
  assert.equal(overall.history[0].value,15);
  assert.equal(overall.history[0].matchedCostBasis,8.5);
  assert.equal(cloud.clientUpdatedAt,now.toISOString());
  const savedCatalog=JSON.parse(store.get('automation:catalog:v1'));
  assert.equal(savedCatalog.official[0].median,15);
  assert.equal(savedCatalog.official[0].valuationCardKey,'bagwell-test');
  console.log('Scheduled collection valuation persistence tests passed.');
})().catch(err=>{console.error(err);process.exitCode=1;});
