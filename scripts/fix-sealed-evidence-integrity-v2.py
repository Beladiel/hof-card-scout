from pathlib import Path

p = Path('src/index.js')
text = p.read_text(encoding='utf-8')


def repl(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f'missing pattern: {label}')
    text = text.replace(old, new, 1)

repl('const VERSION = "3.40.2";', 'const VERSION = "3.40.3";', 'version')
repl('return `sealed:intel:v4:${encodeURIComponent(parts.join("|")).slice(0, 420)}`;', 'return `sealed:intel:v5:${encodeURIComponent(parts.join("|")).slice(0, 420)}`;', 'sealed cache')

anchor = '''function sealedRipOddsSupported(odds, evidenceText) {
  const raw = String(odds || "").trim();
  if (!raw) return false;
  const simplify = value => String(value || "").toLowerCase().replace(/\\s+/g, "").replace(/[–—]/g, "-");
  return simplify(evidenceText).includes(simplify(raw));
}
'''
helpers = anchor + '''
function sealedRipEvidenceIdentityTokens(identity = {}) {
  const stop = new Set([
    "the", "and", "with", "cards", "card", "trading", "tcg", "nba", "nfl", "mlb",
    "basketball", "football", "baseball", "pokemon", "pokémon", "magic", "gathering",
    "topps", "panini", "upper", "deck"
  ]);
  return String(identity?.set || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\\s+/)
    .filter(token => token.length >= 3 && !stop.has(token));
}

function sealedRipEvidenceRowMatchesIdentity(row, identity = {}) {
  const text = `${row?.title || ""} ${row?.snippet || ""} ${row?.pageText || ""}`.toLowerCase();
  const tokens = sealedRipEvidenceIdentityTokens(identity);
  if (tokens.length) {
    const matches = tokens.filter(token => text.includes(token)).length;
    if (matches < Math.min(2, tokens.length)) return false;
  }
  const season = String(identity?.year || "").trim().replace(/[–—/]/g, "-");
  const year = season.match(/\\b20\\d{2}\\b/)?.[0] || "";
  if (year && /\\b20\\d{2}\\b/.test(text) && !text.includes(year)) return false;
  return true;
}

function sealedRipOddsRowSupported(row, evidenceRows, identity = {}) {
  const simplify = value => String(value || "").toLowerCase().replace(/\\s+/g, "").replace(/[–—]/g, "-");
  const item = simplify(row?.item);
  const odds = simplify(row?.odds);
  if (!item || !odds) return false;
  const wantsAuthority = /official|checklist|manufacturer/i.test(String(row?.sourceType || ""));
  return (Array.isArray(evidenceRows) ? evidenceRows : []).some(source => {
    if (!sealedRipEvidenceRowMatchesIdentity(source, identity)) return false;
    if (wantsAuthority && source?.sourceType === "community") return false;
    const sourceText = simplify(`${source?.title || ""} ${source?.snippet || ""} ${source?.pageText || ""}`);
    const itemAt = sourceText.indexOf(item);
    if (itemAt < 0) return false;
    let oddsAt = sourceText.indexOf(odds, Math.max(0, itemAt - 700));
    if (oddsAt < 0) oddsAt = sourceText.indexOf(odds);
    if (oddsAt < 0) return false;
    return Math.abs(oddsAt - itemAt) <= 900;
  });
}

function sealedRipCommunityEvidenceText(evidenceRows = []) {
  return (Array.isArray(evidenceRows) ? evidenceRows : [])
    .filter(row => row?.sourceType === "community")
    .map(row => `${row?.title || ""} ${row?.snippet || ""} ${row?.pageText || ""}`.trim())
    .filter(Boolean)
    .join("\\n\\n")
    .slice(0, 12000);
}

function sealedRipTemperCollectorSummary(value, communitySourceCount = 0) {
  let text = sealedRipTemperCollectorLanguage(value, communitySourceCount);
  const sentences = text.split(/(?<=[.!?])\\s+/).map(x => x.trim()).filter(Boolean);
  const promotional = /\\b(?:great option|excellent option|fantastic option|ideal option|fun and affordable|add some excitement|exciting addition|accessible to a wider range)\\b/i;
  const kept = sentences.filter(sentence => !promotional.test(sentence));
  text = kept.join(" ").trim();
  return text || "Scout found exact-product community discussion, but not enough recurring opinion detail to summarize a reliable collector theme.";
}
'''
repl(anchor, helpers, 'odds evidence helpers')

