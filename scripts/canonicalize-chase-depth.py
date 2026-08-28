from pathlib import Path
import re

worker_path = Path('src/index.js')
test_path = Path('tests/sealed-product-vision.test.cjs')
canonical_test_path = Path('tests/chase-depth-canonical.test.cjs')

worker = worker_path.read_text(encoding='utf-8')
tests = test_path.read_text(encoding='utf-8')

if 'const VERSION = "3.44.0";' not in worker:
    raise SystemExit('expected Worker v3.44.0')
worker = worker.replace('const VERSION = "3.44.0";', 'const VERSION = "3.45.0";', 1)
if 'sealed:intel:v15:' not in worker:
    raise SystemExit('expected intelligence cache v15')
worker = worker.replace('sealed:intel:v15:', 'sealed:intel:v16:', 1)

# Annotate every accepted price-guide single with a local canonical identity.
needle = '''    item.priceBasis = proof.priceBasis;
    item.verifiedSource = proof.sourceHost;
    const key = `${item.name}|${item.treatment}`.toLowerCase().replace(/\\s+/g, " ");
'''
replacement = '''    item.priceBasis = proof.priceBasis;
    item.verifiedSource = proof.sourceHost;
    item.cardNumber = sealedRipChaseCardNumber(item.name);
    item.canonicalKey = sealedRipChaseCanonicalKey(item);
    const key = `${item.name}|${item.treatment}`.toLowerCase().replace(/\\s+/g, " ");
'''
if needle not in worker:
    raise SystemExit('normalize chase-value annotation anchor not found')
worker = worker.replace(needle, replacement, 1)

start = worker.find('function sealedRipChaseDepthMetrics(cards = []) {')
end = worker.find('\nfunction sealedRipPriceGuideEvidenceText', start)
if start < 0 or end < 0:
    raise SystemExit('Chase Depth metrics function bounds not found')

