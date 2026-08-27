from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')

old='let returnScreen="homeScreen";\nlet manageMode="add";'
new='let returnScreen="homeScreen";\nlet shopReturnScreen="homeScreen";\nlet manageMode="add";'
assert old in s, 'returnScreen declaration not found'
s=s.replace(old,new,1)

old='  returnScreen=document.querySelector(".screen.active")?.id||"homeScreen";'
new='  const activeScreen=document.querySelector(".screen.active")?.id||"homeScreen";\n  shopReturnScreen=activeScreen;\n  if(activeScreen!=="detailScreen")returnScreen=activeScreen;'
assert old in s, 'openShop return assignment not found'
s=s.replace(old,new,1)

old='$("shopBack").addEventListener("click",()=>showScreen(returnScreen==="shopScreen"?"homeScreen":returnScreen));'
new='$("shopBack").addEventListener("click",()=>showScreen(shopReturnScreen==="shopScreen"?"homeScreen":shopReturnScreen));'
assert old in s, 'shopBack handler not found'
s=s.replace(old,new,1)

p.write_text(s,encoding='utf-8')
