from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing expected text for {label}")
    return text.replace(old, new, 1)

# Cache-bust the sealed scanner UI.
index = Path("index.html")
html = index.read_text(encoding="utf-8")
if "sealed-product-scout.js?v=6.1.3" not in html:
    html = replace_once(
        html,
        "sealed-product-scout.js?v=6.1.2",
        "sealed-product-scout.js?v=6.1.3",
        "sealed scanner cache version",
    )
index.write_text(html, encoding="utf-8")

# Worker: add a narrow package-type classifier endpoint.
worker_path = Path("src/index.js")
worker = worker_path.read_text(encoding="utf-8")
worker = replace_once(worker, 'const VERSION = "3.37.0";', 'const VERSION = "3.37.1";', "worker version")

helper_marker = "\n\nfunction sealedBarcodeDigits(value) {"
helper_code = r'''

function sealedTypeJsonFromResponse(raw) {
  let value = raw?.response ?? raw?.result ?? raw?.answer ?? raw;
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  let text = String(value || "").trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try { return JSON.parse(text.slice(first, last + 1)); } catch {}
  }
  const productType = Array.from(SEALED_VISION_PRODUCT_TYPES)
    .filter(type => type !== "Other")
    .find(type => text.toLowerCase().includes(type.toLowerCase())) || "";
  const confidenceMatch = text.match(/\b(high|medium|low)\b/i);
  return {
    productType,
    confidence: confidenceMatch ? confidenceMatch[1].toLowerCase() : (productType ? "medium" : "low"),
    clues: [],
    followUp: "",
  };
}

function sealedTypeNormalize(raw) {
  const typeRaw = String(raw?.productType || raw?.boxType || "").trim();
  const confidenceRaw = String(raw?.confidence || "low").trim().toLowerCase();
  const productType = SEALED_VISION_PRODUCT_TYPES.has(typeRaw) ? typeRaw : "";
  const confidence = ["high", "medium", "low"].includes(confidenceRaw) ? confidenceRaw : "low";
  const clues = Array.isArray(raw?.clues) ? raw.clues.map(x => String(x || "").trim()).filter(Boolean).slice(0, 4) : [];
  const accepted = Boolean(productType && productType !== "Other" && confidence !== "low");
  return {
    productType,
    confidence,
    clues,
    accepted,
    followUp: String(raw?.followUp || "").trim().slice(0, 180),
  };
}
'''
if "function sealedTypeJsonFromResponse" not in worker:
    if helper_marker not in worker:
        raise SystemExit("Could not find sealed barcode helper marker")
    worker = worker.replace(helper_marker, helper_code + helper_marker, 1)

