(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SummonerScoutCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SCHEMA_VERSION = 2;
  const MODES = ['Normal', 'Hard'];
  const OUTCOMES = ['Win', 'Loss'];
  const MAX_TEXT = 2000;
  const GUIDE_IDS = ['summoners-way', 'monster-menu', 'sealed-shrine', 'profile-records', 'dragons-lair', 'toa'];

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function finiteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function validText(value, max = MAX_TEXT) {
    return typeof value === 'string' && value.length <= max;
  }

  function emptyMode() {
    return { current: 0, best: 0, target: 10, notes: '' };
  }

  function createDemoState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      demoData: true,
      preferences: { pveOnly: true, f2p: true },
      toa: {
        Normal: { current: 82, best: 100, target: 90, notes: 'Fictional demo auto team' },
        Hard: { current: 37, best: 61, target: 50, notes: 'Fictional demo control team' },
      },
      storage: {
        regular: { count: 84, capacity: 120 },
        storage: { count: 196, capacity: 220 },
        shrine: { count: 73, capacity: 100 },
      },
      runs: [
        { id: 'demo-dragon-1', dungeon: "Dragon's Lair", difficulty: 'Abyss Hard', outcome: 'Win', seconds: 102.4, team: 'Demo safe team', notes: 'Fictional demonstration record', createdAt: '2026-11-12T18:00:00.000Z' },
        { id: 'demo-dragon-2', dungeon: "Dragon's Lair", difficulty: 'Abyss Hard', outcome: 'Win', seconds: 97.825, team: 'Demo safe team', notes: 'Fictional demonstration record', createdAt: '2026-11-12T18:05:00.000Z' },
        { id: 'demo-dragon-3', dungeon: "Dragon's Lair", difficulty: 'Abyss Hard', outcome: 'Loss', seconds: null, team: 'Demo safe team', notes: 'Fictional demonstration record', createdAt: '2026-11-12T18:10:00.000Z' },
        { id: 'demo-giant-1', dungeon: "Giant's Keep", difficulty: 'Abyss Hard', outcome: 'Win', seconds: 88.25, team: 'Demo fast team', notes: 'Fictional demonstration record', createdAt: '2026-11-12T18:15:00.000Z' },
      ],
      historicalBest: { "Dragon's Lair|Abyss Hard": 95.5, "Giant's Keep|Abyss Hard": 88.25 },
      guideNotes: {},
      updatedAt: new Date().toISOString(),
    };
  }

  function validateMode(value, path, errors) {
    if (!isObject(value)) return errors.push(`${path} must be an object`);
    for (const key of ['current', 'best', 'target']) {
      if (!Number.isInteger(value[key]) || value[key] < (key === 'target' ? 1 : 0) || value[key] > 100) {
        errors.push(`${path}.${key} must be an integer from ${key === 'target' ? 1 : 0} to 100`);
      }
    }
    if (Number.isInteger(value.current) && Number.isInteger(value.best) && value.current > value.best) errors.push(`${path}.current cannot exceed historical best`);
    if (Number.isInteger(value.current) && Number.isInteger(value.target) && value.target < value.current) errors.push(`${path}.target cannot be below current floor`);
    if (!validText(value.notes)) errors.push(`${path}.notes must be text under ${MAX_TEXT} characters`);
  }

  function validateStorage(value, path, errors) {
    if (!isObject(value)) return errors.push(`${path} must be an object`);
    if (!Number.isInteger(value.count) || value.count < 0 || value.count > 10000) errors.push(`${path}.count must be an integer from 0 to 10000`);
    if (!Number.isInteger(value.capacity) || value.capacity < 0 || value.capacity > 10000) errors.push(`${path}.capacity must be an integer from 0 to 10000`);
    if (Number.isInteger(value.count) && Number.isInteger(value.capacity) && value.count > value.capacity) errors.push(`${path}.count cannot exceed capacity`);
  }

  function validateRun(run, index, errors) {
    const path = `runs[${index}]`;
    if (!isObject(run)) return errors.push(`${path} must be an object`);
    if (!validText(run.id, 100) || !run.id) errors.push(`${path}.id is required`);
    if (!validText(run.dungeon, 100) || !run.dungeon.trim()) errors.push(`${path}.dungeon is required`);
    if (!validText(run.difficulty, 100) || !run.difficulty.trim()) errors.push(`${path}.difficulty is required`);
    if (!OUTCOMES.includes(run.outcome)) errors.push(`${path}.outcome must be Win or Loss`);
    if (run.seconds !== null && (!finiteNumber(run.seconds) || run.seconds <= 0 || run.seconds > 3600)) errors.push(`${path}.seconds must be null or a number from 0 to 3600`);
    if (!validText(run.team, 200)) errors.push(`${path}.team must be text under 200 characters`);
    if (!validText(run.notes)) errors.push(`${path}.notes must be text under ${MAX_TEXT} characters`);
    if (!validText(run.createdAt, 100) || Number.isNaN(Date.parse(run.createdAt))) errors.push(`${path}.createdAt must be a valid date`);
  }

  function validateState(value) {
    const errors = [];
    if (!isObject(value)) return { valid: false, errors: ['Backup root must be an object'] };
    if (value.schemaVersion !== SCHEMA_VERSION) errors.push(`schemaVersion must be ${SCHEMA_VERSION}`);
    if (!isObject(value.preferences) || typeof value.preferences.pveOnly !== 'boolean' || typeof value.preferences.f2p !== 'boolean') errors.push('preferences must contain boolean pveOnly and f2p values');
    if (!isObject(value.toa)) errors.push('toa must be an object');
    else MODES.forEach(mode => validateMode(value.toa[mode], `toa.${mode}`, errors));
    if (!isObject(value.storage)) errors.push('storage must be an object');
    else ['regular', 'storage', 'shrine'].forEach(key => validateStorage(value.storage[key], `storage.${key}`, errors));
    if (!Array.isArray(value.runs) || value.runs.length > 10000) errors.push('runs must be an array with at most 10000 records');
    else {
      value.runs.forEach((run, index) => validateRun(run, index, errors));
      const ids = value.runs.map(run => run && run.id);
      if (new Set(ids).size !== ids.length) errors.push('run IDs must be unique');
    }
    if (!isObject(value.historicalBest)) errors.push('historicalBest must be an object');
    else Object.entries(value.historicalBest).forEach(([key, seconds]) => {
      if (!validText(key, 250) || !finiteNumber(seconds) || seconds <= 0 || seconds > 3600) errors.push(`historicalBest.${key} is invalid`);
    });
    if (!isObject(value.guideNotes)) errors.push('guideNotes must be an object');
    else Object.entries(value.guideNotes).forEach(([id, note]) => {
      if (!GUIDE_IDS.includes(id) || !validText(note)) errors.push(`guideNotes.${id} is invalid`);
    });
    if (!validText(value.updatedAt, 100) || Number.isNaN(Date.parse(value.updatedAt))) errors.push('updatedAt must be a valid date');
    return { valid: errors.length === 0, errors };
  }

  function migrateV1(value) {
    if (!isObject(value) || value.schemaVersion !== 1) throw new Error('Not a version-1 backup');
    const mode = MODES.includes(value.toa && value.toa.mode) ? value.toa.mode : 'Hard';
    const migrated = createDemoState();
    migrated.demoData = Boolean(value.demoData);
    migrated.preferences = isObject(value.preferences) ? value.preferences : { pveOnly: true, f2p: true };
    migrated.toa = { Normal: emptyMode(), Hard: emptyMode() };
    migrated.toa[mode] = {
      current: Number(value.toa && value.toa.current),
      best: Number(value.toa && value.toa.best),
      target: Number(value.toa && value.toa.target),
      notes: String((value.toa && value.toa.notes) || ''),
    };
    migrated.storage = value.storage;
    migrated.runs = Array.isArray(value.runs) ? value.runs : [];
    migrated.historicalBest = isObject(value.previousBest) ? value.previousBest : {};
    migrated.guideNotes = {};
    if (isObject(value.guideNotes)) Object.entries(value.guideNotes).forEach(([index, note]) => {
      const id = GUIDE_IDS[Number(index)];
      if (id) migrated.guideNotes[id] = String(note);
    });
    migrated.updatedAt = validText(value.updatedAt, 100) ? value.updatedAt : new Date().toISOString();
    const result = validateState(migrated);
    if (!result.valid) throw new Error(`Version-1 data is invalid: ${result.errors.join('; ')}`);
    return migrated;
  }

  function normalizeImport(value) {
    const normalized = value && value.schemaVersion === 1 ? migrateV1(value) : value;
    const result = validateState(normalized);
    if (!result.valid) throw new Error(result.errors.slice(0, 5).join('; '));
    return JSON.parse(JSON.stringify(normalized));
  }

  function parseTime(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    const match = text.match(/^(?:(\d{1,2}):)?(\d{1,2})(?:\.(\d{1,3}))?$/);
    if (!match) return NaN;
    const minutes = Number(match[1] || 0);
    const seconds = Number(match[2]);
    if (seconds >= 60 || minutes > 59) return NaN;
    const milliseconds = match[3] ? Number(match[3].padEnd(3, '0')) : 0;
    const total = minutes * 60 + seconds + milliseconds / 1000;
    return total > 0 && total <= 3600 ? total : NaN;
  }

  function formatTime(seconds) {
    if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—';
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds - minutes * 60;
    return `${minutes}:${remainder.toFixed(3).padStart(6, '0')}`;
  }

  function runKey(run, includeTeam = false) {
    return `${run.dungeon}|${run.difficulty}${includeTeam && run.team ? `|${run.team}` : ''}`;
  }

  function calculateStats(runs, filter, historicalBest) {
    const comparable = runs.filter(run => run.dungeon === filter.dungeon && run.difficulty === filter.difficulty && (!filter.team || run.team === filter.team));
    const wins = comparable.filter(run => run.outcome === 'Win');
    const timedWins = wins.filter(run => finiteNumber(run.seconds));
    const losses = comparable.length - wins.length;
    const fastest = timedWins.length ? Math.min(...timedWins.map(run => run.seconds)) : null;
    const average = timedWins.length ? timedWins.reduce((sum, run) => sum + run.seconds, 0) / timedWins.length : null;
    const bestKey = `${filter.dungeon}|${filter.difficulty}`;
    return {
      comparable: comparable.length,
      wins: wins.length,
      losses,
      winPercent: comparable.length ? wins.length / comparable.length * 100 : 0,
      fastest,
      average,
      historicalBest: historicalBest[bestKey] ?? null,
      preliminary: comparable.length < 5,
    };
  }

  function safeClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  return { SCHEMA_VERSION, MODES, OUTCOMES, GUIDE_IDS, createDemoState, validateState, migrateV1, normalizeImport, parseTime, formatTime, runKey, calculateStats, safeClone };
});

