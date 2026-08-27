from pathlib import Path

# ---- Worker ----
p=Path('src/index.js')
s=p.read_text(encoding='utf-8')
s=s.replace('const VERSION = "3.34.0";','const VERSION = "3.35.0";',1)

anchor='const CARD_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);\n\n'
insert='''const CARD_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);\nconst SEALED_VISION_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";\nconst SEALED_VISION_MAX_BYTES = 1500 * 1024;\nconst SEALED_VISION_CATEGORIES = new Set(["Pokémon", "Magic: The Gathering", "Baseball", "Basketball", "Football", "Other"]);\nconst SEALED_VISION_PRODUCT_TYPES = new Set(["Blaster Box", "Mega Box", "Hobby Box", "Retail Box", "Hanger Box", "Hanger Pack", "Value / Fat Pack", "Single Pack", "Multi-Pack", "Elite Trainer Box", "Booster Box", "Booster Bundle", "Booster Pack", "Collection Box", "Tin", "Other"]);\n\n'''
if 'SEALED_VISION_MODEL' not in s:
    if anchor not in s: raise SystemExit('worker constants anchor missing')
    s=s.replace(anchor,insert,1)

helpers='''function sealedVisionJsonFromResponse(raw) {\n  let value = raw?.response ?? raw?.result ?? raw;\n  if (value && typeof value === "object" && !Array.isArray(value)) return value;\n  let text = String(value || "").trim();\n  text = text.replace(/^```(?:json)?\\s*/i, "").replace(/\\s*```$/, "").trim();\n  const first = text.indexOf("{");\n  const last = text.lastIndexOf("}");\n  if (first >= 0 && last > first) text = text.slice(first, last + 1);\n  return JSON.parse(text);\n}\n\nfunction sealedVisionNormalize(raw) {\n  const categoryRaw = String(raw?.category || "").trim();\n  const typeRaw = String(raw?.productType || raw?.boxType || "").trim();\n  const confidenceRaw = String(raw?.confidence || "low").trim().toLowerCase();\n  const category = SEALED_VISION_CATEGORIES.has(categoryRaw) ? categoryRaw : (categoryRaw ? "Other" : "");\n  const productType = SEALED_VISION_PRODUCT_TYPES.has(typeRaw) ? typeRaw : (typeRaw ? "Other" : "");\n  const clues = Array.isArray(raw?.clues) ? raw.clues.map(x => String(x || "").trim()).filter(Boolean).slice(0, 4) : [];\n  return {\n    category,\n    year: String(raw?.year || "").trim().slice(0, 40),\n    set: String(raw?.set || raw?.brandSet || "").trim().slice(0, 120),\n    productType,\n    variant: String(raw?.variant || "").trim().slice(0, 120),\n    confidence: ["high", "medium", "low"].includes(confidenceRaw) ? confidenceRaw : "low",\n    clues,\n    needsAnotherPhoto: Boolean(raw?.needsAnotherPhoto),\n    followUp: String(raw?.followUp || "").trim().slice(0, 180),\n  };\n}\n\n'''
if 'function sealedVisionJsonFromResponse' not in s:
    marker='export default {\n'
    if marker not in s: raise SystemExit('worker export anchor missing')
    s=s.replace(marker,helpers+marker,1)