repl('''  })).filter(row => row.item && row.odds && sealedRipOddsSupported(row.odds, evidenceText));
''', '''  })).filter(row => row.item && row.odds && sealedRipOddsRowSupported(row, evidenceRows, identity));
''', 'pull odds evidence validation')

repl('''  const communitySourceCount = evidenceRows.filter(row => row?.sourceType === "community").length;
  const sentimentEvidenceAvailable = Boolean(raw?.sentimentEvidenceAvailable) && communitySourceCount >= 2;
''', '''  const communitySourceCount = evidenceRows.filter(row => row?.sourceType === "community").length;
  const communityEvidenceText = sealedRipCommunityEvidenceText(evidenceRows);
  const sentimentEvidenceAvailable = Boolean(raw?.sentimentEvidenceAvailable) && communitySourceCount >= 2 && communityEvidenceText.length >= 80;
''', 'community evidence gate')

repl('''    collectorTake: sentimentEvidenceAvailable ? sealedRipTemperCollectorLanguage(raw?.collectorTake, communitySourceCount).slice(0, 700) : "Scout did not find enough recurring exact-product collector discussion to score sentiment.",
''', '''    collectorTake: sentimentEvidenceAvailable ? sealedRipTemperCollectorSummary(raw?.collectorTake, communitySourceCount).slice(0, 700) : "Scout did not find enough recurring exact-product collector discussion to score sentiment.",
''', 'collector summary cleanup')

repl('Product/checklist facts are not collector sentiment by themselves.', 'Product/checklist facts are not collector sentiment by themselves. collectorTake, positives, and negatives must describe opinions, complaints, praise, price/value reactions, quality-control reports, collation reports, or opening experiences that are actually present in COMMUNITY EVIDENCE. Do not copy checklist features into the collector-sentiment fields.', 'sentiment prompt rule')

marker = 'High-signal excerpts extracted from the best sources (read these first):'
if marker not in text:
    raise SystemExit('missing pattern: high-signal marker')
community_section = '''COMMUNITY EVIDENCE — use ONLY this section for collectorTake / positives / negatives:\\
${sealedRipCommunityEvidenceText(evidenceRows) || "No community evidence available."}\\
\\
'''
text = text.replace(marker, community_section + marker, 1)

p.write_text(text, encoding='utf-8')

# Update regression assertions.
t = Path('tests/sealed-product-vision.test.cjs')
txt = t.read_text(encoding='utf-8')
replacements = [
    ('assert.match(worker,/const VERSION = "3\\.40\\.2"/);', 'assert.match(worker,/const VERSION = "3\\.40\\.3"/);'),
    ("assert.match(worker,/sealed:intel:v4:/,'sealed product intelligence must use a reusable product cache');", "assert.match(worker,/sealed:intel:v5:/,'sealed product intelligence must use a reusable product cache');"),
]
for old, new in replacements:
    if old not in txt:
        raise SystemExit(f'missing test pattern: {old}')
    txt = txt.replace(old, new, 1)
needle = "assert.ok(worker.includes('Never say \"many collectors\"'),'collector synthesis must avoid broad consensus claims from thin evidence');\n"
if needle not in txt:
    raise SystemExit('missing sentiment assertion anchor')
extra = """assert.match(worker,/function sealedRipOddsRowSupported/,'pull odds must be validated as item+odds pairs inside matching-set evidence');
assert.match(worker,/sealedRipEvidenceRowMatchesIdentity/,'pull-odds evidence must match the scanned set identity');
assert.match(worker,/COMMUNITY EVIDENCE — use ONLY this section/,'collector sentiment must be isolated from checklist evidence');
assert.match(worker,/sealedRipTemperCollectorSummary/,'collector copy must suppress unsupported promotional conclusions');
"""
txt = txt.replace(needle, needle + extra, 1)
t.write_text(txt, encoding='utf-8')
