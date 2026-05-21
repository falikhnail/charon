import Database from 'better-sqlite3';

const db = new Database('charon.sqlite', { readonly: true });

console.log('\n=== DEBUG: HOLDER_CONCENTRATION FILTER ===\n');

// Get settings to see what maxTopTenPercent is set to
const settings = db.prepare(`
  SELECT json_extract(settings_json, '$.filtering.maxTopTenPercent') as maxTopTenPercent
  FROM settings
  LIMIT 1
`).get();

console.log(`Current Setting - maxTopTenPercent: ${settings?.maxTopTenPercent || 'NOT SET (defaults to 75)'}\n`);

// Find candidates with high holder concentration that passed filters
const highConcentration = db.prepare(`
  SELECT 
    id,
    json_extract(candidate_json, '$.token.name') as name,
    json_extract(candidate_json, '$.holderData.topTenPercent') as holderData_top_ten,
    json_extract(candidate_json, '$.holders.topTenPercent') as holders_top_ten,
    json_extract(candidate_json, '$.holders.holders[0].percent') as top_holder,
    json_extract(candidate_json, '$.holders.holders[1].percent') as second_holder,
    json_extract(filter_result_json, '$.passed') as passed,
    json_extract(filter_result_json, '$.failedFilters') as failed_filters,
    filter_result_json
  FROM candidates
  WHERE json_extract(candidate_json, '$.holderData.topTenPercent') > 75
     OR (json_extract(candidate_json, '$.holders.holders[0].percent') > 75)
  LIMIT 5
`).all();

console.log(`Found ${highConcentration.length} candidates with concentration > 75%:\n`);

highConcentration.forEach((row, idx) => {
  console.log(`${idx + 1}. ${row.name}:`);
  console.log(`   holderData.topTenPercent: ${row.holderData_top_ten}`);
  console.log(`   holders.topTenPercent: ${row.holders_top_ten}`);
  console.log(`   Top holder: ${row.top_holder}% | 2nd holder: ${row.second_holder}%`);
  console.log(`   PASSED: ${row.passed}`);
  console.log(`   Failed Filters: ${row.failed_filters}`);
  
  const filterResult = JSON.parse(row.filter_result_json);
  console.log(`   Full failedFilters array: ${JSON.stringify(filterResult.failedFilters)}`);
  console.log();
});

// Check: Are any candidates actually failing HOLDER_CONCENTRATION filter?
const concentrationFailures = db.prepare(`
  SELECT COUNT(*) as count
  FROM candidates
  WHERE json_extract(filter_result_json, '$.failedFilters') LIKE '%HOLDER_CONCENTRATION%'
`).get();

console.log(`Total candidates failing HOLDER_CONCENTRATION filter: ${concentrationFailures.count}`);

if (concentrationFailures.count === 0) {
  console.log('⚠️  WARNING: No candidates are being rejected for holder concentration!\n');
  
  // Debug: Check if the field value is actually being set
  const fieldTest = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN json_extract(candidate_json, '$.holderData') IS NOT NULL THEN 1 ELSE 0 END) as has_holderData,
      SUM(CASE WHEN json_extract(candidate_json, '$.holderData.topTenPercent') IS NOT NULL THEN 1 ELSE 0 END) as has_topTenPercent,
      AVG(json_extract(candidate_json, '$.holderData.topTenPercent')) as avg_topTenPercent
    FROM candidates
  `).get();
  
  console.log('\nField Availability:');
  console.log(`  Candidates with holderData: ${fieldTest.has_holderData}/${fieldTest.total}`);
  console.log(`  Candidates with topTenPercent: ${fieldTest.has_topTenPercent}/${fieldTest.total}`);
  console.log(`  Average topTenPercent: ${fieldTest.avg_topTenPercent}`);
}

db.close();
console.log('\n=== DEBUG COMPLETE ===\n');
