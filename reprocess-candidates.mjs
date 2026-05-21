import Database from 'better-sqlite3';
import { normalizeForRiskAnalysis } from './src/pipeline/candidateBuilder.js';
import { analyzeTokenRisks } from './src/pipeline/tokenRiskAnalyzer.js';
import { filterCandidate } from './src/pipeline/candidateBuilder.js';
import { calculateTokenHealthScore } from './src/pipeline/advancedFilters.js';
import { activeStrategy } from './src/db/settings.js';

const db = new Database('charon.sqlite');

console.log('\n=== CANDIDATE RE-PROCESSING WITH NORMALIZATION ===\n');

const strat = activeStrategy();

// Get all candidates
const candidates = db.prepare(`
  SELECT id, candidate_json
  FROM candidates
`).all();

console.log(`Processing ${candidates.length} candidates...`);

let processed = 0;
let updated = 0;
let errors = 0;

const updateStmt = db.prepare(`
  UPDATE candidates 
  SET 
    candidate_json = ?,
    filter_result_json = ?
  WHERE id = ?
`);

const startTime = Date.now();

for (const row of candidates) {
  try {
    let candidate = JSON.parse(row.candidate_json);
    
    // Apply normalization
    normalizeForRiskAnalysis(candidate);
    
    // Recalculate health
    candidate.health = calculateTokenHealthScore(candidate);
    
    // Recalculate risks
    candidate.risks = analyzeTokenRisks(candidate);
    
    // Recalculate filters
    const filters = filterCandidate(candidate, strat);
    candidate.filters = filters;
    
    // Update database
    updateStmt.run(
      JSON.stringify(candidate),
      JSON.stringify(filters),
      row.id
    );
    
    updated++;
    processed++;
    
    if (processed % 25 === 0) {
      console.log(`  ${processed}/${candidates.length} processed...`);
    }
  } catch (err) {
    errors++;
    console.log(`  ERROR on candidate ${row.id}: ${err.message}`);
  }
}

const duration = ((Date.now() - startTime) / 1000).toFixed(2);

console.log(`\n=== PROCESSING COMPLETE ===`);
console.log(`Total Processed: ${processed}`);
console.log(`Successfully Updated: ${updated}`);
console.log(`Errors: ${errors}`);
console.log(`Duration: ${duration}s`);

// Now check the new filtering status
console.log('\n=== NEW FILTERING STATUS ===\n');

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

// Show new failure reasons
console.log('\n=== TOP FAILURE REASONS ===\n');

const failureReasons = db.prepare(`
  SELECT 
    json_extract(filter_result_json, '$.reason') as reason,
    COUNT(*) as count
  FROM candidates
  WHERE json_extract(filter_result_json, '$.passed') = 0
  GROUP BY reason
  ORDER BY count DESC
  LIMIT 10
`).all();

failureReasons.forEach(row => {
  const percent = ((row.count / filterStats.failed) * 100).toFixed(1);
  console.log(`  ${row.reason}: ${row.count} (${percent}%)`);
});

// Show examples of new risks detected
console.log('\n=== EXAMPLES OF HIGH-RISK CANDIDATES NOW FILTERED ===\n');

const highRiskExamples = db.prepare(`
  SELECT 
    json_extract(candidate_json, '$.token.name') as name,
    json_extract(candidate_json, '$.risks.riskFactor') as risk_factor,
    json_extract(filter_result_json, '$.reason') as filter_reason,
    json_extract(candidate_json, '$.holderData.topTenPercent') as top_ten_pct,
    json_extract(candidate_json, '$.liquidity.poolCapital') as liquidity
  FROM candidates
  WHERE json_extract(candidate_json, '$.risks.riskFactor') > 50
  ORDER BY json_extract(candidate_json, '$.risks.riskFactor') DESC
  LIMIT 5
`).all();

if (highRiskExamples.length > 0) {
  console.log('Candidates with Risk Factor > 50:');
  highRiskExamples.forEach(row => {
    console.log(`  ${row.name}: Risk=${row.risk_factor} | Top10=${row.top_ten_pct}% | Liquidity=$${row.liquidity}`);
    console.log(`    Filter Result: ${row.filter_reason}`);
  });
} else {
  console.log('No high-risk candidates found');
}

db.close();
console.log('\n=== DONE ===\n');
