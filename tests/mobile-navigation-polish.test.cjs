const assert=require("node:assert/strict");
const fs=require("node:fs");
const html=fs.readFileSync("index.html","utf8");

assert.match(html,/v5\.5\.0/);
assert.match(html,/v5\.5\.0 — mobile \/ navigation polish/);
assert.match(html,/id="homeBtn"[^>]*hidden/);
assert.match(html,/\$\("homeBtn"\)\.hidden=id==="homeScreen"/);
assert.match(html,/position:sticky;top:env\(safe-area-inset-top\)/);
assert.match(html,/\.quick-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(html,/#findTargetRankStrip,#monthlyRankStrip\{display:flex!important/);
assert.match(html,/scroll-snap-type:x mandatory/);
assert.match(html,/\.hunt-actions\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(html,/\.data-modal-backdrop\{place-items:end center;padding:0\}/);
assert.match(html,/@media\(max-width:380px\)/);
assert.match(html,/prefers-reduced-motion/);
assert.match(html,/focused&&\/\^\(INPUT\|TEXTAREA\|SELECT\)\$\//);
console.log("Mobile/navigation polish tests passed.");
