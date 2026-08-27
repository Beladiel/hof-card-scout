(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.ScoutCollectionIntelligence=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const VERSION=2;
  const RETROSPECTIVE_PATTERNS=[
    {rx:/\b(?:195\d|196\d|197\d|198\d|199\d|200\d|201\d|202\d)?\s*topps\s+archives\b/i,label:"archive / reprint-style issue",points:18},
    {rx:/\b(?:archives|reprint|reprints|retro|throwback)\b/i,label:"archive / reprint-style issue",points:18},
    {rx:/\b(?:circle\s*k|k[- ]?mart|action\s+packed)\b/i,label:"retrospective issue",points:14},
    {rx:/\b(?:tribute|legends?|heritage)\b/i,label:"modern tribute-style issue",points:10}
  ];
  const SEVERE_CONDITION_RX=/\b(?:crease(?:d|s)?|rough\s*shape|poor|damaged|damage|dent(?:ed)?|torn|tear|stain(?:ed)?|miscut|writing|written|paper\s+loss)\b/i;
  const MODERATE_CONDITION_RX=/\b(?:fair|good\s*condition|corner\s+wear|wear|off[- ]?center|surface|scratch|chipping)\b/i;
  const ROOKIE_RX=/\b(?:rookie|rc)\b/i;
  const VERIFIED_ROOKIE_RX=/\bverified\s+rookie\b/i;
  const SHORT_PRINT_RX=/\b(?:short\s*print|\bsp\b|numbered|\b\d{1,4}\s*\/\s*\d{1,5}\b)\b/i;
  const AUTOGRAPH_RX=/\b(?:auto|autograph|autographed|signature|signed)\b/i;
  const AUTHENTICATED_AUTO_RX=/\b(?:authenticated|authentication|psa\s*\/\s*dna|psa\s+dna|jsa|beckett\s+authentication|\bbas\b|certified\s+(?:auto|autograph)|topps\s+certified\s+autograph|upper\s+deck\s+authenticated|\buda\b)\b/i;
  const GRADED_RX=/\b(?:PSA|SGC|CGC|BGS|BVG|CSG|HGA|TAG|ISA|Degree)\b/i;

  function textOf(p){
    return [p?.set,p?.description,p?.gradeCondition,p?.userNotes,p?.serial].filter(Boolean).join(" ");
  }
  function targetTextOf(p){
    return [p?.target,p?.targetNotes].filter(Boolean).join(" ");
  }
  function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
  function targetYear(p){
    const m=String(p?.target||"").match(/\b((?:18|19|20)\d{2})\b/);
    return m?Number(m[1]):null;
  }
  function candidateYear(p){
    const direct=Number(p?.cardYear??p?.year);
    if(Number.isInteger(direct))return direct;
    const m=[p?.target,p?.description,p?.set].filter(Boolean).join(" ").match(/\b((?:18|19|20)\d{2})\b/);
    return m?Number(m[1]):null;
  }
  function numericGrade(p){
    const raw=[p?.gradeCondition,p?.description].filter(Boolean).join(" ");
    const explicit=raw.match(/\b(?:PSA|SGC|CGC|BGS|BVG|CSG|HGA|TAG|ISA|Degree|graded?)\s*[:#-]?\s*(10|9\.5|9|8\.5|8|7\.5|7|6\.5|6|5\.5|5|4\.5|4|3\.5|3|2\.5|2|1\.5|1|0\.5|0)\b/i);
    if(explicit)return Number(explicit[1]);
    const plain=String(p?.gradeCondition||"").trim().match(/^(10|9\.5|9|8\.5|8|7\.5|7|6\.5|6|5\.5|5|4\.5|4|3\.5|3|2\.5|2|1\.5|1|0\.5|0)$/);
    return plain?Number(plain[1]):null;
  }
  function grader(p){
    const g=String(p?.grader||"").trim();
    if(g&&g.toLowerCase()!=="raw")return g;
    const raw=textOf(p).toUpperCase();
    for(const x of ["PSA","SGC","CGC","BGS","BVG","CSG","HGA","TAG","ISA","DEGREE"]){
      if(new RegExp("\\b"+x+"\\b").test(raw))return x;
    }
    return "Raw";
  }
  function isAutograph(p){
    return Boolean(p?.autograph)||AUTOGRAPH_RX.test(textOf(p));
  }
  function isAuthenticatedAutograph(p){
    if(!isAutograph(p))return false;
    const raw=[textOf(p),p?.grader].filter(Boolean).join(" ");
    return AUTHENTICATED_AUTO_RX.test(raw)||(grader(p)!=="Raw"&&numericGrade(p)!==null);
  }
  function retrospectiveSignal(p){
    const raw=[p?.set,p?.description].filter(Boolean).join(" ");
    for(const item of RETROSPECTIVE_PATTERNS){
      if(item.rx.test(raw))return item;
    }
    return null;
  }
  function signal(points,key,label,reason){return {points,key,label,reason}}
  function priority(score){
    if(score>=60)return "HIGH";
    if(score>=40)return "GOOD";
    return "WATCH";
  }

  function candidatePreferenceScore(candidate,currentCard={},options={}){
    const budget=Number(options.budget);
    const currentCardYear=Number(currentCard?.cardYear??currentCard?.year);
    const year=candidateYear(candidate);
    const factors=[];

    if(Number.isInteger(year)&&Number.isInteger(currentCardYear)&&year<currentCardYear){
      const gap=currentCardYear-year;
      factors.push(signal(Math.min(72,gap*1.15),"candidate_age","OLDER CARD",`${year} is ${gap} year${gap===1?"":"s"} older than the current representative.`));
    }

    const candidateTargetRaw=targetTextOf(candidate);
    const auto=isAutograph(candidate)||AUTOGRAPH_RX.test(candidateTargetRaw);
    const authenticatedAuto=auto&&(isAuthenticatedAutograph(candidate)||AUTHENTICATED_AUTO_RX.test(candidateTargetRaw)||(grader(candidate)!=="Raw"&&numericGrade(candidate)!==null));
    if(authenticatedAuto){
      factors.push(signal(28,"candidate_auth_auto","AUTHENTICATED / GRADED AUTO","A certified, authenticated, or graded autograph gets a major collector-preference boost."));
    }else if(auto){
      factors.push(signal(14,"candidate_auto","AUTOGRAPH","An autograph gets a meaningful boost, but less than a certified/authenticated or graded autograph."));
    }

    const graded=grader(candidate)!=="Raw"&&(numericGrade(candidate)!==null||GRADED_RX.test(textOf(candidate)));
    if(graded&&!authenticatedAuto){
      factors.push(signal(6,"candidate_graded","GRADED","Grading helps, but only modestly so a newer slab does not automatically beat much older cardboard."));
    }

    const raw=[textOf(candidate),targetTextOf(candidate)].filter(Boolean).join(" ");
    const verifiedRookie=VERIFIED_ROOKIE_RX.test(raw);
    const rookie=verifiedRookie||ROOKIE_RX.test(raw);
    const scarce=String(candidate?.serial||"").trim()||SHORT_PRINT_RX.test(raw);
    if(verifiedRookie)factors.push(signal(16,"candidate_rookie","VERIFIED ROOKIE","Verified rookie status is a strong plus."));
    else if(rookie)factors.push(signal(10,"candidate_rookie","ROOKIE","Rookie designation is a plus, but age still matters."));
    if(scarce)factors.push(signal(5,"candidate_scarcity","SCARCE / NUMBERED","Scarcity or numbering adds a modest preference boost."));

    const price=Number(candidate?.deliveredPrice??candidate?.totalPrice??candidate?.price);
    if(Number.isFinite(budget)&&budget>0&&Number.isFinite(price)&&price>=0){
      if(price>budget){
        factors.push(signal(-45,"candidate_budget","OVER BUDGET",`Delivered price ${price.toFixed(2)} exceeds the ${budget.toFixed(2)} budget, so Scout heavily de-prioritizes it.`));
      }else if(price<=budget*.7){
        factors.push(signal(6,"candidate_budget","COMFORTABLY AFFORDABLE",`Delivered price is comfortably inside the stated budget.`));
      }else{
        factors.push(signal(3,"candidate_budget","WITHIN BUDGET",`Delivered price is within the stated budget.`));
      }
    }

    const score=Math.round(factors.reduce((sum,s)=>sum+s.points,0)*10)/10;
    return {score,year,authenticatedAuto,autograph:auto,graded,factors};
  }

  function evaluatePlayer(p,currentYear=new Date().getFullYear()){
    if(!p||!p.owned||p.incoming)return null;
    const year=Number(p.cardYear);
    if(!Number.isInteger(year))return null;

    const induction=Number(p.induction);
    const raw=textOf(p);
    const signals=[];

    if(Number.isInteger(induction)&&year>induction){
      const gap=year-induction;
      const points=Math.min(48,12+gap*1.1);
      signals.push(signal(points,"post_induction_age","AGE OPPORTUNITY",`${year} is ${gap} year${gap===1?"":"s"} after ${p.name}'s Hall induction, a strong reason to investigate an older representative.`));
    }

    if(year>=2010)signals.push(signal(12,"modern_year","MODERN REPRESENTATIVE",`The current representative is a ${year} issue, so age-first Scout gives older cardboard a meaningful edge.`));
    else if(year>=2000)signals.push(signal(9,"modern_year","MODERN REPRESENTATIVE",`The current representative is from ${year}; an older-era card could be a more meaningful Hall representative.`));
    else if(year>=1990)signals.push(signal(5,"modern_year","LATER-ERA CARD",`The ${year} issue leaves room to investigate an earlier card without assuming a specific market price.`));
    else if(year>=1980)signals.push(signal(2,"modern_year","AGE ROOM",`The ${year} issue still leaves some room for an older representative.`));

    const retro=retrospectiveSignal(p);
    if(retro){
      signals.push(signal(retro.points,"retrospective",retro.label.toUpperCase(),`The saved card looks like a ${retro.label}, which Scout treats as a stronger candidate for an era upgrade.`));
    }

    const tYear=targetYear(p);
    if(tYear&&tYear<year){
      const gap=year-tYear;
      const points=Math.min(24,8+gap*2);
      signals.push(signal(points,"saved_target","SAVED OLDER TARGET",`You already saved ${p.target} as a target, ${gap} year${gap===1?"":"s"} older than the current representative.`));
    }

    const targetRaw=targetTextOf(p);
    if(targetRaw&&AUTOGRAPH_RX.test(targetRaw)){
      if(AUTHENTICATED_AUTO_RX.test(targetRaw)||GRADED_RX.test(targetRaw)){
        signals.push(signal(18,"saved_auto_target","SAVED AUTHENTICATED AUTO TARGET",`Your saved target is an authenticated, certified, or graded autograph — a major preference boost when it fits the budget.`));
      }else{
        signals.push(signal(10,"saved_auto_target","SAVED AUTOGRAPH TARGET",`Your saved target is an autograph, so Scout gives that upgrade direction extra weight.`));
      }
    }else if(targetRaw&&GRADED_RX.test(targetRaw)){
      signals.push(signal(5,"saved_graded_target","SAVED GRADED TARGET",`Your saved target is graded. Scout gives grading a measured boost without letting it overpower a much older card.`));
    }

    const severe=SEVERE_CONDITION_RX.test(raw);
    const moderate=!severe&&MODERATE_CONDITION_RX.test(raw);
    if(severe)signals.push(signal(year<=1969?6:12,"condition","CONDITION UPGRADE",`Your saved notes flag meaningful condition issues, so condition adds upgrade pressure without overriding vintage age.`));
    else if(moderate)signals.push(signal(year<=1969?3:6,"condition","CONDITION WATCH",`Your saved notes mention wear or condition concerns, giving this card a modest upgrade bump.`));

    const grade=numericGrade(p);
    if(grade!==null){
      let points=grade<=2?10:grade<=4?6:grade<=6?3:0;
      if(year<=1969)points=Math.round(points*.5);
      if(points>0)signals.push(signal(points,"low_grade","LOWER GRADE",`The saved grade is ${grade}; Scout considers condition, but gives true vintage cards extra protection from grade-only upgrading.`));
    }

    if(grader(p)==="Raw")signals.push(signal(2,"raw","RAW CARD",`The representative is raw. Scout gives that only a small bump; raw status alone should never outrank age.`));

    const verifiedRookie=VERIFIED_ROOKIE_RX.test(raw);
    const rookie=verifiedRookie||ROOKIE_RX.test(raw);
    const serial=String(p.serial||"").trim()||SHORT_PRINT_RX.test(raw);
    if(isAutograph(p)){
      const protectedPoints=isAuthenticatedAutograph(p)?-20:-12;
      const label=isAuthenticatedAutograph(p)?"AUTHENTICATED / GRADED AUTOGRAPH":"AUTOGRAPH VALUE";
      const reason=isAuthenticatedAutograph(p)
        ?`The representative is already an authenticated, certified, or graded autograph, which strongly lowers replacement urgency.`
        :`The representative is an autograph/signature issue, so Scout protects it from being replaced merely because it is newer.`;
      signals.push(signal(protectedPoints,"autograph",label,reason));
    }
    if(p.relic||/\b(?:relic|memorabilia|piece\s+of\s+bat|jersey)\b/i.test(raw))signals.push(signal(-8,"relic","RELIC VALUE",`The representative has memorabilia/relic value, which lowers upgrade urgency.`));
    if(serial)signals.push(signal(-6,"scarcity","SCARCE / NUMBERED",`The saved card appears numbered or scarce, so Scout reduces age-only upgrade pressure.`));
    if(verifiedRookie)signals.push(signal(-16,"rookie","VERIFIED ROOKIE",`The saved notes identify a verified rookie, which Scout strongly protects.`));
    else if(rookie)signals.push(signal(-12,"rookie","ROOKIE DESIGNATION",`The representative is saved as a rookie card, so Scout protects it from a generic age-only replacement.`));

    if(year<=1959)signals.push(signal(-16,"vintage_protection","TRUE VINTAGE",`A ${year} representative is already true vintage. Scout requires stronger reasons than grade alone to push it up the list.`));
    else if(year<=1969)signals.push(signal(-11,"vintage_protection","VINTAGE PROTECTION",`A ${year} representative already has strong age value, so Scout deliberately de-prioritizes grade-only upgrading.`));
    else if(year<=1979)signals.push(signal(-5,"vintage_protection","OLDER CARD PROTECTION",`The ${year} card already has meaningful age, so Scout applies some protection against needless upgrading.`));

    const rawScore=signals.reduce((sum,s)=>sum+s.points,0);
    const score=clamp(Math.round(rawScore),0,100);
    const positive=signals.filter(s=>s.points>0).sort((a,b)=>b.points-a.points||a.label.localeCompare(b.label));
    const protections=signals.filter(s=>s.points<0).sort((a,b)=>a.points-b.points||a.label.localeCompare(b.label));
    const topReasons=positive.slice(0,3).map(s=>s.reason);
    if(!topReasons.length)topReasons.push(`Scout does not see a strong local-data reason to replace this ${year} representative right now.`);

    return {
      version:VERSION,
      name:p.name,
      player:p,
      score,
      priority:priority(score),
      cardYear:year,
      targetYear:tYear,
      currentCard:[year,p.set,p.cardNum?"#"+p.cardNum:""] .filter(Boolean).join(" "),
      topReasons,
      positiveSignals:positive,
      protections,
      factors:signals,
      summary:topReasons.join(" ")
    };
  }

  function rankCollection(players,options={}){
    const list=Array.isArray(players)?players:[];
    const currentYear=Number(options.currentYear)||new Date().getFullYear();
    const limit=Math.max(1,Math.min(25,Number(options.limit)||5));
    return list
      .map(p=>evaluatePlayer(p,currentYear))
      .filter(Boolean)
      .sort((a,b)=>b.score-a.score||b.cardYear-a.cardYear||a.name.localeCompare(b.name))
      .slice(0,limit);
  }

  return {VERSION,evaluatePlayer,rankCollection,targetYear,candidateYear,numericGrade,grader,isAutograph,isAuthenticatedAutograph,candidatePreferenceScore};
});
