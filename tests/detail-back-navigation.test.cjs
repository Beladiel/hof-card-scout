const fs=require('fs');
const assert=require('assert');
const src=fs.readFileSync('index.html','utf8');

assert.match(src,/let returnScreen="homeScreen";\s*let shopReturnScreen="homeScreen";/,'detail and shop return destinations should be stored separately');
assert.match(src,/const activeScreen=document\.querySelector\("\.screen\.active"\)\?\.id\|\|"homeScreen";\s*shopReturnScreen=activeScreen;\s*if\(activeScreen!=="detailScreen"\)returnScreen=activeScreen;/,'opening Card Shop from a player must not overwrite the player list destination');
assert.match(src,/\$\("detailBack"\)\.addEventListener\("click",\(\)=>showScreen\(returnScreen\|\|"homeScreen"\)\);/,'detail Back should use the player return destination');
assert.match(src,/\$\("shopBack"\)\.addEventListener\("click",\(\)=>showScreen\(shopReturnScreen==="shopScreen"\?"homeScreen":shopReturnScreen\)\);/,'Card Shop Back should use its own return destination');

console.log('Detail back navigation tests passed.');
