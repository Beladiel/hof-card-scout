const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const worker=fs.readFileSync('src/index.js','utf8');
const ui=fs.readFileSync('automation-runner-ui.js','utf8');

assert.match(worker,/const VERSION = "3\.31\.0"/);
assert.match(worker,/function runOneAutomationCollectionCheck|async function runOneAutomationCollectionCheck/);
assert.match(worker,/kind === "collection"/,'run-once must support the explicit collection safety gate');
assert.match(worker,/collectionRunnerEnabled: false/,'unattended collection rotation must remain off during this gate');
assert.match(worker,/collectionCardsChecked/,'collection rotation must have its own monthly card counter');
assert.match(worker,/AUTOMATION_COLLECTION_MIN_GAP_MS = 3 \* 24 \* 60 \* 60 \* 1000/,'collection checks must be spaced by at least three days');
assert.match(worker,/AUTOMATION_COLLECTION_TIMEOUT_COOLDOWN_MS = 7 \* 24 \* 60 \* 60 \* 1000/,'timeouts must trigger a seven-day collection cooldown');
assert.match(worker,/collectionCooldownUntil/,'timeout cooldown must persist in automation state');
assert.match(worker,/function automationReliableCollectionValuation/);
assert.match(worker,/valuationEvidenceCount\(value\)/,'collection reliability must count usable sold evidence');
assert.match(worker,/confidence !== "insufficient"/,'collection reliability must reject insufficient evidence');
assert.match(ui,/RUN ONE SAFE COLLECTION CHECK/);
assert.match(ui,/kind:"collection"/);

const start=worker.indexOf('async function runOneAutomationCollectionCheck');
const end=worker.indexOf('async function runScheduledTargetMonitor',start);
assert.ok(start>0&&end>start,'collection safety runner block must be present');
const block=worker.slice(start,end);
assert.match(block,/readValuationCache\(card, true\)/,'fresh fast cache must be checked first');
assert.match(block,/runEbaySearch\(query, env\.SERPAPI_KEY, "Sold", false, SERP_SOLD_STRICT_TIMEOUT_MS\)/,'cache miss must use one strict sold search');
assert.doesNotMatch(block,/buildBroadSoldQuery|runEbaySearchAsync|searchCardApi|searchApify|valueCard|getValuationWithCache/,'safe collection runner must not fan out to broad/Card API/Apify paths');

const period=new Date().toISOString().slice(0,7);
const soldDate=new Date(Date.now()-2*24*60*60*1000).toISOString();
const catalog={schema:1,generatedAt:new Date().toISOString(),official:[{
  kind:'official',name:'Jeff Bagwell',owned:true,incoming:false,cardYear:1991,set:'Topps Traded',cardNum:'4T',grader:'PSA',gradeCondition:'9',autograph:false,relic:false,serial:'',cardKey:'bagwell-test'
}],future:[]};
const baseState={settings:{monthlySerpCap:30,targetMonitoringEnabled:true,targetCadenceDays:7,collectionRefreshEnabled:true,collectionCardsPerMonth:10},usage:{period,serpSuccessful:0,cardApiRequests:0,apifyRuns:0,collectionCardsChecked:0},alerts:[],targetChecks:{},collectionChecks:{},collectionCooldownUntil:''};
function freshState(){return {...baseState,settings:{...baseState.settings},usage:{...baseState.usage},targetChecks:{},collectionChecks:{},collectionCooldownUntil:''};}

