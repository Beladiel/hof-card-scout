from pathlib import Path
import re

# ---- Worker ----
p=Path('src/index.js')
s=p.read_text(encoding='utf-8')
assert 'const VERSION = "3.29.0";' in s
s=s.replace('const VERSION = "3.29.0";','const VERSION = "3.30.0";',1)

old_route='''      let body = {};
      try { body = await request.json(); } catch {}
      if (String(body?.kind || "target") !== "target") {
        return json({ ok: false, error: "unsupported_automation_kind", message: "Only the one-target safety check is enabled at this gate." }, 400, cors);
      }
      try {
        let state = await readAutomationState(env.SCOUT_DATA);
        const catalog = await readAutomationCatalog(env.SCOUT_DATA);
        const run = await runOneAutomationTargetCheck(env, state, catalog);
        state = run.state;
        await writeAutomationState(env.SCOUT_DATA, state);
        return json({ ok: true, version: VERSION, runnerEnabled: true, targetRunnerEnabled: true, collectionRunnerEnabled: false, result: run.result, ...automationPublicState(state), catalog: automationCatalogSummary(catalog) }, 200, cors);
      } catch (err) {
        console.error(err);
        return json({ ok: false, error: "automation_run_failed", message: err?.message || "Scout could not complete the protected target check." }, 502, cors);
      }'''
new_route='''      let body = {};
      try { body = await request.json(); } catch {}
      const kind = String(body?.kind || "target");
      if (!["target", "collection"].includes(kind)) {
        return json({ ok: false, error: "unsupported_automation_kind", message: "Scout only supports protected target or collection safety checks here." }, 400, cors);
      }
      try {
        let state = await readAutomationState(env.SCOUT_DATA);
        const catalog = await readAutomationCatalog(env.SCOUT_DATA);
        const run = kind === "collection"
          ? await runOneAutomationCollectionCheck(env, state, catalog)
          : await runOneAutomationTargetCheck(env, state, catalog);
        state = run.state;
        await writeAutomationState(env.SCOUT_DATA, state);
        return json({ ok: true, version: VERSION, runnerEnabled: true, targetRunnerEnabled: true, collectionRunnerEnabled: false, result: run.result, ...automationPublicState(state), catalog: automationCatalogSummary(catalog) }, 200, cors);
      } catch (err) {
        console.error(err);
        return json({ ok: false, error: "automation_run_failed", message: err?.message || "Scout could not complete the protected automation check." }, 502, cors);
      }'''
assert old_route in s
s=s.replace(old_route,new_route,1)

old_usage='''function normalizeAutomationUsage(raw={}, period=automationMonthKey()) {
  if (String(raw?.period || "") !== period) {
    return { period, serpSuccessful: 0, cardApiRequests: 0, apifyRuns: 0 };
  }
  return {
    period,
    serpSuccessful: Math.max(0, Math.floor(Number(raw?.serpSuccessful) || 0)),
    cardApiRequests: Math.max(0, Math.floor(Number(raw?.cardApiRequests) || 0)),
    apifyRuns: Math.max(0, Math.floor(Number(raw?.apifyRuns) || 0)),
  };
}

function normalizeAutomationState(raw={}) {
  const period = automationMonthKey();
  return {
    schema: 2,
    settings: normalizeAutomationSettings(raw?.settings || AUTOMATION_DEFAULT_SETTINGS),
    usage: normalizeAutomationUsage(raw?.usage || {}, period),
    alerts: Array.isArray(raw?.alerts) ? raw.alerts.slice(-50) : [],
    targetChecks: raw?.targetChecks && typeof raw.targetChecks === "object" && !Array.isArray(raw.targetChecks) ? raw.targetChecks : {},
    lastRunAt: raw?.lastRunAt || "",
    updatedAt: raw?.updatedAt || "",
  };
}'''
new_usage='''function normalizeAutomationUsage(raw={}, period=automationMonthKey()) {
  if (String(raw?.period || "") !== period) {
    return { period, serpSuccessful: 0, cardApiRequests: 0, apifyRuns: 0, collectionCardsChecked: 0 };
  }
  return {
    period,
    serpSuccessful: Math.max(0, Math.floor(Number(raw?.serpSuccessful) || 0)),
    cardApiRequests: Math.max(0, Math.floor(Number(raw?.cardApiRequests) || 0)),
    apifyRuns: Math.max(0, Math.floor(Number(raw?.apifyRuns) || 0)),
    collectionCardsChecked: Math.max(0, Math.floor(Number(raw?.collectionCardsChecked) || 0)),
  };
}

function normalizeAutomationState(raw={}) {
  const period = automationMonthKey();
  return {
    schema: 3,
    settings: normalizeAutomationSettings(raw?.settings || AUTOMATION_DEFAULT_SETTINGS),
    usage: normalizeAutomationUsage(raw?.usage || {}, period),
    alerts: Array.isArray(raw?.alerts) ? raw.alerts.slice(-50) : [],
    targetChecks: raw?.targetChecks && typeof raw.targetChecks === "object" && !Array.isArray(raw.targetChecks) ? raw.targetChecks : {},
    collectionChecks: raw?.collectionChecks && typeof raw.collectionChecks === "object" && !Array.isArray(raw.collectionChecks) ? raw.collectionChecks : {},
    lastRunAt: raw?.lastRunAt || "",
    updatedAt: raw?.updatedAt || "",
  };
}'''
assert old_usage in s
s=s.replace(old_usage,new_usage,1)

