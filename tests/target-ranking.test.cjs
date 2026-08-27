const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("src/index.js", "utf8");
const context = { console, URL, URLSearchParams, Request, Response, Headers, AbortController, fetch, setTimeout, clearTimeout };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source.replace("export default", "const workerDefault =") + `
const rankingOriginals = { searchMonthlyPickListing, targetRecommendationMarketCheck };
globalThis.rankingApi = {
  workerDefault,
  VERSION, VALUATION_CACHE_VERSION, TARGET_RANKING_VERSION,
  monthlyPickRepresentationInfo, monthlyPickRejectReason, monthlyPickSellerTrust,
  targetBuildCandidateShortlist, targetRankingAlternative, targetShouldMarketCheckAlternative,
  targetChooseRecommendation, targetFinalizeSelection, normalizeActiveEbayResult,
  setRouteMocks(searchResult, marketFn) {
    searchMonthlyPickListing = async () => searchResult;
    targetRecommendationMarketCheck = marketFn;
  },
  resetRouteMocks() {
    searchMonthlyPickListing = rankingOriginals.searchMonthlyPickListing;
    targetRecommendationMarketCheck = rankingOriginals.targetRecommendationMarketCheck;
  }
};`, context, { filename: "src/index.js" });
const api = context.rankingApi;

const market = label => ({ rated: true, label });
function candidate({ year, title, condition=60, delivered=20, seller=82, id=String(Math.random()) }) {
  return {
    id, title, year, delivered, price: delivered, shipping: 0, condition: "Pre-Owned", link: "https://ebay.test/" + id,
    conditionInfo: { ok: true, score: condition, label: condition < 45 ? "Low grade" : condition >= 84 ? "NM" : condition >= 68 ? "EX" : "VG" },
    sellerTrust: { ok: true, score: seller, label: seller >= 100 ? "PREFERRED" : "STRONG" },
    traits: {}, traitScore: 0, gradeInfo: { grader: "Raw", grade: null, label: "Raw" }, upgrade: null
  };
}
function suggestion(c, player="Sandy Koufax") {
  const [ranked] = api.targetBuildCandidateShortlist([c], 100, "need", player);
  return { ...ranked, representation: ranked.representationInfo, rankingVersion: 1, ranking: ranked.ranking, why: "Base reason." };
}
function choose(oldCard, newCard, oldVerdict, newVerdict) {
  const ranked = api.targetBuildCandidateShortlist([oldCard, newCard], 100, "need", "Sandy Koufax");
  const primary = { ...ranked[0], representation: ranked[0].representationInfo, marketCheck: market(oldVerdict) };
  const altRaw = ranked.find(x => x.id === newCard.id);
  const alt = { ...altRaw, representation: altRaw.representationInfo, marketCheck: market(newVerdict) };
  return api.targetChooseRecommendation(primary, alt);
}

async function test(name, fn) {
  try { await fn(); console.log("✓", name); }
  catch (err) { console.error("✗", name); throw err; }
}

