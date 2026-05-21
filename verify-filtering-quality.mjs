import Database from 'better-sqlite3';

const db = new Database('charon.sqlite', { readonly: true });

console.log('\n=== FILTERING QUALITY VERIFICATION ===\n');

// Check: Are high-risk candidates being properly filtered?
console.log('1. HIGH-RISK CANDIDATES THAT STILL PASSED FILTERS:\n');

const highRiskPassed = db.prepare(`
  SELECT 
    json_extract(candidate_json, '$.token.name') as name,
    json_extract(candidate_json, '$.risks.riskFactor') as risk_factor,
    json_extract(candidate_json, '$.holderData.topTenPercent') as top_ten_pct,
    json_extract(candidate_json, '$.liquidity.poolCapital') as liquidity,
    json_extract(filter_result_json, '$.health.grade') as health,
    json_extract(filter_result_json, '$.passed') as passed
  FROM candidates
  WHERE json_extract(candidate_json, '$.risks.riskFactor') > 60
    AND json_extract(filter_result_json, '$.passed') = 1
  ORDER BY json_extract(candidate_json, '$.risks.riskFactor') DESC
  LIMIT 10
`).all();

if (highRiskPassed.length > 0) {
  console.log(`Found ${highRiskPassed.length} high-risk (>60) candidates that still PASSED:\n`);
  highRiskPassed.forEach(row => {
    console.log(`  ${row.name}:`);
    console.log(`    Risk Score: ${row.risk_factor}/100 ⚠️`);
    console.log(`    Top 10 Holders: ${row.top_ten_pct}%`);
    console.log(`    Liquidity: $${row.liquidity}`);
    console.log(`    Health Grade: ${row.health}`);
    console.log(`    PASSED FILTERS: ${row.passed === 1 ? 'YES ❌' : 'NO ✅'}\n`);
  });
} else {
  console.log('✅ GOOD: No high-risk candidates passed filters\n');
}

// Check: Distribution of risk scores
console.log('\n2. RISK SCORE DISTRIBUTION:\n');

const riskDistribution = db.prepare(`
  SELECT 
    CASE 
      WHEN json_extract(candidate_json, '$.risks.riskFactor') >= 80 THEN 'CRITICAL (80-100)'
      WHEN json_extract(candidate_json, '$.risks.riskFactor') >= 60 THEN 'HIGH (60-79)'
      WHEN json_extract(candidate_json, '$.risks.riskFactor') >= 40 THEN 'MEDIUM (40-59)'
      WHEN json_extract(candidate_json, '$.risks.riskFactor') >= 20 THEN 'LOW (20-39)'
      ELSE 'MINIMAL (0-19)'
    END as risk_category,
    COUNT(*) as count,
    SUM(CASE WHEN json_extract(filter_result_json, '$.passed') = 1 THEN 1 ELSE 0 END) as passed,
    SUM(CASE WHEN json_extract(filter_result_json, '$.passed') = 0 THEN 1 ELSE 0 END) as failed
  FROM candidates
  GROUP BY risk_category
  ORDER BY json_extract(candidate_json, '$.risks.riskFactor') DESC
`).all();

console.log('Risk Category | Total | Passed | Failed | Pass % |');
console.log('---|---|---|---|---|');
riskDistribution.forEach(row => {
  const passPercent = row.total > 0 ? ((row.passed / row.total) * 100).toFixed(0) : 0;
  console.log(`${row.risk_category} | ${row.count} | ${row.passed} | ${row.failed} | ${passPercent}% |`);
});

// Check: Are HOLDER_CONCENTRATION filters triggering?
console.log('\n\n3. HOLDER CONCENTRATION FILTERING:\n');

const concentrationFilters = db.prepare(`
  SELECT 
    SUM(CASE WHEN json_extract(filter_result_json, '$.failedFilters') LIKE '%HOLDER_CONCENTRATION%' THEN 1 ELSE 0 END) as concentration_fails,
    SUM(CASE WHEN json_extract(candidate_json, '$.holderData.topTenPercent') > 75 THEN 1 ELSE 0 END) as should_fail
  FROM candidates
`).get();

console.log(`Candidates with Top 10 Holders > 75%: ${concentrationFilters.should_fail}`);
console.log(`Actually failing HOLDER_CONCENTRATION filter: ${concentrationFilters.concentration_fails}`);

if (concentrationFilters.concentration_fails === concentrationFilters.should_fail) {
  console.log('✅ PERFECT: All high-concentration tokens are being filtered\n');
} else {
  console.log(`❌ PROBLEM: ${concentrationFilters.should_fail - concentrationFilters.concentration_fails} high-concentration tokens NOT being filtered!\n`);
}

// Check: Sample of what's passing
console.log('\n4. SAMPLE OF CANDIDATES THAT PASSED FILTERS:\n');

const passingCandidates = db.prepare(`
  SELECT 
    json_extract(candidate_json, '$.token.name') as name,
    json_extract(candidate_json, '$.risks.riskFactor') as risk_factor,
    json_extract(candidate_json, '$.holderData.topTenPercent') as top_ten_pct,
    json_extract(candidate_json, '$.liquidity.poolCapital') as liquidity,
    json_extract(filter_result_json, '$.health.grade') as health
  FROM candidates
  WHERE json_extract(filter_result_json, '$.passed') = 1
  ORDER BY json_extract(candidate_json, '$.risks.riskFactor') ASC
  LIMIT 10
`).all();

console.log('Best Quality Candidates (Lowest Risk):\n');
passingCandidates.forEach((row, idx) => {
  console.log(`${idx + 1}. ${row.name}`);
  console.log(`   Risk: ${row.risk_factor}/100 | Top10: ${row.top_ten_pct}% | Liquidity: $${row.liquidity} | Grade: ${row.health}`);
});

db.close();
console.log('\n=== VERIFICATION COMPLETE ===\n');
