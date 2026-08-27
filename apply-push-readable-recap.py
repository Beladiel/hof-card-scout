from pathlib import Path

# Make notifications useful without tapping them: the banner itself carries the recap.
p=Path('scout-push-sw.js')
s=p.read_text(encoding='utf-8')
old=s
needle='if(res.ok&&data.ok){title=data.title||title;body=data.body||body;id=data.id||id;}'
replacement='if(res.ok&&data.ok){title=data.title||title;body=data.body||body;id=data.id||id;if(String(data.id||"")==="ready"){title="🔔 Scout notification test";body="Example: Orlando Cepeda checked · $11.38 delivered vs $30 max · 1 search used. Real alerts will show their actual recap here.";}}'
assert needle in s
s=s.replace(needle,replacement,1)
p.write_text(s,encoding='utf-8')

p=Path('push-notifications.js')
u=p.read_text(encoding='utf-8')
old=u
needle='setStatus("✓ Test sent — 0 SerpApi searches used. Watch for the phone notification.","ok");'
replacement='setStatus("✓ Test sent — 0 SerpApi searches used. Read the notification itself; on iPhone you do not need to tap it. Real-search details are also saved permanently in Automation Activity.","ok");'
assert needle in u
u=u.replace(needle,replacement,1)
needle='After a real scheduled target or collection search, your phone gets a short recap: who Scout checked, whether a deal/value was found, and whether anything was updated. Zero-search wake-ups stay silent. Push delivery itself uses 0 SerpApi searches.'
replacement='After a real scheduled target or collection search, the notification itself shows the useful recap: who Scout checked, the result, and whether anything changed. You do not need to tap it on iPhone. Zero-search wake-ups stay silent, and the permanent record remains in Automation Activity.'
assert needle in u
u=u.replace(needle,replacement,1)
p.write_text(u,encoding='utf-8')

p=Path('tests/push-notifications.test.cjs')
t=p.read_text(encoding='utf-8')
needle="assert.match(sw,/searchParams\\.set\\(\"push\"/,'each notification carries a deep-link id');"
extra="assert.match(sw,/Scout notification test/,'test push should be readable without tapping');\nassert.match(sw,/Orlando Cepeda checked/,'test push should demonstrate a realistic search recap');\nassert.match(ui,/Read the notification itself/,'UI should tell iPhone users the push is self-contained');"
assert needle in t
if extra not in t:
    t=t.replace(needle,needle+'\n'+extra,1)
p.write_text(t,encoding='utf-8')
