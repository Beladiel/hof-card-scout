from pathlib import Path
import re


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing expected text for {label}")
    return text.replace(old, new, 1)


def regex_replace_once(text, pattern, repl, label, flags=re.S):
    out, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"Expected one regex match for {label}; got {count}")
    return out

worker_path = Path('src/index.js')
worker = worker_path.read_text(encoding='utf-8')
worker = replace_once(worker, 'const VERSION = "3.38.4";', 'const VERSION = "3.38.5";', 'worker version')
worker = replace_once(worker, 'sealed:rip:v1:', 'sealed:rip:v2:', 'rip cache version')

# Make missing chase evidence a hard stop for BUY recommendations rather than
# silently reweighting a generic AI chase score.
worker = regex_replace_once(
    worker,
    r'''function sealedRipGrade\(score\) \{.*?\n\}\n\nfunction sealedRipFinalVerdict\(score\) \{.*?\n\}\n\nfunction sealedRipWeightedScore\(parts\) \{.*?\n\}\n\nfunction sealedRipQualityScore\(parts\) \{.*?\n\}''',
    r'''function sealedRipGrade(score) {
  if (score === null || score === undefined || score === "") return "—";
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

function sealedRipFinalVerdict(score, parts = {}) {
  if (!parts.chaseEvidenceAvailable) return "NEED MORE DATA";
  if (!parts.pullEvidenceAvailable && !parts.sentimentEvidenceAvailable) return "NEED MORE DATA";
  const n = Number(score);
  if (!Number.isFinite(n)) return "NEED MORE DATA";
  if (n >= 82) return "BUY IT";
  if (n >= 70) return "BUY ONE";
  if (n >= 58) return "MAYBE";
  return "PASS";
}

function sealedRipWeightedScore(parts) {
  if (!parts.chaseEvidenceAvailable) return null;
  const available = [
    [Number(parts.priceScore), 35, parts.priceScore !== null && parts.priceScore !== undefined && Number.isFinite(Number(parts.priceScore))],
    [Number(parts.chaseScore), 30, Boolean(parts.chaseEvidenceAvailable) && Number.isFinite(Number(parts.chaseScore))],
    [Number(parts.pullScore), 20, Boolean(parts.pullEvidenceAvailable) && Number.isFinite(Number(parts.pullScore))],
    [Number(parts.sentimentScore), 15, Boolean(parts.sentimentEvidenceAvailable) && Number.isFinite(Number(parts.sentimentScore))],
  ].filter(row => row[2]);
  const weight = available.reduce((sum, row) => sum + row[1], 0);
  if (!weight) return null;
  return Math.round(available.reduce((sum, row) => sum + row[0] * row[1], 0) / weight);
}

function sealedRipQualityScore(parts) {
  if (!parts.chaseEvidenceAvailable) return null;
  const available = [
    [Number(parts.chaseScore), 30, Boolean(parts.chaseEvidenceAvailable) && Number.isFinite(Number(parts.chaseScore))],
    [Number(parts.pullScore), 20, Boolean(parts.pullEvidenceAvailable) && Number.isFinite(Number(parts.pullScore))],
    [Number(parts.sentimentScore), 15, Boolean(parts.sentimentEvidenceAvailable) && Number.isFinite(Number(parts.sentimentScore))],
  ].filter(row => row[2]);
  const weight = available.reduce((sum, row) => sum + row[1], 0);
  if (!weight) return null;
  return Math.round(available.reduce((sum, row) => sum + row[0] * row[1], 0) / weight);
}''',
    'rip scoring guardrails',
)

