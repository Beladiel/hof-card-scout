(() => {
  const KEY = "scoutFantasyDraftRoom2026V2";
  const TEAMS = 10;
  const ROSTER_ROUNDS = 15;
  const LEAGUE_PICKS = TEAMS * ROSTER_ROUNDS;

  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
  const write = state => localStorage.setItem(KEY, JSON.stringify(state));

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
        state.userPicks.push({name:action.name, overall, round:action.round});
      }
    }
    state.history = [...drafts, ...others];
    if (state.mine.length >= ROSTER_ROUNDS) state.mockActive = false;
    return state;
  }

  function selectedName() {
    return document.querySelector("#playerBoard .player-row.missed-selected .pname")?.textContent?.trim() || "";
  }

  function syncButton() {
    const btn = document.getElementById("selectedMissedPickActionV45");
    if (!btn) return;
    const name = selectedName();
    btn.textContent = name ? `＋ MISSED PICK · ${name}` : "＋ MISSED PICK";
    btn.classList.toggle("has-selection", !!name);
    btn.setAttribute("aria-disabled", name ? "false" : "true");
  }

  function openModal() {
    const state = read();
    const name = selectedName();
    if (!Number(state.draftSlot || 0)) {
      alert("Set the Lobstahs draft slot first so Scout can assign the missed pick correctly.");
      return;
    }
    if (!name) return;
    if (state.drafted?.[name]) return;

    const modal = document.getElementById("missedPickModalV45");
    const player = document.getElementById("missedPickPlayerV45");
    const input = document.getElementById("missedPickNumberV45");
    const error = document.getElementById("missedPickErrorV45");
    if (!modal || !player || !input || !error) return;

    const recorded = Object.keys(state.drafted || {}).length;
    player.textContent = name;
    input.min = "1";
    input.max = String(Math.min(LEAGUE_PICKS, recorded + 1));
    input.value = String(Math.max(1, recorded));
    error.textContent = "";
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => { input.focus(); input.select?.(); });
  }

  function closeModal() {
    const modal = document.getElementById("missedPickModalV45");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }

  function applyMissedPick() {
    const state = read();
    const name = selectedName();
    const input = document.getElementById("missedPickNumberV45");
    const error = document.getElementById("missedPickErrorV45");
    if (!name || !input || !error) return;

    const recorded = Object.keys(state.drafted || {}).length;
    const max = Math.min(LEAGUE_PICKS, recorded + 1);
    const pickNo = Number(input.value);
    if (!Number.isInteger(pickNo) || pickNo < 1 || pickNo > max) {
      error.textContent = `Enter an overall pick number from 1 through ${max}.`;
      input.focus();
      return;
    }

    state.history = Array.isArray(state.history) ? state.history : [];
    for (const action of state.history) {
      if (action?.type === "draft" && Number(action.overall) >= pickNo) action.overall = Number(action.overall) + 1;
    }
    state.history.push({type:"draft", name, isMine:false, owner:0, auto:false, overall:pickNo, correction:true});
    rebuildFromHistory(state);
    write(state);
    closeModal();
    location.reload();
  }

  const style = document.createElement("style");
  style.textContent = `
    #selectedMissedPickActionV45.has-selection{border-color:rgba(216,91,79,.85);background:rgba(216,91,79,.20);color:#ffd1cb}
    #missedPickModalV45[hidden]{display:none!important}
    #missedPickModalV45{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.72)}
    #missedPickModalV45 .mp45-panel{width:min(420px,100%);border:1px solid var(--line);border-radius:16px;padding:16px;background:#0b211a;color:var(--text)}
    #missedPickModalV45 .mp45-title{font-size:18px;font-weight:900;margin:0 0 4px}
    #missedPickModalV45 .mp45-player{color:#ffd1cb;font-weight:900;margin-bottom:12px}
    #missedPickNumberV45{width:100%;min-height:48px;font-size:18px;padding:8px 10px}
    #missedPickErrorV45{min-height:18px;color:#ffb0a8;font-size:10px;margin-top:6px}
    #missedPickModalV45 .mp45-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
    #missedPickConfirmV45{background:var(--lobster,#d85b4f);color:white}
    @media(max-width:620px){.board-quick-actions #selectedMissedPickActionV45{grid-column:1/-1}}
  `;
  document.head.appendChild(style);

  document.addEventListener("click", event => {
    if (event.target.closest?.("#selectedMissedPickActionV45")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openModal();
      return;
    }
    if (event.target.closest?.("#missedPickConfirmV45")) {
      event.preventDefault();
      applyMissedPick();
      return;
    }
    if (event.target.closest?.("#missedPickCancelV45")) {
      event.preventDefault();
      closeModal();
    }
  }, true);

  document.getElementById("missedPickNumberV45")?.addEventListener("keydown", event => {
    if (event.key === "Enter") { event.preventDefault(); applyMissedPick(); }
    if (event.key === "Escape") { event.preventDefault(); closeModal(); }
  });

  const board = document.getElementById("playerBoard");
  if (board && "MutationObserver" in window) new MutationObserver(syncButton).observe(board,{subtree:true,childList:true,attributes:true,attributeFilter:["class"]});
  document.addEventListener("pointerup", () => setTimeout(syncButton,0), {passive:true});
  document.addEventListener("click", () => setTimeout(syncButton,0));
  syncButton();
})();