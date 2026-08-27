from pathlib import Path

p = Path("src/index.js")
s = p.read_text(encoding="utf-8")

old_version = 'const VERSION = "3.36.0";'
if old_version not in s:
    raise SystemExit("Expected Worker version 3.36.0 not found")
s = s.replace(old_version, 'const VERSION = "3.36.1";', 1)

old_parser = '''  let value = raw?.response ?? raw?.result ?? raw;
  if (value && typeof value === "object" && !Array.isArray(value)) return value;'''
new_parser = '''  let value = raw?.response ?? raw?.result ?? raw?.answer ?? raw;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if ("category" in value || "productType" in value || "set" in value) return value;
    throw new Error("Unexpected sealed vision response envelope.");
  }'''
if old_parser not in s:
    raise SystemExit("Expected sealed vision parser block not found")
s = s.replace(old_parser, new_parser, 1)

old_call = '''        const raw = await env.AI.run(SEALED_VISION_MODEL, {
          task: "query",
          image: imageDataUrl,
          question: moondreamQuestion
        });'''
new_call = '''        const raw = await env.AI.run(SEALED_VISION_MODEL, {
          task: "query",
          image: imageDataUrl,
          question: moondreamQuestion,
          reasoning: false,
          stream: false,
          temperature: 0.1,
          max_tokens: 700
        });'''
if old_call not in s:
    raise SystemExit("Expected Moondream AI call block not found")
s = s.replace(old_call, new_call, 1)
p.write_text(s, encoding="utf-8")

for test in Path("tests").glob("*.test.cjs"):
    t = test.read_text(encoding="utf-8")
    t = t.replace("3\\.36\\.0", "3\\.36\\.1")
    t = t.replace('"3.36.0"', '"3.36.1"')
    t = t.replace("'3.36.0'", "'3.36.1'")
    test.write_text(t, encoding="utf-8")

test = Path("tests/sealed-product-vision.test.cjs")
t = test.read_text(encoding="utf-8")
anchor = "assert.match(worker,/@cf\\/moondream\\/moondream3\\.1-9B-A2B/,'Cloudflare-hosted vision model must be used');"
addition = "\nassert.match(worker,/raw\\?\\.answer/,'Moondream query answer envelope must be parsed');\nassert.match(worker,/stream:\\s*false/,'Moondream query must use non-streaming output for deterministic parsing');"
if addition.strip() not in t:
    if anchor not in t:
        raise SystemExit("Sealed vision regression anchor not found")
    t = t.replace(anchor, anchor + addition, 1)
    test.write_text(t, encoding="utf-8")
