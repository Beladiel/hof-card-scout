(function(){
  const DRAFT_KEY="scoutSealedProductDraftV1";
  let activePhotoUrl="";
  let activePhotoFile=null;
  let lastVisionIdentity=null;
  let lastBarcodeIdentity=null;
  let lastBarcodeData=null;
  let activeBarcodeFile=null;
  let activeBarcodePhotoUrl="";

  function esc(value){return String(value??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));}
  function byId(id){return document.getElementById(id);}
  function readDraft(){try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||"{}");}catch{return {};}}
  function saveDraft(patch){const next={...readDraft(),...patch,updatedAt:new Date().toISOString()};localStorage.setItem(DRAFT_KEY,JSON.stringify(next));return next;}
  function clearPhotoUrl(){if(activePhotoUrl){try{URL.revokeObjectURL(activePhotoUrl);}catch{}activePhotoUrl="";}}
  function clearBarcodePhotoUrl(){if(activeBarcodePhotoUrl){try{URL.revokeObjectURL(activeBarcodePhotoUrl);}catch{}activeBarcodePhotoUrl="";}}
  function money(value){const n=Number(value);return Number.isFinite(n)&&n>=0?"$"+n.toFixed(2):"";}

  function addStyles(){
    if(byId("sealedProductScoutStyles"))return;
    const style=document.createElement("style");
    style.id="sealedProductScoutStyles";
    style.textContent=`
      .sealed-home-btn{grid-column:1/-1;min-height:58px;font-size:14px;letter-spacing:.01em;background:linear-gradient(135deg,var(--gold),#f4d98d);box-shadow:0 8px 22px rgba(230,189,99,.12)}
      .sealed-wrap{display:grid;gap:13px}.sealed-hero{position:relative;overflow:hidden;border:1px solid rgba(230,189,99,.42);border-radius:20px;padding:16px;background:linear-gradient(145deg,rgba(230,189,99,.13),rgba(255,255,255,.035))}
      .sealed-hero:after{content:"📦";position:absolute;right:-5px;top:-18px;font-size:84px;opacity:.08;transform:rotate(8deg);pointer-events:none}.sealed-title{font-size:26px;font-weight:950;line-height:1.05;margin-top:4px}.sealed-sub{font-size:12px;color:var(--muted);line-height:1.5;margin-top:7px;max-width:680px}
      .sealed-category-row{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.sealed-category{font-size:10px;font-weight:900;border:1px solid var(--line);border-radius:999px;padding:6px 8px;background:rgba(255,255,255,.035);color:var(--muted)}
      .sealed-card{border:1px solid var(--line);border-radius:18px;padding:14px;background:rgba(255,255,255,.04)}.sealed-card-title{font-size:17px;font-weight:950;margin-top:3px}.sealed-card-sub{font-size:11px;line-height:1.5;color:var(--muted);margin-top:5px}
      .sealed-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}.sealed-actions.three{grid-template-columns:1fr 1fr 1fr}.sealed-actions.one{grid-template-columns:1fr}.sealed-actions button{min-height:48px}
      .sealed-photo-stage{margin-top:12px;border:1px dashed rgba(230,189,99,.4);border-radius:16px;min-height:155px;display:grid;place-items:center;overflow:hidden;background:rgba(0,0,0,.12);position:relative}.sealed-photo-stage img{display:block;width:100%;max-height:420px;object-fit:contain;background:#111}.sealed-photo-empty{text-align:center;padding:24px;color:var(--muted);font-size:11px;line-height:1.5}.sealed-photo-empty .big{font-size:34px;display:block;margin-bottom:5px}
      .sealed-status{margin-top:10px;border-radius:13px;border:1px solid var(--line);padding:10px 11px;font-size:11px;line-height:1.5;color:var(--muted);background:rgba(0,0,0,.08)}.sealed-status.ok{border-color:rgba(86,197,138,.35);color:#aee9c8}.sealed-status.warn{border-color:rgba(230,189,99,.38);color:#f4d58a}
      .sealed-vision-result{margin-top:12px;border:1px solid rgba(230,189,99,.38);border-radius:16px;padding:12px;background:rgba(230,189,99,.07)}.sealed-vision-result[hidden]{display:none}.sealed-vision-guess{font-size:17px;font-weight:950;line-height:1.35;margin-top:4px}.sealed-vision-meta{font-size:10px;color:var(--muted);line-height:1.5;margin-top:6px}.sealed-ai-badge{display:inline-flex;margin-top:8px;border-radius:999px;padding:5px 8px;background:rgba(117,174,233,.13);color:#b7d8f5;border:1px solid rgba(117,174,233,.28);font-size:9px;font-weight:950;letter-spacing:.04em}
      .sealed-form{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.sealed-field{min-width:0}.sealed-field.full{grid-column:1/-1}.sealed-field label{display:block;font-size:10px;font-weight:900;color:var(--muted);margin-bottom:5px}.sealed-field input,.sealed-field select{width:100%;min-height:46px;border-radius:12px;border:1px solid #3a5d52;background:#f9f4e8;color:var(--ink);padding:9px 11px;font-size:16px}
      .sealed-confirmed{margin-top:12px;border:1px solid rgba(86,197,138,.38);border-radius:16px;padding:12px;background:rgba(86,197,138,.07)}.sealed-confirmed[hidden]{display:none}.sealed-confirmed-label{font-size:16px;font-weight:950;line-height:1.35}.sealed-confirmed-meta{font-size:10px;color:var(--muted);line-height:1.5;margin-top:5px}.sealed-zero{display:inline-flex;margin-top:8px;border-radius:999px;padding:5px 8px;background:rgba(86,197,138,.13);color:#aee9c8;border:1px solid rgba(86,197,138,.28);font-size:9px;font-weight:950;letter-spacing:.04em}
      .sealed-barcode-box{margin-top:10px;border:1px solid rgba(117,174,233,.28);border-radius:14px;padding:11px;background:rgba(117,174,233,.07)}.sealed-barcode-box[hidden]{display:none}.sealed-barcode-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}.sealed-barcode-preview{margin-top:10px;border:1px dashed rgba(117,174,233,.35);border-radius:12px;padding:8px;background:rgba(0,0,0,.12)}.sealed-barcode-preview[hidden]{display:none}.sealed-barcode-preview img{display:block;width:100%;max-height:240px;object-fit:contain;background:#111;border-radius:8px}.sealed-barcode-result{margin-top:9px;font-size:11px;line-height:1.5;color:var(--muted)}.sealed-barcode-result strong{color:var(--ink)}
      .sealed-market-result{margin-top:12px;border:1px solid rgba(230,189,99,.38);border-radius:16px;padding:12px;background:rgba(230,189,99,.07)}.sealed-market-result[hidden]{display:none}.sealed-market-verdict{font-size:24px;font-weight:950;line-height:1.1}.sealed-market-meta{font-size:11px;color:var(--muted);line-height:1.5;margin-top:7px}.sealed-market-list{display:grid;gap:7px;margin-top:10px}.sealed-market-item{border-top:1px solid var(--line);padding-top:7px;font-size:11px;line-height:1.4}.sealed-market-item a{color:var(--gold);text-decoration:none}.sealed-market-price{font-weight:950;color:var(--text)}
      .sealed-rip-result{margin-top:12px;border:1px solid rgba(86,197,138,.38);border-radius:16px;padding:12px;background:linear-gradient(145deg,rgba(86,197,138,.09),rgba(230,189,99,.05))}.sealed-rip-result[hidden]{display:none}.sealed-final-verdict{font-size:28px;font-weight:950;line-height:1.05;margin-top:3px}.sealed-score-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:10px}.sealed-score{border:1px solid var(--line);border-radius:12px;padding:8px;background:rgba(0,0,0,.08)}.sealed-score-label{font-size:8px;color:var(--muted);font-weight:950;letter-spacing:.08em}.sealed-score-value{font-size:17px;font-weight:950;margin-top:3px}.sealed-rip-section{margin-top:12px;padding-top:10px;border-top:1px solid var(--line)}.sealed-rip-section-title{font-size:10px;font-weight:950;letter-spacing:.1em;color:var(--gold)}.sealed-rip-copy{font-size:11px;line-height:1.55;color:var(--muted);margin-top:5px}.sealed-rip-list{display:grid;gap:6px;margin-top:7px}.sealed-rip-item{font-size:11px;line-height:1.45}.sealed-rip-item strong{color:var(--text)}.sealed-rip-sources a{color:var(--gold);text-decoration:none}.sealed-rip-note{font-size:9px;color:var(--muted);line-height:1.45;margin-top:10px}.sealed-next{opacity:1}.sealed-next strong{color:var(--gold)}
      @media(max-width:620px){.sealed-actions,.sealed-actions.three,.sealed-form{grid-template-columns:1fr}.sealed-field.full{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function screenHtml(){
    return `<section class="screen" id="sealedProductScreen">
      <button class="back" id="sealedProductBack">← Back home</button>
      <div class="sealed-wrap">
        <div class="sealed-hero">
          <div class="section-eyebrow">📦 SEALED PRODUCT SCOUT</div>
          <div class="sealed-title">Too many sealed choices. One simple decision.</div>
          <div class="sealed-sub">Scan a pack, hanger, tin, bundle, box, or other sealed product. Scout can read the photo and propose the exact product for you to confirm before any pricing research happens. Photo identification uses <strong>0 marketplace searches</strong>.</div>
          <div class="sealed-category-row"><span class="sealed-category">⚡ Pokémon</span><span class="sealed-category">🧙 Magic: The Gathering</span><span class="sealed-category">⚾ Baseball</span><span class="sealed-category">🏀 Basketball</span><span class="sealed-category">🏈 Football</span></div>
        </div>

        <div class="sealed-card">
          <div class="section-eyebrow">STEP 1 · SHOW SCOUT THE PRODUCT</div>
          <div class="sealed-card-title">Start with a clear photo of the front.</div>
          <div class="sealed-card-sub">Take or choose a photo, then tap Identify Product. Scout sends a compressed copy to Cloudflare Workers AI for identification only when you ask. Manual entry remains available if the packaging is unclear.</div>
          <div class="sealed-actions three">
            <button type="button" class="primary" id="sealedTakePhotoBtn">📷 TAKE PHOTO</button>
            <button type="button" class="secondary" id="sealedChoosePhotoBtn">🖼️ CHOOSE PHOTO</button>
            <button type="button" class="ghost" id="sealedManualBtn">⌨️ ENTER PRODUCT</button>
          </div>
          <input type="file" id="sealedCameraInput" accept="image/*" capture="environment" hidden>
          <input type="file" id="sealedPhotoInput" accept="image/*" hidden>
          <input type="file" id="sealedBarcodeCameraInput" accept="image/*" capture="environment" hidden>
          <input type="file" id="sealedTypeCameraInput" accept="image/*" capture="environment" hidden>
          <div class="sealed-actions">
            <button type="button" class="secondary" id="sealedBarcodePhotoBtn">▥ SCAN BARCODE</button>
            <button type="button" class="ghost" id="sealedBarcodeManualBtn">123 ENTER UPC / EAN</button>
          </div>
          <div class="sealed-barcode-box" id="sealedBarcodeBox" hidden>
            <div class="sealed-barcode-row">
              <div class="sealed-field"><label for="sealedBarcodeText">UPC / EAN / GTIN</label><input id="sealedBarcodeText" inputmode="numeric" autocomplete="off" placeholder="Type the digits under the barcode"></div>
              <button type="button" class="secondary" id="sealedBarcodeLookupBtn">LOOK UP</button>
            </div>
            <div class="sealed-barcode-preview" id="sealedBarcodePreview" hidden></div>
            <div class="sealed-actions one"><button type="button" class="primary" id="sealedBarcodeReadBtn" disabled>▥ READ BARCODE PHOTO</button></div>
            <div class="sealed-barcode-result" id="sealedBarcodeResult">Take a close photo of the barcode or type the digits printed below it. Barcode lookup uses 0 marketplace searches.</div>
            <div class="sealed-actions one" id="sealedTypePhotoRow" hidden><button type="button" class="secondary" id="sealedTypePhotoBtn">📷 TAKE FRONT PHOTO FOR PRODUCT TYPE</button></div>
            <div class="sealed-barcode-result" id="sealedTypeResult" hidden></div>
          </div>
          <div class="sealed-photo-stage" id="sealedPhotoStage"><div class="sealed-photo-empty"><span class="big">📦</span>No sealed-product photo yet.<br>Try to fill the frame with the front panel.</div></div>
          <div class="sealed-status" id="sealedPhotoStatus">No marketplace searches used. Scout is waiting for a photo or manual product details.</div>
          <div class="sealed-actions one"><button type="button" class="secondary" id="sealedAnalyzeBtn" disabled>🔍 IDENTIFY PRODUCT FROM PHOTO · 0 MARKETPLACE SEARCHES</button></div>
        </div>

        <div class="sealed-card" id="sealedIdentityCard">
          <div class="section-eyebrow">STEP 2 · CONFIRM THE PRODUCT</div>
          <div class="sealed-card-title">What exactly is on the shelf?</div>
          <div class="sealed-card-sub">Confirming identity is free. Scout will not research prices, checklists, chase cards, or collector feedback until the product is confirmed.</div>
          <div class="sealed-vision-result" id="sealedVisionResult" hidden>
            <div class="section-eyebrow">🔍 SCOUT'S PHOTO MATCH</div>
            <div class="sealed-vision-guess" id="sealedVisionGuess"></div>
            <div class="sealed-vision-meta" id="sealedVisionMeta"></div>
            <span class="sealed-ai-badge">CLOUDFLARE AI · 0 MARKETPLACE SEARCHES</span>
            <div class="sealed-actions three">
              <button type="button" class="secondary" id="sealedVisionAcceptBtn">✓ YES, THAT'S IT</button>
              <button type="button" class="ghost" id="sealedVisionEditBtn">✏️ NEEDS CORRECTION</button>
              <button type="button" class="ghost" id="sealedVisionRetakeBtn">📷 ANOTHER PHOTO</button>
            </div>
          </div>
          <div class="sealed-form">
            <div class="sealed-field"><label for="sealedCategory">CATEGORY</label><select id="sealedCategory"><option value="">Choose one…</option><option>Pokémon</option><option>Magic: The Gathering</option><option>Baseball</option><option>Basketball</option><option>Football</option><option>Other</option></select></div>
            <div class="sealed-field"><label for="sealedYear">YEAR / SEASON</label><input id="sealedYear" placeholder="2025-26, 2026, etc."></div>
            <div class="sealed-field full"><label for="sealedSet">BRAND / SET</label><input id="sealedSet" placeholder="NBA Hoops, Topps Chrome, Prismatic Evolutions…"></div>
            <div class="sealed-field"><label for="sealedBoxType">PRODUCT TYPE</label><select id="sealedBoxType"><option value="">Choose one…</option><option>Blaster Box</option><option>Mega Box</option><option>Hobby Box</option><option>Retail Box</option><option>Hanger Box</option><option>Hanger Pack</option><option>Value / Fat Pack</option><option>Single Pack</option><option>Multi-Pack</option><option>Elite Trainer Box</option><option>Booster Box</option><option>Booster Bundle</option><option>Booster Pack</option><option>Collection Box</option><option>Tin</option><option>Other</option></select></div>
            <div class="sealed-field"><label for="sealedVariant">VARIANT / EXTRA WORDING</label><input id="sealedVariant" placeholder="Exclusive color, player on box, SKU clue…"></div>
          </div>
          <div class="sealed-actions">
            <button type="button" class="secondary" id="sealedConfirmBtn">✓ CONFIRM THIS PRODUCT · 0 SEARCHES</button>
            <button type="button" class="ghost" id="sealedResetBtn">START OVER</button>
          </div>
          <div class="sealed-status" id="sealedIdentityStatus">Nothing confirmed yet.</div>
          <div class="sealed-confirmed" id="sealedConfirmed" hidden>
            <div class="section-eyebrow">✓ PRODUCT CONFIRMED</div>
            <div class="sealed-confirmed-label" id="sealedConfirmedLabel"></div>
            <div class="sealed-confirmed-meta" id="sealedConfirmedMeta">Scout will use this exact identity for the later value research.</div>
            <span class="sealed-zero">0 MARKETPLACE SEARCHES USED</span>
          </div>
        </div>

        <div class="sealed-card sealed-next" id="sealedPriceCard">
          <div class="section-eyebrow">STEP 3 · SHELF PRICE</div>
          <div class="sealed-card-title">What is the store asking?</div>
          <div class="sealed-card-sub">Enter the shelf price, then Scout can compare it with current matching eBay listings. Tapping Check Market Value saves the price automatically. A fresh market check uses <strong>at most 1 marketplace search</strong>; a recent cached check uses 0. This first value gate is price-only — checklist/chase quality comes next.</div>
          <div class="sealed-form">
            <div class="sealed-field"><label for="sealedShelfPrice">SHELF PRICE</label><input id="sealedShelfPrice" inputmode="decimal" placeholder="29.99"></div>
            <div class="sealed-field"><label for="sealedStore">STORE (OPTIONAL)</label><input id="sealedStore" placeholder="Walmart, Target, Best Buy…"></div>
          </div>
          <div class="sealed-actions">
            <button type="button" class="secondary" id="sealedSavePriceBtn">SAVE SHELF PRICE · 0 SEARCHES</button>
            <button type="button" class="primary" id="sealedResearchPreviewBtn">💰 CHECK MARKET VALUE · 1 SEARCH MAX</button>
          </div>
          <div class="sealed-status" id="sealedPriceStatus">Confirm the product first, then save the shelf price.</div>
          <div class="sealed-market-result" id="sealedMarketResult" hidden></div>
        </div>

        <div class="sealed-card sealed-next" id="sealedRipCard">
          <div class="section-eyebrow">STEP 4 · SHOULD I BUY THIS?</div>
          <div class="sealed-card-title">Good price + good product = the real decision.</div>
          <div class="sealed-card-sub">Scout combines the market price with chase/checklist quality and recurring collector experience. Exact pull odds are used when trustworthy odds exist, but they are optional—not a requirement for a recommendation. Product intelligence is reused for 14 days; the market price stays separate and can be refreshed anytime.</div>
          <div class="sealed-actions one"><button type="button" class="primary" id="sealedRipResearchBtn">🎯 GET SCOUT'S BUY CALL · 2 RESEARCH SEARCHES MAX</button></div>
          <div class="sealed-status" id="sealedRipStatus">Run the market-price check first, then Scout can combine price with what the product is actually like to open.</div>
          <div class="sealed-rip-result" id="sealedRipResult" hidden></div>
        </div>
      </div>
    </section>`;
  }

  function identityFromFields(){
    return {
      category:byId("sealedCategory")?.value.trim()||"",
      year:byId("sealedYear")?.value.trim()||"",
      set:byId("sealedSet")?.value.trim()||"",
      boxType:byId("sealedBoxType")?.value.trim()||"",
      variant:byId("sealedVariant")?.value.trim()||""
    };
  }
  function identityLabel(identity){return [identity.year,identity.set,identity.boxType,identity.variant].filter(Boolean).join(" · ");}
  function fillDraft(draft){
    const identity=draft.identity||{};
    if(byId("sealedCategory"))byId("sealedCategory").value=identity.category||"";
    if(byId("sealedYear"))byId("sealedYear").value=identity.year||"";
    if(byId("sealedSet"))byId("sealedSet").value=identity.set||"";
    if(byId("sealedBoxType"))byId("sealedBoxType").value=identity.boxType||"";
    if(byId("sealedVariant"))byId("sealedVariant").value=identity.variant||"";
    if(byId("sealedShelfPrice"))byId("sealedShelfPrice").value=draft.shelfPrice??"";
    if(byId("sealedStore"))byId("sealedStore").value=draft.store||"";
    renderConfirmed(draft);
    renderMarketResearch(draft.marketResearch);
    renderRipQuality(draft.ripQuality);
  }
  function renderConfirmed(draft=readDraft()){
    const box=byId("sealedConfirmed"),status=byId("sealedIdentityStatus"),priceStatus=byId("sealedPriceStatus");
    if(!box)return;
    const confirmed=!!draft.confirmed&&draft.identity;
    box.hidden=!confirmed;
    if(confirmed){
      byId("sealedConfirmedLabel").textContent=identityLabel(draft.identity)||"Confirmed sealed product";
      status.className="sealed-status ok";
      status.textContent="✓ Product identity confirmed. No marketplace research has been launched.";
      if(draft.shelfPrice!==undefined&&draft.shelfPrice!==""){
        priceStatus.className="sealed-status ok";
        priceStatus.textContent=`✓ Shelf price saved: ${money(draft.shelfPrice)||draft.shelfPrice}${draft.store?" at "+draft.store:""}. Still 0 searches used.`;
      }else{
        priceStatus.className="sealed-status";
        priceStatus.textContent="Product confirmed. Enter the shelf price when you are ready.";
      }
    }else{
      status.className="sealed-status";status.textContent="Nothing confirmed yet.";
      priceStatus.className="sealed-status";priceStatus.textContent="Confirm the product first, then save the shelf price.";
    }
  }

  function handlePhoto(file){
    if(!file)return;
    if(!String(file.type||"").startsWith("image/")){byId("sealedPhotoStatus").textContent="That file is not an image. Try a photo of the sealed product front.";return;}
    clearPhotoUrl();
    activePhotoFile=file;lastVisionIdentity=null;
    activePhotoUrl=URL.createObjectURL(file);
    byId("sealedPhotoStage").innerHTML=`<img src="${esc(activePhotoUrl)}" alt="Sealed product photo preview">`;
    const mb=(file.size/1024/1024).toFixed(1);
    const status=byId("sealedPhotoStatus");status.className="sealed-status ok";
    status.textContent=`✓ Photo captured (${mb} MB). Tap Identify Product and Scout will analyze a compressed copy. 0 marketplace searches used.`;
    const analyze=byId("sealedAnalyzeBtn");if(analyze){analyze.disabled=false;analyze.textContent="🔍 IDENTIFY PRODUCT FROM PHOTO · 0 MARKETPLACE SEARCHES";}
    const vr=byId("sealedVisionResult");if(vr)vr.hidden=true;
    saveDraft({hasPhoto:true,photoName:String(file.name||"sealed product photo"),confirmed:false});
  }

  function normalizeBarcode(value){
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
  async function zxingBarcodeFromFile(file){
  const api=window.ZXingBrowser;
  const Reader=api?.BrowserMultiFormatOneDReader||api?.BrowserMultiFormatReader;
  if(!file||!Reader)return "";
  try{
    const source=await fileToDataUrl(file);
    const img=await loadPhoto(source);
    const sw=img.naturalWidth||img.width,sh=img.naturalHeight||img.height;
    if(!sw||!sh)return "";
    const maxDim=2200,scale=Math.min(1,maxDim/Math.max(sw,sh));
    const base=document.createElement("canvas");
    base.width=Math.max(1,Math.round(sw*scale));base.height=Math.max(1,Math.round(sh*scale));
    base.getContext("2d",{alpha:false}).drawImage(img,0,0,base.width,base.height);
    const rotate=(canvas,quarterTurns)=>{
      const turns=((quarterTurns%4)+4)%4;
      if(!turns)return canvas;
      const out=document.createElement("canvas");
      const swap=turns%2===1;
      out.width=swap?canvas.height:canvas.width;out.height=swap?canvas.width:canvas.height;
      const ctx=out.getContext("2d",{alpha:false});
      ctx.translate(out.width/2,out.height/2);ctx.rotate(turns*Math.PI/2);
      ctx.drawImage(canvas,-canvas.width/2,-canvas.height/2);
      return out;
    };
    const reader=new Reader();
    const attempts=[base,rotate(base,1),rotate(base,3)];
    for(const canvas of attempts){
      try{
        const hit=reader.decodeFromCanvas(canvas);
        const raw=typeof hit?.getText==="function"?hit.getText():(hit?.text||hit?.rawValue||"");
        const code=normalizeBarcode(raw);
        if(code)return code;
      }catch{}
    }
  }catch{}
  return "";
}
  function applyBarcodeResult(data){
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

  async function lookupBarcode({barcode="",file=null}={}){
    const box=byId("sealedBarcodeBox"),result=byId("sealedBarcodeResult"),btn=byId("sealedBarcodeLookupBtn");
    if(box)box.hidden=false;
    const cfg=typeof pricingConfig==="function"?pricingConfig():{endpoint:"",accessKey:""};
    if(!cfg.endpoint||!cfg.accessKey){if(result)result.textContent="Scout's live connection is not configured on this device.";return;}
    let code=normalizeBarcode(barcode);
    const readBtn=byId("sealedBarcodeReadBtn");
    if(file&&!code){if(result)result.textContent="Trying the phone's barcode reader…";code=await nativeBarcodeFromFile(file);}
    if(file&&!code){if(result)result.textContent="Trying Scout's barcode decoder…";code=await zxingBarcodeFromFile(file);}
    if(btn)btn.disabled=true;if(readBtn)readBtn.disabled=true;
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
    finally{if(btn)btn.disabled=false;if(readBtn)readBtn.disabled=!activeBarcodeFile;}
  }
  async function handleBarcodePhoto(file){
    if(!file)return;
    if(!String(file.type||"").startsWith("image/")){byId("sealedBarcodeBox").hidden=false;byId("sealedBarcodeResult").textContent="That file is not an image.";return;}
    clearBarcodePhotoUrl();
    activeBarcodeFile=file;
    activeBarcodePhotoUrl=URL.createObjectURL(file);
    const box=byId("sealedBarcodeBox"),preview=byId("sealedBarcodePreview"),result=byId("sealedBarcodeResult"),readBtn=byId("sealedBarcodeReadBtn");
    if(box)box.hidden=false;
    if(preview){preview.hidden=false;preview.innerHTML=`<img src="${esc(activeBarcodePhotoUrl)}" alt="Barcode photo preview">`;}
    if(result)result.innerHTML="✓ <strong>Barcode photo captured.</strong> Make sure the bars and the printed digits are sharp, then tap <strong>READ BARCODE PHOTO</strong>.";
    if(readBtn)readBtn.disabled=false;
    box?.scrollIntoView({behavior:"smooth",block:"center"});
  }

  function fileToDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||""));r.onerror=()=>reject(new Error("Scout could not read that photo."));r.readAsDataURL(file);});}
  function loadPhoto(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("Scout could not open that photo."));img.src=src;});}
  async function visionImageDataUrl(file){
    const source=await fileToDataUrl(file);
    const img=await loadPhoto(source);
    const maxDim=1200,scale=Math.min(1,maxDim/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));
    const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round((img.naturalWidth||img.width)*scale));canvas.height=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));
    canvas.getContext("2d",{alpha:false}).drawImage(img,0,0,canvas.width,canvas.height);
    let out=canvas.toDataURL("image/jpeg",.78);
    if(out.length>1900000)out=canvas.toDataURL("image/jpeg",.62);
    return out;
  }
  function visionGuessLabel(identity){return [identity.year,identity.set,identity.productType,identity.variant].filter(Boolean).join(" · ")||"Sealed product";}
  function applyVisionIdentity(identity){
    lastVisionIdentity=identity||null;if(!identity)return;
    if(byId("sealedCategory")&&identity.category)byId("sealedCategory").value=identity.category;
    if(byId("sealedYear"))byId("sealedYear").value=identity.year||"";
    if(byId("sealedSet"))byId("sealedSet").value=identity.set||"";
    if(byId("sealedBoxType")&&identity.productType)byId("sealedBoxType").value=identity.productType;
    if(byId("sealedVariant"))byId("sealedVariant").value=identity.variant||"";
    const result=byId("sealedVisionResult");if(result)result.hidden=false;
    byId("sealedVisionGuess").textContent=visionGuessLabel(identity);
    const bits=[];bits.push(`Confidence: ${String(identity.confidence||"low").toUpperCase()}.`);
    if(Array.isArray(identity.clues)&&identity.clues.length)bits.push(`Visible clues: ${identity.clues.join(" · ")}`);
    if(identity.needsAnotherPhoto)bits.push(identity.followUp||"Scout would like another angle before you rely on this match.");
    byId("sealedVisionMeta").textContent=bits.join(" ");
    const complete=!!identity.category&&!!identity.set&&!!identity.productType&&identity.productType!=="Other";
    byId("sealedVisionAcceptBtn").disabled=!complete;
    result?.scrollIntoView({behavior:"smooth",block:"center"});
  }
  async function analyzePhoto(){
    const status=byId("sealedPhotoStatus"),btn=byId("sealedAnalyzeBtn");
    if(!activePhotoFile){status.className="sealed-status warn";status.textContent="Take or choose a photo first.";return;}
    const cfg=typeof pricingConfig==="function"?pricingConfig():{endpoint:"",accessKey:""};
    if(!cfg.endpoint||!cfg.accessKey){status.className="sealed-status warn";status.textContent="Scout's live connection is not configured on this device.";return;}
    btn.disabled=true;btn.textContent="🔍 SCOUT IS READING THE PRODUCT…";status.className="sealed-status";status.textContent="Reading packaging text and sealed format with Cloudflare AI. 0 marketplace searches.";
    try{
      const imageDataUrl=await visionImageDataUrl(activePhotoFile);
      const res=await fetch(`${String(cfg.endpoint).replace(/\/+$/,"")}/sealed/identify`,{method:"POST",headers:{"Content-Type":"application/json","X-Scout-Key":cfg.accessKey},body:JSON.stringify({imageDataUrl})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.ok)throw new Error(data.message||"Scout could not identify that photo.");
      applyVisionIdentity(data.identity||{});
      status.className="sealed-status ok";status.textContent="✓ Photo analyzed. Review Scout's match below before confirming. 0 marketplace searches used.";
    }catch(err){status.className="sealed-status warn";status.textContent=err?.message||"Scout could not identify that photo. Try another angle or enter it manually.";}
    finally{btn.disabled=false;btn.textContent="🔍 IDENTIFY PRODUCT FROM PHOTO · 0 MARKETPLACE SEARCHES";}
  }

  function confirmIdentity(){
    const identity=identityFromFields();
    if(!identity.category){byId("sealedIdentityStatus").className="sealed-status warn";byId("sealedIdentityStatus").textContent="Choose a category first.";byId("sealedCategory")?.focus();return;}
    if(!identity.set){byId("sealedIdentityStatus").className="sealed-status warn";byId("sealedIdentityStatus").textContent="Enter the brand or set name you can read on the product.";byId("sealedSet")?.focus();return;}
    if(!identity.boxType){byId("sealedIdentityStatus").className="sealed-status warn";byId("sealedIdentityStatus").textContent="Choose the product type so Scout does not compare the wrong sealed format.";byId("sealedBoxType")?.focus();return;}
    const draft=saveDraft({identity,confirmed:true,shelfPrice:readDraft().shelfPrice??"",store:readDraft().store||"",marketResearch:null,ripQuality:null});
    renderConfirmed(draft);
    byId("sealedConfirmed")?.scrollIntoView({behavior:"smooth",block:"center"});
  }

  function saveShelfPrice(){
    const draft=readDraft();
    if(!draft.confirmed){byId("sealedPriceStatus").className="sealed-status warn";byId("sealedPriceStatus").textContent="Confirm the exact product first. Scout will not attach a price to an uncertain product.";return;}
    const raw=byId("sealedShelfPrice")?.value.trim()||"";
    const price=Number(raw.replace(/[$,]/g,""));
    if(!Number.isFinite(price)||price<=0){byId("sealedPriceStatus").className="sealed-status warn";byId("sealedPriceStatus").textContent="Enter the shelf price you see in the store.";byId("sealedShelfPrice")?.focus();return;}
    const next=saveDraft({shelfPrice:Number(price.toFixed(2)),store:byId("sealedStore")?.value.trim()||"",marketResearch:null,ripQuality:null});
    renderConfirmed(next);renderMarketResearch(null);
  }

  function renderMarketResearch(research){
    const box=byId("sealedMarketResult");if(!box)return;
    if(!research||!research.verdict){box.hidden=true;box.innerHTML="";return;}
    box.hidden=false;
    const median=money(research.median)||"—",low=money(research.low)||"—",high=money(research.high)||"—";
    const used=Number(research.marketplaceSearchesUsed||0);
    const cached=research.cacheHit?" · cached result":"";
    const listings=Array.isArray(research.listings)?research.listings:[];
    const rows=listings.map((item,i)=>{
      const safeUrl=/^https?:\/\//i.test(String(item.link||""))?String(item.link):"";
      const title=esc(item.title||`Market listing ${i+1}`);
      const label=safeUrl?`<a href="${esc(safeUrl)}" target="_blank" rel="noopener">${title}</a>`:title;
      return `<div class="sealed-market-item"><span class="sealed-market-price">${money(item.price)||"—"}</span> · ${label}</div>`;
    }).join("");
    const competitiveCount=Number(research.sampleCount||0),totalCleanCount=Number(research.totalCleanCount||competitiveCount);
    box.innerHTML=`<div class="section-eyebrow">SCOUT'S PRICE CHECK</div><div class="sealed-market-verdict">${esc(research.verdict)}</div><div class="sealed-market-meta">${esc(research.reason||"")}<br>Shelf: <strong>${money(research.shelfPrice)||"—"}</strong> · Competitive-listing median: <strong>${median}</strong> · Competitive range: ${low}–${high} · ${competitiveCount} competitive match${competitiveCount===1?"":"es"}${totalCleanCount>competitiveCount?` from ${totalCleanCount} clean listings`:""}.<br>${used} marketplace search${used===1?"":"es"} used${cached}. Current eBay asking prices, before shipping; not sold comps. Scout weights the lowest 10 clean single-unit matches so stale high asks do not inflate the verdict.</div>${rows?`<div class="sealed-market-list">${rows}</div>`:""}`;
  }

  function renderRipQuality(result){
    const box=byId("sealedRipResult");if(!box)return;
    if(!result||!result.analysis){box.hidden=true;box.innerHTML="";return;}
    const a=result.analysis||{},sources=Array.isArray(result.sources)?result.sources:[];
    const score=v=>v===null||v===undefined||v===""?"N/A":(Number.isFinite(Number(v))?String(Math.round(Number(v))):"N/A");
    const chase=(Array.isArray(a.chaseCards)?a.chaseCards:[]).map(row=>`<div class="sealed-rip-item"><strong>${esc(row.name||"")}</strong>${row.why?` — ${esc(row.why)}`:""}</div>`).join("");
    const odds=(Array.isArray(a.pullOdds)?a.pullOdds:[]).map(row=>`<div class="sealed-rip-item"><strong>${esc(row.item||"")}</strong> · ${esc(row.odds||"")}${row.sourceType?` · ${esc(row.sourceType)}`:""}${row.note?`<br>${esc(row.note)}`:""}</div>`).join("");
    const positives=(Array.isArray(a.positives)?a.positives:[]).map(x=>`<div class="sealed-rip-item">✓ ${esc(x)}</div>`).join("");
    const negatives=(Array.isArray(a.negatives)?a.negatives:[]).map(x=>`<div class="sealed-rip-item">⚠ ${esc(x)}</div>`).join("");
    const sourceRows=sources.slice(0,8).map(row=>{const link=/^https?:\/\//i.test(String(row.link||""))?String(row.link):"";return link?`<div class="sealed-rip-item"><a href="${esc(link)}" target="_blank" rel="noopener">${esc(row.title||"Research source")}</a> · ${esc(row.sourceType||"source")}</div>`:"";}).join("");
    const searches=Number(result.researchSearchesUsed||0),cached=result.cacheHit?" · product intelligence cache":"";
    const confidence=String(a.recommendationConfidence||a.confidence||"low").toUpperCase();
    const pullBlock=a.pullEvidenceAvailable&&odds?odds:`<div class="sealed-rip-copy">Exact-format pull odds were not reliably verified. Scout treats odds as optional, leaves this score N/A, and does not make them up.</div>`;
    const chaseFallback=a.chaseEvidenceAvailable?`<div class="sealed-rip-copy">Scout found enough trustworthy checklist/chase structure to score this product, but could not verify a clean named Top Chases list yet.</div>`:`<div class="sealed-rip-copy">Scout did not find enough trustworthy chase/checklist evidence to score this part yet.</div>`;
    const sentiment=a.sentimentEvidenceAvailable?(a.collectorTake?esc(a.collectorTake):"Collector evidence found."):`Scout did not find enough recurring collector reports to score sentiment confidently.`;
    box.hidden=false;
    box.innerHTML=`<div class="section-eyebrow">SCOUT'S FINAL VERDICT</div><div class="sealed-final-verdict">${esc(a.finalVerdict||"CHECK MANUALLY")}</div><div class="sealed-rip-copy">Overall score: <strong>${a.overallScore===null||a.overallScore===undefined?"N/A":`${score(a.overallScore)}/100`}</strong> · Rip Quality: <strong>${esc(a.ripGrade||"—")}</strong> · Product evidence: <strong>${Number(a.evidenceCount||0)}/3</strong> · Confidence: <strong>${esc(confidence)}</strong>${a.qualitySummary?`<br>${esc(a.qualitySummary)}`:""}</div><div class="sealed-score-grid"><div class="sealed-score"><div class="sealed-score-label">PRICE</div><div class="sealed-score-value">${score(a.priceScore)}</div></div><div class="sealed-score"><div class="sealed-score-label">CHASES</div><div class="sealed-score-value">${score(a.chaseScore)}</div></div><div class="sealed-score"><div class="sealed-score-label">PULL ODDS</div><div class="sealed-score-value">${a.pullEvidenceAvailable?score(a.pullScore):"N/A"}</div></div><div class="sealed-score"><div class="sealed-score-label">COLLECTORS</div><div class="sealed-score-value">${a.sentimentEvidenceAvailable?score(a.sentimentScore):"N/A"}</div></div></div><div class="sealed-rip-section"><div class="sealed-rip-section-title">🎯 TOP CHASES</div><div class="sealed-rip-list">${chase||chaseFallback}</div></div><div class="sealed-rip-section"><div class="sealed-rip-section-title">🎲 PULL ODDS</div><div class="sealed-rip-list">${pullBlock}</div></div><div class="sealed-rip-section"><div class="sealed-rip-section-title">💬 WHAT COLLECTORS ARE SAYING</div><div class="sealed-rip-copy">${sentiment}</div>${positives?`<div class="sealed-rip-list">${positives}</div>`:""}${negatives?`<div class="sealed-rip-list">${negatives}</div>`:""}</div>${sourceRows?`<div class="sealed-rip-section sealed-rip-sources"><div class="sealed-rip-section-title">🔗 RESEARCH SOURCES</div><div class="sealed-rip-list">${sourceRows}</div></div>`:""}<div class="sealed-rip-note">${searches} research search${searches===1?"":"es"} used${cached} · 0 marketplace searches. Product intelligence is reused for up to 14 days while price is checked separately. Exact pull odds are optional and are never invented. Opening is still chance; no recommendation guarantees value in one box.</div>`;
  }

  async function runRipQuality(){
    const draft=readDraft(),status=byId("sealedRipStatus"),btn=byId("sealedRipResearchBtn");
    if(!draft.confirmed||!draft.identity){status.className="sealed-status warn";status.textContent="Confirm the exact product first.";return;}
    if(!draft.marketResearch||!Number(draft.marketResearch.median)){status.className="sealed-status warn";status.textContent="Run CHECK MARKET VALUE first so Scout can combine price and rip quality.";byId("sealedResearchPreviewBtn")?.scrollIntoView({behavior:"smooth",block:"center"});return;}
    const cfg=typeof pricingConfig==="function"?pricingConfig():{endpoint:"",accessKey:""};
    if(!cfg.endpoint||!cfg.accessKey){status.className="sealed-status warn";status.textContent="Scout's live connection is not configured on this device.";return;}
    btn.disabled=true;btn.textContent="🎯 SCOUT IS BUILDING THE BUY CALL…";status.className="sealed-status";status.textContent="Checking chase/checklist quality and recurring collector experience. Exact pull odds are used when available, not required. Up to 2 research searches; 0 marketplace searches.";
    try{
      const market={shelfPrice:Number(draft.marketResearch.shelfPrice||draft.shelfPrice),median:Number(draft.marketResearch.median),verdict:draft.marketResearch.verdict||""};
      const res=await fetch(`${String(cfg.endpoint).replace(/\/+$/,"")}/sealed/rip-quality`,{method:"POST",headers:{"Content-Type":"application/json","X-Scout-Key":cfg.accessKey},body:JSON.stringify({identity:draft.identity,lookupTitle:draft.barcodeTitle||"",market})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.ok)throw new Error(data.message||"Scout could not complete the rip-quality research.");
      const result={analysis:data.analysis||{},sources:Array.isArray(data.sources)?data.sources:[],productLabel:data.productLabel||"",checkedAt:data.checkedAt||new Date().toISOString(),cacheHit:!!data.cacheHit,researchSearchesUsed:Number(data.researchSearchesUsed||0),marketplaceSearchesUsed:Number(data.marketplaceSearchesUsed||0)};
      saveDraft({ripQuality:result});renderRipQuality(result);
      status.className="sealed-status ok";status.textContent=`✓ Rip-quality research complete. ${result.researchSearchesUsed} research search${result.researchSearchesUsed===1?"":"es"} used · 0 marketplace searches.`;
      byId("sealedRipResult")?.scrollIntoView({behavior:"smooth",block:"start"});
    }catch(err){status.className="sealed-status warn";status.textContent=err?.message||"Scout could not complete the rip-quality research right now.";}
    finally{btn.disabled=false;btn.textContent="🎯 GET SCOUT'S BUY CALL · 2 RESEARCH SEARCHES MAX";}
  }

  async function runValueResearch(){
    let draft=readDraft();
    const status=byId("sealedPriceStatus"),btn=byId("sealedResearchPreviewBtn");
    if(!draft.confirmed||!draft.identity){status.className="sealed-status warn";status.textContent="Confirm the exact product first.";return;}

    // The market button should use what is currently visible in the shelf-price field.
    // Do not make the user tap SAVE SHELF PRICE first.
    const rawField=byId("sealedShelfPrice")?.value.trim()||"";
    const fieldPrice=Number(rawField.replace(/[$,]/g,""));
    let shelfPrice=Number(draft.shelfPrice);
    if(rawField){
      if(!Number.isFinite(fieldPrice)||fieldPrice<=0){
        status.className="sealed-status warn";
        status.textContent="Enter a valid shelf price before checking the market.";
        byId("sealedShelfPrice")?.focus();
        return;
      }
      shelfPrice=Number(fieldPrice.toFixed(2));
      draft=saveDraft({shelfPrice,store:byId("sealedStore")?.value.trim()||draft.store||"",marketResearch:null,ripQuality:null});
    }
    if(!Number.isFinite(shelfPrice)||shelfPrice<=0){status.className="sealed-status warn";status.textContent="Enter the shelf price before checking the market.";byId("sealedShelfPrice")?.focus();return;}
    const cfg=typeof pricingConfig==="function"?pricingConfig():{endpoint:"",accessKey:""};
    if(!cfg.endpoint||!cfg.accessKey){status.className="sealed-status warn";status.textContent="Scout's live connection is not configured on this device.";return;}
    btn.disabled=true;btn.textContent="💰 SCOUT IS CHECKING THE MARKET…";status.className="sealed-status";status.textContent="Checking current matching eBay listings. This uses at most 1 marketplace search; cached results use 0.";
    try{
      const res=await fetch(`${String(cfg.endpoint).replace(/\/+$/,"")}/sealed/value-check`,{method:"POST",headers:{"Content-Type":"application/json","X-Scout-Key":cfg.accessKey},body:JSON.stringify({identity:draft.identity,shelfPrice,lookupTitle:draft.barcodeTitle||""})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.ok)throw new Error(data.message||"Scout could not complete the sealed-product market check.");
      const research={verdict:data.verdict||"CHECK MANUALLY",reason:data.reason||"",shelfPrice:Number(data.shelfPrice||shelfPrice),median:data.median,low:data.low,high:data.high,sampleCount:Number(data.sampleCount||0),totalCleanCount:Number(data.totalCleanCount||data.sampleCount||0),listings:Array.isArray(data.listings)?data.listings:[],query:data.query||"",cacheHit:!!data.cacheHit,marketplaceSearchesUsed:Number(data.marketplaceSearchesUsed||0),checkedAt:data.checkedAt||new Date().toISOString()};
      saveDraft({marketResearch:research,ripQuality:null});renderMarketResearch(research);renderRipQuality(null);
      status.className="sealed-status ok";status.textContent=`✓ Market check complete. ${research.marketplaceSearchesUsed} marketplace search${research.marketplaceSearchesUsed===1?"":"es"} used.`;
      byId("sealedMarketResult")?.scrollIntoView({behavior:"smooth",block:"center"});
    }catch(err){status.className="sealed-status warn";status.textContent=err?.message||"Scout could not complete the market check right now.";}
    finally{btn.disabled=false;btn.textContent="💰 CHECK MARKET VALUE · 1 SEARCH MAX";}
  }

  function startOver(){
    clearPhotoUrl();clearBarcodePhotoUrl();activePhotoFile=null;activeBarcodeFile=null;lastVisionIdentity=null;lastBarcodeIdentity=null;lastBarcodeData=null;
    localStorage.removeItem(DRAFT_KEY);
    ["sealedCategory","sealedYear","sealedSet","sealedBoxType","sealedVariant","sealedShelfPrice","sealedStore","sealedBarcodeText"].forEach(id=>{const el=byId(id);if(el)el.value="";});
    byId("sealedCameraInput").value="";byId("sealedPhotoInput").value="";byId("sealedBarcodeCameraInput").value="";byId("sealedTypeCameraInput").value="";
    byId("sealedBarcodeBox").hidden=true;byId("sealedBarcodePreview").hidden=true;byId("sealedBarcodePreview").innerHTML="";byId("sealedBarcodeReadBtn").disabled=true;byId("sealedBarcodeResult").textContent="Take a close photo of the barcode or type the digits printed below it. Barcode lookup uses 0 marketplace searches.";byId("sealedTypePhotoRow").hidden=true;byId("sealedTypeResult").hidden=true;byId("sealedTypeResult").textContent="";
    byId("sealedPhotoStage").innerHTML='<div class="sealed-photo-empty"><span class="big">📦</span>No sealed-product photo yet.<br>Try to fill the frame with the front panel.</div>';
    const ps=byId("sealedPhotoStatus");ps.className="sealed-status";ps.textContent="No marketplace searches used. Scout is waiting for a photo or manual product details.";
    const analyze=byId("sealedAnalyzeBtn");if(analyze){analyze.disabled=true;analyze.textContent="🔍 IDENTIFY PRODUCT FROM PHOTO · 0 MARKETPLACE SEARCHES";}
    const vr=byId("sealedVisionResult");if(vr)vr.hidden=true;
    renderConfirmed({});renderMarketResearch(null);renderRipQuality(null);
    byId("sealedPhotoStage")?.scrollIntoView({behavior:"smooth",block:"center"});
  }

  function mount(){
    if(byId("sealedProductScreen"))return;
    const main=document.querySelector("main"),grid=document.querySelector("#homeScreen .quick-grid");
    if(!main||!grid){setTimeout(mount,75);return;}
    addStyles();
    const btn=document.createElement("button");btn.type="button";btn.className="primary sealed-home-btn";btn.id="sealedProductScoutBtn";btn.innerHTML="📦 SCAN SEALED PRODUCT";
    grid.insertBefore(btn,grid.firstChild);
    main.insertAdjacentHTML("beforeend",screenHtml());

    btn.addEventListener("click",()=>{fillDraft(readDraft());if(typeof showScreen==="function")showScreen("sealedProductScreen");});
    byId("sealedProductBack").addEventListener("click",()=>{if(typeof showScreen==="function")showScreen("homeScreen");});
    byId("sealedTakePhotoBtn").addEventListener("click",()=>byId("sealedCameraInput").click());
    byId("sealedChoosePhotoBtn").addEventListener("click",()=>byId("sealedPhotoInput").click());
    byId("sealedManualBtn").addEventListener("click",()=>{byId("sealedIdentityCard")?.scrollIntoView({behavior:"smooth",block:"start"});setTimeout(()=>byId("sealedCategory")?.focus(),250);});
    byId("sealedCameraInput").addEventListener("change",e=>handlePhoto(e.target.files?.[0]));
    byId("sealedPhotoInput").addEventListener("change",e=>handlePhoto(e.target.files?.[0]));
    byId("sealedBarcodePhotoBtn").addEventListener("click",()=>byId("sealedBarcodeCameraInput").click());
    byId("sealedBarcodeManualBtn").addEventListener("click",()=>{byId("sealedBarcodeBox").hidden=false;setTimeout(()=>byId("sealedBarcodeText")?.focus(),100);});
    byId("sealedBarcodeCameraInput").addEventListener("change",e=>handleBarcodePhoto(e.target.files?.[0]));
    byId("sealedTypePhotoBtn").addEventListener("click",()=>byId("sealedTypeCameraInput").click());
    byId("sealedTypeCameraInput").addEventListener("change",e=>handleTypePhoto(e.target.files?.[0]));
    byId("sealedBarcodeReadBtn").addEventListener("click",()=>{if(!activeBarcodeFile){byId("sealedBarcodeResult").textContent="Take a barcode photo first.";return;}lookupBarcode({file:activeBarcodeFile});});
    byId("sealedBarcodeLookupBtn").addEventListener("click",()=>lookupBarcode({barcode:byId("sealedBarcodeText")?.value||""}));
    byId("sealedBarcodeText").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();lookupBarcode({barcode:e.currentTarget.value});}});
    byId("sealedAnalyzeBtn").addEventListener("click",analyzePhoto);
    byId("sealedVisionAcceptBtn").addEventListener("click",()=>confirmIdentity());
    byId("sealedVisionEditBtn").addEventListener("click",()=>{byId("sealedIdentityCard")?.scrollIntoView({behavior:"smooth",block:"start"});setTimeout(()=>byId("sealedCategory")?.focus(),250);});
    byId("sealedVisionRetakeBtn").addEventListener("click",()=>byId("sealedCameraInput").click());
    byId("sealedConfirmBtn").addEventListener("click",confirmIdentity);
    byId("sealedResetBtn").addEventListener("click",startOver);
    byId("sealedSavePriceBtn").addEventListener("click",saveShelfPrice);
    byId("sealedResearchPreviewBtn").addEventListener("click",runValueResearch);
    byId("sealedRipResearchBtn").addEventListener("click",runRipQuality);
    fillDraft(readDraft());
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount);else mount();
})();
