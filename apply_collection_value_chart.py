from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')
assert 'id="collectionHistoryChart"' not in s, 'collection history chart already applied'

css_marker='@media(max-width:620px){.collection-value-grid{grid-template-columns:repeat(2,1fr)}}'
css_add=r'''
.collection-history{margin-top:12px;border-top:1px solid rgba(230,189,99,.22);padding-top:12px}
.collection-history-head{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-bottom:8px}
.collection-history-title{font-size:12px;font-weight:950;letter-spacing:.04em}
.collection-history-trend{font-size:10px;font-weight:900;text-align:right}
.collection-history-trend.up{color:#9ce8bb}.collection-history-trend.down{color:#ffaaa2}.collection-history-trend.flat{color:#f4d58a}
.collection-history-chart{border:1px solid var(--line);border-radius:13px;background:rgba(0,0,0,.10);overflow:hidden;min-height:118px}
.collection-history-chart svg{display:block;width:100%;height:auto;min-height:150px}
.collection-history-grid{stroke:rgba(255,255,255,.09);stroke-width:1}
.collection-history-axis{fill:var(--muted);font-size:10px;font-weight:750}
.collection-history-line{fill:none;stroke:#e6bd63;stroke-width:4;stroke-linecap:round;stroke-linejoin:round}
.collection-history-point{fill:#56c58a;stroke:#f9f4e8;stroke-width:2}
.collection-history-point.latest{fill:#e6bd63}
.collection-history-value{fill:#f9f4e8;font-size:11px;font-weight:950;text-anchor:middle}
.collection-history-empty{padding:18px 14px;text-align:center;color:var(--muted);font-size:10px;line-height:1.5}
.collection-history-note{margin-top:7px;color:var(--muted);font-size:9px;line-height:1.45}
@media(max-width:620px){.collection-history-head{align-items:flex-start;flex-direction:column}.collection-history-trend{text-align:left}.collection-history-chart svg{min-height:165px}}
'''
assert css_marker in s, 'collection value CSS marker not found'
s=s.replace(css_marker,css_marker+'\n'+css_add,1)

html_marker='''        <div class="collection-value-status" id="collectionValueStatus"></div>\n      </div>'''
html_add='''        <div class="collection-value-status" id="collectionValueStatus"></div>\n        <div class="collection-history" id="collectionValueHistory">\n          <div class="collection-history-head">\n            <div class="collection-history-title">📉 VALUE HISTORY</div>\n            <div class="collection-history-trend flat" id="collectionHistoryTrend">WAITING FOR FIRST SNAPSHOT</div>\n          </div>\n          <div class="collection-history-chart" id="collectionHistoryChart"></div>\n          <div class="collection-history-note" id="collectionHistoryNote"></div>\n        </div>\n      </div>'''
assert html_marker in s, 'collection value panel marker not found'
s=s.replace(html_marker,html_add,1)

script_marker='<script src="collection-value.js"></script>'
assert script_marker in s, 'collection value script marker not found'
s=s.replace(script_marker,'<script src="collection-value-chart.js"></script>\n'+script_marker,1)

count_marker='''  $("collectionValueSnapshots").textContent=String(snapshots.length);\n  const status=$("collectionValueStatus");'''
count_new='''  $("collectionValueSnapshots").textContent=String(snapshots.length);\n  renderCollectionValueHistory(p,snapshots);\n  const status=$("collectionValueStatus");'''
assert count_marker in s, 'snapshot count render marker not found'
s=s.replace(count_marker,count_new,1)

