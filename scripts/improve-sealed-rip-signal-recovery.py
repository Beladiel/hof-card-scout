from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing expected text for {label}")
    return text.replace(old, new, 1)

worker_path = Path('src/index.js')
worker = worker_path.read_text(encoding='utf-8')
worker = replace_once(worker, 'const VERSION = "3.38.7";', 'const VERSION = "3.38.8";', 'worker version')
worker = replace_once(worker, 'sealed:rip:v4:', 'sealed:rip:v5:', 'rip cache version')

old = '''function sealedRipEvidenceRows(data, queryKind) {
  const rows = Array.isArray(data?.organic_results) ? data.organic_results : [];
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const title = String(row?.title || "").trim();
    const link = String(row?.link || "").trim();
    const snippet = String(row?.snippet || row?.snippet_highlighted_words?.join(" ") || "").trim();
'''
new = '''function sealedRipEvidenceRows(data, queryKind) {
  const rows = Array.isArray(data?.organic_results) ? data.organic_results : [];
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const title = String(row?.title || "").trim();
    const link = String(row?.link || "").trim();
    const rich = row?.rich_snippet ? JSON.stringify(row.rich_snippet) : "";
    const about = row?.about_this_result ? JSON.stringify(row.about_this_result) : "";
    const snippet = [row?.snippet, row?.snippet_highlighted_words?.join(" "), rich, about]
      .filter(Boolean).join(" ").replace(/\\s+/g, " ").trim();
'''
worker = replace_once(worker, old, new, 'richer Google evidence text')

community = '''function sealedRipCommunitySite(category) {
  const value = String(category || "").toLowerCase();
  if (value === "basketball") return "site:reddit.com/r/basketballcards";
  if (value === "baseball") return "site:reddit.com/r/baseballcards";
  if (value === "football") return "site:reddit.com/r/footballcards";
  if (value.includes("pok")) return "site:reddit.com/r/PokemonTCG";
  if (value.includes("magic")) return "site:reddit.com/r/magicTCG";
  return "site:reddit.com";
}
'''
trusted = community + '''
function sealedRipTrustedResearchSites(category) {
  const value = String(category || "").toLowerCase();
  if (["basketball", "baseball", "football"].includes(value)) {
    return "(site:topps.com OR site:beckett.com OR site:checklistinsider.com OR site:cardboardconnection.com)";
  }
  if (value.includes("pok")) {
    return "(site:pokemon.com OR site:pokebeach.com OR site:tcgplayer.com OR site:pokellector.com)";
  }
  if (value.includes("magic")) {
    return "(site:magic.wizards.com OR site:wizards.com OR site:scryfall.com OR site:mtg.fandom.com)";
  }
  return "";
}
'''
worker = replace_once(worker, community, trusted, 'trusted research domains')

expand = '''async function sealedRipExpandEvidenceRows(rows) {
  const list = Array.isArray(rows) ? rows.slice(0, 20) : [];
  const fetchable = list
    .map((row, index) => ({ row, index }))
    .filter(x => x.row.sourceType !== "community")
    .sort((a, b) => sealedRipEvidencePriority(a.row) - sealedRipEvidencePriority(b.row) || a.index - b.index)
    .slice(0, 6);
  const expanded = await Promise.all(fetchable.map(async ({ row, index }) => ({ index, pageText: await sealedRipFetchPageText(row) })));
  const byIndex = new Map(expanded.map(x => [x.index, x.pageText]));
  return list.map((row, index) => ({ ...row, pageText: byIndex.get(index) || "" }));
}
'''
signals = expand + '''
function sealedRipPromptSignals(rows) {
  const ordered = (Array.isArray(rows) ? rows.slice() : [])
    .sort((a, b) => sealedRipEvidencePriority(a) - sealedRipEvidencePriority(b));
  const chunks = [];
  const seen = new Set();
  const patterns = [
    /\\b1\\s*:\\s*\\d{1,7}\\b/ig,
    /\\b(?:retail[- ]only|retail exclusive|value box|blaster|case hit|rookie signatures?|hyper signatures?|autographs?|light burst|green hoops|numbered|parallel|ssp|short print|rookies?)\\b/ig,
  ];
  for (const row of ordered) {
    const text = `${row?.snippet || ""} ${row?.pageText || ""}`.replace(/\\s+/g, " ").trim();
    if (!text) continue;
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      let hits = 0;
      while ((match = pattern.exec(text)) && hits < 5) {
        const start = Math.max(0, match.index - 260);
        const end = Math.min(text.length, match.index + match[0].length + 620);
        const excerpt = text.slice(start, end).trim();
        const key = excerpt.toLowerCase().replace(/[^a-z0-9]+/g, " ").slice(0, 160);
        if (excerpt && !seen.has(key)) {
          seen.add(key);
          chunks.push(`[${row.sourceType}] ${row.title}: ${excerpt}`);
        }
        hits++;
        if (chunks.length >= 18) break;
      }
      if (chunks.length >= 18) break;
    }
    if (chunks.length >= 18) break;
  }
  return chunks.join("\\n---\\n").slice(0, 14000);
}
'''
worker = replace_once(worker, expand, signals, 'compact high-signal digest')