# Enrich search snippets with relevant text from high-quality source pages and
# keep research tied to the exact set/product family.
helper_marker = 'function sealedRipAiJson(raw) {'
helpers = r'''function sealedRipCommunitySite(category) {
  const value = String(category || "").toLowerCase();
  if (value === "basketball") return "site:reddit.com/r/basketballcards";
  if (value === "baseball") return "site:reddit.com/r/baseballcards";
  if (value === "football") return "site:reddit.com/r/footballcards";
  if (value.includes("pok")) return "site:reddit.com/r/PokemonTCG";
  if (value.includes("magic")) return "site:reddit.com/r/magicTCG";
  return "site:reddit.com";
}

function sealedRipFormatTerms(identity) {
  const type = String(identity?.productType || identity?.boxType || "").trim().toLowerCase();
  if (type.includes("blaster")) return '("blaster" OR "value box")';
  if (type.includes("mega")) return '"mega box"';
  if (type.includes("hanger")) return 'hanger';
  if (type.includes("hobby")) return '"hobby box"';
  if (type.includes("elite trainer")) return '("elite trainer box" OR ETB)';
  if (type.includes("booster")) return `"${type}"`;
  return type ? `"${type}"` : "retail";
}

function sealedRipSetKeywords(identity) {
  const stop = new Set(["topps", "panini", "upper", "deck", "pokemon", "pokémon", "magic", "gathering", "nba", "nfl", "mlb", "basketball", "baseball", "football", "cards", "card", "trading", "the", "and"]);
  return String(identity?.set || "").toLowerCase().match(/[a-z0-9]+/g)?.filter(token => token.length >= 3 && !stop.has(token)) || [];
}

function sealedRipFilterRelevantEvidence(rows, identity) {
  const tokens = sealedRipSetKeywords(identity);
  if (!tokens.length) return Array.isArray(rows) ? rows : [];
  return (Array.isArray(rows) ? rows : []).filter(row => {
    const text = `${row?.title || ""} ${row?.snippet || ""} ${row?.link || ""}`.toLowerCase();
    return tokens.every(token => text.includes(token));
  });
}

function sealedRipDecodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function sealedRipPageExcerpt(html) {
  let text = String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  text = sealedRipDecodeHtml(text).replace(/\s+/g, " ").trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  const needles = ["1:", "odds", "blaster", "value box", "rookie", "signature", "autograph", "case hit", "parallel", "exclusive", "short print", "ssp"];
  const chunks = [];
  const used = new Set();
  for (const needle of needles) {
    let from = 0;
    let hits = 0;
    while (hits < 4) {
      const at = lower.indexOf(needle, from);
      if (at < 0) break;
      const start = Math.max(0, at - 700);
      const end = Math.min(text.length, at + 1500);
      const key = `${Math.floor(start / 500)}:${Math.floor(end / 500)}`;
      if (!used.has(key)) {
        used.add(key);
        chunks.push(text.slice(start, end));
      }
      from = at + needle.length;
      hits++;
    }
  }
  return (chunks.length ? chunks.join("\n---\n") : text.slice(0, 5000)).slice(0, 9000);
}

async function sealedRipFetchPageText(row) {
  if (!row || row.sourceType === "community" || !/^https?:\/\//i.test(String(row.link || ""))) return "";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(row.link, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 HOF-Card-Scout/1.0", "Accept": "text/html,application/xhtml+xml" },
    });
    if (!response.ok) return "";
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml")) return "";
    const html = (await response.text()).slice(0, 900000);
    return sealedRipPageExcerpt(html);
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function sealedRipExpandEvidenceRows(rows) {
  const list = Array.isArray(rows) ? rows.slice(0, 14) : [];
  const fetchable = list.map((row, index) => ({ row, index })).filter(x => x.row.sourceType !== "community").slice(0, 4);
  const expanded = await Promise.all(fetchable.map(async ({ row, index }) => ({ index, pageText: await sealedRipFetchPageText(row) })));
  const byIndex = new Map(expanded.map(x => [x.index, x.pageText]));
  return list.map((row, index) => ({ ...row, pageText: byIndex.get(index) || "" }));
}

function sealedRipChaseSupported(name, evidenceText) {
  const stop = new Set(["rookie", "rookies", "card", "cards", "parallel", "parallels", "insert", "inserts", "autograph", "autographs", "auto", "case", "hit", "short", "print", "ssp"]);
  const tokens = String(name || "").toLowerCase().match(/[a-z0-9]+/g)?.filter(token => token.length >= 4 && !stop.has(token)) || [];
  if (!tokens.length) return false;
  const haystack = String(evidenceText || "").toLowerCase();
  const matched = tokens.filter(token => haystack.includes(token)).length;
  return matched >= Math.min(2, tokens.length);
}

'''
worker = replace_once(worker, helper_marker, helpers + helper_marker, 'rip evidence helpers')

