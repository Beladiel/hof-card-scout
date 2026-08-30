(() => {
  const ACTIVE_KEY = "scoutFantasyActiveLeague2026V1";
  const LEGACY_DRAFT_KEY = "scoutFantasyDraftRoom2026V2";
  const LEGACY_META_KEY = "scoutFantasyLeagueRosters2026V1";

  const LEAGUES = {
    lobstahs: {
      id: "lobstahs",
      teamName: "Lobstahs",
      emoji: "🦞",
      leagueId: "1384925",
      leagueName: "Yahoo Prize Prestige 1384925",
      draftTime: "Sat Sep 5 · 6:00 PM MDT",
      waiverLabel: "FAAB waivers",
      heroTitle: "Draft smart. Pinch value. 🦞🏈",
      draftKey: "scoutFantasyDraftRoom2026LobstahsV1",
      metaKey: "scoutFantasyLeagueRosters2026LobstahsV1"
    },
    redgreen: {
      id: "redgreen",
      teamName: "Red or Green Machine",
      emoji: "🌶️",
      leagueId: "1464991",
      leagueName: "Yahoo Prize H2H-Pts 1464991",
      draftTime: "Sun Aug 30 · 11:00 AM MDT",
      waiverLabel: "Rolling waivers · no FAAB",
      heroTitle: "Red. Green. Christmas. Touchdowns. 🌶️🏈",
      draftKey: "scoutFantasyDraftRoom2026RedGreenV1",
      metaKey: "scoutFantasyLeagueRosters2026RedGreenV1"
    }
  };

  const proto = Storage.prototype;
  const originalGetItem = proto.getItem;
  const originalSetItem = proto.setItem;
  const originalRemoveItem = proto.removeItem;

  // Preserve the existing single-team app data by migrating it to Lobstahs once.
  try {
    const oldDraft = originalGetItem.call(localStorage, LEGACY_DRAFT_KEY);
    const lobDraft = originalGetItem.call(localStorage, LEAGUES.lobstahs.draftKey);
    if (oldDraft && !lobDraft) originalSetItem.call(localStorage, LEAGUES.lobstahs.draftKey, oldDraft);

    const oldMeta = originalGetItem.call(localStorage, LEGACY_META_KEY);
    const lobMeta = originalGetItem.call(localStorage, LEAGUES.lobstahs.metaKey);
    if (oldMeta && !lobMeta) originalSetItem.call(localStorage, LEAGUES.lobstahs.metaKey, oldMeta);
  } catch {}

  let activeId = "lobstahs";
  try {
    const saved = originalGetItem.call(localStorage, ACTIVE_KEY);
    if (saved && LEAGUES[saved]) activeId = saved;
  } catch {}
  const active = LEAGUES[activeId];

  function mappedKey(key) {
    if (key === LEGACY_DRAFT_KEY) return active.draftKey;
    if (key === LEGACY_META_KEY) return active.metaKey;
    return key;
  }

  if (!proto.__scoutFantasyLeagueRouterV46) {
    Object.defineProperty(proto, "__scoutFantasyLeagueRouterV46", {value:true, configurable:true});
    proto.getItem = function(key) {
      return originalGetItem.call(this, this === localStorage ? mappedKey(key) : key);
    };
    proto.setItem = function(key, value) {
      return originalSetItem.call(this, this === localStorage ? mappedKey(key) : key, value);
    };
    proto.removeItem = function(key) {
      return originalRemoveItem.call(this, this === localStorage ? mappedKey(key) : key);
    };
  }

  window.SCOUT_LEAGUES = LEAGUES;
  window.SCOUT_ACTIVE_LEAGUE = activeId;
  window.SCOUT_LEAGUE_CONFIG = active;
  window.SCOUT_SET_LEAGUE = id => {
    if (!LEAGUES[id] || id === activeId) return;
    originalSetItem.call(localStorage, ACTIVE_KEY, id);
    location.reload();
  };

  // Make old helper-script alerts league-aware without rewriting every legacy module.
  const nativeAlert = window.alert.bind(window);
  window.alert = message => nativeAlert(String(message ?? "").replaceAll("Lobstahs", active.teamName));

  function personalize() {
    document.body.dataset.league = activeId;
    document.title = `${active.teamName} · Scout Fantasy Draft Room`;
    const apple = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (apple) apple.setAttribute("content", `${active.teamName} Draft Room`);

    const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    setText("heroEyebrow", `${active.emoji} ${active.teamName.toUpperCase()} · SCOUT FANTASY DRAFT ROOM · V4.6`);
    setText("heroTitle", active.heroTitle);
    setText("heroMeta", `${active.leagueName} · 10 teams · Half-PPR · 60-second picks · ${active.waiverLabel}`);
    setText("heroMark", active.emoji);
    setText("draftSlotLabel", `${active.teamName.toUpperCase()} DRAFT SLOT`);
    setText("rosterEyebrow", `${active.emoji} ${active.teamName.toUpperCase()}`);
    setText("postDraftEyebrow", `${active.emoji} POST-DRAFT HQ`);
    setText("roundPlanEyebrow", `${active.emoji} ${active.teamName.toUpperCase()} ROUND PLAN`);
    setText("leagueNavLink", `${active.emoji} LEAGUE ROSTERS`);
    setText("draftDatePill", active.draftTime);

    document.querySelectorAll("[data-league-switch]").forEach(btn => {
      const id = btn.dataset.leagueSwitch;
      btn.classList.toggle("active", id === activeId);
      btn.setAttribute("aria-pressed", id === activeId ? "true" : "false");
      btn.onclick = () => window.SCOUT_SET_LEAGUE(id);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", personalize, {once:true});
  else personalize();
})();
