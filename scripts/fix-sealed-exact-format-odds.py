from pathlib import Path

p = Path('src/index.js')
text = p.read_text(encoding='utf-8')


def repl(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f'missing pattern: {label}')
    text = text.replace(old, new, 1)

repl('const VERSION = "3.40.3";', 'const VERSION = "3.40.4";', 'version')
repl('return `sealed:intel:v5:${encodeURIComponent(parts.join("|")).slice(0, 420)}`;', 'return `sealed:intel:v6:${encodeURIComponent(parts.join("|")).slice(0, 420)}`;', 'sealed cache')

anchor = '''function sealedRipOddsRowSupported(row, evidenceRows, identity = {}) {
'''
helpers = r'''function sealedRipExactFormatKey(identity = {}) {
  const type = String(identity?.boxType || identity?.productType || "").trim().toLowerCase();
  if (/blaster/.test(type)) return "blaster";
  if (/mega/.test(type)) return "mega";
  if (/hobby/.test(type)) return "hobby";
  if (/retail\s+box/.test(type)) return "retail_box";
  if (/hanger\s+box/.test(type)) return "hanger_box";
  if (/hanger\s+pack/.test(type)) return "hanger_pack";
  if (/(?:value|fat)\s+pack/.test(type)) return "value_pack";
  if (/elite\s+trainer|\betb\b/.test(type)) return "etb";
  if (/booster\s+bundle/.test(type)) return "booster_bundle";
  if (/booster\s+box/.test(type)) return "booster_box";
  if (/booster\s+pack/.test(type)) return "booster_pack";
  if (/collection\s+box/.test(type)) return "collection_box";
  if (/\btin\b/.test(type)) return "tin";
  if (/multi[- ]?pack/.test(type)) return "multi_pack";
  if (/single\s+pack/.test(type)) return "single_pack";
  return "";
}

function sealedRipExplicitFormatKeys(value) {
  const text = String(value || "").toLowerCase().replace(/[–—]/g, "-");
  const keys = new Set();
  const rules = [
    ["value_box", /\bvalue\s+box\b/],
    ["blaster", /\bblaster(?:\s+box)?\b/],
    ["mega", /\bmega(?:\s+box)?\b/],
    ["hobby", /\bhobby(?:\s+box)?\b/],
    ["retail_box", /\bretail\s+box\b/],
    ["hanger_box", /\bhanger\s+box\b/],
    ["hanger_pack", /\bhanger\s+pack\b/],
    ["value_pack", /\b(?:value|fat)\s+pack\b/],
    ["etb", /\belite\s+trainer\s+box\b|\betb\b/],
    ["booster_bundle", /\bbooster\s+bundle\b/],
    ["booster_box", /\bbooster\s+box\b/],
    ["booster_pack", /\bbooster\s+pack\b/],
    ["collection_box", /\bcollection\s+box\b/],
    ["tin", /\btin\b/],
    ["multi_pack", /\bmulti[- ]?pack\b/],
    ["single_pack", /\bsingle\s+pack\b/],
  ];
  for (const [key, pattern] of rules) if (pattern.test(text)) keys.add(key);
  return keys;
}

function sealedRipCompatibleFormatKeys(identity = {}) {
  const exact = sealedRipExactFormatKey(identity);
  const keys = new Set(exact ? [exact] : []);
  const category = String(identity?.category || "");
  // UPC catalogs often call ordinary sports retail blasters "Value Box".
  // Treat that wording as the same retail configuration, but never Hanger/Hobby/Mega.
  if (exact === "blaster" && ["Baseball", "Basketball", "Football"].includes(category)) keys.add("value_box");
  return keys;
}

function sealedRipFormatTextCompatible(value, identity = {}) {
  const explicit = sealedRipExplicitFormatKeys(value);
  if (!explicit.size) return true;
  const compatible = sealedRipCompatibleFormatKeys(identity);
  if (!compatible.size) return true;
  return Array.from(explicit).some(key => compatible.has(key));
}

function sealedRipVariantTextCompatible(value, identity = {}) {
  const text = String(value || "").toLowerCase();
  const identityText = `${identity?.variant || ""} ${identity?.boxType || identity?.productType || ""}`.toLowerCase();
  for (const marker of ["fanatics", "walmart", "target"]) {
    if (new RegExp(`\\b${marker}\\b`, "i").test(text) && !identityText.includes(marker)) return false;
  }
  return true;
}

'''
repl(anchor, helpers + anchor, 'format helpers')

