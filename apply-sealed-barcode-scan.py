from pathlib import Path

worker_path = Path('src/index.js')
worker = worker_path.read_text(encoding='utf-8')

if 'const VERSION = "3.36.1";' not in worker:
    raise SystemExit('Expected Worker version 3.36.1 not found')
worker = worker.replace('const VERSION = "3.36.1";', 'const VERSION = "3.37.0";', 1)

helper_anchor = '''function sealedVisionNormalize(raw) {'''
export_anchor = '''export default {'''
if helper_anchor not in worker or export_anchor not in worker:
    raise SystemExit('Sealed vision helper anchors not found')

barcode_helpers = r'''
function sealedBarcodeDigits(value) {
  const text = String(value || "");
  const candidates = text.match(/\b\d{8,14}\b/g) || [];
  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, "");
    if ([8, 12, 13, 14].includes(digits.length)) return digits;
  }
  const all = text.replace(/\D/g, "");
  return [8, 12, 13, 14].includes(all.length) ? all : "";
}

function sealedBarcodeIdentity(item, barcode) {
  const title = String(item?.title || "").trim();
  const brand = String(item?.brand || "").trim();
  const text = `${title} ${brand}`;
  let category = "";
  if (/Pok[eé]mon|Trading Card Game|\bTCG\b/i.test(text)) category = "Pokémon";
  else if (/Magic:\s*The Gathering|\bMTG\b|Wizards of the Coast/i.test(text)) category = "Magic: The Gathering";
  else if (/\bNBA\b|basketball/i.test(text)) category = "Basketball";
  else if (/\bNFL\b|football/i.test(text)) category = "Football";
  else if (/\bMLB\b|baseball|Topps|Bowman/i.test(text)) category = "Baseball";

  let year = "";
  const ym = text.match(/\b(20\d{2})(?:\s*[-–/]\s*(\d{2,4}))?\b/);
  if (ym) year = ym[2] ? `${ym[1]}-${ym[2].length === 2 ? ym[2] : ym[2].slice(-2)}` : ym[1];

  let productType = "";
  const productRules = [
    [/\bmega\s+box\b/i, "Mega Box"],
    [/\bblaster\s+box\b|\bblaster\b/i, "Blaster Box"],
    [/\bhobby\s+box\b/i, "Hobby Box"],
    [/\bretail\s+box\b/i, "Retail Box"],
    [/\bhanger\s+box\b/i, "Hanger Box"],
    [/\bhanger\s+pack\b|\bhanger\b/i, "Hanger Pack"],
    [/\bfat\s+pack\b|\bvalue\s+pack\b/i, "Value / Fat Pack"],
    [/\belite\s+trainer\s+box\b|\bETB\b/i, "Elite Trainer Box"],
    [/\bbooster\s+bundle\b/i, "Booster Bundle"],
    [/\bbooster\s+box\b/i, "Booster Box"],
    [/\bbooster\s+pack\b/i, "Booster Pack"],
    [/\bcollection\s+box\b/i, "Collection Box"],
    [/\btin\b/i, "Tin"],
    [/\bmulti[- ]?pack\b/i, "Multi-Pack"],
    [/\bsingle\s+pack\b/i, "Single Pack"],
  ];
  for (const [re, type] of productRules) {
    if (re.test(text)) { productType = type; break; }
  }

  return {
    category,
    year,
    set: title || brand,
    productType,
    variant: "",
    confidence: title ? "high" : "medium",
    clues: [barcode ? `UPC/EAN ${barcode}` : "", brand ? `Brand: ${brand}` : ""].filter(Boolean),
    needsAnotherPhoto: !title,
    followUp: title ? "" : "Barcode read successfully, but the product database did not return a title. Enter the product details manually.",
  };
}

async function sealedBarcodeLookup(barcode, env) {
  const cacheKey = `sealed:barcode:v1:${barcode}`;
  if (env.SCOUT_DATA) {
    try {
      const cached = await env.SCOUT_DATA.get(cacheKey, { type: "json" });
      if (cached?.barcode === barcode) return cached;
    } catch {}
  }

  let item = null;
  let lookupError = "";
  try {
    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`, {
      headers: { "Accept": "application/json", "User-Agent": "HOF-Card-Scout/1.0" },
    });
    if (res.ok) {
      const data = await res.json();
      item = Array.isArray(data?.items) ? data.items[0] || null : null;
    } else if (res.status === 404) {
      lookupError = "not_found";
    } else if (res.status === 429) {
      lookupError = "rate_limited";
    } else {
      lookupError = `lookup_${res.status}`;
    }
  } catch {
    lookupError = "lookup_failed";
  }

  const result = {
    barcode,
    item: item ? {
      title: String(item.title || "").trim().slice(0, 220),
      brand: String(item.brand || "").trim().slice(0, 120),
      model: String(item.model || "").trim().slice(0, 120),
      ean: String(item.ean || "").trim(),
      upc: String(item.upc || "").trim(),
    } : null,
    lookupError,
  };
  if (env.SCOUT_DATA && item) {
    try { await env.SCOUT_DATA.put(cacheKey, JSON.stringify(result), { expirationTtl: 30 * 24 * 60 * 60 }); } catch {}
  }
  return result;
}

'''
worker = worker.replace(export_anchor, barcode_helpers + export_anchor, 1)

