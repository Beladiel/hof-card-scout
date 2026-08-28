from pathlib import Path

worker_path = Path('src/index.js')
test_path = Path('tests/sealed-product-vision.test.cjs')
local_test_path = Path('tests/format-access-section-local.test.cjs')

worker = worker_path.read_text(encoding='utf-8')
tests = test_path.read_text(encoding='utf-8')

if 'const VERSION = "3.45.0";' not in worker:
    raise SystemExit('expected Worker v3.45.0')
if 'sealed:intel:v16:' not in worker:
    raise SystemExit('expected intelligence cache v16')
worker = worker.replace('const VERSION = "3.45.0";', 'const VERSION = "3.46.0";', 1)
worker = worker.replace('sealed:intel:v16:', 'sealed:intel:v17:', 1)

format_start = worker.find('function sealedRipExplicitFormatKeys(value) {')
format_end = worker.find('\nfunction sealedRipVariantTextCompatible', format_start)
if format_start < 0 or format_end < 0:
    raise SystemExit('format helper bounds not found')

format_block = r'''function sealedRipFormatMentionRules() {
  // Specialized Magic booster phrases intentionally come before generic booster
  // box/pack rules. Overlapping generic matches are discarded so "Play Booster
  // Box" remains Play Booster evidence rather than simultaneously becoming a
  // generic Booster Box claim.
  return [
    ["collector_booster", /\bcollector\s+boosters?(?:\s+(?:box|pack|display))?\b/i],
    ["play_booster", /\bplay\s+boosters?(?:\s+(?:box|pack|display))?\b/i],
    ["jumpstart_booster", /\bjumpstart\s+boosters?(?:\s+(?:box|pack|display))?\b/i],
    ["value_box", /\bvalue\s+box\b/i],
    ["blaster", /\bblaster(?:\s+box)?\b/i],
    ["mega", /\bmega(?:\s+box)?\b/i],
    ["hobby", /\bhobby(?:\s+box)?\b/i],
    ["retail_box", /\bretail\s+box\b/i],
    ["hanger_box", /\bhanger\s+box\b/i],
    ["hanger_pack", /\bhanger\s+pack\b/i],
    ["value_pack", /\b(?:value|fat)\s+pack\b/i],
    ["etb", /\belite\s+trainer\s+box\b|\betb\b/i],
    ["booster_bundle", /\bbooster\s+bundle\b/i],
    ["booster_box", /\bbooster\s+box\b/i],
    ["booster_pack", /\bbooster\s+pack\b/i],
    ["collection_box", /\bcollection\s+box\b/i],
    ["tin", /\btin\b/i],
    ["multi_pack", /\bmulti[- ]?pack\b/i],
    ["single_pack", /\bsingle\s+pack\b/i],
  ];
}

function sealedRipFormatMentions(value) {
  const text = String(value || "").replace(/[–—]/g, "-");
  const hits = [];
  sealedRipFormatMentionRules().forEach(([key, pattern], priority) => {
    const flags = pattern.flags.includes("i") ? "ig" : "g";
    const rx = new RegExp(pattern.source, flags);
    let match;
    while ((match = rx.exec(text))) {
      hits.push({ key, index: match.index, end: match.index + match[0].length, priority });
      if (rx.lastIndex === match.index) rx.lastIndex += 1;
      if (hits.length >= 120) break;
    }
  });
  hits.sort((a, b) => a.index - b.index || a.priority - b.priority || (b.end - b.index) - (a.end - a.index));
  const kept = [];
  for (const hit of hits) {
    if (kept.some(prev => hit.index < prev.end && hit.end > prev.index)) continue;
    kept.push(hit);
  }
  return kept.sort((a, b) => a.index - b.index);
}

function sealedRipExplicitFormatKeys(value) {
  return new Set(sealedRipFormatMentions(value).map(hit => hit.key));
}

function sealedRipCompatibleFormatKeys(identity = {}) {
  const exact = sealedRipExactFormatKey(identity);
  const keys = new Set(exact ? [exact] : []);
  const category = String(identity?.category || "");
  // UPC catalogs often call ordinary sports retail blasters "Value Box".
  // Treat that wording as the same retail configuration, but never Hanger/Hobby/Mega.
  if (exact === "blaster" && ["Baseball", "Basketball", "Football"].includes(category)) keys.add("value_box");
  return keys;
}

function sealedRipFormatTextCompatible(value, identity = {}) {
  const explicit = sealedRipExplicitFormatKeys(value);
  if (!explicit.size) return true;
  const compatible = sealedRipCompatibleFormatKeys(identity);
  if (!compatible.size) return true;
  return Array.from(explicit).some(key => compatible.has(key));
}
'''
worker = worker[:format_start] + format_block + worker[format_end:]

