from pathlib import Path

p=Path('index.html')
h=p.read_text(encoding='utf-8')
old='<script src="sealed-product-scout.js"></script>'
new='<script src="sealed-product-scout.js?v=6.0.2"></script>'
if new not in h:
    if old not in h:
        raise SystemExit('sealed product script tag not found')
    h=h.replace(old,new,1)
h=h.replace('v6.0.1','v6.0.2')
h=h.replace('version:"6.0.1"','version:"6.0.2"')
p.write_text(h,encoding='utf-8')

for test in Path('tests').glob('*.test.cjs'):
    t=test.read_text(encoding='utf-8')
    t=t.replace('v6\\.0\\.1','v6\\.0\\.2')
    t=t.replace('v6.0.1','v6.0.2')
    t=t.replace('version:"6.0.1"','version:"6.0.2"')
    if test.name=='sealed-product-scout.test.cjs' and 'cache-busted sealed product module' not in t:
        anchor="assert.match(html,/sealed-product-scout\\.js/,'index must load the Sealed Product Scout module');\n"
        if anchor not in t:
            raise SystemExit('sealed product test anchor not found')
        t=t.replace(anchor,anchor+"assert.match(html,/sealed-product-scout\\.js\\?v=6\\.0\\.2/,'cache-busted sealed product module should force fresh iPhone code');\n",1)
    test.write_text(t,encoding='utf-8')