route_anchor = '''    if (url.pathname === "/sealed/identify" && request.method === "POST") {'''
if route_anchor not in worker:
    raise SystemExit('Sealed identify route anchor not found')

barcode_route = r'''    if (url.pathname === "/sealed/barcode-identify" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      let body = {};
      try { body = await request.json(); }
      catch { return json({ ok: false, error: "bad_json", message: "Scout could not read that barcode request." }, 400, cors); }

      let barcode = sealedBarcodeDigits(body?.barcode || "");
      let barcodeSource = barcode ? "entered_or_device" : "";
      if (!barcode) {
        if (!env.AI) {
          return json({ ok: false, error: "vision_not_configured", message: "Scout barcode photo reading is not configured on the Worker." }, 503, cors);
        }
        const imageDataUrl = String(body?.imageDataUrl || "");
        const match = imageDataUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/i);
        if (!match) return json({ ok: false, error: "bad_image", message: "Scout needs a clear JPEG, PNG, or WebP barcode photo." }, 400, cors);
        const approxBytes = Math.floor(match[2].length * 3 / 4);
        if (approxBytes <= 0 || approxBytes > SEALED_VISION_MAX_BYTES) {
          return json({ ok: false, error: "image_too_large", message: "That barcode photo is too large. Retake it closer so the barcode fills more of the frame." }, 413, cors);
        }
        try {
          const raw = await env.AI.run(SEALED_VISION_MODEL, {
            task: "query",
            image: imageDataUrl,
            question: "Read the UPC, EAN, or GTIN barcode number in this image. Use the human-readable digits printed directly under or beside the barcode bars. Return ONLY the digits with no spaces, punctuation, JSON, or explanation. If you cannot read a complete 8, 12, 13, or 14 digit code, return an empty answer.",
            reasoning: false,
            stream: false,
            temperature: 0,
            max_tokens: 40
          });
          barcode = sealedBarcodeDigits(raw?.answer ?? raw?.response ?? raw?.result ?? raw);
          barcodeSource = barcode ? "cloudflare_ocr" : "";
        } catch (err) {
          console.error("sealed barcode OCR failed", err);
        }
      }

      if (!barcode) {
        return json({ ok: false, error: "barcode_unreadable", message: "Scout could not read the barcode number. Move closer so the bars and printed digits fill the photo, or type the UPC/EAN number manually.", searchUsed: 0, marketplaceSearchesUsed: 0 }, 422, cors);
      }

      const lookup = await sealedBarcodeLookup(barcode, env);
      const identity = sealedBarcodeIdentity(lookup.item, barcode);
      return json({
        ok: true,
        version: VERSION,
        barcode,
        barcodeSource,
        lookupTitle: lookup.item?.title || "",
        lookupBrand: lookup.item?.brand || "",
        lookupError: lookup.lookupError || "",
        identity,
        searchUsed: 0,
        marketplaceSearchesUsed: 0
      }, 200, cors);
    }

'''
worker = worker.replace(route_anchor, barcode_route + route_anchor, 1)
worker_path.write_text(worker, encoding='utf-8')

