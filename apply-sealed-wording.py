from pathlib import Path

p=Path('sealed-product-scout.js')
s=p.read_text(encoding='utf-8')
old=s
replacements={
    'Too many boxes. One simple decision.':'Too many sealed choices. One simple decision.',
    'Take a front photo or enter the product yourself. Scout will confirm exactly what you mean before any pricing research happens. This first gate uses <strong>0 marketplace searches</strong>.':'Scan a pack, hanger, tin, bundle, box, or other sealed product. Scout will confirm exactly what you mean before any pricing research happens. This first gate uses <strong>0 marketplace searches</strong>.',
    'STEP 1 · SHOW SCOUT THE BOX':'STEP 1 · SHOW SCOUT THE PRODUCT',
    'No box photo yet.<br>Try to fill the frame with the front panel.':'No sealed-product photo yet.<br>Try to fill the frame with the front panel.',
    '<option>Blaster Box</option><option>Mega Box</option><option>Hobby Box</option><option>Retail Box</option><option>Elite Trainer Box</option><option>Booster Box</option><option>Booster Bundle</option><option>Collection Box</option><option>Tin</option><option>Other</option>':'<option>Blaster Box</option><option>Mega Box</option><option>Hobby Box</option><option>Retail Box</option><option>Hanger Box</option><option>Hanger Pack</option><option>Value / Fat Pack</option><option>Single Pack</option><option>Multi-Pack</option><option>Elite Trainer Box</option><option>Booster Box</option><option>Booster Bundle</option><option>Booster Pack</option><option>Collection Box</option><option>Tin</option><option>Other</option>',
    'That file is not an image. Try a photo of the box front.':'That file is not an image. Try a photo of the sealed product front.',
    'photoName:String(file.name||"box photo")':'photoName:String(file.name||"sealed product photo")',
    'Enter the brand or set name you can read on the box.':'Enter the brand or set name you can read on the product.',
    'Choose the product type so Scout does not compare the wrong box format.':'Choose the product type so Scout does not compare the wrong sealed format.',
    'Scout will not attach a price to an uncertain box.':'Scout will not attach a price to an uncertain product.',
    '📦 SEALED PRODUCT SCOUT · SCAN A BOX':'📦 SCAN SEALED PRODUCT'
}
for a,b in replacements.items():
    if a not in s:
        raise SystemExit(f'missing expected text: {a}')
    s=s.replace(a,b)
if s==old:
    raise SystemExit('no changes made')
p.write_text(s,encoding='utf-8')

p=Path('index.html')
h=p.read_text(encoding='utf-8')
h=h.replace('v6.0.0','v6.0.1')
h=h.replace('version:"6.0.0"','version:"6.0.1"')
p.write_text(h,encoding='utf-8')

for test in Path('tests').glob('*.test.cjs'):
    t=test.read_text(encoding='utf-8')
    t=t.replace('v6\\.0\\.0','v6\\.0\\.1')
    t=t.replace('v6.0.0','v6.0.1')
    t=t.replace('version:"6.0.0"','version:"6.0.1"')
    test.write_text(t,encoding='utf-8')
