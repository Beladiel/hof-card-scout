from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing expected text for {label}")
    return text.replace(old, new, 1)

worker_path = Path('src/index.js')
worker = worker_path.read_text(encoding='utf-8')
worker = replace_once(worker, 'const VERSION = "3.38.6";', 'const VERSION = "3.38.7";', 'worker version')
worker = replace_once(worker, 'sealed:rip:v3:', 'sealed:rip:v4:', 'rip cache version')

worker = replace_once(
    worker,
    '  return /ebay\\.|amazon\\.|walmart\\.|target\\.|bestbuy\\.|mercari\\.|whatnot\\.|fanatics\\.com\\/.*(?:product|shop)|etsy\\./.test(text);',
    '  return /ebay\\.|amazon\\.|walmart\\.|target\\.|bestbuy\\.|mercari\\.|whatnot\\.|fanatics\\.com\\/.*(?:product|shop)|etsy\\.|blowoutcards\\.com|dacardworld\\.com|steelcitycollectibles\\.com/.test(text);',
    'shopping-source filter',
)

worker = replace_once(
    worker,
    '    if (!title || !/^https?:\\/\\//i.test(link) || sealedRipIsShoppingSource(row)) continue;',
    '    if (!title || !/^https?:\\/\\//i.test(link) || sealedRipIsShoppingSource(row) || /facebook\\.com|instagram\\.com|tiktok\\.com/i.test(link)) continue;',
    'low-value social research filter',
)
worker = replace_once(worker, '    if (out.length >= 8) break;', '    if (out.length >= 12) break;', 'research result cap')
worker = replace_once(worker, '  url.searchParams.set("num", "10");', '  url.searchParams.set("num", "20");', 'Google result count')

old_expand = '''async function sealedRipExpandEvidenceRows(rows) {
  const list = Array.isArray(rows) ? rows.slice(0, 14) : [];
  const fetchable = list.map((row, index) => ({ row, index })).filter(x => x.row.sourceType !== "community").slice(0, 4);
  const expanded = await Promise.all(fetchable.map(async ({ row, index }) => ({ index, pageText: await sealedRipFetchPageText(row) })));
  const byIndex = new Map(expanded.map(x => [x.index, x.pageText]));
  return list.map((row, index) => ({ ...row, pageText: byIndex.get(index) || "" }));
}'''
new_expand = '''function sealedRipEvidencePriority(row) {
  const type = String(row?.sourceType || "");
  const link = String(row?.link || "").toLowerCase();
  if (type === "official") return 0;
  if (type === "checklist/editorial") return 1;
  if (/beckett\\.com|cardboardconnection\\.com|checklistinsider\\.com/.test(link)) return 1;
  if (type === "editorial") return 2;
  return 3;
}

async function sealedRipExpandEvidenceRows(rows) {
  const list = Array.isArray(rows) ? rows.slice(0, 20) : [];
  const fetchable = list
    .map((row, index) => ({ row, index }))
    .filter(x => x.row.sourceType !== "community")
    .sort((a, b) => sealedRipEvidencePriority(a.row) - sealedRipEvidencePriority(b.row) || a.index - b.index)
    .slice(0, 6);
  const expanded = await Promise.all(fetchable.map(async ({ row, index }) => ({ index, pageText: await sealedRipFetchPageText(row) })));
  const byIndex = new Map(expanded.map(x => [x.index, x.pageText]));
  return list.map((row, index) => ({ ...row, pageText: byIndex.get(index) || "" }));
}'''
worker = replace_once(worker, old_expand, new_expand, 'source expansion ranking')

worker = replace_once(
    worker,
    '  const chaseEvidenceAvailable = Boolean(raw?.chaseEvidenceAvailable) && chaseCards.length > 0;\n  const pullEvidenceAvailable = Boolean(raw?.pullEvidenceAvailable) && pullOdds.length > 0;',
    '  const chaseEvidenceAvailable = chaseCards.length > 0;\n  const pullEvidenceAvailable = pullOdds.length > 0;',
    'validated evidence availability',
)

worker = replace_once(
    worker,
    '      const checklistQuery = `"${exactSet}" ${formatTerms} odds checklist rookies case hits autographs parallels`;',
    '      const checklistQuery = `"${exactSet}" ${formatTerms} ("pull odds" OR odds) (checklist OR "collector guide") rookies signatures "case hits" parallels`;',
    'checklist research query',
)

