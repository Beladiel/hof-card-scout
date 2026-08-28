from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing expected text for {label}")
    return text.replace(old, new, 1)

# ---------------- Worker ----------------
worker_path = Path('src/index.js')
worker = worker_path.read_text(encoding='utf-8')
worker = replace_once(worker, 'const VERSION = "3.38.3";', 'const VERSION = "3.38.4";', 'worker version')

helper_marker = '''function sealedBarcodeDigits(value) {\n'''
helpers = r'''const SEALED_RIP_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

function sealedRipProductLabel(identity, lookupTitle = "") {
  const year = String(identity?.year || "").trim();
  const set = String(identity?.set || "").trim();
  const type = String(identity?.boxType || identity?.productType || "").trim();
  const variant = String(identity?.variant || "").trim();
  return String(lookupTitle || [year, set, type, variant].filter(Boolean).join(" "))
    .replace(/\s+/g, " ").trim().slice(0, 220);
}

function sealedRipPriceScore(shelfPrice, median) {
  const shelf = Number(shelfPrice), market = Number(median);
  if (!Number.isFinite(shelf) || shelf <= 0 || !Number.isFinite(market) || market <= 0) return null;
  const ratio = shelf / market;
  if (ratio <= 0.75) return 100;
  if (ratio <= 0.85) return 92;
  if (ratio <= 0.95) return 82;
  if (ratio <= 1.05) return 72;
  if (ratio <= 1.10) return 62;
  if (ratio <= 1.20) return 45;
  return 25;
}

function sealedRipGrade(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return "—";
  if (n >= 90) return "A";
  if (n >= 82) return "A-";
  if (n >= 75) return "B+";
  if (n >= 68) return "B";
  if (n >= 60) return "B-";
  if (n >= 52) return "C+";
  if (n >= 44) return "C";
  if (n >= 36) return "C-";
  if (n >= 28) return "D";
  return "F";
}

function sealedRipFinalVerdict(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return "CHECK MANUALLY";
  if (n >= 82) return "BUY IT";
  if (n >= 70) return "BUY ONE";
  if (n >= 58) return "MAYBE";
  return "PASS";
}

function sealedRipWeightedScore(parts) {
  const available = [
    [Number(parts.priceScore), 35, Number.isFinite(Number(parts.priceScore))],
    [Number(parts.chaseScore), 30, Number.isFinite(Number(parts.chaseScore))],
    [Number(parts.pullScore), 20, Boolean(parts.pullEvidenceAvailable) && Number.isFinite(Number(parts.pullScore))],
    [Number(parts.sentimentScore), 15, Boolean(parts.sentimentEvidenceAvailable) && Number.isFinite(Number(parts.sentimentScore))],
  ].filter(row => row[2]);
  const weight = available.reduce((sum, row) => sum + row[1], 0);
  if (!weight) return null;
  return Math.round(available.reduce((sum, row) => sum + row[0] * row[1], 0) / weight);
}

function sealedRipQualityScore(parts) {
  const available = [
    [Number(parts.chaseScore), 30, Number.isFinite(Number(parts.chaseScore))],
    [Number(parts.pullScore), 20, Boolean(parts.pullEvidenceAvailable) && Number.isFinite(Number(parts.pullScore))],
    [Number(parts.sentimentScore), 15, Boolean(parts.sentimentEvidenceAvailable) && Number.isFinite(Number(parts.sentimentScore))],
  ].filter(row => row[2]);
  const weight = available.reduce((sum, row) => sum + row[1], 0);
  if (!weight) return null;
  return Math.round(available.reduce((sum, row) => sum + row[0] * row[1], 0) / weight);
}

function sealedRipSourceType(row) {
  const link = String(row?.link || "").toLowerCase();
  const source = String(row?.source || "").toLowerCase();
  const text = `${link} ${source}`;
  if (/topps\.com|paniniamerica\.net|pokemon\.com|magic\.wizards\.com|wizards\.com/.test(text)) return "official";
  if (/reddit\.com|blowoutforums\.com|sportscardforum\.com|elitefourum\.com/.test(text)) return "community";
  if (/checklist|beckett|cardboardconnection|cardboardconnection|tcgplayer|sportscollectorsdaily/.test(text)) return "checklist/editorial";
  return "editorial";
}

function sealedRipIsShoppingSource(row) {
  const text = `${row?.link || ""} ${row?.source || ""} ${row?.title || ""}`.toLowerCase();
  return /ebay\.|amazon\.|walmart\.|target\.|bestbuy\.|mercari\.|whatnot\.|fanatics\.com\/.*(?:product|shop)|etsy\./.test(text);
}

function sealedRipEvidenceRows(data, queryKind) {
  const rows = Array.isArray(data?.organic_results) ? data.organic_results : [];
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const title = String(row?.title || "").trim();
    const link = String(row?.link || "").trim();
    const snippet = String(row?.snippet || row?.snippet_highlighted_words?.join(" ") || "").trim();
    if (!title || !/^https?:\/\//i.test(link) || sealedRipIsShoppingSource(row)) continue;
    const key = link.replace(/[?#].*$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      title: title.slice(0, 220),
      link: link.slice(0, 500),
      snippet: snippet.slice(0, 900),
      source: String(row?.source || "").trim().slice(0, 120),
      sourceType: sealedRipSourceType(row),
      queryKind,
    });
    if (out.length >= 8) break;
  }
  return out;
}

async function sealedRipGoogleSearch(query, apiKey) {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("num", "10");
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "us");
  url.searchParams.set("api_key", apiKey);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.error) throw new Error("research_search_failed");
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function sealedRipAiJson(raw) {
  let value = raw?.response ?? raw?.result ?? raw?.answer ?? raw;
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  let text = String(value || "").trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) text = text.slice(first, last + 1);
  return JSON.parse(text);
}

function sealedRipClampScore(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}

function sealedRipOddsSupported(odds, evidenceText) {
  const raw = String(odds || "").trim();
  if (!raw) return false;
  const simplify = value => String(value || "").toLowerCase().replace(/\s+/g, "").replace(/[–—]/g, "-");
  return simplify(evidenceText).includes(simplify(raw));
}

function sealedRipNormalize(raw, evidenceRows, market) {
  const evidenceText = evidenceRows.map(row => `${row.title} ${row.snippet}`).join("\n");
  const chaseCards = (Array.isArray(raw?.chaseCards) ? raw.chaseCards : []).slice(0, 5).map(row => ({
    name: String(row?.name || "").trim().slice(0, 140),
    why: String(row?.why || "").trim().slice(0, 240),
  })).filter(row => row.name);
  const pullOdds = (Array.isArray(raw?.pullOdds) ? raw.pullOdds : []).slice(0, 8).map(row => ({
    item: String(row?.item || "").trim().slice(0, 160),
    odds: String(row?.odds || "").trim().slice(0, 80),
    sourceType: String(row?.sourceType || "reported").trim().slice(0, 50),
    note: String(row?.note || "").trim().slice(0, 260),
  })).filter(row => row.item && row.odds && sealedRipOddsSupported(row.odds, evidenceText));

  const pullEvidenceAvailable = Boolean(raw?.pullEvidenceAvailable) && pullOdds.length > 0;
  const sentimentEvidenceAvailable = Boolean(raw?.sentimentEvidenceAvailable);
  const priceScore = sealedRipPriceScore(market?.shelfPrice, market?.median);
  const parts = {
    priceScore,
    chaseScore: sealedRipClampScore(raw?.chaseScore),
    pullScore: sealedRipClampScore(raw?.pullScore),
    pullEvidenceAvailable,
    sentimentScore: sealedRipClampScore(raw?.sentimentScore),
    sentimentEvidenceAvailable,
  };
  const overallScore = sealedRipWeightedScore(parts);
  const ripScore = sealedRipQualityScore(parts);
  const confidenceRaw = String(raw?.confidence || "low").toLowerCase();
  return {
    overallScore,
    finalVerdict: sealedRipFinalVerdict(overallScore),
    ripScore,
    ripGrade: sealedRipGrade(ripScore),
    priceScore,
    chaseScore: parts.chaseScore,
    pullScore: pullEvidenceAvailable ? parts.pullScore : null,
    pullEvidenceAvailable,
    sentimentScore: sentimentEvidenceAvailable ? parts.sentimentScore : null,
    sentimentEvidenceAvailable,
    sentimentLabel: sentimentEvidenceAvailable ? String(raw?.sentimentLabel || "mixed").slice(0, 40) : "unknown",
    qualitySummary: String(raw?.qualitySummary || "").trim().slice(0, 700),
    chaseCards,
    pullOdds,
    collectorTake: String(raw?.collectorTake || "").trim().slice(0, 700),
    positives: (Array.isArray(raw?.positives) ? raw.positives : []).map(x => String(x || "").trim().slice(0, 220)).filter(Boolean).slice(0, 4),
    negatives: (Array.isArray(raw?.negatives) ? raw.negatives : []).map(x => String(x || "").trim().slice(0, 220)).filter(Boolean).slice(0, 4),
    confidence: ["high", "medium", "low"].includes(confidenceRaw) ? confidenceRaw : "low",
  };
}

function sealedBarcodeDigits(value) {
'''
worker = replace_once(worker, helper_marker, helpers, 'rip quality helpers')

