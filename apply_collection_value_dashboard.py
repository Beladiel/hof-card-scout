from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')
assert 'id="dashboardEstimatedValue"' not in s, 'collection value dashboard already applied'

css_marker='.dashboard-mini .s{font-size:9px;color:var(--muted);line-height:1.35;margin-top:3px}'
css_add='''\n.dashboard-value-gain.up{color:#9ce8bb}\n.dashboard-value-gain.down{color:#ffaaa2}\n.dashboard-value-note{font-size:10px;color:var(--muted);line-height:1.5;margin-top:9px}\n'''
assert css_marker in s, 'dashboard mini CSS marker not found'
s=s.replace(css_marker,css_marker+css_add,1)

html_marker='''        <div class="dashboard-section">\n          <div class="dashboard-section-title">⚾ COLLECTION MIX</div>'''
html_add='''        <div class="dashboard-section" id="dashboardCollectionValueSection">\n          <div class="dashboard-section-title">📈 ESTIMATED COLLECTION VALUE</div>\n          <div class="dashboard-sub">Only reliable values Scout has already saved are included. Opening this dashboard never triggers a marketplace search.</div>\n          <div class="dashboard-mix-grid">\n            <div class="dashboard-mini"><div class="k">EST. VALUE</div><div class="v" id="dashboardEstimatedValue">—</div><div class="s">Total of currently valued representatives</div></div>\n            <div class="dashboard-mini"><div class="k">CARDS VALUED</div><div class="v" id="dashboardValuedCount">0 / 0</div><div class="s" id="dashboardValuedCoverage">0% of owned cards</div></div>\n            <div class="dashboard-mini"><div class="k">MATCHED COST BASIS</div><div class="v" id="dashboardMatchedCost">—</div><div class="s" id="dashboardMatchedCount">0 valued cards also have price paid</div></div>\n            <div class="dashboard-mini"><div class="k">MATCHED GAIN / LOSS</div><div class="v dashboard-value-gain" id="dashboardCollectionGain">—</div><div class="s">Compared only where both value and purchase cost are known</div></div>\n          </div>\n          <div class="dashboard-value-note" id="dashboardValueNote"></div>\n        </div>\n\n'''+html_marker
assert html_marker in s, 'collection mix HTML marker not found'
s=s.replace(html_marker,html_add,1)

script_marker='<script src="collection-value.js"></script>'
assert script_marker in s, 'collection value script marker not found'
s=s.replace(script_marker,script_marker+'\n<script src="collection-value-dashboard.js"></script>',1)

render_marker='''  const coverage=owned?Math.round(paid.length/owned*100):0;\n\n  $("dashboardOwned").textContent=owned;'''
render_new='''  const coverage=owned?Math.round(paid.length/owned*100):0;\n  const valueSummary=window.ScoutCollectionValueDashboard&&window.ScoutCollectionValue\n    ?ScoutCollectionValueDashboard.summarize(PLAYERS,ScoutCollectionValue)\n    :null;\n\n  $("dashboardOwned").textContent=owned;'''
assert render_marker in s, 'render dashboard summary marker not found'
s=s.replace(render_marker,render_new,1)

value_marker='''  $("dashboardPriceCoverage").textContent=coverage+"%";\n\n  const milestones=[50,60,75,90,100];'''
value_new='''  $("dashboardPriceCoverage").textContent=coverage+"%";\n\n  const valueGainEl=$("dashboardCollectionGain");\n  if(valueSummary){\n    $("dashboardEstimatedValue").textContent=valueSummary.estimatedValue!==null?formatMoney(valueSummary.estimatedValue):"—";\n    $("dashboardValuedCount").textContent=valueSummary.valuedCount+" / "+valueSummary.ownedCount;\n    $("dashboardValuedCoverage").textContent=valueSummary.coveragePct.toFixed(1).replace(/\\.0$/,'')+"% of owned cards";\n    $("dashboardMatchedCost").textContent=valueSummary.matchedCostBasis!==null?formatMoney(valueSummary.matchedCostBasis):"—";\n    $("dashboardMatchedCount").textContent=valueSummary.matchedCount+" valued card"+(valueSummary.matchedCount===1?"":"s")+" also have price paid";\n    valueGainEl.className="v dashboard-value-gain";\n    if(valueSummary.gainLoss!==null){\n      const gain=valueSummary.gainLoss;\n      const sign=gain>0?"+":gain<0?"−":"";\n      const pct=valueSummary.gainLossPct===null?"":` (${valueSummary.gainLossPct>0?"+":valueSummary.gainLossPct<0?"−":""}${Math.abs(valueSummary.gainLossPct).toFixed(1)}%)`;\n      valueGainEl.textContent=sign+formatMoney(Math.abs(gain))+pct;\n      if(gain>0)valueGainEl.classList.add("up");\n      if(gain<0)valueGainEl.classList.add("down");\n    }else valueGainEl.textContent="—";\n    $("dashboardValueNote").textContent=valueSummary.valuedCount\n      ? valueSummary.valuedCount+" of "+valueSummary.ownedCount+" owned representative card"+(valueSummary.ownedCount===1?" is":"s are")+" currently valued. The estimated total includes only those saved reliable values; "+valueSummary.unvaluedCount+" owned card"+(valueSummary.unvaluedCount===1?" remains":"s remain")+" unvalued."\n      : "No owned representative cards have a saved reliable value yet. Use Refresh Value on individual player pages; trustworthy results will begin filling this total automatically.";\n  }else{\n    $("dashboardEstimatedValue").textContent="—";\n    $("dashboardValuedCount").textContent="0 / "+owned;\n    $("dashboardValuedCoverage").textContent="0% of owned cards";\n    $("dashboardMatchedCost").textContent="—";\n    $("dashboardMatchedCount").textContent="0 valued cards also have price paid";\n    valueGainEl.textContent="—";\n    $("dashboardValueNote").textContent="Collection valuation is not available in this app version.";\n  }\n\n  const milestones=[50,60,75,90,100];'''
assert value_marker in s, 'dashboard value render marker not found'
s=s.replace(value_marker,value_new,1)

p.write_text(s,encoding='utf-8')
