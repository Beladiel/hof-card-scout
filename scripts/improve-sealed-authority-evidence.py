from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing expected text for {label}")
    return text.replace(old, new, 1)

worker_path = Path('src/index.js')
worker = worker_path.read_text(encoding='utf-8')
worker = replace_once(worker, 'const VERSION = "3.38.12";', 'const VERSION = "3.38.13";', 'worker version')
worker = replace_once(worker, 'sealed:rip:v9:', 'sealed:rip:v10:', 'rip cache version')

# Keep substantially more of Google's structured evidence around an authority result.
old_snippet = '''    const rich = row?.rich_snippet ? JSON.stringify(row.rich_snippet) : "";
    const about = row?.about_this_result ? JSON.stringify(row.about_this_result) : "";
    const snippet = [row?.snippet, row?.snippet_highlighted_words?.join(" "), rich, about]
      .filter(Boolean).join(" ").replace(/\\s+/g, " ").trim();'''
new_snippet = '''    const rich = row?.rich_snippet ? JSON.stringify(row.rich_snippet) : "";
    const richTable = row?.rich_snippet_table ? JSON.stringify(row.rich_snippet_table) : "";
    const about = row?.about_this_result ? JSON.stringify(row.about_this_result) : "";
    const answers = row?.answers ? JSON.stringify(row.answers) : "";
    const related = row?.related_questions ? JSON.stringify(row.related_questions) : "";
    const sitelinks = row?.sitelinks ? JSON.stringify(row.sitelinks) : "";
    const extensions = row?.extensions ? JSON.stringify(row.extensions) : "";
    const snippet = [row?.snippet, row?.snippet_highlighted_words?.join(" "), rich, richTable, answers, related, sitelinks, extensions, about]
      .filter(Boolean).join(" ").replace(/\\s+/g, " ").trim();'''
worker = replace_once(worker, old_snippet, new_snippet, 'richer organic evidence')

old_push = '''      source: String(row?.source || "").trim().slice(0, 120),
      sourceType: sealedRipSourceType(row),
      queryKind,
    });'''
new_push = '''      source: String(row?.source || "").trim().slice(0, 120),
      sourceType: sealedRipSourceType(row),
      queryKind,
      ampLink: /^https?:\\/\\//i.test(String(row?.amp_link || "")) ? String(row.amp_link).slice(0, 700) : "",
      cachedPageLink: /^https?:\\/\\//i.test(String(row?.cached_page_link || "")) ? String(row.cached_page_link).slice(0, 1000) : "",
    });'''
worker = replace_once(worker, old_push, new_push, 'authority alternate page links')

# Add a compact representation of top-level/organic SERP structures. This gives the
# model evidence even when the publisher blocks server-side page retrieval.
marker = 'async function sealedRipGoogleSearch(query, apiKey, timeoutMs = 15000) {'
helper = '''function sealedRipSerpEvidenceText(data) {
  const chunks = [];
  const add = value => {
    if (value === null || value === undefined || value === "") return;
    const text = typeof value === "string" ? value : JSON.stringify(value);
    if (text && text !== "{}" && text !== "[]") chunks.push(text);
  };
  add(data?.answer_box);
  add(data?.ai_overview);
  add(data?.related_questions);
  const rows = Array.isArray(data?.organic_results) ? data.organic_results.slice(0, 8) : [];
  for (const row of rows) {
    add({
      title: row?.title,
      link: row?.link,
      snippet: row?.snippet,
      highlighted: row?.snippet_highlighted_words,
      rich: row?.rich_snippet,
      richTable: row?.rich_snippet_table,
      answers: row?.answers,
      relatedQuestions: row?.related_questions,
      sitelinks: row?.sitelinks,
      extensions: row?.extensions,
    });
  }
  return chunks.join("\\n---\\n").replace(/\\s+/g, " ").slice(0, 24000);
}

'''
worker = replace_once(worker, marker, helper + marker, 'SERP evidence helper')

