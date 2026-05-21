import { db } from './src/db/connection.js';

console.log('=== COMPREHENSIVE DATA FIELD AUDIT ===\n');

// Get all candidates
const allCandidates = db.prepare(`
  SELECT id, candidate_json FROM candidates 
`).all();

console.log(`Total candidates in database: ${allCandidates.length}\n`);

// Parse and analyze all data
const fieldStats = {};
const nullFields = {};
const missingFields = {};

allCandidates.forEach(row => {
  const candidate = JSON.parse(row.candidate_json);
  
  // Define all expected fields
  const fields = {
    // Token info
    'token.mint': candidate.token?.mint,
    'token.name': candidate.token?.name,
    'token.symbol': candidate.token?.symbol,
    'token.twitter': candidate.token?.twitter,
    'token.website': candidate.token?.website,
    
    // Metrics
    'metrics.priceUsd': candidate.metrics?.priceUsd,
    'metrics.marketCapUsd': candidate.metrics?.marketCapUsd,
    'metrics.liquidityUsd': candidate.metrics?.liquidityUsd,
    'metrics.holderCount': candidate.metrics?.holderCount,
    'metrics.volume24hUsd': candidate.metrics?.trendingVolumeUsd || candidate.metrics?.graduatedVolumeUsd,
    'metrics.gmgnTotalFeesSol': candidate.metrics?.gmgnTotalFeesSol,
    'metrics.gmgnTradeFeesSol': candidate.metrics?.gmgnTradeFeesSol,
    
    // Health & Risks
    'health.score': candidate.health?.score,
    'health.grade': candidate.health?.grade,
    'health.components': candidate.health?.components ? Object.keys(candidate.health.components).length : 0,
    'risks.holderRisks': candidate.risks?.holderRisks?.length || 0,
    'risks.liquidityRisks': candidate.risks?.liquidityRisks?.length || 0,
    'risks.manipulationRisks': candidate.risks?.manipulationRisks?.length || 0,
    'risks.ageRisks': candidate.risks?.ageRisks?.length || 0,
    'risks.signalRisks': candidate.risks?.signalRisks?.length || 0,
    'risks.riskFactor': candidate.risks?.riskFactor,
    
    // Entry Timing
    'entryTiming.strategy': candidate.entryTiming?.strategy,
    'entryTiming.priceDistanceFromAth': candidate.entryTiming?.priceDistanceFromAth,
    'entryTiming.entryQualityScore': candidate.entryTiming?.entryQualityScore,
    
    // Chart/Price Action
    'chart.currentNative': candidate.chart?.currentNative,
    'chart.rangeHighNative': candidate.chart?.rangeHighNative,
    'chart.distanceFromAthPercent': candidate.chart?.distanceFromAthPercent,
    'chart.windows': candidate.chart?.windows?.length || 0,
    
    // Signal data
    'signals.route': candidate.signals?.route,
    'signals.label': candidate.signals?.label,
    'signals.hasFeeClaim': candidate.signals?.hasFeeClaim,
    'signals.hasGraduated': candidate.signals?.hasGraduated,
    'signals.hasTrending': candidate.signals?.hasTrending,
    
    // Enrichment
    'gmgn.data': candidate.gmgn ? Object.keys(candidate.gmgn).length : 0,
    'jupiterAsset.data': candidate.jupiterAsset ? Object.keys(candidate.jupiterAsset).length : 0,
    'twitterNarrative': candidate.twitterNarrative ? 'present' : 'missing',
    'holders.data': candidate.holders ? Array.isArray(candidate.holders) ? candidate.holders.length : 'object' : 0,
  };
  
  // Count stats
  Object.entries(fields).forEach(([fieldName, value]) => {
    if (!fieldStats[fieldName]) {
      fieldStats[fieldName] = {
        count: 0,
        nullCount: 0,
        missingCount: 0,
        values: []
      };
    }
    
    if (value === null || value === undefined) {
      fieldStats[fieldName].nullCount++;
      fieldStats[fieldName].missingCount++;
    } else if (value === 0 || value === '' || (Array.isArray(value) && value.length === 0)) {
      fieldStats[fieldName].nullCount++;
    } else {
      fieldStats[fieldName].count++;
      // Store sample values for analysis
      if (fieldStats[fieldName].values.length < 3) {
        fieldStats[fieldName].values.push(typeof value === 'string' ? value.substring(0, 30) : value);
      }
    }
  });
});

