const assert=require('node:assert/strict');
const fs=require('node:fs');

const worker=fs.readFileSync('src/index.js','utf8');
const wrangler=fs.readFileSync('wrangler.jsonc','utf8');
const ui=fs.readFileSync('automation-budget.js','utf8');

assert.match(worker,/const VERSION = "3\.29\.0";/);
assert.match(worker,/async scheduled\(controller, env, ctx\)/,'Worker must expose a scheduled handler');
assert.match(worker,/runScheduledTargetMonitor\(env, now\)/,'scheduled handler must use target-only automation helper');
assert.match(worker,/runOneAutomationTargetCheck\(env, state, catalog, now, \{ dueOnly: true \}\)/,'cron must use due-only target checks');
assert.match(worker,/cadenceDays \* 24 \* 60 \* 60 \* 1000/,'target cadence must be enforced before spending a search');
assert.match(worker,/No saved target is due yet\. Scout used zero searches\./,'not-due wakeups must spend zero searches');
assert.match(worker,/maxQueries: 1/,'target search remains limited to one query');
assert.match(worker,/runnerEnabled: true, targetRunnerEnabled: true, collectionRunnerEnabled: false/,'target scheduler is on while collection runner remains off');
assert.doesNotMatch(worker,/runScheduledCollection/,'collection rotation must not be scheduled in this gate');

assert.match(wrangler,/"crons"\s*:\s*\["15 16 \* \* \*"\]/,'daily cron wake-up must be configured');
assert.match(ui,/TARGET MONITOR ON/,'UI should identify target-only automation');
assert.match(ui,/Collection rotation is still off/,'UI must make staged collection rotation explicit');

console.log('Scheduled target-monitor tests passed.');
