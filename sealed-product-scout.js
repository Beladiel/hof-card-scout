(function(){
  const DRAFT_KEY="scoutSealedProductDraftV1";
  let activePhotoUrl="";

  function esc(value){return String(value??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));}
  function byId(id){return document.getElementById(id);}
  function readDraft(){try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||"{}");}catch{return {};}}
  function saveDraft(patch){const next={...readDraft(),...patch,updatedAt:new Date().toISOString()};localStorage.setItem(DRAFT_KEY,JSON.stringify(next));return next;}
  function clearPhotoUrl(){if(activePhotoUrl){try{URL.revokeObjectURL(activePhotoUrl);}catch{}activePhotoUrl="";}}
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
      .sealed-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}.sealed-actions.three{grid-template-columns:1fr 1fr 1fr}.sealed-actions button{min-height:48px}
      .sealed-photo-stage{margin-top:12px;border:1px dashed rgba(230,189,99,.4);border-radius:16px;min-height:155px;display:grid;place-items:center;overflow:hidden;background:rgba(0,0,0,.12);position:relative}.sealed-photo-stage img{display:block;width:100%;max-height:420px;object-fit:contain;background:#111}.sealed-photo-empty{text-align:center;padding:24px;color:var(--muted);font-size:11px;line-height:1.5}.sealed-photo-empty .big{font-size:34px;display:block;margin-bottom:5px}
      .sealed-status{margin-top:10px;border-radius:13px;border:1px solid var(--line);padding:10px 11px;font-size:11px;line-height:1.5;color:var(--muted);background:rgba(0,0,0,.08)}.sealed-status.ok{border-color:rgba(86,197,138,.35);color:#aee9c8}.sealed-status.warn{border-color:rgba(230,189,99,.38);color:#f4d58a}
      .sealed-form{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.sealed-field{min-width:0}.sealed-field.full{grid-column:1/-1}.sealed-field label{display:block;font-size:10px;font-weight:900;color:var(--muted);margin-bottom:5px}.sealed-field input,.sealed-field select{width:100%;min-height:46px;border-radius:12px;border:1px solid #3a5d52;background:#f9f4e8;color:var(--ink);padding:9px 11px;font-size:16px}
      .sealed-confirmed{margin-top:12px;border:1px solid rgba(86,197,138,.38);border-radius:16px;padding:12px;background:rgba(86,197,138,.07)}.sealed-confirmed[hidden]{display:none}.sealed-confirmed-label{font-size:16px;font-weight:950;line-height:1.35}.sealed-confirmed-meta{font-size:10px;color:var(--muted);line-height:1.5;margin-top:5px}.sealed-zero{display:inline-flex;margin-top:8px;border-radius:999px;padding:5px 8px;background:rgba(86,197,138,.13);color:#aee9c8;border:1px solid rgba(86,197,138,.28);font-size:9px;font-weight:950;letter-spacing:.04em}
      .sealed-next{opacity:.72}.sealed-next strong{color:var(--gold)}
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
          <div class="sealed-sub">Scan a pack, hanger, tin, bundle, box, or other sealed product. Scout will confirm exactly what you mean before any pricing research happens. This first gate uses <strong>0 marketplace searches</strong>.</div>
          <div class="sealed-category-row"><span class="sealed-category">⚡ Pokémon</span><span class="sealed-category">🧙 Magic: The Gathering</span><span class="sealed-category">⚾ Baseball</span><span class="sealed-category">🏀 Basketball</span><span class="sealed-category">🏈 Football</span></div>
        </div>

        <div class="sealed-card">
          <div class="section-eyebrow">STEP 1 · SHOW SCOUT THE PRODUCT</div>
          <div class="sealed-card-title">Start with a clear photo of the front.</div>
          <div class="sealed-card-sub">Photo capture is ready now. Visual auto-identification will be connected in the next gate; until then, the manual confirmation fields below let us test the full in-store flow without guessing.</div>
          <div class="sealed-actions three">
            <button type="button" class="primary" id="sealedTakePhotoBtn">📷 TAKE PHOTO</button>
            <button type="button" class="secondary" id="sealedChoosePhotoBtn">🖼️ CHOOSE PHOTO</button>
            <button type="button" class="ghost" id="sealedManualBtn">⌨️ ENTER PRODUCT</button>
          </div>
          <input type="file" id="sealedCameraInput" accept="image/*" capture="environment" hidden>
          <input type="file" id="sealedPhotoInput" accept="image/*" hidden>
          <div class="sealed-photo-stage" id="sealedPhotoStage"><div class="sealed-photo-empty"><span class="big">📦</span>No sealed-product photo yet.<br>Try to fill the frame with the front panel.</div></div>
          <div class="sealed-status" id="sealedPhotoStatus">No searches used. Scout is waiting for a photo or manual product details.</div>
        </div>

        <div class="sealed-card" id="sealedIdentityCard">
          <div class="section-eyebrow">STEP 2 · CONFIRM THE PRODUCT</div>
          <div class="sealed-card-title">What exactly is on the shelf?</div>
          <div class="sealed-card-sub">Confirming identity is free. Scout will not research prices, checklists, chase cards, or collector feedback until the product is confirmed.</div>
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
          <div class="sealed-card-sub">You can save the shelf price now. That still costs 0 searches. The next build gate will add market pricing, chase/checklist quality, collector feedback, and Scout’s <strong>GOOD BUY / FAIR / PASS</strong> verdict.</div>
          <div class="sealed-form">
            <div class="sealed-field"><label for="sealedShelfPrice">SHELF PRICE</label><input id="sealedShelfPrice" inputmode="decimal" placeholder="29.99"></div>
            <div class="sealed-field"><label for="sealedStore">STORE (OPTIONAL)</label><input id="sealedStore" placeholder="Walmart, Target, Best Buy…"></div>
          </div>
          <div class="sealed-actions">
            <button type="button" class="secondary" id="sealedSavePriceBtn">SAVE SHELF PRICE · 0 SEARCHES</button>
            <button type="button" class="ghost" id="sealedResearchPreviewBtn">NEXT: VALUE RESEARCH</button>
          </div>
          <div class="sealed-status" id="sealedPriceStatus">Confirm the product first, then save the shelf price.</div>
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
    activePhotoUrl=URL.createObjectURL(file);
    byId("sealedPhotoStage").innerHTML=`<img src="${esc(activePhotoUrl)}" alt="Sealed product photo preview">`;
    const mb=(file.size/1024/1024).toFixed(1);
    const status=byId("sealedPhotoStatus");status.className="sealed-status ok";
    status.textContent=`✓ Photo captured (${mb} MB). It stays on this device for this session. 0 marketplace searches used.`;
    saveDraft({hasPhoto:true,photoName:String(file.name||"sealed product photo")});
    byId("sealedIdentityCard")?.scrollIntoView({behavior:"smooth",block:"start"});
  }

  function confirmIdentity(){
    const identity=identityFromFields();
    if(!identity.category){byId("sealedIdentityStatus").className="sealed-status warn";byId("sealedIdentityStatus").textContent="Choose a category first.";byId("sealedCategory")?.focus();return;}
    if(!identity.set){byId("sealedIdentityStatus").className="sealed-status warn";byId("sealedIdentityStatus").textContent="Enter the brand or set name you can read on the product.";byId("sealedSet")?.focus();return;}
    if(!identity.boxType){byId("sealedIdentityStatus").className="sealed-status warn";byId("sealedIdentityStatus").textContent="Choose the product type so Scout does not compare the wrong sealed format.";byId("sealedBoxType")?.focus();return;}
    const draft=saveDraft({identity,confirmed:true,shelfPrice:readDraft().shelfPrice??"",store:readDraft().store||""});
    renderConfirmed(draft);
    byId("sealedConfirmed")?.scrollIntoView({behavior:"smooth",block:"center"});
  }

  function saveShelfPrice(){
    const draft=readDraft();
    if(!draft.confirmed){byId("sealedPriceStatus").className="sealed-status warn";byId("sealedPriceStatus").textContent="Confirm the exact product first. Scout will not attach a price to an uncertain product.";return;}
    const raw=byId("sealedShelfPrice")?.value.trim()||"";
    const price=Number(raw.replace(/[$,]/g,""));
    if(!Number.isFinite(price)||price<=0){byId("sealedPriceStatus").className="sealed-status warn";byId("sealedPriceStatus").textContent="Enter the shelf price you see in the store.";byId("sealedShelfPrice")?.focus();return;}
    const next=saveDraft({shelfPrice:Number(price.toFixed(2)),store:byId("sealedStore")?.value.trim()||""});
    renderConfirmed(next);
  }

  function startOver(){
    clearPhotoUrl();
    localStorage.removeItem(DRAFT_KEY);
    ["sealedCategory","sealedYear","sealedSet","sealedBoxType","sealedVariant","sealedShelfPrice","sealedStore"].forEach(id=>{const el=byId(id);if(el)el.value="";});
    byId("sealedCameraInput").value="";byId("sealedPhotoInput").value="";
    byId("sealedPhotoStage").innerHTML='<div class="sealed-photo-empty"><span class="big">📦</span>No sealed-product photo yet.<br>Try to fill the frame with the front panel.</div>';
    const ps=byId("sealedPhotoStatus");ps.className="sealed-status";ps.textContent="No searches used. Scout is waiting for a photo or manual product details.";
    renderConfirmed({});
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
    byId("sealedConfirmBtn").addEventListener("click",confirmIdentity);
    byId("sealedResetBtn").addEventListener("click",startOver);
    byId("sealedSavePriceBtn").addEventListener("click",saveShelfPrice);
    byId("sealedResearchPreviewBtn").addEventListener("click",()=>{
      const status=byId("sealedPriceStatus");
      const draft=readDraft();
      if(!draft.confirmed){status.className="sealed-status warn";status.textContent="Confirm the exact product first.";return;}
      if(!Number.isFinite(Number(draft.shelfPrice))||Number(draft.shelfPrice)<=0){status.className="sealed-status warn";status.textContent="Save the shelf price first.";return;}
      status.className="sealed-status ok";status.textContent="✓ Ready for the next gate. No research has been launched yet, so your search budget is untouched.";
    });
    fillDraft(readDraft());
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount);else mount();
})();
