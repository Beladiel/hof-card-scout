from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')

css_old='.collection-snapshot-saved{margin:9px 0 0;border:1px solid rgba(86,197,138,.36);border-radius:11px;background:rgba(86,197,138,.09);color:#9ce8bb;padding:8px 10px;font-size:10px;font-weight:850;line-height:1.4}'
css_new=css_old+'\n.collection-snapshot-skipped{margin:9px 0 0;border:1px solid rgba(230,189,99,.42);border-radius:11px;background:rgba(230,189,99,.08);color:#f4d58a;padding:8px 10px;font-size:10px;font-weight:850;line-height:1.4}'
assert css_old in s, 'snapshot CSS marker not found'
s=s.replace(css_old,css_new,1)

old='''  const comps=Number(data.used)||0;\n  const provider=data.provider||"eBay sold comps";'''
new='''  const comps=Number(data.used)||0;\n  const collectionValueExact=!!(ctx.p?.owned&&window.ScoutCollectionValue&&ScoutCollectionValue.exactRepresentativeMatch(ctx.p,card));\n  let collectionValueNotice="";\n  if(data.collectionSnapshotSaved){\n    collectionValueNotice='<div class="collection-snapshot-saved">✓ COLLECTION VALUE SNAPSHOT SAVED · This exact representative card now has a dated value point.</div>';\n  }else if(collectionValueExact){\n    let why="Scout did not add this market check to your collection history.";\n    if(comps<2)why=`Only ${comps} reliable sold comp${comps===1?"":"s"} found. Scout needs at least 2 before adding a value point.`;\n    else if(String(data.confidence||"").toLowerCase()==="insufficient")why="Sold evidence is still rated INSUFFICIENT. Scout did not add this result to your collection history.";\n    else if(!Number.isFinite(Number(data.median))||Number(data.median)<=0)why="No trustworthy positive market estimate was available, so Scout did not add a value point.";\n    collectionValueNotice='<div class="collection-snapshot-skipped">⚠ VALUE NOT SAVED · '+escapeHtml(why)+'</div>';\n  }\n  const provider=data.provider||"eBay sold comps";'''
assert old in s, 'renderLiveResult comp marker not found'
s=s.replace(old,new,1)

old='''    ${data.collectionSnapshotSaved?'<div class="collection-snapshot-saved">✓ COLLECTION VALUE SNAPSHOT SAVED · This exact representative card now has a dated value point.</div>':''}\n    ${labHtml}'''
new='''    ${collectionValueNotice}\n    ${labHtml}'''
assert old in s, 'saved snapshot banner marker not found'
s=s.replace(old,new,1)

p.write_text(s,encoding='utf-8')
