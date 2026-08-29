(() => {
  const KEY = "scoutFantasyDraftRoom2026V2";
  const TEAMS = 10;
  const ROSTER_ROUNDS = 15;
  const LEAGUE_PICKS = TEAMS * ROSTER_ROUNDS;
  const aliases = window.SCOUT_PLAYER_ALIASES || {};
  const pool = () => {
    const seen = new Set();
    return [...(window.DRAFT_PLAYERS || []), ...(window.DEEP_DRAFT_PLAYERS || [])].filter(p => {
      if (!p || !p.player || seen.has(p.player)) return false;
      seen.add(p.player); return true;
    });
  };
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
  const write = state => localStorage.setItem(KEY, JSON.stringify(state));
  const norm = s => String(s || "").toLowerCase().replace(/[.'’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

  function ownerForOverall(overall) {
    const round = Math.floor((overall - 1) / TEAMS) + 1;
    const spot = ((overall - 1) % TEAMS) + 1;
    return round % 2 === 1 ? spot : (TEAMS + 1 - spot);
  }

  function syncOpponentOwnership() {
    const state = read();
    if (!state || !state.drafted || !Array.isArray(state.history)) return false;
    let changed = false;
    for (const action of state.history) {
      if (!action || action.type !== "draft" || !action.name || action.isMine) continue;
      const overall = Number(action.overall || 0);
      if (!overall) continue;
      const owner = ownerForOverall(overall);
      if (action.owner !== owner) { action.owner = owner; changed = true; }
      const expected = `team${owner}`;
      if (state.drafted[action.name] !== expected) { state.drafted[action.name] = expected; changed = true; }
    }
    if (changed) write(state);
    return changed;
  }

  function rebuildFromHistory(state) {
    const slot = Number(state.draftSlot || 0);
    const draftActions = (Array.isArray(state.history) ? state.history : [])
      .filter(a => a && a.type === "draft" && a.name && Number(a.overall))
      .sort((a,b) => Number(a.overall) - Number(b.overall));
    const otherActions = (Array.isArray(state.history) ? state.history : []).filter(a => !a || a.type !== "draft");
    state.drafted = {};
    state.mine = [];
    state.userPicks = [];
    for (const action of draftActions) {
      const overall = Number(action.overall);
      const owner = ownerForOverall(overall);
      const isMine = !!slot && owner === slot;
      action.owner = owner;
      action.isMine = isMine;
      action.round = Math.floor((overall - 1) / TEAMS) + 1;
      state.drafted[action.name] = isMine ? "mine" : `team${owner}`;
      if (isMine) {
        state.mine.push(action.name);
        state.userPicks.push({name:action.name, overall, round:action.round});
      }
    }
    state.history = [...draftActions, ...otherActions];
    if (state.mine.length >= ROSTER_ROUNDS) state.mockActive = false;
    return state;
  }

  function resolveSearchName() {
    const input = document.getElementById("searchInput");
    const raw = String(input?.value || "").trim();
    const boardName = document.querySelector("#playerBoard .player-row .pname")?.textContent?.trim();
    if (boardName) return boardName;
    if (!raw) return "";
    const alias = aliases[norm(raw)] || aliases[String(raw).toLowerCase()];
    if (alias) return alias;
    const exact = pool().find(p => norm(p.player) === norm(raw));
    if (exact) return exact.player;
    const matches = pool().filter(p => norm(p.player).includes(norm(raw)) || norm(raw).includes(norm(p.player)));
    return matches.length === 1 ? matches[0].player : "";
  }

  function insertMissedPick() {
    const state = read();
    const slot = Number(state.draftSlot || 0);
    if (!slot) { alert("Set the Lobstahs draft slot first so Scout can assign the missed pick to the correct roster."); return; }
    const name = resolveSearchName();
    if (!name) { alert("Search for the missed player first, then tap MISSED PICK."); return; }
    if (state.drafted?.[name]) { alert(`${name} is already recorded as drafted.`); return; }
    const recorded = Object.keys(state.drafted || {}).length;
    const raw = prompt(`Enter ${name}'s Yahoo OVERALL pick number (1-${LEAGUE_PICKS}).\n\nScout will insert that pick and repair every roster after it.`, String(Math.max(1, recorded)));
    if (raw === null) return;
    const pickNo = Number(raw);
    if (!Number.isInteger(pickNo) || pickNo < 1 || pickNo > LEAGUE_PICKS || pickNo > recorded + 1) {
      alert(`Enter an overall pick number from 1 through ${Math.min(LEAGUE_PICKS, recorded + 1)}.`); return;
    }
    state.history = Array.isArray(state.history) ? state.history : [];
    for (const action of state.history) {
      if (action?.type === "draft" && Number(action.overall) >= pickNo) action.overall = Number(action.overall) + 1;
    }
    state.history.push({type:"draft",name,isMine:false,owner:0,auto:false,overall:pickNo,correction:true});
    rebuildFromHistory(state);
    write(state);
    location.reload();
  }

  function addBoardTools() {
    const tools = document.querySelector(".board-tools");
    const search = document.getElementById("searchInput");
    if (!tools || !search || document.getElementById("boardUndoBtn")) return;
    tools.classList.add("board-tools-v41");
    const actions = document.createElement("div");
    actions.className = "board-quick-actions";
    actions.innerHTML = `
      <button id="clearSearchBtn" type="button" class="ghost">CLEAR SEARCH</button>
      <button id="boardUndoBtn" type="button" class="ghost">↶ UNDO LAST</button>
      <button id="missedPickBtn" type="button" class="ghost missed-pick-btn">＋ MISSED PICK</button>`;
    tools.appendChild(actions);
    document.getElementById("clearSearchBtn")?.addEventListener("click", () => {
      search.value = "";
      search.dispatchEvent(new Event("input", {bubbles:true}));
      search.focus();
    });
    document.getElementById("boardUndoBtn")?.addEventListener("click", () => document.getElementById("undoBtn")?.click());
    document.getElementById("missedPickBtn")?.addEventListener("click", insertMissedPick);
  }

  function setupRosterCollapse() {
    const card = document.getElementById("leagueRostersCard");
    const app = document.getElementById("leagueRostersApp");
    const head = card?.querySelector(".section-head");
    if (!card || !app || !head || document.getElementById("leagueRostersToggle")) return;
    card.classList.add("lr-collapsed");
    const button = document.createElement("button");
    button.id = "leagueRostersToggle";
    button.type = "button";
    button.className = "ghost lr-toggle";
    button.textContent = "SHOW LEAGUE ROSTERS";
    head.appendChild(button);
    const setOpen = open => {
      card.classList.toggle("lr-collapsed", !open);
      button.textContent = open ? "HIDE LEAGUE ROSTERS" : "SHOW LEAGUE ROSTERS";
    };
    button.addEventListener("click", () => setOpen(card.classList.contains("lr-collapsed")));
    document.querySelector('a[href="#leagueRostersCard"]')?.addEventListener("click", () => setOpen(true));
  }

  function riskyBackupTe() {
    const state = read();
    const mine = new Set(Array.isArray(state.mine) ? state.mine : []);
    const tes = pool().filter(p => p.pos === "TE" && mine.has(p.player));
    if (tes.length !== 1) return null;
    const starter = tes[0];
    const riskyNames = new Set(["George Kittle","Tucker Kraft","Sam LaPorta"]);
    if (!starter.injury && !riskyNames.has(starter.player)) return null;
    const round = Math.floor(Object.keys(state.drafted || {}).length / TEAMS) + 1;
    if (round < 9 || round > 13) return null;
    const candidates = pool().filter(p => p.pos === "TE" && !state.drafted?.[p.player]).sort((a,b) => Number(a.rank||999) - Number(b.rank||999));
    return {starter, candidate:candidates[0] || null};
  }

  function enforceBackupTeAlert() {
    const alerts = document.getElementById("alerts");
    if (!alerts) return;
    alerts.querySelector(".backup-te-alert")?.remove();
    const need = riskyBackupTe();
    if (!need) return;
    const div = document.createElement("div");
    div.className = "alert backup-te-alert";
    div.innerHTML = `<strong>BACKUP TE PRIORITY:</strong> <span>${need.starter.player} carries a ${need.starter.injury || "durability"} flag. Carry a second TE before K/DST${need.candidate ? ` — best available right now: <b>${need.candidate.player}</b>` : ""}.</span>`;
    alerts.prepend(div);
  }

  function enforceMineCap() {
    const state = read();
    const mineCount = Array.isArray(state.mine) ? state.mine.length : 0;
    if (mineCount < ROSTER_ROUNDS) return;
    document.querySelectorAll("#playerBoard [data-mine], .top5-draft-btn").forEach(btn => {
      btn.disabled = true;
      btn.setAttribute("aria-disabled", "true");
      if (btn.matches("#playerBoard [data-mine]")) btn.textContent = "ROSTER FULL";
    });
    const call = document.getElementById("scoutCall");
    if (call) call.textContent = Object.keys(state.drafted || {}).length >= LEAGUE_PICKS
      ? "Draft complete — league captured"
      : "Lobstahs roster complete — record remaining Yahoo picks only";
  }

  function refreshBoard() {
    const search = document.getElementById("searchInput");
    if (search) search.dispatchEvent(new Event("input", {bubbles:true}));
  }

  document.addEventListener("input", event => {
    if (event.target?.id !== "searchInput") return;
    const input = event.target;
    const alias = aliases[norm(input.value)];
    if (alias && input.value !== alias) input.value = alias;
    if (String(input.value || "").trim()) {
      const all = document.querySelector('#positionFilters button[data-pos="ALL"]');
      if (all && !all.classList.contains("active")) all.click();
    }
  }, true);

  document.addEventListener("click", event => {
    const mineControl = event.target.closest?.("#playerBoard [data-mine], .top5-draft-btn");
    if (mineControl) {
      const state = read();
      if ((state.mine || []).length >= ROSTER_ROUNDS) {
        event.preventDefault(); event.stopImmediatePropagation();
        enforceMineCap();
        return;
      }
    }
  }, true);

  document.addEventListener("click", event => {
    const drafted = event.target.closest?.("#playerBoard [data-drafted]");
    const mine = event.target.closest?.("#playerBoard [data-mine], .top5-draft-btn");
    if (!drafted && !mine) return;
    if (drafted) syncOpponentOwnership();
    setTimeout(() => { refreshBoard(); enforceMineCap(); enforceBackupTeAlert(); }, 0);
  });

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      addBoardTools();
      setupRosterCollapse();
      enforceMineCap();
      enforceBackupTeAlert();
    });
  });
  observer.observe(document.body, {childList:true,subtree:true});

  syncOpponentOwnership();
  addBoardTools();
  setupRosterCollapse();
  enforceMineCap();
  enforceBackupTeAlert();
})();
