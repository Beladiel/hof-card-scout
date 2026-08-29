(() => {
  const base = Array.isArray(window.DRAFT_PLAYERS) ? window.DRAFT_PLAYERS : [];
  const deep = Array.isArray(window.DEEP_DRAFT_PLAYERS) ? window.DEEP_DRAFT_PLAYERS : [];
  const all = [...base, ...deep];
  const find = name => all.find(p => p && p.player === name);
  const ensure = player => {
    const existing = find(player.player);
    if (existing) Object.assign(existing, player);
    else deep.push(player);
  };

  ensure({rank:96,marketRank:96,player:"Courtland Sutton",team:"DEN",pos:"WR",bye:10,injury:"",tag:"VALUE",tier:"Tier 7",window:"Round 7 / 8",note:"Still a useful WR3 value even with Jaylen Waddle in Denver."});
  ensure({rank:99,marketRank:99,player:"Alec Pierce",team:"IND",pos:"WR",bye:13,injury:"Q - Ankle recovery",tag:"MONITOR",tier:"Tier 7",window:"Round 9 / 10",note:"Activated from PUP; big-play upside remains, but ankle recovery still deserves a discount."});
  ensure({rank:108,marketRank:108,player:"Kyle Monangai",team:"CHI",pos:"RB",bye:10,injury:"Q - Knee",tag:"MONITOR / HANDCUFF",tier:"Tier 8",window:"Round 10+",note:"High-upside D'Andre Swift handcuff; hyperextended knee is week-to-week, so do not reach."});
  ensure({rank:126,marketRank:126,player:"Makai Lemon",team:"PHI",pos:"WR",bye:10,injury:"Q - Undisclosed",tag:"UPSIDE",tier:"Tier 9",window:"Round 12+",note:"Rookie upside swing; include him so Yahoo mock picks can always be recorded."});
  ensure({rank:146,marketRank:146,player:"MarShawn Lloyd",team:"GB",pos:"RB",bye:11,injury:"",tag:"UPSIDE / HANDCUFF",tier:"Tier 10",window:"Round 13+",note:"Josh Jacobs handcuff with late-round contingent value."});
  ensure({rank:158,marketRank:158,player:"Juwan Johnson",team:"NO",pos:"TE",bye:8,injury:"",tag:"TE DEPTH",tier:"Tier 10",window:"Late / waiver",note:"Deep TE option included for Yahoo draft tracking."});
  ensure({rank:160,marketRank:160,player:"Theo Johnson",team:"NYG",pos:"TE",bye:8,injury:"",tag:"TE DEPTH",tier:"Tier 10",window:"Late / waiver",note:"Deep TE option behind Isaiah Likely; included for Yahoo draft tracking."});
  ensure({rank:165,marketRank:165,player:"Will Reichard",team:"MIN",pos:"K",bye:6,injury:"",tag:"K VALUE",tier:"K Tier 2",specialRank:8,window:"Final round",note:"Strong 2025 accuracy and range; a good late kicker fallback."});

  ["Dalton Kincaid","Isaiah Likely","Jake Ferguson"].forEach(name => {
    const p = find(name);
    if (p) p.tag = String(p.tag || "").includes("TARGET") ? p.tag : "TARGET TE / " + (p.tag || "VALUE");
  });

  window.DEEP_DRAFT_PLAYERS = deep;
  window.SCOUT_PLAYER_ALIASES = {
    "cortland sutton":"Courtland Sutton",
    "c sutton":"Courtland Sutton",
    "alec pierce":"Alec Pierce",
    "a pierce":"Alec Pierce",
    "k monagai":"Kyle Monangai",
    "k monangai":"Kyle Monangai",
    "monagai":"Kyle Monangai",
    "monangai":"Kyle Monangai",
    "m lloyd":"MarShawn Lloyd",
    "marshawn lloyd":"MarShawn Lloyd",
    "m lemon":"Makai Lemon",
    "makai lemon":"Makai Lemon",
    "w reichard":"Will Reichard",
    "will reichard":"Will Reichard",
    "j johnson":"Juwan Johnson",
    "juwan johnson":"Juwan Johnson",
    "t johnson":"Theo Johnson",
    "theo johnson":"Theo Johnson"
  };
})();