# Mobile Google results can expose AMP links. Let only the authority search request
# mobile layout; the community search stays unchanged.
worker = replace_once(
    worker,
    'async function sealedRipGoogleSearch(query, apiKey, timeoutMs = 15000) {',
    'async function sealedRipGoogleSearch(query, apiKey, timeoutMs = 15000, device = "") {',
    'search device signature',
)
worker = replace_once(
    worker,
    '  url.searchParams.set("gl", "us");\n  url.searchParams.set("api_key", apiKey);',
    '  url.searchParams.set("gl", "us");\n  if (device) url.searchParams.set("device", device);\n  url.searchParams.set("api_key", apiKey);',
    'search device parameter',
)

# Now that season punctuation is normalized, nudge Google's authority snippet toward
# exact-format odds/chases without quoting the entire product title.
old_query = '      const checklistQuery = `${authorityYear} ${researchSet} ${authorityCategory} ${authoritySite}`.replace(/\\s+/g, " ").trim();'
new_query = '      const checklistQuery = `${authorityYear} ${researchSet} ${authorityCategory} ${authoritySite} ${formatTerms} odds chases`.replace(/\\s+/g, " ").trim();'
worker = replace_once(worker, old_query, new_query, 'authority signal query')
worker = replace_once(
    worker,
    '          sealedRipGoogleSearch(checklistQuery, env.SERPAPI_KEY, 18000),\n          sealedRipGoogleSearch(communityQuery, env.SERPAPI_KEY, 12000),',
    '          sealedRipGoogleSearch(checklistQuery, env.SERPAPI_KEY, 18000, "mobile"),\n          sealedRipGoogleSearch(communityQuery, env.SERPAPI_KEY, 12000),',
    'mobile authority search',
)

# Try an AMP/cache URL supplied by Google before the publisher URL and reader fallback.
old_fetch_start = '''async function sealedRipFetchPageText(row) {
  if (!row || row.sourceType === "community" || !/^https?:\\/\\//i.test(String(row.link || ""))) return "";
  let directExcerpt = "";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7500);
  try {
    const response = await fetch(row.link, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 HOF-Card-Scout/1.0", "Accept": "text/html,application/xhtml+xml" },
    });
    if (response.ok) {
      const contentType = String(response.headers.get("content-type") || "").toLowerCase();
      if (!contentType || contentType.includes("text/html") || contentType.includes("application/xhtml")) {
        const html = (await response.text()).slice(0, 900000);
        directExcerpt = sealedRipPageExcerpt(html);
        if (sealedRipPageHasUsefulSignals(directExcerpt)) return directExcerpt;
      }
    }
  } catch {
    // Fall through to the trusted reader fallback below.
  } finally {
    clearTimeout(timeout);
  }

  const readerExcerpt = await sealedRipReaderPageText(row);
  if (sealedRipPageHasUsefulSignals(readerExcerpt)) return readerExcerpt;
  return readerExcerpt || directExcerpt;
}'''
new_fetch = '''async function sealedRipFetchPageText(row) {
  if (!row || row.sourceType === "community" || !/^https?:\\/\\//i.test(String(row.link || ""))) return "";
  let bestExcerpt = "";
  const candidates = [row?.ampLink, row?.cachedPageLink, row?.link]
    .map(value => String(value || "").trim())
    .filter((value, index, all) => /^https?:\\/\\//i.test(value) && all.indexOf(value) === index);
  for (const target of candidates) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8500);
    try {
      const response = await fetch(target, {
        signal: controller.signal,
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 HOF-Card-Scout/1.0", "Accept": "text/html,application/xhtml+xml,text/plain;q=0.8" },
      });
      if (response.ok) {
        const contentType = String(response.headers.get("content-type") || "").toLowerCase();
        if (!contentType || /text\\/(?:html|plain)|application\\/xhtml/.test(contentType)) {
          const body = (await response.text()).slice(0, 1000000);
          const excerpt = sealedRipPageExcerpt(body);
          if (excerpt.length > bestExcerpt.length) bestExcerpt = excerpt;
          if (sealedRipPageHasUsefulSignals(excerpt)) return excerpt;
        }
      }
    } catch {
      // Try the next Google-provided/publisher URL.
    } finally {
      clearTimeout(timeout);
    }
  }

  const readerExcerpt = await sealedRipReaderPageText(row);
  if (sealedRipPageHasUsefulSignals(readerExcerpt)) return readerExcerpt;
  return readerExcerpt || bestExcerpt;
}'''
worker = replace_once(worker, old_fetch_start, new_fetch, 'alternate authority page retrieval')