new_block = r'''function sealedRipChaseTreatmentSegment(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (/\b(?:parallel|refractor|prizm|foil|holo(?:graphic)?|rainbow|wave|shimmer|mojo|cracked ice|laser|disco|pulsar|velocity|checkerboard|negative|sepia|x-fractor|borderless|showcase|extended art|cosmic foil|etched foil|surge|galaxy|neon|hyper|scope|fractal|color match|numbered|serial(?:ized)?|image variation|printing plate|superfractor)\b/i.test(text)) return true;
  return /^(?:red|blue|green|gold|silver|black|purple|orange|pink|teal|aqua|white|yellow|bronze)(?:\s+(?:red|blue|green|gold|silver|black|purple|orange|pink|teal|aqua|white|yellow|bronze))*$/i.test(text);
}

function sealedRipChaseCardNumber(value) {
  const text = String(value || "");
  let match = text.match(/#\s*([A-Z0-9][A-Z0-9-]{0,15})\b/i);
  if (!match) match = text.match(/\b(?:CN|collector\s*(?:no\.?|number)?|card\s*(?:no\.?|number))\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{0,15})\b/i);
  if (!match) match = text.match(/\b(\d{1,4}\/\d{1,4})\b/);
  return match ? String(match[1] || '').toUpperCase() : '';
}

function sealedRipChaseCanonicalIdentity(card = {}) {
  const original = String(card?.name || "").trim();
  const treatment = String(card?.treatment || "").trim();
  const cardNumber = String(card?.cardNumber || sealedRipChaseCardNumber(original)).trim().toUpperCase();
  let base = original;

  // Remove only an explicitly extracted treatment phrase, never generic player-name words.
  if (treatment) {
    const escaped = treatment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    base = base.replace(new RegExp(`(?:\\[|\\()?\\s*${escaped}\\s*(?:\\]|\\))?`, "ig"), " ");
  }

  // Bracketed/parenthetical and pipe/dash segments are safe places to remove obvious treatments.
  base = base.replace(/\[([^\]]{1,100})\]|\(([^)]{1,100})\)/g, (whole, square, paren) => {
    const inner = square || paren || "";
    return sealedRipChaseTreatmentSegment(inner) ? " " : whole;
  });
  base = base.split(/\s+(?:\||·|[-–—])\s+/).filter(segment => !sealedRipChaseTreatmentSegment(segment)).join(" ");

  // Sports serial numbering is usually presented as " /249". Preserve collector numbers such as 199/165.
  base = base.replace(/\s+\/\s*\d{1,6}\b/g, " ");

  if (cardNumber) {
    const escapedNumber = cardNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    base = base
      .replace(new RegExp(`#\\s*${escapedNumber}\\b`, "ig"), " ")
      .replace(new RegExp(`\\b(?:CN|collector\\s*(?:no\\.?|number)?|card\\s*(?:no\\.?|number))\\s*[:#-]?\\s*${escapedNumber}\\b`, "ig"), " ")
      .replace(new RegExp(`\\b${escapedNumber}\\b`, "ig"), " ");
  }

  // These are treatment nouns, not identity-bearing card concepts. Keep autograph/relic/rookie/insert wording.
  base = base.replace(/\b(?:parallel|refractor|foil|holo(?:graphic)?|borderless|showcase|extended art|numbered)\b/ig, " ");
  base = base.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  if (!base) base = original.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  const key = `${base}${cardNumber ? `|#${cardNumber.toLowerCase()}` : ""}`;
  const label = `${base}${cardNumber ? ` #${cardNumber}` : ""}`.trim();
  return { key, label, cardNumber };
}

function sealedRipChaseCanonicalKey(card = {}) {
  return sealedRipChaseCanonicalIdentity(card).key;
}

function sealedRipChaseIdentityGroups(cards = []) {
  const groups = new Map();
  for (const row of (Array.isArray(cards) ? cards : [])) {
    const price = Number(row?.marketPrice);
    if (!Number.isFinite(price) || price <= 0) continue;
    const canonical = sealedRipChaseCanonicalIdentity(row);
    const key = canonical.key || String(row?.name || "").toLowerCase();
    if (!groups.has(key)) groups.set(key, { key, label: canonical.label, variants: [], representative: null });
    const group = groups.get(key);
    group.variants.push(row);
    if (!group.representative || price > Number(group.representative.marketPrice || 0)) group.representative = row;
  }
  return [...groups.values()].filter(group => group.representative);
}

function sealedRipChaseDepthMetrics(cards = []) {
  const verifiedRows = (Array.isArray(cards) ? cards : [])
    .filter(row => Number.isFinite(Number(row?.marketPrice)) && Number(row.marketPrice) > 0)
    .slice()
    .sort((a,b) => Number(b.marketPrice)-Number(a.marketPrice));
  if (verifiedRows.length < 2) return {
    available:false, score:null, label:"N/A",
    summary:"Scout could not verify enough set-level singles prices to measure chase depth yet.",
    count20:0, count50:0, count100:0, top5Total:null, top10Total:null, concentration:null,
    uniqueCount:verifiedRows.length, variantCount:verifiedRows.length, parallelBreadth:0, diversityRatio:null,
  };

  const groups = sealedRipChaseIdentityGroups(verifiedRows);
  const uniqueRows = groups.map(group => group.representative)
    .sort((a,b) => Number(b.marketPrice)-Number(a.marketPrice));
  const variantCount = verifiedRows.length;
  const uniqueCount = uniqueRows.length;
  const parallelBreadth = Math.max(0, variantCount - uniqueCount);
  const diversityRatio = variantCount > 0 ? uniqueCount / variantCount : 0;
  const prices = uniqueRows.map(row => Number(row.marketPrice));
  const count20 = prices.filter(x => x >= 20).length;
  const count50 = prices.filter(x => x >= 50).length;
  const count100 = prices.filter(x => x >= 100).length;
  const top5Total = Number(prices.slice(0,5).reduce((a,b)=>a+b,0).toFixed(2));
  const top10Total = Number(prices.slice(0,10).reduce((a,b)=>a+b,0).toFixed(2));
  const concentration = top10Total > 0 && prices.length ? prices[0] / top10Total : 1;

  // Score only canonical chase identities. Extra parallels are reported as breadth, not counted as extra $20/$50/$100 chases.
  let score = 20;
  score += Math.min(24, count20 * 3);
  score += Math.min(18, count50 * 5);
  score += Math.min(14, count100 * 7);
  score += top10Total >= 1500 ? 20 : top10Total >= 750 ? 16 : top10Total >= 400 ? 12 : top10Total >= 200 ? 8 : top10Total >= 100 ? 4 : 0;
  if (concentration >= .75) score -= 18;
  else if (concentration >= .60) score -= 12;
  else if (concentration >= .45) score -= 6;
  if (uniqueCount < 2) score = Math.min(score, 35);
  else if (uniqueCount < 4) score = Math.min(score, 58);
  score = Math.max(0, Math.min(100, Math.round(score)));

  const label = uniqueCount <= 1 && variantCount >= 2 ? "CONCENTRATED"
    : concentration >= .68 && count20 <= 4 ? "LOTTERY-TICKET"
    : score >= 78 ? "DEEP" : score >= 62 ? "SOLID" : score >= 45 ? "MODERATE" : "THIN";
  const top = uniqueRows[0];
  const summary = `${label} set-level chase pool · ${uniqueCount} unique chase identit${uniqueCount===1?"y":"ies"} across ${variantCount} verified priced variant${variantCount===1?"":"s"} · ${parallelBreadth} extra parallel/treatment variant${parallelBreadth===1?"":"s"} · ${count100} unique at $100+ · ${count50} at $50+ · ${count20} at $20+ · top 10 unique values total $${top10Total.toFixed(2)}${top?.name?` · top canonical chase: ${top.name} ($${Number(top.marketPrice).toFixed(2)})`:""}. Exact-format access is scored separately.`;
  return {
    available:true, score, label, summary, count20, count50, count100, top5Total, top10Total,
    concentration:Number(concentration.toFixed(3)), uniqueCount, variantCount, parallelBreadth,
    diversityRatio:Number(diversityRatio.toFixed(3)),
  };
}
'''
worker = worker[:start] + new_block + worker[end:]

