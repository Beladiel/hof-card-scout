from pathlib import Path

p = Path('sealed-product-scout.js')
s = p.read_text(encoding='utf-8')

old = '  let lastBarcodeIdentity=null;\n'
new = '  let lastBarcodeIdentity=null;\n  let activeBarcodeFile=null;\n  let activeBarcodePhotoUrl="";\n'
if old not in s:
    raise SystemExit('barcode state anchor not found')
s = s.replace(old, new, 1)

old = '  function clearPhotoUrl(){if(activePhotoUrl){try{URL.revokeObjectURL(activePhotoUrl);}catch{}activePhotoUrl="";}}\n'
new = old + '  function clearBarcodePhotoUrl(){if(activeBarcodePhotoUrl){try{URL.revokeObjectURL(activeBarcodePhotoUrl);}catch{}activeBarcodePhotoUrl="";}}\n'
if old not in s:
    raise SystemExit('clear photo anchor not found')
s = s.replace(old, new, 1)

old = '      .sealed-barcode-box{margin-top:10px;border:1px solid rgba(117,174,233,.28);border-radius:14px;padding:11px;background:rgba(117,174,233,.07)}.sealed-barcode-box[hidden]{display:none}.sealed-barcode-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}.sealed-barcode-result{margin-top:9px;font-size:11px;line-height:1.5;color:var(--muted)}.sealed-barcode-result strong{color:var(--ink)}\n'
new = '      .sealed-barcode-box{margin-top:10px;border:1px solid rgba(117,174,233,.28);border-radius:14px;padding:11px;background:rgba(117,174,233,.07)}.sealed-barcode-box[hidden]{display:none}.sealed-barcode-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}.sealed-barcode-preview{margin-top:10px;border:1px dashed rgba(117,174,233,.35);border-radius:12px;padding:8px;background:rgba(0,0,0,.12)}.sealed-barcode-preview[hidden]{display:none}.sealed-barcode-preview img{display:block;width:100%;max-height:240px;object-fit:contain;background:#111;border-radius:8px}.sealed-barcode-result{margin-top:9px;font-size:11px;line-height:1.5;color:var(--muted)}.sealed-barcode-result strong{color:var(--ink)}\n'
if old not in s:
    raise SystemExit('barcode css anchor not found')
s = s.replace(old, new, 1)

old = '''            </div>\n            <div class="sealed-barcode-result" id="sealedBarcodeResult">Take a close photo of the barcode or type the digits printed below it. Barcode lookup uses 0 marketplace searches.</div>\n          </div>'''
new = '''            </div>\n            <div class="sealed-barcode-preview" id="sealedBarcodePreview" hidden></div>\n            <div class="sealed-actions one"><button type="button" class="primary" id="sealedBarcodeReadBtn" disabled>▥ READ BARCODE PHOTO</button></div>\n            <div class="sealed-barcode-result" id="sealedBarcodeResult">Take a close photo of the barcode or type the digits printed below it. Barcode lookup uses 0 marketplace searches.</div>\n          </div>'''
if old not in s:
    raise SystemExit('barcode html anchor not found')
s = s.replace(old, new, 1)

old = '''  async function handleBarcodePhoto(file){\n    if(!file)return;\n    if(!String(file.type||"").startsWith("image/")){byId("sealedBarcodeResult").textContent="That file is not an image.";return;}\n    byId("sealedBarcodeBox").hidden=false;\n    byId("sealedBarcodeResult").textContent="Reading barcode photo…";\n    await lookupBarcode({file});\n  }'''
new = '''  async function handleBarcodePhoto(file){\n    if(!file)return;\n    if(!String(file.type||"").startsWith("image/")){byId("sealedBarcodeBox").hidden=false;byId("sealedBarcodeResult").textContent="That file is not an image.";return;}\n    clearBarcodePhotoUrl();\n    activeBarcodeFile=file;\n    activeBarcodePhotoUrl=URL.createObjectURL(file);\n    const box=byId("sealedBarcodeBox"),preview=byId("sealedBarcodePreview"),result=byId("sealedBarcodeResult"),readBtn=byId("sealedBarcodeReadBtn");\n    if(box)box.hidden=false;\n    if(preview){preview.hidden=false;preview.innerHTML=`<img src="${esc(activeBarcodePhotoUrl)}" alt="Barcode photo preview">`;}\n    if(result)result.innerHTML="✓ <strong>Barcode photo captured.</strong> Make sure the bars and the printed digits are sharp, then tap <strong>READ BARCODE PHOTO</strong>.";\n    if(readBtn)readBtn.disabled=false;\n    box?.scrollIntoView({behavior:"smooth",block:"center"});\n  }'''
if old not in s:
    raise SystemExit('handleBarcodePhoto block not found')
s = s.replace(old, new, 1)

old = '    clearPhotoUrl();activePhotoFile=null;lastVisionIdentity=null;lastBarcodeIdentity=null;\n'
new = '    clearPhotoUrl();clearBarcodePhotoUrl();activePhotoFile=null;activeBarcodeFile=null;lastVisionIdentity=null;lastBarcodeIdentity=null;\n'
if old not in s:
    raise SystemExit('startOver state anchor not found')
s = s.replace(old, new, 1)

old = '    byId("sealedBarcodeBox").hidden=true;byId("sealedBarcodeResult").textContent="Take a close photo of the barcode or type the digits printed below it. Barcode lookup uses 0 marketplace searches.";\n'
new = '    byId("sealedBarcodeBox").hidden=true;byId("sealedBarcodePreview").hidden=true;byId("sealedBarcodePreview").innerHTML="";byId("sealedBarcodeReadBtn").disabled=true;byId("sealedBarcodeResult").textContent="Take a close photo of the barcode or type the digits printed below it. Barcode lookup uses 0 marketplace searches.";\n'
if old not in s:
    raise SystemExit('startOver barcode UI anchor not found')
s = s.replace(old, new, 1)

old = '    byId("sealedBarcodeCameraInput").addEventListener("change",e=>handleBarcodePhoto(e.target.files?.[0]));\n    byId("sealedBarcodeLookupBtn").addEventListener("click",()=>lookupBarcode({barcode:byId("sealedBarcodeText")?.value||""}));\n'
new = '    byId("sealedBarcodeCameraInput").addEventListener("change",e=>handleBarcodePhoto(e.target.files?.[0]));\n    byId("sealedBarcodeReadBtn").addEventListener("click",()=>{if(!activeBarcodeFile){byId("sealedBarcodeResult").textContent="Take a barcode photo first.";return;}lookupBarcode({file:activeBarcodeFile});});\n    byId("sealedBarcodeLookupBtn").addEventListener("click",()=>lookupBarcode({barcode:byId("sealedBarcodeText")?.value||""}));\n'
if old not in s:
    raise SystemExit('barcode event anchor not found')
s = s.replace(old, new, 1)

p.write_text(s, encoding='utf-8')

# Strengthen the sealed-product UI regression checks.
t = Path('tests/sealed-product-vision.test.cjs')
text = t.read_text(encoding='utf-8')
anchor = "assert.match(app,/ANOTHER PHOTO/);"
addition = "\nassert.match(app,/READ BARCODE PHOTO/,'barcode photo must require an explicit read step');\nassert.match(app,/Barcode photo captured/,'barcode photo capture must give visible confirmation');\nassert.match(app,/sealedBarcodePreview/,'barcode photo preview must be rendered before reading');"
if addition.strip() not in text:
    if anchor not in text:
        raise SystemExit('test anchor not found')
    text = text.replace(anchor, anchor + addition, 1)
    t.write_text(text, encoding='utf-8')
