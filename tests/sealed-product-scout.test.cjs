const assert=require('node:assert/strict');
const fs=require('node:fs');
const js=fs.readFileSync('sealed-product-scout.js','utf8');
const html=fs.readFileSync('index.html','utf8');

assert.match(js,/id=\"sealedProductScreen\"/,'dedicated Sealed Product Scout screen must exist');
assert.match(js,/sealedProductScoutBtn/,'home-screen Sealed Product Scout button must exist');
assert.match(js,/SCAN SEALED PRODUCT/,'home button should be obvious');
assert.match(js,/capture=\"environment\"/,'iPhone camera capture should prefer the rear camera');
assert.match(js,/accept=\"image\/\*\"/,'photo input should accept images');
assert.match(js,/CHOOSE PHOTO/,'existing-photo fallback should exist');
assert.match(js,/ENTER PRODUCT/,'manual entry fallback should exist');
assert.match(js,/Pokémon/);
assert.match(js,/Magic: The Gathering/);
assert.match(js,/Baseball/);
assert.match(js,/Basketball/);
assert.match(js,/Football/);
assert.match(js,/CONFIRM THIS PRODUCT · 0 SEARCHES/,'identity confirmation must be explicitly zero-search');
assert.match(js,/SAVE SHELF PRICE · 0 SEARCHES/,'shelf-price capture must be explicitly zero-search');
assert.match(js,/GOOD BUY \/ FAIR \/ PASS/,'next verdict stage should be clearly previewed');
assert.match(js,/localStorage\.setItem\(DRAFT_KEY/,'confirmed product details should persist locally');
assert.match(js,/showScreen\(\"sealedProductScreen\"\)/,'new mode should use the existing app navigation');
assert.doesNotMatch(js,/\bfetch\s*\(/,'first gate must not call any network API');
assert.doesNotMatch(js,/SerpApi|\/value|\/deals|runEbaySearch/,'first gate must not invoke marketplace pricing code');
assert.match(html,/sealed-product-scout\.js/,'index must load the Sealed Product Scout module');
assert.match(html,/sealed-product-scout\.js\?v=6\.0\.2/,'cache-busted sealed product module should force fresh iPhone code');
assert.match(html,/v6\.0\.2/,'app version should identify the Sealed Product Scout launch');

console.log('Sealed Product Scout first-gate tests passed.');