route='''    if (url.pathname === "/sealed/identify" && request.method === "POST") {\n      const supplied = request.headers.get("X-Scout-Key") || "";\n      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {\n        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);\n      }\n      if (!env.AI) {\n        return json({ ok: false, error: "vision_not_configured", message: "Scout photo identification is not configured on the Worker." }, 503, cors);\n      }\n      let body = {};\n      try { body = await request.json(); }\n      catch { return json({ ok: false, error: "bad_json", message: "Scout could not read that photo request." }, 400, cors); }\n      const imageDataUrl = String(body?.imageDataUrl || "");\n      const match = imageDataUrl.match(/^data:image\\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/i);\n      if (!match) return json({ ok: false, error: "bad_image", message: "Scout needs a JPEG, PNG, or WebP photo." }, 400, cors);\n      const approxBytes = Math.floor(match[2].length * 3 / 4);\n      if (approxBytes <= 0 || approxBytes > SEALED_VISION_MAX_BYTES) {\n        return json({ ok: false, error: "image_too_large", message: "That photo is too large for Scout to analyze. Please retake it a little closer." }, 413, cors);\n      }\n\n      const schema = {\n        type: "object",\n        properties: {\n          category: { type: "string" },\n          year: { type: "string" },\n          set: { type: "string" },\n          productType: { type: "string" },\n          variant: { type: "string" },\n          confidence: { type: "string", enum: ["high", "medium", "low"] },\n          clues: { type: "array", items: { type: "string" }, maxItems: 4 },\n          needsAnotherPhoto: { type: "boolean" },\n          followUp: { type: "string" }\n        },\n        required: ["category", "year", "set", "productType", "variant", "confidence", "clues", "needsAnotherPhoto", "followUp"]\n      };\n      const productTypes = Array.from(SEALED_VISION_PRODUCT_TYPES).join(", ");\n      const prompt = `Identify the exact sealed trading-card product shown in this front photo. Categories: Pokémon, Magic: The Gathering, Baseball, Basketball, Football, Other. Product type MUST be one of: ${productTypes}. Read visible packaging text carefully: year/season, brand/set, format, pack/card counts, retail-exclusive wording, and variant clues. Distinguish blaster, mega, hobby, retail, hanger, value/fat pack, single pack, multi-pack, booster formats, tins, and collection boxes. Do not guess when the photo does not support a field. If product type is uncertain, use Other and set needsAnotherPhoto=true. If another side/back photo would resolve ambiguity, say exactly what wording or panel to photograph in followUp. Return only the requested structured fields.`;\n      try {\n        const raw = await env.AI.run(SEALED_VISION_MODEL, {\n          messages: [\n            { role: "system", content: "You are Scout, a careful trading-card sealed-product identifier. Accuracy matters more than guessing." },\n            { role: "user", content: prompt }\n          ],\n          image: imageDataUrl,\n          guided_json: schema,\n          temperature: 0.1,\n          max_tokens: 320\n        });\n        const parsed = sealedVisionJsonFromResponse(raw);\n        const identity = sealedVisionNormalize(parsed);\n        return json({ ok: true, version: VERSION, identity, searchUsed: 0, marketplaceSearchesUsed: 0 }, 200, cors);\n      } catch (err) {\n        console.error("sealed vision identify failed", err);\n        return json({ ok: false, error: "vision_identify_failed", message: "Scout could not confidently read that photo. Try another front photo or enter the product manually.", searchUsed: 0, marketplaceSearchesUsed: 0 }, 502, cors);\n      }\n    }\n\n'''
if 'url.pathname === "/sealed/identify"' not in s:
    marker='    if (url.pathname === "/automation/status" && request.method === "GET") {'
    if marker not in s: raise SystemExit('worker route anchor missing')
    s=s.replace(marker,route+marker,1)

s=s.replace('          cloudStorage: Boolean(env.SCOUT_DATA),\n','          cloudStorage: Boolean(env.SCOUT_DATA),\n          vision: Boolean(env.AI),\n',1)
p.write_text(s,encoding='utf-8')

# ---- Wrangler AI binding ----
p=Path('wrangler.jsonc')
w=p.read_text(encoding='utf-8')
if '"ai"' not in w:
    marker='  "kv_namespaces": ['
    if marker not in w: raise SystemExit('wrangler binding anchor missing')
    w=w.replace(marker,'  "ai": {\n    "binding": "AI"\n  },\n  "kv_namespaces": [',1)
p.write_text(w,encoding='utf-8')

