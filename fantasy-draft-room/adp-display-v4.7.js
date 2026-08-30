(() => {
  const KEY = "scoutFantasyDraftRoom2026V2";
  const TEAMS = 10;

  // Recent FantasyPros DraftWizard HALF mock-draft average pick, Aug. 29, 2026.
  // This is a market reference, intentionally separate from Scout Rank.
  const ADP = {
    "Jahmyr Gibbs":1.37,"Bijan Robinson":2.20,"Ja'Marr Chase":2.95,"Puka Nacua":4.42,
    "Christian McCaffrey":5.86,"Jaxon Smith-Njigba":6.50,"Jonathan Taylor":7.05,"Amon-Ra St. Brown":7.53,
    "James Cook":9.33,"James Cook III":9.33,"CeeDee Lamb":10.74,"Justin Jefferson":11.88,
    "De'Von Achane":14.52,"Saquon Barkley":14.53,"Chase Brown":14.62,"A.J. Brown":16.47,
    "Ashton Jeanty":16.69,"Drake London":16.69,"Omarion Hampton":18.28,"Kenneth Walker III":18.56,
    "Derrick Henry":18.82,"Nico Collins":21.31,"Brock Bowers":21.44,"George Pickens":24.92,
    "Trey McBride":25.29,"Chris Olave":25.36,"Josh Allen":25.71,"Malik Nabers":27.32,
    "Kyren Williams":27.65,"Jeremiyah Love":29.64,"Rashee Rice":30.41,"DeVonta Smith":31.41,
    "Javonte Williams":31.54,"Josh Jacobs":33.95,"Breece Hall":34.25,"Zay Flowers":35.45,
    "Lamar Jackson":37.59,"Tee Higgins":37.96,"Tetairoa McMillan":40.17,"Travis Etienne":40.36,"Travis Etienne Jr.":40.36,
    "Garrett Wilson":41.77,"Colston Loveland":43.21,"Jaylen Waddle":43.25,"Ladd McConkey":43.58,
    "Emeka Egbuka":44.64,"D'Andre Swift":45.93,"Drake Maye":46.15,"Cam Skattebo":46.55,
    "DJ Moore":47.43,"Bucky Irving":49.01,"Quinshon Judkins":50.46,"David Montgomery":52.57,
    "Terry McLaurin":53.59,"Luther Burden III":53.70,"Tyler Warren":53.89,"Davante Adams":54.12,
    "Joe Burrow":54.43,"Bhayshul Tuten":57.34,"Jameson Williams":58.32,"TreVeyon Henderson":59.13,
    "Jadarian Price":59.71,"Jayden Daniels":61.27,"Rome Odunze":63.40,"Christian Watson":63.54,
    "Mike Evans":63.82,"Jalen Hurts":65.31,"Rhamondre Stevenson":68.74,"Parker Washington":68.81,
    "Jaylen Warren":69.65,"Tucker Kraft":72.61,"Carnell Tate":73.30,"Caleb Williams":73.46,
    "Marvin Harrison Jr.":74.82,"Tony Pollard":76.42,"Jonathon Brooks":78.23,"Rico Dowdle":78.96,
    "Harold Fannin Jr.":79.99,"Brian Thomas Jr.":81.02,"DK Metcalf":82.45,"Justin Herbert":82.85,
    "Courtland Sutton":84.77,"Chris Godwin":84.99,"Chris Godwin Jr.":84.99,"J.K. Dobbins":85.32,
    "Chuba Hubbard":85.44,"RJ Harvey":87.11,"Sam LaPorta":89.53,"Michael Wilson":90.49,
    "Blake Corum":91.12,"Trevor Lawrence":92.85,"Jordan Mason":93.21,"Michael Pittman":93.41,"Michael Pittman Jr.":93.41,
    "Alec Pierce":93.47,"Wan'Dale Robinson":93.49,"Jacory Croskey-Merritt":93.79,"Dak Prescott":94.73,
    "Kyle Monangai":96.42,"Kenny Gainwell":98.21,"Quentin Johnston":98.49,"Kyle Pitts":100.01,"Kyle Pitts Sr.":100.01,
    "Stefon Diggs":100.73,"Josh Downs":101.95,"Rachaad White":102.93,"Aaron Jones Sr.":106.71,
    "Makai Lemon":108.99,"Jordan Addison":109.13,"Jayden Reed":111.33,"Jordyn Tyson":112.34,
    "Jakobi Meyers":114.94,"Chris Rodriguez":115.56,"Chris Rodriguez Jr.":115.56,"George Kittle":117.03,
    "De'Zhaun Stribling":119.16,"Woody Marks":120.65,"Jaxson Dart":121.62,"Tyler Allgeier":121.70,
    "KC Concepcion":130.79,"Los Angeles Rams D/ST":133.64,"Houston Texans D/ST":135.83,"Tyjae Spears":136.57,
    "Romeo Doubs":137.60,"Brock Purdy":137.67,"Travis Kelce":138.19,"Matthew Golden":139.59,
    "Zach Charbonnet":139.84,"Mike Washington":139.84,"Mike Washington Jr.":139.84,"Xavier Worthy":141.67,
    "Dalton Kincaid":142.92,"Keaton Mitchell":143.59,"Brian Robinson":146.65,"Brian Robinson Jr.":146.65,
    "Jonah Coleman":147.49,"Jalen Coker":148.18,"Deebo Samuel":150.52,"Deebo Samuel Sr.":150.52,
    "Denver Broncos D/ST":151.02,"Bo Nix":152.24,"Tyrone Tracy":153.65,"Tyrone Tracy Jr.":153.65,
    "Seattle Seahawks D/ST":154.38,"MarShawn Lloyd":155.54,"Khalil Shakir":156.88,"Tank Bigsby":160.35
  };

  const pool = () => {
    const seen = new Set();
    return [...(window.DRAFT_PLAYERS || []), ...(window.DEEP_DRAFT_PLAYERS || [])].filter(p => {
      if (!p?.player || seen.has(p.player)) return false;
      seen.add(p.player); return true;
    });
  };
  const playerMap = () => new Map(pool().map(p => [p.player, p]));
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };

  function currentPick() { return Object.keys(read().drafted || {}).length + 1; }
  function adpInfo(name) {
    const p = playerMap().get(name);
    const exact = Number(ADP[name]);
    if (Number.isFinite(exact)) return {adp:exact, exact:true};
    const fallback = Number(p?.marketRank || p?.rank || 0);
    return fallback > 0 ? {adp:fallback, exact:false} : null;
  }
  function roundPick(adp) {
    const pick = Math.max(1, Math.round(adp));
    const round = Math.floor((pick - 1) / TEAMS) + 1;
    const inRound = ((pick - 1) % TEAMS) + 1;
    return `R${round}.${inRound}`;
  }
  function valueInfo(adp) {
    const delta = currentPick() - adp;
    const abs = Math.round(Math.abs(delta));
    if (delta >= 10) return {text:`🔥 GREAT VALUE +${Math.round(delta)}`,cls:"great"};
    if (delta >= 5) return {text:`✅ VALUE +${Math.round(delta)}`,cls:"value"};
    if (delta > -5) return {text:"≈ MARKET",cls:"fair"};
    if (delta > -10) return {text:`⚠️ ${abs} EARLY`,cls:"early"};
    return {text:`⏳ ${abs} EARLY`,cls:"reach"};
  }
  function badge(name) {
    const info = adpInfo(name);
    if (!info) return "";
    const v = valueInfo(info.adp);
    const prefix = info.exact ? "ADP" : "ADP est.";
    return `<span class="scout-adp">${prefix} ${info.adp.toFixed(info.exact ? 1 : 0)} · ${roundPick(info.adp)}</span><span class="scout-adp-value ${v.cls}">${v.text}</span>`;
  }

  function setBadgeHtml(target, html) {
    if (target.innerHTML !== html) target.innerHTML = html;
  }

  function decorateTopFive() {
    document.querySelectorAll("#topFive .pick-card").forEach(card => {
      const name = card.querySelector(".pick-name")?.textContent?.trim();
      const meta = card.querySelector(".pick-meta");
      if (!name || !meta) return;
      let row = card.querySelector(".scout-adp-row");
      if (!row) {
        row = document.createElement("div");
        row.className = "scout-adp-row";
        meta.insertAdjacentElement("afterend", row);
      }
      setBadgeHtml(row, badge(name));
    });
  }

  function decorateBoard() {
    document.querySelectorAll("#playerBoard .player-row").forEach(row => {
      const name = row.querySelector(".pname")?.textContent?.trim();
      const meta = row.querySelector(".pmeta");
      if (!name || !meta) return;
      let adp = row.querySelector(".scout-board-adp");
      if (!adp) {
        adp = document.createElement("div");
        adp.className = "scout-board-adp";
        meta.insertAdjacentElement("afterend", adp);
      }
      setBadgeHtml(adp, badge(name));
    });
  }

  function addSourceNote() {
    const legend = document.querySelector("#bestAvailableCard .board-legend");
    if (!legend || legend.querySelector(".adp-source-note")) return;
    const note = document.createElement("span");
    note.className = "adp-source-note";
    note.textContent = "ADP: recent HALF mock-draft market · updated Aug. 29";
    legend.appendChild(note);
  }

  let refreshQueued = false;
  function refresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      decorateTopFive();
      decorateBoard();
      addSourceNote();
    });
  }

  if (!document.getElementById("scoutAdpStyleV471")) {
    const style = document.createElement("style");
    style.id = "scoutAdpStyleV471";
    style.textContent = `
      .scout-adp-row,.scout-board-adp{display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-top:4px}
      .scout-adp,.scout-adp-value{display:inline-block;border-radius:999px;padding:3px 6px;font-size:8px;font-weight:950;letter-spacing:.02em;border:1px solid var(--line)}
      .scout-adp{color:#d7e8e1;background:rgba(255,255,255,.05)}
      .scout-adp-value.great{color:#9ff0bd;border-color:rgba(88,197,139,.55);background:rgba(88,197,139,.12)}
      .scout-adp-value.value{color:#b8edcc;border-color:rgba(88,197,139,.38);background:rgba(88,197,139,.08)}
      .scout-adp-value.fair{color:#f1d181;border-color:rgba(230,189,99,.38);background:rgba(230,189,99,.08)}
      .scout-adp-value.early,.scout-adp-value.reach{color:#ffb0a8;border-color:rgba(239,118,118,.38);background:rgba(239,118,118,.08)}
      .adp-source-note{opacity:.85}
      @media(max-width:620px){.scout-adp,.scout-adp-value{font-size:7px;padding:2px 5px}.scout-board-adp{margin-top:3px}}
    `;
    document.head.appendChild(style);
  }

  const top = document.getElementById("topFive");
  const board = document.getElementById("playerBoard");
  if (top && "MutationObserver" in window) new MutationObserver(refresh).observe(top,{childList:true,subtree:true});
  if (board && "MutationObserver" in window) new MutationObserver(refresh).observe(board,{childList:true,subtree:true});
  const counter = document.getElementById("pickCounter");
  if (counter && "MutationObserver" in window) new MutationObserver(refresh).observe(counter,{childList:true,subtree:true,characterData:true});
  document.addEventListener("click", () => setTimeout(refresh,0));
  document.addEventListener("change", () => setTimeout(refresh,0));
  refresh();
})();