(async () => {
  await test("ranking and cache versions are independent", () => {
    assert.equal(api.VERSION, "3.31.0");
    assert.equal(api.TARGET_RANKING_VERSION, 1);
    assert.equal(api.VALUATION_CACHE_VERSION, 1);
  });
  await test("1961 low-grade shared versus 1962 EX individual can choose 1962", () => {
    const old = candidate({ id:"old", year:1961, title:"1961 Topps League Leaders Sandy Koufax Don Drysdale", condition:30 });
    const newer = candidate({ id:"new", year:1962, title:"1962 Topps #5 Sandy Koufax EX", condition:76 });
    assert.equal(choose(old,newer,"FAIR / NEGOTIATE","FAIR / NEGOTIATE").id,"new");
  });
  await test("1961 VG individual remains ahead of 1962 NM without a major problem", () => {
    const old = candidate({ id:"old", year:1961, title:"1961 Topps #344 Sandy Koufax VG", condition:60 });
    const newer = candidate({ id:"new", year:1962, title:"1962 Topps #5 Sandy Koufax NM", condition:90 });
    assert.equal(choose(old,newer,"FAIR / NEGOTIATE","BUY").id,"old");
  });
  await test("1961 individual PASS versus comparable 1962 BUY can choose 1962", () => {
    const old = candidate({ id:"old", year:1961, title:"1961 Topps #344 Sandy Koufax EX", condition:76 });
    const newer = candidate({ id:"new", year:1962, title:"1962 Topps #5 Sandy Koufax EX", condition:76 });
    assert.equal(choose(old,newer,"PASS","BUY").id,"new");
  });
  await test("newer qualifying cards remain visible while age keeps the older card ahead", () => {
    const old = candidate({ id:"old", year:1961, title:"1961 Topps Sandy Koufax VG", delivered:50 });
    const newer = candidate({ id:"new", year:1963, title:"1963 Topps Sandy Koufax NM", condition:94, delivered:5 });
    const list = api.targetBuildCandidateShortlist([old,newer],100,"need","Sandy Koufax");
    assert.deepEqual(Array.from(list, x=>x.id),["old","new"]);
  });
  await test("same-year GREAT BUY can beat a comparable PASS", () => {
    const first = suggestion(candidate({ id:"pass", year:1961, title:"1961 Topps Sandy Koufax VG", condition:60 }));
    const second = suggestion(candidate({ id:"great", year:1961, title:"1961 Topps Sandy Koufax EX", condition:68 }));
    first.marketCheck=market("PASS"); second.marketCheck=market("GREAT BUY");
    assert.equal(api.targetChooseRecommendation(first,second).id,"great");
  });
  await test("shared Koufax/Gibson/Drysdale is eligible and classified shared", () => {
    const title="1963 Topps #5 Sandy Koufax Bob Gibson Don Drysdale HOF Vintage Baseball Card";
    assert.equal(api.monthlyPickRepresentationInfo(title,"Sandy Koufax").type,"shared");
    const item={title,format:"buy_it_now",shipping:1.85,delivered:15.85,condition:"Pre-Owned",seller:{username:"trusted",reviews:1000,positivePct:99.8}};
    assert.equal(api.monthlyPickRejectReason(item,"Sandy Koufax",100,"need",null,[]).reason,"");
  });
  await test("team card and 5x7 photo remain rejected", () => {
    const base={format:"buy_it_now",shipping:0,delivered:15,condition:"Pre-Owned",seller:{username:"trusted",reviews:1000,positivePct:99.8}};
    assert.match(api.monthlyPickRejectReason({...base,title:"1962 Topps DODGERS TEAM #43 Sandy Koufax"},"Sandy Koufax",100,"need",null,[]).reason,/Team card/i);
    assert.match(api.monthlyPickRejectReason({...base,title:"1962 Sandy Koufax 5x7 Vintage Picture"},"Sandy Koufax",100,"need",null,[]).reason,/Not a single/i);
  });
  await test("previous trusted seller retains its advantage", () => {
    const item={seller:{username:"known-shop",reviews:25,positivePct:99}};
    const prior=api.monthlyPickSellerTrust(item,["known-shop"]);
    assert.equal(prior.ok,true); assert.equal(prior.previousSeller,true); assert.ok(prior.score>100);
  });
  await test("strong clean oldest choice skips a second market check", () => {
    const primary=suggestion(candidate({year:1961,title:"1961 Topps Sandy Koufax EX",condition:76,seller:92}));
    const alt=suggestion(candidate({year:1962,title:"1962 Topps Sandy Koufax NM",condition:90,seller:92}));
    primary.marketCheck=market("BUY");
    assert.equal(api.targetShouldMarketCheckAlternative(primary,alt),false);
  });
  await test("route performs no second market check for a strong clean oldest choice", async () => {
    const primary=suggestion(candidate({id:"old",year:1961,title:"1961 Topps Sandy Koufax EX",condition:76,seller:92}));
    const alt=suggestion(candidate({id:"new",year:1962,title:"1962 Topps Sandy Koufax NM",condition:90,seller:92}));
    let calls=0;
    api.setRouteMocks({suggestion:primary,_targetShortlist:[primary,alt]},async()=>{calls++;return market("BUY");});
    const req=new Request("https://worker.test/find-target",{method:"POST",headers:{"Content-Type":"application/json","X-Scout-Key":"key"},body:JSON.stringify({player:"Sandy Koufax",budget:100,mode:"need"})});
    const res=await api.workerDefault.fetch(req,{SCOUT_ACCESS_KEY:"key",SERPAPI_KEY:"serp"});
    assert.equal(res.status,200); assert.equal(calls,1);
    api.resetRouteMocks();
  });
  await test("shortlist returns up to five while route performs at most two market checks", async () => {
    const rows=[0,1,2,3,4].map((n)=>candidate({id:String(n),year:1961+(n?1:0),title:`${1961+(n?1:0)} Topps Sandy Koufax ${n}`}));
    const ranked=api.targetBuildCandidateShortlist(rows,100,"need","Sandy Koufax").map(x=>({ ...x, representation:x.representationInfo }));
    assert.equal(ranked.length,5);
    ranked[0].conditionInfo.score=30;
    let calls=0;
    api.setRouteMocks({suggestion:ranked[0],_targetShortlist:ranked},async()=>{calls++;return market("PASS");});
    const req=new Request("https://worker.test/find-target",{method:"POST",headers:{"Content-Type":"application/json","X-Scout-Key":"key"},body:JSON.stringify({player:"Sandy Koufax",budget:100,mode:"need"})});
    const res=await api.workerDefault.fetch(req,{SCOUT_ACCESS_KEY:"key",SERPAPI_KEY:"serp"});
    assert.equal(res.status,200); assert.equal(calls,2);
    const body=await res.json();
    assert.equal(body.suggestions.length,5);
    assert.deepEqual(body.suggestions.map(x=>x.rank),[1,2,3,4,5]);
    api.resetRouteMocks();
  });
  await test("Top 5 can span more than one year beyond the oldest qualifying card", () => {
    const rows=[1961,1962,1963,1964,1965,1966].map((year,i)=>candidate({id:String(i),year,title:`${year} Topps Sandy Koufax`,condition:68,delivered:20+i}));
    const list=api.targetBuildCandidateShortlist(rows,100,"need","Sandy Koufax");
    assert.equal(list.length,5);
    assert.equal(list[0].year,1961);
    assert.ok(list.some(x=>x.year>=1963));
  });
  await test("Monthly Pick retains its established oldest-first branch", () => {
    assert.match(source,/Monthly Pick deliberately keeps its established oldest-first ordering/);
    assert.match(source,/purpose === "target" \? \(targetCandidates\[0\]/);
  });
  await test("ZIP shipping arithmetic remains exact", () => {
    const row=api.normalizeActiveEbayResult({product_id:"397088803039",title:"1963 Topps #5 Sandy Koufax",price:{extracted:14},shipping:{extracted:1.85},link:"https://ebay.test/397088803039"});
    assert.equal(row.delivered,15.85);
  });

  const html=fs.readFileSync("index.html","utf8");
  const comparisonBlock=html.match(/function findTargetSanitizedSummary[\s\S]*?(?=async function searchFindTarget)/);
  await test("Try Another comparison reports established year, condition, and price changes", () => {
    const ui={}; vm.createContext(ui); vm.runInContext(comparisonBlock[0]+"\nthis.compare=findTargetComparison;",ui);
    const text=ui.compare({year:1961,conditionScore:30,representation:"shared",sellerScore:80,delivered:20,marketVerdict:"PASS"},{year:1962,conditionInfo:{score:76,label:"EX"},representation:{type:"individual"},sellerTrust:{},ranking:{components:{sellerTrust:80}},delivered:15.8,marketCheck:{label:"BUY"}});
    assert.match(text,/1 year newer/); assert.match(text,/cleaner condition/); assert.match(text,/\$4\.20 less delivered/);
  });
  console.log("All target ranking tests passed.");
})().catch(()=>process.exitCode=1);
