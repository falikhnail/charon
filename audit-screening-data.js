import { db } from './src/db/connection.js';

// Ambil 3 kandidat terbaru dengan data lengkap
const recentCandidates = db.prepare(`
  SELECT id, candidate_json, created_at_ms, status
  FROM candidates
  WHERE status = 'watch'
  ORDER BY created_at_ms DESC
  LIMIT 3
`).all();

console.log('=== DATA SCREENING AUDIT ===\n');

recentCandidates.forEach((c, i) => {
  const candidate = JSON.parse(c.candidate_json);
  
  console.log(`\n[CANDIDATE ${i + 1}] ${candidate.token?.name} (${candidate.token?.mint?.slice(0, 8)}...)`);
  console.log(`Status: ${c.status} | Health Grade: ${candidate.health?.grade} (score: ${candidate.health?.score})`);
  
  console.log('\n📊 METRICS COLLECTED:');
  console.log(`  ✓ Price USD: $${candidate.metrics?.priceUsd || 'N/A'}`);
  console.log(`  ✓ Market Cap: $${candidate.metrics?.marketCapUsd || 'N/A'}`);
  console.log(`  ✓ Liquidity: $${candidate.metrics?.liquidityUsd || 'N/A'}`);
  console.log(`  ✓ Volume 24h (Trending): $${candidate.metrics?.trendingVolumeUsd || 0}`);
  console.log(`  ✓ Volume 24h (Graduated): $${candidate.metrics?.graduatedVolumeUsd || 0}`);
  console.log(`  ✓ Holder Count: ${candidate.metrics?.holderCount || 'N/A'}`);
  
  console.log('\n🎯 SIGNALS:');
  console.log(`  • Has Fee Claim: ${candidate.signals?.hasFeeClaim ? '✓ YES' : '✗ NO'}`);
  console.log(`  • Has Graduated: ${candidate.signals?.hasGraduated ? '✓ YES' : '✗ NO'}`);
  console.log(`  • Has Trending: ${candidate.signals?.hasTrending ? '✓ YES' : '✗ NO'}`);
  console.log(`  • Signal Route: ${candidate.signals?.route}`);
  
  console.log('\n⚠️ RISKS DETECTED:');
  if (candidate.risks && Object.keys(candidate.risks).length > 0) {
    Object.entries(candidate.risks).forEach(([key, value]) => {
      if (value) console.log(`  ⚠️ ${key}: ${value}`);
    });
  } else {
    console.log('  (no risks data)');
  }
  
  console.log('\n📈 PRICE ACTION:');
  console.log(`  • Current Price (Native): ${candidate.chart?.currentNative || 'N/A'}`);
  console.log(`  • Range High (Native): ${candidate.chart?.rangeHighNative || 'N/A'}`);
  console.log(`  • Distance from ATH: ${candidate.chart?.distanceFromAthPercent || 'N/A'}%`);
  
  console.log('\n⏱️ TIMING:');
  console.log(`  • Entry Timing: ${candidate.entryTiming?.timing || 'N/A'}`);
  console.log(`  • Entry Score: ${candidate.entryTiming?.score || 'N/A'}`);
  
  console.log('\n✅ FILTER RESULT:');
  if (candidate.filters) {
    console.log(`  • Passed: ${candidate.filters.passed ? 'YES ✓' : 'NO ✗'}`);
    console.log(`  • Reason: ${candidate.filters.reason}`);
    console.log(`  • Failed Filters: ${(candidate.filters.failedFilters || []).join(', ') || 'none'}`);
  }
  
  console.log('\n' + '─'.repeat(80));
});
