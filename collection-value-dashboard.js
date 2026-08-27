(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.ScoutCollectionValueDashboard=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
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
  return {summarize};
});
