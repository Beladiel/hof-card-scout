const fs = require('fs');
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
