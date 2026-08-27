const assert=require("node:assert/strict");
const fs=require("node:fs");
const photos=require("../card-photo.js");
const html=fs.readFileSync("index.html","utf8");
const worker=fs.readFileSync("src/index.js","utf8");

assert.equal(photos.fingerprintForPlayer({owned:false,name:"Sandy Koufax"}),"");
const fp=photos.fingerprintForPlayer({owned:true,name:"Sandy Koufax",cardYear:1965,set:"Topps",cardNum:"300",grader:"PSA",gradeCondition:"6"});
assert.match(fp,/^[a-f0-9]{8}$/);
assert.equal(fp,photos.fingerprintForPlayer({owned:true,name:"Sandy Koufax",cardYear:1965,set:"Topps",cardNum:"300",grader:"PSA",gradeCondition:"6"}));
assert.notEqual(fp,photos.fingerprintForPlayer({owned:true,name:"Sandy Koufax",cardYear:1966,set:"Topps",cardNum:"100",grader:"PSA",gradeCondition:"6"}));

assert.match(html,/v6\.0\.1/);
assert.match(html,/id="cardPhotoPanel"/);
assert.match(html,/id="cardPhotoCameraInput"[^>]*capture="environment"/);
assert.match(html,/id="cardPhotoLibraryInput"/);
assert.match(html,/<script src="card-photo\.js"><\/script>/);
assert.match(html,/ScoutCardPhotos\.init\(\{getConfig:pricingConfig,toast\}\)/);
assert.match(html,/ScoutCardPhotos\.showPlayer\(p\)/);
assert.match(html,/id="cardPhotoLightbox"/);

assert.match(worker,/const VERSION = "3\.34\.0"/);
assert.match(worker,/CARD_PHOTO_PREFIX/);
assert.match(worker,/CARD_PHOTO_MAX_BYTES = 1200 \* 1024/);
assert.match(worker,/url\.pathname === "\/card-photo"/);
assert.match(worker,/\["GET", "POST", "DELETE"\]/);
assert.match(worker,/getWithMetadata\(key, \{ type: "arrayBuffer" \}\)/);
assert.match(worker,/SCOUT_DATA\.put\(key, bytes, \{ metadata:/);
assert.match(worker,/SCOUT_DATA\.delete\(key\)/);
assert.match(worker,/X-Scout-Photo-Fingerprint/);
assert.match(worker,/X-Scout-Card-Fingerprint/);
assert.match(worker,/Access-Control-Allow-Methods.*DELETE/);

const client=fs.readFileSync("card-photo.js","utf8");
assert.match(client,/MAX_DIMENSION=1600/);
assert.match(client,/TARGET_BYTES=900\*1024/);
assert.match(client,/indexedDB/);
assert.match(client,/canvas\.toBlob/);
assert.match(client,/method:"POST"/);
assert.match(client,/method:"DELETE"/);
assert.match(client,/previous representative card/);
console.log("Representative card photo tests passed.");
