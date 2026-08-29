(() => {
  const KEY = "scoutFantasyDraftRoom2026V2";
  const TEAMS = 10;
  const ROSTER_ROUNDS = 15;
  const LEAGUE_PICKS = TEAMS * ROSTER_ROUNDS;
  let selectedName = "";

  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
  const write = state => localStorage.setItem(KEY, JSON.stringify(state));

  function ownerForOverall(overall) {
    const round = Math.floor((overall - 1) / TEAMS) + 1;
    const spot = ((overall - 1) % TEAMS) + 1;
    return round % 2 === 1 ? spot : (TEAMS + 1 - spot);
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

  function nameFromRow(row) {
    return row?.querySelector(".pname")?.textContent?.trim() || "";
  }

  function refreshSelection() {
    const state = read();
    if (selectedName && state.drafted?.[selectedName]) selectedName = "";
    document.querySelectorAll("#playerBoard .player-row").forEach(row => {
      const on = !!selectedName && nameFromRow(row) === selectedName;
      row.classList.toggle("missed-selected", on);
      row.setAttribute("aria-selected", on ? "true" : "false");
    });
    const btn = document.getElementById("missedPickBtn");
    if (btn) {
      btn.textContent = selectedName ? `＋ MISSED PICK · ${selectedName}` : "＋ MISSED PICK";
      btn.classList.toggle("has-selection", !!selectedName);
    }
  }

  function selectRow(row) {
    const name = nameFromRow(row);
    if (!name) return;
    selectedName = selectedName === name ? "" : name;
    refreshSelection();
  }

  function doMissedPick() {
    const state = read();
    const slot = Number(state.draftSlot || 0);
    if (!slot) {
      alert("Set the Lobstahs draft slot first so Scout can assign the missed pick to the correct roster.");
      return;
    }
    if (!selectedName) {
      alert("Tap a player row first, then tap MISSED PICK.");
      return;
    }
    if (state.drafted?.[selectedName]) {
      alert(`${selectedName} is already recorded as drafted.`);
      selectedName = "";
      refreshSelection();
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

  function takeOverButton() {
    const old = document.getElementById("missedPickBtn");
    if (!old || old.dataset.v422 === "1") return;
    const btn = old.cloneNode(true);
    btn.dataset.v422 = "1";
    old.replaceWith(btn);
    btn.addEventListener("click", event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      doMissedPick();
    }, true);
    refreshSelection();
  }

  function injectStyle() {
    if (document.getElementById("missedPickV422Style")) return;
    const style = document.createElement("style");
    style.id = "missedPickV422Style";
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
    if (!row || event.target.closest("button")) return;
    selectRow(row);
  }, true);

  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      takeOverButton();
      refreshSelection();
    });
  });
  observer.observe(document.body, {childList:true, subtree:true});

  injectStyle();
  takeOverButton();
  refreshSelection();
})();
