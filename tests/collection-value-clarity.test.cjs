const fs=require('fs');
const s=fs.readFileSync('index.html','utf8');
function must(text,msg){if(!s.includes(text))throw new Error(msg)}
must('collection-snapshot-skipped','missing skipped valuation style');
must('⚠ VALUE NOT SAVED · ','missing explicit not-saved valuation banner');
must('Only ${comps} reliable sold comp${comps===1?"":"s"} found. Scout needs at least 2 before adding a value point.','missing thin-market explanation');
must('Sold evidence is still rated INSUFFICIENT. Scout did not add this result to your collection history.','missing insufficient-confidence explanation');
must('const collectionValueExact=!!(ctx.p?.owned&&window.ScoutCollectionValue&&ScoutCollectionValue.exactRepresentativeMatch(ctx.p,card));','not-saved banner is not restricted to the exact representative card');
console.log('collection value clarity test passed');