route_marker = '''    if (url.pathname === "/sealed/classify-type" && request.method === "POST") {\n'''
rip_route = r'''    if (url.pathname === "/sealed/rip-quality" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SERPAPI_KEY || !env.AI) {
        return json({ ok: false, error: "rip_research_not_configured", message: "Scout's rip-quality research is not configured on the Worker.", researchSearchesUsed: 0, marketplaceSearchesUsed: 0 }, 503, cors);
      }
      let body = {};
      try { body = await request.json(); }
      catch { return json({ ok: false, error: "bad_json", message: "Scout could not read that rip-quality request.", researchSearchesUsed: 0, marketplaceSearchesUsed: 0 }, 400, cors); }

      const identity = body?.identity && typeof body.identity === "object" ? body.identity : {};
      const lookupTitle = String(body?.lookupTitle || "").trim().slice(0, 220);
      const productLabel = sealedRipProductLabel(identity, lookupTitle);
      const market = body?.market && typeof body.market === "object" ? {
        shelfPrice: Number(body.market.shelfPrice),
        median: Number(body.market.median),
        verdict: String(body.market.verdict || "").slice(0, 40),
      } : {};
      if (!productLabel || !String(identity?.productType || identity?.boxType || "").trim()) {
        return json({ ok: false, error: "missing_identity", message: "Confirm the exact sealed product before checking rip quality.", researchSearchesUsed: 0, marketplaceSearchesUsed: 0 }, 400, cors);
      }
      if (!Number.isFinite(market.shelfPrice) || market.shelfPrice <= 0 || !Number.isFinite(market.median) || market.median <= 0) {
        return json({ ok: false, error: "missing_market", message: "Run the market-price check first so Scout can combine price and rip quality.", researchSearchesUsed: 0, marketplaceSearchesUsed: 0 }, 400, cors);
      }

      const cacheKey = `sealed:rip:v1:${encodeURIComponent(productLabel.toLowerCase()).slice(0, 300)}`;
      if (env.SCOUT_DATA) {
        try {
          const cached = await env.SCOUT_DATA.get(cacheKey, { type: "json" });
          if (cached?.productLabel === productLabel && cached?.analysis) {
            const analysis = sealedRipNormalize(cached.analysis, Array.isArray(cached.evidenceRows) ? cached.evidenceRows : [], market);
            return json({ ok: true, version: VERSION, productLabel, market, analysis, sources: cached.sources || [], checkedAt: cached.checkedAt || new Date().toISOString(), cacheHit: true, researchSearchesUsed: 0, marketplaceSearchesUsed: 0 }, 200, cors);
          }
        } catch {}
      }

      const checklistQuery = `${productLabel} checklist odds chase cards rookies parallels autograph retail`;
      const communityQuery = `${productLabel} pulls review reddit collector quality`;
      let checklistData = {}, communityData = {};
      let researchSearchesUsed = 0;
      try {
        const results = await Promise.allSettled([
          sealedRipGoogleSearch(checklistQuery, env.SERPAPI_KEY),
          sealedRipGoogleSearch(communityQuery, env.SERPAPI_KEY),
        ]);
        researchSearchesUsed = 2;
        if (results[0].status === "fulfilled") checklistData = results[0].value;
        if (results[1].status === "fulfilled") communityData = results[1].value;
      } catch {}

      const evidenceRows = [
        ...sealedRipEvidenceRows(checklistData, "checklist-and-odds"),
        ...sealedRipEvidenceRows(communityData, "collector-reports"),
      ];
      if (evidenceRows.length < 2) {
        return json({ ok: false, error: "rip_research_too_thin", message: "Scout could not find enough trustworthy product-specific rip information yet. Try again later or judge this one manually.", researchSearchesUsed, marketplaceSearchesUsed: 0 }, 502, cors);
      }

      const sources = evidenceRows.slice(0, 10).map(row => ({ title: row.title, link: row.link, sourceType: row.sourceType, queryKind: row.queryKind }));
      const evidenceForPrompt = evidenceRows.slice(0, 14).map((row, index) =>
        `[${index + 1}] TYPE=${row.sourceType}; SEARCH=${row.queryKind}; TITLE=${row.title}; SOURCE=${row.source}; URL=${row.link}; SNIPPET=${row.snippet}`
      ).join("\n\n").slice(0, 15000);

      const schema = {
        type: "object",
        properties: {
          qualitySummary: { type: "string" },
          chaseScore: { type: "number" },
          pullScore: { type: "number" },
          pullEvidenceAvailable: { type: "boolean" },
          sentimentScore: { type: "number" },
          sentimentEvidenceAvailable: { type: "boolean" },
          sentimentLabel: { type: "string", enum: ["positive", "mixed", "negative", "unknown"] },
          chaseCards: { type: "array", items: { type: "object", properties: { name: { type: "string" }, why: { type: "string" } }, required: ["name", "why"] }, maxItems: 5 },
          pullOdds: { type: "array", items: { type: "object", properties: { item: { type: "string" }, odds: { type: "string" }, sourceType: { type: "string" }, note: { type: "string" } }, required: ["item", "odds", "sourceType", "note"] }, maxItems: 8 },
          collectorTake: { type: "string" },
          positives: { type: "array", items: { type: "string" }, maxItems: 4 },
          negatives: { type: "array", items: { type: "string" }, maxItems: 4 },
          confidence: { type: "string", enum: ["high", "medium", "low"] }
        },
        required: ["qualitySummary", "chaseScore", "pullScore", "pullEvidenceAvailable", "sentimentScore", "sentimentEvidenceAvailable", "sentimentLabel", "chaseCards", "pullOdds", "collectorTake", "positives", "negatives", "confidence"]
      };
      const prompt = `You are evaluating whether a collector should OPEN/RIP an exact sealed trading-card product, not whether it is good for sealed resale. Product: ${productLabel}. Exact format: ${String(identity?.productType || identity?.boxType || "")}. Category: ${String(identity?.category || "")}. Year: ${String(identity?.year || "")}. Set: ${String(identity?.set || "")}.

Use ONLY the research evidence below. Do not rely on memory. NEVER invent, estimate, calculate, or extrapolate an exact pull odd. Only include an odds string in pullOdds when that exact odds text is literally supported by the supplied evidence and applies to this exact product format. If reliable format-specific odds are not supported, set pullEvidenceAvailable=false and return an empty pullOdds array. Clearly distinguish official/checklist odds from community-reported observations; community anecdotes are not official odds.

Score chaseScore 0-100 for breadth and quality of meaningful rookies, stars, inserts, case hits, autographs, numbered/color parallels, and format exclusives. Do not give a high chase score solely because one nearly impossible jackpot exists. Score pullScore 0-100 only when the evidence supports a realistic assessment for this exact format; otherwise set pullEvidenceAvailable=false. For collector sentiment, summarize recurring product-specific themes rather than one lucky or angry opening. Set sentimentEvidenceAvailable=false if there is not enough community/review evidence. Note recurring quality-control, collation, damage, or repetitive-base complaints in negatives. Keep conclusions conservative when evidence is thin.

Research evidence:\n${evidenceForPrompt}`;

      let rawAnalysis;
      try {
        rawAnalysis = await env.AI.run(SEALED_RIP_MODEL, {
          prompt,
          max_tokens: 1400,
          temperature: 0.1,
          response_format: { type: "json_schema", json_schema: schema }
        });
      } catch (err) {
        console.error("sealed rip quality AI failed", err);
        return json({ ok: false, error: "rip_analysis_failed", message: "Scout found the research but could not finish the rip-quality analysis right now.", researchSearchesUsed, marketplaceSearchesUsed: 0 }, 502, cors);
      }

      let aiObject;
      try { aiObject = sealedRipAiJson(rawAnalysis); }
      catch {
        return json({ ok: false, error: "rip_analysis_parse_failed", message: "Scout could not safely interpret the rip-quality research right now.", researchSearchesUsed, marketplaceSearchesUsed: 0 }, 502, cors);
      }
      const analysis = sealedRipNormalize(aiObject, evidenceRows, market);
      const checkedAt = new Date().toISOString();
      if (env.SCOUT_DATA) {
        try { await env.SCOUT_DATA.put(cacheKey, JSON.stringify({ productLabel, analysis: aiObject, evidenceRows, sources, checkedAt }), { expirationTtl: 24 * 60 * 60 }); } catch {}
      }
      return json({ ok: true, version: VERSION, productLabel, market, analysis, sources, checkedAt, cacheHit: false, researchSearchesUsed, marketplaceSearchesUsed: 0 }, 200, cors);
    }

    if (url.pathname === "/sealed/classify-type" && request.method === "POST") {
'''
worker = replace_once(worker, route_marker, rip_route, 'rip quality route')
worker_path.write_text(worker, encoding='utf-8')