app_path = Path('sealed-product-scout.js')
app = app_path.read_text(encoding='utf-8')
app = app.replace('let lastVisionIdentity=null;', 'let lastVisionIdentity=null;\n  let lastBarcodeIdentity=null;', 1)

style_anchor = '      .sealed-next{opacity:.72}.sealed-next strong{color:var(--gold)}\n'
style_add = '      .sealed-barcode-box{margin-top:10px;border:1px solid rgba(117,174,233,.28);border-radius:14px;padding:11px;background:rgba(117,174,233,.07)}.sealed-barcode-box[hidden]{display:none}.sealed-barcode-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}.sealed-barcode-result{margin-top:9px;font-size:11px;line-height:1.5;color:var(--muted)}.sealed-barcode-result strong{color:var(--ink)}\n'
if style_anchor not in app:
    raise SystemExit('Barcode style anchor not found')
app = app.replace(style_anchor, style_add + style_anchor, 1)

photo_inputs_anchor = '''          <input type="file" id="sealedCameraInput" accept="image/*" capture="environment" hidden>\n          <input type="file" id="sealedPhotoInput" accept="image/*" hidden>\n          <div class="sealed-photo-stage" id="sealedPhotoStage">'''
barcode_ui = '''          <input type="file" id="sealedCameraInput" accept="image/*" capture="environment" hidden>\n          <input type="file" id="sealedPhotoInput" accept="image/*" hidden>\n          <input type="file" id="sealedBarcodeCameraInput" accept="image/*" capture="environment" hidden>\n          <div class="sealed-actions">\n            <button type="button" class="secondary" id="sealedBarcodePhotoBtn">▥ SCAN BARCODE</button>\n            <button type="button" class="ghost" id="sealedBarcodeManualBtn">123 ENTER UPC / EAN</button>\n          </div>\n          <div class="sealed-barcode-box" id="sealedBarcodeBox" hidden>\n            <div class="sealed-barcode-row">\n              <div class="sealed-field"><label for="sealedBarcodeText">UPC / EAN / GTIN</label><input id="sealedBarcodeText" inputmode="numeric" autocomplete="off" placeholder="Type the digits under the barcode"></div>\n              <button type="button" class="secondary" id="sealedBarcodeLookupBtn">LOOK UP</button>\n            </div>\n            <div class="sealed-barcode-result" id="sealedBarcodeResult">Take a close photo of the barcode or type the digits printed below it. Barcode lookup uses 0 marketplace searches.</div>\n          </div>\n          <div class="sealed-photo-stage" id="sealedPhotoStage">'''
if photo_inputs_anchor not in app:
    raise SystemExit('Photo input UI anchor not found')
app = app.replace(photo_inputs_anchor, barcode_ui, 1)

function_anchor = '''  function fileToDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();'''
if function_anchor not in app:
    raise SystemExit('Client barcode function anchor not found')
