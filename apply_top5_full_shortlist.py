from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"Could not find {label}")
    return text.replace(old, new, 1)

# Worker
p=Path('src/index.js')
s=p.read_text(encoding='utf-8')
s=replace_once(s,'const VERSION = "3.25.0";','const VERSION = "3.25.1";','worker version')
old='''function targetRankingInfo(candidate, oldestYear, budget, mode) {
  const yearGap = Math.max(0, Number(candidate.year) - Number(oldestYear));
  const traits = candidate.traits || {};
  const verifiedCount = [traits.rookieVerified, traits.graded, traits.autograph, traits.shortPrint].filter(Boolean).length;
  const components = {
    age: yearGap === 0 ? 100 : 82,
    upgradeStrength: targetClampScore(mode === "upgrade" ? Number(candidate.upgrade?.strength || 0) / 2.5 : 0),
    representation: targetClampScore(candidate.representationInfo?.score || 92),
    condition: targetClampScore(candidate.conditionInfo?.score || 0),
    sellerTrust: targetClampScore(candidate.sellerTrust?.score || 0),
    verifiedTraits: targetClampScore(verifiedCount * 25),
    deliveredPriceEfficiency: targetClampScore((1 - Number(candidate.delivered) / Number(budget)) * 100),
  };
  const total = targetClampScore(
    components.age * .20 + components.upgradeStrength * .05 + components.representation * .16 +
    components.condition * .28 + components.sellerTrust * .15 + components.verifiedTraits * .06 +
    components.deliveredPriceEfficiency * .10
  );
  return { oldestYear, yearGap, components, total };
}'''
new='''function targetRankingInfo(candidate, oldestYear, budget, mode) {
  const yearGap = Math.max(0, Number(candidate.year) - Number(oldestYear));
  const traits = candidate.traits || {};
  const verifiedTraitScore =
    (traits.rookieVerified ? 35 : 0) +
    (traits.graded ? 20 : 0) +
    (traits.autograph ? 35 : 0) +
    (traits.shortPrint ? 20 : 0);
  const components = {
    // Age is deliberately the strongest factor. Each year away from the oldest
    // qualifying card costs 8 age points, but nearby premium cards can still win.
    age: targetClampScore(100 - yearGap * 8),
    upgradeStrength: targetClampScore(mode === "upgrade" ? Number(candidate.upgrade?.strength || 0) / 2.5 : 0),
    representation: targetClampScore(candidate.representationInfo?.score || 92),
    condition: targetClampScore(candidate.conditionInfo?.score || 0),
    sellerTrust: targetClampScore(candidate.sellerTrust?.score || 0),
    verifiedTraits: targetClampScore(verifiedTraitScore),
    deliveredPriceEfficiency: targetClampScore((1 - Number(candidate.delivered) / Number(budget)) * 100),
  };
  const total = targetClampScore(
    components.age * .50 + components.upgradeStrength * .03 + components.representation * .10 +
    components.condition * .12 + components.sellerTrust * .10 + components.verifiedTraits * .10 +
    components.deliveredPriceEfficiency * .05
  );
  return { oldestYear, yearGap, components, total };
}'''
s=replace_once(s,old,new,'target ranking weights')
old='''function targetCandidateQualitySort(a, b) {
  return (b.ranking.total - a.ranking.total) ||
    ((b.conditionInfo?.score || 0) - (a.conditionInfo?.score || 0)) ||
    ((b.sellerTrust?.score || 0) - (a.sellerTrust?.score || 0)) ||
    (a.delivered - b.delivered);
}'''
new='''function targetCandidateQualitySort(a, b) {
  return (b.ranking.total - a.ranking.total) ||
    (Number(a.year) - Number(b.year)) ||
    ((b.conditionInfo?.score || 0) - (a.conditionInfo?.score || 0)) ||
    ((b.sellerTrust?.score || 0) - (a.sellerTrust?.score || 0)) ||
    (a.delivered - b.delivered);
}'''
s=replace_once(s,old,new,'target quality sort')
old='''function targetBuildCandidateShortlist(candidates, budget, mode, player) {
  if (!candidates.length) return [];
  const oldestYear = Math.min(...candidates.map(x => Number(x.year)));
  const cohort = candidates.filter(x => Number(x.year) <= oldestYear + 1);
  for (const candidate of cohort) {
    candidate.representationInfo = monthlyPickRepresentationInfo(candidate.title, player);
    candidate.ranking = targetRankingInfo(candidate, oldestYear, budget, mode);
  }
  const oldest = cohort.filter(x => Number(x.year) === oldestYear).sort(targetCandidateQualitySort);
  const near = cohort.filter(x => Number(x.year) === oldestYear + 1).sort(targetCandidateQualitySort);
  const preliminary = oldest[0] || near[0];
  const remainder = cohort.filter(x => x !== preliminary).sort((a, b) =>
    (a.year - b.year) || targetCandidateQualitySort(a, b)
  );
  return [preliminary, ...remainder].filter(Boolean).slice(0, 5);
}'''
new='''function targetBuildCandidateShortlist(candidates, budget, mode, player) {
  if (!candidates.length) return [];
  const oldestYear = Math.min(...candidates.map(x => Number(x.year)));
  // Rank every qualifying listing from the existing discovery searches. The
  // previous implementation discarded anything more than one year newer than
  // the oldest result, which could collapse a "Top 5" into a single card.
  for (const candidate of candidates) {
    candidate.representationInfo = monthlyPickRepresentationInfo(candidate.title, player);
    candidate.ranking = targetRankingInfo(candidate, oldestYear, budget, mode);
  }
  return candidates.slice().sort(targetCandidateQualitySort).slice(0, 5);
}'''
s=replace_once(s,old,new,'full Top 5 shortlist')
old='''  if (!selected.selectionMode) selected.selectionMode = "oldest_best_fit";
  if (!selected.selectionBadge) selected.selectionBadge = "OLDEST BEST FIT";
  if (!selected.selectionReason) {
    selected.selectionReason = "Scout kept the oldest qualifying year because no one-year-newer alternative showed a clear enough collectible or market advantage.";
  }'''
