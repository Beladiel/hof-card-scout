(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.ScoutCollectionValue=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  const MAX_HISTORY=24;

  function clean(v){return String(v==null?"":v).trim()}
  function norm(v){return clean(v).toLowerCase().replace(/[^a-z0-9]+/g,"")}
  function cents(v){
    if(v===null||v===undefined||v==="")return null;
    const n=Number(v);
    return Number.isFinite(n)?Math.round(n*100)/100:null;
  }
  function numericGrade(v){
    const m=clean(v).match(/(?:^|\s)(10|9\.5|9|8\.5|8|7\.5|7|6\.5|6|5\.5|5|4\.5|4|3\.5|3|2\.5|2|1\.5|1)(?:\s|$)/);
    return m?String(Number(m[1])):"";
  }
  function graderFrom(value,description){
    let g=clean(value);
    if(!g||/^raw$/i.test(g)){
      const d=clean(description).toUpperCase();
      const found=["PSA","SGC","BGS","BECKETT","CGC","CSG","HGA","TAG","ISA"].find(x=>new RegExp("\\b"+x+"\\b").test(d));
      if(found)g=found;
    }
    const u=g.toUpperCase();
    if(!u||u==="RAW")return "Raw";
    if(u==="BGS"||u==="BECKETT"||u.startsWith("BGS /"))return "BGS / Beckett";
    return g.toUpperCase();
  }
  function descriptionHasAuto(description){return /\b(?:autograph|auto|signed)\b/i.test(clean(description))}
  function descriptionHasRelic(description){return /\b(?:relic|memorabilia|piece of (?:bat|jersey)|game[- ]used (?:bat|jersey))\b/i.test(clean(description))}

  function representativeVariant(p){
    p=p||{};
    const grader=graderFrom(p.grader,p.description);
    const grade=grader==="Raw"?"":(clean(p.gradeCondition)||numericGrade(p.description));
    return {
      year:Number.isFinite(Number(p.cardYear))?Number(p.cardYear):null,
      set:clean(p.set),
      cardNum:clean(p.cardNum),
      grader,
      grade,
      serial:clean(p.serial),
      autograph:!!p.autograph||descriptionHasAuto(p.description),
      relic:!!p.relic||descriptionHasRelic(p.description)
    };
  }
  function cardVariant(card){
    card=card||{};
    const grader=graderFrom(card.grader,card.notes);
    return {
      year:Number.isFinite(Number(card.year))?Number(card.year):null,
      set:clean(card.set),
      cardNum:clean(card.cardNum),
      grader,
      grade:grader==="Raw"?"":clean(card.grade),
      serial:clean(card.serial),
      autograph:!!card.autograph,
      relic:!!card.relic
    };
  }
  function variantKey(name,v){
    const raw=[clean(name),v.year||"",norm(v.set),norm(v.cardNum),norm(v.grader),norm(v.grade),norm(v.serial),v.autograph?"a":"",v.relic?"r":""].join("|");
    let h=2166136261;
    for(let i=0;i<raw.length;i++){
      h^=raw.charCodeAt(i);
      h=Math.imul(h,16777619);
    }
    return (h>>>0).toString(16).padStart(8,"0");
  }
  function fingerprintForPlayer(p){return variantKey(p?.name||"",representativeVariant(p))}
  function fingerprintForCard(name,card){return variantKey(name||card?.player||"",cardVariant(card))}
  function exactRepresentativeMatch(p,card){
    if(!p||!p.owned||!card)return false;
    const a=representativeVariant(p),b=cardVariant(card);
    return Number(a.year)===Number(b.year)&&
      norm(a.set)===norm(b.set)&&
      norm(a.cardNum)===norm(b.cardNum)&&
      norm(a.grader)===norm(b.grader)&&
      norm(a.grade)===norm(b.grade)&&
      norm(a.serial)===norm(b.serial)&&
      a.autograph===b.autograph&&a.relic===b.relic;
  }
  function reliableValuation(data){
    const median=Number(data?.median),used=Number(data?.used)||0;
    const confidence=clean(data?.confidence).toLowerCase();
    return Number.isFinite(median)&&median>0&&used>=2&&confidence!=="insufficient";
  }
  function snapshotForPlayer(p,data,now){
    if(!reliableValuation(data))return null;
    const d=now instanceof Date?now:new Date(now||Date.now());
    if(Number.isNaN(d.getTime()))return null;
    return {
      at:d.toISOString(),
      value:cents(data.median),
      low:cents(data.low),
      high:cents(data.high),
      comps:Number(data.used)||0,
      confidence:clean(data.confidence).toLowerCase()||"low",
      cardKey:fingerprintForPlayer(p)
    };
  }
  function thinHistory(rows,max){
    max=Math.max(3,Number(max)||MAX_HISTORY);
    if(rows.length<=max)return rows;
    const keepLatest=Math.min(12,max-2);
    const older=rows.slice(0,-keepLatest);
    const latest=rows.slice(-keepLatest);
    const slots=max-keepLatest;
    const sampled=[];
    for(let i=0;i<slots;i++){
      const idx=slots===1?0:Math.round(i*(older.length-1)/(slots-1));
      if(older[idx]&&!sampled.includes(older[idx]))sampled.push(older[idx]);
    }
    return [...sampled,...latest].sort((a,b)=>String(a.at).localeCompare(String(b.at))).slice(-max);
  }
  function mergeSnapshot(history,snapshot,max=MAX_HISTORY){
    const rows=(Array.isArray(history)?history:[]).filter(x=>x&&x.at&&Number.isFinite(Number(x.value))&&x.cardKey);
    if(!snapshot)return thinHistory(rows,max);
    const day=snapshot.at.slice(0,10);
    const idx=rows.findIndex(x=>x.cardKey===snapshot.cardKey&&String(x.at).slice(0,10)===day);
    if(idx>=0)rows[idx]=snapshot;
    else rows.push(snapshot);
    rows.sort((a,b)=>String(a.at).localeCompare(String(b.at)));
    return thinHistory(rows,max);
  }
  function buildTrackingPatch(p,data,now){
    const snapshot=snapshotForPlayer(p,data,now);
    if(!snapshot)return null;
    const history=mergeSnapshot(p?.valuationHistory,snapshot,MAX_HISTORY);
    return {
      median:snapshot.value,
      low:snapshot.low,
      high:snapshot.high,
      comps:snapshot.comps,
      confidence:snapshot.confidence,
      lastChecked:(now instanceof Date?now:new Date(now||Date.now())).toLocaleDateString(),
      valuationUpdatedAt:snapshot.at,
      valuationCardKey:snapshot.cardKey,
      valuationHistory:history
    };
  }
  function currentCardSnapshots(p){
    const key=fingerprintForPlayer(p);
    return (Array.isArray(p?.valuationHistory)?p.valuationHistory:[]).filter(x=>x&&x.cardKey===key&&Number.isFinite(Number(x.value))).sort((a,b)=>String(a.at).localeCompare(String(b.at)));
  }
  function gainLoss(pricePaid,currentValue){
    if(pricePaid===null||pricePaid===undefined||pricePaid===""||currentValue===null||currentValue===undefined||currentValue==="")return null;
    const paid=Number(pricePaid),value=Number(currentValue);
    if(!Number.isFinite(paid)||paid<0||!Number.isFinite(value)||value<=0)return null;
    const amount=cents(value-paid);
    const pct=paid>0?Math.round((amount/paid)*1000)/10:null;
    return {amount,pct};
  }

  return {
    MAX_HISTORY,
    representativeVariant,
    cardVariant,
    fingerprintForPlayer,
    fingerprintForCard,
    exactRepresentativeMatch,
    reliableValuation,
    snapshotForPlayer,
    mergeSnapshot,
    buildTrackingPatch,
    currentCardSnapshots,
    gainLoss
  };
});
