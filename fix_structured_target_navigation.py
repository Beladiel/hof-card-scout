from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
old='''function openTargetManage(prefill=null){\n  $("targetForm").reset();\n  const p=prefill||null;'''
new='''let targetManageOrigin="targets";\nfunction openTargetManage(prefill=null){\n  $("targetForm").reset();\n  const p=prefill&&prefill.name?prefill:null;\n  targetManageOrigin=p&&currentPlayer&&currentPlayer.name===p.name?"detail":"targets";\n  $("targetPlayer").readOnly=!!p;'''
if old not in s: raise SystemExit('openTargetManage anchor not found')
s=s.replace(old,new,1)
old='''$("addTargetBtn").addEventListener("click",openTargetManage);\n$("targetManageBack").addEventListener("click",()=>{showScreen("homeScreen");showTargets();});'''
new='''$("addTargetBtn").addEventListener("click",()=>openTargetManage());\n$("targetManageBack").addEventListener("click",()=>{\n  if(targetManageOrigin==="detail"&&currentPlayer)openPlayer(currentPlayer,returnScreen);\n  else{showScreen("homeScreen");showTargets();}\n});'''
if old not in s: raise SystemExit('target nav bindings not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

t=Path('tests/structured-targets.test.cjs')
txt=t.read_text(encoding='utf-8')
anchor='''assert.match(html,/openTargetManage\\(currentPlayer\\)/);'''
extra='''assert.match(html,/openTargetManage\\(currentPlayer\\)/);\nassert.match(html,/addTargetBtn"\\)\\.addEventListener\\("click",\\(\\)=>openTargetManage\\(\\)\\)/);\nassert.match(html,/prefill&&prefill\\.name\\?prefill:null/);\nassert.match(html,/targetManageOrigin===?"detail"|targetManageOrigin==="detail"/);'''
if anchor not in txt: raise SystemExit('test nav anchor not found')
t.write_text(txt.replace(anchor,extra,1),encoding='utf-8')
print('fixed structured target navigation')