access_start = worker.find('function sealedRipFormatAccessContextSupported(evidenceRows, identity = {}) {')
access_end = worker.find('\nfunction sealedRipOddsRowSupported', access_start)
if access_start < 0 or access_end < 0:
    raise SystemExit('format access helper bounds not found')

access_block = r'''function sealedRipFormatAccessSignalPattern(category = "") {
  const key = sealedRipCategoryKey(category);
  if (key === "magic") return /\b(?:mythic(?: rare)?|borderless|showcase|serialized|special guests?|bonus sheet|foil|headliner|extended art|source material|cosmic foil)\b/i;
  if (key === "pokemon") return /\b(?:special illustration rare|illustration rare|hyper rare|secret rare|ultra rare|promo|special treatment|full art)\b/i;
  return /\b(?:rookies?|autographs?|signatures?|parallel|exclusive|numbered|case hit|ssp|short print|insert|green hoops|light burst|rainbow|pandora)\b|\b1\s*:\s*\d{1,7}\b/i;
}

function sealedRipRegexHitRanges(pattern, value) {
  const text = String(value || "");
  const flags = pattern.flags.includes("i") ? "ig" : "g";
  const rx = new RegExp(pattern.source, flags);
  const hits = [];
  let match;
  while ((match = rx.exec(text))) {
    hits.push({ index: match.index, end: match.index + match[0].length });
    if (rx.lastIndex === match.index) rx.lastIndex += 1;
    if (hits.length >= 120) break;
  }
  return hits;
}

function sealedRipSpanDistance(a, b) {
  if (a.end < b.index) return b.index - a.end;
  if (b.end < a.index) return a.index - b.end;
  return 0;
}

function sealedRipFormatAccessSections(row = {}) {
  const sections = [];
  const seen = new Set();
  const add = value => {
    const text = String(value || "").replace(/[ \t]+/g, " ").trim().slice(0, 5000);
    if (!text) return;
    const key = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").slice(0, 500);
    if (!key || seen.has(key)) return;
    seen.add(key);
    sections.push(text);
  };
  add(`${row?.title || ""}\n${row?.snippet || ""}`);
  const pageText = String(row?.pageText || "");
  for (const piece of pageText.split(/\n\s*---\s*\n+/)) add(piece);
  return sections.slice(0, 40);
}

function sealedRipFormatAccessSectionSupported(value, identity = {}) {
  const text = String(value || "").trim();
  if (!text || !sealedRipVariantTextCompatible(text, identity)) return false;
  const compatible = sealedRipCompatibleFormatKeys(identity);
  if (!compatible.size) return false;
  const mentions = sealedRipFormatMentions(text);
  if (!mentions.some(hit => compatible.has(hit.key))) return false;
  const signals = sealedRipRegexHitRanges(sealedRipFormatAccessSignalPattern(identity?.category), text);
  if (!signals.length) return false;

  // A chase/treatment signal belongs to this exact format only when the nearest
  // explicit sealed-format label in the same local excerpt is compatible and no
  // more than 950 characters away. This prevents a Play Booster heading near the
  // top of a Wizards page from inheriting a Headliner/Cosmic Foil claim in a later
  // Collector Booster section, and likewise blocks Hobby-only sports claims from
  // leaking into Blaster/Mega access.
  for (const signal of signals) {
    const distances = mentions.map(hit => ({ hit, distance: sealedRipSpanDistance(hit, signal) }));
    const nearestDistance = Math.min(...distances.map(row => row.distance));
    if (!Number.isFinite(nearestDistance) || nearestDistance > 950) continue;
    const nearest = distances.filter(row => row.distance === nearestDistance);
    if (nearest.some(row => compatible.has(row.hit.key))) return true;
  }
  return false;
}

function sealedRipFormatAccessLocalEvidence(evidenceRows, identity = {}) {
  const out = [];
  const seen = new Set();
  for (const row of sealedRipAuthorityRows(evidenceRows, identity)) {
    for (const section of sealedRipFormatAccessSections(row)) {
      if (!sealedRipFormatAccessSectionSupported(section, identity)) continue;
      const key = section.toLowerCase().replace(/[^a-z0-9]+/g, " ").slice(0, 600);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(section);
      if (out.length >= 16) return out;
    }
  }
  return out;
}

function sealedRipFormatAccessContextSupported(evidenceRows, identity = {}) {
  return sealedRipFormatAccessLocalEvidence(evidenceRows, identity).length > 0;
}

function sealedRipFormatAccessFallbackScore(evidenceRows, identity = {}) {
  const texts = sealedRipFormatAccessLocalEvidence(evidenceRows, identity).join(" ");
  if (!texts) return 0;
  const key = sealedRipCategoryKey(identity?.category);
  const families = key === "magic" ? [
    /\b(?:mythic(?: rare)?|rare)\b/i,
    /\b(?:borderless|showcase|extended art|source material)\b/i,
    /\bfoils?\b/i,
    /\b(?:special guests?|bonus sheet)\b/i,
    /\b(?:serialized|headliner|cosmic foil)\b/i,
  ] : key === "pokemon" ? [
    /\b(?:special illustration rare|sir|illustration rare|ir)\b/i,
    /\b(?:hyper rare|secret rare|ultra rare)\b/i,
    /\b(?:special treatment|promo|full art)\b/i,
    /\b(?:pull rate|hit rate)\b/i,
  ] : [
    /\brookies?\b/i,
    /\b(?:autographs?|signatures?)\b/i,
    /\b(?:parallel|exclusive|numbered|green hoops|light burst|rainbow|pandora)\b/i,
    /\b(?:case hit|ssp|short print)\b/i,
    /\b1\s*:\s*\d{1,7}\b/i,
  ];
  const count = families.filter(pattern => pattern.test(texts)).length;
  return Math.min(80, 42 + Math.max(1, count) * 8);
}
'''
worker = worker[:access_start] + access_block + worker[access_end:]

