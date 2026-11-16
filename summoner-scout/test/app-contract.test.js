'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'dist', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'dist', 'repairs.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'dist', 'sw.js'), 'utf8');
const icon = fs.readFileSync(path.join(root, 'dist', 'apple-touch-icon.png'));

// Existing navigation and all repaired workflows remain wired.
for (const marker of ["home: 'Home'", "toa: 'ToA'", "dungeons: 'Dungeons'", "storage: 'Storage'", "find: 'Find It'", 'saveRun', 'deleteRun', 'confirmImport', 'restoreRecovery', 'saveState']) assert.ok(app.includes(marker), marker);

// Stable guide IDs and draft preservation; no filtered-array indexes.
assert.ok(app.includes('data-guide-id'));
assert.ok(app.includes('guideDrafts[textarea.dataset.guideId]'));
assert.ok(!app.includes('data-guide="${i}"'));

// Import safety and recovery happen before state replacement.
assert.ok(app.indexOf('localStorage.setItem(RECOVERY_KEY') < app.indexOf('state = Core.safeClone(pendingImport)'));
assert.ok(app.includes('Core.normalizeImport(parsed)'));

// Failed saves have an error path and cannot emit success unconditionally.
assert.ok(app.includes("catch (error)"));
assert.ok(app.includes("toast('Save failed', true)"));

// User-controlled display fields pass through escaping.
for (const marker of ['escapeHtml(record.notes)', 'escapeHtml(run.dungeon)', 'escapeHtml(run.difficulty)', 'escapeHtml(run.team', 'escapeHtml(run.notes', 'escapeHtml(guideDrafts']) assert.ok(app.includes(marker), marker);

// Safari download URL remains alive long enough for the transfer to start.
assert.ok(app.includes('setTimeout(() => URL.revokeObjectURL(url), 60000)'));

// Accessible, functional guide headings and mobile safe areas.
assert.ok(html.includes('<details class="item guide"') || app.includes('<details class="item guide"'));
assert.ok(css.includes('safe-area-inset-bottom'));
assert.ok(app.includes("aria-current"));
assert.ok(app.includes("main.focus"));

// Offline release includes every new asset.
for (const asset of ['core.js', 'repairs.css', 'apple-touch-icon.png']) assert.ok(sw.includes(asset), asset);

// PNG signature and 180x180 IHDR dimensions.
assert.equal(icon.subarray(1, 4).toString(), 'PNG');
assert.equal(icon.readUInt32BE(16), 180);
assert.equal(icon.readUInt32BE(20), 180);

console.log('All Summoner Scout application contract tests passed.');

