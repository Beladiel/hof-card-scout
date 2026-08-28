from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing expected text for {label}")
    return text.replace(old, new, 1)

worker_path = Path('src/index.js')
worker = worker_path.read_text(encoding='utf-8')
worker = replace_once(worker, 'const VERSION = "3.38.10";', 'const VERSION = "3.38.11";', 'worker version')
worker = replace_once(worker, 'sealed:rip:v7:', 'sealed:rip:v8:', 'rip cache version')

worker = replace_once(
    worker,
    'async function sealedRipGoogleSearch(query, apiKey) {',
    'async function sealedRipGoogleSearch(query, apiKey, timeoutMs = 15000) {',
    'research search timeout signature',
)
worker = replace_once(
    worker,
    '  const timeout = setTimeout(() => controller.abort(), 10000);',
    '  const timeout = setTimeout(() => controller.abort(), Math.max(8000, Number(timeoutMs) || 15000));',
    'research search timeout',
)

old_query = '''      const authoritySite = sealedRipPrimaryAuthoritySite(identity?.category);
      const checklistQuery = `"${exactSet}" ${formatTerms} ${authoritySite}`.trim();
      const communityQuery = `"${exactSet}" ${formatTerms} pulls review ${sealedRipCommunitySite(identity?.category)}`;'''
new_query = '''      const authoritySite = sealedRipPrimaryAuthoritySite(identity?.category);
      // Authority discovery should identify the SET page, not require the page title/snippet
      // to mention the exact retail format. Beckett's set page contains the Value/Blaster
      // odds in the body, but forcing "blaster"/"value box" into discovery can suppress it.
      // Avoid a quoted season string too: sources may write 2025-26, 2025/26, or 2025 26.
      const authorityYear = String(identity?.year || "").replace(/[^0-9]+/g, " ").trim();
      const authorityCategory = String(identity?.category || "").trim().toLowerCase();
      const checklistQuery = `${authorityYear} ${researchSet} ${authorityCategory} ${authoritySite}`.replace(/\\s+/g, " ").trim();
      const communityQuery = `"${exactSet}" ${formatTerms} pulls review ${sealedRipCommunitySite(identity?.category)}`;'''
worker = replace_once(worker, old_query, new_query, 'authority discovery query')

# Give the authoritative lookup a little extra network budget while leaving the
# community lookup at the normal budget. Both still run in parallel and remain two searches total.
worker = replace_once(
    worker,
    '          sealedRipGoogleSearch(checklistQuery, env.SERPAPI_KEY),\n          sealedRipGoogleSearch(communityQuery, env.SERPAPI_KEY),',
    '          sealedRipGoogleSearch(checklistQuery, env.SERPAPI_KEY, 18000),\n          sealedRipGoogleSearch(communityQuery, env.SERPAPI_KEY, 12000),',
    'authority/community search budgets',
)

worker_path.write_text(worker, encoding='utf-8')

test_path = Path('tests/sealed-product-vision.test.cjs')
test = test_path.read_text(encoding='utf-8')
test = test.replace('3\\.38\\.10', '3\\.38\\.11', 1)
test = test.replace('sealed:rip:v7:', 'sealed:rip:v8:', 1)
stale = "assert.match(worker,/const checklistQuery = `\\\"\\$\\{exactSet\\}\\\" \\$\\{formatTerms\\} \\$\\{authoritySite\\}`\\.trim\\(\\)/,'authoritative search must use the single primary authority site');\n"
test = test.replace(stale, '')
anchor = "assert.match(worker,/site:beckett\\.com/,'sports rip research must force the authoritative search onto Beckett');\n"
extra = anchor + "assert.match(worker,/const authorityYear = String\\(identity\\?\\.year/,'authority discovery must normalize season punctuation');\nassert.match(worker,/const checklistQuery = `\\$\\{authorityYear\\} \\$\\{researchSet\\} \\$\\{authorityCategory\\} \\$\\{authoritySite\\}`/,'authority discovery must search the set broadly without requiring retail-format terms');\nassert.match(worker,/sealedRipGoogleSearch\\(checklistQuery, env\\.SERPAPI_KEY, 18000\\)/,'authority discovery must have enough timeout budget to finish');\n"
if 'authority discovery must normalize season punctuation' not in test:
    test = replace_once(test, anchor, extra, 'authority query regression checks')
test_path.write_text(test, encoding='utf-8')