old_query = '''      const formatTerms = sealedRipFormatTerms(identity);
      const researchSet = sealedRipResearchSet(identity);
      const exactSet = [String(identity?.year || "").trim(), researchSet].filter(Boolean).join(" ");
      const checklistQuery = `"${exactSet}" ${formatTerms} ("pull odds" OR odds) (checklist OR "collector guide") rookies signatures "case hits" parallels`;
      const communityQuery = `"${exactSet}" ${formatTerms} pulls review ${sealedRipCommunitySite(identity?.category)}`;
'''
new_query = '''      const formatTerms = sealedRipFormatTerms(identity);
      const researchSet = sealedRipResearchSet(identity);
      const exactSet = [String(identity?.year || "").trim(), researchSet].filter(Boolean).join(" ");
      const trustedSites = sealedRipTrustedResearchSites(identity?.category);
      const checklistQuery = `"${exactSet}" ${formatTerms} odds checklist rookies autographs parallels "case hit" ${trustedSites}`.trim();
      const communityQuery = `"${exactSet}" ${formatTerms} pulls review ${sealedRipCommunitySite(identity?.category)}`;
'''
worker = replace_once(worker, old_query, new_query, 'trusted checklist query')

old_evidence = '''      const sources = evidenceRows.slice(0, 12).map(row => ({ title: row.title, link: row.link, sourceType: row.sourceType, queryKind: row.queryKind }));
      const evidenceForPrompt = evidenceRows.slice(0, 18).map((row, index) =>
        `[${index + 1}] TYPE=${row.sourceType}; SEARCH=${row.queryKind}; TITLE=${row.title}; SOURCE=${row.source}; URL=${row.link}; SNIPPET=${row.snippet}; PAGE=${row.pageText || ""}`
      ).join("\\n\\n").slice(0, 42000);
'''
new_evidence = '''      const sources = evidenceRows.slice(0, 12).map(row => ({ title: row.title, link: row.link, sourceType: row.sourceType, queryKind: row.queryKind }));
      const evidenceSignals = sealedRipPromptSignals(evidenceRows);
      const evidenceForPrompt = evidenceRows.slice(0, 18).map((row, index) =>
        `[${index + 1}] TYPE=${row.sourceType}; SEARCH=${row.queryKind}; TITLE=${row.title}; SOURCE=${row.source}; URL=${row.link}; SNIPPET=${row.snippet}; PAGE=${row.pageText || ""}`
      ).join("\\n\\n").slice(0, 34000);
'''
worker = replace_once(worker, old_evidence, new_evidence, 'signal digest wiring')

prompt_anchor = '''Research evidence:\\n${evidenceForPrompt}`;
'''
prompt_new = '''High-signal excerpts extracted from the best sources (read these first):\\n${evidenceSignals || "No compact signals extracted."}\\n\\nFull research evidence:\\n${evidenceForPrompt}`;
'''
worker = replace_once(worker, prompt_anchor, prompt_new, 'signal-first synthesis prompt')

