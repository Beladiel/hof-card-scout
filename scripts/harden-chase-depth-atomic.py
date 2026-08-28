from pathlib import Path
import re

worker_path = Path('src/index.js')
test_path = Path('tests/sealed-product-vision.test.cjs')

worker = worker_path.read_text(encoding='utf-8')
tests = test_path.read_text(encoding='utf-8')

worker = worker.replace('const VERSION = "3.43.0";', 'const VERSION = "3.44.0";', 1)
worker = worker.replace('sealed:intel:v14:', 'sealed:intel:v15:', 1)

# Preserve local row/record structure for singles price-guide pages instead of
# flattening an entire page into broad text windows.
anchor = '''function sealedRipPageHasUsefulSignals(text) {\n'''
helper = r'''function sealedRipPriceGuideExcerpt(raw) {
  let text = String(raw || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(?:tr|p|div|li|section|article|h[1-6])>/gi, "\n")
    .replace(/<(?:br|hr)\b[^>]*>/gi, "\n")
    .replace(/<\/(?:td|th)>/gi, " | ")
    .replace(/<[^>]+>/g, " ");
  text = sealedRipDecodeHtml(text).replace(/\r/g, "\n");
  const lines = text
    .split(/\n+/)
    .map(line => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 6000);
  const blocks = [];
  const seen = new Set();
  const hasPrice = value => /(?:\$|usd\s*)\s*\d+(?:\.\d{1,2})?\b/i.test(String(value || ""));
  const hasBasis = value => /\b(?:market\s+price|ungraded|near\s+mint)\b/i.test(String(value || ""));
  const add = value => {
    const block = String(value || "").replace(/[ \t]+/g, " ").trim().slice(0, 900);
    if (!block || !hasPrice(block)) return;
    const key = block.toLowerCase().replace(/[^a-z0-9$]+/g, " ").slice(0, 320);
    if (seen.has(key)) return;
    seen.add(key);
    blocks.push(block);
  };
  for (let i = 0; i < lines.length && blocks.length < 60; i++) {
    const line = lines[i];
    if (hasPrice(line)) {
      const prev = i > 0 ? lines[i - 1] : "";
      add(!hasBasis(line) && hasBasis(prev) && prev.length <= 260 ? `${prev} | ${line}` : line);
      continue;
    }
    if (hasBasis(line) && i + 1 < lines.length && hasPrice(lines[i + 1])) {
      add(`${line} | ${lines[i + 1]}`);
    }
  }
  return blocks.join("\n---\n").slice(0, 14000);
}

'''
if anchor not in worker:
    raise SystemExit('page signal anchor not found')
worker = worker.replace(anchor, helper + anchor, 1)

old = '    return sealedRipPageExcerpt(text);'
new = '    return row?.queryKind === "singles-price-guide" ? sealedRipPriceGuideExcerpt(text) : sealedRipPageExcerpt(text);'
if old not in worker:
    raise SystemExit('reader excerpt line not found')
worker = worker.replace(old, new, 1)

old = '          const excerpt = sealedRipPageExcerpt(body);'
new = '          const excerpt = row?.queryKind === "singles-price-guide" ? sealedRipPriceGuideExcerpt(body) : sealedRipPageExcerpt(body);'
if old not in worker:
    raise SystemExit('direct page excerpt line not found')
worker = worker.replace(old, new, 1)