route_marker = '    if (url.pathname === "/sealed/identify" && request.method === "POST") {'
route_code = r'''    if (url.pathname === "/sealed/classify-type" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.AI) {
        return json({ ok: false, error: "vision_not_configured", message: "Scout product-type photo reading is not configured on the Worker." }, 503, cors);
      }
      let body = {};
      try { body = await request.json(); }
      catch { return json({ ok: false, error: "bad_json", message: "Scout could not read that product-type request." }, 400, cors); }

      const imageDataUrl = String(body?.imageDataUrl || "");
      const match = imageDataUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/i);
      if (!match) return json({ ok: false, error: "bad_image", message: "Scout needs a clear front JPEG, PNG, or WebP photo to classify the package type." }, 400, cors);
      const approxBytes = Math.floor(match[2].length * 3 / 4);
      if (approxBytes <= 0 || approxBytes > SEALED_VISION_MAX_BYTES) {
        return json({ ok: false, error: "image_too_large", message: "That front photo is too large. Retake it a little closer." }, 413, cors);
      }

      const known = body?.identity && typeof body.identity === "object" ? body.identity : {};
      const knownCategory = String(known.category || "").trim().slice(0, 60);
      const knownYear = String(known.year || "").trim().slice(0, 40);
      const knownSet = String(known.set || "").trim().slice(0, 160);
      const knownTitle = String(known.lookupTitle || "").trim().slice(0, 220);
      const knownBarcode = sealedBarcodeDigits(known.barcode || "");
      if (!knownSet && !knownTitle) {
        return json({ ok: false, error: "missing_identity", message: "Scan the barcode first so Scout knows which product it is before classifying the package type." }, 400, cors);
      }

      const allowedTypes = Array.from(SEALED_VISION_PRODUCT_TYPES).join(", ");
      const knownLabel = [knownYear, knownSet || knownTitle, knownCategory].filter(Boolean).join(" · ");
      const question = `The barcode has ALREADY identified this sealed trading-card product as: ${knownLabel || knownTitle}. ${knownBarcode ? `Barcode: ${knownBarcode}.` : ""} Do NOT re-identify the product, set, sport, or year. Your only job is to classify the PACKAGE FORMAT visible in this front photo. Choose productType from exactly this list: ${allowedTypes}. Look first for explicit packaging words such as Blaster, Mega, Hobby, Retail, Hanger, Value Pack, Fat Pack, Elite Trainer Box, Booster Bundle, Booster Box, Booster Pack, Collection Box, Tin, Multi-Pack, or Single Pack. Use the physical box/pack shape only as secondary evidence. Return ONLY one JSON object with keys productType, confidence, clues, followUp. confidence must be high, medium, or low. If the type is not supported by the photo, use productType Other and confidence low instead of guessing.`;
      try {
        const raw = await env.AI.run(SEALED_VISION_MODEL, {
          task: "query",
          image: imageDataUrl,
          question,
          reasoning: false,
          stream: false,
          temperature: 0,
          max_tokens: 220
        });
        const classification = sealedTypeNormalize(sealedTypeJsonFromResponse(raw));
        return json({ ok: true, version: VERSION, classification, searchUsed: 0, marketplaceSearchesUsed: 0 }, 200, cors);
      } catch (err) {
        console.error("sealed product type classify failed", err);
        return json({ ok: false, error: "type_classify_failed", message: "Scout knows the product, but could not classify the package type from that front photo. Try another front photo or choose the type manually.", searchUsed: 0, marketplaceSearchesUsed: 0 }, 502, cors);
      }
    }

'''
if '/sealed/classify-type' not in worker:
    if route_marker not in worker:
        raise SystemExit("Could not find sealed identify route marker")
    worker = worker.replace(route_marker, route_code + route_marker, 1)
worker_path.write_text(worker, encoding="utf-8")

# Front end: after barcode identity, use a front photo only for package type.
app_path = Path("sealed-product-scout.js")
app = app_path.read_text(encoding="utf-8")
app = replace_once(
    app,
    '  let lastBarcodeIdentity=null;\n',
    '  let lastBarcodeIdentity=null;\n  let lastBarcodeData=null;\n',
    "barcode state",
)
app = replace_once(
    app,
    '          <input type="file" id="sealedBarcodeCameraInput" accept="image/*" capture="environment" hidden>\n',
    '          <input type="file" id="sealedBarcodeCameraInput" accept="image/*" capture="environment" hidden>\n          <input type="file" id="sealedTypeCameraInput" accept="image/*" capture="environment" hidden>\n',
    "type camera input",
)
app = replace_once(
    app,
    '            <div class="sealed-barcode-result" id="sealedBarcodeResult">Take a close photo of the barcode or type the digits printed below it. Barcode lookup uses 0 marketplace searches.</div>\n',
    '            <div class="sealed-barcode-result" id="sealedBarcodeResult">Take a close photo of the barcode or type the digits printed below it. Barcode lookup uses 0 marketplace searches.</div>\n            <div class="sealed-actions one" id="sealedTypePhotoRow" hidden><button type="button" class="secondary" id="sealedTypePhotoBtn">📷 TAKE FRONT PHOTO FOR PRODUCT TYPE</button></div>\n            <div class="sealed-barcode-result" id="sealedTypeResult" hidden></div>\n',
    "type classifier UI",
)

start = app.find('  function applyBarcodeResult(data){')
end = app.find('  async function lookupBarcode', start)
if start < 0 or end <= start:
    raise SystemExit("Could not isolate barcode result block")
