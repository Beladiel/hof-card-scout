const assert=require('node:assert/strict');
const fs=require('node:fs');
const budget=require('../automation-budget.js');

const defaults=budget.normalizeSettings({});
assert.equal(defaults.monthlySerpCap,30);
assert.equal(defaults.targetCadenceDays,7);
assert.equal(defaults.collectionCardsPerMonth,10);
assert.equal(defaults.targetMonitoringEnabled,true);
assert.equal(defaults.collectionRefreshEnabled,true);

const estimate=budget.estimateMonthlyDemand(4,defaults);
assert.equal(estimate.targetSearches,20,'weekly monitoring should budget one search per target check');
assert.equal(estimate.collectionSearches,10);
assert.equal(estimate.total,30);
assert.equal(estimate.hardCap,30);
assert.equal(budget.remaining(30,17),13);
assert.equal(budget.remaining(30,99),0);
assert.equal(Math.round(budget.pct(15,30)),50);

const html=fs.readFileSync('index.html','utf8');
assert.match(html,/automation-budget\.js/,'automation budget UI must be wired into the app');

const worker=fs.readFileSync('src/index.js','utf8');
assert.match(worker,/const VERSION = "3\.34\.0";/);
assert.match(worker,/AUTOMATION_STATE_KEY = "automation:state:v1"/);
assert.match(worker,/url\.pathname === "\/automation\/status"/);
assert.match(worker,/url\.pathname === "\/automation\/settings"/);
assert.match(worker,/monthlySerpCap: 30/);
assert.match(worker,/function automationCanSpendSerp\(/);
assert.match(worker,/function automationReserveSerp\(/);
assert.match(worker,/runnerEnabled: true, targetRunnerEnabled: true, collectionRunnerEnabled: true/,'target monitoring may be scheduled while collection rotation remains off');
assert.match(worker,/scheduled\s*\(/,'target monitor cron should now be enabled');

console.log('Automation budget tests passed.');
