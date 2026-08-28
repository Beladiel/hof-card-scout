from pathlib import Path

p = Path('src/index.js')
text = p.read_text(encoding='utf-8')


def repl(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f'missing pattern: {label}')
    text = text.replace(old, new, 1)

repl('const VERSION = "3.40.1";', 'const VERSION = "3.40.2";', 'version')
repl('return `sealed:intel:v3:${encodeURIComponent(parts.join("|")).slice(0, 420)}`;', 'return `sealed:intel:v4:${encodeURIComponent(parts.join("|")).slice(0, 420)}`;', 'sealed cache')

anchor = '''function sealedRipClampScore(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}

'''
helper = '''function sealedRipClampScore(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}

function sealedRipOddsDenominator(value) {
  const text = String(value || "").trim();
  const match = text.match(/\\b1\\s*(?::|\\/)\\s*(\\d{1,6})\\b/i) || text.match(/\\b1\\s+(?:in|per)\\s+(\\d{1,6})\\b/i);
  const n = match ? Number(match[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function sealedRipVerifiedPullScore(rawScore, pullOdds = []) {
  const aiScore = sealedRipClampScore(rawScore);
  const denominators = (Array.isArray(pullOdds) ? pullOdds : [])
    .map(row => sealedRipOddsDenominator(row?.odds))
    .filter(n => Number.isFinite(n) && n > 0);
  if (!denominators.length) return aiScore;

  // Pull score measures how frequently supported non-base outcomes can appear;
  // chase desirability/value is scored separately. Verified literal odds therefore
  // prevent a contradictory 0/100 when the same response lists real pull odds.
  const best = Math.min(...denominators);
  let floor = best <= 3 ? 50
    : best <= 5 ? 46
    : best <= 8 ? 42
    : best <= 12 ? 38
    : best <= 20 ? 34
    : best <= 50 ? 30
    : 22;
  floor += Math.min(8, Math.max(0, denominators.length - 1) * 2);
  return Math.max(aiScore, Math.min(70, floor));
}

function sealedRipTemperCollectorLanguage(value, communitySourceCount = 0) {
  let text = String(value || "").trim();
  if (communitySourceCount < 3) {
    text = text
      .replace(/\\bmany collectors\\b/gi, "the collector discussions Scout found")
      .replace(/\\bmost collectors\\b/gi, "the collector discussions Scout found")
      .replace(/\\bcollector consensus\\b/gi, "the available collector discussions")
      .replace(/\\boverall, the collector sentiment is\\b/gi, "In the available collector discussions, sentiment is");
  }
  return text;
}

'''
repl(anchor, helper, 'helpers')

repl('''  const hasCommunitySource = evidenceRows.some(row => row?.sourceType === "community");
  const sentimentEvidenceAvailable = Boolean(raw?.sentimentEvidenceAvailable) && hasCommunitySource;
''', '''  const communitySourceCount = evidenceRows.filter(row => row?.sourceType === "community").length;
  const sentimentEvidenceAvailable = Boolean(raw?.sentimentEvidenceAvailable) && communitySourceCount >= 2;
''', 'sentiment evidence gate')

repl('''    pullScore: pullEvidenceAvailable ? sealedRipClampScore(raw?.pullScore) : null,
''', '''    pullScore: pullEvidenceAvailable ? sealedRipVerifiedPullScore(raw?.pullScore, pullOdds) : null,
''', 'pull score normalization')

repl('''    collectorTake: sentimentEvidenceAvailable ? String(raw?.collectorTake || "").trim().slice(0, 700) : "Scout did not find enough recurring exact-product collector discussion to score sentiment.",
''', '''    collectorTake: sentimentEvidenceAvailable ? sealedRipTemperCollectorLanguage(raw?.collectorTake, communitySourceCount).slice(0, 700) : "Scout did not find enough recurring exact-product collector discussion to score sentiment.",
''', 'collector language')

repl('''Set sentimentEvidenceAvailable=false when community evidence is too thin. Keep conclusions conservative when evidence is thin.
''', '''Set sentimentEvidenceAvailable=false when community evidence is too thin; require recurring support from at least two independent community sources. Product/checklist facts are not collector sentiment by themselves. Never say "many collectors", "most collectors", "collector consensus", or make another broad consensus claim unless at least three independent community sources support the same recurring theme. Keep conclusions conservative when evidence is thin.
''', 'prompt sentiment rules')

p.write_text(text, encoding='utf-8')

# Update source-level regression assertions in the existing sealed tests.
t = Path('tests/sealed-product-vision.test.cjs')
txt = t.read_text(encoding='utf-8')
if 'assert.match(worker,/const VERSION = "3\\.40\\.1"/);' not in txt:
    raise SystemExit('missing old version assertion')
txt = txt.replace('assert.match(worker,/const VERSION = "3\\.40\\.1"/);', 'assert.match(worker,/const VERSION = "3\\.40\\.2"/);', 1)
if "assert.match(worker,/sealed:intel:v3:/,'sealed product intelligence must use a reusable product cache');" not in txt:
    raise SystemExit('missing old cache assertion')
txt = txt.replace("assert.match(worker,/sealed:intel:v3:/,'sealed product intelligence must use a reusable product cache');", "assert.match(worker,/sealed:intel:v4:/,'sealed product intelligence must use a reusable product cache');", 1)
needle = "console.log('Sealed Product Scout vision tests passed.');"
if needle not in txt:
    raise SystemExit('missing test completion marker')
checks = """
assert.match(worker,/function sealedRipVerifiedPullScore/,'verified pull odds must protect against contradictory zero pull scores');
assert.match(worker,/communitySourceCount >= 2/,'collector sentiment must require recurring community evidence');
assert.ok(worker.includes('Never say \"many collectors\"'),'collector synthesis must avoid broad consensus claims from thin evidence');
"""
txt = txt.replace(needle, checks + '\n' + needle, 1)
t.write_text(txt, encoding='utf-8')