new_barcode_block = r'''  function applyBarcodeResult(data){
    const identity=data?.identity||{};lastBarcodeIdentity=identity;lastBarcodeData=data||null;
    if(byId("sealedCategory")&&identity.category)byId("sealedCategory").value=identity.category;
    if(byId("sealedYear")&&identity.year)byId("sealedYear").value=identity.year;
    if(byId("sealedSet")&&identity.set)byId("sealedSet").value=identity.set;
    if(byId("sealedBoxType")&&identity.productType)byId("sealedBoxType").value=identity.productType;
    if(byId("sealedVariant")&&identity.variant)byId("sealedVariant").value=identity.variant;
    const box=byId("sealedBarcodeBox"),result=byId("sealedBarcodeResult"),input=byId("sealedBarcodeText");
    const typeRow=byId("sealedTypePhotoRow"),typeResult=byId("sealedTypeResult"),typeBtn=byId("sealedTypePhotoBtn");
    if(box)box.hidden=false;if(input)input.value=data?.barcode||input.value;
    const source=data?.barcodeSource==="entered_or_device"?"barcode decoder/manual read":"Cloudflare barcode OCR";
    const title=String(data?.lookupTitle||"").trim();
    const needsType=!identity.productType||identity.productType==="Other";
    if(result)result.innerHTML=title
      ?`✓ <strong>${esc(data.barcode)}</strong> matched <strong>${esc(title)}</strong>. Source: ${esc(source)}. ${needsType?"Product identity is confirmed; only the package type still needs classification.":"Review the filled product fields below before confirming."}`
      :`✓ Barcode <strong>${esc(data.barcode)}</strong> was read, but the product database did not return a title. Review or enter the product fields below.`;
    saveDraft({barcode:data?.barcode||"",barcodeTitle:title,identity:{...identity,boxType:identity.productType||""},confirmed:false});
    if(needsType&&title){
      if(typeRow)typeRow.hidden=false;
      if(typeResult){typeResult.hidden=false;typeResult.innerHTML="✓ <strong>Product confirmed by barcode.</strong> The database did not specify the package type. Scout can now use a front photo for just that one question.";}
      if(typeBtn)typeBtn.textContent="📷 TAKE FRONT PHOTO FOR PRODUCT TYPE";
      if(activePhotoFile){
        if(typeResult)typeResult.textContent="Product confirmed. Reusing your front photo to classify only the package type…";
        setTimeout(()=>classifyProductTypeFromPhoto(activePhotoFile),0);
      }else{
        box?.scrollIntoView({behavior:"smooth",block:"center"});
      }
    }else{
      if(typeRow)typeRow.hidden=true;
      if(typeResult)typeResult.hidden=true;
      byId("sealedIdentityCard")?.scrollIntoView({behavior:"smooth",block:"start"});
    }
  }

  async function classifyProductTypeFromPhoto(file){
    const typeRow=byId("sealedTypePhotoRow"),typeResult=byId("sealedTypeResult"),typeBtn=byId("sealedTypePhotoBtn");
    const photoStatus=byId("sealedPhotoStatus");
    if(typeRow)typeRow.hidden=false;
    if(typeResult){typeResult.hidden=false;typeResult.textContent="Scout already knows the product. Classifying only the package type from this front photo…";}
    if(typeBtn)typeBtn.disabled=true;
    const cfg=typeof pricingConfig==="function"?pricingConfig():{endpoint:"",accessKey:""};
    if(!cfg.endpoint||!cfg.accessKey){if(typeResult)typeResult.textContent="Scout's live connection is not configured on this device.";if(typeBtn)typeBtn.disabled=false;return;}
    try{
      const current=identityFromFields();
      const imageDataUrl=await visionImageDataUrl(file);
      const known={category:current.category,year:current.year,set:current.set,variant:current.variant,barcode:lastBarcodeData?.barcode||readDraft().barcode||"",lookupTitle:lastBarcodeData?.lookupTitle||readDraft().barcodeTitle||""};
      const res=await fetch(`${String(cfg.endpoint).replace(/\/+$/,"")}/sealed/classify-type`,{method:"POST",headers:{"Content-Type":"application/json","X-Scout-Key":cfg.accessKey},body:JSON.stringify({imageDataUrl,identity:known})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.ok)throw new Error(data.message||"Scout could not classify the package type.");
      const classification=data.classification||{};
      const type=String(classification.productType||"").trim();
      const confidence=String(classification.confidence||"low").toLowerCase();
      const clues=Array.isArray(classification.clues)?classification.clues.filter(Boolean):[];
      const accepted=Boolean(classification.accepted&&type&&type!=="Other");
      if(accepted){
        byId("sealedBoxType").value=type;
        lastBarcodeIdentity={...(lastBarcodeIdentity||{}),productType:type};
        saveDraft({identity:identityFromFields(),confirmed:false});
        if(typeResult)typeResult.innerHTML=`✓ <strong>Product type: ${esc(type)}</strong> · ${esc(confidence.toUpperCase())} confidence.${clues.length?` Visible clue${clues.length===1?"":"s"}: ${esc(clues.join(" · "))}.`:""} Product Type has been filled in for you.`;
        if(photoStatus){photoStatus.className="sealed-status ok";photoStatus.textContent=`✓ Front photo classified as ${type}. Barcode identity stayed unchanged. 0 marketplace searches used.`;}
        if(typeBtn)typeBtn.textContent="📷 RETAKE FRONT PHOTO FOR TYPE";
        byId("sealedIdentityCard")?.scrollIntoView({behavior:"smooth",block:"start"});
      }else{
        const suggestion=type&&type!=="Other"?type:"";
        if(typeResult)typeResult.innerHTML=suggestion
          ?`Scout's best package-type guess is <strong>${esc(suggestion)}</strong>, but confidence is ${esc(confidence.toUpperCase())}. I left Product Type unfilled so you can choose it manually or try another front photo.`
          :`The barcode still confirms the product, but Scout could not confidently classify the package type from this photo. Choose it manually or try another front photo.`;
        if(photoStatus){photoStatus.className="sealed-status warn";photoStatus.textContent="Product identity is confirmed by barcode; only package type remains uncertain.";}
        if(typeBtn)typeBtn.textContent="📷 TRY ANOTHER FRONT PHOTO";
      }
    }catch(err){
      if(typeResult)typeResult.textContent=err?.message||"Scout knows the product, but could not classify the package type from that photo.";
      if(photoStatus){photoStatus.className="sealed-status warn";photoStatus.textContent="Product identity is still confirmed by barcode; choose the type manually or try another front photo.";}
    }finally{
      if(typeBtn)typeBtn.disabled=false;
    }
  }

  async function handleTypePhoto(file){
    if(!file)return;
    if(!String(file.type||"").startsWith("image/")){const r=byId("sealedTypeResult");if(r){r.hidden=false;r.textContent="That file is not an image.";}return;}
    clearPhotoUrl();activePhotoFile=file;activePhotoUrl=URL.createObjectURL(file);
    byId("sealedPhotoStage").innerHTML=`<img src="${esc(activePhotoUrl)}" alt="Front photo for package type">`;
    saveDraft({hasPhoto:true,photoName:String(file.name||"sealed product front photo"),confirmed:false});
    await classifyProductTypeFromPhoto(file);
  }

'''
app = app[:start] + new_barcode_block + app[end:]

