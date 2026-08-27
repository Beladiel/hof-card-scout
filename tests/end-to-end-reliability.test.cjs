const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const html=fs.readFileSync("index.html","utf8");
const script=html.match(/<script>([\s\S]*)<\/script>/);
assert.ok(script,"inline app script missing");
new vm.Script(script[1]);

assert.match(html,/v6\.0\.2/);

// Manual backup now covers every locally persistent collection/activity store.
assert.match(html,/function backupReadJson\(key\)/);
assert.match(html,/backupSchema:2/);
assert.match(html,/version:"5\.9\.0"/);
assert.match(html,/monthlyPick:monthlyPick\|\|null/);
assert.match(html,/futureHof:futureHof\|\|null/);
assert.match(html,/backupReadJson\(MONTHLY_STATE_KEY\)/);
assert.match(html,/backupReadJson\(FUTURE_HOF_STATE_KEY\)/);
assert.match(html,/COLLECTION_VALUE_HISTORY_META_KEY="__scoutCollectionValueHistoryV1"/);
assert.match(html,/hasCollectionHistory=collectionValueHistoryMeta\(edits\)\.history\.length>0/);

// Import remains compatible with legacy playerUpdates-only exports while optionally restoring new stores.
assert.match(html,/!payload\.playerUpdates\|\|typeof payload\.playerUpdates!=="object"/);
assert.match(html,/if\(hasMonthly\)localStorage\.setItem\(MONTHLY_STATE_KEY/);
assert.match(html,/if\(hasFuture\)localStorage\.setItem\(FUTURE_HOF_STATE_KEY/);
assert.match(html,/if\(hasCollectionHistory\)merged\[COLLECTION_VALUE_HISTORY_META_KEY\]=collectionHistoryRaw/);
assert.match(html,/setTimeout\(\(\)=>location\.reload\(\),450\)/);
assert.match(html,/if\(!names\.length&&!hasMonthly&&!hasFuture&&!hasCollectionHistory\)/);

// Exact-target purchases must clear the complete structured target, not leave ghost metadata.
assert.match(html,/if\(phase3aTargetMatches\(p,card\)\)clearStructuredTarget\(p\);/);
assert.doesNotMatch(html,/if\(phase3aTargetMatches\(p,card\)\)\{p\.target="";p\.targetNotes="";\}/);

// Mark Received from player detail refreshes all dependent views/counters.
assert.match(html,/savePlayerEdit\(currentPlayer\);stats\(\);rotateMission\(\);renderList\(\);renderHuntList\(\);openPlayer\(currentPlayer,returnScreen\);/);

console.log("End-to-end reliability tests passed.");
