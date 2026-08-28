(() => {
  const PLAYERS = Array.isArray(window.DRAFT_PLAYERS) ? window.DRAFT_PLAYERS : [];
  const KEY = "scoutFantasyDraftRoom2026V1";
  const TEAMS = 10;
  let filter = "ALL";

  function initialState(){
    return {drafted:{}, mine:[], history:[], draftSlot:""};
  }
  function load(){
    try{
      const raw=JSON.parse(localStorage.getItem(KEY)||"{}");
      return {...initialState(),...raw,drafted:raw.drafted||{},mine:Array.isArray(raw.mine)?raw.mine:[],history:Array.isArray(raw.history)?raw.history:[]};
    }catch{return initialState();}
  }
  let state=load();
  const $=id=>document.getElementById(id);
  const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
  const playerByName=name=>PLAYERS.find(p=>p.player===name);
  const available=()=>PLAYERS.filter(p=>!state.drafted[p.player]);
  const totalDrafted=()=>Object.keys(state.drafted).length;
  const roundNow=()=>Math.floor(totalDrafted()/TEAMS)+1;

  function tierNumber(tier){
    const m=String(tier||"").match(/(\d+)/); return m?Number(m[1]):99;
  }
  function tagClass(tag){
    const t=String(tag||"").toUpperCase();
    if(/FADE|CAUTION/.test(t))return "bad";
    if(/MONITOR/.test(t))return "warn";
    return "good";
  }
  function rosterCounts(){
    const counts={QB:0,RB:0,WR:0,TE:0,K:0,DEF:0};
    for(const name of state.mine){
      const p=playerByName(name); if(p&&counts[p.pos]!==undefined)counts[p.pos]++;
    }
    return counts;
  }
  function tierRemaining(p){
    return available().filter(x=>x.pos===p.pos && x.tier===p.tier).length;
  }
  function nextPickInfo(){
    const slot=Number(state.draftSlot);
    if(!slot)return null;
    const drafted=totalDrafted();
    for(let r=1;r<30;r++){
      const overall=(r%2===1)?((r-1)*TEAMS+slot):(r*TEAMS-slot+1);
      if(overall>drafted)return {overall,away:Math.max(0,overall-drafted-1),round:r};
    }
    return null;
  }
  function scorePlayer(p){
    const r=roundNow(), counts=rosterCounts();
    let s=135-Number(p.rank||150);
    const tag=String(p.tag||"").toUpperCase();
    if(tag.includes("ELITE"))s+=12;
    if(tag.includes("TARGET"))s+=8;
    if(tag.includes("VALUE"))s+=6;
    if(tag.includes("GOOD PICK"))s+=3;
    if(tag.includes("UPSIDE"))s+=2;
    if(tag.includes("MONITOR"))s-=3;
    if(tag.includes("CAUTION"))s-=5;
    if(tag.includes("FADE"))s-=12;

    const remain=tierRemaining(p);
    if(remain===1)s+=13; else if(remain===2)s+=8; else if(remain===3)s+=4;

    if(r<=3){
      if(p.pos==="RB"&&counts.RB<2)s+=10;
      if(p.pos==="WR"&&counts.WR<1)s+=5;
      if(p.pos==="QB")s-=13;
      if(p.pos==="TE"&&!tag.includes("ELITE TE"))s-=8;
    }else if(r<=6){
      if(p.pos==="RB"&&counts.RB<2)s+=8;
      if(p.pos==="WR"&&counts.WR<2)s+=7;
      if((p.pos==="RB"||p.pos==="WR")&&(counts.RB+counts.WR<5))s+=3;
      if(p.pos==="QB"&&counts.QB===0)s+=1;
      if(p.pos==="TE"&&counts.TE===0)s+=2;
    }else if(r<=10){
      if(p.pos==="QB"&&counts.QB===0)s+=7;
      if(p.pos==="TE"&&counts.TE===0)s+=5;
      if(p.pos==="RB"||p.pos==="WR")s+=3;
    }else{
      if(p.pos==="QB"&&counts.QB===0)s+=8;
      if(p.pos==="TE"&&counts.TE===0)s+=6;
    }
    if((p.pos==="K"||p.pos==="DEF")&&r<14)s-=60;
    if(String(p.injury||"").includes("PUP"))s-=5;
    else if(p.injury)s-=2;

    const next=nextPickInfo();
    if(next && next.away>=5 && remain<=2)s+=4;
    return Math.round(s);
  }
  function reasons(p){
    const reasons=[], r=roundNow(), counts=rosterCounts(), remain=tierRemaining(p);
    const tag=String(p.tag||"").toUpperCase();
    if(remain===1)reasons.push(`Last ${p.pos} left in ${p.tier}`);
    else if(remain===2)reasons.push(`Only 2 ${p.pos}s remain in ${p.tier}`);
    if(r<=3&&p.pos==="RB"&&counts.RB<2)reasons.push("Early RB scarcity fits our plan");
    if(r<=6&&p.pos==="WR"&&counts.WR<2)reasons.push("Helps fill the WR core");
    if(p.pos==="QB"&&r<5)reasons.push("QB value is good, but Scout still prefers waiting");
    if(tag.includes("TARGET"))reasons.push("Scout target at this cost");
    else if(tag.includes("VALUE"))reasons.push("Value versus current draft price");
    else if(tag.includes("ELITE"))reasons.push("Elite talent / positional edge");
    if(p.injury)reasons.push(`Health flag: ${p.injury}`);
    if(!reasons.length&&p.note)reasons.push(p.note);
    return reasons.slice(0,2).join(" · ");
  }
  function verdict(p,index){
    const tag=String(p.tag||"").toUpperCase(), remain=tierRemaining(p);
    if(index===0&&remain<=2)return "🔥 SMASH PICK";
    if(tag.includes("TARGET"))return "✅ TARGET";
    if(tag.includes("VALUE"))return "💰 VALUE";
    if(tag.includes("CAUTION")||tag.includes("MONITOR"))return "⚠️ WATCH";
    return index===0?"✅ SCOUT'S PICK":"GOOD OPTION";
  }

  function markDrafted(name,isMine){
    if(state.drafted[name])return;
    state.drafted[name]=isMine?"mine":"other";
    if(isMine&&!state.mine.includes(name))state.mine.push(name);
    state.history.push({type:"draft",name,isMine});
    save(); render();
  }
  function undo(){
    const action=state.history.pop(); if(!action)return;
    if(action.type==="draft"){
      delete state.drafted[action.name];
      state.mine=state.mine.filter(x=>x!==action.name);
    }
    save();render();
  }
  function resetDraft(){
    if(!confirm("Reset every drafted player and your roster?"))return;
    const slot=state.draftSlot;
    state=initialState(); state.draftSlot=slot; save();render();
  }

  function renderTopFive(){
    const list=available().map(p=>({...p,_score:scorePlayer(p)})).sort((a,b)=>b._score-a._score||a.rank-b.rank).slice(0,5);
    $("topFive").innerHTML=list.length?list.map((p,i)=>`
      <div class="pick-card">
        <div class="pick-num">${i+1}</div>
        <div>
          <div class="pick-name">${p.player}</div>
          <div class="pick-meta">${p.team} · ${p.pos} · ${p.tier} · Rank ${p.rank}</div>
          <div class="pick-reason">${reasons(p)}</div>
        </div>
        <div><div class="pick-score">${p._score}</div><div class="pick-verdict">${verdict(p,i)}</div></div>
      </div>`).join(""):`<div class="empty-state">No players remain on the board.</div>`;
    $("scoutCall").textContent=list[0]?`Scout's pick: ${list[0].player}`:"Draft complete";
  }

  function renderAlerts(){
    const counts=rosterCounts(), r=roundNow(), pool=available();
    const groups=new Map();
    for(const p of pool){
      const key=`${p.pos}|${p.tier}`;
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(p);
    }
    const alerts=[];
    for(const [key,group] of groups){
      if(group.length<=2){
        const [pos,tier]=key.split("|");
        if(tierNumber(tier)<=7)alerts.push({priority:group.length===1?1:2,text:`<strong>${pos} ${tier}:</strong> <span>${group.length===1?"ONE":"TWO"} left — ${group.map(x=>x.player).join(", ")}</span>`});
      }
    }
    if(r<=3&&counts.RB<2)alerts.push({priority:0,text:`<strong>Roster:</strong> <span>You have ${counts.RB} RB. Our plan is to leave Round 3 with two when value is fair.</span>`});
    if(r>=7&&counts.QB===0)alerts.push({priority:0,text:`<strong>QB:</strong> <span>You still need a QB. This is the range where Scout starts attacking value.</span>`});
    if(r>=7&&counts.TE===0)alerts.push({priority:1,text:`<strong>TE:</strong> <span>Still open. Take value, not desperation.</span>`});
    if(r<13)alerts.push({priority:5,text:`<strong>K / DEF:</strong> <span>Keep waiting. Save those slots for the end.</span>`});
    alerts.sort((a,b)=>a.priority-b.priority);
    $("alerts").innerHTML=alerts.slice(0,5).map(a=>`<div class="alert">${a.text}</div>`).join("");
  }

  function renderRoster(){
    const slotDefs=[
      ["QB",1],["RB",1],["RB",2],["WR",1],["WR",2],["TE",1],["FLEX",1],["K",1],["DEF",1],
      ["BENCH",1],["BENCH",2],["BENCH",3],["BENCH",4],["BENCH",5],["BENCH",6]
    ];
    const players=state.mine.map(playerByName).filter(Boolean);
    const used=new Set();
    const slots=[];
    function take(pos){
      const idx=players.findIndex((p,i)=>!used.has(i)&&p.pos===pos);
      if(idx>=0){used.add(idx);return players[idx];} return null;
    }
    for(const [label,n] of slotDefs){
      let p=null;
      if(["QB","RB","WR","TE","K","DEF"].includes(label))p=take(label);
      else if(label==="FLEX"){
        for(const pos of ["RB","WR","TE"]){p=take(pos);if(p)break;}
      }else{
        const idx=players.findIndex((x,i)=>!used.has(i));if(idx>=0){used.add(idx);p=players[idx];}
      }
      slots.push({label:label+(n>1?` ${n}`:""),p});
    }
    $("rosterGrid").innerHTML=slots.map(s=>`<div class="roster-slot ${s.p?"":"empty"}"><div class="slot">${s.label}</div><div class="name">${s.p?`${s.p.player}<br><span class="pmeta">${s.p.team} · ${s.p.pos}</span>`:"—"}</div></div>`).join("");
    $("rosterCount").textContent=`${state.mine.length} player${state.mine.length===1?"":"s"}`;
  }

  function renderBoard(){
    const q=$("searchInput").value.trim().toLowerCase();
    const list=available().filter(p=>(filter==="ALL"||p.pos===filter)&&(!q||`${p.player} ${p.team} ${p.pos}`.toLowerCase().includes(q))).slice(0,100);
    $("playerBoard").innerHTML=list.length?list.map(p=>`
      <div class="player-row">
        <div class="rank">${p.rank}</div>
        <div><div class="pname">${p.player}</div><div class="pmeta">${p.team} · ${p.pos} · Bye ${p.bye||"—"}${p.injury?` · ${p.injury}`:""}</div></div>
        <div class="tier">${p.tier}</div>
        <div class="tag ${tagClass(p.tag)}">${p.tag}</div>
        <div class="note">${p.note||p.window||""}</div>
        <div class="row-actions">
          <button class="mine-btn" data-mine="${encodeURIComponent(p.player)}">MY TEAM</button>
          <button class="draft-btn" data-drafted="${encodeURIComponent(p.player)}">DRAFTED</button>
        </div>
      </div>`).join(""):`<div class="empty-state">No available players match that filter.</div>`;
    document.querySelectorAll("[data-mine]").forEach(b=>b.onclick=()=>markDrafted(decodeURIComponent(b.dataset.mine),true));
    document.querySelectorAll("[data-drafted]").forEach(b=>b.onclick=()=>markDrafted(decodeURIComponent(b.dataset.drafted),false));
  }

  function renderHeader(){
    $("roundText").textContent=`Round ${roundNow()} · Pick ${totalDrafted()+1}`;
    $("pickCounter").textContent=`${totalDrafted()} drafted`;
    const next=nextPickInfo();
    $("nextPickText").textContent=next?`Your next pick: #${next.overall} · ${next.away===0?"YOU'RE UP":`${next.away} pick${next.away===1?"":"s"} away`}`:"Set your slot to show picks until you're up.";
    $("draftSlot").value=state.draftSlot||"";
  }

  function render(){
    renderHeader();renderTopFive();renderAlerts();renderRoster();renderBoard();
  }

  $("draftSlot").onchange=e=>{state.draftSlot=e.target.value;save();render();};
  $("undoBtn").onclick=undo;
  $("resetBtn").onclick=resetDraft;
  $("searchInput").oninput=renderBoard;
  $("positionFilters").querySelectorAll("button").forEach(btn=>btn.onclick=()=>{
    filter=btn.dataset.pos;
    $("positionFilters").querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===btn));
    renderBoard();
  });

  render();
})();
