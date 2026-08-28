const assert=require('node:assert/strict');
const fs=require('node:fs');

const worker=fs.readFileSync('src/index.js','utf8');
const wrangler=fs.readFileSync('wrangler.jsonc','utf8');
const ui=fs.readFileSync('automation-budget.js','utf8');

assert.match(worker,/const VERSION = "3\.37\.0";/);
assert.match(worker,/async scheduled\(controller, env, ctx\)/,'Worker must expose a scheduled handler');
assert.match(worker,/runScheduledAutomation\(env, now\)/,'scheduled handler must use the combined protected scheduler');
assert.match(worker,/runOneAutomationTargetCheck\(env, state, catalog, now, \{ dueOnly: true \}\)/,'cron must give due targets first priority');
assert.match(worker,/Number\(targetRun\.result\?\.searchUsed\) > 0/,'a target search must stop the same cron wake-up before collection search');
assert.match(worker,/runOneAutomationCollectionCheck\(env, state, catalog, now\)/,'collection rotation may run only after target priority clears');
assert.match(worker,/cadenceDays \* 24 \* 60 \* 60 \* 1000/,'target cadence must be enforced before spending a search');
assert.match(worker,/No saved target is due yet\. Scout used zero searches\./,'not-due target wakeups must spend zero target searches');
assert.match(worker,/maxQueries: 1/,'target search remains limited to one query');
assert.match(worker,/runnerEnabled: true, targetRunnerEnabled: true, collectionRunnerEnabled: true/,'both protected runners must report enabled');
assert.match(worker,/AUTOMATION_COLLECTION_MIN_GAP_MS = 3 \* 24 \* 60 \* 60 \* 1000/,'collection runner retains three-day pacing');
assert.match(worker,/AUTOMATION_COLLECTION_TIMEOUT_COOLDOWN_MS = 7 \* 24 \* 60 \* 60 \* 1000/,'collection runner retains timeout cooldown');
assert.match(wrangler,/"crons"\s*:\s*\["15 16 \* \* \*"\]/,'daily cron wake-up must remain configured');
assert.match(ui,/TARGET \+ VALUE ON/,'UI should identify both protected runners');
assert.match(ui,/Target monitoring \+ paced collection-value rotation/,'UI should explain final automation state');

console.log('Combined automation scheduler tests passed.');