anchor='''async function runScheduledTargetMonitor(env, now=new Date()) {
  if (!env?.SCOUT_DATA) return { status: "skipped", searchUsed: 0, message: "SCOUT_DATA is not configured." };'''
assert anchor in s
collection_code=r'''function automationCollectionKey(entry) {
  return [entry?.kind || "official", entry?.name || "", entry?.cardKey || ""].join("|").toLowerCase();
}

function automationEligibleCollectionCards(catalog) {
  const normalized = normalizeAutomationCatalog(catalog || {});
  return normalized.official.filter(entry =>
    entry.owned === true &&
    Number.isInteger(Number(entry.cardYear)) &&
    Boolean(entry.set) &&
    Boolean(entry.cardNum) &&
    Boolean(entry.cardKey)
  );
}

function automationHasCurrentCollectionValue(entry) {
  return Boolean(entry?.cardKey) &&
    entry.valuationCardKey === entry.cardKey &&
    Number.isFinite(Number(entry.median)) && Number(entry.median) > 0;
}

function automationChooseCollectionCard(catalog, state) {
  const cards = automationEligibleCollectionCards(catalog);
  if (!cards.length) return null;
  const checks = state?.collectionChecks && typeof state.collectionChecks === "object" ? state.collectionChecks : {};
  cards.sort((a,b) => {
    const av = automationHasCurrentCollectionValue(a) ? 1 : 0;
    const bv = automationHasCurrentCollectionValue(b) ? 1 : 0;
    if (av !== bv) return av - bv;
    const at = Date.parse(checks[automationCollectionKey(a)] || "") || 0;
    const bt = Date.parse(checks[automationCollectionKey(b)] || "") || 0;
    return at - bt || a.name.localeCompare(b.name);
  });
  return cards[0];
}

function automationCollectionCard(entry) {
  return {
    player: entry.name,
    year: Number(entry.cardYear),
    set: entry.set || "",
    cardNum: entry.cardNum || "",
    grader: entry.grader || "Raw",
    grade: entry.gradeCondition || "",
    autograph: Boolean(entry.autograph),
    relic: Boolean(entry.relic),
    serial: entry.serial || "",
    notes: "",
    shopPrice: null,
    fastMode: true,
  };
}

function automationReliableCollectionValuation(value) {
  const median = Number(value?.median);
  const used = valuationEvidenceCount(value);
  const confidence = String(value?.confidence || "insufficient").toLowerCase();
  return Number.isFinite(median) && median > 0 && used >= 2 && confidence !== "insufficient";
}

function automationCollectionValuationResult(value) {
  return {
    median: Number.isFinite(Number(value?.median)) ? Number(value.median) : null,
    low: Number.isFinite(Number(value?.low)) ? Number(value.low) : null,
    high: Number.isFinite(Number(value?.high)) ? Number(value.high) : null,
    used: valuationEvidenceCount(value),
    confidence: String(value?.confidence || "insufficient").toLowerCase(),
    checkedAt: value?.checkedAt || null,
    cacheHit: value?.cacheHit === true,
  };
}

async function runOneAutomationCollectionCheck(env, inputState, catalog, now=new Date()) {
  let state = normalizeAutomationState(inputState || {});
  if (!state.settings.collectionRefreshEnabled) {
    return { state, result: { status: "skipped", searchUsed: 0, message: "Collection-value rotation is turned off in your guardrails." } };
  }
  const monthlyLimit = Math.max(0, Number(state.settings.collectionCardsPerMonth) || 0);
  if (monthlyLimit < 1) {
    return { state, result: { status: "skipped", searchUsed: 0, message: "Collection cards/month is set to 0, so Scout used zero searches." } };
  }
  if (Number(state.usage.collectionCardsChecked || 0) >= monthlyLimit) {
    return { state, result: { status: "skipped", searchUsed: 0, message: "This month's collection-card rotation limit is already reached. Scout used zero searches." } };
  }

  const entry = automationChooseCollectionCard(catalog, state);
  if (!entry) {
    return { state, result: { status: "skipped", searchUsed: 0, message: "No owned representative card has enough exact identity for a safe automatic value check." } };
  }

  const card = automationCollectionCard(entry);
  const key = automationCollectionKey(entry);
  state.collectionChecks[key] = now.toISOString();
  state.usage.collectionCardsChecked += 1;
  state.lastRunAt = now.toISOString();

  let valuation = null;
  let searchUsed = 0;
  let cacheHit = false;
  try {
    const cached = await readValuationCache(card, true);
    if (cached?.fresh) {
      valuation = withCurrentShopVerdict(cached.result, card, true);
      cacheHit = true;
    } else {
      if (!env.SERPAPI_KEY) {
        state.updatedAt = now.toISOString();
        return { state, result: { status: "skipped", searchUsed: 0, card: { name: entry.name, cardKey: entry.cardKey }, message: "SerpApi is not configured, so Scout used zero searches." } };
      }
      const reserved = automationReserveSerp(state, 1);
      if (!reserved.ok) {
        state = reserved.state;
        state.updatedAt = now.toISOString();
        return { state, result: { status: "skipped", searchUsed: 0, card: { name: entry.name, cardKey: entry.cardKey }, message: "Monthly automatic-search cap reached. Scout stopped without searching." } };
      }
      state = reserved.state;
      searchUsed = 1;
      const query = buildQuery(card);
      const data = await runEbaySearch(query, env.SERPAPI_KEY, "Sold", false, SERP_SOLD_STRICT_TIMEOUT_MS);
      const raw = Array.isArray(data?.organic_results) ? data.organic_results : [];
      const normalized = dedupeSoldComps(raw.map(normalizeResult).filter(Boolean));
      const evaluation = evaluateComparableResults(normalized, card);
      const notes = buildNotes(card, raw.length, evaluation.matchedItems.length, evaluation.cleaned.length, evaluation.confidence);
      notes.unshift("Automation used one strict SerpApi Sold search only. No broad retry, The Card API, or Apify was allowed.");
      const rawValue = finalizeValuation(card, query, evaluation.matchedItems, {
        provider: "eBay sold results via SerpApi",
        searchMode: "Sold-automation-strict",
        matchMode: evaluation.matchMode,
        searched: raw.length,
        matched: evaluation.matchedItems.length,
        providerDiagnostics: {},
        notes,
        mode: "automation-fast",
        bestOfferRecovered: 0,
        bestOfferRecoveryAttempted: 0,
      });
      valuation = withCurrentShopVerdict(rawValue, card, false);
      if (valuationEvidenceCount(valuation) > 0) {
        await writeValuationCache(card, true, cacheableValuationResult(valuation));
      }
    }

    const saved = automationReliableCollectionValuation(valuation);
    const publicValue = automationCollectionValuationResult(valuation);
    const used = publicValue.used;
    const message = saved
      ? `COLLECTION VALUE READY — ${entry.name} has ${used} reliable sold comp${used === 1 ? "" : "s"}.`
      : `VALUE NOT SAVED — only ${used} reliable sold comp${used === 1 ? "" : "s"}; Scout needs at least 2 before adding collection history.`;
    state.updatedAt = now.toISOString();
    return {
      state,
      result: {
        status: "checked",
        searchUsed,
        cacheHit,
        saved,
        checkedAt: now.toISOString(),
        card: {
          name: entry.name,
          cardKey: entry.cardKey,
          label: [entry.cardYear, entry.set, entry.cardNum ? `#${entry.cardNum}` : "", entry.grader && entry.grader !== "Raw" ? `${entry.grader} ${entry.gradeCondition || ""}`.trim() : "Raw"].filter(Boolean).join(" "),
        },
        valuation: publicValue,
        message,
      }
    };
  } catch (err) {
    state.updatedAt = now.toISOString();
    return {
      state,
      result: {
        status: "error",
        searchUsed,
        cacheHit,
        saved: false,
        checkedAt: now.toISOString(),
        card: { name: entry.name, cardKey: entry.cardKey },
        message: err?.message || "Protected collection-value search failed."
      }
    };
  }
}

'''
s=s.replace(anchor,collection_code+anchor,1)