# ---------------- Frontend ----------------
app_path = Path('sealed-product-scout.js')
app = app_path.read_text(encoding='utf-8')

css_old = '''      .sealed-next{opacity:1}.sealed-next strong{color:var(--gold)}\n'''
css_new = '''      .sealed-rip-result{margin-top:12px;border:1px solid rgba(86,197,138,.38);border-radius:16px;padding:12px;background:linear-gradient(145deg,rgba(86,197,138,.09),rgba(230,189,99,.05))}.sealed-rip-result[hidden]{display:none}.sealed-final-verdict{font-size:28px;font-weight:950;line-height:1.05;margin-top:3px}.sealed-score-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:10px}.sealed-score{border:1px solid var(--line);border-radius:12px;padding:8px;background:rgba(0,0,0,.08)}.sealed-score-label{font-size:8px;color:var(--muted);font-weight:950;letter-spacing:.08em}.sealed-score-value{font-size:17px;font-weight:950;margin-top:3px}.sealed-rip-section{margin-top:12px;padding-top:10px;border-top:1px solid var(--line)}.sealed-rip-section-title{font-size:10px;font-weight:950;letter-spacing:.1em;color:var(--gold)}.sealed-rip-copy{font-size:11px;line-height:1.55;color:var(--muted);margin-top:5px}.sealed-rip-list{display:grid;gap:6px;margin-top:7px}.sealed-rip-item{font-size:11px;line-height:1.45}.sealed-rip-item strong{color:var(--text)}.sealed-rip-sources a{color:var(--gold);text-decoration:none}.sealed-rip-note{font-size:9px;color:var(--muted);line-height:1.45;margin-top:10px}.sealed-next{opacity:1}.sealed-next strong{color:var(--gold)}\n'''
app = replace_once(app, css_old, css_new, 'rip quality styles')