# ---- Front end ----
p=Path('sealed-product-scout.js')
j=p.read_text(encoding='utf-8')
j=j.replace('  let activePhotoUrl="";\n','  let activePhotoUrl="";\n  let activePhotoFile=null;\n  let lastVisionIdentity=null;\n',1)
j=j.replace('.sealed-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}.sealed-actions.three{grid-template-columns:1fr 1fr 1fr}.sealed-actions button{min-height:48px}', '.sealed-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}.sealed-actions.three{grid-template-columns:1fr 1fr 1fr}.sealed-actions.one{grid-template-columns:1fr}.sealed-actions button{min-height:48px}',1)
style_anchor='      .sealed-status{margin-top:10px;border-radius:13px;border:1px solid var(--line);padding:10px 11px;font-size:11px;line-height:1.5;color:var(--muted);background:rgba(0,0,0,.08)}.sealed-status.ok{border-color:rgba(86,197,138,.35);color:#aee9c8}.sealed-status.warn{border-color:rgba(230,189,99,.38);color:#f4d58a}\n'
if '.sealed-vision-result' not in j:
    if style_anchor not in j: raise SystemExit('sealed style anchor missing')
    j=j.replace(style_anchor,style_anchor+'      .sealed-vision-result{margin-top:12px;border:1px solid rgba(230,189,99,.38);border-radius:16px;padding:12px;background:rgba(230,189,99,.07)}.sealed-vision-result[hidden]{display:none}.sealed-vision-guess{font-size:17px;font-weight:950;line-height:1.35;margin-top:4px}.sealed-vision-meta{font-size:10px;color:var(--muted);line-height:1.5;margin-top:6px}.sealed-ai-badge{display:inline-flex;margin-top:8px;border-radius:999px;padding:5px 8px;background:rgba(117,174,233,.13);color:#b7d8f5;border:1px solid rgba(117,174,233,.28);font-size:9px;font-weight:950;letter-spacing:.04em}\n',1)

j=j.replace('Scan a pack, hanger, tin, bundle, box, or other sealed product. Scout will confirm exactly what you mean before any pricing research happens. This first gate uses <strong>0 marketplace searches</strong>.','Scan a pack, hanger, tin, bundle, box, or other sealed product. Scout can read the photo and propose the exact product for you to confirm before any pricing research happens. Photo identification uses <strong>0 marketplace searches</strong>.',1)
j=j.replace('Photo capture is ready now. Visual auto-identification will be connected in the next gate; until then, the manual confirmation fields below let us test the full in-store flow without guessing.','Take or choose a photo, then tap Identify Product. Scout sends a compressed copy to Cloudflare Workers AI for identification only when you ask. Manual entry remains available if the packaging is unclear.',1)
j=j.replace('<div class="sealed-status" id="sealedPhotoStatus">No searches used. Scout is waiting for a photo or manual product details.</div>','<div class="sealed-status" id="sealedPhotoStatus">No marketplace searches used. Scout is waiting for a photo or manual product details.</div>\n          <div class="sealed-actions one"><button type="button" class="secondary" id="sealedAnalyzeBtn" disabled>🔍 IDENTIFY PRODUCT FROM PHOTO · 0 MARKETPLACE SEARCHES</button></div>',1)
vision_panel='''          <div class="sealed-vision-result" id="sealedVisionResult" hidden>\n            <div class="section-eyebrow">🔍 SCOUT'S PHOTO MATCH</div>\n            <div class="sealed-vision-guess" id="sealedVisionGuess"></div>\n            <div class="sealed-vision-meta" id="sealedVisionMeta"></div>\n            <span class="sealed-ai-badge">CLOUDFLARE AI · 0 MARKETPLACE SEARCHES</span>\n            <div class="sealed-actions three">\n              <button type="button" class="secondary" id="sealedVisionAcceptBtn">✓ YES, THAT'S IT</button>\n              <button type="button" class="ghost" id="sealedVisionEditBtn">✏️ NEEDS CORRECTION</button>\n              <button type="button" class="ghost" id="sealedVisionRetakeBtn">📷 ANOTHER PHOTO</button>\n            </div>\n          </div>\n'''
anchor='          <div class="sealed-form">\n'
if 'id="sealedVisionResult"' not in j:
    idx=j.find(anchor,j.find('id="sealedIdentityCard"'))
    if idx<0: raise SystemExit('identity form anchor missing')
    j=j[:idx]+vision_panel+j[idx:]