worker = replace_once(
    worker,
    '      const sources = evidenceRows.slice(0, 10).map(row => ({ title: row.title, link: row.link, sourceType: row.sourceType, queryKind: row.queryKind }));\n      const evidenceForPrompt = evidenceRows.slice(0, 14).map((row, index) =>',
    '      const sources = evidenceRows.slice(0, 12).map(row => ({ title: row.title, link: row.link, sourceType: row.sourceType, queryKind: row.queryKind }));\n      const evidenceForPrompt = evidenceRows.slice(0, 18).map((row, index) =>',
    'prompt evidence row count',
)
worker = replace_once(worker, ').join("\\n\\n").slice(0, 30000);', ').join("\\n\\n").slice(0, 42000);', 'prompt evidence size')

old_prompt = '''Only put a card/player/insert in chaseCards when it is explicitly named in the supplied evidence. Set chaseEvidenceAvailable=false and return an empty chaseCards array if you cannot support named chases from the evidence. Score chaseScore 0-100 only when chaseEvidenceAvailable=true, for breadth and quality of meaningful rookies, stars, inserts, case hits, autographs, numbered/color parallels, and format exclusives. Do not give a high chase score solely because one nearly impossible jackpot exists. Score pullScore 0-100 only when the evidence supports a realistic assessment for this exact format; otherwise set pullEvidenceAvailable=false.'''
new_prompt = '''Only put a card/player/insert in chaseCards when it is explicitly named in the supplied evidence. A chaseCards entry may be a named player/card, a named insert or case-hit family, a named autograph family, or a named numbered/retail-exclusive parallel when the evidence clearly identifies it as something collectors chase. Prefer exact-format retail/value-box chases over Hobby-only content. If the evidence names supported retail chases, return 3-5 of the strongest ones instead of leaving chaseCards empty. Set chaseEvidenceAvailable=false and return an empty chaseCards array only if you truly cannot support any named chase from the evidence. Score chaseScore 0-100 only when chaseEvidenceAvailable=true, for breadth and quality of meaningful rookies, stars, inserts, case hits, autographs, numbered/color parallels, and format exclusives. Do not give a high chase score solely because one nearly impossible jackpot exists. If the evidence literally contains exact-format odds such as 1:207, preserve that exact notation in pullOdds and explain what it applies to. Score pullScore 0-100 only when the evidence supports a realistic assessment for this exact format; otherwise set pullEvidenceAvailable=false.'''
worker = replace_once(worker, old_prompt, new_prompt, 'rip synthesis prompt')

worker_path.write_text(worker, encoding='utf-8')

test_path = Path('tests/sealed-product-vision.test.cjs')
test = test_path.read_text(encoding='utf-8')
test = replace_once(test, 'assert.match(worker,/const VERSION = "3\\.38\\.6"/);', 'assert.match(worker,/const VERSION = "3\\.38\\.7"/);', 'test worker version')
test = replace_once(test, 'assert.match(worker,/sealed:rip:v3:/,\'rip-quality research must be cached\');', 'assert.match(worker,/sealed:rip:v4:/,\'rip-quality research must be cached\');', 'test cache version')
anchor = "assert.match(worker,/sealedRipExpandEvidenceRows/,'rip research must expand high-quality source pages beyond search snippets');\n"
extra = anchor + "assert.match(worker,/sealedRipEvidencePriority/,'rip research must prioritize official and checklist sources for page expansion');\nassert.match(worker,/url\\.searchParams\\.set\\(\\\"num\\\", \\\"20\\\"\\)/,'rip research should inspect a broader Google result page without adding a third search');\nassert.match(worker,/out\\.length >= 12/,'rip research should retain enough candidates to reach lower-ranked odds sources');\nassert.match(worker,/const chaseEvidenceAvailable = chaseCards\\.length > 0/,'validated named chases must establish chase evidence even if the model boolean is inconsistent');\n"
if 'rip research must prioritize official and checklist sources for page expansion' not in test:
    test = replace_once(test, anchor, extra, 'new source-ranking regression tests')
test_path.write_text(test, encoding='utf-8')