# Replace the broad +/- 500/850 character price association with strict local
# record/block proof. Source-specific basis rules ensure sports values are raw /
# ungraded and TCGplayer values are actual Market Price context.
pattern = re.compile(r'''function sealedRipChaseValueNameTokens\(value\) \{.*?\n\}\n\nfunction sealedRipNormalizeChaseValues''', re.S)
replacement = r'''function sealedRipChaseValueNameTokens(value) {
  const stop = new Set(["the", "and", "card", "cards", "foil", "market", "price", "showcase", "borderless", "parallel", "autograph", "auto", "rookie"]);
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter(token => token.length >= 2 && !stop.has(token));
}

function sealedRipPriceTextPositions(price, text) {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return [];
  const values = new Set([n.toFixed(2)]);
  if (Math.abs(n - Math.round(n)) < 0.001) values.add(String(Math.round(n)));
  const source = String(text || "");
  const hits = [];
  for (const value of values) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(`(?:\\$|usd\\s*)\\s*${escaped}\\b|(?:market\\s+price\\s*:?\\s*)\\$?\\s*${escaped}\\b`, "ig");
    let match;
    while ((match = rx.exec(source))) {
      hits.push(match.index + Math.floor(match[0].length / 2));
      if (hits.length >= 12) break;
    }
  }
  return [...new Set(hits)].sort((a, b) => a - b);
}

function sealedRipPriceTextSupported(price, text) {
  return sealedRipPriceTextPositions(price, text).length > 0;
}

function sealedRipPriceGuideHost(row) {
  try { return new URL(String(row?.link || "")).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

function sealedRipPriceGuideAtomicBlocks(row) {
  const out = [];
  const seen = new Set();
  const add = (value, origin) => {
    const block = String(value || "").replace(/[ \t]+/g, " ").replace(/\n+/g, " ").trim().slice(0, 1000);
    if (!block || !/(?:\$|usd\s*)\s*\d+(?:\.\d{1,2})?\b/i.test(block)) return;
    const key = block.toLowerCase().replace(/[^a-z0-9$]+/g, " ").slice(0, 360);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ text: block, origin });
  };
  const page = String(row?.pageText || "");
  for (const block of page.split(/\n\s*---\s*\n|\n{2,}/)) add(block, "page");
  add(`${row?.title || ""} | ${row?.snippet || ""}`, "search");
  return out.slice(0, 80);
}

function sealedRipPriceGuideBlockLooksSealed(value) {
  const text = String(value || "");
  return /\b(?:factory\s+sealed|sealed\s+(?:box|pack|case)|booster\s+(?:box|pack|bundle|display)|blaster\s+box|mega\s+box|hobby\s+box|hanger\s+(?:box|pack)|value\s+box|retail\s+box|elite\s+trainer\s+box|\betb\b|display\s+box|case\s+of|box\s+of\s+\d+\s+packs?)\b/i.test(text);
}

function sealedRipPriceGuideGradedContext(value) {
  return /\b(?:psa|bgs|sgc|cgc|graded|grading|gem\s+mint|grade\s*(?:7|8|9|10)|mint\s*(?:9|10))\b/i.test(String(value || ""));
}

function sealedRipPriceGuidePriceBasis(context, row) {
  const text = String(context || "");
  const host = sealedRipPriceGuideHost(row);
  if (host.endsWith("sportscardspro.com")) return /\bungraded\b/i.test(text) ? "ungraded" : "";
  if (host.endsWith("tcgplayer.com")) return /\bmarket\s+price\b/i.test(text) ? "market_price" : "";
  if (/\bmarket\s+price\b/i.test(text)) return "market_price";
  if (/\bungraded\b/i.test(text)) return "ungraded";
  return "";
}

function sealedRipChaseNameSupportedInBlock(tokens, block) {
  const lower = String(block || "").toLowerCase();
  const matched = tokens.filter(token => lower.includes(token)).length;
  const required = tokens.length <= 2 ? tokens.length : Math.min(4, Math.max(2, Math.ceil(tokens.length * 0.55)));
  return matched >= required;
}

function sealedRipChaseValueProof(candidate, evidenceRows = [], identity = {}) {
  const name = String(candidate?.name || "").trim();
  const price = Number(candidate?.marketPrice);
  const tokens = sealedRipChaseValueNameTokens(name);
  if (!name || !Number.isFinite(price) || price < 3 || price > 25000 || !tokens.length) return null;
  for (const row of sealedRipPriceGuideRows(evidenceRows, identity)) {
    for (const record of sealedRipPriceGuideAtomicBlocks(row)) {
      const block = record.text;
      if (sealedRipPriceGuideBlockLooksSealed(block)) continue;
      if (!sealedRipChaseNameSupportedInBlock(tokens, block)) continue;
      const pricePositions = sealedRipPriceTextPositions(price, block);
      for (const at of pricePositions) {
        const basisContext = block.slice(Math.max(0, at - 280), Math.min(block.length, at + 280));
        const tightContext = block.slice(Math.max(0, at - 130), Math.min(block.length, at + 130));
        if (sealedRipPriceGuideGradedContext(tightContext)) continue;
        const priceBasis = sealedRipPriceGuidePriceBasis(basisContext, row);
        if (!priceBasis) continue;
        return {
          priceBasis,
          sourceHost: sealedRipPriceGuideHost(row),
          sourceLink: String(row?.link || "").slice(0, 500),
          evidenceOrigin: record.origin,
        };
      }
    }
  }
  return null;
}

function sealedRipChaseValueSupported(candidate, evidenceRows = [], identity = {}) {
  return Boolean(sealedRipChaseValueProof(candidate, evidenceRows, identity));
}

function sealedRipNormalizeChaseValues'''
worker, count = pattern.subn(lambda _m: replacement, worker, count=1)
if count != 1:
    raise SystemExit(f'atomic validator replacement failed ({count})')

