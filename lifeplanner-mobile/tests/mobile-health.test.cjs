const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const root=path.resolve(__dirname,".."),appSrc=fs.readFileSync(path.join(root,"app.js"),"utf8"),
 index=fs.readFileSync(path.join(root,"index.html"),"utf8"),
 sw=fs.readFileSync(path.join(root,"sw.js"),"utf8"),
 style=fs.readFileSync(path.join(root,"styles.css"),"utf8"),
 manifest=JSON.parse(fs.readFileSync(path.join(root,"manifest.webmanifest"),"utf8"));
function open(seed={}){
 const records=new Map(Object.entries(seed)),listeners={},elements={};
 const el=id=>elements[id]||(elements[id]={innerHTML:"",textContent:"",classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return null;},focus(){},setSelectionRange(){}});
 const doc={readyState:"loading",getElementById:el,querySelectorAll(){return [];},querySelector(){return null;},
  addEventListener(n,fn){listeners[n]=fn;}};
 const window={addEventListener(n,fn){listeners["window:"+n]=fn;}};
 const location={hash:"#dashboard"};
 const localStorage={getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)};
 const saved=[],URL={createObjectURL(){return "blob:mock";},revokeObjectURL(){}};
 const document=doc;document.body={appendChild(){}};
 document.createElement=type=>type==="a"?{click(){saved.push({download:this.download});},remove(){}}:{className:"",textContent:"",after(){}};
 const code=appSrc.replace("if(document.readyState===\"loading\")",
   "window.__test={normalizeEvent,validDay,eventKey,fromTimeField,toTimeField,applyImport,pcBackup,mobileBackup,getState:()=>state,setImport:r=>{pendingImport=r}};if(document.readyState===\"loading\")");
 vm.runInNewContext(code,{document,window,location,localStorage,URL,navigator:{},crypto:{randomUUID:()=>Math.random().toString(36)},confirm:()=>true,console:{warn(){},log(){}},Date,Math,Blob,FormData,Number,
  setTimeout(){return 1;},clearTimeout(){}});
 return {window,records,listeners,elements,saved,async ready(){await listeners.DOMContentLoaded();},page(section){location.hash="#"+section;listeners["window:hashchange"]();return el("content").innerHTML;}};
}
const event=(id,title,day="2027-02-10",category="Vacation",completed=false)=>({id,title,day,category,time:"09:30 AM",notes:"",remind_days:3,completed,alerted_on:""});
test("PWA is standalone, local-first and matches original Windows categories",()=>{
 assert.match(index,/LifePlanner Mobile/);
 assert.match(index,/app\.js\?v=1/);
 assert.match(sw,/lifeplanner-mobile-shell-v1/);
 assert.match(style,/@media\(max-width:640px\)/);
 assert.equal(manifest.display,"standalone");
 assert.match(appSrc,/"Vacation","Milestone","Doctor","School","Personal","Other"/);
 assert.match(appSrc,/LifePlanner1/);
 assert.match(appSrc,/LifePlannerMobile1/);
 assert.doesNotMatch(appSrc,/Supabase|supabaseUrl|service_role/);
});
test("Fresh mobile install has no invented appointments or travel",async()=>{
 const a=open();await a.ready();
 const data=JSON.parse(a.records.get("LifePlannerMobileV1"));
 assert.equal(data.events.length,0);
 assert.match(a.page("dashboard"),/Make room for what matters/);
 assert.match(a.page("dashboard"),/Vacations/);
 assert.match(a.page("dashboard"),/School deadlines/);
 assert.match(a.page("sync"),/Import PC Backup/);
});
test("Existing phone records retain notes, completed status and reminder settings",async()=>{
 const state={version:1,events:[event("a","A vacation"),event("b","Finish CNM lab","2027-01-11","School",true)],settings:{showAllTiles:true}};
 state.events[0].notes="Remember passport";state.events[0].remind_days=14;
 const a=open({LifePlannerMobileV1:JSON.stringify(state)});await a.ready();
 const saved=JSON.parse(a.records.get("LifePlannerMobileV1"));
 assert.equal(saved.events.length,2);
 assert.equal(saved.events[0].notes,"Remember passport");
 assert.equal(saved.events[0].remind_days,14);
 assert.equal(saved.events[1].completed,true);
 assert.match(a.page("completed"),/Finish CNM lab/);
 assert.match(a.page("dashboard"),/A vacation/);
});
test("Windows SQLite export shape imports without losing event fields",async()=>{
 const a=open();await a.ready();
 const imported=[
  event(91,"Doctor visit","2026-11-11","Doctor"),
  event(92,"Python SLO","2026-12-08","School",true)];
 imported[1].notes="Completed assignment";imported[1].remind_days=-1;
 const clean=imported.map(x=>a.window.__test.normalizeEvent(x,true));
 assert.equal(clean[0].id,"pc:91");
 assert.equal(clean[1].remind_days,-1);
 assert.equal(clean[1].notes,"Completed assignment");
 a.window.__test.setImport({events:clean,kind:"Windows LifePlanner",settings:null});
 a.window.__test.applyImport("replace");
 const saved=JSON.parse(a.records.get("LifePlannerMobileV1")).events;
 assert.equal(saved.length,2);assert.equal(saved[1].completed,true);
 assert.equal(saved[0].day,"2026-11-11");
 assert.match(a.page("completed"),/Python SLO/);
});
test("Merge never overwrites a locally edited event with same identifying details",async()=>{
 const old=event("local","Vacation","2027-02-10","Vacation");
 old.notes="Our private itinerary";old.completed=true;
 const a=open({LifePlannerMobileV1:JSON.stringify({version:1,events:[old],settings:{showAllTiles:true}})});
 await a.ready();
 const replacement=event(1,"Vacation","2027-02-10","Vacation");replacement.notes="From an older PC export";
 const added=event(2,"School deadline","2027-03-01","School");
 a.window.__test.setImport({events:[a.window.__test.normalizeEvent(replacement,true),a.window.__test.normalizeEvent(added,true)],kind:"Windows",settings:null});
 a.window.__test.applyImport("merge");
 const saved=JSON.parse(a.records.get("LifePlannerMobileV1")).events;
 assert.equal(saved.length,2);
 assert.equal(saved.find(e=>e.title==="Vacation").notes,"Our private itinerary");
 assert.equal(saved.find(e=>e.title==="Vacation").completed,true);
 assert.equal(saved.find(e=>e.title==="School deadline").category,"School");
});
test("Replace stores an on-device rollback snapshot and does not touch PC",async()=>{
 const a=open({LifePlannerMobileV1:JSON.stringify({version:1,events:[event("old","Local old event")],settings:{showAllTiles:false}})});await a.ready();
 const newEvents=[a.window.__test.normalizeEvent(event(4,"New import"),true)];
 a.window.__test.setImport({events:newEvents,kind:"Windows",settings:null});
 a.window.__test.applyImport("replace");
 const backup=JSON.parse(a.records.get("LifePlannerMobilePreImport"));
 assert.equal(backup.data.events[0].title,"Local old event");
 const saved=JSON.parse(a.records.get("LifePlannerMobileV1"));
 assert.equal(saved.events[0].title,"New import");
 assert.equal(saved.settings.showAllTiles,false);
});
test("A corrupted primary record uses a safety copy without silently resetting",async()=>{
 const saved={version:1,events:[event("keep","Saved appointment","2027-02-10","Doctor")],settings:{showAllTiles:true}};
 const a=open({LifePlannerMobileV1:"{broken",LifePlannerMobileV1Safety:JSON.stringify(saved)});await a.ready();
 assert.match(a.page("dashboard"),/Recovered from the on-device safety copy/);
 assert.match(a.page("dashboard"),/Saved appointment/);
 assert.equal(JSON.parse(a.records.get("LifePlannerMobileV1")).events.length,1);
});
test("If both storage copies are invalid, no saved values are overwritten",async()=>{
 const a=open({LifePlannerMobileV1:"{bad",LifePlannerMobileV1Safety:"[bad"});await a.ready();
 assert.equal(a.records.get("LifePlannerMobileV1"),"{bad");
 assert.equal(a.records.get("LifePlannerMobileV1Safety"),"[bad");
 assert.match(a.page("dashboard"),/Storage needs recovery/);
});
test("Invalid dates and malformed categories cannot enter the planner",async()=>{
 const a=open();await a.ready();
 assert.equal(a.window.__test.validDay("2026-02-30"),false);
 assert.equal(a.window.__test.validDay("2028-02-29"),true);
 assert.throws(()=>a.window.__test.normalizeEvent(event(1,"Wrong","2026-13-01"),true),/invalid name/);
 assert.throws(()=>a.window.__test.normalizeEvent(event(1,"Wrong","2027-01-01","Made-up Category"),true),/invalid name/);
 assert.equal(a.window.__test.toTimeField("09:30 PM"),"21:30");
 assert.equal(a.window.__test.fromTimeField("21:30"),"09:30 PM");
});
test("No user events are embedded in public source or sent to a server",()=>{
 assert.doesNotMatch(appSrc,/\bfetch\s*\(/);
 assert.doesNotMatch(appSrc,/\bXMLHttpRequest\b/);
 assert.doesNotMatch(appSrc,/2027-02-10|Our private itinerary|Remember passport/);
});