old = '''  const odds = simplify(row?.odds);
  if (!item || !odds) return false;
  const wantsAuthority = /official|checklist|manufacturer/i.test(String(row?.sourceType || ""));
'''
new = '''  const odds = simplify(row?.odds);
  if (!item || !odds) return false;
  const rowFormatText = `${row?.note || ""} ${row?.item || ""}`;
  if (!sealedRipFormatTextCompatible(rowFormatText, identity)) return false;
  if (!sealedRipVariantTextCompatible(rowFormatText, identity)) return false;
  const wantsAuthority = /official|checklist|manufacturer/i.test(String(row?.sourceType || ""));
'''
repl(old, new, 'row format gate')

old_prompt = '''Only include an odds string in pullOdds when that exact odds text is literally supported by the supplied evidence and applies to this exact product format. If reliable format-specific odds are not supported, set pullEvidenceAvailable=false and return an empty pullOdds array.'''
new_prompt = '''Only include an odds string in pullOdds when that exact odds text is literally supported by the supplied evidence and applies to this exact product format. Every pullOdds.note MUST name the applicable sealed format/configuration when the source distinguishes formats (for example Value Box, Blaster, Hanger Box, Hobby, Mega, Fanatics, Booster Box, Bundle, or ETB). Never return odds labeled for a different format or retailer-exclusive variant. If reliable format-specific odds are not supported, set pullEvidenceAvailable=false and return an empty pullOdds array.'''
repl(old_prompt, new_prompt, 'main prompt format rule')

old_recovery = '''Use ONLY the excerpts below. Preserve any rate exactly as written (for example 1:7 or 1 hit per 8 packs) and label community samples as community/reported, never official. Do not estimate, infer, or invent names or rates. If no literal rate is present, return pullOdds=[].'''
new_recovery = '''Use ONLY the excerpts below. Preserve any rate exactly as written (for example 1:7 or 1 hit per 8 packs) and label community samples as community/reported, never official. For every pullOdds row, note MUST name the format/configuration the excerpt assigns to that rate; omit rows for Hanger/Hobby/Mega/Fanatics or any other format that does not match the requested exact product. Do not estimate, infer, or invent names or rates. If no literal rate is present, return pullOdds=[].'''
repl(old_recovery, new_recovery, 'recovery prompt format rule')

p.write_text(text, encoding='utf-8')

# Regression assertions.
t = Path('tests/sealed-product-vision.test.cjs')
txt = t.read_text(encoding='utf-8')
if 'assert.match(worker,/const VERSION = "3\\.40\\.3"/);' not in txt:
    raise SystemExit('missing old version assertion')
txt = txt.replace('assert.match(worker,/const VERSION = "3\\.40\\.3"/);', 'assert.match(worker,/const VERSION = "3\\.40\\.4"/);', 1)
if "assert.match(worker,/sealed:intel:v5:/,'sealed product intelligence must use a reusable product cache');" not in txt:
    raise SystemExit('missing old cache assertion')
txt = txt.replace("assert.match(worker,/sealed:intel:v5:/,'sealed product intelligence must use a reusable product cache');", "assert.match(worker,/sealed:intel:v6:/,'sealed product intelligence must use a reusable product cache');", 1)
needle = "assert.match(worker,/sealedRipTemperCollectorSummary/,'collector copy must suppress unsupported promotional conclusions');\n"
if needle not in txt:
    raise SystemExit('missing assertion anchor')
extra = """assert.match(worker,/function sealedRipFormatTextCompatible/,'pull odds must enforce exact sealed-format compatibility');
assert.match(worker,/function sealedRipVariantTextCompatible/,'retailer-exclusive pull odds must match the scanned variant');
assert.ok(worker.includes('keys.add(\"value_box\")'),'sports Value Box wording must remain compatible with standard Blaster classification');
assert.ok(worker.includes('Every pullOdds.note MUST name the applicable sealed format'),'AI extraction must label the format attached to every supported odd');
"""
txt = txt.replace(needle, needle + extra, 1)
t.write_text(txt, encoding='utf-8')
