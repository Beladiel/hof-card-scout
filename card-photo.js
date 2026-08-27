(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.ScoutCardPhotos=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const DB_NAME="hof-card-scout-photo-cache";
  const DB_VERSION=1;
  const STORE_NAME="photos";
  const MAX_DIMENSION=1600;
  const TARGET_BYTES=900*1024;
  let getConfig=()=>({endpoint:"",accessKey:""});
  let notify=()=>{};
  let activePlayer=null;
  let activeFingerprint="";
  let loadToken=0;
  let activeObjectUrl="";
  let initialized=false;

  const $=id=>typeof document!=="undefined"?document.getElementById(id):null;

  function normalizeFingerprintPart(value){
    return String(value??"").trim().toLowerCase().replace(/\s+/g," ");
  }
  function fingerprintForPlayer(player){
    if(!player||!player.owned)return "";
    const source=[
      player.name,player.cardYear,player.set,player.cardNum,
      player.grader,player.gradeCondition,player.serial,
      player.autograph?"auto":"",player.relic?"relic":""
    ].map(normalizeFingerprintPart).join("|");
    let hash=0x811c9dc5;
    for(let i=0;i<source.length;i++){
      hash^=source.charCodeAt(i);
      hash=Math.imul(hash,0x01000193)>>>0;
    }
    return ("00000000"+hash.toString(16)).slice(-8);
  }
  function endpointUrl(playerName){
    const cfg=getConfig()||{};
    const endpoint=String(cfg.endpoint||"").trim().replace(/\/$/,"");
    return endpoint?endpoint+"/card-photo?player="+encodeURIComponent(playerName):"";
  }
  function accessKey(){return String((getConfig()||{}).accessKey||"");}

  function openDb(){
    return new Promise((resolve,reject)=>{
      if(typeof indexedDB==="undefined"){resolve(null);return;}
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains(STORE_NAME))db.createObjectStore(STORE_NAME,{keyPath:"player"});
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error("Photo cache unavailable"));
    });
  }
  async function cacheGet(player){
    try{
      const db=await openDb();if(!db)return null;
      const result=await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE_NAME,"readonly"),req=tx.objectStore(STORE_NAME).get(player);
        req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);
      });
      db.close();return result;
    }catch{return null;}
  }
  async function cachePut(record){
    try{
      const db=await openDb();if(!db)return false;
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE_NAME,"readwrite");tx.objectStore(STORE_NAME).put(record);
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      });
      db.close();return true;
    }catch{return false;}
  }
  async function cacheDelete(player){
    try{
      const db=await openDb();if(!db)return false;
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE_NAME,"readwrite");tx.objectStore(STORE_NAME).delete(player);
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      });
      db.close();return true;
    }catch{return false;}
  }

  function setStatus(text,kind=""){
    const el=$("cardPhotoStatus");if(!el)return;
    el.textContent=text||"";el.className="card-photo-status"+(kind?" "+kind:"");
  }
  function setBusy(busy){
    ["cardPhotoTakeBtn","cardPhotoChooseBtn","cardPhotoRemoveBtn"].forEach(id=>{const el=$(id);if(el)el.disabled=!!busy;});
  }
  function revokeActiveUrl(){
    if(activeObjectUrl&&typeof URL!=="undefined")URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl="";
  }
  function setPhotoBlob(blob,meta={}){
    const img=$("cardPhotoImage"),frame=$("cardPhotoFrame"),empty=$("cardPhotoEmpty"),remove=$("cardPhotoRemoveBtn");
    if(!img||!frame)return;
    revokeActiveUrl();
    activeObjectUrl=URL.createObjectURL(blob);
    img.src=activeObjectUrl;img.alt=(activePlayer?.name||"Hall of Famer")+" representative card photo";
    frame.hidden=false;if(empty)empty.hidden=true;if(remove)remove.hidden=false;
    const take=$("cardPhotoTakeBtn"),choose=$("cardPhotoChooseBtn");
    if(take)take.textContent="📷 RETAKE";if(choose)choose.textContent="🖼️ REPLACE";
    const savedFingerprint=String(meta.fingerprint||"");
    if(savedFingerprint&&activeFingerprint&&savedFingerprint!==activeFingerprint){
      setStatus("⚠ This photo may show your previous representative card. Replace it when you're ready.","warn");
    }else if(meta.offline){
      setStatus("Showing the copy saved on this device. Scout Cloud is temporarily unavailable.","warn");
    }else{
      setStatus("✓ Your representative card photo is saved in Scout Cloud.","ok");
    }
  }
  function setNoPhoto(message="Add a photo of your actual representative card."){
    revokeActiveUrl();
    const img=$("cardPhotoImage"),frame=$("cardPhotoFrame"),empty=$("cardPhotoEmpty"),remove=$("cardPhotoRemoveBtn");
    if(img){img.removeAttribute("src");img.alt="";}if(frame)frame.hidden=true;if(empty)empty.hidden=false;if(remove)remove.hidden=true;
    const take=$("cardPhotoTakeBtn"),choose=$("cardPhotoChooseBtn");
    if(take)take.textContent="📷 TAKE PHOTO";if(choose)choose.textContent="🖼️ CHOOSE PHOTO";
    setStatus(message);
  }

  function loadImageElement(file){
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(file),img=new Image();
      img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};
      img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Scout could not read that image."));};
      img.src=url;
    });
  }
  function canvasBlob(canvas,quality){
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Scout could not prepare that photo.")),"image/jpeg",quality));
  }
  async function compressImage(file){
    if(!file||!String(file.type||"").startsWith("image/"))throw new Error("Choose a photo or image file.");
    const source=await loadImageElement(file);
    const naturalW=source.naturalWidth||source.width,naturalH=source.naturalHeight||source.height;
    if(!naturalW||!naturalH)throw new Error("Scout could not read the image dimensions.");
    let scale=Math.min(1,MAX_DIMENSION/Math.max(naturalW,naturalH));
    let width=Math.max(1,Math.round(naturalW*scale)),height=Math.max(1,Math.round(naturalH*scale));
    const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d",{alpha:false});
    if(!ctx)throw new Error("Photo resizing is not available in this browser.");
    function draw(w,h){canvas.width=w;canvas.height=h;ctx.fillStyle="#ffffff";ctx.fillRect(0,0,w,h);ctx.drawImage(source,0,0,w,h);}
    draw(width,height);
    let blob=await canvasBlob(canvas,.84);
    if(blob.size>TARGET_BYTES)blob=await canvasBlob(canvas,.68);
    if(blob.size>TARGET_BYTES){
      const shrink=Math.max(.55,Math.min(.92,Math.sqrt(TARGET_BYTES/blob.size)*.94));
      width=Math.max(1,Math.round(width*shrink));height=Math.max(1,Math.round(height*shrink));draw(width,height);
      blob=await canvasBlob(canvas,.72);
    }
    if(blob.size>1200*1024)throw new Error("That photo is still too large after resizing. Try a closer crop or a different photo.");
    return blob;
  }

  async function fetchCloudPhoto(player,token){
    const url=endpointUrl(player.name),key=accessKey();
    if(!url||!key)return {configured:false};
    const res=await fetch(url,{headers:{"X-Scout-Key":key},cache:"no-store"});
    if(token!==loadToken)return {cancelled:true};
    if(res.status===404)return {found:false};
    if(!res.ok){
      let data={};try{data=await res.json();}catch{}
      throw new Error(data.message||("Photo service returned HTTP "+res.status));
    }
    const blob=await res.blob();
    const meta={
      fingerprint:res.headers.get("X-Scout-Photo-Fingerprint")||"",
      updatedAt:res.headers.get("X-Scout-Photo-Updated-At")||"",
      contentType:blob.type||res.headers.get("Content-Type")||"image/jpeg"
    };
    await cachePut({player:player.name,blob,fingerprint:meta.fingerprint,updatedAt:meta.updatedAt,contentType:meta.contentType});
    return {found:true,blob,meta};
  }

  async function showPlayer(player){
    activePlayer=player||null;activeFingerprint=fingerprintForPlayer(player);const token=++loadToken;
    const panel=$("cardPhotoPanel");if(!panel)return;
    panel.hidden=!player?.owned;
    if(!player?.owned){revokeActiveUrl();return;}
    setBusy(true);setNoPhoto("Checking Scout Cloud for your representative card photo…");
    const cached=await cacheGet(player.name);
    if(token!==loadToken)return;
    if(cached?.blob)setPhotoBlob(cached.blob,{fingerprint:cached.fingerprint,updatedAt:cached.updatedAt,offline:true});
    try{
      const remote=await fetchCloudPhoto(player,token);
      if(token!==loadToken||remote.cancelled)return;
      if(remote.configured===false){
        if(!cached?.blob)setNoPhoto("Add a Scout connection on this device before saving card photos to the cloud.");
        else setStatus("Showing the saved device copy. Scout Cloud connection is not configured here.","warn");
      }else if(remote.found===false){
        await cacheDelete(player.name);
        if(token===loadToken)setNoPhoto();
      }else if(remote.found){setPhotoBlob(remote.blob,remote.meta);}
    }catch(err){
      if(token!==loadToken)return;
      if(cached?.blob)setStatus("Showing the saved device copy. Cloud check failed: "+(err.message||"unavailable"),"warn");
      else setNoPhoto("Scout Cloud is unavailable right now. Try again when you're online.");
    }finally{if(token===loadToken)setBusy(false);}
  }

  async function uploadFile(file){
    if(!activePlayer?.owned)return;
    const playerAtStart=activePlayer,token=loadToken,url=endpointUrl(playerAtStart.name),key=accessKey();
    if(!url||!key){notify("Scout's cloud connection is not configured on this device.");return;}
    setBusy(true);setStatus("Preparing your card photo…");
    try{
      const blob=await compressImage(file);
      if(token!==loadToken||activePlayer?.name!==playerAtStart.name)return;
      setStatus("Saving photo to Scout Cloud…");
      const res=await fetch(url,{method:"POST",headers:{
        "X-Scout-Key":key,
        "X-Scout-Card-Fingerprint":activeFingerprint,
        "Content-Type":"image/jpeg"
      },body:blob});
      let data={};try{data=await res.json();}catch{}
      if(!res.ok||!data.ok)throw new Error(data.message||("Photo upload returned HTTP "+res.status));
      const meta={fingerprint:activeFingerprint,updatedAt:data.updatedAt||new Date().toISOString(),contentType:"image/jpeg"};
      await cachePut({player:playerAtStart.name,blob,...meta});
      if(token===loadToken){setPhotoBlob(blob,meta);notify("📷 Card photo saved for "+playerAtStart.name+".");}
    }catch(err){if(token===loadToken)setStatus(err.message||"Scout could not save that photo.","bad");}
    finally{if(token===loadToken)setBusy(false);}
  }

  async function removePhoto(){
    if(!activePlayer?.owned)return;
    const name=activePlayer.name;
    if(typeof confirm==="function"&&!confirm("Remove "+name+"’s representative card photo from Scout Cloud?"))return;
    const url=endpointUrl(name),key=accessKey();
    if(!url||!key){notify("Scout's cloud connection is not configured on this device.");return;}
    setBusy(true);setStatus("Removing card photo…");
    try{
      const res=await fetch(url,{method:"DELETE",headers:{"X-Scout-Key":key}});
      let data={};try{data=await res.json();}catch{}
      if(!res.ok||!data.ok)throw new Error(data.message||("Photo removal returned HTTP "+res.status));
      await cacheDelete(name);setNoPhoto();notify("Card photo removed for "+name+".");
    }catch(err){setStatus(err.message||"Scout could not remove that photo.","bad");}
    finally{setBusy(false);}
  }

  function openLightbox(){
    const src=$("cardPhotoImage")?.src;if(!src)return;
    const modal=$("cardPhotoLightbox"),img=$("cardPhotoLightboxImage");if(!modal||!img)return;
    img.src=src;img.alt=(activePlayer?.name||"Hall of Famer")+" representative card photo enlarged";modal.hidden=false;
    $("cardPhotoLightboxClose")?.focus();
  }
  function closeLightbox(){const modal=$("cardPhotoLightbox");if(modal)modal.hidden=true;}
  function wireFileInput(id){
    const input=$(id);if(!input)return;
    input.addEventListener("change",async()=>{const file=input.files&&input.files[0];input.value="";if(file)await uploadFile(file);});
  }
  function init(options={}){
    if(initialized)return;initialized=true;
    if(typeof options.getConfig==="function")getConfig=options.getConfig;
    if(typeof options.toast==="function")notify=options.toast;
    $("cardPhotoTakeBtn")?.addEventListener("click",()=>$("cardPhotoCameraInput")?.click());
    $("cardPhotoChooseBtn")?.addEventListener("click",()=>$("cardPhotoLibraryInput")?.click());
    $("cardPhotoRemoveBtn")?.addEventListener("click",removePhoto);
    $("cardPhotoImage")?.addEventListener("click",openLightbox);
    $("cardPhotoLightboxClose")?.addEventListener("click",closeLightbox);
    $("cardPhotoLightbox")?.addEventListener("click",e=>{if(e.target===$("cardPhotoLightbox"))closeLightbox();});
    document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("cardPhotoLightbox")?.hidden)closeLightbox();});
    wireFileInput("cardPhotoCameraInput");wireFileInput("cardPhotoLibraryInput");
  }

  return {init,showPlayer,fingerprintForPlayer,compressImage};
});