output_anchor = '''    chaseDepthTop10Total: chaseDepth.top10Total,
    chaseDepthConcentration: chaseDepth.concentration,
    chaseValueCards,
'''
output_replacement = '''    chaseDepthTop10Total: chaseDepth.top10Total,
    chaseDepthConcentration: chaseDepth.concentration,
    chaseDepthUniqueCount: chaseDepth.uniqueCount,
    chaseDepthVariantCount: chaseDepth.variantCount,
    chaseDepthParallelBreadth: chaseDepth.parallelBreadth,
    chaseDepthDiversityRatio: chaseDepth.diversityRatio,
    chaseValueCards,
'''
if output_anchor not in worker:
    raise SystemExit('normalized Chase Depth output anchor not found')
worker = worker.replace(output_anchor, output_replacement, 1)

assert_anchor = '''assert.ok(app.includes('CHASE DEPTH'),'Showdown must display Chase Depth');
'''
assert_add = '''assert.ok(app.includes('CHASE DEPTH'),'Showdown must display Chase Depth');
assert.match(worker,/function sealedRipChaseCanonicalIdentity/,'Chase Depth must canonicalize parallel treatments into core card identities');
assert.match(worker,/function sealedRipChaseIdentityGroups/,'Chase Depth must group verified price-guide rows by canonical card identity');
assert.ok(worker.includes('const uniqueRows = groups.map(group => group.representative)'),'Chase Depth thresholds must use one representative price per canonical identity');
assert.ok(worker.includes('const parallelBreadth = Math.max(0, variantCount - uniqueCount)'),'parallel breadth must be measured separately from unique chase depth');
assert.ok(worker.includes('chaseDepthUniqueCount'),'normalized response must expose unique chase identity count');
assert.ok(worker.includes('top 10 unique values total'),'Chase Depth summary must describe canonicalized value totals');
'''
if assert_anchor not in tests:
    raise SystemExit('test assertion anchor not found')
