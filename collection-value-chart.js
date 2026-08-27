(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.ScoutCollectionValueChart=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  function round(n){return Math.round(Number(n)*10)/10}
  function cleanRows(rows){
    return (Array.isArray(rows)?rows:[])
      .map(row=>{
        const time=new Date(row?.at).getTime();
        const value=Number(row?.value);
        if(!Number.isFinite(time)||!Number.isFinite(value)||value<=0)return null;
        return {...row,time,value};
      })
      .filter(Boolean)
      .sort((a,b)=>a.time-b.time);
  }
  function buildModel(rows,width=720,height=220){
    const values=cleanRows(rows);
    if(!values.length)return null;
    const pad={left:58,right:20,top:24,bottom:38};
    const plotW=Math.max(1,width-pad.left-pad.right);
    const plotH=Math.max(1,height-pad.top-pad.bottom);
    const rawMin=Math.min(...values.map(x=>x.value));
    const rawMax=Math.max(...values.map(x=>x.value));
    let minValue,maxValue;
    if(rawMin===rawMax){
      const spread=Math.max(1,rawMax*.08);
      minValue=Math.max(0,rawMin-spread);
      maxValue=rawMax+spread;
    }else{
      const spread=(rawMax-rawMin)*.14;
      minValue=Math.max(0,rawMin-spread);
      maxValue=rawMax+spread;
    }
    if(maxValue<=minValue)maxValue=minValue+1;
    const minTime=values[0].time,maxTime=values[values.length-1].time;
    const points=values.map((row,index)=>{
      const x=values.length===1
        ? pad.left+plotW/2
        : pad.left+((row.time-minTime)/(maxTime-minTime||1))*plotW;
      const y=pad.top+((maxValue-row.value)/(maxValue-minValue))*plotH;
      return {...row,index,x:round(x),y:round(y)};
    });
    const path=points.map((p,i)=>(i?"L":"M")+p.x+" "+p.y).join(" ");
    const grid=[maxValue,(maxValue+minValue)/2,minValue].map(value=>({
      value:Math.round(value*100)/100,
      y:round(pad.top+((maxValue-value)/(maxValue-minValue))*plotH)
    }));
    const first=points[0],last=points[points.length-1];
    const amount=Math.round((last.value-first.value)*100)/100;
    const pct=first.value>0?Math.round((amount/first.value)*1000)/10:null;
    return {width,height,pad,points,path,grid,first,last,delta:{amount,pct}};
  }
  return {cleanRows,buildModel};
});
