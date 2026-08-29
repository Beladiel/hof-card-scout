(() => {
  const KEY = "scoutFantasyDraftRoom2026V2";
  const TEAMS = 10;
  const ROSTER_ROUNDS = 15;
  const LEAGUE_PICKS = TEAMS * ROSTER_ROUNDS;
  const aliases = window.SCOUT_PLAYER_ALIASES || {};
  let selectedName = "";
  let rosterOpen = false;

  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
  const write = s => localStorage.setItem(KEY, JSON.stringify(s));
  const norm = s => String(s || "").toLowerCase().replace(/[.'’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const pool = () => {
    const seen = new Set();
    return [...(window.DRAFT_PLAYERS || []), ...(window.DEEP_DRAFT_PLAYERS || [])].filter(p => {
      if (!p || !p.player || seen.has(p.player)) return false;
      seen.add(p.player);
      return true;
    });
  };

  function ownerForOverall(overall) {
    const round = Math.floor((overall - 1) / TEAMS) + 1;
    const spot = ((overall - 1) % TEAMS) + 1;
    return round % 2 === 1 ? spot : (TEAMS + 1 - spot);
  }

  function rebuildFromHistory(state) {
    const slot = Number(state.draftSlot || 0);
    const drafts = (Array.isArray(state.history) ? state.history : [])
      .filter(a => a && a.type === "draft" && a.name && Number(a.overall))
      .sort((a,b) => Number(a.overall) - Number(b.overall));
    const others = (Array.isArray(state.history) ? state.history : []).filter(a => !a || a.type !== "draft");

    state.drafted = {};
    state.mine = [];
    state.userPicks = [];

    for (const action of drafts) {
      const overall = Number(action.overall);
      const owner = ownerForOverall(overall);
      const isMine = !!slot && owner === slot;
      action.owner = owner;
      action.isMine = isMine;
      action.round = Math.floor((overall - 1) / TEAMS) + 1;
      state.drafted[action.name] = isMine ? "mine" : `team${owner}`;
      if (isMine) {
        state.mine.push(action.name);
        state.userPicks.push({name: action.name, overall, round: action.round});
      }
    }

    state.history = [...drafts, ...others];
    if (state.mine.length >= ROSTER_ROUNDS) state.mockActive = false;
    return state;
  }

  function playerNameFromRow(row) {
    return row?.querySelector(".pname")?.textContent?.trim() || "";
  }

  function updateMissedButton() {
    const btn = document.getElementById("missedPickBtn");
    if (!btn) return;
    btn.textContent = selectedName ? `＋ MISSED PICK · ${selectedName}` : "＋ MISSED PICK";
    btn.classList.toggle("has-selection", !!selectedName);
  }

  function applySelection() {
    const state = read();
    if (selectedName && state.drafted?.[selectedName]) selectedName = "";
    document.querySelectorAll("#playerBoard .player-row").forEach(row => {
      const on = !!selectedName && playerNameFromRow(row) === selectedName;
      row.classList.toggle("missed-selected", on);
      row.setAttribute("aria-selected", on ? "true" : "false");
    });
    updateMissedButton();
  }

  function selectRow(row) {
    const name = playerNameFromRow(row);
    if (!name) return;
    selectedName = selectedName === name ? "" : name;
    applySelection();
  }

  function insertSelectedMissedPick() {
    const state = read();
    const slot = Number(state.draftSlot || 0);
    if (!slot) {
      alert("Set the Lobstahs draft slot first so Scout can assign the missed pick to the correct roster.");
      return;
    }
    if (!selectedName) {
      alert("Tap the missed player on the Best Available board first.");
      return;
    }
    if (state.drafted?.[selectedName]) {
      alert(`${selectedName} is already recorded as drafted.`);
      selectedName = "";
      applySelection();
      return;
    }

    const recorded = Object.keys(state.drafted || {}).length;
    const raw = prompt(
      `Enter ${selectedName}'s Yahoo OVERALL pick number (1-${LEAGUE_PICKS}).\n\nScout will insert that pick and repair every roster after it.`,
      String(Math.max(1, recorded))
    );
    if (raw === null) return;
    const pickNo = Number(raw);
    if (!Number.isInteger(pickNo) || pickNo < 1 || pickNo > LEAGUE_PICKS || pickNo > recorded + 1) {
      alert(`Enter an overall pick number from 1 through ${Math.min(LEAGUE_PICKS, recorded + 1)}.`);
      return;
    }

    state.history = Array.isArray(state.history) ? state.history : [];
    for (const action of state.history) {
      if (action?.type === "draft" && Number(action.overall) >= pickNo) {
        action.overall = Number(action.overall) + 1;
      }
    }
    state.history.push({type:"draft", name:selectedName, isMine:false, owner:0, auto:false, overall:pickNo, correction:true});
    rebuildFromHistory(state);
    write(state);
    selectedName = "";
    location.reload();
  }

  function ensureBoardTools() {
    const tools = document.querySelector(".board-tools");
    const search = document.getElementById("searchInput");
    if (!tools || !search) return;
    tools.classList.add("board-tools-v41");

    let actions = tools.querySelector(".board-quick-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "board-quick-actions";
      tools.appendChild(actions);
    }
    actions.innerHTML = `
      <button id="clearSearchBtn" type="button" class="ghost">CLEAR SEARCH</button>
      <button id="boardUndoBtn" type="button" class="ghost">↶ UNDO LAST</button>
      <button id="missedPickBtn" type="button" class="ghost missed-pick-btn">＋ MISSED PICK</button>`;

    document.getElementById("clearSearchBtn")?.addEventListener("click", () => {
      search.value = "";
      search.dispatchEvent(new Event("input", {bubbles:true}));
      search.focus();
    });
    document.getElementById("boardUndoBtn")?.addEventListener("click", () => document.getElementById("undoBtn")?.click());
    document.getElementById("missedPickBtn")?.addEventListener("click", insertSelectedMissedPick);
    updateMissedButton();
  }

  function setupRosterCollapse() {
    const card = document.getElementById("leagueRostersCard");
    const app = document.getElementById("leagueRostersApp");
    const head = card?.querySelector(".section-head");
    if (!card || !app || !head) return;

    let button = document.getElementById("leagueRostersToggle");
    if (!button) {
      button = document.createElement("button");
      button.id = "leagueRostersToggle";
      button.type = "button";
      button.className = "ghost lr-toggle";
      head.appendChild(button);
      button.addEventListener("click", () => {
        rosterOpen = !rosterOpen;
        setupRosterCollapse();
      });
      document.querySelector('a[href="#leagueRostersCard"]')?.addEventListener("click", () => {
        rosterOpen = true;
        setupRosterCollapse();
      });
    }
    card.classList.toggle("lr-collapsed", !rosterOpen);
    button.textContent = rosterOpen ? "HIDE LEAGUE ROSTERS" : "SHOW LEAGUE ROSTERS";
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
    const candidate = pool().filter(p => p.pos === "TE" && !state.drafted?.[p.player])
      .sort((a,b) => Number(a.rank||999) - Number(b.rank||999))[0] || null;
    return {starter, candidate};
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

  function injectStyle() {
    if (document.getElementById("draftControlsV43Style")) return;
    const style = document.createElement("style");
    style.id = "draftControlsV43Style";
    style.textContent = `
      #playerBoard .player-row{cursor:pointer;transition:border-color .12s ease,background .12s ease,box-shadow .12s ease}
      #playerBoard .player-row.missed-selected{border-color:var(--lobster,#d85b4f)!important;background:rgba(216,91,79,.16)!important;box-shadow:0 0 0 2px rgba(216,91,79,.32) inset}
      #playerBoard .player-row.missed-selected .pname::after{content:"  ✓ SELECTED";color:#ffb3aa;font-size:8px;letter-spacing:.05em}
      #missedPickBtn.has-selection{border-color:rgba(216,91,79,.85);background:rgba(216,91,79,.20);color:#ffd1cb}
    `;
    document.head.appendChild(style);
  }

  document.addEventListener("click", event => {
    const row = event.target.closest?.("#playerBoard .player-row");
    if (row && !event.target.closest("button")) selectRow(row);
  });

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
    if (mineControl && (read().mine || []).length >= ROSTER_ROUNDS) {
      event.preventDefault();
      event.stopImmediatePropagation();
      enforceMineCap();
      return;
    }
  }, true);

  document.addEventListener("click", event => {
    if (!event.target.closest?.("#playerBoard [data-drafted], #playerBoard [data-mine], .top5-draft-btn, #undoBtn, #boardUndoBtn")) return;
    setTimeout(() => {
      refreshBoard();
      applySelection();
      enforceMineCap();
      enforceBackupTeAlert();
    }, 0);
  });

  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      ensureBoardTools();
      setupRosterCollapse();
      applySelection();
      enforceMineCap();
      enforceBackupTeAlert();
    });
  });
  observer.observe(document.body, {childList:true, subtree:true});

  injectStyle();
  ensureBoardTools();
  setupRosterCollapse();
  applySelection();
  enforceMineCap();
  enforceBackupTeAlert();
})();