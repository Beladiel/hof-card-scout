from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')

css=r'''
/* v5.2.1 — combined data / backup menu */
.data-modal-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.68);backdrop-filter:blur(3px)}
.data-modal-backdrop[hidden]{display:none}
.data-modal{width:min(430px,100%);border:1px solid var(--line);border-radius:20px;background:linear-gradient(145deg,#12372c,#0b261e);box-shadow:0 22px 70px rgba(0,0,0,.55);padding:17px}
.data-modal-head{display:flex;align-items:flex-start;gap:11px;margin-bottom:12px}
.data-modal-icon{width:44px;height:44px;flex:0 0 44px;display:grid;place-items:center;border-radius:13px;background:rgba(230,189,99,.12);border:1px solid rgba(230,189,99,.3);font-size:21px}
.data-modal-title{font-size:21px;font-weight:950;line-height:1.1}
.data-modal-sub{font-size:11px;color:var(--muted);line-height:1.45;margin-top:4px}
.data-modal-actions{display:grid;gap:9px;margin-top:13px}
.data-modal-actions button{text-align:left;min-height:52px}
.data-modal-actions button strong{display:block;font-size:13px}
.data-modal-actions button span{display:block;font-size:9px;font-weight:750;opacity:.72;margin-top:2px}
.data-modal-cancel{width:100%;margin-top:9px}
'''.strip()
marker='/* Phase 5 — Hunt List / Shopping Mode */'
if '/* v5.2.1 — combined data / backup menu */' not in s:
    if marker not in s: raise SystemExit('CSS marker not found')
    s=s.replace(marker,css+'\n\n'+marker,1)

old_buttons='''        <button class="ghost" id="exportBtn">📤 EXPORT UPDATES</button>\n        <button class="ghost" id="importBtn">📥 IMPORT UPDATES</button>\n        <input id="importFile" type="file" accept=".json,application/json" hidden>'''
new_buttons='''        <button class="ghost" id="dataMenuBtn">↕️ DATA / BACKUP</button>\n        <input id="importFile" type="file" accept=".json,application/json" hidden>'''
if 'id="dataMenuBtn"' not in s:
    if old_buttons not in s: raise SystemExit('Export/import buttons anchor not found')
    s=s.replace(old_buttons,new_buttons,1)

modal=r'''
<div class="data-modal-backdrop" id="dataMenuModal" hidden>
  <div class="data-modal" role="dialog" aria-modal="true" aria-labelledby="dataMenuTitle">
    <div class="data-modal-head">
      <div class="data-modal-icon">↕️</div>
      <div>
        <div class="section-eyebrow">DATA TOOLS</div>
        <div class="data-modal-title" id="dataMenuTitle">Export or import?</div>
        <div class="data-modal-sub">Move your HOF Card Scout updates between this device and a backup file. Scout Cloud Backup stays separate.</div>
      </div>
    </div>
    <div class="data-modal-actions">
      <button type="button" class="secondary" id="dataExportBtn"><strong>📤 EXPORT UPDATES</strong><span>Save your current app updates to a file.</span></button>
      <button type="button" class="primary" id="dataImportBtn"><strong>📥 IMPORT UPDATES</strong><span>Load a previously exported Scout updates file.</span></button>
    </div>
    <button type="button" class="ghost data-modal-cancel" id="dataMenuCancelBtn">CANCEL</button>
  </div>
</div>
'''.strip()
toast='<div class="toast" id="toast" role="status" aria-live="polite"></div>'
if 'id="dataMenuModal"' not in s:
    if toast not in s: raise SystemExit('Toast anchor not found')
    s=s.replace(toast,modal+'\n'+toast,1)

helper=r'''
function openDataMenu(){
  const modal=$("dataMenuModal");
  if(!modal)return;
  modal.hidden=false;
  setTimeout(()=>$("dataExportBtn")?.focus(),0);
}
function closeDataMenu(){
  const modal=$("dataMenuModal");
  if(!modal)return;
  modal.hidden=true;
  $("dataMenuBtn")?.focus();
}
'''.strip()
anchor='$("homeBtn").addEventListener("click",()=>showScreen("homeScreen"));'
if 'function openDataMenu()' not in s:
    if anchor not in s: raise SystemExit('Event anchor not found')
    s=s.replace(anchor,helper+'\n'+anchor,1)

old_handlers='''$("exportBtn").addEventListener("click",exportUpdates);\n$("importBtn").addEventListener("click",()=>$("importFile").click());\n$("importFile").addEventListener("change",e=>importUpdatesFile(e.target.files&&e.target.files[0]));'''
new_handlers='''$("dataMenuBtn").addEventListener("click",openDataMenu);\n$("dataMenuCancelBtn").addEventListener("click",closeDataMenu);\n$("dataExportBtn").addEventListener("click",()=>{closeDataMenu();exportUpdates();});\n$("dataImportBtn").addEventListener("click",()=>{closeDataMenu();$("importFile").click();});\n$("dataMenuModal").addEventListener("click",e=>{if(e.target===$("dataMenuModal"))closeDataMenu();});\ndocument.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("dataMenuModal").hidden)closeDataMenu();});\n$("importFile").addEventListener("change",e=>importUpdatesFile(e.target.files&&e.target.files[0]));'''
if '$("dataMenuBtn").addEventListener("click",openDataMenu);' not in s:
    if old_handlers not in s: raise SystemExit('Export/import handlers anchor not found')
    s=s.replace(old_handlers,new_handlers,1)

s=s.replace('· v5.2.0</div>','· v5.2.1</div>',1)

p.write_text(s,encoding='utf-8')

Path('tests/data-menu.test.cjs').write_text(r'''const assert=require("node:assert/strict");
const fs=require("node:fs");
const html=fs.readFileSync("index.html","utf8");
assert.match(html,/id="dataMenuBtn"[^>]*>↕️ DATA \/ BACKUP/);
assert.doesNotMatch(html,/id="exportBtn"/);
assert.doesNotMatch(html,/id="importBtn"/);
assert.match(html,/id="dataMenuModal"[^>]*hidden/);
assert.match(html,/id="dataExportBtn"/);
assert.match(html,/id="dataImportBtn"/);
assert.match(html,/dataExportBtn[\s\S]*exportUpdates\(\)/);
assert.match(html,/dataImportBtn[\s\S]*importFile/);
assert.match(html,/Escape/);
assert.match(html,/v5\.2\.1/);
console.log("Data menu tests passed.");
''',encoding='utf-8')
print('Combined data menu patched')
