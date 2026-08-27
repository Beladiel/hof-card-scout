from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
old='''function clearStructuredTarget(p){\n  clearStructuredTarget(p);p.targetYear=null;p.targetSet="";p.targetCardNum="";p.targetGrader="Any / Raw OK";p.targetGrade="";'''
new='''function clearStructuredTarget(p){\n  p.target="";p.targetNotes="";p.targetYear=null;p.targetSet="";p.targetCardNum="";p.targetGrader="Any / Raw OK";p.targetGrade="";'''
if old not in s: raise SystemExit('broken clear helper not found')
s=s.replace(old,new,1)
old2='''  p.target="";p.targetNotes="";\n  savePlayerEdit(p);stats();rotateMission();renderList();renderHuntList();openPlayer(p,returnScreen);'''
new2='''  clearStructuredTarget(p);\n  savePlayerEdit(p);stats();rotateMission();renderList();renderHuntList();openPlayer(p,returnScreen);'''
if old2 not in s: raise SystemExit('remove target block not found')
s=s.replace(old2,new2,1)
p.write_text(s,encoding='utf-8')

t=Path('tests/structured-targets.test.cjs')
txt=t.read_text(encoding='utf-8')
needle='''assert.match(html,/function clearStructuredTarget\\(p\\)/);'''
replacement='''assert.match(html,/function clearStructuredTarget\\(p\\)/);\nconst clearBlock=html.match(/function clearStructuredTarget\\(p\\)\\{[\\s\\S]*?(?=\\nfunction purchaseSummary)/)?.[0]||"";\nassert.ok(clearBlock,"clear helper should be present");\nassert.doesNotMatch(clearBlock,/\\n\\s*clearStructuredTarget\\(p\\);/,"clear helper must not call itself");\nassert.match(clearBlock,/p\\.target="";p\\.targetNotes="";/);\nassert.match(html,/function removeCurrentTarget\\(\\)[\\s\\S]*?clearStructuredTarget\\(p\\);/);'''
if needle not in txt: raise SystemExit('test anchor not found')
t.write_text(txt.replace(needle,replacement,1),encoding='utf-8')
print('fixed structured target clear behavior')