# Rewrite normalization so a chase score is only valid when a named chase is
# actually supported by the retrieved source evidence.
worker = regex_replace_once(
    worker,
    r'''function sealedRipNormalize\(raw, evidenceRows, market\) \{.*?\n\}\n\nfunction sealedBarcodeDigits''',
    r'''function sealedRipNormalize(raw, evidenceRows, market) {
  const evidenceText = evidenceRows.map(row => `${row.title} ${row.snippet} ${row.pageText || ""}`).join("\n");
  const chaseCards = (Array.isArray(raw?.chaseCards) ? raw.chaseCards : []).slice(0, 5).map(row => ({
    name: String(row?.name || "").trim().slice(0, 140),
    why: String(row?.why || "").trim().slice(0, 240),
  })).filter(row => row.name && sealedRipChaseSupported(row.name, evidenceText));
  const pullOdds = (Array.isArray(raw?.pullOdds) ? raw.pullOdds : []).slice(0, 8).map(row => ({
    item: String(row?.item || "").trim().slice(0, 160),
    odds: String(row?.odds || "").trim().slice(0, 80),
    sourceType: String(row?.sourceType || "reported").trim().slice(0, 50),
    note: String(row?.note || "").trim().slice(0, 260),
  })).filter(row => row.item && row.odds && sealedRipOddsSupported(row.odds, evidenceText));

  const chaseEvidenceAvailable = Boolean(raw?.chaseEvidenceAvailable) && chaseCards.length > 0;
  const pullEvidenceAvailable = Boolean(raw?.pullEvidenceAvailable) && pullOdds.length > 0;
  const hasCommunitySource = evidenceRows.some(row => row?.sourceType === "community");
  const sentimentEvidenceAvailable = Boolean(raw?.sentimentEvidenceAvailable) && hasCommunitySource;
  const priceScore = sealedRipPriceScore(market?.shelfPrice, market?.median);
  const parts = {
    priceScore,
    chaseScore: chaseEvidenceAvailable ? sealedRipClampScore(raw?.chaseScore) : null,
    chaseEvidenceAvailable,
    pullScore: pullEvidenceAvailable ? sealedRipClampScore(raw?.pullScore) : null,
    pullEvidenceAvailable,
    sentimentScore: sentimentEvidenceAvailable ? sealedRipClampScore(raw?.sentimentScore) : null,
    sentimentEvidenceAvailable,
  };
  const overallScore = sealedRipWeightedScore(parts);
  const ripScore = sealedRipQualityScore(parts);
  const evidenceCount = [chaseEvidenceAvailable, pullEvidenceAvailable, sentimentEvidenceAvailable].filter(Boolean).length;
  const confidenceRaw = String(raw?.confidence || "low").toLowerCase();
  const qualitySummary = chaseEvidenceAvailable
    ? String(raw?.qualitySummary || "").trim().slice(0, 700)
    : "Scout found price data, but not enough source-supported named chase information to make a buy recommendation yet.";
  return {
    overallScore,
    finalVerdict: sealedRipFinalVerdict(overallScore, parts),
    ripScore,
    ripGrade: sealedRipGrade(ripScore),
    priceScore,
    chaseScore: parts.chaseScore,
    chaseEvidenceAvailable,
    pullScore: parts.pullScore,
    pullEvidenceAvailable,
    sentimentScore: parts.sentimentScore,
    sentimentEvidenceAvailable,
    sentimentLabel: sentimentEvidenceAvailable ? String(raw?.sentimentLabel || "mixed").slice(0, 40) : "unknown",
    evidenceCount,
    qualitySummary,
    chaseCards,
    pullOdds,
    collectorTake: sentimentEvidenceAvailable ? String(raw?.collectorTake || "").trim().slice(0, 700) : "Scout did not find enough exact-product collector discussion to score sentiment.",
    positives: (Array.isArray(raw?.positives) ? raw.positives : []).map(x => String(x || "").trim().slice(0, 220)).filter(Boolean).slice(0, 4),
    negatives: (Array.isArray(raw?.negatives) ? raw.negatives : []).map(x => String(x || "").trim().slice(0, 220)).filter(Boolean).slice(0, 4),
    confidence: evidenceCount < 2 ? "low" : (["high", "medium", "low"].includes(confidenceRaw) ? confidenceRaw : "low"),
  };
}

function sealedBarcodeDigits''',
    'rip normalization',
)

