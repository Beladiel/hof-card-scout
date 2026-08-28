from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing expected text for {label}")
    return text.replace(old, new, 1)

# Cache-bust sealed scanner UI.
index = Path('index.html')
html = index.read_text(encoding='utf-8')
html = replace_once(html, 'sealed-product-scout.js?v=6.1.3', 'sealed-product-scout.js?v=6.1.4', 'sealed scanner cache version')
index.write_text(html, encoding='utf-8')

# Worker: add one-search current-market check for confirmed sealed products.
worker_path = Path('src/index.js')
worker = worker_path.read_text(encoding='utf-8')
worker = replace_once(worker, 'const VERSION = "3.37.1";', 'const VERSION = "3.38.0";', 'worker version')

helper_marker = '\n\nfunction sealedBarcodeDigits(value) {'
helper_code = r'''

function sealedMarketPrice(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (value && typeof value === "object") {
    for (const key of ["extracted", "value", "amount", "raw"]) {
      const parsed = sealedMarketPrice(value[key]);
      if (parsed) return parsed;
    }
  }
  const text = String(value || "").replace(/,/g, "");
  const match = text.match(/(?:\$|USD\s*)?(\d+(?:\.\d{1,2})?)/i);
  const number = match ? Number(match[1]) : NaN;
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function sealedMarketMedian(values) {
  const sorted = values.filter(x => Number.isFinite(x) && x > 0).slice().sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function sealedMarketTypeMatches(title, type) {
  const text = String(title || "");
  const rules = {
    "Blaster Box": /\bblaster\b/i,
    "Mega Box": /\bmega\b/i,
    "Hobby Box": /\bhobby\b/i,
    "Retail Box": /\bretail\b/i,
    "Hanger Box": /\bhanger\b/i,
    "Hanger Pack": /\bhanger\b/i,
    "Value / Fat Pack": /\b(?:value|fat)\s*pack\b/i,
    "Single Pack": /\b(?:single|1)\s*pack\b|\bpack\b/i,
    "Multi-Pack": /\bmulti[- ]?pack\b|\b\d+\s*pack\b/i,
    "Elite Trainer Box": /\belite\s+trainer\s+box\b|\bETB\b/i,
    "Booster Box": /\bbooster\s+box\b/i,
    "Booster Bundle": /\bbooster\s+bundle\b/i,
    "Booster Pack": /\bbooster\s+pack\b/i,
    "Collection Box": /\bcollection\s+box\b/i,
    "Tin": /\btin\b/i,
  };
  const rule = rules[String(type || "")];
  return rule ? rule.test(text) : true;
}

function sealedMarketQuery(identity, lookupTitle) {
  const type = String(identity?.boxType || identity?.productType || "").trim();
  const set = String(identity?.set || "").trim();
  const year = String(identity?.year || "").trim();
  const variant = String(identity?.variant || "").trim();
  const knownTitle = String(lookupTitle || "").trim();
  let base = knownTitle || [year, set].filter(Boolean).join(" ");
  if (type && !base.toLowerCase().includes(type.toLowerCase())) base += ` ${type}`;
  if (variant && !base.toLowerCase().includes(variant.toLowerCase())) base += ` ${variant}`;
  return base.replace(/\s+/g, " ").trim().slice(0, 220);
}

function sealedMarketVerdict(shelfPrice, median, sampleCount) {
  if (!Number.isFinite(shelfPrice) || shelfPrice <= 0 || !Number.isFinite(median) || median <= 0 || sampleCount < 3) {
    return { verdict: "CHECK MANUALLY", reason: "Scout found too few clean matching listings for a reliable price verdict." };
  }
  const ratio = shelfPrice / median;
  const differencePct = Math.round(Math.abs(1 - ratio) * 100);
  if (ratio <= 0.85) return { verdict: "GOOD BUY", reason: `Shelf price is about ${differencePct}% below the median current listing price.` };
  if (ratio <= 1.10) return { verdict: "FAIR", reason: `Shelf price is within about ${differencePct}% of the median current listing price.` };
  return { verdict: "PASS", reason: `Shelf price is about ${differencePct}% above the median current listing price.` };
}

function sealedMarketResultRows(data, identity) {
  const rows = Array.isArray(data?.organic_results) ? data.organic_results : (Array.isArray(data?.results) ? data.results : []);
  const type = String(identity?.boxType || identity?.productType || "").trim();
  const seen = new Set();
  const clean = [];
  for (const row of rows) {
    const title = String(row?.title || row?.name || "").trim();
    if (!title || /\b(?:case\s+break|break\s+spot|empty\s+box|box\s+only|opened|wrapper|digital|you\s+pick|single\s+card)\b/i.test(title)) continue;
    if (!sealedMarketTypeMatches(title, type)) continue;
    const formatText = JSON.stringify([row?.buying_format, row?.buying_options, row?.bids, row?.bid_count, row?.time_left] || []).toLowerCase();
    if (/auction|\bbid\b/.test(formatText)) continue;
    const price = sealedMarketPrice(row?.price ?? row?.current_price ?? row?.displayed_price);
    if (!price || price < 3 || price > 5000) continue;
    const link = String(row?.link || row?.url || "").trim();
    const key = `${title.toLowerCase()}|${price.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push({ title: title.slice(0, 220), price: Number(price.toFixed(2)), link: /^https?:\/\//i.test(link) ? link : "" });
  }
  if (clean.length >= 5) {
    const firstMedian = sealedMarketMedian(clean.map(x => x.price));
    if (firstMedian) {
      return clean.filter(x => x.price >= firstMedian * 0.45 && x.price <= firstMedian * 2.2).slice(0, 20);
    }
  }
  return clean.slice(0, 20);
}
'''
if 'function sealedMarketPrice' not in worker:
    if helper_marker not in worker:
        raise SystemExit('Could not find sealed helper marker')
    worker = worker.replace(helper_marker, helper_code + helper_marker, 1)