function makeContext(cacheMode='miss'){
  const fetchCalls=[];
  const cachePuts=[];
  const cachedResult={
    provider:'eBay sold results via SerpApi',query:'cached',searchMode:'Sold',matchMode:'strict',searched:2,matched:2,used:2,providerDiagnostics:{},notes:[],median:15,low:14,high:16,min:14,max:16,confidence:'low',verdictTier:'value_only',comps:[{id:'c1',title:'1991 Topps Traded Jeff Bagwell #4T PSA 9 baseball card',price:14,soldDate},{id:'c2',title:'1991 Topps Traded Jeff Bagwell #4T PSA 9 baseball card',price:16,soldDate}],checkedAt:new Date().toISOString(),mode:'fast',bestOfferRecovered:0,bestOfferRecoveryAttempted:0,cachePolicy:'fresh for 6 hours',cacheHit:false
  };
  const caches={default:{
    async match(){
      if(cacheMode!=='hit')return null;
      return new Response(JSON.stringify({schemaVersion:1,cachedAt:new Date().toISOString(),result:cachedResult}),{headers:{'Content-Type':'application/json'}});
    },
    async put(key,value){cachePuts.push([key,value]);}
  }};
  const fakeFetch=async()=>{
    fetchCalls.push(1);
    if(cacheMode==='timeout')throw new Error('SerpApi search timed out after 10s.');
    return new Response(JSON.stringify({search_metadata:{status:'Success'},organic_results:[
      {product_id:'s1',title:'1991 Topps Traded Jeff Bagwell #4T baseball card PSA 9',price:'$14.00',sold_date:soldDate,link:'https://example.test/1'},
      {product_id:'s2',title:'1991 Topps Traded Jeff Bagwell #4T baseball card PSA 9',price:'$16.00',sold_date:soldDate,link:'https://example.test/2'}
    ]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  const context={console,URL,URLSearchParams,Request,Response,Headers,AbortController,fetch:fakeFetch,setTimeout,clearTimeout,TextEncoder,TextDecoder,caches};
  context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(worker.replace('export default','const workerDefault =')+`\nglobalThis.collectionRunnerApi={runOneAutomationCollectionCheck};`,context,{filename:'src/index.js'});
  return {context,fetchCalls,cachePuts};
}

(async()=>{
  {
    const {context,fetchCalls}=makeContext('miss');
    const run=await context.collectionRunnerApi.runOneAutomationCollectionCheck({SERPAPI_KEY:'private-key'},freshState(),catalog,new Date());
    assert.equal(fetchCalls.length,1,'cache miss must spend exactly one SerpApi request');
    assert.equal(run.result.searchUsed,1);
    assert.equal(run.result.saved,true,'two clean exact comps should pass the collection reliability gate');
    assert.equal(run.result.valuation.used,2);
    assert.equal(run.state.usage.serpSuccessful,1);
    assert.equal(run.state.usage.collectionCardsChecked,1);
  }
  {
    const {context,fetchCalls}=makeContext('hit');
    const run=await context.collectionRunnerApi.runOneAutomationCollectionCheck({SERPAPI_KEY:'private-key'},freshState(),catalog,new Date());
    assert.equal(fetchCalls.length,0,'fresh cache must cost zero SerpApi searches');
    assert.equal(run.result.searchUsed,0);
    assert.equal(run.result.cacheHit,true);
    assert.equal(run.result.saved,true);
    assert.equal(run.state.usage.serpSuccessful,0);
    assert.equal(run.state.usage.collectionCardsChecked,1);
  }
  {
    const {context,fetchCalls}=makeContext('miss');
    const recentState=freshState();
    recentState.collectionChecks['official|jeff bagwell|bagwell-test']=new Date().toISOString();
    const run=await context.collectionRunnerApi.runOneAutomationCollectionCheck({SERPAPI_KEY:'private-key'},recentState,catalog,new Date());
    assert.equal(fetchCalls.length,0,'recent collection attempt must trigger pacing with zero additional searches');
    assert.equal(run.result.searchUsed,0);
    assert.equal(run.result.status,'skipped');
    assert.match(run.result.message,/pacing itself/i);
  }
  {
    const {context,fetchCalls}=makeContext('timeout');
    const run=await context.collectionRunnerApi.runOneAutomationCollectionCheck({SERPAPI_KEY:'private-key'},freshState(),catalog,new Date());
    assert.equal(fetchCalls.length,1,'timeout path must still stop after the one allowed SerpApi request');
    assert.equal(run.result.searchUsed,1);
    assert.equal(run.result.status,'error');
    assert.ok(run.state.collectionCooldownUntil,'timeout must persist a cooldown');
    assert.match(run.result.message,/paused collection-value automation for 7 days/i);
  }
  console.log('Safe collection automation runner tests passed.');
})().catch(err=>{console.error(err);process.exitCode=1;});
