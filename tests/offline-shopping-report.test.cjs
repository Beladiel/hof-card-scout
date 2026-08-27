const assert=require("node:assert/strict");
const fs=require("node:fs");
const report=require("../shopping-report.js");

function storedZipEntries(bytes){
  const b=Buffer.from(bytes),out=new Map();
  let off=0;
  while(off+30<=b.length&&b.readUInt32LE(off)===0x04034b50){
    const method=b.readUInt16LE(off+8);
    const size=b.readUInt32LE(off+18);
    const nameLen=b.readUInt16LE(off+26),extraLen=b.readUInt16LE(off+28);
    assert.equal(method,0,"shopping workbook ZIP should use dependency-free store mode");
    const name=b.subarray(off+30,off+30+nameLen).toString("utf8");
    const start=off+30+nameLen+extraLen,end=start+size;
    out.set(name,b.subarray(start,end));
    off=end;
  }
  return out;
}

const sheets=[
  {name:"Hunt Sheet",title:"HOF Card Scout — Offline Hunt Sheet",subtitle:"Generated test",headers:["STATUS","PLAYER","MAX"],rows:[["TARGET","Sandy Koufax",{value:25,type:"number",style:"money"}],["NEED","Pete Hill",""]],widths:[20,25,15],orientation:"landscape"},
  {name:"Need List",title:"Need",subtitle:"Official Hall",headers:["PLAYER"],rows:[["Pete Hill"]],widths:[25],orientation:"portrait"},
  {name:"Target List",title:"Targets",subtitle:"Hall + Future",headers:["PLAYER"],rows:[["Buster Posey"]],widths:[25],orientation:"landscape"},
  {name:"Incoming",title:"Incoming",subtitle:"Do not rebuy",headers:["PLAYER"],rows:[["Dave Bancroft"]],widths:[25],orientation:"landscape"}
];
const bytes=report.buildWorkbook(sheets,{creator:"HOF Card Scout",now:new Date("2026-08-27T12:00:00Z")});
assert.equal(bytes[0],0x50);assert.equal(bytes[1],0x4b);
const entries=storedZipEntries(bytes);
for(const name of ["[Content_Types].xml","_rels/.rels","docProps/core.xml","docProps/app.xml","xl/workbook.xml","xl/_rels/workbook.xml.rels","xl/styles.xml","xl/sharedStrings.xml","xl/worksheets/sheet1.xml","xl/worksheets/sheet4.xml"]){
  assert.ok(entries.has(name),"missing XLSX part "+name);
}
const workbook=entries.get("xl/workbook.xml").toString("utf8");
assert.match(workbook,/sheet name="Hunt Sheet"/);assert.match(workbook,/sheet name="Need List"/);assert.match(workbook,/sheet name="Target List"/);assert.match(workbook,/sheet name="Incoming"/);
assert.match(workbook,/_xlnm\.Print_Titles/);

const rels=entries.get("xl/_rels/workbook.xml.rels").toString("utf8");
assert.match(rels,/relationships\/sharedStrings/);
const contentTypes=entries.get("[Content_Types].xml").toString("utf8");
assert.match(contentTypes,/sharedStrings\.xml/);

const shared=entries.get("xl/sharedStrings.xml").toString("utf8");
for(const text of ["HOF Card Scout — Offline Hunt Sheet","STATUS","PLAYER","TARGET","Sandy Koufax","NEED","Pete Hill","Buster Posey","Dave Bancroft"]){
  assert.ok(shared.includes(text),"shared-string table missing "+text);
}

const hunt=entries.get("xl/worksheets/sheet1.xml").toString("utf8");
assert.match(hunt,/fitToWidth="1"/);assert.match(hunt,/state="frozen"/);assert.match(hunt,/t="s"/);assert.match(hunt,/<v>25<\/v>/);
assert.ok(hunt.indexOf("<sheetData>")<hunt.indexOf("<autoFilter"),"sheetData must precede autoFilter");
assert.ok(hunt.indexOf("<autoFilter")<hunt.indexOf("<mergeCells"),"autoFilter must precede mergeCells for Excel worksheet schema order");
assert.ok(entries.get("xl/styles.xml").toString("utf8").includes('$#,##0.00'));

const html=fs.readFileSync("index.html","utf8");
assert.match(html,/v5\.9\.1/);
assert.match(html,/id="dataShoppingReportBtn"/);
assert.match(html,/OFFLINE SHOPPING REPORT \(\.XLSX\)/);
assert.match(html,/<script src="shopping-report\.js"><\/script>/);
assert.match(html,/function shoppingReportBuildSheets\(\)/);
assert.match(html,/PLAYERS\.filter\(p=>!p\.owned&&!p\.incoming\)/);
assert.match(html,/PLAYERS\.filter\(p=>!!p\.target&&!p\.incoming\)/);
assert.match(html,/function shoppingReportFutureTargets\(\)/);
assert.match(html,/Future HOF targets do not count toward Hall completion/);
assert.match(html,/function exportShoppingReport\(\)/);
assert.match(html,/dataShoppingReportBtn[\s\S]*exportShoppingReport\(\)/);
assert.match(html,/HOF-Card-Scout-Shopping-Report-/);

const fnBlock=html.match(/function exportShoppingReport\(\)\{[\s\S]*?\n\}\n\nfunction openDataMenu/);
assert.ok(fnBlock,"exportShoppingReport function block missing");
assert.doesNotMatch(fnBlock[0],/fetch\s*\(/,"offline report must not spend a marketplace/API search");

console.log("Offline shopping report tests passed.");