app = replace_once(
    app,
    '    clearPhotoUrl();clearBarcodePhotoUrl();activePhotoFile=null;activeBarcodeFile=null;lastVisionIdentity=null;lastBarcodeIdentity=null;\n',
    '    clearPhotoUrl();clearBarcodePhotoUrl();activePhotoFile=null;activeBarcodeFile=null;lastVisionIdentity=null;lastBarcodeIdentity=null;lastBarcodeData=null;\n',
    "start-over barcode state",
)
app = replace_once(
    app,
    '    byId("sealedCameraInput").value="";byId("sealedPhotoInput").value="";byId("sealedBarcodeCameraInput").value="";\n',
    '    byId("sealedCameraInput").value="";byId("sealedPhotoInput").value="";byId("sealedBarcodeCameraInput").value="";byId("sealedTypeCameraInput").value="";\n',
    "start-over type camera",
)
app = replace_once(
    app,
    '    byId("sealedBarcodeBox").hidden=true;byId("sealedBarcodePreview").hidden=true;byId("sealedBarcodePreview").innerHTML="";byId("sealedBarcodeReadBtn").disabled=true;byId("sealedBarcodeResult").textContent="Take a close photo of the barcode or type the digits printed below it. Barcode lookup uses 0 marketplace searches.";\n',
    '    byId("sealedBarcodeBox").hidden=true;byId("sealedBarcodePreview").hidden=true;byId("sealedBarcodePreview").innerHTML="";byId("sealedBarcodeReadBtn").disabled=true;byId("sealedBarcodeResult").textContent="Take a close photo of the barcode or type the digits printed below it. Barcode lookup uses 0 marketplace searches.";byId("sealedTypePhotoRow").hidden=true;byId("sealedTypeResult").hidden=true;byId("sealedTypeResult").textContent="";\n',
    "start-over type UI",
)
app = replace_once(
    app,
    '    byId("sealedBarcodeCameraInput").addEventListener("change",e=>handleBarcodePhoto(e.target.files?.[0]));\n',
    '    byId("sealedBarcodeCameraInput").addEventListener("change",e=>handleBarcodePhoto(e.target.files?.[0]));\n    byId("sealedTypePhotoBtn").addEventListener("click",()=>byId("sealedTypeCameraInput").click());\n    byId("sealedTypeCameraInput").addEventListener("change",e=>handleTypePhoto(e.target.files?.[0]));\n',
    "type photo events",
)
app_path.write_text(app, encoding="utf-8")

