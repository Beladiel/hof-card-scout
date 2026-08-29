(() => {
  const KEY = "scoutFantasyDraftRoom2026V2";
  const ROSTER_ROUNDS = 15;

  function readState() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
    catch { return {}; }
  }

  function writeState(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  // v3.2 briefly allowed the Top 5 shortcut to keep adding players after
  // a Scout Mock had already completed. Salvage those mocks by keeping the
  // first 15 user selections and removing only the accidental post-draft picks.
  function repairOverdraft() {
    const state = readState();
    const picks = Array.isArray(state.userPicks) ? state.userPicks : [];
    if (state.mode !== "mock" || picks.length <= ROSTER_ROUNDS) return false;

    const keepPicks = picks.slice(0, ROSTER_ROUNDS);
    const keepNames = new Set(keepPicks.map(p => p && p.name).filter(Boolean));

    state.userPicks = keepPicks;
    state.mine = (Array.isArray(state.mine) ? state.mine : []).filter(name => keepNames.has(name));

    const drafted = state.drafted && typeof state.drafted === "object" ? state.drafted : {};
    for (const [name, owner] of Object.entries(drafted)) {
      if (owner === "mine" && !keepNames.has(name)) delete drafted[name];
    }
    state.drafted = drafted;

    state.history = (Array.isArray(state.history) ? state.history : []).filter(action => {
      if (!action || action.type !== "draft" || !action.isMine) return true;
      return keepNames.has(action.name);
    });

    state.mockActive = false;
    writeState(state);
    return true;
  }

  if (repairOverdraft()) {
    location.reload();
    return;
  }

  function isMockLocked(state = readState()) {
    const picks = Array.isArray(state.userPicks) ? state.userPicks : [];
    return state.mode === "mock" && (picks.length >= ROSTER_ROUNDS || state.mockActive === false && picks.length > 0);
  }

  function enforceLock() {
    const state = readState();
    if (!isMockLocked(state)) return;

    const topFive = document.getElementById("topFive");
    if (topFive && !topFive.querySelector(".mock-complete-lock")) {
      topFive.innerHTML = `<div class="empty-state mock-complete-lock"><strong>Mock complete — 15-player roster locked.</strong><br>Review your draft below or start a new mock.</div>`;
    }

    const call = document.getElementById("scoutCall");
    if (call) call.textContent = "Draft complete";

    const round = document.getElementById("roundText");
    if (round) round.textContent = "15 rounds complete";

    const next = document.getElementById("nextPickText");
    if (next) next.textContent = "SCOUT MOCK · DRAFT COMPLETE";

    document.querySelectorAll("#playerBoard [data-mine], .top5-draft-btn").forEach(btn => {
      btn.disabled = true;
      btn.setAttribute("aria-disabled", "true");
      if (btn.matches("#playerBoard [data-mine]")) btn.textContent = "DRAFT COMPLETE";
    });

    const summary = document.getElementById("leagueIntelSummary");
    if (summary) {
      summary.innerHTML = `<div class="intel-call neutral"><strong>DRAFT COMPLETE</strong><span>Opponent pressure is no longer relevant; your 15-player roster is locked.</span></div>`;
    }
  }

  // Block both the large player-board control and the one-tap Top 5 shortcut
  // before their existing handlers can run.
  document.addEventListener("click", event => {
    const draftControl = event.target.closest?.("#playerBoard [data-mine], .top5-draft-btn");
    if (!draftControl || !isMockLocked()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    enforceLock();
  }, true);

  const observer = new MutationObserver(() => enforceLock());
  observer.observe(document.body, {childList:true, subtree:true});
  document.addEventListener("input", () => setTimeout(enforceLock, 0));
  document.addEventListener("change", () => setTimeout(enforceLock, 0));
  enforceLock();
})();
