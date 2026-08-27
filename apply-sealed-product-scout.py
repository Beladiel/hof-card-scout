from pathlib import Path

p=Path('index.html')
h=p.read_text(encoding='utf-8')
marker='<script src="push-notifications.js"></script>\n<script>'
assert marker in h, 'helper-script marker missing'
if 'sealed-product-scout.js' not in h:
    h=h.replace(marker,'<script src="push-notifications.js"></script>\n<script src="sealed-product-scout.js"></script>\n<script>',1)
h=h.replace('v5.9.1','v6.0.0')
h=h.replace('version:"5.9.1"','version:"6.0.0"')
p.write_text(h,encoding='utf-8')

for test in Path('tests').glob('*.test.cjs'):
    text=test.read_text(encoding='utf-8')
    text=text.replace('v5\\.9\\.1','v6\\.0\\.0')
    text=text.replace('v5.9.1','v6.0.0')
    text=text.replace('version:"5.9.1"','version:"6.0.0"')
    test.write_text(text,encoding='utf-8')