# Inject the structured search-page evidence after URL-specific page expansion. It is
# analysis evidence only and is not shown as a fake source link to the user.
old_expand = '''      evidenceRows = sealedRipFilterRelevantEvidence(evidenceRows, identity);
      evidenceRows = await sealedRipExpandEvidenceRows(evidenceRows);
      if (!evidenceRows.length) {'''
new_expand = '''      evidenceRows = sealedRipFilterRelevantEvidence(evidenceRows, identity);
      evidenceRows = await sealedRipExpandEvidenceRows(evidenceRows);
      const authoritySerpEvidence = sealedRipSerpEvidenceText(checklistData);
      if (authoritySerpEvidence) {
        evidenceRows.push({
          title: "Authoritative search evidence",
          link: "",
          snippet: authoritySerpEvidence.slice(0, 1400),
          pageText: authoritySerpEvidence,
          source: "Google structured result",
          sourceType: "checklist/editorial",
          queryKind: "checklist-and-odds",
          synthetic: true,
        });
      }
      if (!evidenceRows.length) {'''
worker = replace_once(worker, old_expand, new_expand, 'SERP evidence injection')
worker = replace_once(
    worker,
    '      const sources = evidenceRows.slice(0, 12).map(row => ({ title: row.title, link: row.link, sourceType: row.sourceType, queryKind: row.queryKind }));',
    '      const sources = evidenceRows.filter(row => /^https?:\\/\\//i.test(String(row?.link || ""))).slice(0, 12).map(row => ({ title: row.title, link: row.link, sourceType: row.sourceType, queryKind: row.queryKind }));',
    'hide synthetic source row',
)

worker_path.write_text(worker, encoding='utf-8')

test_path = Path('tests/sealed-product-vision.test.cjs')
test = test_path.read_text(encoding='utf-8')
test = test.replace('3\\.38\\.12', '3\\.38\\.13', 1)
test = test.replace('sealed:rip:v9:', 'sealed:rip:v10:', 1)
old = "assert.match(worker,/const checklistQuery = `\\$\\{authorityYear\\} \\$\\{researchSet\\} \\$\\{authorityCategory\\} \\$\\{authoritySite\\}`/,'authority discovery must search the set broadly without requiring retail-format terms');\n"
new = "assert.match(worker,/const checklistQuery = `\\$\\{authorityYear\\} \\$\\{researchSet\\} \\$\\{authorityCategory\\} \\$\\{authoritySite\\} \\$\\{formatTerms\\} odds chases`/,'authority discovery must nudge Google toward exact-format odds and chase snippets');\n"
if old in test:
    test = test.replace(old, new, 1)
anchor = "assert.match(worker,/sealedRipReaderPageText/,'trusted authority pages must have a rendered-reader fallback when direct HTML is thin or blocked');\n"
extra = anchor + "assert.match(worker,/sealedRipSerpEvidenceText/,'rip research must retain structured Google evidence when publisher page reading is blocked');\nassert.match(worker,/ampLink/,'authority research must retain Google AMP links when available');\nassert.match(worker,/cachedPageLink/,'authority research must retain Google cached-page links when available');\nassert.match(worker,/device = \\\"\\\"/,'Google research helper must support a mobile authority request');\nassert.match(worker,/sealedRipGoogleSearch\\(checklistQuery, env\\.SERPAPI_KEY, 18000, \\\"mobile\\\"\\)/,'authority lookup must request mobile results so AMP links can be exposed');\n"
if 'rip research must retain structured Google evidence' not in test:
    test = replace_once(test, anchor, extra, 'authority evidence regression checks')
test_path.write_text(test, encoding='utf-8')
