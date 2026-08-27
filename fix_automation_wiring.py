from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')
late='<script src="automation-budget.js"></script>\n</body>'
early='<script src="shopping-report.js"></script>\n'
assert late in s, 'late automation script marker missing'
assert early in s, 'helper script marker missing'
s=s.replace(late,'</body>',1)
s=s.replace(early,early+'<script src="automation-budget.js"></script>\n',1)
p.write_text(s,encoding='utf-8')
