const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const source=fs.readFileSync(path.join(root,"app.js"),"utf8");
const index=fs.readFileSync(path.join(root,"index.html"),"utf8");
const css=fs.readFileSync(path.join(root,"styles.css"),"utf8");
const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
const manifest=JSON.parse(fs.readFileSync(path.join(root,"manifest.webmanifest"),"utf8"));
function app(initial={},instrument=false){
 const records=new Map(Object.entries(initial)),listeners={},elements={};
 const node=name=>elements[name]||(elements[name]={innerHTML:"",textContent:"",classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return null;}});
 const document={readyState:"loading",getElementById:node,querySelectorAll(){return [];},addEventListener(name,fn){listeners[name]=fn;}};
 const window={addEventListener(name,fn){listeners["w:"+name]=fn;}};
 const location={hash:"#collection"};
 const localStorage={getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)};
 const context={document,window,location,localStorage,navigator:{},crypto:{randomUUID:()=>"test-unique"},setTimeout(){return 1;},clearTimeout(){},console:{warn(){},log(){}},confirm(){return true;}};
 const code=instrument?source.replace('if(document.readyState==="loading")','window.__importBatch=addBatch; if(document.readyState==="loading")'):source;
 vm.runInNewContext(code,context);
 return {records,listeners,location,window,elements,async start(){await listeners.DOMContentLoaded();},page(route){location.hash="#"+route;listeners["w:hashchange"]();return node("view").innerHTML;}};
}
test("App is fully local and independent of other hobby apps",()=>{
 assert.match(source,/encoreConcertVaultV1/);
 assert.doesNotMatch(source,/miniPaintStudioV1/);
 assert.match(index,/<title>Encore · Concert Vault<\/title>/);
 assert.match(index,/app\.js\?v=1/);
 assert.match(sw,/encore-shell-v1/);
 assert.match(css,/@media\(max-width:640px\)/);
 assert.equal(manifest.start_url,"./");
});
test("Fresh install has no invented owned discs",async()=>{
 const a=app();await a.start();const stored=JSON.parse(a.records.get("encoreConcertVaultV1"));
 assert.equal(stored.discs.length,0);
 assert.match(a.elements.view.innerHTML,/Your concert shelf is ready/);
 assert.match(a.page("wishlist"),/Your wish list is empty/);
 assert.match(a.page("backup"),/Import from Scout/);
});
test("Existing concert catalog survives a version change",async()=>{
 const seed={version:1,discs:[
 {id:"myconcert",artist:"Favorite Band",title:"Live at Home",format:"Blu-ray",status:"Owned",audio:"DTS 5.1",notes:"A personal favorite",favorite:true,rating:5},
 {id:"wish",artist:"Another Artist",title:"The Encore Tour",format:"DVD",status:"Wishlist",notes:"Wanted"}
 ]};
 const a=app({encoreConcertVaultV1:JSON.stringify(seed)});await a.start();
 const owned=a.page("collection");assert.match(owned,/Favorite Band/);assert.match(owned,/DTS 5.1/);assert.doesNotMatch(owned,/Another Artist/);
 assert.match(a.page("wishlist"),/Another Artist/);
 assert.match(a.page("pick"),/PICK MY CONCERT/);
 assert.match(a.page("backup"),/DOWNLOAD COMPLETE BACKUP/);
 assert.equal(JSON.parse(a.records.get("encoreConcertVaultV1")).discs.length,2);
});
test("Primary-data corruption can recover from safety copy",async()=>{
 const saved={version:1,discs:[{id:"abc",artist:"Live Band",title:"Special Show",status:"Owned",format:"DVD"}]};
 const a=app({encoreConcertVaultV1:"{invalid",encoreConcertVaultSafetyV1:JSON.stringify(saved)});
 await a.start();
 assert.match(a.page("collection"),/Live Band/);
 assert.match(a.page("collection"),/Recovered a previous collection/);
 assert.equal(JSON.parse(a.records.get("encoreConcertVaultV1")).discs.length,1);
});
test("Unrecoverable data never gets silently overwritten",async()=>{
 const a=app({encoreConcertVaultV1:"{invalid",encoreConcertVaultSafetyV1:"[bad"});
 await a.start();assert.equal(a.records.get("encoreConcertVaultV1"),"{invalid");
 assert.match(a.page("collection"),/Saved catalog data cannot be read/);
});
test("Scout batch merges without duplicating or guessing format",async()=>{
 const saved={version:1,discs:[{id:"a",artist:"Old Band",title:"Show One",status:"Owned",format:"DVD"}]};
 const a=app({encoreConcertVaultV1:JSON.stringify(saved)},true);await a.start();
 const batch={format:"scout-concert-batch",concerts:[
  {artist:"Old Band",title:"Show One",format:"DVD"},
  {artist:"New Band",title:"Live Tonight",status:"Owned"},
  {artist:"New Band",title:"Live Tonight",status:"Owned"}
 ]};
 const result=a.window.__importBatch(JSON.stringify(batch));
 assert.equal(result.added,1);assert.equal(result.duplicates,2);
 const records=JSON.parse(a.records.get("encoreConcertVaultV1")).discs;
 assert.equal(records.length,2);
 assert.equal(records.find(x=>x.artist==="New Band").format,"Other");
 assert.equal(records.find(x=>x.artist==="Old Band").format,"DVD");
 assert.throws(()=>a.window.__importBatch("broken"),/valid JSON/);
});
test("Stored input is properly escaped before rendering",async()=>{
 const a=app({encoreConcertVaultV1:JSON.stringify({version:1,discs:[{id:"1",artist:"The <img src=x>",title:"Concert & Friends",format:"DVD",status:"Owned"}]})});
 await a.start();const html=a.page("collection");assert.match(html,/The &lt;img src=x&gt;/);assert.doesNotMatch(html,/The <img src=x>/);
});
