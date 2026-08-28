from pathlib import Path

p = Path('src/index.js')
text = p.read_text(encoding='utf-8')


def repl(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f'missing pattern: {label}')
    text = text.replace(old, new, 1)

repl('const VERSION = "3.40.4";', 'const VERSION = "3.40.5";', 'version')
repl('return `sealed:intel:v6:${encodeURIComponent(parts.join("|")).slice(0, 420)}`;', 'return `sealed:intel:v7:${encodeURIComponent(parts.join("|")).slice(0, 420)}`;', 'sealed cache')

old_community = '''function sealedRipCommunityEvidenceText(evidenceRows = []) {
  return (Array.isArray(evidenceRows) ? evidenceRows : [])
    .filter(row => row?.sourceType === "community")
    .map(row => `${row?.title || ""} ${row?.snippet || ""} ${row?.pageText || ""}`.trim())
    .filter(Boolean)
    .join("\\n\\n")
    .slice(0, 12000);
}
'''
new_community = '''function sealedRipCommunityRowCompatible(row, identity = {}) {
  if (row?.sourceType !== "community") return false;
  if (!sealedRipEvidenceRowMatchesIdentity(row, identity)) return false;
  // A community thread whose title explicitly names another sealed format is not
  // evidence about this exact product's opening experience. Generic set-level
  // threads remain useful for card-design/quality sentiment.
  const hardScopeText = `${row?.title || ""} ${row?.link || ""}`;
  if (!sealedRipFormatTextCompatible(hardScopeText, identity)) return false;
  if (!sealedRipVariantTextCompatible(hardScopeText, identity)) return false;
  return true;
}

function sealedRipCommunitySentenceCompatible(value, identity = {}) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (!sealedRipFormatTextCompatible(text, identity)) return false;
  if (!sealedRipVariantTextCompatible(text, identity)) return false;
  return true;
}

function sealedRipCommunityEvidenceText(evidenceRows = [], identity = {}) {
  return (Array.isArray(evidenceRows) ? evidenceRows : [])
    .filter(row => sealedRipCommunityRowCompatible(row, identity))
    .map(row => {
      const title = String(row?.title || "").trim();
      const body = `${row?.snippet || ""} ${row?.pageText || ""}`.trim();
      const bodyPieces = body
        .split(/(?<=[.!?])\\s+|\\n+/)
        .map(piece => piece.trim())
        .filter(piece => sealedRipCommunitySentenceCompatible(piece, identity));
      return [title, ...bodyPieces].filter(Boolean).join(" ").trim();
    })
    .filter(Boolean)
    .join("\\n\\n")
    .slice(0, 12000);
}
'''
repl(old_community, new_community, 'community evidence helpers')

repl('''  const communitySourceCount = evidenceRows.filter(row => row?.sourceType === "community").length;
  const communityEvidenceText = sealedRipCommunityEvidenceText(evidenceRows);
''', '''  const communitySourceCount = evidenceRows.filter(row => sealedRipCommunityRowCompatible(row, identity)).length;
  const communityEvidenceText = sealedRipCommunityEvidenceText(evidenceRows, identity);
''', 'normalize community scope')

repl('''      const sources = evidenceRows.filter(row => /^https?:\\/\\//i.test(String(row?.link || ""))).slice(0, 12).map(row => ({ title: row.title, link: row.link, sourceType: row.sourceType, queryKind: row.queryKind }));
''', '''      const sources = evidenceRows
        .filter(row => /^https?:\\/\\//i.test(String(row?.link || "")) && (row?.sourceType !== "community" || sealedRipCommunityRowCompatible(row, identity)))
        .slice(0, 12)
        .map(row => ({ title: row.title, link: row.link, sourceType: row.sourceType, queryKind: row.queryKind }));
''', 'visible source scope')

repl('''        community: evidenceRows.filter(row => row.queryKind === "collector-reports").length,
''', '''        community: evidenceRows.filter(row => row.queryKind === "collector-reports" && sealedRipCommunityRowCompatible(row, identity)).length,
''', 'research mix community scope')

repl('''${sealedRipCommunityEvidenceText(evidenceRows) || "No community evidence available."}\\
''', '''${sealedRipCommunityEvidenceText(evidenceRows, identity) || "No compatible community evidence available."}\\
''', 'prompt community evidence identity')

prompt_anchor = '''Product/checklist facts are not collector sentiment by themselves. collectorTake, positives, and negatives must describe opinions, complaints, praise, price/value reactions, quality-control reports, collation reports, or opening experiences that are actually present in COMMUNITY EVIDENCE. Do not copy checklist features into the collector-sentiment fields.'''
prompt_new = '''Product/checklist facts are not collector sentiment by themselves. collectorTake, positives, and negatives must describe opinions, complaints, praise, price/value reactions, quality-control reports, collation reports, or opening experiences that are actually present in COMMUNITY EVIDENCE. Generic set-level opinions about card design, card stock, photography, or overall set appeal may be summarized. Format-specific claims about autograph guarantees, pack counts, pull experience, exclusives, or box value may be used only when the community evidence applies to the exact requested sealed format. Never import Hobby, Mega, Hanger, Fanatics, or another format's opening economics into a different product. Do not copy checklist features into the collector-sentiment fields.'''
repl(prompt_anchor, prompt_new, 'prompt exact-format sentiment rule')

p.write_text(text, encoding='utf-8')

# Regression assertions.
t = Path('tests/sealed-product-vision.test.cjs')
txt = t.read_text(encoding='utf-8')
if 'assert.match(worker,/const VERSION = "3\\.40\\.4"/);' not in txt:
    raise SystemExit('missing old version assertion')
txt = txt.replace('assert.match(worker,/const VERSION = "3\\.40\\.4"/);', 'assert.match(worker,/const VERSION = "3\\.40\\.5"/);', 1)
if "assert.match(worker,/sealed:intel:v6:/,'sealed product intelligence must use a reusable product cache');" not in txt:
    raise SystemExit('missing old cache assertion')
txt = txt.replace("assert.match(worker,/sealed:intel:v6:/,'sealed product intelligence must use a reusable product cache');", "assert.match(worker,/sealed:intel:v7:/,'sealed product intelligence must use a reusable product cache');", 1)
needle = "assert.ok(worker.includes('Every pullOdds.note MUST name the applicable sealed format'),'AI extraction must label the format attached to every supported odd');\n"
if needle not in txt:
    raise SystemExit('missing exact-format assertion anchor')
extra = """assert.match(worker,/function sealedRipCommunityRowCompatible/,'community source titles naming another format must be rejected');
assert.match(worker,/function sealedRipCommunitySentenceCompatible/,'format-specific community sentences must match the scanned format');
assert.match(worker,/sealedRipCommunityEvidenceText\\(evidenceRows, identity\\)/,'collector prompt must receive format-scoped community evidence');
assert.ok(worker.includes(\"Never import Hobby, Mega, Hanger, Fanatics\"),'collector synthesis must forbid cross-format opening economics');
"""
txt = txt.replace(needle, needle + extra, 1)
t.write_text(txt, encoding='utf-8')