route_marker = '    if (url.pathname === "/sealed/classify-type" && request.method === "POST") {'
route_code = r'''    if (url.pathname === "/sealed/value-check" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SERPAPI_KEY) {
        return json({ ok: false, error: "market_not_configured", message: "Scout market pricing is not configured on the Worker.", searchUsed: 0, marketplaceSearchesUsed: 0 }, 503, cors);
      }
      let body = {};
      try { body = await request.json(); }
      catch { return json({ ok: false, error: "bad_json", message: "Scout could not read that sealed-product market request.", searchUsed: 0, marketplaceSearchesUsed: 0 }, 400, cors); }

      const identity = body?.identity && typeof body.identity === "object" ? body.identity : {};
      const shelfPrice = Number(body?.shelfPrice);
      const lookupTitle = String(body?.lookupTitle || "").trim().slice(0, 220);
      const query = sealedMarketQuery(identity, lookupTitle);
      const productType = String(identity?.boxType || identity?.productType || "").trim();
      if (!query || !productType || !Number.isFinite(shelfPrice) || shelfPrice <= 0) {
        return json({ ok: false, error: "missing_fields", message: "Confirm the product type and save the shelf price before checking market value.", searchUsed: 0, marketplaceSearchesUsed: 0 }, 400, cors);
      }

      const cacheKey = `sealed:value:v1:${encodeURIComponent(query.toLowerCase()).slice(0, 300)}`;
      if (env.SCOUT_DATA) {
        try {
          const cached = await env.SCOUT_DATA.get(cacheKey, { type: "json" });
          if (cached?.query === query && Array.isArray(cached?.listings)) {
            const verdict = sealedMarketVerdict(shelfPrice, Number(cached.median), cached.listings.length);
            return json({ ok: true, version: VERSION, query, shelfPrice, ...cached, ...verdict, cacheHit: true, searchUsed: 0, marketplaceSearchesUsed: 0 }, 200, cors);
          }
        } catch {}
      }

      const serpUrl = new URL("https://serpapi.com/search.json");
      serpUrl.searchParams.set("engine", "ebay");
      serpUrl.searchParams.set("ebay_domain", "ebay.com");
      serpUrl.searchParams.set("_nkw", query);
      serpUrl.searchParams.set("_ipg", "50");
      serpUrl.searchParams.set("api_key", env.SERPAPI_KEY);

      let data = {};
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(serpUrl.toString(), { signal: controller.signal });
        clearTimeout(timeout);
        data = await response.json().catch(() => ({}));
        if (!response.ok || data?.error) {
          return json({ ok: false, error: "market_search_failed", message: "Scout could not complete the sealed-product market search right now.", searchUsed: 1, marketplaceSearchesUsed: 1 }, 502, cors);
        }
      } catch (err) {
        console.error("sealed market search failed", err);
        return json({ ok: false, error: "market_search_failed", message: "Scout could not complete the sealed-product market search right now.", searchUsed: 1, marketplaceSearchesUsed: 1 }, 502, cors);
      }

      const listings = sealedMarketResultRows(data, identity);
      const prices = listings.map(x => x.price);
      const median = sealedMarketMedian(prices);
      const low = prices.length ? Math.min(...prices) : null;
      const high = prices.length ? Math.max(...prices) : null;
      const verdict = sealedMarketVerdict(shelfPrice, Number(median), listings.length);
      const market = {
        query,
        median: Number.isFinite(median) ? Number(median.toFixed(2)) : null,
        low: Number.isFinite(low) ? Number(low.toFixed(2)) : null,
        high: Number.isFinite(high) ? Number(high.toFixed(2)) : null,
        listings: listings.slice().sort((a, b) => a.price - b.price).slice(0, 5),
        sampleCount: listings.length,
        checkedAt: new Date().toISOString(),
      };
      if (env.SCOUT_DATA && listings.length) {
        try { await env.SCOUT_DATA.put(cacheKey, JSON.stringify({ ...market, listings }), { expirationTtl: 6 * 60 * 60 }); } catch {}
      }
      return json({ ok: true, version: VERSION, shelfPrice, ...market, ...verdict, cacheHit: false, searchUsed: 1, marketplaceSearchesUsed: 1 }, 200, cors);
    }

'''
if '/sealed/value-check' not in worker:
    if route_marker not in worker:
        raise SystemExit('Could not find sealed classify route marker')
    worker = worker.replace(route_marker, route_code + route_marker, 1)