old_handle='''  function handlePhoto(file){\n    if(!file)return;\n    if(!String(file.type||"").startsWith("image/")){byId("sealedPhotoStatus").textContent="That file is not an image. Try a photo of the sealed product front.";return;}\n    clearPhotoUrl();\n    activePhotoUrl=URL.createObjectURL(file);\n    byId("sealedPhotoStage").innerHTML=`<img src="${esc(activePhotoUrl)}" alt="Sealed product photo preview">`;\n    const mb=(file.size/1024/1024).toFixed(1);\n    const status=byId("sealedPhotoStatus");status.className="sealed-status ok";\n    status.textContent=`✓ Photo captured (${mb} MB). It stays on this device for this session. 0 marketplace searches used.`;\n    saveDraft({hasPhoto:true,photoName:String(file.name||"sealed product photo")});\n    byId("sealedIdentityCard")?.scrollIntoView({behavior:"smooth",block:"start"});\n  }\n\n'''
new_handle='''  function handlePhoto(file){\n    if(!file)return;\n    if(!String(file.type||"").startsWith("image/")){byId("sealedPhotoStatus").textContent="That file is not an image. Try a photo of the sealed product front.";return;}\n    clearPhotoUrl();\n    activePhotoFile=file;lastVisionIdentity=null;\n    activePhotoUrl=URL.createObjectURL(file);\n    byId("sealedPhotoStage").innerHTML=`<img src="${esc(activePhotoUrl)}" alt="Sealed product photo preview">`;\n    const mb=(file.size/1024/1024).toFixed(1);\n    const status=byId("sealedPhotoStatus");status.className="sealed-status ok";\n    status.textContent=`✓ Photo captured (${mb} MB). Tap Identify Product and Scout will analyze a compressed copy. 0 marketplace searches used.`;\n    const analyze=byId("sealedAnalyzeBtn");if(analyze){analyze.disabled=false;analyze.textContent="🔍 IDENTIFY PRODUCT FROM PHOTO · 0 MARKETPLACE SEARCHES";}\n    const vr=byId("sealedVisionResult");if(vr)vr.hidden=true;\n    saveDraft({hasPhoto:true,photoName:String(file.name||"sealed product photo"),confirmed:false});\n  }\n\n  function fileToDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||""));r.onerror=()=>reject(new Error("Scout could not read that photo."));r.readAsDataURL(file);});}\n  function loadPhoto(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("Scout could not open that photo."));img.src=src;});}\n  async function visionImageDataUrl(file){\n    const source=await fileToDataUrl(file);\n    const img=await loadPhoto(source);\n    const maxDim=1200,scale=Math.min(1,maxDim/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));\n    const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round((img.naturalWidth||img.width)*scale));canvas.height=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));\n    canvas.getContext("2d",{alpha:false}).drawImage(img,0,0,canvas.width,canvas.height);\n    let out=canvas.toDataURL("image/jpeg",.78);\n    if(out.length>1900000)out=canvas.toDataURL("image/jpeg",.62);\n    return out;\n  }\n  function visionGuessLabel(identity){return [identity.year,identity.set,identity.productType,identity.variant].filter(Boolean).join(" · ")||"Sealed product";}\n  function applyVisionIdentity(identity){\n    lastVisionIdentity=identity||null;if(!identity)return;\n    if(byId("sealedCategory")&&identity.category)byId("sealedCategory").value=identity.category;\n    if(byId("sealedYear"))byId("sealedYear").value=identity.year||"";\n    if(byId("sealedSet"))byId("sealedSet").value=identity.set||"";\n    if(byId("sealedBoxType")&&identity.productType)byId("sealedBoxType").value=identity.productType;\n    if(byId("sealedVariant"))byId("sealedVariant").value=identity.variant||"";\n    const result=byId("sealedVisionResult");if(result)result.hidden=false;\n    byId("sealedVisionGuess").textContent=visionGuessLabel(identity);\n    const bits=[];bits.push(`Confidence: ${String(identity.confidence||"low").toUpperCase()}.`);\n    if(Array.isArray(identity.clues)&&identity.clues.length)bits.push(`Visible clues: ${identity.clues.join(" · ")}`);\n    if(identity.needsAnotherPhoto)bits.push(identity.followUp||"Scout would like another angle before you rely on this match.");\n    byId("sealedVisionMeta").textContent=bits.join(" ");\n    const complete=!!identity.category&&!!identity.set&&!!identity.productType&&identity.productType!=="Other";\n    byId("sealedVisionAcceptBtn").disabled=!complete;\n    result?.scrollIntoView({behavior:"smooth",block:"center"});\n  }\n  async function analyzePhoto(){\n    const status=byId("sealedPhotoStatus"),btn=byId("sealedAnalyzeBtn");\n    if(!activePhotoFile){status.className="sealed-status warn";status.textContent="Take or choose a photo first.";return;}\n    const cfg=typeof pricingConfig==="function"?pricingConfig():{endpoint:"",accessKey:""};\n    if(!cfg.endpoint||!cfg.accessKey){status.className="sealed-status warn";status.textContent="Scout's live connection is not configured on this device.";return;}\n    btn.disabled=true;btn.textContent="🔍 SCOUT IS READING THE PRODUCT…";status.className="sealed-status";status.textContent="Reading packaging text and sealed format with Cloudflare AI. 0 marketplace searches.";\n    try{\n      const imageDataUrl=await visionImageDataUrl(activePhotoFile);\n      const res=await fetch(`${String(cfg.endpoint).replace(/\\/+$/,"")}/sealed/identify`,{method:"POST",headers:{"Content-Type":"application/json","X-Scout-Key":cfg.accessKey},body:JSON.stringify({imageDataUrl})});\n      const data=await res.json().catch(()=>({}));\n      if(!res.ok||!data.ok)throw new Error(data.message||"Scout could not identify that photo.");\n      applyVisionIdentity(data.identity||{});\n      status.className="sealed-status ok";status.textContent="✓ Photo analyzed. Review Scout's match below before confirming. 0 marketplace searches used.";\n    }catch(err){status.className="sealed-status warn";status.textContent=err?.message||"Scout could not identify that photo. Try another angle or enter it manually.";}\n    finally{btn.disabled=false;btn.textContent="🔍 IDENTIFY PRODUCT FROM PHOTO · 0 MARKETPLACE SEARCHES";}\n  }\n\n'''
if old_handle not in j: raise SystemExit('handlePhoto block missing')
j=j.replace(old_handle,new_handle,1)