old_score = '''  const aiFormatAccessScore = sealedRipClampScore(raw?.formatAccessScore);\n  const formatAccessScore = formatAccessEvidenceAvailable\n    ? (Boolean(raw?.formatAccessEvidenceAvailable) && aiFormatAccessScore > 0\n      ? aiFormatAccessScore\n      : sealedRipFormatAccessFallbackScore(authorityRows, identity))\n    : null;\n  const rawFormatSummary = String(raw?.formatAccessSummary || "").trim().slice(0, 500);\n  const formatAccessSummary = formatAccessEvidenceAvailable && sealedRipFormatTextCompatible(rawFormatSummary, identity) && sealedRipVariantTextCompatible(rawFormatSummary, identity)\n    ? rawFormatSummary\n'''
new_score = '''  const formatAccessScore = formatAccessEvidenceAvailable\n    ? sealedRipFormatAccessFallbackScore(authorityRows, identity)\n    : null;\n  const rawFormatSummary = String(raw?.formatAccessSummary || "").trim().slice(0, 500);\n  const formatAccessSummary = formatAccessEvidenceAvailable && sealedRipFormatAccessSectionSupported(rawFormatSummary, identity)\n    ? rawFormatSummary\n'''
if old_score not in worker:
    raise SystemExit('format access normalization score anchor not found')
worker = worker.replace(old_score, new_score, 1)

replacements = {
    'assert.match(worker,/const VERSION = "3\\.45\\.0"/);': 'assert.match(worker,/const VERSION = "3\\.46\\.0"/);',
    "assert.match(worker,/sealed:intel:v16:/,'sealed product intelligence must use a reusable mode-scoped product cache');": "assert.match(worker,/sealed:intel:v17:/,'sealed product intelligence must use a reusable mode-scoped product cache');",
}
for old, new in replacements.items():
    if old not in tests:
        raise SystemExit(f'test version/cache anchor not found: {old}')
    tests = tests.replace(old, new, 1)

anchor = "assert.match(worker,/function sealedRipFormatAccessContextSupported/,'Shelf Showdown must locally verify exact-format chase access');\n"
addition = anchor + "assert.match(worker,/function sealedRipFormatMentions/,'exact-format validation must retain location-aware format mentions');\nassert.match(worker,/function sealedRipFormatAccessSectionSupported/,'exact-format validation must bind chase signals to the same local product section');\nassert.match(worker,/function sealedRipFormatAccessLocalEvidence/,'exact-format scoring must use only section-local authority evidence');\nassert.ok(worker.includes('nearest explicit sealed-format label'),'format access must reject a chase signal whose nearest format label belongs to another product configuration');\n"
if anchor not in tests:
    raise SystemExit('format access test anchor not found')
tests = tests.replace(anchor, addition, 1)

