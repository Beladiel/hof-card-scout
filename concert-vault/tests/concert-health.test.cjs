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
 assert.match(index,/app\.js\?v=3/);
 assert.match(sw,/encore-shell-v3/);
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
 assert.match(a.page("pick"),/PICK FROM ALL CONCERTS/);
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

test("Cover Helper is integrated without moving photos to GitHub",async()=>{
 const saved={version:1,discs:[
  {id:"one",artist:"The Who",title:"Live at Isle of Wight",status:"Owned",format:"Blu-ray"},
  {id:"two",artist:"Blue Öyster Cult",title:"A Long Day's Night",status:"Owned",format:"DVD"}
 ]};
 const a=app({encoreConcertVaultV1:JSON.stringify(saved)});await a.start();
 const view=a.page("covers");
 assert.match(view,/Cover Helper/);
 assert.match(view,/CHOOSE MULTIPLE PHOTOS/);
 assert.match(view,/TAKE ONE PHOTO/);
 assert.match(view,/SAVED|saved/);
 assert.match(view,/not on GitHub/);
 assert.match(a.elements.coverQueue.innerHTML,/No photos waiting to be matched/);
 assert.match(view,/Local photo storage/);
 assert.match(view,/BACKUP MY COLLECTION/);
 assert.match(index,/data-nav="covers"/);
 assert.match(index,/id="coverBatchPicker"[^>]*multiple/);
 assert.match(index,/id="coverCameraPicker"[^>]*capture="environment"/);
 assert.match(source,/indexedDB.open\(DB_NAME,1\)/);
 assert.match(source,/coverPut\(q.target,q.blob\)/);
 assert.match(source,/Math.min\(1,maxEdge\//);
 assert.match(source,/photoCompressed\(file,720,.78\)/);
 assert.match(source,/navigator.storage.estimate\(\)/);
 assert.doesNotMatch(source,/\bfetch\(["']https?:/);
 const unchanged=JSON.parse(a.records.get("encoreConcertVaultV1")).discs;
 assert.equal(unchanged.length,2);
 assert.equal(unchanged[0].id,"one");
 assert.equal(unchanged[1].id,"two");
});
test("Cover Helper UI is included in the actual disc collection",async()=>{
 const a=app();await a.start();
 const html=a.page("collection");
 assert.match(html,/COVER HELPER/);
 assert.match(a.page("covers"),/Still needs cover art/);
 assert.match(a.page("backup"),/DOWNLOAD COMPLETE BACKUP/);
 assert.match(index,/v1.2/);
});
test("Stored untrusted concert names are escaped in missing-cover cards",async()=>{
 const seed={version:1,discs:[{id:"x1",artist:"<script>alert(1)</script>",title:"Art & Live",format:"DVD",status:"Owned"}]};
 const a=app({encoreConcertVaultV1:JSON.stringify(seed)});
 await a.start();
 const html=a.page("covers");
 assert.doesNotMatch(html,/Missing a cover.*<script>/);
 assert.match(source,/esc\(d.artist\)/);
 assert.match(source,/esc\(d.title\)/);
});

test("Marking watched stamps a permanent date, and clearing the round preserves it",async()=>{
 const seed={version:1,discs:[
  {id:"one",artist:"Band One",title:"Show One",format:"DVD",status:"Owned",watched:false},
  {id:"two",artist:"Band Two",title:"Show Two",format:"Blu-ray",status:"Owned",watched:true,lastWatched:"2025-06-12",rating:5,favorite:true},
  {id:"three",artist:"Band Three",title:"Old Show",format:"DVD",status:"Owned",watched:true}
 ]};
 const a=app({encoreConcertVaultV1:JSON.stringify(seed)});await a.start();
 let page=a.page("pick");
 assert.match(page,/RESET WATCHED INDICATORS/);
 assert.match(page,/Last Watched dates/);
 assert.match(page,/1<\/strong> ready to pick/);
 const click=async(action,id)=>a.listeners.click({target:{closest(){return {dataset:{action,id}};}}});
 await click("watched","one");
 let data=JSON.parse(a.records.get("encoreConcertVaultV1")).discs;
 const date=data.find(x=>x.id==="one").lastWatched;
 assert.match(date,/^20\d\d-\d\d-\d\d$/);
 assert.equal(data.find(x=>x.id==="one").watched,true);
 assert.equal(data.find(x=>x.id==="two").lastWatched,"2025-06-12");
 assert.match(a.page("collection"),/Last watched: /);
 await click("reset-watched");
 data=JSON.parse(a.records.get("encoreConcertVaultV1")).discs;
 assert.deepEqual(data.map(d=>d.watched),[false,false,false]);
 assert.equal(data.find(x=>x.id==="one").lastWatched,date);
 assert.equal(data.find(x=>x.id==="two").lastWatched,"2025-06-12");
 assert.equal(data.find(x=>x.id==="two").rating,5);
 assert.equal(data.find(x=>x.id==="two").favorite,true);
 assert.equal(data.find(x=>x.id==="three").lastWatched,"","Never invent a date for legacy watched marks");
 page=a.page("pick");
 assert.match(page,/3<\/strong> ready to pick/);
 assert.match(page,/RESET WATCHED INDICATORS/);
 const reloaded=app({encoreConcertVaultV1:JSON.stringify({version:1,discs:data})});
 await reloaded.start();
 const reloadedData=JSON.parse(reloaded.records.get("encoreConcertVaultV1")).discs;
 assert.equal(reloadedData.find(x=>x.id==="one").lastWatched,date);
 assert.equal(reloadedData.find(x=>x.id==="two").lastWatched,"2025-06-12");
 assert.equal(reloadedData.find(x=>x.id==="two").watched,false);
});
test("Unmarking a single concert preserves its last-watched date",async()=>{
 const data={version:1,discs:[{id:"s",artist:"Music",title:"Live",format:"Blu-ray",status:"Owned",watched:true,lastWatched:"2024-05-21"}]};
 const a=app({encoreConcertVaultV1:JSON.stringify(data)});await a.start();
 await a.listeners.click({target:{closest(){return {dataset:{action:"watched",id:"s"}};}}});
 const saved=JSON.parse(a.records.get("encoreConcertVaultV1")).discs[0];
 assert.equal(saved.watched,false);
 assert.equal(saved.lastWatched,"2024-05-21");
 assert.match(a.page("collection"),/May 21, 2024/);
});
test("Existing entries without dates load safely; editor exposes editable history field",async()=>{
 const seed={version:1,discs:[{id:"legacy",artist:"Old",title:"Performance",format:"DVD",status:"Owned",watched:true}]};
 const a=app({encoreConcertVaultV1:JSON.stringify(seed)});await a.start();
 assert.match(a.page("collection"),/Last watched: Not recorded/);
 await a.listeners.click({target:{closest(){return {dataset:{action:"edit",id:"legacy"}};}}});
 assert.match(a.elements.modalRoot.innerHTML,/LAST WATCHED \(SAVED HISTORY\)/);
 assert.match(a.elements.modalRoot.innerHTML,/name="lastWatched" type="date"/);
 assert.match(a.elements.modalRoot.innerHTML,/WATCHED THIS ROUND/);
 assert.equal(JSON.parse(a.records.get("encoreConcertVaultV1")).discs[0].watched,true);
});