# ---- Automation UI ----
p=Path('automation-runner-ui.js')
u=p.read_text(encoding='utf-8')
u=u.replace('Prove the one-search rule before cron.','Prove each one-search rule before unattended collection rotation.',1)
u=u.replace('Syncing your collection/target catalog costs zero marketplace searches. This button then checks one eligible saved target and is hard-limited to one SerpApi search. It never launches Find a Target, broad retries, sold-comps enrichment, Card API, or Apify.','Syncing your collection/target catalog costs zero marketplace searches. Target and collection safety checks are each hard-limited to one SerpApi search. The collection check may use zero when a fresh six-hour cache already exists; neither safety check can launch broad retries, The Card API, or Apify.',1)
old_buttons='''<div class="automation-actions"><button type="button" class="secondary" id="automationRunOneTarget">RUN ONE SAFE TARGET CHECK</button><button type="button" class="ghost" id="automationSyncCatalog">SYNC CATALOG · 0 SEARCHES</button></div>'''
new_buttons='''<div class="automation-actions"><button type="button" class="secondary" id="automationRunOneTarget">RUN ONE SAFE TARGET CHECK</button><button type="button" class="secondary" id="automationRunOneCollection">RUN ONE SAFE COLLECTION CHECK</button><button type="button" class="ghost" id="automationSyncCatalog">SYNC CATALOG · 0 SEARCHES</button></div>'''
assert old_buttons in u
u=u.replace(old_buttons,new_buttons,1)

