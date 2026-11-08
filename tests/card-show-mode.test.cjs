const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const show=require("../card-show.js");
const report=require("../shopping-report.js");
const h=show.helpers;
const html=fs.readFileSync("index.html","utf8");
const source=fs.readFileSync("card-show.js","utf8");

const target={name:"Hank Aaron",owned:false,target:"1965 Topps #170",targetYear:1965,targetSet:"Topps",targetCardNum:"170",targetMaxPrice:80};
const needed={name:"Babe Ruth",owned:false,target:""};
const incoming={name:"Yogi Berra",owned:true,incoming:true,target:""};
const upgrade={name:"Willie Mays",owned:true,target:"1954 Topps #90",targetYear:1954,targetSet:"Topps",targetCardNum:"90",set:"Topps",cardYear:1962,cardNum:"300"};
const plain={name:"Cal Ripken Jr.",owned:true,set:"Fleer",cardYear:1982,cardNum:"176"};

test("Card Show only shows targets and needs by default; guards incoming duplicates",()=>{
  assert.deepEqual(h.showRows([needed,incoming,plain,upgrade,target],"hunt","").map(p=>p.name),["Hank Aaron","Willie Mays","Babe Ruth"]);
  assert.deepEqual(h.showRows([needed,incoming,plain,upgrade,target],"incoming","").map(p=>p.name),["Yogi Berra"]);
  assert.deepEqual(h.showRows([needed,incoming,plain,upgrade,target],"targets","").map(p=>p.name),["Hank Aaron","Willie Mays"]);
  assert.deepEqual(h.showRows([needed,incoming,plain,upgrade,target],"needs","babe").map(p=>p.name),["Babe Ruth"]);
});

test("Card Show needs, targets, and inventory sort by surname, not first name",()=>{
  const a={name:"Yogi Berra",last:"Berra",owned:false,target:"1958 Topps #370"};
  const b={name:"Babe Ruth",last:"Ruth",owned:false,target:""};
  const c={name:"Cal Ripken Jr.",last:"Ripken",owned:false,target:""};
  const d={name:"Lou Gehrig",last:"Gehrig",owned:false,target:"1933 Goudey"};
  const result=h.showRows([c,b,d,a],"needs","").map(p=>p.name);
  assert.deepEqual(result,["Yogi Berra","Lou Gehrig","Cal Ripken Jr.","Babe Ruth"]);
  assert.deepEqual(h.showRows([d,a],"targets","").map(p=>p.name),["Yogi Berra","Lou Gehrig"]);
  const withoutLast=[{name:"Cal Ripken Jr.",owned:false},{name:"Tony Gwynn",owned:false}];
  assert.deepEqual(h.showRows(withoutLast,"needs","").map(p=>p.name),["Tony Gwynn","Cal Ripken Jr."]);
  const inventory=h.documentedRows([
    {name:"Babe Ruth",last:"Ruth",owned:true},
    {name:"Yogi Berra",last:"Berra",owned:true}
  ],()=>"",{});
  assert.deepEqual(inventory.map(p=>p.player),["Yogi Berra","Babe Ruth"]);
});

test("Live price check prefill uses target identity, not the owned card",()=>{
  const p=h.prefill(upgrade);
  assert.equal(p.name,"Willie Mays");
  assert.equal(p.cardYear,1954);
  assert.equal(p.cardNum,"90");
  assert.equal(p.set,"Topps");
  assert.notEqual(p.cardYear,upgrade.cardYear);
  assert.equal(h.prefill(needed).name,"Babe Ruth");
});

test("Show haul includes only current representative purchases for this visit",()=>{
  const purchases=[
    {name:"A",owned:true,purchaseDate:"2026-11-14",purchaseSource:"Card show: 505 Card Show",pricePaid:20},
    {name:"B",owned:true,purchaseDate:"2026-11-14",purchaseSource:"Card show: 505 Card Show",pricePaid:null},
    {name:"C",owned:true,purchaseDate:"2026-11-14",purchaseSource:"eBay: Store",pricePaid:30},
    {name:"D",owned:true,purchaseDate:"2026-11-13",purchaseSource:"Card show: 505 Card Show",pricePaid:50},
    {name:"E",owned:true,purchaseDate:"2026-11-14",purchaseSource:"Card show: Other Show",pricePaid:60}
  ];
  const haul=h.purchaseHaul(purchases,{name:"505 Card Show",date:"2026-11-14"});
  assert.equal(haul.count,2);
  assert.equal(haul.spent,20);
  assert.equal(haul.unknown,1);
});