card_old = '''          <div class="sealed-market-result" id="sealedMarketResult" hidden></div>\n        </div>\n      </div>\n    </section>`;'''
card_new = '''          <div class="sealed-market-result" id="sealedMarketResult" hidden></div>\n        </div>\n\n        <div class="sealed-card sealed-next" id="sealedRipCard">\n          <div class="section-eyebrow">STEP 4 · IS IT WORTH RIPPING?</div>\n          <div class="sealed-card-title">A fair price can still be a bad box.</div>\n          <div class="sealed-card-sub">Scout researches the chase cards, trustworthy pull odds for this exact format, and recurring collector reports. It then combines rip quality with the price you just checked. Fresh analysis uses at most 2 research searches and 0 marketplace searches; cached analysis uses 0.</div>\n          <div class="sealed-actions one"><button type="button" class="primary" id="sealedRipResearchBtn">🎯 CHECK RIP QUALITY · 2 RESEARCH SEARCHES MAX</button></div>\n          <div class="sealed-status" id="sealedRipStatus">Run the market-price check first, then Scout can judge whether opening this product is actually worth it.</div>\n          <div class="sealed-rip-result" id="sealedRipResult" hidden></div>\n        </div>\n      </div>\n    </section>`;'''
app = replace_once(app, card_old, card_new, 'step 4 card')