tests = tests.replace(assert_anchor, assert_add, 1)

canonical_test = r'''const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const worker = fs.readFileSync('src/index.js','utf8');
const start = worker.indexOf('function sealedRipChaseTreatmentSegment');
const end = worker.indexOf('function sealedRipPriceGuideEvidenceText', start);
assert.ok(start >= 0 && end > start, 'canonical Chase Depth helper block must be extractable');
const sandbox = {};
vm.runInNewContext(worker.slice(start,end) + '\nthis.__api={sealedRipChaseCanonicalIdentity,sealedRipChaseIdentityGroups,sealedRipChaseDepthMetrics};', sandbox);
const {sealedRipChaseCanonicalIdentity, sealedRipChaseDepthMetrics} = sandbox.__api;

const shaiA = {name:'Shai Gilgeous-Alexander [Rainbow Green Blue] #268 /249', treatment:'Rainbow Green Blue', marketPrice:153.88};
const shaiB = {name:'Shai Gilgeous-Alexander [Red] #268 /99', treatment:'Red', marketPrice:120.00};
assert.strictEqual(sealedRipChaseCanonicalIdentity(shaiA).key, sealedRipChaseCanonicalIdentity(shaiB).key, 'same numbered card in two parallel treatments must share one identity');

const draymond = sealedRipChaseCanonicalIdentity({name:'Draymond Green #55', treatment:'', marketPrice:50});
assert.ok(draymond.key.includes('draymond green'), 'player surname Green must not be stripped as a color treatment');

const charizardA = {name:'Charizard ex 199/165 - Special Illustration Rare', treatment:'Special Illustration Rare', marketPrice:95};
const charizardB = {name:'Charizard ex 199/165 [Holo]', treatment:'Holo', marketPrice:80};
assert.strictEqual(sealedRipChaseCanonicalIdentity(charizardA).key, sealedRipChaseCanonicalIdentity(charizardB).key, 'same collector-number card treatments must canonicalize together');

const other = {name:'Pikachu ex 238/191 - Special Illustration Rare', treatment:'Special Illustration Rare', marketPrice:70};
const metrics = sealedRipChaseDepthMetrics([shaiA, shaiB, charizardA, charizardB, other]);
assert.strictEqual(metrics.variantCount, 5, 'all verified variants should remain visible as breadth');
assert.strictEqual(metrics.uniqueCount, 3, 'parallel variants must collapse to three core chase identities');
assert.strictEqual(metrics.parallelBreadth, 2, 'two duplicate-treatment variants should be counted as breadth only');
assert.strictEqual(metrics.count100, 1, '$100+ count must use canonical representatives, not parallel duplicates');
assert.strictEqual(metrics.count50, 3, '$50+ count must use three unique identities');
assert.strictEqual(metrics.top10Total, 318.88, 'top value total must sum only highest price per canonical identity');
assert.ok(metrics.summary.includes('3 unique chase identities across 5 verified priced variants'), 'summary must explain unique depth versus variant breadth');

const concentrated = sealedRipChaseDepthMetrics([shaiA, shaiB]);
assert.strictEqual(concentrated.uniqueCount, 1, 'two parallels of one card are one chase identity');
assert.strictEqual(concentrated.label, 'CONCENTRATED', 'parallel-only depth should be labeled concentrated');
assert.ok(concentrated.score <= 35, 'one canonical chase identity must be capped conservatively');

console.log('Chase Depth canonicalization tests passed.');
'''

worker_path.write_text(worker, encoding='utf-8')
test_path.write_text(tests, encoding='utf-8')
canonical_test_path.write_text(canonical_test, encoding='utf-8')
print('Chase Depth canonicalization applied.')