old_fallback_assert = "assert.match(worker,/function sealedRipFormatAccessFallbackScore/,'exact-format context must have a deterministic fallback score');\n"
new_fallback_assert = old_fallback_assert + "assert.ok(worker.includes('const formatAccessScore = formatAccessEvidenceAvailable\\n    ? sealedRipFormatAccessFallbackScore(authorityRows, identity)'),'exact-format score must be deterministic from locally verified authority evidence rather than the AI score');\nassert.ok(worker.includes('sealedRipFormatAccessSectionSupported(rawFormatSummary, identity)'),'format-access summary must itself name the exact format next to a chase/treatment signal');\n"
if old_fallback_assert not in tests:
    raise SystemExit('format fallback test anchor not found')
tests = tests.replace(old_fallback_assert, new_fallback_assert, 1)

local_test = r'''const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const worker = fs.readFileSync('src/index.js','utf8');
const start = worker.indexOf('function sealedRipExactFormatKey');
const end = worker.indexOf('function sealedRipOddsRowSupported', start);
assert.ok(start >= 0 && end > start, 'format-access helper block must be extractable');
const helperBlock = worker.slice(start, end);
const sandbox = {};
vm.runInNewContext(`
function sealedRipCategoryKey(category = '') {
  const value = String(category || '').toLowerCase();
  if (value.includes('magic')) return 'magic';
  if (value.includes('pok')) return 'pokemon';
  return 'sports';
}
function sealedRipAuthorityRows(rows = []) { return Array.isArray(rows) ? rows : []; }
${helperBlock}
this.__api={sealedRipFormatMentions,sealedRipFormatAccessSectionSupported,sealedRipFormatAccessContextSupported,sealedRipFormatAccessFallbackScore};
`, sandbox);
const api = sandbox.__api;

const magic = {category:'Magic: The Gathering', productType:'Play Booster', set:'Marvel Super Heroes'};
const magicGood = [{title:'Marvel Super Heroes', snippet:'', pageText:'PLAY BOOSTER — Each Play Booster can contain borderless mythic rare cards and a traditional foil.'}];
assert.strictEqual(api.sealedRipFormatAccessContextSupported(magicGood, magic), true, 'Play Booster treatment evidence in the same local section must count');
assert.ok(api.sealedRipFormatAccessFallbackScore(magicGood, magic) >= 50, 'same-section Magic evidence should produce a deterministic format score');

const magicCrossSection = [{title:'Marvel Super Heroes', snippet:'', pageText:'PLAY BOOSTER — 14 cards per pack.\n---\nCOLLECTOR BOOSTER — Headliner Cosmic Foil mythic cards can appear here.'}];
assert.strictEqual(api.sealedRipFormatAccessContextSupported(magicCrossSection, magic), false, 'Collector Booster chase claims on another section must not leak into Play Booster access');
assert.strictEqual(api.sealedRipFormatAccessFallbackScore(magicCrossSection, magic), 0, 'cross-section Magic contamination must score zero format access');

const magicNearestConflict = [{title:'Marvel Super Heroes', snippet:'', pageText:'PLAY BOOSTER product overview. General contents. COLLECTOR BOOSTER includes the Headliner Cosmic Foil mythic treatment.'}];
assert.strictEqual(api.sealedRipFormatAccessContextSupported(magicNearestConflict, magic), false, 'nearest incompatible format label must own the chase claim');

const sports = {category:'Basketball', productType:'Blaster Box', set:'2025-26 Topps NBA Hoops'};
const sportsGood = [{title:'2025-26 Topps NBA Hoops', snippet:'Value Box exclusive Green Hoops parallels are available in this configuration.', pageText:''}];
assert.strictEqual(api.sealedRipFormatAccessContextSupported(sportsGood, sports), true, 'sports Value Box wording must remain a valid Blaster alias when the chase signal is local');

const sportsCrossSection = [{title:'2025-26 Topps NBA Hoops', snippet:'', pageText:'VALUE BOX — eight packs of cards.\n---\nHOBBY BOX — autographs, numbered parallels and SSP inserts.'}];
assert.strictEqual(api.sealedRipFormatAccessContextSupported(sportsCrossSection, sports), false, 'Hobby-only sports signals must not leak into Blaster/Value Box access');

const mentions = api.sealedRipFormatMentions('Magic Marvel Play Booster Box');
assert.deepStrictEqual(Array.from(mentions, x => x.key), ['play_booster'], 'specialized Magic format phrase must suppress overlapping generic Booster Box match');

console.log('Section-local format access tests passed.');
'''

worker_path.write_text(worker, encoding='utf-8')
test_path.write_text(tests, encoding='utf-8')
local_test_path.write_text(local_test, encoding='utf-8')
print('Section-local format access patch applied.')
