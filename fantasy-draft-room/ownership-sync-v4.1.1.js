(() => {
  const KEY = "scoutFantasyDraftRoom2026V2";
  const TEAMS = 10;
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
  const ownerForOverall = overall => {
    const round = Math.floor((overall - 1) / TEAMS) + 1;
    const spot = ((overall - 1) % TEAMS) + 1;
    return round % 2 === 1 ? spot : (TEAMS + 1 - spot);
  };
  function sync() {
    const state = read();
    if (!state?.drafted || !Array.isArray(state.history)) return;
    let changed = false;
    for (const action of state.history) {
      if (!action || action.type !== "draft" || !action.name || action.isMine) continue;
      const overall = Number(action.overall || 0);
      if (!overall) continue;
      const owner = ownerForOverall(overall);
      if (action.owner !== owner) { action.owner = owner; changed = true; }
      const value = `team${owner}`;
      if (state.drafted[action.name] !== value) { state.drafted[action.name] = value; changed = true; }
    }
    if (changed) localStorage.setItem(KEY, JSON.stringify(state));
  }
  document.addEventListener("click", event => {
    if (event.target.closest?.("#missedPickBtn") && !String(document.getElementById("searchInput")?.value || "").trim()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      alert("Search for the missed player first, then tap MISSED PICK.");
      return;
    }
    if (!event.target.closest?.("#playerBoard [data-drafted], #playerBoard [data-mine], .top5-draft-btn, #undoBtn, #boardUndoBtn")) return;
    sync();
  }, true);
  sync();
})();
