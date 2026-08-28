const fs=require('fs');
const assert=require('assert');
const worker=fs.readFileSync('src/index.js','utf8');

assert.ok(worker.includes('const VERSION = "3.49.0";'));
assert.ok(worker.includes('sealed:intel:v20:'));
assert.ok(worker.includes('const SEALED_SHOWDOWN_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";'), 'Showdown must use the cheaper fast 8B model');
assert.ok(worker.includes('researchMode === "showdown" ? SEALED_SHOWDOWN_MODEL : SEALED_RIP_MODEL'), 'AI model selection must be mode-specific');
assert.ok(worker.includes('function sealedRipAiFailureInfo'), 'AI synthesis failures must be classified safely');
assert.ok(worker.includes('daily_quota') && worker.includes('00:00 UTC'), 'daily Workers AI quota failures must be explained to the user');
assert.ok(worker.includes('out of inference capacity'), 'capacity failures must be distinguished from evidence failures');
assert.ok(worker.includes('slice(0, 10000)'), 'authority prompt evidence must be capped more tightly');
assert.ok(worker.includes('synthesisModel: researchMode === "showdown" ? SEALED_SHOWDOWN_MODEL : SEALED_RIP_MODEL'), 'responses must expose which synthesis model was used');
assert.ok(worker.includes('synthesisFailure: aiFailure.type'), 'failed responses must expose a safe failure class');
assert.ok(worker.includes('message: aiFailure.message'), 'the phone must receive a useful safe synthesis failure message');
console.log('Showdown AI budget/diagnostic tests passed.');
