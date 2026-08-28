from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing expected text for {label}")
    return text.replace(old, new, 1)

worker_path = Path('src/index.js')
worker = worker_path.read_text(encoding='utf-8')
worker = replace_once(worker, 'const VERSION = "3.38.11";', 'const VERSION = "3.38.12";', 'worker version')
worker = replace_once(worker, 'sealed:rip:v8:', 'sealed:rip:v9:', 'rip cache version')

worker = replace_once(
    worker,
    '  const needles = ["1:", "odds", "blaster", "value box", "rookie", "signature", "autograph", "case hit", "parallel", "exclusive", "short print", "ssp"];',
    '  const needles = ["1:", "odds", "blaster", "value box", "what to expect in a value box", "rookie", "signature", "hyper signatures", "autograph", "case hit", "block by block", "boom shaka laka", "green hoops", "light burst", "parallel", "exclusive", "short print", "ssp"];',
    'authority excerpt needles',
)

old_fetch = '''async function sealedRipFetchPageText(row) {
  if (!row || row.sourceType === "community" || !/^https?:\/\//i.test(String(row.link || ""))) return "";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(row.link, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 HOF-Card-Scout/1.0", "Accept": "text/html,application/xhtml+xml" },
    });
    if (!response.ok) return "";
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml")) return "";
    const html = (await response.text()).slice(0, 900000);
    return sealedRipPageExcerpt(html);
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}
'''
new_fetch = '''function sealedRipPageHasUsefulSignals(text) {
  const value = String(text || "");
  return /\b1\s*:\s*\d{1,7}\b|\b(?:value box|blaster|retail[- ]only|case hit|block by block|boom shaka laka|hyper signatures?|green hoops|light burst|rookie signatures?)\b/i.test(value);
}

function sealedRipCanUseReader(row) {
  const link = String(row?.link || "").toLowerCase();
  return /https?:\/\/(?:www\.)?(?:beckett\.com|topps\.com|checklistinsider\.com|cardboardconnection\.com|pokemon\.com|pokebeach\.com|magic\.wizards\.com|wizards\.com)\//.test(link);
}

async function sealedRipReaderPageText(row) {
  if (!sealedRipCanUseReader(row)) return "";
  const target = String(row.link || "").trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 14000);
  try {
    // Jina Reader renders difficult public pages and returns LLM-friendly text.
    // It is a fallback only; direct source fetching remains the first choice.
    const response = await fetch(`https://r.jina.ai/${target}`, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "Accept": "text/plain,text/markdown;q=0.9,*/*;q=0.1", "User-Agent": "HOF-Card-Scout/1.0" },
    });
    if (!response.ok) return "";
    const text = (await response.text()).slice(0, 1200000);
    return sealedRipPageExcerpt(text);
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function sealedRipFetchPageText(row) {
  if (!row || row.sourceType === "community" || !/^https?:\/\//i.test(String(row.link || ""))) return "";
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
}
'''
worker = replace_once(worker, old_fetch, new_fetch, 'trusted reader fallback')
worker_path.write_text(worker, encoding='utf-8')

test_path = Path('tests/sealed-product-vision.test.cjs')
test = test_path.read_text(encoding='utf-8')
test = test.replace('3\\.38\\.11', '3\\.38\\.12', 1)
test = test.replace('sealed:rip:v8:', 'sealed:rip:v9:', 1)
anchor = "assert.match(worker,/sealedRipExpandEvidenceRows/,'rip research must expand high-quality source pages beyond search snippets');\n"
extra = anchor + "assert.match(worker,/sealedRipReaderPageText/,'trusted authority pages must have a rendered-reader fallback when direct HTML is thin or blocked');\nassert.match(worker,/https:\\/\\/r\\.jina\\.ai\\//,'authority reader fallback must use the documented Jina Reader URL prefix');\nassert.match(worker,/sealedRipCanUseReader/,'reader fallback must be restricted to trusted authority domains');\nassert.match(worker,/sealedRipPageHasUsefulSignals/,'authority page expansion must verify useful chase or odds signals before accepting direct HTML');\n"
if 'trusted authority pages must have a rendered-reader fallback' not in test:
    test = replace_once(test, anchor, extra, 'reader fallback regression assertions')
test_path.write_text(test, encoding='utf-8')
