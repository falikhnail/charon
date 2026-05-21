https://github.com/login/oauth/select_account?client_id=01ab8ac9400c4e429b23&code_challenge=cVuBabpIQiWY7MyDFSUX-U4d6drII8VYrlcKqoeN-gA&code_challenge_method=S256&get_started_with=copilot-vscode&prompt=select_account&provider=google&redirect_uri=https%3A%2F%2Fvscode.dev%2Fredirect&scope=read%3Auser+repo+user%3Aemail+workflow&state=http%3A%2F%2F127.0.0.1%3A53869%2Fcallback%3Fnonce%3D3M%252FzCGRumUErtVbsu%252Bh5ig%253D%253D/stratset sniper llm_min_confidence 40/stratset sniper llm_min_confidence 40/stratset sniper llm_min_confidence 40/stratset sniper llm_min_confidence 40/stratset sniper llm_min_confidence 40/stratset sniper llm_min_confidence 30/stratset sniper llm_min_confidence 40/stratset sniper llm_min_confidence 30import Database from 'better-sqlite3';

const db = new Database('charon.sqlite', { readonly: true });

console.log('\n=== DIRECT FILTERING VERIFICATION ===\n');

// Get a candidate with high holder concentration
const sample = db.prepare(`
  SELECT 
    id,
    json_extract(candidate_json, '$.token.name') as name,
    json_extract(candidate_json, '$.holderData.topTenPercent') as top_ten,
    json_extract(filter_result_json, '$.passed') as passed,
    json_extract(filter_result_json, '$.reason') as reason,
    json_extract(filter_result_json, '$.failedFilters') as failed_filters,
    json_extract(candidate_json, '$.risks.holderRisks') as holder_risks,
    json_extract(candidate_json, '$.risks.riskFactor') as risk_factor
  FROM candidates
  WHERE json_extract(candidate_json, '$.holderData.topTenPercent') > 75
  LIMIT 3
`).all();

console.log(`Sample of high-concentration candidates (topTenPercent > 75%):\n`);

sample.forEach((row, idx) => {
  const riskFactor = JSON.parse(row.risk_factor || 0);
  const holderRisks = JSON.parse(row.holder_risks || '[]');
  const failedFilters = JSON.parse(row.failed_filters || '[]');
  
  console.log(`${idx + 1}. ${row.name} (ID: ${row.id})`);
  console.log(`   Top 10 Holders: ${row.top_ten}%`);
  console.log(`   Risk Factor: ${riskFactor}`);
  console.log(`   Holder Risks Detected: ${JSON.stringify(holderRisks)}`);
  console.log(`   Filter Status: ${row.passed === 1 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   Failed Filters: ${JSON.stringify(failedFilters)}`);
  console.log(`   Filter Reason: ${row.reason}`);
  console.log();
});

// Count statistics
console.log('\n--- FILTERING STATISTICS ---\n');

const stats = db.prepare(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN json_extract(candidate_json, '$.holderData.topTenPercent') > 75 THEN 1 ELSE 0 END) as high_concentration,
    SUM(CASE WHEN json_extract(candidate_json, '$.holderData.topTenPercent') > 75 AND json_extract(filter_result_json, '$.passed') = 1 THEN 1 ELSE 0 END) as high_conc_passed,
    SUM(CASE WHEN json_extract(candidate_json, '$.holderData.topTenPercent') > 75 AND json_extract(filter_result_json, '$.passed') = 0 THEN 1 ELSE 0 END) as high_conc_failed
  FROM candidates
`).get();

console.log(`Total Candidates: ${stats.total}`);
console.log(`High Concentration (>75%): ${stats.high_concentration}`);
console.log(`  Passed Filters: ${stats.high_conc_passed}`);
console.log(`  Failed Filters: ${stats.high_conc_failed}`);

if (stats.high_conc_passed > 0) {
  console.log(`\n⚠️  ALERT: ${stats.high_conc_passed} high-concentration tokens PASSED filters!`);
} else {
  console.log(`\n✅ GOOD: All high-concentration tokens were REJECTED`);
}

// Distribution of risk scores among passed candidates
console.log('\n--- RISK SCORES OF PASSED CANDIDATES ---\n');

const passedRiskDist = db.prepare(`
  SELECT 
    CASE 
      WHEN json_extract(candidate_json, '$.risks.riskFactor') >= 60 THEN 'HIGH (60+)'
      WHEN json_extract(candidate_json, '$.risks.riskFactor') >= 30 THEN 'MEDIUM (30-59)'
      WHEN json_extract(candidate_json, '$.risks.riskFactor') > 0 THEN 'LOW (1-29)'
      ELSE 'MINIMAL (0)'
    END as risk_level,
    COUNT(*) as count
  FROM candidates
  WHERE json_extract(filter_result_json, '$.passed') = 1
  GROUP BY risk_level
  ORDER BY json_extract(candidate_json, '$.risks.riskFactor') DESC
`).all();

passedRiskDist.forEach(row => {
  console.log(`${row.risk_level}: ${row.count} candidates`);
});

db.close();
console.log('\n=== VERIFICATION COMPLETE ===\n');
