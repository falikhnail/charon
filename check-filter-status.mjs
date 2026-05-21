import Database from 'better-sqlite3';

const db = new Database('charon.sqlite', { readonly: true });

// Check filter status
console.log('\n=== CANDIDATE FILTERING STATUS ===\n');

const filterStats = db.prepare(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN json_extract(filter_result_json, '$.passed') = 1 THEN 1 ELSE 0 END) as passed,
    SUM(CASE WHEN json_extract(filter_result_json, '$.passed') = 0 THEN 1 ELSE 0 END) as failed
  FROM candidates
`).get();

console.log(`Total Candidates: ${filterStats.total}`);
console.log(`Passed Filters: ${filterStats.passed} (${((filterStats.passed / filterStats.total) * 100).toFixed(1)}%)`);
console.log(`Failed Filters: ${filterStats.failed} (${((filterStats.failed / filterStats.total) * 100).toFixed(1)}%)`);

// Show failure reasons
console.log('\n=== FAILURE REASONS ===\n');

const failureReasons = db.prepare(`
  SELECT 
    json_extract(filter_result_json, '$.reason') as reason,
    COUNT(*) as count
  FROM candidates
  WHERE json_extract(filter_result_json, '$.passed') = 0
  GROUP BY reason
  ORDER BY count DESC
`).all();

failureReasons.forEach(row => {
  console.log(`${row.reason}: ${row.count}`);
});

// Show example of PASSED candidate
console.log('\n=== EXAMPLE: PASSED FILTER ===\n');

const passedExample = db.prepare(`
  SELECT 
    mint,
    json_extract(candidate_json, '$.token.name') as name,
    json_extract(candidate_json, '$.metrics.liquidityUsd') as liquidity,
    json_extract(candidate_json, '$.metrics.graduatedVolumeUsd') as vol_grad,
    json_extract(candidate_json, '$.metrics.trendingVolumeUsd') as vol_trend,
    json_extract(candidate_json, '$.holders.topTenPercent') as top_ten_pct,
    json_extract(filter_result_json, '$.health.grade') as health_grade,
    filter_result_json
  FROM candidates
  WHERE json_extract(filter_result_json, '$.passed') = 1
  LIMIT 1
`).get();

if (passedExample) {
  console.log(`Token: ${passedExample.name} (${passedExample.mint})`);
  console.log(`Liquidity: $${passedExample.liquidity}`);
  console.log(`Volume (Grad): $${passedExample.vol_grad} | (Trending): $${passedExample.vol_trend}`);
  console.log(`Top 10 Holders: ${passedExample.top_ten_pct}%`);
  console.log(`Health: ${passedExample.health_grade}`);
  console.log(`Full Filter Result:`, JSON.stringify(JSON.parse(passedExample.filter_result_json), null, 2));
} else {
  console.log('No candidates passed filters');
}

// Show example of FAILED candidate
console.log('\n=== EXAMPLE: FAILED FILTER ===\n');

const failedExample = db.prepare(`
  SELECT 
    mint,
    json_extract(candidate_json, '$.token.name') as name,
    json_extract(candidate_json, '$.metrics.liquidityUsd') as liquidity,
    json_extract(candidate_json, '$.metrics.graduatedVolumeUsd') as vol_grad,
    json_extract(candidate_json, '$.metrics.trendingVolumeUsd') as vol_trend,
    json_extract(candidate_json, '$.holders.topTenPercent') as top_ten_pct,
    json_extract(filter_result_json, '$.health.grade') as health_grade,
    filter_result_json
  FROM candidates
  WHERE json_extract(filter_result_json, '$.passed') = 0
  LIMIT 1
`).get();

if (failedExample) {
  console.log(`Token: ${failedExample.name} (${failedExample.mint})`);
  console.log(`Liquidity: $${failedExample.liquidity}`);
  console.log(`Volume (Grad): $${failedExample.vol_grad} | (Trending): $${failedExample.vol_trend}`);
  console.log(`Top 10 Holders: ${failedExample.top_ten_pct}%`);
  console.log(`Health: ${failedExample.health_grade}`);
  console.log(`Full Filter Result:`, JSON.stringify(JSON.parse(failedExample.filter_result_json), null, 2));
} else {
  console.log('No candidates failed filters');
}

// Check if holder concentration is being checked
console.log('\n=== HOLDER CONCENTRATION CHECK ===\n');

const holderCheck = db.prepare(`
  SELECT 
    json_extract(candidate_json, '$.token.name') as name,
    json_extract(candidate_json, '$.holders.topTenPercent') as top_ten,
    json_extract(candidate_json, '$.holders.holders[0].percent') as top_holder_pct,
    json_extract(filter_result_json, '$.reason') as filter_reason
  FROM candidates
  WHERE json_extract(candidate_json, '$.holders.topTenPercent') IS NOT NULL
  ORDER BY json_extract(candidate_json, '$.holders.topTenPercent') DESC
  LIMIT 5
`).all();

if (holderCheck.length > 0) {
  console.log('Top 5 by Holder Concentration:');
  holderCheck.forEach(row => {
    console.log(`  ${row.name}: Top 10 = ${row.top_ten}%, Top 1 = ${row.top_holder_pct}% | Filter: ${row.filter_reason}`);
  });
} else {
  console.log('No topTenPercent data found in holders - FIELD MAPPING ISSUE');
}

db.close();