old = '''    if (!sealedRipChaseValueSupported(item, evidenceRows, identity)) continue;\n    const key = `${item.name}|${item.treatment}`.toLowerCase().replace(/\\s+/g, " ");'''
new = '''    const proof = sealedRipChaseValueProof(item, evidenceRows, identity);\n    if (!proof) continue;\n    item.priceBasis = proof.priceBasis;\n    item.verifiedSource = proof.sourceHost;\n    const key = `${item.name}|${item.treatment}`.toLowerCase().replace(/\\s+/g, " ");'''
if old not in worker:
    raise SystemExit('normalize chase proof anchor not found')
worker = worker.replace(old, new, 1)

# Tighten the price-guide-only AI instruction; local code still independently
# verifies every accepted pair and does not trust the model's wording.
old = '''Extract only SET-LEVEL raw singles values from the PRICE-GUIDE evidence below. Each output row must preserve the exact card name and a literal current market/guide price shown together in that evidence. Do not output sealed-product prices. Do not infer exact-format access. Do not output chase/set scores, pull odds, or sentiment. If fewer than two literal card-price pairs are supported, return chaseValueCards=[].'''
new = '''Extract only SET-LEVEL RAW/UNGRADED singles values from the PRICE-GUIDE evidence below. For TCGplayer, use literal Market Price values; for SportsCardsPro, use literal Ungraded values. Each output row must preserve the exact card name and a literal price tied to that same local record. Never use PSA/BGS/SGC/CGC/graded prices, sealed-product prices, box/pack prices, or prices from another set. Do not infer exact-format access. Do not output chase/set scores, pull odds, or sentiment. If fewer than two literal card-price pairs are supported, return chaseValueCards=[].'''
if old in worker:
    worker = worker.replace(old, new, 1)

# Update focused regression expectations.
tests = tests.replace('const VERSION = "3\\.43\\.0"', 'const VERSION = "3\\.44\\.0"', 1)
tests = tests.replace('sealed:intel:v14:', 'sealed:intel:v15:', 1)
anchor_test = "assert.match(worker,/function sealedRipChaseValueSupported/,'candidate card prices must be locally validated against price-guide evidence');"
extra = """assert.match(worker,/function sealedRipPriceGuideExcerpt/,'price-guide page reading must preserve local price records');\nassert.match(worker,/function sealedRipPriceGuideAtomicBlocks/,'Chase Depth verification must operate on bounded local records');\nassert.match(worker,/function sealedRipChaseValueProof/,'accepted singles values must carry a local evidence proof');\nassert.match(worker,/function sealedRipPriceGuidePriceBasis/,'price validation must distinguish Market Price from Ungraded evidence');\nassert.match(worker,/sportscardspro\\.com.*ungraded/s,'SportsCardsPro values must require ungraded context');\nassert.match(worker,/tcgplayer\\.com.*market\\\\s\\+price/s,'TCGplayer values must require Market Price context');\nassert.match(worker,/psa\\|bgs\\|sgc\\|cgc/i,'atomic price validation must recognize graded-price contamination');\nconst atomicStart=worker.indexOf('function sealedRipChaseValueProof');\nconst atomicEnd=worker.indexOf('function sealedRipNormalizeChaseValues',atomicStart);\nconst atomicBlock=worker.slice(atomicStart,atomicEnd);\nassert.ok(atomicStart>=0&&atomicEnd>atomicStart,'atomic Chase Depth validator block must exist');\nassert.doesNotMatch(atomicBlock,/at - 500|at \\+ 850/,'Chase Depth must not use the old broad nearby-price window');\n"""
if anchor_test not in tests:
    raise SystemExit('atomic regression test anchor not found')
tests = tests.replace(anchor_test, anchor_test + '\n' + extra, 1)

worker_path.write_text(worker, encoding='utf-8')
test_path.write_text(tests, encoding='utf-8')
print('Atomic Chase Depth validation applied.')