worker_path.write_text(worker, encoding='utf-8')

# Front end: activate Step 3 market value comparison.
app_path = Path('sealed-product-scout.js')
app = app_path.read_text(encoding='utf-8')
app = replace_once(
    app,
    '      .sealed-next{opacity:.72}.sealed-next strong{color:var(--gold)}\n',
    '      .sealed-market-result{margin-top:12px;border:1px solid rgba(230,189,99,.38);border-radius:16px;padding:12px;background:rgba(230,189,99,.07)}.sealed-market-result[hidden]{display:none}.sealed-market-verdict{font-size:24px;font-weight:950;line-height:1.1}.sealed-market-meta{font-size:11px;color:var(--muted);line-height:1.5;margin-top:7px}.sealed-market-list{display:grid;gap:7px;margin-top:10px}.sealed-market-item{border-top:1px solid var(--line);padding-top:7px;font-size:11px;line-height:1.4}.sealed-market-item a{color:var(--gold);text-decoration:none}.sealed-market-price{font-weight:950;color:var(--text)}\n      .sealed-next{opacity:1}.sealed-next strong{color:var(--gold)}\n',
    'sealed market styles',
)
app = replace_once(
    app,
    '          <div class="sealed-card-sub">You can save the shelf price now. That still costs 0 searches. The next build gate will add market pricing, chase/checklist quality, collector feedback, and Scout’s <strong>GOOD BUY / FAIR / PASS</strong> verdict.</div>\n',
    '          <div class="sealed-card-sub">Save the shelf price, then Scout can compare it with current matching eBay listings. A fresh market check uses <strong>at most 1 marketplace search</strong>; a recent cached check uses 0. This first value gate is price-only — checklist/chase quality comes next.</div>\n',
    'step 3 description',
)
app = replace_once(
    app,
    '            <button type="button" class="ghost" id="sealedResearchPreviewBtn">NEXT: VALUE RESEARCH</button>\n',
    '            <button type="button" class="primary" id="sealedResearchPreviewBtn">💰 CHECK MARKET VALUE · 1 SEARCH MAX</button>\n',
    'market button',
)
app = replace_once(
    app,
    '          <div class="sealed-status" id="sealedPriceStatus">Confirm the product first, then save the shelf price.</div>\n',
    '          <div class="sealed-status" id="sealedPriceStatus">Confirm the product first, then save the shelf price.</div>\n          <div class="sealed-market-result" id="sealedMarketResult" hidden></div>\n',
    'market result container',
)

