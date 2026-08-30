(() => {
  if (window.SCOUT_ACTIVE_LEAGUE !== "redgreen") return;
  const MARKER="scoutFantasyRedGreenPostDraftSeed2026Aug30V1";
  if(localStorage.getItem(MARKER)==="1") return;
  const DRAFT_KEY="scoutFantasyDraftRoom2026V2";
  const META_KEY="scoutFantasyLeagueRosters2026V1";
  const teams=[{"name":"Red or Green Machine","yahooTeamId":8,"roster":[["Joe Burrow","QB","Cin"],["Jahmyr Gibbs","RB","Det"],["Ashton Jeanty","RB","LV"],["Rashee Rice","WR","KC"],["DK Metcalf","WR","Pit"],["Trey McBride","TE","Ari"],["Josh Jacobs","RB","GB"],["Cam Little","K","Jax"],["Steelers","DEF","Pit"],["TreVeyon Henderson","RB","NE"],["Rhamondre Stevenson","RB","NE"],["Jayden Reed","WR","GB"],["Jordan Mason","RB","Min"],["Kyler Murray","QB","Min"],["KC Concepcion","WR","Cle"]]},{"name":"Gimme Yo 5 dollars","yahooTeamId":1,"roster":[["Jayden Daniels","QB","Was"],["Jonathan Taylor","RB","Ind"],["Bhayshul Tuten","RB","Jax"],["Justin Jefferson","WR","Min"],["Nico Collins","WR","Hou"],["Tucker Kraft","TE","GB"],["Emeka Egbuka","WR","TB"],["Tyler Loop","K","Bal"],["Vikings","DEF","Min"],["Mike Evans","WR","SF"],["Carnell Tate","WR","Ten"],["Chuba Hubbard","RB","Car"],["Brock Purdy","QB","SF"],["Isaiah Likely","TE","NYG"],["Makai Lemon","WR","Phi"]]},{"name":"Blitz Squad Brandon","yahooTeamId":2,"roster":[["Jalen Hurts","QB","Phi"],["Bijan Robinson","RB","Atl"],["Travis Etienne Jr.","RB","NO"],["Drake London","WR","Atl"],["Tee Higgins","WR","Cin"],["Brock Bowers","TE","LV"],["Jadarian Price","RB","Sea"],["Ka'imi Fairbairn","K","Hou"],["Texans","DEF","Hou"],["Marvin Harrison Jr.","WR","Ari"],["Rico Dowdle","RB","Pit"],["Michael Pittman Jr.","WR","Pit"],["Matthew Golden","WR","GB"],["Baker Mayfield","QB","TB"],["Hunter Henry","TE","NE"]]},{"name":"Largolobster 🦞","yahooTeamId":3,"roster":[["Jaxson Dart","QB","NYG"],["De'Von Achane","RB","Mia"],["Bucky Irving","RB","TB"],["CeeDee Lamb","WR","Dal"],["Zay Flowers","WR","Bal"],["Juwan Johnson","TE","NO"],["Parker Washington","WR","Jax"],["Harrison Mevis","K","LAR"],["Rams","DEF","LAR"],["Trevor Lawrence","QB","Jax"],["Tyler Warren","TE","Ind"],["Chris Olave","WR","NO"],["Michael Wilson","WR","Ari"],["Kenny Gainwell","RB","TB"],["Wan'Dale Robinson","WR","Ten"]]},{"name":"Immaculate Joseph","yahooTeamId":4,"roster":[["Josh Allen","QB","Buf"],["Saquon Barkley","RB","Phi"],["Javonte Williams","RB","Dal"],["Jaxon Smith-Njigba","WR","Sea"],["Garrett Wilson","WR","NYJ"],["George Kittle","TE","SF"],["Davante Adams","WR","LAR"],["Chase McLaughlin","K","TB"],["Jaguars","DEF","Jax"],["Christian Watson","WR","GB"],["Jonathon Brooks","RB","Car"],["Alec Pierce","WR","Ind"],["RJ Harvey","RB","Den"],["Matthew Stafford","QB","LAR"],["Mike Washington Jr.","RB","LV"]]},{"name":"bros22","yahooTeamId":5,"roster":[["Dak Prescott","QB","Dal"],["Omarion Hampton","RB","LAC"],["David Montgomery","RB","Hou"],["Puka Nacua","WR","LAR"],["Tetairoa McMillan","WR","Car"],["Sam LaPorta","TE","Det"],["Jeremiyah Love","RB","Ari"],["Brandon Aubrey","K","Dal"],["Seahawks","DEF","Sea"],["Rome Odunze","WR","Chi"],["Patrick Mahomes","QB","KC"],["Jake Ferguson","TE","Dal"],["Jakobi Meyers","WR","Jax"],["Romeo Doubs","WR","NE"],["Broncos","DEF","Den"]]},{"name":"Bleed Orange","yahooTeamId":6,"roster":[["Drake Maye","QB","NE"],["Christian McCaffrey","RB","SF"],["Kyren Williams","RB","LAR"],["A.J. Brown","WR","NE"],["Ladd McConkey","WR","LAC"],["Travis Kelce","TE","KC"],["Cam Skattebo","RB","NYG"],["Jason Myers","K","Sea"],["Lions","DEF","Det"],["Luther Burden III","WR","Chi"],["J.K. Dobbins","RB","Den"],["Brian Thomas Jr.","WR","Jax"],["Courtland Sutton","WR","Den"],["Mark Andrews","TE","Bal"],["MarShawn Lloyd","RB","GB"]]},{"name":"Da OTC ☝🏾","yahooTeamId":7,"roster":[["Justin Herbert","QB","LAC"],["Derrick Henry","RB","Bal"],["D'Andre Swift","RB","Chi"],["Ja'Marr Chase","WR","Cin"],["George Pickens","WR","Dal"],["Kyle Pitts Sr.","TE","Atl"],["Jaylen Waddle","WR","Den"],["Cameron Dicker","K","LAC"],["Patriots","DEF","NE"],["Jaylen Warren","RB","Pit"],["Jacory Croskey-Merritt","RB","Was"],["Jordan Addison","WR","Min"],["Dalton Kincaid","TE","Buf"],["Jared Goff","QB","Det"],["Jalen Coker","WR","Car"]]},{"name":"Sack Dance Brian","yahooTeamId":9,"roster":[["Caleb Williams","QB","Chi"],["Kenneth Walker III","RB","KC"],["Quinshon Judkins","RB","Cle"],["Amon-Ra St. Brown","WR","Det"],["Malik Nabers","WR","NYG"],["Colston Loveland","TE","Chi"],["DeVonta Smith","WR","Phi"],["Will Reichard","K","Min"],["Eagles","DEF","Phi"],["Jameson Williams","WR","Det"],["Chris Godwin Jr.","WR","TB"],["Blake Corum","RB","LAR"],["Bo Nix","QB","Den"],["Dallas Goedert","TE","Phi"],["Kyle Monangai","RB","Chi"]]},{"name":"I Chase Brown Kids","yahooTeamId":10,"roster":[["Lamar Jackson","QB","Bal"],["James Cook III","RB","Buf"],["Chase Brown","RB","Cin"],["Terry McLaurin","WR","Was"],["DJ Moore","WR","Buf"],["Harold Fannin Jr.","TE","Cle"],["Breece Hall","RB","NYJ"],["Chargers","DEF","LAC"],["Tony Pollard","RB","Ten"],["Josh Downs","WR","Ind"],["De'Zhaun Stribling","WR","SF"],["Stefon Diggs","WR","Was"],["Quentin Johnston","WR","LAC"],["Aaron Jones Sr.","RB","Min"],["Zach Charbonnet","RB","Sea"]]}];
  const alias={"Travis Etienne Jr.":"Travis Etienne","Michael Pittman Jr.":"Michael Pittman","Kyle Pitts Sr.":"Kyle Pitts","James Cook III":"James Cook","Chris Godwin Jr.":"Chris Godwin","Mike Washington Jr.":"Mike Washington","Vikings":"Minnesota Vikings D/ST","Texans":"Houston Texans D/ST","Rams":"Los Angeles Rams D/ST","Jaguars":"Jacksonville Jaguars D/ST","Seahawks":"Seattle Seahawks D/ST","Broncos":"Denver Broncos D/ST","Lions":"Detroit Lions D/ST","Patriots":"New England Patriots D/ST","Steelers":"Pittsburgh Steelers D/ST","Eagles":"Philadelphia Eagles D/ST","Chargers":"Los Angeles Chargers D/ST"};
  const drafted={},overrides={},customPlayers={},mine=[];
  teams.forEach((t,i)=>{
    const owner=i+1;
    t.roster.forEach(([raw,pos,nfl])=>{
      const name=alias[raw]||raw;
      drafted[name]=owner===1?"mine":`team${owner}`;
      overrides[name]=owner;
      customPlayers[name]={team:nfl,pos,owner};
      if(owner===1) mine.push(name);
    });
  });
  let priorDraft={},priorMeta={};
  try{priorDraft=JSON.parse(localStorage.getItem(DRAFT_KEY)||"{}")||{};}catch{}
  try{priorMeta=JSON.parse(localStorage.getItem(META_KEY)||"{}")||{};}catch{}
  const draftState={...priorDraft,drafted,mine,history:[],draftSlot:"1",mode:"live",mockActive:false,userPicks:mine.slice()};
  const moves=Array.isArray(priorMeta.moves)?priorMeta.moves.slice():[];
  moves.unshift({at:new Date().toISOString(),text:"Imported final Yahoo draft rosters for Red or Green Machine league (Aug. 30, 2026)."});
  const metaState={
    ...priorMeta,
    teamNames:teams.map(t=>t.name),
    notes:Array.from({length:10},(_,i)=>priorMeta.notes?.[i]||""),
    overrides,customPlayers,moves:moves.slice(0,80),homeNamedSlot:1,
    yahooTeamIds:teams.map(t=>t.yahooTeamId),
    rosterSource:"Yahoo league 1464991",rosterImportedAt:"2026-08-30",rosterImportVersion:1
  };
  localStorage.setItem(DRAFT_KEY,JSON.stringify(draftState));
  localStorage.setItem(META_KEY,JSON.stringify(metaState));
  localStorage.setItem(MARKER,"1");
})();
