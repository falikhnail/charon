import { db } from './src/db/connection.js';

// Get newest candidate to inspect structure
const newest = db.prepare(`
  SELECT id, candidate_json FROM candidates ORDER BY id DESC LIMIT 1
`).get();

const candidate = JSON.parse(newest.candidate_json);

console.log('=== ACTUAL DATA AVAILABLE vs EXPECTED BY RISK ANALYZER ===\n');

console.log('FOR HOLDER RISK ANALYSIS:');
console.log('Expected:  candidate.holderData.topTenPercent, topFiftyPercent');
console.log(`Available: candidate.metrics.holderCount = ${candidate.metrics?.holderCount}`);
console.log(`Available: candidate.holders = ${Array.isArray(candidate.holders) ? candidate.holders.length + ' items' : 'N/A'}`);
if (Array.isArray(candidate.holders) && candidate.holders.length > 0) {
  console.log(`           First holder: ${JSON.stringify(candidate.holders[0]).substring(0, 100)}`);
}

console.log('\n' + '='.repeat(80));

console.log('\nFOR LIQUIDITY RISK ANALYSIS:');
console.log('Expected:  candidate.liquidity.poolCapital, bidAskSpread');
console.log(`Available: candidate.metrics.liquidityUsd = $${candidate.metrics?.liquidityUsd}`);
console.log(`Available: candidate.gmgn = ${candidate.gmgn ? Object.keys(candidate.gmgn).join(', ') : 'N/A'}`);

console.log('\n' + '='.repeat(80));

console.log('\nFOR MANIPULATION RISK ANALYSIS:');
console.log('Expected:  candidate.bundlerData.bundledPercent');
console.log(`Available: candidate.metrics.gmgnTradeFeesSol = ${candidate.metrics?.gmgnTradeFeesSol}`);
console.log(`Available: candidate.metrics.gmgnTotalFeesSol = ${candidate.metrics?.gmgnTotalFeesSol}`);

console.log('\n' + '='.repeat(80));

console.log('\nFOR AGE RISK ANALYSIS:');
console.log('Expected:  candidate.ageData.createdMinutesAgo');
console.log(`Available: candidate.createdAtMs = ${candidate.createdAtMs}`);
const ageMinutes = (Date.now() - candidate.createdAtMs) / (1000 * 60);
console.log(`           Age: ${ageMinutes.toFixed(0)} minutes`);

console.log('\n' + '='.repeat(80));

console.log('\n=== MISSING CALCULATED FIELDS ===\n');
console.log('To enable risk analysis, we need to calculate:');
console.log('  1. holderData.topTenPercent - from candidate.holders distribution');
console.log('  2. holderData.topFiftyPercent - from candidate.holders distribution');
console.log('  3. liquidity.poolCapital - HAVE this as liquidityUsd');
console.log('  4. liquidity.bidAskSpread - NOT AVAILABLE from current APIs');
console.log('  5. bundlerData.bundledPercent - calculate from fee data');
console.log('  6. ageData.createdMinutesAgo - calculate from createdAtMs');

console.log('\n=== ACTION ITEMS ===\n');
console.log('✅ CAN FIX NOW:');
console.log('  - Calculate topTenPercent/topFiftyPercent from holders array');
console.log('  - Map liquidityUsd to liquidity.poolCapital');
console.log('  - Calculate bundled percent from fee data');
console.log('  - Calculate age from createdAtMs');

console.log('\n❌ MISSING DATA (need API):');
console.log('  - Bid-ask spread (not available from current APIs)');