function_marker = '  function startOver(){\n'
market_functions = r'''  function renderMarketResearch(research){
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
    box.innerHTML=`<div class="section-eyebrow">SCOUT'S PRICE CHECK</div><div class="sealed-market-verdict">${esc(research.verdict)}</div><div class="sealed-market-meta">${esc(research.reason||"")}<br>Shelf: <strong>${money(research.shelfPrice)||"—"}</strong> · Current-listing median: <strong>${median}</strong> · Range: ${low}–${high} · ${Number(research.sampleCount||0)} clean match${Number(research.sampleCount||0)===1?"":"es"}.<br>${used} marketplace search${used===1?"":"es"} used${cached}. Current eBay asking prices, before shipping; not sold comps.</div>${rows?`<div class="sealed-market-list">${rows}</div>`:""}`;
  }

  async function runValueResearch(){
    const draft=readDraft(),status=byId("sealedPriceStatus"),btn=byId("sealedResearchPreviewBtn");
    if(!draft.confirmed||!draft.identity){status.className="sealed-status warn";status.textContent="Confirm the exact product first.";return;}
    const shelfPrice=Number(draft.shelfPrice);
    if(!Number.isFinite(shelfPrice)||shelfPrice<=0){status.className="sealed-status warn";status.textContent="Save the shelf price first.";byId("sealedShelfPrice")?.focus();return;}
    const cfg=typeof pricingConfig==="function"?pricingConfig():{endpoint:"",accessKey:""};
    if(!cfg.endpoint||!cfg.accessKey){status.className="sealed-status warn";status.textContent="Scout's live connection is not configured on this device.";return;}
    btn.disabled=true;btn.textContent="💰 SCOUT IS CHECKING THE MARKET…";status.className="sealed-status";status.textContent="Checking current matching eBay listings. This uses at most 1 marketplace search; cached results use 0.";
    try{
      const res=await fetch(`${String(cfg.endpoint).replace(/\/+$/,"")}/sealed/value-check`,{method:"POST",headers:{"Content-Type":"application/json","X-Scout-Key":cfg.accessKey},body:JSON.stringify({identity:draft.identity,shelfPrice,lookupTitle:draft.barcodeTitle||""})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.ok)throw new Error(data.message||"Scout could not complete the sealed-product market check.");
      const research={verdict:data.verdict||"CHECK MANUALLY",reason:data.reason||"",shelfPrice:Number(data.shelfPrice||shelfPrice),median:data.median,low:data.low,high:data.high,sampleCount:Number(data.sampleCount||0),listings:Array.isArray(data.listings)?data.listings:[],query:data.query||"",cacheHit:!!data.cacheHit,marketplaceSearchesUsed:Number(data.marketplaceSearchesUsed||0),checkedAt:data.checkedAt||new Date().toISOString()};
      saveDraft({marketResearch:research});renderMarketResearch(research);
      status.className="sealed-status ok";status.textContent=`✓ Market check complete. ${research.marketplaceSearchesUsed} marketplace search${research.marketplaceSearchesUsed===1?"":"es"} used.`;
      byId("sealedMarketResult")?.scrollIntoView({behavior:"smooth",block:"center"});
    }catch(err){status.className="sealed-status warn";status.textContent=err?.message||"Scout could not complete the market check right now.";}
    finally{btn.disabled=false;btn.textContent="💰 CHECK MARKET VALUE · 1 SEARCH MAX";}
  }

'''
if 'async function runValueResearch' not in app:
    if function_marker not in app:
        raise SystemExit('Could not find startOver marker')
    app = app.replace(function_marker, market_functions + function_marker, 1)

