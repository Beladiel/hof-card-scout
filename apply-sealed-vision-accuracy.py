from pathlib import Path

p=Path('src/index.js')
s=p.read_text(encoding='utf-8')
s=s.replace('const VERSION = "3.35.0";','const VERSION = "3.36.0";',1)
s=s.replace('const SEALED_VISION_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";','const SEALED_VISION_MODEL = "@cf/moondream/moondream3.1-9B-A2B";',1)

old='''function sealedVisionNormalize(raw) {
  const categoryRaw = String(raw?.category || "").trim();
  const typeRaw = String(raw?.productType || raw?.boxType || "").trim();
  const confidenceRaw = String(raw?.confidence || "low").trim().toLowerCase();
  const category = SEALED_VISION_CATEGORIES.has(categoryRaw) ? categoryRaw : (categoryRaw ? "Other" : "");
  const productType = SEALED_VISION_PRODUCT_TYPES.has(typeRaw) ? typeRaw : (typeRaw ? "Other" : "");
  const clues = Array.isArray(raw?.clues) ? raw.clues.map(x => String(x || "").trim()).filter(Boolean).slice(0, 4) : [];
  return {
    category,
    year: String(raw?.year || "").trim().slice(0, 40),
    set: String(raw?.set || raw?.brandSet || "").trim().slice(0, 120),
    productType,
    variant: String(raw?.variant || "").trim().slice(0, 120),
    confidence: ["high", "medium", "low"].includes(confidenceRaw) ? confidenceRaw : "low",
    clues,
    needsAnotherPhoto: Boolean(raw?.needsAnotherPhoto),
    followUp: String(raw?.followUp || "").trim().slice(0, 180),
  };
}
'''
new='''function sealedVisionNormalize(raw) {
  const categoryRaw = String(raw?.category || "").trim();
  const typeRaw = String(raw?.productType || raw?.boxType || "").trim();
  const confidenceRaw = String(raw?.confidence || "low").trim().toLowerCase();
  const visibleText = String(raw?.visibleText || raw?.text || "").trim().slice(0, 800);
  const clues = Array.isArray(raw?.clues) ? raw.clues.map(x => String(x || "").trim()).filter(Boolean).slice(0, 4) : [];
  const evidence = [visibleText, raw?.set, raw?.brandSet, raw?.variant, ...clues].map(x => String(x || "")).join(" ");
  let category = SEALED_VISION_CATEGORIES.has(categoryRaw) ? categoryRaw : (categoryRaw ? "Other" : "");
  if (/\\bNBA\\b|\\bbasketball\\b|\\bNBA\\s+Hoops\\b/i.test(evidence)) category = "Basketball";
  else if (/\\bNFL\\b|\\bfootball\\b/i.test(evidence)) category = "Football";
  else if (/\\bMLB\\b|\\bbaseball\\b/i.test(evidence)) category = "Baseball";
  else if (/Pok[eé]mon|Trading Card Game|\\bTCG\\b/i.test(evidence)) category = "Pokémon";
  else if (/Magic:\\s*The Gathering|\\bMTG\\b|Wizards of the Coast/i.test(evidence)) category = "Magic: The Gathering";

  let year = String(raw?.year || "").trim().slice(0, 40);
  if (!year) {
    const ym = evidence.match(/\\b(20\\d{2})(?:\\s*[-–/]\\s*(\\d{2,4}))?\\b/);
    if (ym) year = ym[2] ? `${ym[1]}-${ym[2].length === 2 ? ym[2] : ym[2].slice(-2)}` : ym[1];
  }
  let set = String(raw?.set || raw?.brandSet || "").trim().slice(0, 120);
  if (!set && /\\bNBA\\s+Hoops\\b/i.test(evidence)) set = "NBA Hoops";

  const productType = SEALED_VISION_PRODUCT_TYPES.has(typeRaw) ? typeRaw : (typeRaw ? "Other" : "");
  const incomplete = !category || !set || !productType || productType === "Other";
  return {
    category,
    year,
    set,
    productType,
    variant: String(raw?.variant || "").trim().slice(0, 120),
    confidence: ["high", "medium", "low"].includes(confidenceRaw) ? confidenceRaw : "low",
    clues,
    visibleText,
    needsAnotherPhoto: Boolean(raw?.needsAnotherPhoto) || incomplete,
    followUp: String(raw?.followUp || (incomplete ? "Take another straight-on photo closer to the product name, year/season, and pack-count wording." : "")).trim().slice(0, 180),
  };
}
'''
if old not in s: raise SystemExit('normalize block not found')
s=s.replace(old,new,1)

old_call='''        const raw = await env.AI.run(SEALED_VISION_MODEL, {
          messages: [
            { role: "system", content: "You are Scout, a careful trading-card sealed-product identifier. Accuracy matters more than guessing." },
            { role: "user", content: prompt }
          ],
          image: imageDataUrl,
          guided_json: schema,
          temperature: 0.1,
          max_tokens: 320
        });'''
new_call='''        const moondreamQuestion = `${prompt} First transcribe ALL readable packaging text you can see, especially league/category words (NBA, NFL, MLB, Pokémon, Magic), the year/season, product/set name, and pack/card counts. Then return ONLY one JSON object with keys category, year, set, productType, variant, confidence, clues, visibleText, needsAnotherPhoto, followUp. Never infer Pokémon from artwork alone. NBA or NBA Hoops means Basketball. If a required field is unreadable, leave it blank and request another photo instead of guessing.`;
        const raw = await env.AI.run(SEALED_VISION_MODEL, {
          task: "query",
          image: imageDataUrl,
          question: moondreamQuestion
        });'''
if old_call not in s: raise SystemExit('AI call block not found')
s=s.replace(old_call,new_call,1)

# Keep the schema variable harmless but update prompt language to emphasize evidence.
s=s.replace('Read visible packaging text carefully: year/season, brand/set, format, pack/card counts, retail-exclusive wording, and variant clues.', 'Read visible packaging text carefully and use those words as primary evidence: year/season, league/category, brand/set, format, pack/card counts, retail-exclusive wording, and variant clues.',1)
p.write_text(s,encoding='utf-8')

# Update Worker version expectations.
for test in Path('tests').glob('*.test.cjs'):
    t=test.read_text(encoding='utf-8')
    t=t.replace("'3.35.0'", "'3.36.0'")
    t=t.replace('"3.35.0"', '"3.36.0"')
    t=t.replace('3\\.35\\.0','3\\.36\\.0')
    test.write_text(t,encoding='utf-8')

# Extend vision test if present.
tp=Path('tests/sealed-product-vision.test.cjs')
if tp.exists():
    t=tp.read_text(encoding='utf-8')
    if 'moondream3.1-9B-A2B' not in t:
        t += '''\n// Accuracy regression: sealed product vision must use OCR-oriented Moondream and textual category guards.\nassert.match(worker,/moondream3\\.1-9B-A2B/,'sealed vision should use the OCR-oriented Moondream model');\nassert.match(worker,/NBA\\\\b[\\s\\S]*category = \\"Basketball\\"|NBA\\\\s\\+Hoops/,'NBA evidence should force Basketball rather than artwork-based guesses');\n'''
    tp.write_text(t,encoding='utf-8')