mount_anchor='''  function mount(){if(document.getElementById("automationRunnerCard"))return;'''
assert mount_anchor in u
collection_ui=r'''  function applyCollectionValue(result){
    if(!result?.saved||!result?.valuation||!result?.card?.name)return false;
    try{
      if(typeof PLAYERS==="undefined"||!globalThis.ScoutCollectionValue?.buildTrackingPatch)return false;
      const player=PLAYERS.find(p=>p&&p.name===result.card.name);
      if(!player)return false;
      const when=new Date(result.checkedAt||Date.now());
      const patch=globalThis.ScoutCollectionValue.buildTrackingPatch(player,result.valuation,when);
      if(!patch)return false;
      Object.assign(player,patch);
      if(typeof savePlayerEdit==="function")savePlayerEdit(player);
      if(typeof collectionValueSaveCollectionSnapshot==="function")collectionValueSaveCollectionSnapshot(when);
      return true;
    }catch{return false;}
  }
  async function runOneCollection(){const out=document.getElementById("automationRunnerResult"),btn=document.getElementById("automationRunOneCollection"),c=connection();if(btn)btn.disabled=true;try{await doSync();if(!c.endpoint||!c.accessKey)throw new Error("Scout's live connection is not configured on this device.");if(out){out.className="automation-runner-result";out.textContent="Running one protected collection-value check… fresh cache may cost 0; otherwise maximum 1 automatic SerpApi search.";}const res=await fetch(c.endpoint+"/automation/run-once",{method:"POST",headers:{"Content-Type":"application/json","X-Scout-Key":c.accessKey},body:JSON.stringify({kind:"collection"})});const data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.message||data.error||("HTTP "+res.status));const r=data.result||{};let applied=false;if(r.status==="checked"&&r.saved){applied=applyCollectionValue(r);if(applied)try{await syncCatalog()}catch{}}if(out){out.className="automation-runner-result "+(r.status==="error"?"bad":"ok");if(r.status==="checked"&&r.saved)out.textContent=`✓ ${r.searchUsed||0} search${Number(r.searchUsed||0)===1?"":"es"} used. VALUE SAVED: ${r.card?.name||"Collection card"} ${money(r.valuation?.median)} · ${r.valuation?.used||0} comps${r.cacheHit?" · fresh cache reused":""}${applied?" · collection history updated":""}.`;else if(r.status==="checked")out.textContent=`✓ ${r.searchUsed||0} search${Number(r.searchUsed||0)===1?"":"es"} used. ${r.card?.name||"Collection card"} checked. ${r.message||"Value was not saved."}`;else out.textContent=`✓ ${r.searchUsed||0} searches used. ${r.message||"No eligible collection card needed a check."}`;}document.getElementById("automationReload")?.click();}catch(err){if(out){out.className="automation-runner-result bad";out.textContent="Safe collection runner could not complete: "+(err.message||"unknown error");}}finally{if(btn)btn.disabled=false;}}
'''
u=u.replace(mount_anchor,collection_ui+mount_anchor,1)
old_mount='''document.getElementById("automationRunOneTarget")?.addEventListener("click",runOne);document.getElementById("automationSyncCatalog")?.addEventListener'''
new_mount='''document.getElementById("automationRunOneTarget")?.addEventListener("click",runOne);document.getElementById("automationRunOneCollection")?.addEventListener("click",runOneCollection);document.getElementById("automationSyncCatalog")?.addEventListener'''
assert old_mount in u
u=u.replace(old_mount,new_mount,1)
p.write_text(u,encoding='utf-8')

# Update current Worker-version assertions in regression tests.
for tp in Path('tests').glob('*.test.cjs'):
    text=tp.read_text(encoding='utf-8')
    text=text.replace('3\\.29\\.0','3\\.30\\.0').replace('3.29.0','3.30.0')
    tp.write_text(text,encoding='utf-8')

p=Path('src/index.js')
p.write_text(s,encoding='utf-8')
