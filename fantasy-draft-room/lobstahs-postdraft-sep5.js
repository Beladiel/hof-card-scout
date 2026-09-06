(() => {
  if (window.SCOUT_ACTIVE_LEAGUE !== "lobstahs") return;
  const MARKER="scoutFantasyLobstahsPostDraftSeed2026Sep5V2";
  if(localStorage.getItem(MARKER)==="1") return;
  const DRAFT_KEY="scoutFantasyDraftRoom2026V2", META_KEY="scoutFantasyLeagueRosters2026V1", HOME_SLOT=8;
  const raw=`PrimeK|2|Lamar Jackson~QB~Bal~QB;Breece Hall~RB~NYJ~RB;TreVeyon Henderson~RB~NE~RB;Puka Nacua~WR~LAR~WR;CeeDee Lamb~WR~Dal~WR;Tyler Warren~TE~Ind~TE;Drake London~WR~Atl~W/R/T;Cam Little~K~Jax~K;New England Patriots D/ST~DEF~NE~DEF;Jaylen Warren~RB~Pit~BN;Brian Thomas Jr.~WR~Jax~BN;Trevor Lawrence~QB~Jax~BN;Kyle Monangai~RB~Chi~BN;Dallas Goedert~TE~Phi~BN;Quentin Johnston~WR~LAC~BN
QB Sneak mike|3|Matthew Stafford~QB~LAR~QB;Christian McCaffrey~RB~SF~RB;De'Von Achane~RB~Mia~RB;Rashee Rice~WR~KC~WR;Emeka Egbuka~WR~TB~WR;Kyle Pitts~TE~Atl~TE;Javonte Williams~RB~Dal~W/R/T;Jason Myers~K~Sea~K;Jacksonville Jaguars D/ST~DEF~Jax~DEF;Patrick Mahomes~QB~KC~BN;Jameson Williams~WR~Det~BN;Tony Pollard~RB~Ten~BN;Stefon Diggs~WR~Was~BN;Josh Jacobs~RB~GB~BN;Hunter Henry~TE~NE~BN
Five of Everthing|4|Kyler Murray~QB~Min~QB;Jahmyr Gibbs~RB~Det~RB;Ashton Jeanty~RB~LV~RB;A.J. Brown~WR~NE~WR;Christian Watson~WR~GB~WR;Isaiah Likely~TE~NYG~TE;D'Andre Swift~RB~Chi~W/R/T;Evan McPherson~K~Cin~K;Denver Broncos D/ST~DEF~Den~DEF;Rhamondre Stevenson~RB~NE~BN;Mike Evans~WR~SF~BN;Rico Dowdle~RB~Pit~BN;Carnell Tate~WR~Ten~BN;KC Concepcion~WR~Cle~BN;Chris Bell~WR~Mia~BN
2-Inch Vertical|5|Joe Burrow~QB~Cin~QB;James Cook~RB~Buf~RB;Omarion Hampton~RB~LAC~RB;Malik Nabers~WR~NYG~WR;Terry McLaurin~WR~Was~WR;George Kittle~TE~SF~TE;Jeremiyah Love~RB~Ari~W/R/T;Cameron Dicker~K~LAC~K;Philadelphia Eagles D/ST~DEF~Phi~DEF;Rome Odunze~WR~Chi~BN;Marvin Harrison Jr.~WR~Ari~BN;Dalton Kincaid~TE~Buf~BN;Brock Purdy~QB~SF~BN;Aaron Jones~RB~Min~BN;Xavier Worthy~WR~KC~BN
Yesterdays News|6|Justin Herbert~QB~LAC~QB;Kyren Williams~RB~LAR~RB;Cam Skattebo~RB~NYG~RB;Ja'Marr Chase~WR~Cin~WR;Nico Collins~WR~Hou~WR;Tucker Kraft~TE~GB~TE;Garrett Wilson~WR~NYJ~W/R/T;Brandon Aubrey~K~Dal~K;Seattle Seahawks D/ST~DEF~Sea~DEF;Jadarian Price~RB~Sea~BN;Alec Pierce~WR~Ind~BN;Travis Kelce~TE~KC~BN;Josh Downs~WR~Ind~BN;Mike Washington~RB~LV~BN;Michael Pittman~WR~Pit~BN
The kidney punchers|7|Drake Maye~QB~NE~QB;Jonathan Taylor~RB~Ind~RB;Quinshon Judkins~RB~Cle~RB;Justin Jefferson~WR~Min~WR;DeVonta Smith~WR~Phi~WR;Sam LaPorta~TE~Det~TE;Tee Higgins~WR~Cin~W/R/T;Tyler Loop~K~Bal~K;Los Angeles Chargers D/ST~DEF~LAC~DEF;Jonathon Brooks~RB~Car~BN;J.K. Dobbins~RB~Den~BN;Jordan Mason~RB~Min~BN;De'Zhaun Stribling~WR~SF~BN;Tyler Allgeier~RB~Ari~BN;Jordyn Tyson~WR~NO~BN
AC Good Guys|8|Josh Allen~QB~Buf~QB;Derrick Henry~RB~Bal~RB;Kenneth Walker III~RB~KC~RB;Zay Flowers~WR~Bal~WR;Davante Adams~WR~LAR~WR;Harold Fannin Jr.~TE~Cle~TE;David Montgomery~RB~Hou~W/R/T;Ka'imi Fairbairn~K~Hou~K;Houston Texans D/ST~DEF~Hou~DEF;Courtland Sutton~WR~Den~BN;Jared Goff~QB~Det~BN;Jordan Addison~WR~Min~BN;Brenton Strange~TE~Jax~BN;Matthew Golden~WR~GB~BN;Los Angeles Rams D/ST~DEF~LAR~BN
Lobstahs|1|Jayden Daniels~QB~Was~QB;Chase Brown~RB~Cin~RB;Bhayshul Tuten~RB~Jax~RB;Amon-Ra St. Brown~WR~Det~WR;Chris Olave~WR~NO~WR;Trey McBride~TE~Ari~TE;Tetairoa McMillan~WR~Car~W/R/T;Will Reichard~K~Min~K;Minnesota Vikings D/ST~DEF~Min~DEF;Parker Washington~WR~Jax~BN;DK Metcalf~WR~Pit~BN;RJ Harvey~RB~Den~BN;Jayden Reed~WR~GB~BN;Kenny Gainwell~RB~TB~BN;Jake Ferguson~TE~Dal~BN
Zoomies|9|Jalen Hurts~QB~Phi~QB;Saquon Barkley~RB~Phi~RB;Travis Etienne~RB~NO~RB;Jaxon Smith-Njigba~WR~Sea~WR;Luther Burden III~WR~Chi~WR;Colston Loveland~TE~Chi~TE;Bucky Irving~RB~TB~W/R/T;Jake Bates~K~Det~K;Baltimore Ravens D/ST~DEF~Bal~DEF;Chris Godwin~WR~TB~BN;Michael Wilson~WR~Ari~BN;Blake Corum~RB~LAR~BN;Mark Andrews~TE~Bal~BN;Jaxson Dart~QB~NYG~BN;Makai Lemon~WR~Phi~BN
End Zone Ryan|10|Caleb Williams~QB~Chi~QB;Bijan Robinson~RB~Atl~RB;MarShawn Lloyd~RB~GB~RB;George Pickens~WR~Dal~WR;Jaylen Waddle~WR~Den~WR;Brock Bowers~TE~LV~TE;Ladd McConkey~WR~LAC~W/R/T;Harrison Mevis~K~LAR~K;Pittsburgh Steelers D/ST~DEF~Pit~DEF;DJ Moore~WR~Buf~BN;Chuba Hubbard~RB~Car~BN;Dak Prescott~QB~Dal~BN;Jacory Croskey-Merritt~RB~Was~BN;Chris Rodriguez Jr.~RB~Jax~BN;Juwan Johnson~TE~NO~BN`;
  const teams=raw.trim().split("\n").map(line=>{
    const [name,yahooTeamId,players]=line.split("|");
    return {name,yahooTeamId:Number(yahooTeamId),roster:players.split(";").map(x=>{
      const [player,pos,team,slot]=x.split("~"); return [player,pos,team,slot];
    })};
  });
  const drafted={},overrides={},customPlayers={},mine=[];
  teams.forEach((t,i)=>{
    const owner=i+1;
    t.roster.forEach(([name,pos,nfl,slot])=>{
      drafted[name]=owner===HOME_SLOT?"mine":`team${owner}`;
      overrides[name]=owner;
      customPlayers[name]={team:nfl,pos,owner,slot};
      if(owner===HOME_SLOT) mine.push(name);
    });
  });
  let priorMeta={};
  try{priorMeta=JSON.parse(localStorage.getItem(META_KEY)||"{}")||{};}catch{}
  const notes=Array.from({length:10},(_,i)=>priorMeta.notes?.[i]||"");
  notes[HOME_SLOT-1]="Pending FAAB waiver: Keaton Mitchell for Jake Ferguson. Ferguson remains rostered unless the claim wins.";
  const moves=Array.isArray(priorMeta.moves)?priorMeta.moves.slice():[];
  moves.unshift({at:new Date().toISOString(),text:"Imported all 10 Yahoo Week 1 rosters for the Lobstahs league (Sep. 5, 2026)."});
  moves.unshift({at:new Date().toISOString(),text:"Pending FAAB waiver claim: Keaton Mitchell in / Jake Ferguson out if successful."});
  const pendingWaivers=(Array.isArray(priorMeta.pendingWaivers)?priorMeta.pendingWaivers:[]).filter(x=>x?.id!=="sep5-keaton-for-ferguson");
  pendingWaivers.unshift({id:"sep5-keaton-for-ferguson",status:"pending",add:"Keaton Mitchell",drop:"Jake Ferguson",submittedAt:"2026-09-05"});
  const draftState={drafted,mine,history:[],draftSlot:String(HOME_SLOT),mode:"live",mockActive:false,userPicks:[]};
  const metaState={...priorMeta,teamNames:teams.map(t=>t.name),notes,overrides,customPlayers,moves:moves.slice(0,80),homeNamedSlot:HOME_SLOT,pendingWaivers,yahooTeamIds:teams.map(t=>t.yahooTeamId),rosterSource:"Yahoo Prize Prestige 1384925 · Week 1 Starting Rosters",rosterImportedAt:"2026-09-05",rosterImportVersion:2};
  localStorage.setItem(DRAFT_KEY,JSON.stringify(draftState));
  localStorage.setItem(META_KEY,JSON.stringify(metaState));
  localStorage.setItem(MARKER,"1");
  location.reload();
})();
