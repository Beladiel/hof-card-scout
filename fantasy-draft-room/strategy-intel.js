(() => {
  const KEY = "scoutFantasyDraftRoom2026V2";
  const TEAMS = 10;
  const base = Array.isArray(window.DRAFT_PLAYERS) ? window.DRAFT_PLAYERS : [];
  const deep = Array.isArray(window.DEEP_DRAFT_PLAYERS) ? window.DEEP_DRAFT_PLAYERS : [];
  const seen = new Set();
  const PLAYERS = [...base, ...deep].filter(p => {
    if (!p || !p.player || seen.has(p.player)) return false;
    seen.add(p.player);
    return true;
  });
  const byName = new Map(PLAYERS.map(p => [p.player, p]));
  const $ = id => document.getElementById(id);

  function readState() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
    catch { return {}; }
  }
  function ownerForOverall(overall) {
    const round = Math.floor((overall - 1) / TEAMS) + 1;
    const spot = ((overall - 1) % TEAMS) + 1;
    return round % 2 === 1 ? spot : (TEAMS + 1 - spot);
  }
  function history(state) {
    const raw = Array.isArray(state.history) ? state.history : [];
    return raw.filter(x => x && x.type === "draft" && x.name).map((x, i) => {
      const overall = Number(x.overall || i + 1);
      const owner = Number(x.owner || 0) || ownerForOverall(overall);
      return {...x, overall, owner};
    });
  }
  function currentOverall(state) { return history(state).length + 1; }
  function roundNow(state) { return Math.floor(history(state).length / TEAMS) + 1; }
  function available(state) {
    const drafted = state.drafted || {};
    return PLAYERS.filter(p => !drafted[p.player]);
  }
  function rosterCounts(state) {
    const c = {QB:0,RB:0,WR:0,TE:0,K:0,DEF:0};
    for (const name of (Array.isArray(state.mine) ? state.mine : [])) {
      const p = byName.get(name);
      if (p && c[p.pos] !== undefined) c[p.pos]++;
    }
    return c;
  }
  function ownerRosters(state) {
    const r = {};
    for (let i=1;i<=TEAMS;i++) r[i] = [];
    for (const h of history(state)) {
      const p = byName.get(h.name);
      if (p && h.owner >= 1 && h.owner <= TEAMS) r[h.owner].push(p);
    }
    return r;
  }
  function counts(players) {
    const c = {QB:0,RB:0,WR:0,TE:0,K:0,DEF:0};
    for (const p of players || []) if (p && c[p.pos] !== undefined) c[p.pos]++;
    return c;
  }
  function nextUserOverall(state, afterOverall) {
    const slot = Number(state.draftSlot || 0);
    if (!slot) return 0;
    for (let overall=Math.max(1,afterOverall+1);overall<=200;overall++) {
      if (ownerForOverall(overall) === slot) return overall;
    }
    return 0;
  }
  function teamsBeforeNextPick(state) {
    const slot = Number(state.draftSlot || 0);
    if (!slot) return [];
    const current = currentOverall(state);
    const onClock = ownerForOverall(current) === slot;
    const start = onClock ? current + 1 : current;
    const next = nextUserOverall(state, onClock ? current : current - 1);
    const owners = [];
    for (let overall=start; next && overall<next; overall++) {
      const owner = ownerForOverall(overall);
      if (owner !== slot && !owners.includes(owner)) owners.push(owner);
    }
    return owners;
  }
  function positionalNeed(c, pos, round) {
    if (pos === "QB") return c.QB === 0;
    if (pos === "TE") return c.TE === 0;
    if (pos === "RB") return c.RB < (round <= 5 ? 2 : 3);
    if (pos === "WR") return c.WR < (round <= 5 ? 2 : 3);
    if (pos === "DEF") return round >= 13 && c.DEF === 0;
    if (pos === "K") return round >= 14 && c.K === 0;
    return false;
  }
  function pressureFor(state, pos) {
    const owners = teamsBeforeNextPick(state);
    const rosters = ownerRosters(state);
    const round = roundNow(state);
    const needy = owners.filter(o => positionalNeed(counts(rosters[o]), pos, round));
    return {owners, needy, ratio:owners.length ? needy.length / owners.length : 0};
  }
  function tierRemaining(state, p) {
    return available(state).filter(x => x.pos === p.pos && x.tier === p.tier).length;
  }
  function tagClass(tag) {
    const t = String(tag || "").toUpperCase();
    if (/FADE|CAUTION/.test(t)) return "bad";
    if (/MONITOR/.test(t)) return "warn";
    return "good";
  }
  function isUserOnClock(state) {
    const slot = Number(state.draftSlot || 0);
    return !!slot && ownerForOverall(currentOverall(state)) === slot;
  }

  function score(state, p) {
    const r = roundNow(state);
    const mine = rosterCounts(state);
    const rank = Number(p.rank || p.marketRank || 180);
    const tag = String(p.tag || "").toUpperCase();
    let s = 135 - rank;

    if (p.pos === "K" || p.pos === "DEF") {
      if (mine[p.pos] > 0) return -999;
      if (r < 14) return -200 - Number(p.specialRank || 20);
      s = 92 - (Number(p.specialRank || 20) * 3);
      if (r === 15) s += 18;
      return Math.round(s);
    }

    if (tag.includes("ELITE")) s += 12;
    if (tag.includes("TARGET")) s += 8;
    if (tag.includes("VALUE")) s += 6;
    if (tag.includes("GOOD PICK")) s += 3;
    if (tag.includes("UPSIDE")) s += 2;
    if (tag.includes("MONITOR")) s -= 3;
    if (tag.includes("CAUTION")) s -= 5;
    if (tag.includes("FADE")) s -= 12;

    const remain = tierRemaining(state, p);
    if (remain === 1) s += 13;
    else if (remain === 2) s += 8;
    else if (remain === 3) s += 4;

    if (r <= 3) {
      if (p.pos === "RB" && mine.RB < 2) s += 10;
      if (p.pos === "WR" && mine.WR < 1) s += 5;
      if (p.pos === "QB") s -= 13;
      if (p.pos === "TE" && !tag.includes("ELITE TE")) s -= 8;
    } else if (r <= 6) {
      if (p.pos === "RB" && mine.RB < 2) s += 8;
      if (p.pos === "WR" && mine.WR < 2) s += 7;
      if ((p.pos === "RB" || p.pos === "WR") && (mine.RB + mine.WR < 5)) s += 3;
      if (p.pos === "QB" && mine.QB === 0) s += 1;
      if (p.pos === "TE" && mine.TE === 0) s += 2;
    } else if (r <= 10) {
      if (p.pos === "QB" && mine.QB === 0) s += 7;
      if (p.pos === "TE" && mine.TE === 0) s += 5;
      if (p.pos === "RB" || p.pos === "WR") s += 3;
    } else {
      if (p.pos === "QB" && mine.QB === 0) s += 9;
      if (p.pos === "TE" && mine.TE === 0) s += 7;
      if ((p.pos === "RB" || p.pos === "WR") && (state.mine || []).length < 13) s += 4;
    }

    // In a 10-team league, QB2/TE2 must be a genuine bargain, not just a tier-cliff artifact.
    if (mine.QB >= 1 && p.pos === "QB") s -= 38;
    if (mine.TE >= 1 && p.pos === "TE") s -= 30;

    if (String(p.injury || "").includes("PUP")) s -= 5;
    else if (p.injury) s -= 2;

    // Make opponent intelligence actionable in the ranking, not merely explanatory.
    const pressure = pressureFor(state, p.pos);
    if (pressure.owners.length >= 2) {
      if (pressure.needy.length === 0) s -= 8;
      else if (pressure.ratio <= .25) s -= 3;
      else if (pressure.ratio >= .75) s += 11;
      else if (pressure.ratio >= .5) s += 7;
      else s += 2;
    }

    return Math.round(s);
  }

  function pressureNote(state, p) {
    const mine = rosterCounts(state);
    if (p.pos === "QB" && mine.QB >= 1) return "🧠 You already have a starting QB; Scout heavily discounts QB2 in this 10-team league.";
    if (p.pos === "TE" && mine.TE >= 1) return "🧠 You already have a starting TE; Scout treats TE2 as a luxury pick.";
    if (!["QB","RB","WR","TE"].includes(p.pos)) return "";
    const d = pressureFor(state, p.pos);
    const n = d.owners.length;
    if (!n) return "";
    if (d.needy.length === 0) return `👀 Low pressure: 0 of ${n} teams before your next pick show a strong ${p.pos} need.`;
    if (d.needy.length === 1) return `👀 Light pressure: 1 of ${n} teams before your next pick still need ${p.pos}.`;
    if (d.ratio >= .5) return `👀 High pressure: ${d.needy.length} of ${n} teams before your next pick still need ${p.pos}.`;
    return `👀 Moderate pressure: ${d.needy.length} of ${n} teams before your next pick still need ${p.pos}.`;
  }

  function baseReason(state, p) {
    const r = roundNow(state), mine = rosterCounts(state), remain = tierRemaining(state, p);
    const tag = String(p.tag || "").toUpperCase();
    const reasons = [];
    if (p.pos === "K" || p.pos === "DEF") {
      if (r < 14) reasons.push("Scout says wait until the final two rounds");
      else reasons.push(`${p.pos === "DEF" ? "D/ST" : "Kicker"} rank #${p.specialRank || "—"} on Scout's late-round board`);
      if (p.note) reasons.push(p.note);
      return reasons.slice(0,2).join(" · ");
    }
    if (remain === 1) reasons.push(`Last ${p.pos} left in ${p.tier}`);
    else if (remain === 2) reasons.push(`Only 2 ${p.pos}s remain in ${p.tier}`);
    if (r <= 3 && p.pos === "RB" && mine.RB < 2) reasons.push("Early RB scarcity fits our plan");
    if (r <= 6 && p.pos === "WR" && mine.WR < 2) reasons.push("Helps fill the WR core");
    if (p.pos === "QB" && r < 5) reasons.push("QB value is good, but Scout still prefers waiting");
    if (tag.includes("TARGET")) reasons.push("Scout target at this cost");
    else if (tag.includes("VALUE")) reasons.push("Value versus current draft price");
    else if (tag.includes("ELITE")) reasons.push("Elite talent / positional edge");
    if (p.injury) reasons.push(`Health flag: ${p.injury}`);
    if (!reasons.length && p.note) reasons.push(p.note);
    return reasons.slice(0,2).join(" · ");
  }
  function verdict(state, p, index) {
    const tag = String(p.tag || "").toUpperCase();
    const remain = tierRemaining(state, p);
    const mine = rosterCounts(state);
    if (p.pos === "K" || p.pos === "DEF") return "⏳ FINAL ROUNDS";
    if ((p.pos === "QB" && mine.QB >= 1) || (p.pos === "TE" && mine.TE >= 1)) return "⏳ LUXURY PICK";
    if (index === 0 && remain <= 2) return "🔥 SMASH PICK";
    if (tag.includes("TARGET")) return "✅ TARGET";
    if (tag.includes("VALUE")) return "💰 VALUE";
    if (tag.includes("CAUTION") || tag.includes("MONITOR")) return "⚠️ WATCH";
    return index === 0 ? "✅ SCOUT'S PICK" : "GOOD OPTION";
  }

  function renderSmartTopFive() {
    const state = readState();
    const box = $("topFive");
    const call = $("scoutCall");
    if (!box || !call) return;

    const list = available(state)
      .map(p => ({...p, _score:score(state, p)}))
      .filter(p => p._score > -900)
      .sort((a,b) => b._score - a._score || Number(a.rank || 999) - Number(b.rank || 999))
      .slice(0,5);

    box.innerHTML = list.length ? list.map((p,i) => `
      <div class="pick-card">
        <div class="pick-num">${i+1}</div>
        <div>
          <div class="pick-name">${p.player}</div>
          <div class="pick-meta">${p.team} · ${p.pos === "DEF" ? "D/ST" : p.pos} · ${p.tier || "Late"} · Rank ${p.rank}</div>
          <div class="pick-reason">${baseReason(state, p)}</div>
          ${pressureNote(state, p) ? `<div class="opponent-note">${pressureNote(state, p)}</div>` : ""}
        </div>
        <div><div class="pick-score">${p._score}</div><div class="pick-verdict">${verdict(state, p, i)}</div></div>
      </div>`).join("") : `<div class="empty-state">No players remain on the board.</div>`;

    if (list[0]) {
      call.textContent = (state.mode === "mock" && state.mockActive && isUserOnClock(state))
        ? `You're up — Scout's pick: ${list[0].player}`
        : `Scout's pick: ${list[0].player}`;
    } else call.textContent = "Draft complete";

    // Clean up awkward zero-count copy in the opponent summary without changing its layout.
    const summary = $("leagueIntelSummary");
    if (summary) summary.querySelectorAll("span").forEach(span => {
      span.textContent = span.textContent.replace(/^Only 0 of /, "0 of ");
    });
  }

  let timer = null;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(renderSmartTopFive, 25);
  }
  const target = $("pickCounter") || document.body;
  const observer = new MutationObserver(schedule);
  observer.observe(target, {subtree:true, childList:true, characterData:true});
  document.addEventListener("click", schedule);
  document.addEventListener("change", schedule);
  window.addEventListener("storage", schedule);
  schedule();
})();