# Make the two searches more product/format specific, then filter and expand
# the evidence pages without spending extra search-provider calls.
worker = replace_once(
    worker,
    '      const checklistQuery = `${productLabel} checklist odds chase cards rookies parallels autograph retail`;\n      const communityQuery = `${productLabel} pulls review reddit collector quality`;',
    '      const formatTerms = sealedRipFormatTerms(identity);\n      const exactSet = [String(identity?.year || "").trim(), String(identity?.set || "").trim()].filter(Boolean).join(" ");\n      const checklistQuery = `"${exactSet}" ${formatTerms} odds checklist rookies case hits autographs parallels`;\n      const communityQuery = `"${exactSet}" ${formatTerms} pulls review ${sealedRipCommunitySite(identity?.category)}`;',
    'rip research queries',
)
worker = replace_once(
    worker,
    '      const evidenceRows = [\n        ...sealedRipEvidenceRows(checklistData, "checklist-and-odds"),\n        ...sealedRipEvidenceRows(communityData, "collector-reports"),\n      ];',
    '      let evidenceRows = [\n        ...sealedRipEvidenceRows(checklistData, "checklist-and-odds"),\n        ...sealedRipEvidenceRows(communityData, "collector-reports"),\n      ];\n      evidenceRows = sealedRipFilterRelevantEvidence(evidenceRows, identity);\n      evidenceRows = await sealedRipExpandEvidenceRows(evidenceRows);',
    'rip evidence expansion',
)
worker = replace_once(
    worker,
    '        `[${index + 1}] TYPE=${row.sourceType}; SEARCH=${row.queryKind}; TITLE=${row.title}; SOURCE=${row.source}; URL=${row.link}; SNIPPET=${row.snippet}`\n      ).join("\\n\\n").slice(0, 15000);',
    '        `[${index + 1}] TYPE=${row.sourceType}; SEARCH=${row.queryKind}; TITLE=${row.title}; SOURCE=${row.source}; URL=${row.link}; SNIPPET=${row.snippet}; PAGE=${row.pageText || ""}`\n      ).join("\\n\\n").slice(0, 30000);',
    'rip prompt evidence',
)