render_marker = '''  async function runValueResearch(){\n'''
render_code = r'''  function renderRipQuality(result){
    const box=byId("sealedRipResult");if(!box)return;
    if(!result||!result.analysis){box.hidden=true;box.innerHTML="";return;}
    const a=result.analysis||{},sources=Array.isArray(result.sources)?result.sources:[];
    const score=v=>Number.isFinite(Number(v))?String(Math.round(Number(v))):"N/A";
    const chase=(Array.isArray(a.chaseCards)?a.chaseCards:[]).map(row=>`<div class="sealed-rip-item"><strong>${esc(row.name||"")}</strong>${row.why?` — ${esc(row.why)}`:""}</div>`).join("");
    const odds=(Array.isArray(a.pullOdds)?a.pullOdds:[]).map(row=>`<div class="sealed-rip-item"><strong>${esc(row.item||"")}</strong> · ${esc(row.odds||"")}${row.sourceType?` · ${esc(row.sourceType)}`:""}${row.note?`<br>${esc(row.note)}`:""}</div>`).join("");
    const positives=(Array.isArray(a.positives)?a.positives:[]).map(x=>`<div class="sealed-rip-item">✓ ${esc(x)}</div>`).join("");
    const negatives=(Array.isArray(a.negatives)?a.negatives:[]).map(x=>`<div class="sealed-rip-item">⚠ ${esc(x)}</div>`).join("");
    const sourceRows=sources.slice(0,8).map(row=>{const link=/^https?:\/\//i.test(String(row.link||""))?String(row.link):"";return link?`<div class="sealed-rip-item"><a href="${esc(link)}" target="_blank" rel="noopener">${esc(row.title||"Research source")}</a> · ${esc(row.sourceType||"source")}</div>`:"";}).join("");
    const searches=Number(result.researchSearchesUsed||0),cached=result.cacheHit?" · cached result":"";
    const pullBlock=a.pullEvidenceAvailable&&odds?odds:`<div class="sealed-rip-copy">Scout did not find reliable exact-format pull odds, so pull odds were not scored. No made-up odds.</div>`;
    const sentiment=a.sentimentEvidenceAvailable?(a.collectorTake?esc(a.collectorTake):"Collector evidence found."):`Scout did not find enough recurring collector reports to score sentiment confidently.`;
    box.hidden=false;
    box.innerHTML=`<div class="section-eyebrow">SCOUT'S FINAL VERDICT</div><div class="sealed-final-verdict">${esc(a.finalVerdict||"CHECK MANUALLY")}</div><div class="sealed-rip-copy">Overall score: <strong>${score(a.overallScore)}/100</strong> · Rip Quality: <strong>${esc(a.ripGrade||"—")}</strong>${a.qualitySummary?`<br>${esc(a.qualitySummary)}`:""}</div><div class="sealed-score-grid"><div class="sealed-score"><div class="sealed-score-label">PRICE</div><div class="sealed-score-value">${score(a.priceScore)}</div></div><div class="sealed-score"><div class="sealed-score-label">CHASES</div><div class="sealed-score-value">${score(a.chaseScore)}</div></div><div class="sealed-score"><div class="sealed-score-label">PULL ODDS</div><div class="sealed-score-value">${a.pullEvidenceAvailable?score(a.pullScore):"N/A"}</div></div><div class="sealed-score"><div class="sealed-score-label">COLLECTORS</div><div class="sealed-score-value">${a.sentimentEvidenceAvailable?score(a.sentimentScore):"N/A"}</div></div></div><div class="sealed-rip-section"><div class="sealed-rip-section-title">🎯 TOP CHASES</div><div class="sealed-rip-list">${chase||'<div class="sealed-rip-copy">No well-supported chase list found yet.</div>'}</div></div><div class="sealed-rip-section"><div class="sealed-rip-section-title">🎲 PULL ODDS</div><div class="sealed-rip-list">${pullBlock}</div></div><div class="sealed-rip-section"><div class="sealed-rip-section-title">💬 WHAT COLLECTORS ARE SAYING</div><div class="sealed-rip-copy">${sentiment}</div>${positives?`<div class="sealed-rip-list">${positives}</div>`:""}${negatives?`<div class="sealed-rip-list">${negatives}</div>`:""}</div>${sourceRows?`<div class="sealed-rip-section sealed-rip-sources"><div class="sealed-rip-section-title">🔗 RESEARCH SOURCES</div><div class="sealed-rip-list">${sourceRows}</div></div>`:""}<div class="sealed-rip-note">${searches} research search${searches===1?"":"es"} used${cached} · 0 marketplace searches. Official/checklist odds are kept separate from community observations. Opening is still chance; a strong chase list does not guarantee value in one box.</div>`;
  }

  async function runRipQuality(){
    const draft=readDraft(),status=byId("sealedRipStatus"),btn=byId("sealedRipResearchBtn");
    if(!draft.confirmed||!draft.identity){status.className="sealed-status warn";status.textContent="Confirm the exact product first.";return;}
    if(!draft.marketResearch||!Number(draft.marketResearch.median)){status.className="sealed-status warn";status.textContent="Run CHECK MARKET VALUE first so Scout can combine price and rip quality.";byId("sealedResearchPreviewBtn")?.scrollIntoView({behavior:"smooth",block:"center"});return;}
    const cfg=typeof pricingConfig==="function"?pricingConfig():{endpoint:"",accessKey:""};
    if(!cfg.endpoint||!cfg.accessKey){status.className="sealed-status warn";status.textContent="Scout's live connection is not configured on this device.";return;}
    btn.disabled=true;btn.textContent="🎯 SCOUT IS RESEARCHING THE RIP…";status.className="sealed-status";status.textContent="Checking chase cards, exact-format pull odds, and recurring collector reports. Up to 2 research searches; 0 marketplace searches.";
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
    finally{btn.disabled=false;btn.textContent="🎯 CHECK RIP QUALITY · 2 RESEARCH SEARCHES MAX";}
  }

  async function runValueResearch(){
'''
app = replace_once(app, render_marker, render_code, 'rip quality render and action')