barcode_functions = r'''  function normalizeBarcode(value){
    const digits=String(value||"").replace(/\D/g,"");
    return [8,12,13,14].includes(digits.length)?digits:"";
  }
  async function nativeBarcodeFromFile(file){
    if(!file||!("BarcodeDetector" in window))return "";
    let detector;
    try{
      const supported=typeof BarcodeDetector.getSupportedFormats==="function"?await BarcodeDetector.getSupportedFormats():[];
      const wanted=["upc_a","upc_e","ean_8","ean_13","itf"].filter(x=>!supported.length||supported.includes(x));
      detector=new BarcodeDetector(wanted.length?{formats:wanted}:undefined);
      const bitmap=await createImageBitmap(file);
      const results=await detector.detect(bitmap);
      try{bitmap.close?.();}catch{}
      for(const hit of results||[]){const code=normalizeBarcode(hit?.rawValue||"");if(code)return code;}
    }catch{}
    return "";
  }
  function applyBarcodeResult(data){
    const identity=data?.identity||{};lastBarcodeIdentity=identity;
    if(byId("sealedCategory")&&identity.category)byId("sealedCategory").value=identity.category;
    if(byId("sealedYear")&&identity.year)byId("sealedYear").value=identity.year;
    if(byId("sealedSet")&&identity.set)byId("sealedSet").value=identity.set;
    if(byId("sealedBoxType")&&identity.productType)byId("sealedBoxType").value=identity.productType;
    if(byId("sealedVariant")&&identity.variant)byId("sealedVariant").value=identity.variant;
    const box=byId("sealedBarcodeBox"),result=byId("sealedBarcodeResult"),input=byId("sealedBarcodeText");
    if(box)box.hidden=false;if(input)input.value=data?.barcode||input.value;
    const source=data?.barcodeSource==="entered_or_device"?"device/manual barcode read":"Cloudflare barcode OCR";
    const title=String(data?.lookupTitle||"").trim();
    if(result)result.innerHTML=title
      ?`✓ <strong>${esc(data.barcode)}</strong> matched <strong>${esc(title)}</strong>. Source: ${esc(source)}. Review the filled product fields below before confirming.`
      :`✓ Barcode <strong>${esc(data.barcode)}</strong> was read, but the product database did not return a title. Review or enter the product fields below.`;
    saveDraft({barcode:data?.barcode||"",barcodeTitle:title,identity:{...identity,boxType:identity.productType||""},confirmed:false});
    byId("sealedIdentityCard")?.scrollIntoView({behavior:"smooth",block:"start"});
  }
  async function lookupBarcode({barcode="",file=null}={}){
    const box=byId("sealedBarcodeBox"),result=byId("sealedBarcodeResult"),btn=byId("sealedBarcodeLookupBtn");
    if(box)box.hidden=false;
    const cfg=typeof pricingConfig==="function"?pricingConfig():{endpoint:"",accessKey:""};
    if(!cfg.endpoint||!cfg.accessKey){if(result)result.textContent="Scout's live connection is not configured on this device.";return;}
    let code=normalizeBarcode(barcode);
    if(file&&!code){if(result)result.textContent="Reading the barcode…";code=await nativeBarcodeFromFile(file);}
    if(btn)btn.disabled=true;
    try{
      const body={};
      if(code)body.barcode=code;
      else if(file)body.imageDataUrl=await visionImageDataUrl(file);
      else throw new Error("Type the 8, 12, 13, or 14 digit code printed under the barcode.");
      if(result)result.textContent=code?"Looking up that barcode…":"Reading the printed barcode digits with Cloudflare AI…";
      const res=await fetch(`${String(cfg.endpoint).replace(/\/+$/,"")}/sealed/barcode-identify`,{method:"POST",headers:{"Content-Type":"application/json","X-Scout-Key":cfg.accessKey},body:JSON.stringify(body)});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.ok)throw new Error(data.message||"Scout could not identify that barcode.");
      applyBarcodeResult(data);
    }catch(err){if(result)result.textContent=err?.message||"Scout could not read that barcode. Move closer or type the digits manually.";}
    finally{if(btn)btn.disabled=false;}
  }
  async function handleBarcodePhoto(file){
    if(!file)return;
    if(!String(file.type||"").startsWith("image/")){byId("sealedBarcodeResult").textContent="That file is not an image.";return;}
    byId("sealedBarcodeBox").hidden=false;
    byId("sealedBarcodeResult").textContent="Reading barcode photo…";
    await lookupBarcode({file});
  }

'''
app = app.replace(function_anchor, barcode_functions + function_anchor, 1)