parse_block = '''      let aiObject;
      try { aiObject = sealedRipAiJson(rawAnalysis); }
      catch {
        return json({ ok: false, error: "rip_analysis_parse_failed", message: "Scout could not safely interpret the rip-quality research right now.", researchSearchesUsed, marketplaceSearchesUsed: 0 }, 502, cors);
      }
      const analysis = sealedRipNormalize(aiObject, evidenceRows, market);
'''
recovery_block = '''      let aiObject;
      try { aiObject = sealedRipAiJson(rawAnalysis); }
      catch {
        return json({ ok: false, error: "rip_analysis_parse_failed", message: "Scout could not safely interpret the rip-quality research right now.", researchSearchesUsed, marketplaceSearchesUsed: 0 }, 502, cors);
      }

      // If the broad synthesis misses named chases or literal odds, make one compact
      // extraction-only AI pass over the high-signal excerpts. This spends no extra
      // Google/marketplace searches, and every recovered item is still independently
      // validated against the retrieved evidence by sealedRipNormalize below.
      const missingChases = !Array.isArray(aiObject?.chaseCards) || !aiObject.chaseCards.length;
      const missingOdds = !Array.isArray(aiObject?.pullOdds) || !aiObject.pullOdds.length;
      if (evidenceSignals && (missingChases || missingOdds)) {
        const recoverySchema = {
          type: "object",
          properties: {
            chaseScore: { type: "number" },
            pullScore: { type: "number" },
            chaseCards: { type: "array", items: { type: "object", properties: { name: { type: "string" }, why: { type: "string" } }, required: ["name", "why"] }, maxItems: 5 },
            pullOdds: { type: "array", items: { type: "object", properties: { item: { type: "string" }, odds: { type: "string" }, sourceType: { type: "string" }, note: { type: "string" } }, required: ["item", "odds", "sourceType", "note"] }, maxItems: 8 },
          },
          required: ["chaseScore", "pullScore", "chaseCards", "pullOdds"]
        };
        const recoveryPrompt = `Extract only source-supported CHASES and exact-format PULL ODDS for ${productLabel} (${String(identity?.productType || identity?.boxType || "")}). Use ONLY the excerpts below. Named retail insert families, retail case hits, autograph families, numbered/retail-exclusive parallels, and explicitly named rookie/star cards may be chases. Preserve odds exactly as written (for example 1:7). Do not estimate or infer odds. If no literal exact-format odds are present, return pullOdds=[]. Do not invent names.\\n\\n${evidenceSignals}`;
        try {
          const recoveredRaw = await env.AI.run(SEALED_RIP_MODEL, {
            prompt: recoveryPrompt,
            max_tokens: 900,
            temperature: 0,
            response_format: { type: "json_schema", json_schema: recoverySchema }
          });
          const recovered = sealedRipAiJson(recoveredRaw);
          if (missingChases && Array.isArray(recovered?.chaseCards) && recovered.chaseCards.length) {
            aiObject.chaseCards = recovered.chaseCards;
            aiObject.chaseScore = recovered.chaseScore;
            aiObject.chaseEvidenceAvailable = true;
          }
          if (missingOdds && Array.isArray(recovered?.pullOdds) && recovered.pullOdds.length) {
            aiObject.pullOdds = recovered.pullOdds;
            aiObject.pullScore = recovered.pullScore;
            aiObject.pullEvidenceAvailable = true;
          }
        } catch (err) {
          console.warn("sealed rip compact recovery skipped", err);
        }
      }
      const analysis = sealedRipNormalize(aiObject, evidenceRows, market);
'''
worker = replace_once(worker, parse_block, recovery_block, 'compact extraction recovery')

worker_path.write_text(worker, encoding='utf-8')

test_path = Path('tests/sealed-product-vision.test.cjs')
test = test_path.read_text(encoding='utf-8')
test = test.replace('3\\.38\\.7', '3\\.38\\.8', 1)
test = test.replace('sealed:rip:v4:', 'sealed:rip:v5:', 1)
anchor = "assert.match(worker,/const chaseEvidenceAvailable = chaseCards\\.length > 0/,'validated named chases must establish chase evidence even if the model boolean is inconsistent');\n"
extra = anchor + "assert.match(worker,/sealedRipTrustedResearchSites/,'rip research must bias its evidence search toward trustworthy product/checklist sources');\nassert.match(worker,/sealedRipPromptSignals/,'rip research must build a compact chase-and-odds signal digest');\nassert.match(worker,/recoveryPrompt/,'rip research must retry extraction from compact evidence without spending another search');\nassert.match(worker,/missingChases.*missingOdds/s,'compact recovery must only run when chase or odds extraction is missing');\nassert.match(worker,/rich_snippet/,'rip research should retain rich Google result text when available');\n"
if 'rip research must build a compact chase-and-odds signal digest' not in test:
    test = replace_once(test, anchor, extra, '3.38.8 regression assertions')
test_path.write_text(test, encoding='utf-8')