js_marker='function collectionValueTrackRefresh(card,data,ctx){'
js_add=r'''function collectionHistoryDate(at,withYear=true){
  const d=new Date(at);
  if(Number.isNaN(d.getTime()))return "";
  return d.toLocaleDateString(undefined,withYear?{month:"short",day:"numeric",year:"numeric"}:{month:"short",day:"numeric"});
}
function renderCollectionValueHistory(p,snapshots){
  const chart=$("collectionHistoryChart"),trend=$("collectionHistoryTrend"),note=$("collectionHistoryNote");
  if(!chart||!trend||!note)return;
  const chartApi=window.ScoutCollectionValueChart;
  const model=chartApi?chartApi.buildModel(snapshots):null;
  trend.className="collection-history-trend flat";
  if(!model){
    trend.textContent="WAITING FOR FIRST SNAPSHOT";
    chart.innerHTML='<div class="collection-history-empty"><strong>No value history yet.</strong><br>Run Refresh Value when Scout can find enough reliable sold comps. The first trustworthy result becomes point #1.</div>';
    note.textContent="Scout never invents backdated prices. This chart grows only from real, reliable valuation refreshes for the exact representative card you own.";
    return;
  }
  const n=model.points.length,d=model.delta;
  if(n===1){
    trend.textContent="FIRST SNAPSHOT · "+formatMoney(model.first.value);
  }else{
    trend.className="collection-history-trend "+(d.amount>0?"up":d.amount<0?"down":"flat");
    const amount=(d.amount>0?"+":d.amount<0?"−":"")+formatMoney(Math.abs(d.amount));
    const pct=d.pct===null?"":` · ${d.pct>0?"+":d.pct<0?"−":""}${Math.abs(d.pct).toFixed(1)}%`;
    trend.textContent=amount+pct+" SINCE FIRST SNAPSHOT";
  }
  const grid=model.grid.map(g=>`<line class="collection-history-grid" x1="${model.pad.left}" x2="${model.width-model.pad.right}" y1="${g.y}" y2="${g.y}"></line><text class="collection-history-axis" x="7" y="${g.y+3}">${escapeHtml(formatMoney(g.value))}</text>`).join("");
  const points=model.points.map((pt,i)=>{
    const date=collectionHistoryDate(pt.at,true);
    const details=[date,formatMoney(pt.value),pt.comps?pt.comps+" comp"+(Number(pt.comps)===1?"":"s"):"",pt.confidence?String(pt.confidence).toUpperCase()+" confidence":""].filter(Boolean).join(" · ");
    const latest=i===model.points.length-1?" latest":"";
    return `<circle class="collection-history-point${latest}" cx="${pt.x}" cy="${pt.y}" r="${latest?5.5:4.5}"><title>${escapeHtml(details)}</title></circle>`;
  }).join("");
  const firstDate=collectionHistoryDate(model.first.at,n===1);
  const lastDate=collectionHistoryDate(model.last.at,true);
  const dateLabels=n===1
    ? `<text class="collection-history-axis" text-anchor="middle" x="${model.first.x}" y="${model.height-12}">${escapeHtml(firstDate)}</text>`
    : `<text class="collection-history-axis" x="${model.pad.left}" y="${model.height-12}">${escapeHtml(firstDate)}</text><text class="collection-history-axis" text-anchor="end" x="${model.width-model.pad.right}" y="${model.height-12}">${escapeHtml(lastDate)}</text>`;
  const latestLabel=`<text class="collection-history-value" x="${model.last.x}" y="${Math.max(14,model.last.y-10)}">${escapeHtml(formatMoney(model.last.value))}</text>`;
  chart.innerHTML=`<svg viewBox="0 0 ${model.width} ${model.height}" role="img" aria-label="Value history for ${escapeHtml(p.name)} with ${n} reliable snapshot${n===1?"":"s"}">${grid}${n>1?`<path class="collection-history-line" d="${model.path}"></path>`:""}${points}${latestLabel}${dateLabels}</svg>`;
  note.textContent=n===1
    ?"History has started. The next reliable valuation on a later date will turn this into a trend line. Rechecking today updates today's point instead of creating a duplicate."
    :"Reliable sold-comp snapshots for this exact representative card. Tap or hover a point for its date, value, comp count, and confidence. Rechecking on the same day updates that day's point.";
}

'''
assert js_marker in s, 'collection value tracking function marker not found'
s=s.replace(js_marker,js_add+js_marker,1)

p.write_text(s,encoding='utf-8')