test("Insurance-style documentation distinguishes costs from reliable exact-card estimates",()=>{
  const cards=[
    {name:"Hank Aaron",owned:true,cardYear:1965,set:"Topps",cardNum:"170",grader:"PSA",gradeCondition:"5",pricePaid:45,median:100,comps:4,confidence:"medium",valuationCardKey:"correct",purchaseSource:"Card show: A",valuationUpdatedAt:"2026-11-01T12:00:00Z"},
    {name:"Yogi Berra",owned:true,cardYear:1961,set:"Topps",cardNum:"425",pricePaid:null,median:300,comps:5,confidence:"high",valuationCardKey:"previous-card"},
    {name:"Bob Feller",owned:true,cardYear:1951,set:"Bowman",cardNum:"30",pricePaid:20,median:80,comps:1,confidence:"low",valuationCardKey:"correct"},
    {name:"Not owned",owned:false,pricePaid:50}
  ];
  const rows=h.documentedRows(cards,()=> "correct",{"Hank Aaron":{hasPhoto:true,checkedAt:"2026-11-06"}});
  const totals=h.docsSummary(rows);
  assert.equal(rows.length,3);
  assert.equal(totals.withCost,2);
  assert.equal(totals.spent,65);
  assert.equal(totals.withValue,1);
  assert.equal(totals.tracked,100);
  assert.equal(totals.withPhoto,1);
  assert.equal(rows.find(r=>r.player==="Hank Aaron").photo,"Verified in cloud");
  assert.equal(rows.find(r=>r.player==="Yogi Berra").estimatedValue,null);
  assert.equal(rows.find(r=>r.player==="Bob Feller").estimatedValue,null);
  assert.match(rows.find(r=>r.player==="Yogi Berra").issues.join(" "),/Cost unknown/);
  assert.equal(h.currentValue(cards[0],()=> "wrong"),null);
});

test("Exports are real workbook bytes and safe CSV (not photo files)",()=>{
  const rows=h.documentedRows([{
    name:"=Potential Formula",owned:true,cardYear:1950,set:"Topps",cardNum:"1",pricePaid:20,
    valuationCardKey:"",userNotes:"+Treat as text",purchaseDate:"2026-11-01"
  }],()=> "",{});
  const sheets=h.workbookSheets(rows);
  assert.deepEqual(sheets.map(x=>x.name),["Owned Inventory","Review Needed","Notes"]);
  assert.match(sheets[2].rows.find(r=>r[0]==="Photos")[1],/NOT embedded/);
  const bytes=report.buildWorkbook(sheets);
  assert.equal(bytes[0],80);
  assert.equal(bytes[1],75);
  assert.ok(bytes.length>1000);
  const csv=h.csvText(rows);
  assert.ok(csv.charCodeAt(0)===0xFEFF);
  assert.match(csv,/"'=Potential Formula"/);
  assert.match(csv,/"'\+Treat as text"/);
});

test("New interface reuses live sold-comps, Smart Buy, and Card show purchase handoff",()=>{
  new vm.Script(source);
  const m=html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(m);
  new vm.Script(m[1]);
  assert.match(html,/card-show\.js\?v=/);
  assert.match(html,/ScoutCardShow\.init\(/);
  assert.match(html,/openCheck:\(p,asking\)=>\{openShop\(p\)/);
  assert.match(html,/shopReturnScreen==="cardShowScreen"[^]*?\$\("phase3aSource"\)\.value="Card show"/);
  assert.match(html,/const targets=smartBuyTargets\(data\)/);
  assert.match(html,/fetch\(c\.endpoint\+"\/value"/);
  assert.match(html,/p\.purchaseSource=fields\.sourceDetail/);
  assert.match(source,/photos are not embedded/i);
});
