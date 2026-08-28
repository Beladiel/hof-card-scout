from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing expected text for {label}")
    return text.replace(old, new, 1)

worker_path = Path('src/index.js')
worker = worker_path.read_text(encoding='utf-8')
worker = replace_once(worker, 'const VERSION = "3.38.2";', 'const VERSION = "3.38.3";', 'worker version')

old_verdict = '''function sealedMarketVerdict(shelfPrice, median, sampleCount) {
  if (!Number.isFinite(shelfPrice) || shelfPrice <= 0 || !Number.isFinite(median) || median <= 0 || sampleCount < 3) {
    return { verdict: "CHECK MANUALLY", reason: "Scout found too few clean matching listings for a reliable price verdict." };
  }
  const ratio = shelfPrice / median;
  const differencePct = Math.round(Math.abs(1 - ratio) * 100);
  if (ratio <= 0.85) return { verdict: "GOOD BUY", reason: `Shelf price is about ${differencePct}% below the median current listing price.` };
  if (ratio <= 1.10) return { verdict: "FAIR", reason: `Shelf price is within about ${differencePct}% of the median current listing price.` };
  return { verdict: "PASS", reason: `Shelf price is about ${differencePct}% above the median current listing price.` };
}
'''
new_verdict = '''function sealedMarketVerdict(shelfPrice, median, sampleCount) {
  if (!Number.isFinite(shelfPrice) || shelfPrice <= 0 || !Number.isFinite(median) || median <= 0 || sampleCount < 3) {
    return { verdict: "CHECK MANUALLY", reason: "Scout found too few competitive matching listings for a reliable price verdict." };
  }
  const ratio = shelfPrice / median;
  const differencePct = Math.round(Math.abs(1 - ratio) * 100);
  if (ratio <= 0.85) return { verdict: "GOOD BUY", reason: `Shelf price is about ${differencePct}% below the competitive current-listing median.` };
  if (ratio <= 1.10) return { verdict: "FAIR", reason: `Shelf price is within about ${differencePct}% of the competitive current-listing median.` };
  return { verdict: "PASS", reason: `Shelf price is about ${differencePct}% above the competitive current-listing median.` };
}

function sealedMarketCompetitiveSummary(listings) {
  const all = (Array.isArray(listings) ? listings : [])
    .filter(row => Number.isFinite(Number(row?.price)) && Number(row.price) > 0)
    .slice()
    .sort((a, b) => Number(a.price) - Number(b.price));
  if (!all.length) {
    return { median: null, low: null, high: null, sampleCount: 0, totalCleanCount: 0, listings: [] };
  }

  // Active asking-price pages often contain stale sellers priced far above the amount
  // a buyer can actually choose today. Use the cheapest ten clean single-unit matches
  // as the competitive market band, then take the median of that band. One unusually
  // cheap listing cannot control the result, while a wall of unrealistic high asks
  // cannot make an ordinary shelf price look like a bargain.
  const competitive = all.slice(0, Math.min(10, all.length));
  const prices = competitive.map(row => Number(row.price));
  const median = sealedMarketMedian(prices);
  return {
    median: Number.isFinite(median) ? Number(median.toFixed(2)) : null,
    low: prices.length ? Number(Math.min(...prices).toFixed(2)) : null,
    high: prices.length ? Number(Math.max(...prices).toFixed(2)) : null,
    sampleCount: competitive.length,
    totalCleanCount: all.length,
    listings: competitive.slice(0, 5),
  };
}
'''
worker = replace_once(worker, old_verdict, new_verdict, 'competitive verdict helper')

worker = replace_once(
    worker,
    'const cacheKey = `sealed:value:v2:${encodeURIComponent(query.toLowerCase()).slice(0, 300)}`;',
    'const cacheKey = `sealed:value:v3:${encodeURIComponent(query.toLowerCase()).slice(0, 300)}`;',
    'sealed market cache version',
)

old_cache = '''          const cached = await env.SCOUT_DATA.get(cacheKey, { type: "json" });
          if (cached?.query === query && Array.isArray(cached?.listings)) {
            const verdict = sealedMarketVerdict(shelfPrice, Number(cached.median), cached.listings.length);
            return json({ ok: true, version: VERSION, query, shelfPrice, ...cached, ...verdict, cacheHit: true, searchUsed: 0, marketplaceSearchesUsed: 0 }, 200, cors);
          }
'''
new_cache = '''          const cached = await env.SCOUT_DATA.get(cacheKey, { type: "json" });
          const cachedListings = Array.isArray(cached?.allListings) ? cached.allListings : (Array.isArray(cached?.listings) ? cached.listings : []);
          if (cached?.query === query && cachedListings.length) {
            const summary = sealedMarketCompetitiveSummary(cachedListings);
            const verdict = sealedMarketVerdict(shelfPrice, Number(summary.median), summary.sampleCount);
            return json({ ok: true, version: VERSION, query, shelfPrice, ...summary, checkedAt: cached.checkedAt || new Date().toISOString(), ...verdict, cacheHit: true, searchUsed: 0, marketplaceSearchesUsed: 0 }, 200, cors);
          }
'''
worker = replace_once(worker, old_cache, new_cache, 'cached competitive summary')

