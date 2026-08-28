(() => {
  const base = Array.isArray(window.DRAFT_PLAYERS) ? window.DRAFT_PLAYERS : [];
  const deep = Array.isArray(window.DEEP_DRAFT_PLAYERS) ? window.DEEP_DRAFT_PLAYERS : [];
  const seen = new Set();
  const PLAYERS = [...base, ...deep].filter(p => {
    if (!p || !p.player || seen.has(p.player)) return false;
    seen.add(p.player);
    return true;
  });
  const KEY = "scoutFantasyDraftRoom2026V2";
  const OLD_KEY = "scoutFantasyDraftRoom2026V1";
  const TEAMS = 10;
  const ROSTER_ROUNDS = 15;
  const TEAM_BYE = {
    ARI:14,ATL:11,BAL:13,BUF:7,CAR:5,CHI:10,CIN:6,CLE:11,DAL:14,DEN:10,DET:6,
    GB:11,HOU:8,IND:13,JAX:7,KC:5,LAC:7,LAR:11,LV:13,MIA:6,MIN:6,NE:11,
    NO:8,NYG:8,NYJ:13,PHI:10,PIT:9,SEA:11,SF:8,TB:10,TEN:9,WAS:7
  };
  let filter = "ALL";

  function initialState() {
    return {
      drafted:{}, mine:[], history:[], draftSlot:"",
      mode:"live", mockActive:false, userPicks:[]
    };
  }
  function normalize(raw) {
    const s = {...initialState(), ...(raw || {})};
    s.drafted = s.drafted || {};
    s.mine = Array.isArray(s.mine) ? s.mine : [];
    s.history = Array.isArray(s.history) ? s.history : [];
    s.userPicks = Array.isArray(s.userPicks) ? s.userPicks : [];
    return s;
  }
  function load() {
    try {
      const current = localStorage.getItem(KEY);
      if (current) return normalize(JSON.parse(current));
      const old = localStorage.getItem(OLD_KEY);
      if (old) return normalize(JSON.parse(old));
    } catch {}
    return initialState();
  }

  let state = load();
  const $ = id => document.getElementById(id);
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));
  const playerByName = name => PLAYERS.find(p => p.player === name);
  const available = () => PLAYERS.filter(p => !state.drafted[p.player]);
  const totalDrafted = () => Object.keys(state.drafted).length;
  const roundNow = () => Math.floor(totalDrafted() / TEAMS) + 1;
  const currentOverall = () => totalDrafted() + 1;
  const byeFor = p => p.bye || TEAM_BYE[p.team] || "—";

  function tierNumber(tier) {
    const m = String(tier || "").match(/(\d+)/);
    return m ? Number(m[1]) : 99;
  }
  function tagClass(tag) {
    const t = String(tag || "").toUpperCase();
    if (/FADE|CAUTION/.test(t)) return "bad";
    if (/MONITOR/.test(t)) return "warn";
    return "good";
  }
  function ownerForOverall(overall) {
    const round = Math.floor((overall - 1) / TEAMS) + 1;
    const spot = ((overall - 1) % TEAMS) + 1;
    return round % 2 === 1 ? spot : (TEAMS + 1 - spot);
  }
  function draftedOwner(name) {
    const v = state.drafted[name];
    if (v === "mine") return Number(state.draftSlot) || 0;
    const m = String(v || "").match(/^team(\d+)$/);
    return m ? Number(m[1]) : 0;
  }
  function rosterNamesForOwner(owner) {
    if (owner === Number(state.draftSlot) && owner > 0) return state.mine.slice();
    return Object.keys(state.drafted).filter(name => draftedOwner(name) === owner);
  }
  function countsForNames(names) {
    const counts = {QB:0,RB:0,WR:0,TE:0,K:0,DEF:0};
    for (const name of names) {
      const p = playerByName(name);
      if (p && counts[p.pos] !== undefined) counts[p.pos]++;
    }
    return counts;
  }
  const rosterCounts = () => countsForNames(state.mine);
  const opponentCounts = owner => countsForNames(rosterNamesForOwner(owner));

  function tierRemaining(p) {
    return available().filter(x => x.pos === p.pos && x.tier === p.tier).length;
  }
  function nextPickInfo() {
    const slot = Number(state.draftSlot);
    if (!slot) return null;
    const drafted = totalDrafted();
    for (let r = 1; r <= ROSTER_ROUNDS; r++) {
      const overall = r % 2 === 1 ? ((r - 1) * TEAMS + slot) : (r * TEAMS - slot + 1);
      if (overall > drafted) return {overall, away:Math.max(0, overall - drafted - 1), round:r};
    }
    return null;
  }
  function isUserOnClock() {
    const slot = Number(state.draftSlot);
    return !!slot && ownerForOverall(currentOverall()) === slot;
  }

  function scorePlayer(p) {
    const r = roundNow(), counts = rosterCounts();
    const rank = Number(p.rank || p.marketRank || 180);
    let s = 135 - rank;
    const tag = String(p.tag || "").toUpperCase();

    if (p.pos === "K" || p.pos === "DEF") {
      if (counts[p.pos] > 0) return -999;
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

    const remain = tierRemaining(p);
    if (remain === 1) s += 13;
    else if (remain === 2) s += 8;
    else if (remain === 3) s += 4;

    if (r <= 3) {
      if (p.pos === "RB" && counts.RB < 2) s += 10;
      if (p.pos === "WR" && counts.WR < 1) s += 5;
      if (p.pos === "QB") s -= 13;
      if (p.pos === "TE" && !tag.includes("ELITE TE")) s -= 8;
    } else if (r <= 6) {
      if (p.pos === "RB" && counts.RB < 2) s += 8;
      if (p.pos === "WR" && counts.WR < 2) s += 7;
      if ((p.pos === "RB" || p.pos === "WR") && (counts.RB + counts.WR < 5)) s += 3;
      if (p.pos === "QB" && counts.QB === 0) s += 1;
      if (p.pos === "TE" && counts.TE === 0) s += 2;
    } else if (r <= 10) {
      if (p.pos === "QB" && counts.QB === 0) s += 7;
      if (p.pos === "TE" && counts.TE === 0) s += 5;
      if (p.pos === "RB" || p.pos === "WR") s += 3;
    } else {
      if (p.pos === "QB" && counts.QB === 0) s += 9;
      if (p.pos === "TE" && counts.TE === 0) s += 7;
      if ((p.pos === "RB" || p.pos === "WR") && state.mine.length < 13) s += 4;
    }

    if (counts.QB >= 1 && p.pos === "QB") s -= 20;
    if (counts.TE >= 1 && p.pos === "TE") s -= 12;
    if (String(p.injury || "").includes("PUP")) s -= 5;
    else if (p.injury) s -= 2;

    const next = nextPickInfo();
    if (next && next.away >= 5 && remain <= 2) s += 4;
    return Math.round(s);
  }

  function reasons(p) {
    const reasons = [], r = roundNow(), counts = rosterCounts(), remain = tierRemaining(p);
    const tag = String(p.tag || "").toUpperCase();

    if (p.pos === "K" || p.pos === "DEF") {
      if (r < 14) reasons.push("Scout says wait until the final two rounds");
      else reasons.push(`${p.pos === "DEF" ? "D/ST" : "Kicker"} rank #${p.specialRank || "—"} on Scout's late-round board`);
      if (p.note) reasons.push(p.note);
      return reasons.slice(0,2).join(" · ");
    }

    if (remain === 1) reasons.push(`Last ${p.pos} left in ${p.tier}`);
    else if (remain === 2) reasons.push(`Only 2 ${p.pos}s remain in ${p.tier}`);
    if (r <= 3 && p.pos === "RB" && counts.RB < 2) reasons.push("Early RB scarcity fits our plan");
    if (r <= 6 && p.pos === "WR" && counts.WR < 2) reasons.push("Helps fill the WR core");
    if (p.pos === "QB" && r < 5) reasons.push("QB value is good, but Scout still prefers waiting");
    if (tag.includes("TARGET")) reasons.push("Scout target at this cost");
    else if (tag.includes("VALUE")) reasons.push("Value versus current draft price");
    else if (tag.includes("ELITE")) reasons.push("Elite talent / positional edge");
    if (p.injury) reasons.push(`Health flag: ${p.injury}`);
    if (!reasons.length && p.note) reasons.push(p.note);
    return reasons.slice(0,2).join(" · ");
  }
  function verdict(p, index) {
    const tag = String(p.tag || "").toUpperCase(), remain = tierRemaining(p);
    if (p.pos === "K" || p.pos === "DEF") return "⏳ FINAL ROUNDS";
    if (index === 0 && remain <= 2) return "🔥 SMASH PICK";
    if (tag.includes("TARGET")) return "✅ TARGET";
    if (tag.includes("VALUE")) return "💰 VALUE";
    if (tag.includes("CAUTION") || tag.includes("MONITOR")) return "⚠️ WATCH";
    return index === 0 ? "✅ SCOUT'S PICK" : "GOOD OPTION";
  }

  function markDrafted(name, isMine, owner = 0, auto = false) {
    if (state.drafted[name]) return;
    const overall = currentOverall();

    if (state.mode === "mock" && state.mockActive && isMine && !isUserOnClock()) return;

    if (isMine) {
      state.drafted[name] = "mine";
      if (!state.mine.includes(name)) state.mine.push(name);
      state.userPicks.push({name, overall, round:roundNow()});
    } else {
      state.drafted[name] = owner ? `team${owner}` : "other";
    }
    state.history.push({type:"draft", name, isMine, owner, auto, overall});
    save();

    if (state.mode === "mock" && state.mockActive && isMine) runMockUntilUser();
    else render();
  }

  function undo() {
    if (state.mode === "mock" && state.mockActive) {
      const lastUser = [...state.history].reverse().find(x => x.isMine);
      if (!lastUser) return;
      while (state.history.length) {
        const action = state.history.pop();
        if (action.type === "draft") {
          delete state.drafted[action.name];
          state.mine = state.mine.filter(x => x !== action.name);
          state.userPicks = state.userPicks.filter(x => !(x.name === action.name && x.overall === action.overall));
        }
        if (action === lastUser) break;
      }
      save(); render();
      return;
    }

    const action = state.history.pop();
    if (!action) return;
    if (action.type === "draft") {
      delete state.drafted[action.name];
      state.mine = state.mine.filter(x => x !== action.name);
      state.userPicks = state.userPicks.filter(x => !(x.name === action.name && x.overall === action.overall));
    }
    save(); render();
  }

  function resetDraft(ask = true) {
    if (ask && !confirm("Reset every drafted player and your roster?")) return false;
    const slot = state.draftSlot, mode = state.mode;
    state = initialState();
    state.draftSlot = slot;
    state.mode = mode === "mock" ? "live" : mode;
    save(); render();
    return true;
  }

  function hashNoise(text) {
    let h = 2166136261;
    for (let i=0;i<text.length;i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 1701) / 100 - 8.5;
  }

  function opponentPick(owner, overall) {
    const round = Math.floor((overall - 1) / TEAMS) + 1;
    const counts = opponentCounts(owner);
    let pool = available();

    if (round === 15) {
      if (counts.K === 0) {
        const ks = pool.filter(p => p.pos === "K");
        if (ks.length) pool = ks;
      } else if (counts.DEF === 0) {
        const ds = pool.filter(p => p.pos === "DEF");
        if (ds.length) pool = ds;
      }
    }

    let best = null, bestScore = -Infinity;
    for (const p of pool) {
      const rank = Number(p.marketRank || p.rank || 200);
      let s = 190 - rank + hashNoise(`${p.player}|${overall}|${owner}`);

      if (p.pos === "K" || p.pos === "DEF") {
        if (counts[p.pos] > 0) s -= 500;
        if (round < 13) s -= 350;
        else if (round === 13) s -= 60;
        else s += 80 - Number(p.specialRank || 20);
      } else if (p.pos === "QB") {
        if (counts.QB >= 2) s -= 220;
        else if (counts.QB >= 1) s -= 50;
        else if (round >= 5) s += 12;
        else if (round <= 3) s -= 25;
      } else if (p.pos === "TE") {
        if (counts.TE >= 2) s -= 180;
        else if (counts.TE >= 1) s -= 35;
        else if (round >= 5) s += 8;
      } else if (p.pos === "RB") {
        if (counts.RB < 2) s += 18;
        else if (counts.RB < 4) s += 7;
        else if (counts.RB >= 6) s -= 25;
      } else if (p.pos === "WR") {
        if (counts.WR < 2) s += 16;
        else if (counts.WR < 5) s += 7;
        else if (counts.WR >= 7) s -= 25;
      }

      if (round >= 14) {
        if (counts.DEF === 0 && p.pos === "DEF") s += 55;
        if (counts.K === 0 && p.pos === "K") s += 55;
      }

      if (s > bestScore) { bestScore = s; best = p; }
    }
    return best;
  }

  function runMockUntilUser() {
    const slot = Number(state.draftSlot);
    if (!slot || !state.mockActive) return;
    const limit = TEAMS * ROSTER_ROUNDS;

    while (totalDrafted() < limit) {
      const overall = currentOverall();
      const owner = ownerForOverall(overall);
      if (owner === slot) break;
      const p = opponentPick(owner, overall);
      if (!p) break;
      state.drafted[p.player] = `team${owner}`;
      state.history.push({type:"draft", name:p.player, isMine:false, owner, auto:true, overall});
    }

    if (totalDrafted() >= limit) state.mockActive = false;
    save(); render();
  }

  function startMock() {
    const slot = Number($("draftSlot").value || state.draftSlot);
    if (!slot) {
      alert("Choose your draft slot first, then start the Scout Mock.");
      return;
    }
    if (totalDrafted() && !confirm("Start a fresh Scout Mock and clear the current test draft?")) return;
    state = initialState();
    state.draftSlot = String(slot);
    state.mode = "mock";
    state.mockActive = true;
    save();
    runMockUntilUser();
  }

  function switchLive() {
    if (state.mode === "live") return;
    if (totalDrafted() && !confirm("Return to Live / Yahoo Mock mode and clear this Scout Mock?")) return;
    const slot = state.draftSlot;
    state = initialState();
    state.draftSlot = slot;
    state.mode = "live";
    save(); render();
  }

  function renderTopFive() {
    const list = available()
      .map(p => ({...p, _score:scorePlayer(p)}))
      .filter(p => p._score > -900)
      .sort((a,b) => b._score - a._score || Number(a.rank||999) - Number(b.rank||999))
      .slice(0,5);

    $("topFive").innerHTML = list.length ? list.map((p,i) => `
      <div class="pick-card">
        <div class="pick-num">${i+1}</div>
        <div>
          <div class="pick-name">${p.player}</div>
          <div class="pick-meta">${p.team} · ${p.pos === "DEF" ? "D/ST" : p.pos} · ${p.tier || "Late"} · Rank ${p.rank}</div>
          <div class="pick-reason">${reasons(p)}</div>
        </div>
        <div><div class="pick-score">${p._score}</div><div class="pick-verdict">${verdict(p,i)}</div></div>
      </div>`).join("") : `<div class="empty-state">No players remain on the board.</div>`;

    if (state.mode === "mock" && state.mockActive && isUserOnClock() && list[0]) {
      $("scoutCall").textContent = `You're up — Scout's pick: ${list[0].player}`;
    } else {
      $("scoutCall").textContent = list[0] ? `Scout's pick: ${list[0].player}` : "Draft complete";
    }
  }

  function renderAlerts() {
    const counts = rosterCounts(), r = roundNow(), pool = available();
    const groups = new Map();
    for (const p of pool) {
      if (p.pos === "K" || p.pos === "DEF") continue;
      const key = `${p.pos}|${p.tier}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    }
    const alerts = [];
    for (const [key, group] of groups) {
      if (group.length <= 2) {
        const [pos,tier] = key.split("|");
        if (tierNumber(tier) <= 7) alerts.push({
          priority:group.length === 1 ? 1 : 2,
          text:`<strong>${pos} ${tier}:</strong> <span>${group.length === 1 ? "ONE" : "TWO"} left — ${group.map(x=>x.player).join(", ")}</span>`
        });
      }
    }
    if (r <= 3 && counts.RB < 2) alerts.push({priority:0,text:`<strong>Roster:</strong> <span>You have ${counts.RB} RB. Our plan is to leave Round 3 with two when value is fair.</span>`});
    if (r >= 7 && counts.QB === 0) alerts.push({priority:0,text:`<strong>QB:</strong> <span>You still need a QB. This is the range where Scout starts attacking value.</span>`});
    if (r >= 7 && counts.TE === 0) alerts.push({priority:1,text:`<strong>TE:</strong> <span>Still open. Take value, not desperation.</span>`});
    if (r < 14) alerts.push({priority:5,text:`<strong>K / DEF:</strong> <span>Keep waiting. Save those slots for the final two rounds.</span>`});
    else {
      if (counts.DEF === 0) alerts.push({priority:0,text:`<strong>D/ST:</strong> <span>Now we can take one. Scout has the late-round defense board loaded.</span>`});
      if (counts.K === 0) alerts.push({priority:1,text:`<strong>K:</strong> <span>Final-round kicker board is now live.</span>`});
    }
    alerts.sort((a,b) => a.priority - b.priority);
    $("alerts").innerHTML = alerts.slice(0,5).map(a => `<div class="alert">${a.text}</div>`).join("");
  }

  function renderRoster() {
    const slotDefs = [
      ["QB",1],["RB",1],["RB",2],["WR",1],["WR",2],["TE",1],["FLEX",1],["K",1],["DEF",1],
      ["BENCH",1],["BENCH",2],["BENCH",3],["BENCH",4],["BENCH",5],["BENCH",6]
    ];
    const players = state.mine.map(playerByName).filter(Boolean);
    const used = new Set(), slots = [];
    function take(pos) {
      const idx = players.findIndex((p,i) => !used.has(i) && p.pos === pos);
      if (idx >= 0) { used.add(idx); return players[idx]; }
      return null;
    }
    for (const [label,n] of slotDefs) {
      let p = null;
      if (["QB","RB","WR","TE","K","DEF"].includes(label)) p = take(label);
      else if (label === "FLEX") {
        for (const pos of ["RB","WR","TE"]) { p = take(pos); if (p) break; }
      } else {
        const idx = players.findIndex((x,i) => !used.has(i));
        if (idx >= 0) { used.add(idx); p = players[idx]; }
      }
      slots.push({label:label + (n > 1 ? ` ${n}` : ""), p});
    }
    $("rosterGrid").innerHTML = slots.map(s => `
      <div class="roster-slot ${s.p ? "" : "empty"}">
        <div class="slot">${s.label}</div>
        <div class="name">${s.p ? `${s.p.player}<br><span class="pmeta">${s.p.team} · ${s.p.pos === "DEF" ? "D/ST" : s.p.pos}</span>` : "—"}</div>
      </div>`).join("");
    $("rosterCount").textContent = `${state.mine.length} player${state.mine.length === 1 ? "" : "s"}`;
  }

  function renderBoard() {
    const q = $("searchInput").value.trim().toLowerCase();
    const list = available()
      .filter(p => (filter === "ALL" || p.pos === filter) && (!q || `${p.player} ${p.team} ${p.pos}`.toLowerCase().includes(q)))
      .sort((a,b) => Number(a.rank||999) - Number(b.rank||999))
      .slice(0,180);

    const mockOnClock = state.mode === "mock" && state.mockActive && isUserOnClock();
    $("playerBoard").innerHTML = list.length ? list.map(p => `
      <div class="player-row">
        <div class="rank">${p.rank}</div>
        <div><div class="pname">${p.player}</div><div class="pmeta">${p.team} · ${p.pos === "DEF" ? "D/ST" : p.pos} · Bye ${byeFor(p)}${p.injury ? ` · ${p.injury}` : ""}</div></div>
        <div class="tier">${p.tier || "Late"}</div>
        <div class="tag ${tagClass(p.tag)}">${p.tag || "DEPTH"}</div>
        <div class="note">${p.note || p.window || ""}</div>
        <div class="row-actions">
          <button class="mine-btn" data-mine="${encodeURIComponent(p.player)}">${mockOnClock ? "DRAFT THIS" : "MY TEAM"}</button>
          ${state.mode === "mock" && state.mockActive ? "" : `<button class="draft-btn" data-drafted="${encodeURIComponent(p.player)}">DRAFTED</button>`}
        </div>
      </div>`).join("") : `<div class="empty-state">No available players match that filter.</div>`;

    document.querySelectorAll("[data-mine]").forEach(b => b.onclick = () => markDrafted(decodeURIComponent(b.dataset.mine), true));
    document.querySelectorAll("[data-drafted]").forEach(b => b.onclick = () => markDrafted(decodeURIComponent(b.dataset.drafted), false));
  }

  function renderHeader() {
    $("roundText").textContent = `Round ${roundNow()} · Pick ${currentOverall()}`;
    $("pickCounter").textContent = `${totalDrafted()} drafted`;
    const next = nextPickInfo();

    if (state.mode === "mock" && state.mockActive && isUserOnClock()) {
      $("nextPickText").textContent = `SCOUT MOCK · YOU'RE ON THE CLOCK at pick #${currentOverall()}`;
    } else {
      $("nextPickText").textContent = next
        ? `Your next pick: #${next.overall} · ${next.away === 0 ? "YOU'RE UP" : `${next.away} pick${next.away === 1 ? "" : "s"} away`}`
        : "Set your slot to show picks until you're up.";
    }
    $("draftSlot").value = state.draftSlot || "";
  }

  function renderMode() {
    const mock = state.mode === "mock";
    $("liveModeBtn").classList.toggle("active-mode", !mock);
    $("startMockBtn").classList.toggle("active-mode", mock);
    $("modeHelp").textContent = mock
      ? (state.mockActive ? "Scout Mock is running. Other teams auto-draft and pause at each of your picks." : "Scout Mock complete. Reset or return to Live / Yahoo Mock mode.")
      : "Use this mode beside a real Yahoo draft or Yahoo mock draft. You tap picks manually.";
    $("startMockBtn").textContent = mock ? (state.mockActive ? "🎲 SCOUT MOCK ACTIVE" : "🎲 START NEW SCOUT MOCK") : "🎲 START SCOUT MOCK";
  }

  function renderReview() {
    const box = $("mockReview");
    if (state.mode !== "mock" || state.mockActive || state.userPicks.length < ROSTER_ROUNDS) {
      box.hidden = true;
      return;
    }
    const counts = rosterCounts();
    const values = state.userPicks.map(x => {
      const p = playerByName(x.name);
      return {name:x.name, value:x.overall - Number((p && (p.marketRank || p.rank)) || x.overall)};
    }).sort((a,b)=>b.value-a.value);
    const best = values[0];
    let grade = "B";
    if (counts.RB >= 4 && counts.WR >= 4 && counts.QB >= 1 && counts.TE >= 1 && counts.K === 1 && counts.DEF === 1) grade = "A-";
    if (best && best.value >= 15) grade = "A";
    box.hidden = false;
    box.innerHTML = `
      <div class="section-head">
        <div><div class="eyebrow">📝 SCOUT MOCK REVIEW</div><h2>Draft Grade: ${grade}</h2></div>
        <span class="pill">${state.userPicks.length} picks</span>
      </div>
      <div class="review-grid">
        <div><strong>Best value</strong><span>${best ? `${best.name} (${best.value >= 0 ? "+" : ""}${best.value} picks vs board)` : "—"}</span></div>
        <div><strong>RB / WR depth</strong><span>${counts.RB} RB · ${counts.WR} WR</span></div>
        <div><strong>Onesie positions</strong><span>${counts.QB} QB · ${counts.TE} TE · ${counts.DEF} D/ST · ${counts.K} K</span></div>
      </div>`;
  }

  function render() {
    renderHeader();
    renderMode();
    renderTopFive();
    renderAlerts();
    renderRoster();
    renderBoard();
    renderReview();
  }

  $("draftSlot").onchange = e => { state.draftSlot = e.target.value; save(); render(); };
  $("undoBtn").onclick = undo;
  $("resetBtn").onclick = () => resetDraft(true);
  $("searchInput").oninput = renderBoard;
  $("liveModeBtn").onclick = switchLive;
  $("startMockBtn").onclick = startMock;
  $("positionFilters").querySelectorAll("button").forEach(btn => btn.onclick = () => {
    filter = btn.dataset.pos;
    $("positionFilters").querySelectorAll("button").forEach(x => x.classList.toggle("active", x === btn));
    renderBoard();
  });

  render();
})();
