const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const worker=fs.readFileSync('src/index.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const ui=fs.readFileSync('automation-runner-ui.js','utf8');

assert.match(worker,/const VERSION = "3\.30\.0"/);
assert.match(worker,/AUTOMATION_CATALOG_KEY = "automation:catalog:v1"/);
assert.match(worker,/url\.pathname === "\/automation\/catalog"/);
assert.match(worker,/url\.pathname === "\/automation\/run-once"/);
assert.match(worker,/function runOneAutomationTargetCheck|async function runOneAutomationTargetCheck/);
assert.match(worker,/maxQueries: 1/,'protected runner must explicitly cap target discovery to one query');
assert.match(worker,/Number\(maxQueries\) > 0 \? queries\.slice/,'shared target search must honor an explicit query cap');
assert.match(worker,/scheduled\s*\(/,'target-only cron should now be enabled');
assert.match(worker,/dueOnly: true/,'scheduled target checks must honor cadence before spending');
assert.match(worker,/collectionRunnerEnabled: false/,'collection rotation must remain disabled in this gate');
assert.match(html,/automation-runner-ui\.js/);
assert.match(ui,/RUN ONE SAFE TARGET CHECK/);
assert.match(ui,/SYNC CATALOG · 0 SEARCHES/);
assert.match(ui,/\/automation\/catalog/);
assert.match(ui,/\/automation\/run-once/);

const context={console,URL,URLSearchParams,Request,Response,Headers,AbortController,fetch,setTimeout,clearTimeout,TextEncoder,TextDecoder};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(worker.replace('export default','const workerDefault =')+`
const automationOriginals={runActiveEbaySearch};
globalThis.runnerApi={
  searchMonthlyPickListing,
  setActiveSearch(fn){runActiveEbaySearch=fn;},
  reset(){runActiveEbaySearch=automationOriginals.runActiveEbaySearch;}
};`,context,{filename:'src/index.js'});

(async()=>{
  const calls=[];
  context.runnerApi.setActiveSearch(async query=>{calls.push(query);return {organic_results:[]};});
  try{
    await context.runnerApi.searchMonthlyPickListing({
      player:'Sandy Koufax',budget:80,mode:'need',currentCard:null,excludeIds:[],preferredSellers:[],apiKey:'private-key',purpose:'target',searchHint:'1965 Topps #300 PSA 5',futureHof:false,maxQueries:1
    });
    assert.equal(calls.length,1,'safe target check may make only one active SerpApi search even when no listing is found');
  } finally { context.runnerApi.reset(); }
  console.log('Safe automation runner tests passed.');
})().catch(err=>{console.error(err);process.exitCode=1;});
