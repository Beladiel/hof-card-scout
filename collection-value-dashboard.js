(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.ScoutCollectionValueDashboard=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  const MAX_HISTORY=48;

  function cents(v){
    const n=Number(v);
    return Number.isFinite(n)?Math.round(n*100)/100:null;
  }
  function paidAmount(p){
    if(p?.pricePaid===null||p?.pricePaid===undefined||p?.pricePaid==="")return null;
    const n=Number(p.pricePaid);
    return Number.isFinite(n)&&n>=0?n:null;
  }
  function summarize(players,valueApi){
    const owned=(Array.isArray(players)?players:[]).filter(p=>p&&p.owned);
    let estimatedValue=0,valuedCount=0,matchedCostBasis=0,matchedCurrentValue=0,matchedCount=0;

    for(const p of owned){
      const snapshots=valueApi&&typeof valueApi.currentCardSnapshots==="function"
        ? valueApi.currentCardSnapshots(p)
        : [];
      const latest=snapshots.length?snapshots[snapshots.length-1]:null;
      const value=Number(latest?.value);
      if(!Number.isFinite(value)||value<=0)continue;

      valuedCount++;
      estimatedValue+=value;
      const paid=paidAmount(p);
      if(paid!==null){
        matchedCount++;
        matchedCostBasis+=paid;
        matchedCurrentValue+=value;
      }
    }

    const gainLoss=matchedCount?matchedCurrentValue-matchedCostBasis:null;
    const gainLossPct=matchedCount&&matchedCostBasis>0?(gainLoss/matchedCostBasis)*100:null;
    return {
      ownedCount:owned.length,
      valuedCount,
      unvaluedCount:Math.max(0,owned.length-valuedCount),
      coveragePct:owned.length?Math.round((valuedCount/owned.length)*1000)/10:0,
      estimatedValue:valuedCount?cents(estimatedValue):null,
      matchedCount,
      matchedCostBasis:matchedCount?cents(matchedCostBasis):null,
      matchedCurrentValue:matchedCount?cents(matchedCurrentValue):null,
      gainLoss:gainLoss===null?null:cents(gainLoss),
      gainLossPct:gainLossPct===null?null:Math.round(gainLossPct*10)/10
    };
  }
  function snapshotForSummary(summary,now){
    if(!summary||!Number.isFinite(Number(summary.estimatedValue))||Number(summary.estimatedValue)<=0||Number(summary.valuedCount)<1)return null;
    const d=now instanceof Date?now:new Date(now||Date.now());
    if(Number.isNaN(d.getTime()))return null;
    return {
      at:d.toISOString(),
      value:cents(summary.estimatedValue),
      valuedCount:Math.max(0,Math.floor(Number(summary.valuedCount)||0)),
      ownedCount:Math.max(0,Math.floor(Number(summary.ownedCount)||0)),
      coveragePct:Math.round((Number(summary.coveragePct)||0)*10)/10,
      matchedCostBasis:summary.matchedCostBasis===null?null:cents(summary.matchedCostBasis),
      matchedCount:Math.max(0,Math.floor(Number(summary.matchedCount)||0))
    };
  }
  function thinHistory(rows,max=MAX_HISTORY){
    max=Math.max(3,Number(max)||MAX_HISTORY);
    if(rows.length<=max)return rows;
    const keepLatest=Math.min(18,max-2);
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
  function mergeHistory(history,snapshot,max=MAX_HISTORY){
    const rows=(Array.isArray(history)?history:[])
      .filter(x=>x&&x.at&&Number.isFinite(Number(x.value))&&Number(x.value)>0)
      .map(x=>({...x,value:cents(x.value)}));
    if(!snapshot)return thinHistory(rows,max);
    const day=String(snapshot.at).slice(0,10);
    const idx=rows.findIndex(x=>String(x.at).slice(0,10)===day);
    if(idx>=0)rows[idx]=snapshot;
    else rows.push(snapshot);
    rows.sort((a,b)=>String(a.at).localeCompare(String(b.at)));
    return thinHistory(rows,max);
  }

  return {summarize,MAX_HISTORY,snapshotForSummary,mergeHistory};
});
