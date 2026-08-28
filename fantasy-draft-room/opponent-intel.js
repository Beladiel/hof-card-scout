(() => {
  const KEY = "scoutFantasyDraftRoom2026V2";
  const TEAMS = 10;
  const base = Array.isArray(window.DRAFT_PLAYERS) ? window.DRAFT_PLAYERS : [];
  const deep = Array.isArray(window.DEEP_DRAFT_PLAYERS) ? window.DEEP_DRAFT_PLAYERS : [];
  const PLAYERS = [...base, ...deep];
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

  function historyWithOwners(state) {
    const hist = Array.isArray(state.history) ? state.history : [];
    return hist.filter(x => x && x.type === "draft" && x.name).map((x, i) => {
      const overall = Number(x.overall || (i + 1));
      const owner = Number(x.owner || 0) || ownerForOverall(overall);
      return {...x, overall, owner};
    });
  }

  function ownerRosters(state) {
    const rosters = {};
    for (let i=1;i<=TEAMS;i++) rosters[i] = [];
    for (const h of historyWithOwners(state)) {
      const p = byName.get(h.name);
      if (p && h.owner >= 1 && h.owner <= TEAMS) rosters[h.owner].push(p);
    }
    return rosters;
  }

  function counts(players) {
    const c = {QB:0,RB:0,WR:0,TE:0,K:0,DEF:0};
    for (const p of players || []) if (p && c[p.pos] !== undefined) c[p.pos]++;
    return c;
  }

  function nextUserOverall(state, afterOverall) {
    const slot = Number(state.draftSlot || 0);
    if (!slot) return 0;
    for (let overall = Math.max(1, afterOverall + 1); overall <= 200; overall++) {
      if (ownerForOverall(overall) === slot) return overall;
    }
    return 0;
  }

  function teamsBeforeNextPick(state) {
    const slot = Number(state.draftSlot || 0);
    if (!slot) return [];
    const current = historyWithOwners(state).length + 1;
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

  function currentRound(state) {
    return Math.floor(historyWithOwners(state).length / TEAMS) + 1;
  }

  function demandFor(state, pos) {
    const rosters = ownerRosters(state);
    const owners = teamsBeforeNextPick(state);
    const round = currentRound(state);
    const needy = owners.filter(o => positionalNeed(counts(rosters[o]), pos, round));
    return {owners, needy};
  }

  function compactCounts(c) {
    return `QB ${c.QB} · RB ${c.RB} · WR ${c.WR} · TE ${c.TE}`;
  }

  function renderLeagueGrid(state) {
    const grid = $("leagueGrid");
    const summary = $("leagueIntelSummary");
    const card = $("leagueIntelCard");
    if (!grid || !summary || !card) return;

    const slot = Number(state.draftSlot || 0);
    if (!slot) {
      summary.innerHTML = `<div class="intel-call neutral"><strong>Set your draft slot</strong><span>Once the slot is set, Scout can infer which team made every pick and read the teams between your selections.</span></div>`;
      grid.innerHTML = "";
      return;
    }

    const rosters = ownerRosters(state);
    const between = teamsBeforeNextPick(state);
    const qb = demandFor(state, "QB");
    const rb = demandFor(state, "RB");
    const wr = demandFor(state, "WR");
    const te = demandFor(state, "TE");
    const n = between.length;

    const calls = [];
    if (n) {
      if (qb.needy.length <= 1) calls.push({tone:"good",title:"WAIT ON QB",text:`Only ${qb.needy.length} of ${n} team${n===1?"":"s"} before your next pick still need a QB.`});
      else calls.push({tone:"warn",title:"QB PRESSURE",text:`${qb.needy.length} of ${n} teams before your next pick still need a QB.`});

      const rbRatio = n ? rb.needy.length / n : 0;
      if (rbRatio >= .5) calls.push({tone:"warn",title:"RB PRESSURE",text:`${rb.needy.length} of ${n} teams ahead are still building RB depth. A tier-end back may not return.`});
      else calls.push({tone:"good",title:"RB CAN WAIT",text:`Only ${rb.needy.length} of ${n} teams ahead show a strong RB need right now.`});

      if (te.needy.length <= 1) calls.push({tone:"good",title:"TE MARKET QUIET",text:`Only ${te.needy.length} of ${n} teams ahead still need a starting TE.`});
      else if (te.needy.length >= Math.ceil(n/2)) calls.push({tone:"warn",title:"TE RUN RISK",text:`${te.needy.length} of ${n} teams ahead still need a TE.`});
      else calls.push({tone:"neutral",title:"WR ROOM",text:`${wr.needy.length} of ${n} teams ahead are still building their WR core.`});
    } else {
      calls.push({tone:"neutral",title:"AT THE TURN",text:"No unique opponent teams sit between this pick and your next selection."});
    }

    summary.innerHTML = calls.slice(0,3).map(c => `<div class="intel-call ${c.tone}"><strong>${c.title}</strong><span>${c.text}</span></div>`).join("");

    grid.innerHTML = Array.from({length:TEAMS}, (_,i) => i+1).map(owner => {
      const c = counts(rosters[owner]);
      const mine = owner === slot;
      const ahead = between.includes(owner);
      const last = rosters[owner].slice(-2).map(p => p.player.split(" ").slice(-1)[0]).join(", ") || "—";
      return `<div class="league-team ${mine?"mine":""} ${ahead?"ahead":""}">
        <div class="league-team-head"><strong>${mine?"YOU":`Slot ${owner}`}</strong>${ahead?`<span>picks before you</span>`:""}</div>
        <div class="league-counts">${compactCounts(c)}</div>
        <div class="league-last">Recent: ${last}</div>
      </div>`;
    }).join("");
  }

  function annotateTopFive(state) {
    const owners = teamsBeforeNextPick(state);
    if (!owners.length) return;
    const rosters = ownerRosters(state);
    const round = currentRound(state);
    document.querySelectorAll("#topFive .pick-card").forEach(card => {
      const meta = card.querySelector(".pick-meta");
      const reason = card.querySelector(".pick-reason");
      if (!meta || !reason) return;
      const parts = meta.textContent.split("·").map(x => x.trim());
      const posRaw = parts[1] || "";
      const pos = posRaw === "D/ST" ? "DEF" : posRaw;
      if (!["QB","RB","WR","TE"].includes(pos)) return;
      const needy = owners.filter(o => positionalNeed(counts(rosters[o]), pos, round)).length;
      let note = card.querySelector(".opponent-note");
      if (!note) {
        note = document.createElement("div");
        note.className = "opponent-note";
        reason.insertAdjacentElement("afterend", note);
      }
      if (needy === 0) note.textContent = `👀 Opponent read: nobody before your next pick shows a strong ${pos} need.`;
      else if (needy === 1) note.textContent = `👀 Opponent read: 1 team before your next pick still needs ${pos}.`;
      else note.textContent = `👀 Opponent read: ${needy} teams before your next pick still need ${pos}.`;
    });
  }

  function renderIntel() {
    const state = readState();
    renderLeagueGrid(state);
    annotateTopFive(state);
  }

  const target = $("pickCounter") || document.body;
  const observer = new MutationObserver(() => setTimeout(renderIntel, 0));
  observer.observe(target, {subtree:true, childList:true, characterData:true});
  document.addEventListener("click", () => setTimeout(renderIntel, 40));
  document.addEventListener("change", () => setTimeout(renderIntel, 40));
  renderIntel();
})();