old_fresh = '''      const listings = sealedMarketResultRows(data, identity, lookupTitle);
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
'''
new_fresh = '''      const listings = sealedMarketResultRows(data, identity, lookupTitle);
      const summary = sealedMarketCompetitiveSummary(listings);
      const verdict = sealedMarketVerdict(shelfPrice, Number(summary.median), summary.sampleCount);
      const checkedAt = new Date().toISOString();
      const market = { query, ...summary, checkedAt };
      if (env.SCOUT_DATA && listings.length) {
        try { await env.SCOUT_DATA.put(cacheKey, JSON.stringify({ query, allListings: listings, checkedAt }), { expirationTtl: 6 * 60 * 60 }); } catch {}
      }
      return json({ ok: true, version: VERSION, shelfPrice, ...market, ...verdict, cacheHit: false, searchUsed: 1, marketplaceSearchesUsed: 1 }, 200, cors);
'''
worker = replace_once(worker, old_fresh, new_fresh, 'fresh competitive summary')
worker_path.write_text(worker, encoding='utf-8')

app_path = Path('sealed-product-scout.js')
app = app_path.read_text(encoding='utf-8')
old_render = '''    box.innerHTML=`<div class="section-eyebrow">SCOUT'S PRICE CHECK</div><div class="sealed-market-verdict">${esc(research.verdict)}</div><div class="sealed-market-meta">${esc(research.reason||"")}<br>Shelf: <strong>${money(research.shelfPrice)||"—"}</strong> · Current-listing median: <strong>${median}</strong> · Range: ${low}–${high} · ${Number(research.sampleCount||0)} clean match${Number(research.sampleCount||0)===1?"":"es"}.<br>${used} marketplace search${used===1?"":"es"} used${cached}. Current eBay asking prices, before shipping; not sold comps.</div>${rows?`<div class="sealed-market-list">${rows}</div>`:""}`;
'''
new_render = '''    const competitiveCount=Number(research.sampleCount||0),totalCleanCount=Number(research.totalCleanCount||competitiveCount);
    box.innerHTML=`<div class="section-eyebrow">SCOUT'S PRICE CHECK</div><div class="sealed-market-verdict">${esc(research.verdict)}</div><div class="sealed-market-meta">${esc(research.reason||"")}<br>Shelf: <strong>${money(research.shelfPrice)||"—"}</strong> · Competitive-listing median: <strong>${median}</strong> · Competitive range: ${low}–${high} · ${competitiveCount} competitive match${competitiveCount===1?"":"es"}${totalCleanCount>competitiveCount?` from ${totalCleanCount} clean listings`:""}.<br>${used} marketplace search${used===1?"":"es"} used${cached}. Current eBay asking prices, before shipping; not sold comps. Scout weights the lowest 10 clean single-unit matches so stale high asks do not inflate the verdict.</div>${rows?`<div class="sealed-market-list">${rows}</div>`:""}`;
'''
app = replace_once(app, old_render, new_render, 'market research display')
old_research = '''      const research={verdict:data.verdict||"CHECK MANUALLY",reason:data.reason||"",shelfPrice:Number(data.shelfPrice||shelfPrice),median:data.median,low:data.low,high:data.high,sampleCount:Number(data.sampleCount||0),listings:Array.isArray(data.listings)?data.listings:[],query:data.query||"",cacheHit:!!data.cacheHit,marketplaceSearchesUsed:Number(data.marketplaceSearchesUsed||0),checkedAt:data.checkedAt||new Date().toISOString()};
'''
new_research = '''      const research={verdict:data.verdict||"CHECK MANUALLY",reason:data.reason||"",shelfPrice:Number(data.shelfPrice||shelfPrice),median:data.median,low:data.low,high:data.high,sampleCount:Number(data.sampleCount||0),totalCleanCount:Number(data.totalCleanCount||data.sampleCount||0),listings:Array.isArray(data.listings)?data.listings:[],query:data.query||"",cacheHit:!!data.cacheHit,marketplaceSearchesUsed:Number(data.marketplaceSearchesUsed||0),checkedAt:data.checkedAt||new Date().toISOString()};
'''
app = replace_once(app, old_research, new_research, 'market research data handoff')
app_path.write_text(app, encoding='utf-8')

index_path = Path('index.html')
index = index_path.read_text(encoding='utf-8')
index = replace_once(index, 'sealed-product-scout.js?v=6.1.5', 'sealed-product-scout.js?v=6.1.6', 'sealed scanner cache version')
index_path.write_text(index, encoding='utf-8')

test_path = Path('tests/sealed-product-vision.test.cjs')
test = test_path.read_text(encoding='utf-8')
test = replace_once(test, 'assert.match(worker,/const VERSION = "3\\.38\\.2"/);', 'assert.match(worker,/const VERSION = "3\\.38\\.3"/);', 'test version')
test = replace_once(test, "assert.match(worker,/sealed:value:v2:/,'sealed market filter changes must invalidate stale cached results');", "assert.match(worker,/sealed:value:v3:/,'sealed market benchmark changes must invalidate stale cached results');", 'test cache version')
needle = "assert.match(worker,/sealedMarketIsMultiUnit/,'sealed market check must reject multi-box lots');\n"
extra = needle + "assert.match(worker,/sealedMarketCompetitiveSummary/,'sealed market check must use a competitive-price band');\nassert.match(worker,/Math\\.min\\(10, all\\.length\\)/,'competitive-price band must use at most ten lowest clean matches');\nassert.match(app,/Competitive-listing median/,'sealed market UI must label the competitive median clearly');\nassert.match(app,/totalCleanCount/,'sealed market UI must show competitive matches versus total clean listings');\n"
if 'competitive-price band must use at most ten lowest clean matches' not in test:
    test = replace_once(test, needle, extra, 'competitive pricing regression tests')
test_path.write_text(test, encoding='utf-8')