# Require the model to say whether it actually found named chase evidence.
worker = replace_once(
    worker,
    '          chaseScore: { type: "number" },\n          pullScore: { type: "number" },',
    '          chaseScore: { type: "number" },\n          chaseEvidenceAvailable: { type: "boolean" },\n          pullScore: { type: "number" },',
    'rip schema chase evidence field',
)
worker = replace_once(
    worker,
    '        required: ["qualitySummary", "chaseScore", "pullScore", "pullEvidenceAvailable", "sentimentScore", "sentimentEvidenceAvailable", "sentimentLabel", "chaseCards", "pullOdds", "collectorTake", "positives", "negatives", "confidence"]',
    '        required: ["qualitySummary", "chaseScore", "chaseEvidenceAvailable", "pullScore", "pullEvidenceAvailable", "sentimentScore", "sentimentEvidenceAvailable", "sentimentLabel", "chaseCards", "pullOdds", "collectorTake", "positives", "negatives", "confidence"]',
    'rip schema required chase evidence',
)
worker = replace_once(
    worker,
    'Score chaseScore 0-100 for breadth and quality of meaningful rookies, stars, inserts, case hits, autographs, numbered/color parallels, and format exclusives. Do not give a high chase score solely because one nearly impossible jackpot exists.',
    'Only put a card/player/insert in chaseCards when it is explicitly named in the supplied evidence. Set chaseEvidenceAvailable=false and return an empty chaseCards array if you cannot support named chases from the evidence. Score chaseScore 0-100 only when chaseEvidenceAvailable=true, for breadth and quality of meaningful rookies, stars, inserts, case hits, autographs, numbered/color parallels, and format exclusives. Do not give a high chase score solely because one nearly impossible jackpot exists.',
    'rip prompt named chase rule',
)

worker_path.write_text(worker, encoding='utf-8')

# Front end: null is N/A, not zero, and show evidence completeness.
app_path = Path('sealed-product-scout.js')
app = app_path.read_text(encoding='utf-8')
app = replace_once(
    app,
    '    const score=v=>Number.isFinite(Number(v))?String(Math.round(Number(v))):"N/A";',
    '    const score=v=>v===null||v===undefined||v===""?"N/A":(Number.isFinite(Number(v))?String(Math.round(Number(v))):"N/A");',
    'rip score null rendering',
)
app = replace_once(
    app,
    'Overall score: <strong>${score(a.overallScore)}/100</strong> · Rip Quality: <strong>${esc(a.ripGrade||"—")}</strong>',
    'Overall score: <strong>${a.overallScore===null||a.overallScore===undefined?"N/A":`${score(a.overallScore)}/100`}</strong> · Rip Quality: <strong>${esc(a.ripGrade||"—")}</strong> · Evidence: <strong>${Number(a.evidenceCount||0)}/3</strong>',
    'rip evidence completeness UI',
)
app_path.write_text(app, encoding='utf-8')

# Force iPhone/PWA clients to load the refined scanner.
index_path = Path('index.html')
html = index_path.read_text(encoding='utf-8')
html = replace_once(html, 'sealed-product-scout.js?v=6.1.7', 'sealed-product-scout.js?v=6.1.8', 'sealed scanner cache version')
index_path.write_text(html, encoding='utf-8')

# Update and strengthen regression checks.
test_path = Path('tests/sealed-product-vision.test.cjs')
test = test_path.read_text(encoding='utf-8')
test = test.replace('3\\.38\\.4', '3\\.38\\.5', 1)
test = test.replace('sealed:rip:v1:', 'sealed:rip:v2:', 1)
anchor = "assert.match(worker,/sealedRipWeightedScore/,'final verdict must combine price, chases, pull evidence, and sentiment');\n"
extra = anchor + "assert.match(worker,/sealedRipExpandEvidenceRows/,'rip research must expand high-quality source pages beyond search snippets');\nassert.match(worker,/chaseEvidenceAvailable/,'rip research must explicitly track whether named chase evidence exists');\nassert.match(worker,/NEED MORE DATA/,'rip verdict must refuse BUY recommendations when key product-quality evidence is missing');\nassert.match(worker,/site:reddit\\.com\\/r\\/basketballcards/,'basketball sentiment search must target the basketball-card community');\nassert.match(app,/Evidence: <strong>/,'rip UI must show research completeness');\nassert.match(app,/v===null\\|\\|v===undefined/,'rip UI must render missing component scores as N/A, not zero');\n"
if 'rip research must expand high-quality source pages beyond search snippets' not in test:
    test = replace_once(test, anchor, extra, 'rip evidence regression assertions')
test_path.write_text(test, encoding='utf-8')