# Regression tests.
test_path = Path("tests/sealed-product-vision.test.cjs")
test = test_path.read_text(encoding="utf-8")
test = replace_once(test, 'assert.match(worker,/const VERSION = "3\\.37\\.0"/);', 'assert.match(worker,/const VERSION = "3\\.37\\.1"/);', "test version")
if "sealed product type classifier endpoint must exist" not in test:
    insert_after = "assert.match(worker,/\\/sealed\\/barcode-identify/,'sealed barcode endpoint must exist');\n"
    additions = "assert.match(worker,/\\/sealed\\/classify-type/,'sealed product type classifier endpoint must exist');\nassert.match(app,/TAKE FRONT PHOTO FOR PRODUCT TYPE/,'barcode-confirmed products should request a front photo when type is missing');\nassert.match(app,/sealed\\/classify-type/,'front end must call the narrow product type classifier');\nassert.match(app,/classifyProductTypeFromPhoto/,'front end should classify only package type after barcode identity');\n"
    test = replace_once(test, insert_after, insert_after + additions, "type classifier assertions")
if "typeRouteStart" not in test:
    before_log = "console.log('Sealed Product Scout vision tests passed.');"
    route_assertions = "const typeRouteStart=worker.indexOf('url.pathname === \"/sealed/classify-type\"');\nconst typeRouteEnd=worker.indexOf('url.pathname === \"/sealed/identify\"',typeRouteStart);\nconst typeRoute=worker.slice(typeRouteStart,typeRouteEnd);\nassert.ok(typeRouteStart>=0&&typeRouteEnd>typeRouteStart,'type classifier route should be isolated before full vision route');\nassert.doesNotMatch(typeRoute,/SERPAPI_KEY|runEbaySearch|serpapi\\.com|APIFY_TOKEN|CARD_API_KEY/i,'type classifier must not call marketplace providers');\nassert.match(typeRoute,/Do NOT re-identify the product/,'type classifier prompt must preserve barcode-confirmed identity');\nassert.match(typeRoute,/marketplaceSearchesUsed:\\s*0/,'type classifier must report zero marketplace searches');\n"
    test = replace_once(test, before_log, route_assertions + before_log, "type classifier route tests")
test_path.write_text(test, encoding="utf-8")
