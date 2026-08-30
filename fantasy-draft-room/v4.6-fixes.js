(() => {
  const KEY = "scoutFantasyDraftRoom2026V2";
  const TEAMS = 10;
  const league = window.SCOUT_LEAGUE_CONFIG || {teamName:"Lobstahs"};
  const riskyTeNames = new Set(["George Kittle","Tucker Kraft","Sam LaPorta"]);

  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
  const pool = () => {
    const seen = new Set();
    return [...(window.DRAFT_PLAYERS || []), ...(window.DEEP_DRAFT_PLAYERS || [])].filter(p => {
      if (!p || !p.player || seen.has(p.player)) return false;
      seen.add(p.player);
      return true;
    });
  };
  const byName = () => new Map(pool().map(p => [p.player, p]));

  function counts(state) {
    const c = {QB:0,RB:0,WR:0,TE:0,K:0,DEF:0};
    const map = byName();
    for (const name of (Array.isArray(state.mine) ? state.mine : [])) {
      const p = map.get(name);
      if (p && c[p.pos] !== undefined) c[p.pos]++;
    }
    return c;
  }

  function currentRound(state) {
    return Math.floor(Object.keys(state.drafted || {}).length / TEAMS) + 1;
  }

  function riskyStartingTe(state) {
    const map = byName();
    const tes = (state.mine || []).map(name => map.get(name)).filter(p => p?.pos === "TE");
    if (tes.length !== 1) return null;
    const te = tes[0];
    return (te.injury || riskyTeNames.has(te.player)) ? te : null;
  }

  function bestAvailableAt(state, pos) {
    return pool()
      .filter(p => p.pos === pos && !state.drafted?.[p.player])
      .sort((a,b) => Number(a.rank || a.marketRank || 999) - Number(b.rank || b.marketRank || 999))[0] || null;
  }

  function forcedRecommendation(state) {
    const r = currentRound(state);
    if (r < 9 || r > 13) return null;
    const c = counts(state);
    const riskyTe = riskyStartingTe(state);
    if (riskyTe && c.TE === 1) {
      const p = bestAvailableAt(state, "TE");
      if (p) return {p, reason:`Insurance for ${riskyTe.player}'s health risk. Add TE2 before D/ST and K.`, verdict:"🛡️ TE INSURANCE"};
    }
    if (c.RB >= 5 && c.WR < 4) {
      const p = bestAvailableAt(state, "WR");
      if (p) return {p, reason:"Roster balance check: the bench is RB-heavy, so Scout is surfacing WR upside here.", verdict:"⚖️ ROSTER BALANCE"};
    }
    return null;
  }

  function recommendationCard(rec) {
    const p = rec.p;
    return `<div class="pick-card v46-forced" data-v46-player="${p.player}">
      <div class="pick-num">5</div>
      <div>
        <div class="pick-name">${p.player}</div>
        <div class="pick-meta">${p.team} · ${p.pos === "DEF" ? "D/ST" : p.pos} · ${p.tier || "Late"} · Rank ${p.rank || p.marketRank || "—"}</div>
        <div class="pick-reason">${rec.reason}</div>
      </div>
      <div><div class="pick-score">↑</div><div class="pick-verdict">${rec.verdict}</div></div>
    </div>`;
  }

  let editingTopFive = false;
  function enforceTopFiveBalance() {
    if (editingTopFive) return;
    const box = document.getElementById("topFive");
    if (!box) return;
    const state = read();
    const rec = forcedRecommendation(state);
    if (!rec) return;
    const names = [...box.querySelectorAll(".pick-name")].map(el => el.textContent.trim());
    if (names.includes(rec.p.player)) return;
    const cards = box.querySelectorAll(".pick-card");
    if (!cards.length) return;
    editingTopFive = true;
    cards[cards.length - 1].outerHTML = recommendationCard(rec);
    editingTopFive = false;
  }

  function relabelDraftButtons() {
    const state = read();
    const mockOn = state.mode === "mock" && state.mockActive;
    document.querySelectorAll("#playerBoard [data-mine]").forEach(btn => {
      if (btn.disabled) return;
      btn.textContent = mockOn ? "DRAFT THIS" : "DRAFT TO MY TEAM";
      btn.title = `Draft this available player to ${league.teamName}`;
    });
  }

  function personalizeLegacyText() {
    const call = document.getElementById("scoutCall");
    if (call && league.teamName !== "Lobstahs") call.textContent = call.textContent.replaceAll("Lobstahs", league.teamName);
  }

  function refresh() {
    relabelDraftButtons();
    enforceTopFiveBalance();
    personalizeLegacyText();
  }

  const board = document.getElementById("playerBoard");
  if (board && "MutationObserver" in window) new MutationObserver(() => requestAnimationFrame(refresh)).observe(board,{childList:true,subtree:true});
  const topFive = document.getElementById("topFive");
  if (topFive && "MutationObserver" in window) new MutationObserver(() => requestAnimationFrame(enforceTopFiveBalance)).observe(topFive,{childList:true,subtree:true});
  document.addEventListener("click", () => setTimeout(refresh,0));
  document.addEventListener("change", () => setTimeout(refresh,0));

  if (!document.querySelector('script[data-scout-season-hq]')) {
    const script = document.createElement("script");
    script.src = "season-hq-v4.6.js?v=4.6";
    script.dataset.scoutSeasonHq = "true";
    document.body.appendChild(script);
  }

  refresh();
})();