new='''  if (!selected.selectionMode) selected.selectionMode = "ranked_best_fit";
  if (!selected.selectionBadge) selected.selectionBadge = "SCOUT BEST FIT";
  if (!selected.selectionReason) {
    selected.selectionReason = "Scout ranked every qualifying listing from this search, with age carrying the most weight and collectible quality, seller trust, and price breaking close decisions.";
  }'''
s=replace_once(s,old,new,'selection badge wording')
p.write_text(s,encoding='utf-8')
print('patched src/index.js')

# Main app labels/status
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=s.replace('s.selectionBadge||"OLDEST BEST FIT"','s.selectionBadge||(s.rank===1?"SCOUT BEST FIT":"RANKED ALTERNATIVE")',1)
old='''    if(data.suggestion.marketCheck?.rated){
      $("findTargetStatus").textContent=p.owned
        ?"✓ Scout found a meaningful upgrade candidate with a listing price verdict."
        :"✓ Scout found a target recommendation with a listing price verdict.";
    }else{
      $("findTargetStatus").textContent=p.owned
        ?"✓ Scout found a meaningful upgrade candidate. Pricing evidence is limited."
        :"✓ Scout found a target recommendation. Pricing evidence is limited.";
    }'''
new='''    const rankedCount=Math.max(1,findTargetSuggestions.length);
    if(data.suggestion.marketCheck?.rated){
      $("findTargetStatus").textContent=p.owned
        ?`✓ Scout found ${rankedCount} ranked upgrade choice${rankedCount===1?"":"s"}. #1 has a listing price verdict.`
        :`✓ Scout found ${rankedCount} ranked target choice${rankedCount===1?"":"s"}. #1 has a listing price verdict.`;
    }else{
      $("findTargetStatus").textContent=p.owned
        ?`✓ Scout found ${rankedCount} ranked upgrade choice${rankedCount===1?"":"s"}. #1 pricing evidence is limited.`
        :`✓ Scout found ${rankedCount} ranked target choice${rankedCount===1?"":"s"}. #1 pricing evidence is limited.`;
    }'''
s=replace_once(s,old,new,'main Top 5 status')
p.write_text(s,encoding='utf-8')
print('patched index.html')

# Standalone target lab fallback badge
p=Path('phase6-find-target.html')
s=p.read_text(encoding='utf-8')
s=s.replace('badges.push("OLDEST FIRST");','badges.push(s.rank===1?"SCOUT BEST FIT":"RANKED ALTERNATIVE");',1)
p.write_text(s,encoding='utf-8')
print('patched phase6-find-target.html')

# Tests
p=Path('tests/target-ranking.test.cjs')
s=p.read_text(encoding='utf-8')
s=s.replace('assert.equal(api.VERSION, "3.25.0");','assert.equal(api.VERSION, "3.25.1");',1)
old='''  await test("a two-year-newer bargain never enters the protected cohort", () => {
    const old = candidate({ id:"old", year:1961, title:"1961 Topps Sandy Koufax VG", delivered:50 });
    const newer = candidate({ id:"new", year:1963, title:"1963 Topps Sandy Koufax NM", condition:94, delivered:5 });
    const list = api.targetBuildCandidateShortlist([old,newer],100,"need","Sandy Koufax");
    assert.deepEqual(Array.from(list, x=>x.id),["old"]);
  });'''
new='''  await test("newer qualifying cards remain visible while age keeps the older card ahead", () => {
    const old = candidate({ id:"old", year:1961, title:"1961 Topps Sandy Koufax VG", delivered:50 });
    const newer = candidate({ id:"new", year:1963, title:"1963 Topps Sandy Koufax NM", condition:94, delivered:5 });
    const list = api.targetBuildCandidateShortlist([old,newer],100,"need","Sandy Koufax");
    assert.deepEqual(Array.from(list, x=>x.id),["old","new"]);
  });'''
s=replace_once(s,old,new,'two-year shortlist test')
# Add explicit five-year-spread regression before Monthly Pick test.
anchor='''  await test("Monthly Pick retains its established oldest-first branch", () => {'''
addition='''  await test("Top 5 can span more than one year beyond the oldest qualifying card", () => {
    const rows=[1961,1962,1963,1964,1965,1966].map((year,i)=>candidate({id:String(i),year,title:`${year} Topps Sandy Koufax`,condition:68,delivered:20+i}));
    const list=api.targetBuildCandidateShortlist(rows,100,"need","Sandy Koufax");
    assert.equal(list.length,5);
    assert.equal(list[0].year,1961);
    assert.ok(list.some(x=>x.year>=1963));
  });
'''+anchor
s=replace_once(s,anchor,addition,'spread Top 5 test')
p.write_text(s,encoding='utf-8')
print('patched tests/target-ranking.test.cjs')
