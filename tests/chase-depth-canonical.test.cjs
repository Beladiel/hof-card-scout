const fs = require('fs');
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