startover_anchor = '    clearPhotoUrl();activePhotoFile=null;lastVisionIdentity=null;\n'
if startover_anchor not in app:
    raise SystemExit('Start over anchor not found')
app = app.replace(startover_anchor, '    clearPhotoUrl();activePhotoFile=null;lastVisionIdentity=null;lastBarcodeIdentity=null;\n', 1)
app = app.replace('["sealedCategory","sealedYear","sealedSet","sealedBoxType","sealedVariant","sealedShelfPrice","sealedStore"]', '["sealedCategory","sealedYear","sealedSet","sealedBoxType","sealedVariant","sealedShelfPrice","sealedStore","sealedBarcodeText"]', 1)
reset_anchor = '    byId("sealedCameraInput").value="";byId("sealedPhotoInput").value="";\n'
if reset_anchor not in app:
    raise SystemExit('Reset input anchor not found')
app = app.replace(reset_anchor, '    byId("sealedCameraInput").value="";byId("sealedPhotoInput").value="";byId("sealedBarcodeCameraInput").value="";\n    byId("sealedBarcodeBox").hidden=true;byId("sealedBarcodeResult").textContent="Take a close photo of the barcode or type the digits printed below it. Barcode lookup uses 0 marketplace searches.";\n', 1)

listeners_anchor = '''    byId("sealedPhotoInput").addEventListener("change",e=>handlePhoto(e.target.files?.[0]));\n    byId("sealedAnalyzeBtn").addEventListener("click",analyzePhoto);'''
listeners_new = '''    byId("sealedPhotoInput").addEventListener("change",e=>handlePhoto(e.target.files?.[0]));\n    byId("sealedBarcodePhotoBtn").addEventListener("click",()=>byId("sealedBarcodeCameraInput").click());\n    byId("sealedBarcodeManualBtn").addEventListener("click",()=>{byId("sealedBarcodeBox").hidden=false;setTimeout(()=>byId("sealedBarcodeText")?.focus(),100);});\n    byId("sealedBarcodeCameraInput").addEventListener("change",e=>handleBarcodePhoto(e.target.files?.[0]));\n    byId("sealedBarcodeLookupBtn").addEventListener("click",()=>lookupBarcode({barcode:byId("sealedBarcodeText")?.value||""}));\n    byId("sealedBarcodeText").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();lookupBarcode({barcode:e.currentTarget.value});}});\n    byId("sealedAnalyzeBtn").addEventListener("click",analyzePhoto);'''
if listeners_anchor not in app:
    raise SystemExit('Listener anchor not found')
app = app.replace(listeners_anchor, listeners_new, 1)
app_path.write_text(app, encoding='utf-8')

for test in Path('tests').glob('*.test.cjs'):
    t = test.read_text(encoding='utf-8')
    t = t.replace('3\\.36\\.1', '3\\.37\\.0')
    t = t.replace('"3.36.1"', '"3.37.0"')
    t = t.replace("'3.36.1'", "'3.37.0'")
    test.write_text(t, encoding='utf-8')

vision_test = Path('tests/sealed-product-vision.test.cjs')
t = vision_test.read_text(encoding='utf-8')
anchor = "assert.match(worker,/\\/sealed\\/identify/,'sealed vision endpoint must exist');"
addition = "\nassert.match(worker,/\\/sealed\\/barcode-identify/,'sealed barcode endpoint must exist');\nassert.match(worker,/api\\.upcitemdb\\.com\\/prod\\/trial\\/lookup/,'barcode lookup should use the free UPC database endpoint');\nassert.match(app,/SCAN BARCODE/,'sealed scanner must expose barcode photo capture');\nassert.match(app,/BarcodeDetector/,'browser-native barcode detection should be attempted when supported');\nassert.match(app,/sealed\\/barcode-identify/,'barcode UI must call the Scout barcode endpoint');"
if addition.strip() not in t:
    if anchor not in t:
        raise SystemExit('Vision test anchor not found')
    t = t.replace(anchor, anchor + addition, 1)
vision_test.write_text(t, encoding='utf-8')
