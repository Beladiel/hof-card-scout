(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else{
    root.ScoutAutomationBudget=api;
    if(typeof document!=="undefined"){
      if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>api.mount());
      else api.mount();
    }
  }
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  const DEFAULTS={monthlySerpCap:30,targetMonitoringEnabled:true,targetCadenceDays:7,collectionRefreshEnabled:true,collectionCardsPerMonth:10};

  function clampInt(value,min,max,fallback){
    const n=Math.round(Number(value));
    return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
  }
  function normalizeSettings(input={}){
    return {
      monthlySerpCap:clampInt(input.monthlySerpCap,1,500,DEFAULTS.monthlySerpCap),
      targetMonitoringEnabled:input.targetMonitoringEnabled!==false,
      targetCadenceDays:clampInt(input.targetCadenceDays,1,30,DEFAULTS.targetCadenceDays),
      collectionRefreshEnabled:input.collectionRefreshEnabled!==false,
      collectionCardsPerMonth:clampInt(input.collectionCardsPerMonth,0,100,DEFAULTS.collectionCardsPerMonth),
    };
  }
  function estimateMonthlyDemand(targetCount,settings={}){
    const s=normalizeSettings(settings);
    const targets=Math.max(0,Math.floor(Number(targetCount)||0));
    const targetRuns=s.targetMonitoringEnabled?Math.ceil(30/s.targetCadenceDays)*targets:0;
    const collectionRuns=s.collectionRefreshEnabled?s.collectionCardsPerMonth:0;
    return {targetSearches:targetRuns,collectionSearches:collectionRuns,total:targetRuns+collectionRuns,hardCap:s.monthlySerpCap};
  }
  function remaining(cap,used){
    return Math.max(0,clampInt(cap,1,500,DEFAULTS.monthlySerpCap)-Math.max(0,Math.floor(Number(used)||0)));
  }
  function pct(used,cap){
    const c=Math.max(1,Number(cap)||1),u=Math.max(0,Number(used)||0);
    return Math.max(0,Math.min(100,(u/c)*100));
  }
  function targetCount(){
    let count=0;
    try{if(typeof PLAYERS!=="undefined")count+=PLAYERS.filter(p=>p&&p.target&&!p.incoming).length}catch{}
    try{if(typeof futureHofActiveTargetEntries==="function")count+=futureHofActiveTargetEntries().length}catch{}
    return count;
  }
  function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));}
  function addStyles(){
    if(document.getElementById("automationBudgetStyles"))return;
    const style=document.createElement("style");style.id="automationBudgetStyles";
    style.textContent=`
      .automation-wrap{display:grid;gap:14px}.automation-hero,.automation-card{border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.04);padding:16px}.automation-hero{background:linear-gradient(145deg,rgba(230,189,99,.12),rgba(255,255,255,.035))}.automation-title{font-size:25px;font-weight:950;letter-spacing:-.4px;margin-top:3px}.automation-sub{font-size:12px;line-height:1.55;color:var(--muted);margin-top:6px}.automation-budget-top{display:flex;gap:10px;align-items:flex-end;justify-content:space-between}.automation-big{font-size:30px;font-weight:950}.automation-budget-label{font-size:10px;font-weight:950;letter-spacing:.12em;color:var(--gold)}.automation-meter{height:12px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;margin:12px 0 7px;border:1px solid rgba(255,255,255,.05)}.automation-meter>span{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--green2),var(--gold));border-radius:999px}.automation-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.automation-mini{border:1px solid var(--line);border-radius:14px;background:rgba(0,0,0,.08);padding:12px}.automation-mini .k{font-size:9px;font-weight:950;letter-spacing:.1em;color:var(--muted)}.automation-mini .v{font-size:19px;font-weight:950;margin-top:4px}.automation-form{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.automation-form label{font-size:10px;font-weight:900;letter-spacing:.06em;color:var(--muted)}.automation-form input,.automation-form select{width:100%;margin-top:5px;min-height:44px;border-radius:12px;border:1px solid var(--line);padding:0 11px;background:#f9f4e8;color:var(--ink)}.automation-check{display:flex!important;align-items:center;gap:8px;min-height:44px;letter-spacing:0!important;color:var(--text)!important}.automation-check input{width:auto!important;margin:0!important;min-height:0!important}.automation-callout{margin-top:10px;padding:11px 12px;border-radius:13px;border:1px solid rgba(230,189,99,.32);background:rgba(230,189,99,.07);font-size:11px;line-height:1.5;color:var(--muted)}.automation-status{font-size:11px;line-height:1.5;color:var(--muted);margin-top:9px}.automation-status.ok{color:var(--green)}.automation-status.bad{color:var(--red)}.automation-audit{display:grid;gap:8px;margin-top:10px}.automation-audit-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:10px 0;border-bottom:1px solid var(--line);align-items:center}.automation-audit-row:last-child{border-bottom:0}.automation-audit-row strong{font-size:12px}.automation-audit-row span{font-size:11px;color:var(--muted)}.automation-chip{border-radius:999px;border:1px solid var(--line);padding:5px 8px;font-size:9px;font-weight:950;white-space:nowrap}.automation-chip.safe{color:#8be2b0}.automation-chip.warn{color:#f4d58a}.automation-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}
      @media(max-width:620px){.automation-grid,.automation-form,.automation-actions{grid-template-columns:1fr}.automation-title{font-size:22px}.automation-budget-top{align-items:flex-start;flex-direction:column}}
    `;
    document.head.appendChild(style);
  }
  function screenHtml(){
    return `<section class="screen" id="automationScreen">
      <button class="back" id="automationBack">← Back home</button>
      <div class="automation-wrap">
        <div class="automation-hero"><div class="section-eyebrow">⚙️ AUTOMATION & SEARCH BUDGET</div><div class="automation-title">Useful automation. No runaway searches.</div><div class="automation-sub">Scout will get a hard monthly allowance before any background runner is turned on. Manual searches stay your choice and are not charged against this automation meter.</div></div>
        <div class="automation-card">
          <div class="automation-budget-top"><div><div class="automation-budget-label">AUTOMATIC SERPAPI SEARCHES THIS MONTH</div><div class="automation-big"><span id="automationUsed">0</span> / <span id="automationCapTop">30</span></div></div><div class="automation-chip safe" id="automationEngineChip">GUARDRAILS ONLY</div></div>
          <div class="automation-meter"><span id="automationMeterFill"></span></div>
          <div class="automation-sub" id="automationRemaining">30 automatic searches remain.</div>
          <div class="automation-callout"><strong>Hard stop means hard stop.</strong> When the automatic SerpApi allowance is gone, Scout stops background checks until the next monthly period. It does not borrow from next month or switch to a more expensive search path.</div>
        </div>
        <div class="automation-card">
          <div class="section-eyebrow">PLANNED AUTOMATION</div>
          <div class="automation-form">
            <label>MONTHLY AUTOMATIC SEARCH CAP<input id="automationCap" type="number" inputmode="numeric" min="1" max="500" value="30"></label>
            <label>TARGET CHECK FREQUENCY<select id="automationTargetCadence"><option value="7">Every 7 days</option><option value="14">Every 14 days</option><option value="30">Every 30 days</option></select></label>
            <label class="automation-check"><input id="automationTargetsEnabled" type="checkbox" checked> Monitor saved targets</label>
            <label class="automation-check"><input id="automationCollectionEnabled" type="checkbox" checked> Rotate collection values</label>
            <label>COLLECTION CARDS / MONTH<input id="automationCollectionCards" type="number" inputmode="numeric" min="0" max="100" value="10"></label>
          </div>
          <div class="automation-grid" style="margin-top:12px"><div class="automation-mini"><div class="k">ACTIVE TARGETS</div><div class="v" id="automationTargetCount">0</div></div><div class="automation-mini"><div class="k">EST. MONTHLY DEMAND</div><div class="v" id="automationDemand">0</div></div></div>
          <div class="automation-sub" id="automationDemandNote"></div>
          <div class="automation-actions"><button type="button" class="primary" id="automationSave">SAVE GUARDRAILS</button><button type="button" class="ghost" id="automationReload">REFRESH STATUS</button></div>
          <div class="automation-status" id="automationStatus">Loading Scout's automation budget…</div>
        </div>
        <div class="automation-card"><div class="section-eyebrow">WHY SCOUT NEEDS A SEPARATE AUTOMATION PATH</div><div class="automation-audit">
          <div class="automation-audit-row"><div><strong>Fast representative-card value refresh</strong><br><span>Fresh 6-hour cache costs zero; otherwise the SerpApi leg starts at most one sold search.</span></div><div class="automation-chip safe">0–1</div></div>
          <div class="automation-audit-row"><div><strong>Manual Deep value refresh</strong><br><span>Can broaden sold discovery when the strict search is empty.</span></div><div class="automation-chip warn">UP TO 3</div></div>
          <div class="automation-audit-row"><div><strong>Manual Find a Target</strong><br><span>Discovery plus sold-market checks can fan out. Great manually; too expensive for a background loop.</span></div><div class="automation-chip warn">UP TO 6</div></div>
          <div class="automation-audit-row"><div><strong>Planned target monitor</strong><br><span>One strict active-listing search maximum per target check. No broad retry and no automatic sold-comps enrichment.</span></div><div class="automation-chip safe">MAX 1</div></div>
          <div class="automation-audit-row"><div><strong>Planned collection rotation</strong><br><span>Fast valuation only; one SerpApi search maximum per card, then stop at the monthly cap.</span></div><div class="automation-chip safe">MAX 1 / CARD</div></div>
        </div></div>
      </div>
    </section>`;
  }

  let latestState={settings:DEFAULTS,usage:{serpSuccessful:0},runnerEnabled:false};
  function readForm(){return normalizeSettings({monthlySerpCap:document.getElementById("automationCap")?.value,targetMonitoringEnabled:document.getElementById("automationTargetsEnabled")?.checked,targetCadenceDays:document.getElementById("automationTargetCadence")?.value,collectionRefreshEnabled:document.getElementById("automationCollectionEnabled")?.checked,collectionCardsPerMonth:document.getElementById("automationCollectionCards")?.value});}
  function renderDemand(){
    const settings=readForm(),targets=targetCount(),d=estimateMonthlyDemand(targets,settings);
    const targetEl=document.getElementById("automationTargetCount"),demandEl=document.getElementById("automationDemand"),note=document.getElementById("automationDemandNote");
    if(targetEl)targetEl.textContent=String(targets);
    if(demandEl)demandEl.textContent=String(d.total);
    if(note)note.textContent=d.total>settings.monthlySerpCap
      ?`Planned demand is about ${d.total} one-search checks/month, but Scout would stop at your ${settings.monthlySerpCap}-search hard cap.`
      :`Planned demand is about ${d.total} one-search checks/month (${d.targetSearches} target + ${d.collectionSearches} collection), at or below your ${settings.monthlySerpCap}-search cap.`;
  }
  function renderState(state){
    latestState=state||latestState;
    const s=normalizeSettings(latestState.settings||DEFAULTS),used=Math.max(0,Number(latestState.usage?.serpSuccessful)||0);
    document.getElementById("automationCap").value=s.monthlySerpCap;
    document.getElementById("automationTargetCadence").value=String(s.targetCadenceDays);
    document.getElementById("automationTargetsEnabled").checked=s.targetMonitoringEnabled;
    document.getElementById("automationCollectionEnabled").checked=s.collectionRefreshEnabled;
    document.getElementById("automationCollectionCards").value=s.collectionCardsPerMonth;
    document.getElementById("automationUsed").textContent=String(used);
    document.getElementById("automationCapTop").textContent=String(s.monthlySerpCap);
    document.getElementById("automationMeterFill").style.width=pct(used,s.monthlySerpCap).toFixed(1)+"%";
    document.getElementById("automationRemaining").textContent=remaining(s.monthlySerpCap,used)+" automatic searches remain in "+(latestState.period||"this monthly period")+".";
    const chip=document.getElementById("automationEngineChip");
    chip.textContent=latestState.targetRunnerEnabled?"TARGET MONITOR ON":(latestState.runnerEnabled?"BACKGROUND RUNNER ON":"GUARDRAILS ONLY");
    chip.className="automation-chip "+(latestState.runnerEnabled?"safe":"warn");
    renderDemand();
  }
  function connection(){
    try{return typeof pricingConfig==="function"?pricingConfig():{endpoint:"",accessKey:""}}catch{return {endpoint:"",accessKey:""}}
  }
  async function loadStatus(){
    const status=document.getElementById("automationStatus"),c=connection();
    if(!c.endpoint||!c.accessKey){status.className="automation-status bad";status.textContent="Scout's live connection is not configured on this device.";renderState(latestState);return false;}
    status.className="automation-status";status.textContent="Loading server-side search guardrails…";
    try{
      const res=await fetch(c.endpoint+"/automation/status",{headers:{"X-Scout-Key":c.accessKey}});const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.ok)throw new Error(data.message||data.error||("HTTP "+res.status));
      renderState(data);
      status.className="automation-status ok";status.textContent=data.targetRunnerEnabled?"✓ Saved-target monitoring is scheduled and protected by this hard cap. Collection rotation is still off.":(data.runnerEnabled?"✓ Background automation is protected by this hard cap.":"✓ Search guardrails are stored on the Worker. No background searches are running yet.");
      return true;
    }catch(err){status.className="automation-status bad";status.textContent="Automation budget service unavailable: "+(err.message||"unknown error");return false;}
  }
  async function save(){
    const status=document.getElementById("automationStatus"),c=connection(),settings=readForm();renderDemand();
    if(!c.endpoint||!c.accessKey){status.className="automation-status bad";status.textContent="Scout's live connection is not configured on this device.";return;}
    status.className="automation-status";status.textContent="Saving hard search limits…";
    try{
      const res=await fetch(c.endpoint+"/automation/settings",{method:"POST",headers:{"Content-Type":"application/json","X-Scout-Key":c.accessKey},body:JSON.stringify(settings)});const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.ok)throw new Error(data.message||data.error||("HTTP "+res.status));
      renderState(data);status.className="automation-status ok";status.textContent="✓ Guardrails saved. This does not start any searches yet.";
      try{if(typeof toast==="function")toast("⚙️ Automation search guardrails saved") }catch{}
    }catch(err){status.className="automation-status bad";status.textContent="Could not save guardrails: "+(err.message||"unknown error");}
  }
  function mount(){
    if(document.getElementById("automationScreen"))return;
    addStyles();
    const grid=document.querySelector("#homeScreen .quick-grid"),dataBtn=document.getElementById("dataMenuBtn");
    if(grid&&!document.getElementById("automationBtn")){
      const btn=document.createElement("button");btn.className="ghost";btn.id="automationBtn";btn.type="button";btn.textContent="⚙️ AUTOMATION";
      grid.insertBefore(btn,dataBtn||null);
    }
    const main=document.querySelector("main");if(main)main.insertAdjacentHTML("beforeend",screenHtml());
    const btn=document.getElementById("automationBtn");if(btn)btn.onclick=()=>{try{showScreen("automationScreen")}catch{}loadStatus();};
    document.getElementById("automationBack").onclick=()=>{try{showScreen("homeScreen")}catch{}};
    document.getElementById("automationSave").onclick=save;
    document.getElementById("automationReload").onclick=loadStatus;
    ["automationCap","automationTargetCadence","automationTargetsEnabled","automationCollectionEnabled","automationCollectionCards"].forEach(id=>document.getElementById(id)?.addEventListener("input",renderDemand));
    renderState(latestState);
  }
  return {DEFAULTS,normalizeSettings,estimateMonthlyDemand,remaining,pct,mount};
});
