from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing expected text for {label}")
    return text.replace(old, new, 1)

worker_path = Path('src/index.js')
worker = worker_path.read_text(encoding='utf-8')
worker = replace_once(worker, 'const VERSION = "3.38.0";', 'const VERSION = "3.38.1";', 'worker version')

old = r'''    if (!title || /\b(?:case\s+break|break\s+spot|empty\s+box|box\s+only|opened|wrapper|digital|you\s+pick|single\s+card)\b/i.test(title)) continue;'''
new = r'''    if (!title || /\b(?:case\s+break|break\s+spot|rip\s*(?:&|and)\s*ship|live\s+rip|rip\s+ship|personal\s+break|team\s+break|random\s+team|empty\s+box|box\s+only|opened|wrapper|digital|you\s+pick|single\s+card)\b/i.test(title)) continue;'''
worker = replace_once(worker, old, new, 'sealed invalid-listing filter')
worker_path.write_text(worker, encoding='utf-8')

test_path = Path('tests/sealed-product-vision.test.cjs')
test = test_path.read_text(encoding='utf-8')
test = replace_once(test, 'assert.match(worker,/const VERSION = "3\\.38\\.0"/);', 'assert.match(worker,/const VERSION = "3\\.38\\.1"/);', 'test version')
needle = "assert.match(worker,/engine\\\", \\\"ebay/,'sealed market check must use the eBay search engine');\n"
insert = needle + "assert.ok(worker.includes('rip\\\\s*(?:&|and)\\\\s*ship'),'sealed market check must reject rip-and-ship listings');\n"
if 'sealed market check must reject rip-and-ship listings' not in test:
    test = replace_once(test, needle, insert, 'rip-and-ship regression test')
test_path.write_text(test, encoding='utf-8')