# State invalidation and restoration.
app = replace_once(app, 'renderConfirmed(draft);renderMarketResearch(draft.marketResearch);', 'renderConfirmed(draft);renderMarketResearch(draft.marketResearch);renderRipQuality(draft.ripQuality);', 'restore rip result')
app = app.replace('marketResearch:null});', 'marketResearch:null,ripQuality:null});')
app = app.replace('marketResearch:null});\n', 'marketResearch:null,ripQuality:null});\n')
# Avoid double insertion from both patterns.
app = app.replace('ripQuality:null,ripQuality:null', 'ripQuality:null')
app = replace_once(app, 'saveDraft({marketResearch:research});renderMarketResearch(research);', 'saveDraft({marketResearch:research,ripQuality:null});renderMarketResearch(research);renderRipQuality(null);', 'market result invalidates rip result')
app = replace_once(app, 'renderConfirmed({});renderMarketResearch(null);', 'renderConfirmed({});renderMarketResearch(null);renderRipQuality(null);', 'start over rip reset')
app = replace_once(app, 'byId("sealedResearchPreviewBtn").addEventListener("click",runValueResearch);', 'byId("sealedResearchPreviewBtn").addEventListener("click",runValueResearch);\n    byId("sealedRipResearchBtn").addEventListener("click",runRipQuality);', 'rip quality event')
app_path.write_text(app, encoding='utf-8')

