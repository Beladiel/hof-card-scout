const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const src=fs.readFileSync(path.join(root,"app.js"),"utf8");
const academySrc=fs.readFileSync(path.join(root,"academy.js"),"utf8");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const css=fs.readFileSync(path.join(root,"styles.css"),"utf8");
const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
const manifest=JSON.parse(fs.readFileSync(path.join(root,"manifest.webmanifest"),"utf8"));
const m={exports:[]};vm.runInNewContext(academySrc,{module:m});
const lessons=m.exports;

function openStudio(seed){
 const storage=new Map(seed?Object.entries(seed):[]),callbacks={},view={innerHTML:"",textContent:"",classList:{toggle(){},add(){},remove(){}},addEventListener(){}};
 const window={PaintAcademy:lessons,scrollTo(){},addEventListener(name,fn){callbacks[name]=fn;}};
 const doc={readyState:"loading",body:{addEventListener(){}},addEventListener(name,fn){callbacks[name]=fn;},getElementById(){return view;},querySelectorAll(){return []}};
 const loc={hash:""},context={window,document:doc,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},navigator:{},location:loc,crypto:{randomUUID:()=>"seed-id"},setTimeout(){},clearTimeout(){},confirm(){return true;},console:{warn(){},log(){}}};
 vm.runInNewContext(src,context);
 return {storage,callbacks,view,loc,async ready(){await callbacks.DOMContentLoaded();},page(route){loc.hash="#"+route;callbacks.hashchange();return view.innerHTML;}};
}
test("Academy has substantial lesson guidance for signature techniques",()=>{
 assert.equal(lessons.length,13);
 assert.deepEqual(new Set(lessons.map(l=>l.id)).size,lessons.length);
 for(const id of ["leather","fire","eyes","steel","skin","cloth","washes","drybrush","primer","varnish"]){
  const lesson=lessons.find(l=>l.id===id);
  assert.ok(lesson,"Missing lesson "+id);
  assert.ok(lesson.steps.length>=4,"Lesson is too short: "+id);
  assert.ok(lesson.paints.length>=2);
  assert.ok(lesson.tip&&lesson.mistake);
 }
});
test("First visit creates editable Nova Aetas project without guessed paints",async()=>{
 const app=openStudio();await app.ready();
 const state=JSON.parse(app.storage.get("miniPaintStudioV1"));
 assert.equal(state.miniatures.length,1);
 assert.equal(state.miniatures[0].game,"Nova Aetas Renaissance");
 assert.equal(state.miniatures[0].name,"Dual-Axe Warrior");
 assert.equal(state.miniatures[0].status,"Unpainted");
 assert.equal(state.paints.length,0);
 assert.match(app.view.innerHTML,/Nova Aetas Renaissance/);
});
test("All major pages and technique lesson render without exception",async()=>{
 const app=openStudio();await app.ready();
 for(const [route,needle] of [
  ["home","At the Workbench"],["projects","My Miniatures"],["mini/nova-warrior","Painting Journal"],
  ["inspiration/nova-warrior","Art-to-Mini Lab"],["academy","Painting Academy"],
  ["lesson/leather","Worn Brown Leather"],["paints","My Paint Rack"],["backup","Backup & Restore"]
 ]){
  const page=app.page(route);assert.ok(page.includes(needle),"Missing "+needle+" in "+route);
 }
});
test("Photo storage, export, import and privacy boundaries are explicit",()=>{
 assert.match(src,/const DB_NAME="miniPaintStudioPhotosV1"/);
 assert.match(src,/const PHOTO_SLOTS=\["before","reference","concept","finished"\]/);
 assert.match(src,/async function exportBackup/);
 assert.match(src,/async function importBackup/);
 assert.match(src,/await photoClear\(\)/);
 assert.match(src,/photos\[photoKey\(p.id,slot\)\]=await fileToDataUrl\(blob\)/);
 assert.match(src,/AI Horde/i);
 assert.match(html,/academy\.js\?v=4/);
 assert.match(html,/app\.js\?v=4/);
 assert.match(html,/styles\.css\?v=4/);
 assert.match(sw,/mini-paint-studio-shell-v4/);
 assert.equal(manifest.start_url,"./");
 assert.ok(css.includes("@media(max-width:550px)"));
});
test("User-entered miniature names are HTML-escaped in page views",async()=>{
 const attack="Mini <img src=x onerror=alert(1)>";
 const safe={version:1,miniatures:[{id:"x",name:attack,game:"Game",type:"Hero",status:"Unpainted",journal:[],steps:[]}],paints:[],lessonProgress:{}};
 const app=openStudio({miniPaintStudioV1:JSON.stringify(safe)});await app.ready();
 const page=app.page("projects");
 assert.ok(page.includes("&lt;img src=x onerror=alert(1)&gt;"));
 assert.ok(!page.includes(attack));
});
test("Free in-app AI image-to-image is wired with clear privacy boundaries",async()=>{
 assert.match(src,/source_processing:"img2img"/);
 assert.match(src,/source_image:source/);
 assert.match(src,/https:\/\/aihorde\.net\/api\/v2/);
 assert.match(src,/apikey":"0000000000"/);
 assert.match(src,/await photoSet\(p\.id,"concept",painted\)/);
 assert.match(src,/volunteer machines/);
 assert.doesNotMatch(src,/X-Scout-Key/);
 assert.match(src,/no account or Scout Cloud synchronization/i);
 const app=openStudio();await app.ready();
 const inspiration=app.page("inspiration/nova-warrior");
 assert.match(inspiration,/generatePaintPreview/);
 assert.match(inspiration,/Surprise Me!/);
 assert.match(inspiration,/No artwork card required/);
});

test("Paint with Scout copies a ready-to-paste prompt into the same conversation",async()=>{
 const app=openStudio();await app.ready();
 const page=app.page("inspiration/nova-warrior");
 assert.match(page,/Paint with Scout/);
 assert.match(page,/copyScoutRequest/);
 assert.match(page,/scoutPromptText/);
 assert.match(page,/Save Original Photo/);
 assert.match(page,/Return to our existing chat/);
 assert.match(page,/importScoutPreview/);
 assert.match(page,/ADD SAVED PAINTED PREVIEW/);
 assert.doesNotMatch(page,/openScoutChat/);
 assert.doesNotMatch(page,/shareScoutMini/);
 assert.doesNotMatch(page,/href="https:\/\/chatgpt\.com/);
 assert.match(src,/function scoutPaintPrompt/);
 assert.match(src,/function updateScoutPrompt/);
 assert.match(src,/if\(el\.id==="scoutStyle"\)/);
 assert.match(src,/if\(e\.target\.id==="scoutNotes"\)/);
 assert.ok(src.includes('photoTarget=p.id+"|concept"'));
 assert.doesNotMatch(src,/window\.open\("https:\/\/chatgpt\.com\//);
});
