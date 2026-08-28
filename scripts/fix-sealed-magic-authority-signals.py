from pathlib import Path

p = Path('src/index.js')
text = p.read_text(encoding='utf-8')


def repl(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f'missing pattern: {label}')
    text = text.replace(old, new, 1)

repl('const VERSION = "3.40.6";', 'const VERSION = "3.41.0";', 'version')
repl('return `sealed:intel:v8:${encodeURIComponent(parts.join("|")).slice(0, 420)}`;', 'return `sealed:intel:v9:${encodeURIComponent(parts.join("|")).slice(0, 420)}`;', 'sealed cache')

anchor = '''function sealedRipFormatTerms(identity) {
'''
helper = '''function sealedRipAuthorityQuery(identity, researchSet, authoritySite, formatTerms, researchTerms) {
  const key = sealedRipCategoryKey(identity?.category);
  const authorityYear = String(identity?.year || "").replace(/[^0-9]+/g, " ").trim();
  const setText = String(researchSet || "").replace(/\\bmagic\\s*:?\\s*the\\s+gathering\\b/ig, " ").replace(/\\s+/g, " ").trim();
  if (key === "magic") {
    // Wizards organizes useful evidence around the set/product hub, card-image gallery,
    // collecting guide, and set archive. Requiring an exact box phrase during discovery
    // can hide those canonical pages, so discover the set first and enforce format later.
    return `${setText || researchSet} ${authoritySite} product "card image gallery" collecting booster contents`.replace(/\\s+/g, " ").trim();
  }
  if (key === "pokemon") {
    // Pokémon official pages are likewise set-first; exact pack/box experience belongs
    // in extraction/community validation rather than in the authority discovery query.
    return `${authorityYear} ${setText || researchSet} ${authoritySite} set cards product`.replace(/\\s+/g, " ").trim();
  }
  const authorityCategory = String(identity?.category || "").trim().toLowerCase();
  return `${authorityYear} ${researchSet} ${authorityCategory} ${authoritySite} ${formatTerms} ${researchTerms.authority}`.replace(/\\s+/g, " ").trim();
}

'''
repl(anchor, helper + anchor, 'authority query helper')

old_query = '''      const authorityYear = String(identity?.year || "").replace(/[^0-9]+/g, " ").trim();
      const authorityCategory = String(identity?.category || "").trim().toLowerCase();
      const researchTerms = sealedRipResearchTerms(identity?.category);
      const checklistQuery = `${authorityYear} ${researchSet} ${authorityCategory} ${authoritySite} ${formatTerms} ${researchTerms.authority}`.replace(/\\s+/g, " ").trim();
'''
new_query = '''      const researchTerms = sealedRipResearchTerms(identity?.category);
      const checklistQuery = sealedRipAuthorityQuery(identity, researchSet, authoritySite, formatTerms, researchTerms);
'''
repl(old_query, new_query, 'route authority query')

old_needles = '''  const needles = ["1:", "odds", "blaster", "value box", "what to expect in a value box", "rookie", "signature", "hyper signatures", "autograph", "case hit", "block by block", "boom shaka laka", "green hoops", "light burst", "parallel", "exclusive", "short print", "ssp"];
'''
new_needles = '''  const needles = [
    "1:", "odds", "blaster", "value box", "what to expect in a value box", "rookie", "signature", "hyper signatures", "autograph", "case hit", "block by block", "boom shaka laka", "green hoops", "light burst", "parallel", "exclusive", "short print", "ssp",
    "mythic", "rare", "borderless", "showcase", "serialized", "special guest", "bonus sheet", "foil", "collector booster", "play booster", "booster contents", "headliner", "extended art", "source material", "commander",
    "special illustration rare", "illustration rare", "hyper rare", "secret rare", "ultra rare", "pull rate", "hit rate"
  ];
'''
repl(old_needles, new_needles, 'page excerpt category needles')

start = text.index('function sealedRipPromptSignals(rows) {')
end = text.index('\nfunction sealedRipChaseSupported', start)
if start < 0 or end < 0:
    raise SystemExit('missing prompt signals function')