# reset photo state + vision UI
j=j.replace('    clearPhotoUrl();\n    localStorage.removeItem(DRAFT_KEY);','    clearPhotoUrl();activePhotoFile=null;lastVisionIdentity=null;\n    localStorage.removeItem(DRAFT_KEY);',1)
j=j.replace('    const ps=byId("sealedPhotoStatus");ps.className="sealed-status";ps.textContent="No searches used. Scout is waiting for a photo or manual product details.";','    const ps=byId("sealedPhotoStatus");ps.className="sealed-status";ps.textContent="No marketplace searches used. Scout is waiting for a photo or manual product details.";\n    const analyze=byId("sealedAnalyzeBtn");if(analyze){analyze.disabled=true;analyze.textContent="🔍 IDENTIFY PRODUCT FROM PHOTO · 0 MARKETPLACE SEARCHES";}\n    const vr=byId("sealedVisionResult");if(vr)vr.hidden=true;',1)

mount_anchor='    byId("sealedPhotoInput").addEventListener("change",e=>handlePhoto(e.target.files?.[0]));\n'
mount_extra='''    byId("sealedAnalyzeBtn").addEventListener("click",analyzePhoto);\n    byId("sealedVisionAcceptBtn").addEventListener("click",()=>confirmIdentity());\n    byId("sealedVisionEditBtn").addEventListener("click",()=>{byId("sealedIdentityCard")?.scrollIntoView({behavior:"smooth",block:"start"});setTimeout(()=>byId("sealedCategory")?.focus(),250);});\n    byId("sealedVisionRetakeBtn").addEventListener("click",()=>byId("sealedCameraInput").click());\n'''
if 'sealedAnalyzeBtn").addEventListener' not in j:
    if mount_anchor not in j: raise SystemExit('mount photo input anchor missing')
    j=j.replace(mount_anchor,mount_anchor+mount_extra,1)
