from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

# App version.
if '· v5.4.0</div>' not in s:
    raise SystemExit('v5.4.0 footer anchor not found')
s=s.replace('· v5.4.0</div>','· v5.5.0</div>',1)

# The Home button is useful away from Home, but redundant on the Home screen.
home_old='<button class="icon-btn" id="homeBtn" title="Home" aria-label="Home">⌂</button>'
home_new='<button class="icon-btn" id="homeBtn" title="Home" aria-label="Home" hidden>⌂</button>'
if home_old not in s:
    raise SystemExit('home button anchor not found')
s=s.replace(home_old,home_new,1)

# Mobile/navigation polish is appended so it cleanly overrides older responsive rules.
css=r'''
/* v5.5.0 — mobile / navigation polish */
html{scroll-padding-top:96px}
button{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.screen.active{animation:scoutScreenIn .16s ease-out}
@keyframes scoutScreenIn{from{opacity:.45;transform:translateY(4px)}to{opacity:1;transform:none}}
.filter-row,#findTargetRankStrip,#monthlyRankStrip{-webkit-overflow-scrolling:touch;scrollbar-width:none}
#findTargetRankStrip::-webkit-scrollbar,#monthlyRankStrip::-webkit-scrollbar{display:none}
@media(prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  .screen.active{animation:none}
}
@media(max-width:620px){
  .shell{padding-left:10px;padding-right:10px;padding-bottom:calc(30px + env(safe-area-inset-bottom))}
  .topbar{position:sticky;top:env(safe-area-inset-top);z-index:40;margin:0 -2px 10px;padding:6px 2px 9px;background:linear-gradient(180deg,rgba(13,43,34,.98),rgba(13,43,34,.92));backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid rgba(42,80,69,.55)}
  .logo{width:48px;height:48px;flex-basis:48px;border-radius:15px}
  .brand h1{font-size:20px}
  .brand p{font-size:11px;margin-top:3px}
  .icon-btn{min-width:44px;width:44px;height:44px;border-radius:13px}
  .back{position:sticky;top:calc(env(safe-area-inset-top) + 64px);z-index:32;width:max-content;max-width:100%;min-height:42px;padding:7px 11px;margin:0 0 9px;border:1px solid var(--line);border-radius:12px;background:rgba(7,28,22,.94);box-shadow:0 8px 22px rgba(0,0,0,.18);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
  .quick-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .quick-grid button{min-width:0;min-height:54px;padding:9px 7px;font-size:12px;line-height:1.18}
  .stats{gap:7px}
  .stat{min-width:0;padding:9px 8px}
  .stat .label{font-size:9px;letter-spacing:.08em}
  .stat .value{font-size:20px}
  .filter-row{scroll-snap-type:x proximity;padding-bottom:10px}
  .chip{min-height:42px;scroll-snap-align:start}
  .list-head{align-items:flex-start;flex-direction:column}
  .list-tools{width:100%;justify-content:space-between}
  .legend{flex-wrap:wrap}
  .player-row{min-height:66px;padding:13px 11px}
  .psub{white-space:normal;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  #findTargetRankStrip,#monthlyRankStrip{display:flex!important;grid-template-columns:none!important;overflow-x:auto;gap:8px!important;padding:2px 1px 8px;scroll-snap-type:x mandatory}
  #findTargetRankStrip>button,#monthlyRankStrip>button{flex:0 0 124px;min-width:124px;min-height:64px!important;scroll-snap-align:start}
  .hunt-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
  .hunt-actions button{width:100%;min-height:44px}
  .dashboard-actions{grid-template-columns:repeat(2,minmax(0,1fr))}
  .data-modal-backdrop{place-items:end center;padding:0}
  .data-modal{width:100%;max-width:none;border-radius:22px 22px 0 0;padding:17px 15px calc(17px + env(safe-area-inset-bottom))}
  .toast{bottom:calc(14px + env(safe-area-inset-bottom));max-width:calc(100% - 24px)}
}
@media(max-width:380px){
  .quick-grid{grid-template-columns:1fr}
  .stats{grid-template-columns:repeat(2,1fr)}
  .stat.complete{grid-column:1/-1}
  .hunt-actions,.dashboard-actions{grid-template-columns:1fr}
}
'''
if '/* v5.5.0 — mobile / navigation polish */' not in s:
    if '</style>' not in s:
        raise SystemExit('style close anchor not found')
    s=s.replace('</style>',css+'\n</style>',1)

# Keep Home out of the way on Home, and show it everywhere else. Also dismiss mobile
# keyboards on navigation and respect reduced-motion preferences for the scroll reset.
pattern=re.compile(r'(function showScreen\(id\)\{\s*\n\s*document\.querySelectorAll\("\.screen"\)\.forEach\(s=>s\.classList\.toggle\("active",s\.id===id\)\);)')
m=pattern.search(s)
if not m:
    raise SystemExit('showScreen function anchor not found')
addition='''\n  $("homeBtn").hidden=id==="homeScreen";\n  const focused=document.activeElement;\n  if(focused&&/^(INPUT|TEXTAREA|SELECT)$/.test(focused.tagName))focused.blur();'''
if '$("homeBtn").hidden=id==="homeScreen";' not in s:
    s=s[:m.end()]+addition+s[m.end():]

scroll_old='window.scrollTo({top:0,behavior:"smooth"});'
scroll_new='window.scrollTo({top:0,behavior:window.matchMedia?.("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});'
if scroll_old not in s:
    raise SystemExit('showScreen scroll anchor not found')
s=s.replace(scroll_old,scroll_new,1)

p.write_text(s,encoding='utf-8')

# Dashboard test owns the visible app-version assertion.
t=Path('tests/collection-dashboard.test.cjs')
txt=t.read_text(encoding='utf-8')
if 'assert.match(html,/v5\\.4\\.0/);' not in txt:
    raise SystemExit('dashboard version test anchor not found')
txt=txt.replace('assert.match(html,/v5\\.4\\.0/);','assert.match(html,/v5\\.5\\.0/);',1)
t.write_text(txt,encoding='utf-8')

Path('tests/mobile-navigation-polish.test.cjs').write_text(r'''const assert=require("node:assert/strict");
const fs=require("node:fs");
const html=fs.readFileSync("index.html","utf8");

assert.match(html,/v5\.5\.0/);
assert.match(html,/v5\.5\.0 — mobile \/ navigation polish/);
assert.match(html,/id="homeBtn"[^>]*hidden/);
assert.match(html,/\$\("homeBtn"\)\.hidden=id==="homeScreen"/);
assert.match(html,/position:sticky;top:env\(safe-area-inset-top\)/);
assert.match(html,/\.quick-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(html,/#findTargetRankStrip,#monthlyRankStrip\{display:flex!important/);
assert.match(html,/scroll-snap-type:x mandatory/);
assert.match(html,/\.hunt-actions\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(html,/\.data-modal-backdrop\{place-items:end center;padding:0\}/);
assert.match(html,/@media\(max-width:380px\)/);
assert.match(html,/prefers-reduced-motion/);
assert.match(html,/focused&&\/\^\(INPUT\|TEXTAREA\|SELECT\)\$\//);
console.log("Mobile/navigation polish tests passed.");
''',encoding='utf-8')
