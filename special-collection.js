/* HOF Card Scout • Special Collection v1.0
   Keeps non-HOF/sentimental cards completely separate from PLAYERS.
   Card metadata is stored in the existing Scout cloud-backed edits object;
   images are kept in IndexedDB and optionally mirrored to Scout Cloud. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ScoutSpecialCollection = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const KEY = "__scoutSpecialCollectionV1";
  const DB = "scout-special-photos-v1";
  const STORE = "photos";
  const SPORTS = ["Football", "Baseball", "Basketball", "Hockey", "Other"];
  let options = null;
  let cards = [];
  let editingId = "";
  let selectedFile = null;
  let initialized = false;
  const imageUrls = new Map();
  const loading = new Set();
  const $ = id => document.getElementById(id);
  const clean = value => String(value == null ? "" : value).trim();
  const escape = value => clean(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
  const today = () => new Date().toISOString();

  function normalizeCard(c) {
    if (!c || typeof c !== "object" || !/^[a-zA-Z0-9_-]{6,80}$/.test(clean(c.id))) return null;
    return {
      id: clean(c.id), player: clean(c.player).slice(0, 160),
      sport: SPORTS.includes(c.sport) ? c.sport : "Other",
      team: clean(c.team).slice(0, 100),
      year: clean(c.year).slice(0, 4),
      set: clean(c.set).slice(0, 120),
      number: clean(c.number).slice(0, 50),
      grade: clean(c.grade).slice(0, 100),
      serial: clean(c.serial).slice(0, 80),
      autograph: !!c.autograph, relic: !!c.relic,
      purchasePrice: clean(c.purchasePrice).slice(0, 30),
      purchaseDate: clean(c.purchaseDate).slice(0, 10),
      notes: clean(c.notes).slice(0, 1500),
      favorite: c.favorite !== false,
      hasPhoto: !!c.hasPhoto,
      createdAt: clean(c.createdAt) || today(),
      updatedAt: clean(c.updatedAt) || today()
    };
  }

  function read() {
    const payload = options.read() || {};
    const data = payload[KEY];
    const raw = Array.isArray(data && data.cards) ? data.cards : [];
    return raw.map(normalizeCard).filter(Boolean);
  }
  function persist() {
    options.save(cards.map(c => ({ ...c })));
  }
  function uid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return "sp_" + crypto.randomUUID().replace(/-/g, "");
    return "sp_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }
  function photoName(id) { return "scout-special-" + id; }
  function photoFingerprint(id) {
    // Scout Cloud's photo API uses the same eight-digit fingerprint format as HOF photos.
    let hash = 0x811c9dc5;
    for (const ch of photoName(id)) {
      hash ^= ch.charCodeAt(0);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return ("00000000" + hash.toString(16)).slice(-8);
  }
  function urlFor(id) {
    const c = options.connection() || {};
    const endpoint = clean(c.endpoint).replace(/\/$/, "");
    return endpoint && /^https:\/\//i.test(endpoint) && clean(c.accessKey)
      ? endpoint + "/card-photo?player=" + encodeURIComponent(photoName(id)) : "";
  }
  function key() { return clean((options.connection() || {}).accessKey); }
  function notice(message) {
    $("specialStatus").textContent = message;
  }
  function toast(message) { if (options.toast) options.toast(message); }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") { resolve(null); return; }
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, {keyPath:"id"});
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("Photo storage unavailable"));
    });
  }
  async function getLocalPhoto(id) {
    try {
      const db = await openDb();
      if (!db) return null;
      const row = await new Promise((resolve,reject) => {
        const tx = db.transaction(STORE,"readonly");
        const request = tx.objectStore(STORE).get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return row && row.blob || null;
    } catch (err) { return null; }
  }
  async function putLocalPhoto(id, blob) {
    const db = await openDb();
    if (!db) throw new Error("This browser does not support photo storage");
    await new Promise((resolve,reject) => {
      const tx = db.transaction(STORE,"readwrite");
      tx.objectStore(STORE).put({id,blob,updatedAt:today()});
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("Could not save photo"));
      tx.onabort = () => reject(tx.error || new Error("Photo save interrupted"));
    });
    db.close();
  }
  async function deleteLocalPhoto(id) {
    try {
      const db = await openDb();
      if (!db) return;
      await new Promise((resolve,reject) => {
        const tx = db.transaction(STORE,"readwrite");
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = resolve;
        tx.onerror = reject;
      });
      db.close();
    } catch (err) { console.warn("Special photo cleanup",err); }
    const old = imageUrls.get(id);
    if (old) URL.revokeObjectURL(old);
    imageUrls.delete(id);
  }
  function showPhoto(id, blob) {
    const old = imageUrls.get(id);
    if (old) URL.revokeObjectURL(old);
    const newUrl = URL.createObjectURL(blob);
    imageUrls.set(id, newUrl);
    document.querySelectorAll("[data-special-photo]").forEach(img => {
      if (img.dataset.specialPhoto === id) {
        img.src = newUrl;
        img.hidden = false;
        if (img.previousElementSibling) img.previousElementSibling.hidden = true;
      }
    });
  }

  async function cloudGet(id) {
    const url = urlFor(id);
    if (!url) return null;
    const response = await fetch(url, {headers: {"X-Scout-Key":key()}, cache:"no-store"});
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Cloud photo lookup returned " + response.status);
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) throw new Error("Cloud returned a non-image file");
    return blob;
  }
  async function cloudPut(id, blob) {
    const url = urlFor(id);
    if (!url) return false;
    const response = await fetch(url, {
      method:"POST",
      headers:{"X-Scout-Key":key(),"Content-Type":"image/jpeg","X-Scout-Card-Fingerprint":photoFingerprint(id)},
      body:blob
    });
    if (!response.ok) throw new Error("Cloud photo upload returned " + response.status);
    return true;
  }
  async function cloudDelete(id) {
    const url = urlFor(id);
    if (!url) return;
    const response = await fetch(url,{method:"DELETE",headers:{"X-Scout-Key":key()}});
    if (!response.ok && response.status !== 404) throw new Error("Cloud photo removal returned " + response.status);
  }
  async function loadPhoto(id) {
    if (loading.has(id)) return;
    loading.add(id);
    try {
      let blob = await getLocalPhoto(id);
      if (!blob && cards.some(c => c.id === id && c.hasPhoto)) {
        try {
          blob = await cloudGet(id);
          if (blob) await putLocalPhoto(id,blob);
        } catch(err) { console.warn("Special Collection photo cloud read",err); }
      }
      if (blob && cards.some(c => c.id === id)) showPhoto(id,blob);
    } finally { loading.delete(id); }
  }

  async function prepareImage(file) {
    if (!file || !file.type.startsWith("image/")) throw new Error("Please choose an image file");
    if (file.size > 25 * 1024 * 1024) throw new Error("Please use a photo smaller than 25 MB");
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve,reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("Cannot read this image"));
        i.src = objectUrl;
      });
      const scale = Math.min(1, 1600 / Math.max(img.naturalWidth,img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not process photo");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      let blob = await new Promise((resolve,reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Photo compression failed")),"image/jpeg",.8));
      if (blob.size > 1200*1024) blob = await new Promise((resolve,reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Photo compression failed")),"image/jpeg",.55));
      return blob;
    } finally { URL.revokeObjectURL(objectUrl); }
  }

  function summary() {
    const n = cards.length, withPhoto = cards.filter(c=>c.hasPhoto).length;
    $("specialCount").textContent = n + " card" + (n === 1 ? "" : "s");
    $("specialPhotoCount").textContent = withPhoto + " photo" + (withPhoto === 1 ? "" : "s");
  }
  function listing() {
    summary();
    const needle = clean($("specialSearch").value).toLowerCase();
    const sport = $("specialSportFilter").value;
    const selected = cards.filter(c =>
      (!sport || c.sport === sport) &&
      (!needle || [c.player,c.sport,c.team,c.year,c.set,c.notes].some(t=>clean(t).toLowerCase().includes(needle)))
    ).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    const container = $("specialCards");
    if (!selected.length) {
      container.innerHTML = '<div class="special-empty">' +
        (cards.length ? "No cards match those filters." : "Your special collection is ready. Add that Tedy Bruschi card to get started!") +
        '</div>';
      return;
    }
    container.innerHTML = selected.map(c => {
      const details = [c.year,c.set,c.number ? "#"+c.number : ""].filter(Boolean).map(escape).join(" · ");
      const tags = [c.sport,c.team,c.autograph?"✍️ Autograph":"",c.relic?"Relic":"",c.favorite?"⭐ Favorite":""].filter(Boolean);
      return '<article class="special-card">' +
        '<div class="special-thumbnail"><span class="special-no-photo">🃏</span><img data-special-photo="'+escape(c.id)+'" alt="'+escape(c.player)+' card photo" hidden></div>' +
        '<div class="special-card-body"><div class="special-card-title">'+escape(c.player)+'</div>' +
        '<div class="special-detail">'+(details||"Special collectible")+'</div>' +
        '<div class="special-tags">'+tags.map(t=>'<span>'+escape(t)+'</span>').join("")+'</div>' +
        (c.notes ? '<p class="special-notes">'+escape(c.notes)+'</p>' : "") +
        '<div class="special-actions"><button type="button" class="secondary" data-special-edit="'+escape(c.id)+'">EDIT / PHOTO</button>' +
        '<button type="button" class="ghost" data-special-delete="'+escape(c.id)+'">REMOVE</button></div></div></article>';
    }).join("");
    selected.filter(c => c.hasPhoto).forEach(c => {
      if (imageUrls.has(c.id)) {
        document.querySelectorAll("[data-special-photo]").forEach(img => {
          if (img.dataset.specialPhoto === c.id) {
            img.src = imageUrls.get(c.id);
            img.hidden = false;
            if (img.previousElementSibling) img.previousElementSibling.hidden = true;
          }
        });
      } else loadPhoto(c.id);
    });
  }

  function edit(id) {
    const card = cards.find(c=>c.id === id);
    editingId = card ? card.id : "";
    selectedFile = null;
    $("specialForm").reset();
    $("specialEditor").hidden = false;
    $("specialEditorTitle").textContent = card ? "Edit special card" : "Add special card";
    $("specialPhotoHint").textContent = card && card.hasPhoto ? "This card has a photo. Choose a new image to replace it." : "Choose a photo of the front of your card (optional).";
    $("specialRemovePhoto").hidden = !card || !card.hasPhoto;
    $("specialForm").querySelector('[name="favorite"]').checked = !card || card.favorite;
    if (card) {
      ["player","sport","team","year","set","number","grade","serial","purchasePrice","purchaseDate","notes"].forEach(f => {
        $("specialForm").elements[f].value = card[f] || "";
      });
      ["autograph","relic","favorite"].forEach(f=>{ $("specialForm").elements[f].checked = !!card[f]; });
    }
    $("specialEditor").scrollIntoView({behavior:"smooth",block:"start"});
    $("specialPlayer").focus();
  }
  function hideEditor() {
    $("specialEditor").hidden = true;
    editingId = "";
    selectedFile = null;
    $("specialPhotoInput").value = "";
  }
  async function saveForm(event) {
    event.preventDefault();
    const form = $("specialForm");
    const previous = cards.find(c=>c.id===editingId);
    const fd = new FormData(form);
    const player = clean(fd.get("player"));
    if (!player) { toast("Please enter a player or subject name."); return; }
    const now = today();
    const entry = normalizeCard({
      ...(previous||{}), id: previous ? previous.id : uid(),
      player, sport: fd.get("sport"), team:fd.get("team"),
      year:fd.get("year"),set:fd.get("set"),number:fd.get("number"),
      grade:fd.get("grade"),serial:fd.get("serial"),
      purchasePrice:fd.get("purchasePrice"),purchaseDate:fd.get("purchaseDate"),
      notes:fd.get("notes"),autograph:fd.has("autograph"),
      relic:fd.has("relic"),favorite:fd.has("favorite"),
      hasPhoto: previous ? previous.hasPhoto : false,
      createdAt: previous ? previous.createdAt : now, updatedAt:now
    });
    if (!entry) { toast("Unable to save card."); return; }
    const file = selectedFile;
    const saveBtn = $("specialSaveBtn");
    saveBtn.disabled = true;
    try {
      // Prepare photo BEFORE saving metadata; a bad image does not create a half-saved entry.
      const blob = file ? await prepareImage(file) : null;
      if (blob) {
        await putLocalPhoto(entry.id,blob);
        entry.hasPhoto = true;
        showPhoto(entry.id,blob);
      }
      cards = previous ? cards.map(c=>c.id===entry.id?entry:c) : [entry,...cards];
      persist();
      hideEditor();
      listing();
      toast(previous?"Special card updated.":"Special card added!");
      if (blob) {
        try {
          const backedUp = await cloudPut(entry.id,blob);
          notice(backedUp ? "Photo saved locally and backed up to Scout Cloud." :
            "Photo saved on this device. Connect Scout Cloud to back up special card photos.");
        } catch(err) {
          notice("Photo saved on this device, but cloud photo backup failed. You can replace it later. " + err.message);
        }
      } else {
        notice("Special card saved. Card details are included in Scout Cloud backup when connected.");
      }
    } catch(err) {
      notice("Could not save card: " + (err.message||err));
    } finally { saveBtn.disabled = false; }
  }
  async function remove(id) {
    const card = cards.find(c=>c.id===id);
    if (!card || !confirm("Remove "+card.player+" from Special Collection? This does not affect the Hall of Fame roster.")) return;
    cards = cards.filter(c=>c.id!==id);
    persist();
    listing();
    await deleteLocalPhoto(id);
    if (card.hasPhoto) try { await cloudDelete(id); } catch(err) {
      notice("Card removed; its old cloud photo could not be deleted. "+err.message);
      return;
    }
    notice(card.player+" removed from Special Collection.");
  }
  async function removePhoto() {
    const card=cards.find(c=>c.id===editingId);
    if (!card || !card.hasPhoto || !confirm("Remove the photo for "+card.player+"?")) return;
    await deleteLocalPhoto(card.id);
    card.hasPhoto=false;card.updatedAt=today();
    persist();
    $("specialRemovePhoto").hidden=true;
    $("specialPhotoHint").textContent="Photo removed. Choose a new image if you like.";
    try {await cloudDelete(card.id);} catch(err) {notice("Local photo removed; cloud photo deletion failed: "+err.message);}
    listing();
  }
  function open() {
    cards=read();
    $("specialSearch").value="";
    $("specialSportFilter").value="";
    hideEditor();
    listing();
    options.navigate("specialCollectionScreen");
    notice("Special cards are separate from your Hall of Fame completion count.");
  }
  function init(config) {
    if(initialized)return;
    options=config;
    cards=read();
    initialized=true;
    $("specialAddBtn").addEventListener("click",()=>edit(""));
    $("specialCancelBtn").addEventListener("click",hideEditor);
    $("specialBackBtn").addEventListener("click",()=>{hideEditor();options.navigate("homeScreen");});
    $("specialSearch").addEventListener("input",listing);
    $("specialSportFilter").addEventListener("change",listing);
    $("specialForm").addEventListener("submit",saveForm);
    $("specialPhotoInput").addEventListener("change",e=>{
      selectedFile=e.target.files&&e.target.files[0]||null;
      if (selectedFile) $("specialPhotoHint").textContent="Selected: "+selectedFile.name;
    });
    $("specialRemovePhoto").addEventListener("click",removePhoto);
    $("specialCards").addEventListener("click",e=>{
      const editButton=e.target.closest("[data-special-edit]");
      const deleteButton=e.target.closest("[data-special-delete]");
      if (editButton) edit(editButton.dataset.specialEdit);
      if (deleteButton) remove(deleteButton.dataset.specialDelete);
    });
    summary();
  }
  return {init,open,normalizeCard};
});