p.write_text(j,encoding='utf-8')

# ---- App version/cache bust ----
p=Path('index.html')
h=p.read_text(encoding='utf-8')
h=h.replace('sealed-product-scout.js?v=6.0.2','sealed-product-scout.js?v=6.1.0',1)
h=h.replace('v6.0.2','v6.1.0')
h=h.replace('version:"6.0.2"','version:"6.1.0"')
p.write_text(h,encoding='utf-8')

# ---- Update tests and add vision tests ----
for test in Path('tests').glob('*.test.cjs'):
    t=test.read_text(encoding='utf-8')
    t=t.replace('v6\\.0\\.2','v6\\.1\\.0').replace('v6.0.2','v6.1.0').replace('version:"6.0.2"','version:"6.1.0"')
    if test.name=='sealed-product-scout.test.cjs':
        t=t.replace("assert.doesNotMatch(js,/\\bfetch\\s*\\(/,'first gate must not call any network API');", "assert.match(js,/\\/sealed\\/identify/,'photo identification should call only the sealed vision endpoint');")
        t=t.replace("assert.doesNotMatch(js,/SerpApi|\\/value|\\/deals|runEbaySearch/,'first gate must not invoke marketplace pricing code');", "assert.doesNotMatch(js,/SerpApi|\\/value|\\/deals|runEbaySearch/,'photo identification must not invoke marketplace pricing code');")
        t=t.replace("sealed-product-scout\\.js\\?v=6\\.0\\.2", "sealed-product-scout\\.js\\?v=6\\.1\\.0")
    test.write_text(t,encoding='utf-8')

Path('tests/sealed-product-vision.test.cjs').write_text(r'''const assert=require('node:assert/strict');
const fs=require('node:fs');
const worker=fs.readFileSync('src/index.js','utf8');
const app=fs.readFileSync('sealed-product-scout.js','utf8');
const wrangler=fs.readFileSync('wrangler.jsonc','utf8');

assert.match(worker,/const VERSION = "3\.35\.0"/);
assert.match(wrangler,/"ai"\s*:\s*\{\s*"binding"\s*:\s*"AI"/s,'Workers AI binding must be configured');
assert.match(worker,/\/sealed\/identify/,'sealed vision endpoint must exist');
assert.match(worker,/@cf\/meta\/llama-4-scout-17b-16e-instruct/,'Cloudflare-hosted vision model must be used');
assert.match(worker,/marketplaceSearchesUsed:\s*0/,'vision endpoint must explicitly report zero marketplace searches');
const start=worker.indexOf('url.pathname === "/sealed/identify"');
const end=worker.indexOf('url.pathname === "/automation/status"',start);
const route=worker.slice(start,end);
assert.ok(start>=0&&end>start,'sealed route should be isolated before automation route');
assert.doesNotMatch(route,/SERPAPI_KEY|runEbaySearch|serpapi\.com|APIFY_TOKEN|CARD_API_KEY/i,'vision route must not call marketplace providers');
assert.match(app,/IDENTIFY PRODUCT FROM PHOTO · 0 MARKETPLACE SEARCHES/);
assert.match(app,/YES, THAT'S IT/);
assert.match(app,/ANOTHER PHOTO/);
assert.match(app,/Cloudflare Workers AI/i);
assert.match(app,/fetch\(`\$\{String\(cfg\.endpoint\).*\/sealed\/identify/s,'front end should send photo only to Scout sealed-identify endpoint');
console.log('Sealed Product Scout vision tests passed.');
''',encoding='utf-8')
