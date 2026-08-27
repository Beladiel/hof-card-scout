from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')

old='''function showScreen(id){\n  [homeScreen,forecastScreen,huntScreen,detailScreen,manageScreen,targetManageScreen,shopScreen].forEach(s=>s.classList.toggle("active",s.id===id));\n  if(id==="huntScreen")renderHuntList();\n  if(id==="forecastScreen")renderHallForecast();\n  window.scrollTo({top:0,behavior:"smooth"});\n}'''
new='''function showScreen(id){\n  document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("active",s.id===id));\n  if(id==="huntScreen")renderHuntList();\n  if(id==="forecastScreen")renderHallForecast();\n  window.scrollTo({top:0,behavior:"smooth"});\n}'''
if old not in s:
    raise SystemExit('showScreen anchor not found')
s=s.replace(old,new,1)
s=s.replace('· v5.3.0</div>','· v5.3.1</div>',1)
p.write_text(s,encoding='utf-8')

t=Path('tests/collection-dashboard.test.cjs')
txt=t.read_text(encoding='utf-8')
txt=txt.replace('assert.match(html,/v5\\.3\\.0/);','assert.match(html,/v5\\.3\\.1/);')
needle='assert.match(html,/function openDashboard\\(\\)/);\n'
insert='assert.match(html,/document\\.querySelectorAll\\("\\.screen"\\)\\.forEach/);\nassert.doesNotMatch(html,/\\[homeScreen,forecastScreen,huntScreen,detailScreen,manageScreen,targetManageScreen,shopScreen\\]\\.forEach/);\n'
if insert not in txt:
    if needle not in txt:
        raise SystemExit('dashboard test anchor not found')
    txt=txt.replace(needle,needle+insert,1)
t.write_text(txt,encoding='utf-8')