# ---------------- Cache bust ----------------
index_path = Path('index.html')
index = index_path.read_text(encoding='utf-8')
index = replace_once(index, 'sealed-product-scout.js?v=6.1.6', 'sealed-product-scout.js?v=6.1.7', 'sealed scanner cache tag')
index_path.write_text(index, encoding='utf-8')

# ---------------- Regression tests ----------------
test_path = Path('tests/sealed-product-vision.test.cjs')
test = test_path.read_text(encoding='utf-8')
test = replace_once(test, 'assert.match(worker,/const VERSION = "3\\.38\\.3"/);', 'assert.match(worker,/const VERSION = "3\\.38\\.4"/);', 'test worker version')
test = replace_once(test, "assert.match(worker,/\\/sealed\\/value-check/,'sealed market value endpoint must exist');", "assert.match(worker,/\\/sealed\\/value-check/,'sealed market value endpoint must exist');\nassert.match(worker,/\\/sealed\\/rip-quality/,'sealed rip-quality endpoint must exist');", 'rip route endpoint test')
test = replace_once(test, "assert.match(app,/totalCleanCount/,'sealed market UI must show competitive matches versus total clean listings');", "assert.match(app,/totalCleanCount/,'sealed market UI must show competitive matches versus total clean listings');\nassert.match(app,/CHECK RIP QUALITY · 2 RESEARCH SEARCHES MAX/,'sealed scanner must expose rip-quality research');\nassert.match(app,/sealed\\/rip-quality/,'front end must call rip-quality endpoint');\nassert.match(app,/SCOUT'S FINAL VERDICT/,'rip-quality result must show a final verdict');\nassert.match(app,/TOP CHASES/,'rip-quality result must explain chase cards');\nassert.match(app,/PULL ODDS/,'rip-quality result must show pull odds or explain their absence');\nassert.match(app,/WHAT COLLECTORS ARE SAYING/,'rip-quality result must summarize collector feedback');", 'rip UI tests')
test = replace_once(test, "const marketRouteEnd=worker.indexOf('url.pathname === \"/sealed/classify-type\"',marketRouteStart);", "const marketRouteEnd=worker.indexOf('url.pathname === \"/sealed/rip-quality\"',marketRouteStart);", 'market route end')
insert_before = '''const typeRouteStart=worker.indexOf('url.pathname === "/sealed/classify-type"');\n'''
rip_tests = '''const ripRouteStart=worker.indexOf('url.pathname === "/sealed/rip-quality"');
const ripRouteEnd=worker.indexOf('url.pathname === "/sealed/classify-type"',ripRouteStart);
const ripRoute=worker.slice(ripRouteStart,ripRouteEnd);
assert.ok(ripRouteStart>=0&&ripRouteEnd>ripRouteStart,'rip-quality route should be isolated before type classifier');
assert.match(ripRoute,/SERPAPI_KEY/,'rip-quality route should require research search access');
assert.ok(ripRoute.includes('engine", "google"'),'rip-quality route must use Google research searches');
assert.match(ripRoute,/researchSearchesUsed:\s*2|researchSearchesUsed\s*=\s*2/,'fresh rip research must use at most two planned research searches');
assert.match(ripRoute,/marketplaceSearchesUsed:\s*0/,'rip-quality research must use zero marketplace searches');
assert.doesNotMatch(ripRoute,/engine\", \"ebay|APIFY_TOKEN|CARD_API_KEY/i,'rip-quality route must not spend marketplace-provider calls');
assert.ok(worker.includes('@cf/meta/llama-3.3-70b-instruct-fp8-fast'),'rip-quality synthesis must use the Cloudflare text model');
assert.ok(worker.includes('NEVER invent, estimate, calculate, or extrapolate an exact pull odd'),'rip-quality prompt must prohibit invented pull odds');
assert.match(worker,/sealed:rip:v1:/,'rip-quality research must be cached');
assert.match(worker,/sealedRipWeightedScore/,'final verdict must combine price, chases, pull evidence, and sentiment');

const typeRouteStart=worker.indexOf('url.pathname === "/sealed/classify-type"');
'''
test = replace_once(test, insert_before, rip_tests, 'rip route regression tests')
test_path.write_text(test, encoding='utf-8')
