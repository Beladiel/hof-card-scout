'use strict';
const assert = require('node:assert/strict');
const Core = require('../dist/core.js');

function validState() {
  return Core.createDemoState();
}

// Phase 1: validation and safe content boundaries.
assert.equal(Core.validateState(validState()).valid, true);
for (const mutate of [
  state => { delete state.storage.shrine; },
  state => { state.runs[0].outcome = '<img src=x onerror=alert(1)>'; },
  state => { state.storage.regular.count = 121; },
  state => { state.toa.Hard.current = 80; state.toa.Hard.best = 40; },
  state => { state.runs[0].seconds = -3; },
]) {
  const state = validState();
  mutate(state);
  assert.equal(Core.validateState(state).valid, false);
  assert.throws(() => Core.normalizeImport(state));
}

const htmlLike = validState();
htmlLike.runs[0].notes = '<b>harmless test</b>';
assert.equal(Core.normalizeImport(htmlLike).runs[0].notes, '<b>harmless test</b>');

// Phase 2: migration, separate ToA modes and comparable dungeon statistics.
const migrated = Core.migrateV1({
  schemaVersion: 1,
  demoData: true,
  preferences: { pveOnly: true, f2p: true },
  toa: { mode: 'Hard', current: 20, best: 30, target: 25, notes: 'legacy' },
  storage: { regular: { count: 1, capacity: 2 }, storage: { count: 2, capacity: 3 }, shrine: { count: 3, capacity: 4 } },
  runs: [], previousBest: {}, guideNotes: { 4: 'dragon note' }, updatedAt: new Date().toISOString(),
});
assert.equal(migrated.toa.Hard.current, 20);
assert.equal(migrated.toa.Normal.current, 0);
assert.equal(migrated.guideNotes['dragons-lair'], 'dragon note');

const state = validState();
const dragonStats = Core.calculateStats(state.runs, { dungeon: "Dragon's Lair", difficulty: 'Abyss Hard', team: '' }, state.historicalBest);
assert.deepEqual({ comparable: dragonStats.comparable, wins: dragonStats.wins, losses: dragonStats.losses }, { comparable: 3, wins: 2, losses: 1 });
assert.equal(dragonStats.winPercent.toFixed(1), '66.7');
assert.equal(dragonStats.fastest, 97.825);
assert.equal(dragonStats.average, (102.4 + 97.825) / 2);
assert.equal(dragonStats.historicalBest, 95.5);

const teamStats = Core.calculateStats(state.runs, { dungeon: "Dragon's Lair", difficulty: 'Abyss Hard', team: 'Demo safe team' }, state.historicalBest);
assert.equal(teamStats.comparable, 3);

// Phase 3: strict time parsing and millisecond precision.
assert.equal(Core.parseTime('1:42.250'), 102.25);
assert.equal(Core.parseTime('42.5'), 42.5);
assert.equal(Core.parseTime(''), null);
assert.equal(Number.isNaN(Core.parseTime('1:99')), true);
assert.equal(Number.isNaN(Core.parseTime('60:00')), true);
assert.equal(Core.formatTime(102.25), '1:42.250');

console.log('All Summoner Scout core regression tests passed.');