new_signals = r'''function sealedRipPromptSignals(rows, category = "") {
  const ordered = (Array.isArray(rows) ? rows.slice() : [])
    .sort((a, b) => sealedRipEvidencePriority(a) - sealedRipEvidencePriority(b));
  const chunks = [];
  const seen = new Set();
  const key = sealedRipCategoryKey(category);
  const common = [/\b1\s*:\s*\d{1,7}\b/ig];
  const sports = [
    /\b(?:retail[- ]only|retail exclusive|value box|blaster|case hit|rookie signatures?|hyper signatures?|autographs?|light burst|green hoops|numbered|parallel|ssp|short print|rookies?)\b/ig,
  ];
  const pokemon = [
    /\b(?:special illustration rare|illustration rare|hyper rare|secret rare|ultra rare|full art|special treatment|sir|ir|pull rate|hit rate|booster bundle|elite trainer box|etb)\b/ig,
  ];
  const magic = [
    /\b(?:mythic(?: rare)?|rare|borderless|showcase|serialized|special guests?|bonus sheet|foil|cosmic foil|collector boosters?|play boosters?|booster contents|headliner|extended art|source material|commander|playable|staple)\b/ig,
  ];
  const patterns = [...common, ...(key === "magic" ? magic : key === "pokemon" ? pokemon : sports)];
  for (const row of ordered) {
    const text = `${row?.snippet || ""} ${row?.pageText || ""}`.replace(/\s+/g, " ").trim();
    if (!text) continue;
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      let hits = 0;
      while ((match = pattern.exec(text)) && hits < 7) {
        const start = Math.max(0, match.index - 260);
        const end = Math.min(text.length, match.index + match[0].length + 700);
        const excerpt = text.slice(start, end).trim();
        const dedupeKey = excerpt.toLowerCase().replace(/[^a-z0-9]+/g, " ").slice(0, 180);
        if (excerpt && !seen.has(dedupeKey)) {
          seen.add(dedupeKey);
          chunks.push(`[${row.sourceType}] ${row.title}: ${excerpt}`);
        }
        hits++;
        if (chunks.length >= 22) break;
      }
      if (chunks.length >= 22) break;
    }
    if (chunks.length >= 22) break;
  }
  return chunks.join("\\n---\\n").slice(0, 18000);
}
'''
text = text[:start] + new_signals + text[end:]

repl('''      const evidenceSignals = sealedRipPromptSignals(evidenceRows);
''', '''      const evidenceSignals = sealedRipPromptSignals(evidenceRows, identity?.category);
''', 'category-aware signal call')

anchor2 = '''function sealedRipNormalize(raw, evidenceRows, market, identity = {}) {
'''
chase_helper = r'''function sealedRipVerifiedChaseScore(rawScore, evidenceRows = [], category = "") {
  const aiScore = sealedRipClampScore(rawScore);
  const key = sealedRipCategoryKey(category);
  if (key !== "magic") return aiScore;
  const authorityText = (Array.isArray(evidenceRows) ? evidenceRows : [])
    .filter(row => row?.sourceType !== "community")
    .map(row => `${row?.title || ""} ${row?.snippet || ""} ${row?.pageText || ""}`)
    .join(" ")
    .toLowerCase();
  if (!authorityText) return aiScore;
  const families = [
    /\bmythic(?: rare)?s?\b/,
    /\b(?:borderless|showcase|extended art|source material)\b/,
    /\b(?:serialized|headliner|cosmic foil)\b/,
    /\b(?:special guests?|bonus sheet)\b/,
    /\bfoils?\b/,
    /\b(?:collector boosters?|play boosters?|commander)\b/,
  ];
  const count = families.filter(pattern => pattern.test(authorityText)).length;
  // This is only a contradiction guard, not a declaration that the set is valuable.
  // Verified Magic rarity/treatment/product structure should not display as 0/100 just
  // because the synthesis model emitted zero. Community/player evidence can raise it.
  const floor = count >= 4 ? 25 : count >= 2 ? 18 : count >= 1 ? 10 : 0;
  return Math.max(aiScore, floor);
}

'''
repl(anchor2, chase_helper + anchor2, 'magic chase floor helper')

repl('''    chaseScore: chaseEvidenceAvailable ? sealedRipClampScore(raw?.chaseScore) : null,
''', '''    chaseScore: chaseEvidenceAvailable ? sealedRipVerifiedChaseScore(raw?.chaseScore, evidenceRows, identity?.category) : null,
''', 'verified chase score')

p.write_text(text, encoding='utf-8')

# Tests
t = Path('tests/sealed-product-vision.test.cjs')
txt = t.read_text(encoding='utf-8')
txt = txt.replace('assert.match(worker,/const VERSION = "3\\.40\\.6"/);', 'assert.match(worker,/const VERSION = "3\\.41\\.0"/);', 1)
txt = txt.replace("assert.match(worker,/sealed:intel:v8:/,'sealed product intelligence must use a reusable product cache');", "assert.match(worker,/sealed:intel:v9:/,'sealed product intelligence must use a reusable product cache');", 1)
needle = "assert.ok(worker.includes('PLAYABLE/VALUE QUALITY'),'Magic chase scoring must include playable/set value');\n"
if needle not in txt:
    raise SystemExit('missing Magic assertion anchor')
extra = """assert.match(worker,/function sealedRipAuthorityQuery/,'authority discovery must route by category');
assert.ok(worker.includes('product \\\"card image gallery\\\" collecting booster contents'),'Magic authority search must discover Wizards set-level pages before exact-format extraction');
assert.match(worker,/function sealedRipPromptSignals\\(rows, category = \"\"\\)/,'compact evidence extraction must be category aware');
assert.ok(worker.includes('cosmic foil'),'Magic signal extraction must understand Magic-specific treatments');
assert.ok(worker.includes('special illustration rare'),'category-aware extraction must retain Pokémon chase vocabulary');
assert.match(worker,/function sealedRipVerifiedChaseScore/,'verified Magic structure must protect against contradictory zero set-value scores');
"""
txt = txt.replace(needle, needle + extra, 1)
t.write_text(txt, encoding='utf-8')