// Display results
console.log('FIELD COMPLETENESS ANALYSIS:\n');
console.log('Field Name | Present | Null/Empty | Missing % | Status\n');
console.log('-'.repeat(80));

const sortedFields = Object.entries(fieldStats).sort((a, b) => {
  const completenessA = a[1].count / allCandidates.length;
  const completenessB = b[1].count / allCandidates.length;
  return completenessB - completenessA;
});

sortedFields.forEach(([fieldName, stats]) => {
  const present = stats.count;
  const nullEmpty = stats.nullCount;
  const missingPercent = ((nullEmpty / allCandidates.length) * 100).toFixed(1);
  const status = present === allCandidates.length ? '✅ COMPLETE' : 
                 present === 0 ? '❌ MISSING' : 
                 missingPercent > 50 ? '⚠️ INCOMPLETE' : '🟡 PARTIAL';
  
  console.log(`${fieldName.padEnd(30)} | ${String(present).padEnd(7)} | ${String(nullEmpty).padEnd(10)} | ${missingPercent.padStart(7)}% | ${status}`);
});

// Critical missing fields
console.log('\n\nCRITICAL MISSING FIELDS (>50% missing):\n');
const critical = sortedFields.filter(([_, stats]) => (stats.nullCount / allCandidates.length) > 0.5);

if (critical.length === 0) {
  console.log('✅ No critical missing fields - all data well collected!');
} else {
  critical.forEach(([fieldName, stats]) => {
    const missingPercent = ((stats.nullCount / allCandidates.length) * 100).toFixed(1);
    console.log(`❌ ${fieldName}: ${missingPercent}% missing (${stats.nullCount}/${allCandidates.length})`);
  });
}

// Data enrichment gaps
console.log('\n\nDATA ENRICHMENT SOURCES:\n');
const enrichmentFields = [
  ['gmgn.data', 'GMGN API'],
  ['jupiterAsset.data', 'Jupiter API'],
  ['holders.data', 'Jupiter Holders'],
  ['twitterNarrative', 'Twitter API'],
];

enrichmentFields.forEach(([fieldName, apiName]) => {
  const stats = fieldStats[fieldName];
  if (stats) {
    const percent = ((stats.count / allCandidates.length) * 100).toFixed(1);
    console.log(`  ${apiName.padEnd(20)}: ${percent}% (${stats.count}/${allCandidates.length})`);
  }
});

// Average metrics
console.log('\n\nMETRICS DISTRIBUTION:\n');
const liquidityValues = [];
const volumeValues = [];
const healthScores = [];

allCandidates.forEach(row => {
  const candidate = JSON.parse(row.candidate_json);
  if (candidate.metrics?.liquidityUsd) liquidityValues.push(candidate.metrics.liquidityUsd);
  if (candidate.metrics?.trendingVolumeUsd || candidate.metrics?.graduatedVolumeUsd) {
    volumeValues.push(candidate.metrics.trendingVolumeUsd || candidate.metrics.graduatedVolumeUsd);
  }
  if (candidate.health?.score) healthScores.push(candidate.health.score);
});

const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
const min = (arr) => Math.min(...arr);
const max = (arr) => Math.max(...arr);

console.log(`Liquidity USD:`);
console.log(`  Avg: $${avg(liquidityValues).toFixed(0)} | Min: $${min(liquidityValues).toFixed(0)} | Max: $${max(liquidityValues).toFixed(0)}`);

console.log(`\nVolume 24h USD:`);
console.log(`  Avg: $${avg(volumeValues).toFixed(0)} | Min: $${min(volumeValues).toFixed(0)} | Max: $${max(volumeValues).toFixed(0)}`);

console.log(`\nHealth Score:`);
console.log(`  Avg: ${avg(healthScores).toFixed(1)}/100 | Min: ${min(healthScores)} | Max: ${max(healthScores)}`);
