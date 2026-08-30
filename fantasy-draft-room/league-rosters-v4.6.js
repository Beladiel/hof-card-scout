(() => {
  const ROOT_ID = "leagueRostersApp";
  const DRAFT_KEY = "scoutFantasyDraftRoom2026V2";
  const META_KEY = "scoutFantasyLeagueRosters2026V1";
  const TEAMS = 10;
  const POS_ORDER = {QB:1,RB:2,WR:3,TE:4,K:5,DEF:6};
  const league = window.SCOUT_LEAGUE_CONFIG || {teamName:"Lobstahs",emoji:"🦞"};
  const HOME_NAME = league.teamName || "Lobstahs";
  const HOME_EMOJI = league.emoji || "🦞";

  const base = Array.isArray(window.DRAFT_PLAYERS) ? window.DRAFT_PLAYERS : [];
  const deep = Array.isArray(window.DEEP_DRAFT_PLAYERS) ? window.DEEP_DRAFT_PLAYERS : [];
  const knownMap = new Map();
  [...base, ...deep].forEach(p => {
    if (p && p.player && !knownMap.has(p.player.toLowerCase())) knownMap.set(p.player.toLowerCase(), p);
  });

  function defaultMeta() {
    return {
      teamNames:Array.from({length:TEAMS},(_,i)=>`Team ${i+1}`),
      notes:Array.from({length:TEAMS},()=>""), overrides:{}, customPlayers:{},
      moves:[], homeNamedSlot:0
    };
  }
  function loadMeta() {
    try {
      const raw = JSON.parse(localStorage.getItem(META_KEY) || "null");
      if (!raw) return defaultMeta();
      const d = defaultMeta();
      return {
        ...d, ...raw,
        teamNames:Array.from({length:TEAMS},(_,i)=>raw.teamNames?.[i] || d.teamNames[i]),
        notes:Array.from({length:TEAMS},(_,i)=>raw.notes?.[i] || ""),
        overrides:raw.overrides || {}, customPlayers:raw.customPlayers || {},
        moves:Array.isArray(raw.moves) ? raw.moves : []
      };
    } catch { return defaultMeta(); }
  }
  function loadDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}") || {}; }
    catch { return {}; }
  }
  let meta = loadMeta();
  const saveMeta = () => localStorage.setItem(META_KEY, JSON.stringify(meta));
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

  function normalizeHomeTeam(draft) {
    const slot = Number(draft.draftSlot || 0);
    if (!slot || slot < 1 || slot > TEAMS) return 0;
    const prior = Number(meta.homeNamedSlot || 0);
    if (prior && prior !== slot && meta.teamNames[prior-1] === HOME_NAME) meta.teamNames[prior-1] = `Team ${prior}`;
    meta.teamNames[slot-1] = HOME_NAME;
    meta.homeNamedSlot = slot;
    saveMeta();
    return slot;
  }
  function draftOwner(name, draft) {
    const v = draft.drafted?.[name];
    if (v === "mine") return Number(draft.draftSlot || 0);
    const m = String(v || "").match(/^team(\d+)$/);
    return m ? Number(m[1]) : 0;
  }
  function recordForName(name) {
    const known = knownMap.get(String(name).trim().toLowerCase());
    if (known) return {player:known.player, team:known.team || "", pos:known.pos || ""};
    const custom = meta.customPlayers?.[name];
    return custom ? {player:name, team:custom.team || "", pos:custom.pos || ""} : {player:name, team:"", pos:""};
  }
  function ownerFor(name, draft) {
    if (Object.prototype.hasOwnProperty.call(meta.overrides, name)) return Number(meta.overrides[name] || 0);
    if (meta.customPlayers?.[name]?.owner) return Number(meta.customPlayers[name].owner);
    return draftOwner(name, draft);
  }
  function allRecords(draft) {
    const names = new Set([
      ...Object.keys(draft.drafted || {}),
      ...Object.keys(meta.overrides || {}),
      ...Object.keys(meta.customPlayers || {})
    ]);
    return [...names].map(recordForName);
  }
  function rosterFor(teamNo, draft) {
    return allRecords(draft)
      .filter(r => ownerFor(r.player, draft) === teamNo)
      .sort((a,b) => (POS_ORDER[a.pos] || 9) - (POS_ORDER[b.pos] || 9) || a.player.localeCompare(b.player));
  }
  function counts(roster) {
    const c = {QB:0,RB:0,WR:0,TE:0,K:0,DEF:0};
    roster.forEach(p => { if (c[p.pos] !== undefined) c[p.pos]++; });
    return c;
  }
  function needChips(c) {
    const out = [];
    if (!c.QB) out.push(["need","Needs QB"]);
    if (c.RB < 4) out.push(["need","Needs RB depth"]);
    if (c.WR < 4) out.push(["need","Needs WR depth"]);
    if (!c.TE) out.push(["need","Needs TE"]);
    if (c.RB >= 6) out.push(["surplus","RB surplus"]);
    if (c.WR >= 6) out.push(["surplus","WR surplus"]);
    if (!out.length) out.push(["","Balanced"]);
    return out;
  }
  function teamLabel(n) { return meta.teamNames[n-1] || `Team ${n}`; }
  function logMove(text) {
    meta.moves.unshift({at:new Date().toISOString(), text});
    meta.moves = meta.moves.slice(0,80);
  }
  function formatMoveTime(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
  }

  function assignPlayer(rawName, teamNo, pos) {
    const draft = loadDraft();
    const nameInput = String(rawName || "").trim();
    if (!nameInput || !teamNo) return;
    const known = knownMap.get(nameInput.toLowerCase());
    const name = known ? known.player : nameInput;
    const oldOwner = ownerFor(name, draft);
    if (!known) meta.customPlayers[name] = {...(meta.customPlayers[name] || {}), pos:pos || "WR", owner:teamNo};
    meta.overrides[name] = teamNo;
    if (oldOwner && oldOwner !== teamNo) logMove(`Moved ${name}: ${teamLabel(oldOwner)} → ${teamLabel(teamNo)}`);
    else if (!oldOwner) logMove(`Added ${name} to ${teamLabel(teamNo)}`);
    saveMeta();
    render();
  }
  function dropPlayer(name, owner) {
    meta.overrides[name] = 0;
    if (meta.customPlayers?.[name]) meta.customPlayers[name].owner = 0;
    logMove(`Dropped ${name} from ${teamLabel(owner)}`);
    saveMeta();
    render();
  }

  function render() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    const draft = loadDraft();
    const homeSlot = normalizeHomeTeam(draft);
    const records = [...knownMap.values()].slice().sort((a,b)=>a.player.localeCompare(b.player));

    const toolbar = `
      <div class="lr-toolbar">
        <div>
          <label for="lrPlayerInput">PLAYER</label>
          <input id="lrPlayerInput" list="lrPlayerList" placeholder="Type any player name">
          <datalist id="lrPlayerList">${records.map(p=>`<option value="${esc(p.player)}"></option>`).join("")}</datalist>
        </div>
        <div>
          <label for="lrPos">POSITION (for new names)</label>
          <select id="lrPos"><option>QB</option><option selected>RB</option><option>WR</option><option>TE</option><option>K</option><option value="DEF">D/ST</option></select>
        </div>
        <div>
          <label for="lrTeamSelect">FANTASY TEAM</label>
          <select id="lrTeamSelect">${Array.from({length:TEAMS},(_,i)=>`<option value="${i+1}">${i+1} · ${esc(teamLabel(i+1))}</option>`).join("")}</select>
        </div>
        <button id="lrAssignBtn" type="button">ADD / MOVE PLAYER</button>
      </div>
      <div class="lr-hint">${homeSlot ? `${HOME_EMOJI} ${esc(HOME_NAME)} are Team ${homeSlot}. Drafted players will appear here automatically.` : `Set the ${esc(HOME_NAME)} draft slot at the top before your mock; Scout will then identify your roster automatically.`}</div>`;

    const cards = Array.from({length:TEAMS},(_,i)=>{
      const n = i+1, roster = rosterFor(n,draft), c = counts(roster), home = n === homeSlot;
      return `<article class="lr-team ${home ? "is-home" : ""}">
        <div class="lr-team-head">
          <div class="lr-team-num">${home ? `${HOME_EMOJI} ` : ""}TEAM ${n}</div>
          <input class="lr-team-name" data-team-name="${n}" value="${esc(teamLabel(n))}" aria-label="Team ${n} name">
          <div class="lr-count">${roster.length} rostered</div>
        </div>
        <div class="lr-needs">${needChips(c).map(([kind,text])=>`<span class="lr-chip ${kind}">${esc(text)}</span>`).join("")}</div>
        <div class="lr-roster">${roster.length ? roster.map(p=>`
          <div class="lr-player">
            <div><strong title="${esc(p.player)}">${esc(p.player)}</strong><span>${esc(p.team || "NFL ?")} · ${esc(p.pos === "DEF" ? "D/ST" : (p.pos || "?"))}</span></div>
            <button type="button" data-drop-player="${esc(p.player)}" data-drop-owner="${n}" aria-label="Drop ${esc(p.player)}">×</button>
          </div>`).join("") : `<div class="lr-empty">No players recorded yet.</div>`}</div>
        <div class="lr-note"><label>TRADE / TEAM NOTE</label><input data-team-note="${n}" value="${esc(meta.notes[n-1] || "")}" placeholder="Needs, surplus, manager tendency…"></div>
      </article>`;
    }).join("");

    const moves = meta.moves.length
      ? meta.moves.slice(0,12).map(m=>`<div class="lr-move"><time>${esc(formatMoveTime(m.at))}</time><span>${esc(m.text)}</span></div>`).join("")
      : `<div class="lr-empty">No manual league moves logged yet. Draft picks are tracked automatically.</div>`;

    root.innerHTML = `${toolbar}<div class="lr-grid">${cards}</div>
      <div class="lr-moves"><div class="eyebrow">LEAGUE MOVES LOG</div><div class="lr-move-list">${moves}</div></div>`;

    document.getElementById("lrAssignBtn")?.addEventListener("click", ()=>{
      assignPlayer(document.getElementById("lrPlayerInput")?.value, Number(document.getElementById("lrTeamSelect")?.value), document.getElementById("lrPos")?.value);
      const inp = document.getElementById("lrPlayerInput"); if (inp) inp.value = "";
    });
    root.querySelectorAll("[data-team-name]").forEach(el => el.addEventListener("change", ()=>{
      const n = Number(el.dataset.teamName); meta.teamNames[n-1] = el.value.trim() || `Team ${n}`;
      if (n === homeSlot) meta.teamNames[n-1] = HOME_NAME;
      saveMeta(); render();
    }));
    root.querySelectorAll("[data-team-note]").forEach(el => el.addEventListener("change", ()=>{
      meta.notes[Number(el.dataset.teamNote)-1] = el.value.trim(); saveMeta();
    }));
    root.querySelectorAll("[data-drop-player]").forEach(btn => btn.addEventListener("click", ()=>dropPlayer(btn.dataset.dropPlayer, Number(btn.dataset.dropOwner))));
  }

  document.getElementById("draftSlot")?.addEventListener("change", ()=>setTimeout(render,0));
  const counter = document.getElementById("pickCounter");
  if (counter && "MutationObserver" in window) new MutationObserver(render).observe(counter,{childList:true,subtree:true});
  render();
})();