app = replace_once(
    app,
    '    renderConfirmed(draft);\n',
    '    renderConfirmed(draft);\n    renderMarketResearch(draft.marketResearch);\n',
    'restore market research',
)
app = replace_once(
    app,
    '    const next=saveDraft({shelfPrice:Number(price.toFixed(2)),store:byId("sealedStore")?.value.trim()||""});\n    renderConfirmed(next);\n',
    '    const next=saveDraft({shelfPrice:Number(price.toFixed(2)),store:byId("sealedStore")?.value.trim()||"",marketResearch:null});\n    renderConfirmed(next);renderMarketResearch(null);\n',
    'clear stale market result after price change',
)
app = replace_once(
    app,
    '    const draft=saveDraft({identity,confirmed:true,shelfPrice:readDraft().shelfPrice??"",store:readDraft().store||""});\n',
    '    const draft=saveDraft({identity,confirmed:true,shelfPrice:readDraft().shelfPrice??"",store:readDraft().store||"",marketResearch:null});\n',
    'clear stale market result after identity confirm',
)
old_preview = r'''    byId("sealedResearchPreviewBtn").addEventListener("click",()=>{
      const status=byId("sealedPriceStatus");
      const draft=readDraft();
      if(!draft.confirmed){status.className="sealed-status warn";status.textContent="Confirm the exact product first.";return;}
      if(!Number.isFinite(Number(draft.shelfPrice))||Number(draft.shelfPrice)<=0){status.className="sealed-status warn";status.textContent="Save the shelf price first.";return;}
      status.className="sealed-status ok";status.textContent="✓ Ready for the next gate. No research has been launched yet, so your search budget is untouched.";
    });
'''
app = replace_once(app, old_preview, '    byId("sealedResearchPreviewBtn").addEventListener("click",runValueResearch);\n', 'value research click handler')
app = replace_once(
    app,
    '    renderConfirmed({});\n',
    '    renderConfirmed({});renderMarketResearch(null);\n',
    'clear market result on reset',
)
app_path.write_text(app, encoding='utf-8')

# Update regression coverage.
test_path = Path('tests/sealed-product-vision.test.cjs')
test = test_path.read_text(encoding='utf-8')
test = replace_once(test, 'const VERSION = "3\\.37\\.1"', 'const VERSION = "3\\.38\\.0"', 'test worker version')
insert_after = "assert.match(worker,/\\/sealed\\/classify-type/,'sealed product type classifier endpoint must exist');\n"
market_asserts = "assert.match(worker,/\\/sealed\\/value-check/,'sealed market value endpoint must exist');\nassert.match(app,/CHECK MARKET VALUE · 1 SEARCH MAX/,'sealed scanner must expose the one-search market check');\nassert.match(app,/sealed\\/value-check/,'front end must call the sealed market endpoint');\nassert.match(worker,/engine\\\", \\\"ebay/,'sealed market check must use the eBay search engine');\n"
if "sealed market value endpoint must exist" not in test:
    test = replace_once(test, insert_after, insert_after + market_asserts, 'market test assertions')
append_before = "console.log('Sealed Product Scout vision tests passed.');\n"
market_route_test = r'''const marketRouteStart=worker.indexOf('url.pathname === "/sealed/value-check"');
const marketRouteEnd=worker.indexOf('url.pathname === "/sealed/classify-type"',marketRouteStart);
const marketRoute=worker.slice(marketRouteStart,marketRouteEnd);
assert.ok(marketRouteStart>=0&&marketRouteEnd>marketRouteStart,'market route should be isolated before type classifier');
assert.match(marketRoute,/SERPAPI_KEY/,'market route should require SerpApi');
assert.match(marketRoute,/marketplaceSearchesUsed:\s*1/,'fresh market search must report one marketplace search');
assert.match(marketRoute,/cacheHit:\s*true[\s\S]*marketplaceSearchesUsed:\s*0/,'cached market result must cost zero marketplace searches');
assert.doesNotMatch(marketRoute,/APIFY_TOKEN|CARD_API_KEY/i,'sealed market route should not spend secondary-provider calls');
'''
if 'const marketRouteStart=' not in test:
    test = replace_once(test, append_before, market_route_test + append_before, 'market route tests')
test_path.write_text(test, encoding='utf-8')
