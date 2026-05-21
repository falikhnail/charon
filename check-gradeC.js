import { db } from './src/db/connection.js';

const gradeC = db.prepare(`
  SELECT id, candidate_json, created_at_ms, status
  FROM candidates
  WHERE candidate_json LIKE '%"grade":"C"%'
  ORDER BY created_at_ms DESC
  LIMIT 3
`).all();

console.log('Grade C Tokens:\n');
gradeC.forEach((c, i) => {
  const candidate = JSON.parse(c.candidate_json);
  const mint = candidate.token?.mint?.slice(0, 8) || 'unknown';
  const health = candidate.health?.score;
  const volume = candidate.metrics?.volume24h || 0;
  const chart = candidate.chart || {};
  const athDist = chart.distanceFromAthPercent;
  const priceNative = chart.currentNative;
  
  console.log(`${i + 1}. ${mint}... (Grade C, score: ${health}, vol: $${volume})`);
  console.log(`   Name: ${candidate.token?.name}`);
  console.log(`   Price: ${priceNative} | ATH distance: ${athDist}%`);
  console.log(`   Status: ${c.status}`);
  const signals = candidate.signals;
  if (Array.isArray(signals)) {
    console.log(`   Signals: ${signals.map(s => s.type).join(', ')}`);
  } else if (signals && typeof signals === 'object') {
    console.log(`   Signals: ${Object.values(signals).map(s => s?.type).join(', ')}`);
  }
  console.log('');
});

// Also show volume distribution
console.log('\nVolume stats:');
const volumeStats = db.prepare(`
  SELECT
    JSON_EXTRACT(candidate_json, '$.health.grade') as grade,
    AVG(CAST(JSON_EXTRACT(candidate_json, '$.metrics.volume24h') AS REAL)) as avg_vol,
    MIN(CAST(JSON_EXTRACT(candidate_json, '$.metrics.volume24h') AS REAL)) as min_vol,
    MAX(CAST(JSON_EXTRACT(candidate_json, '$.metrics.volume24h') AS REAL)) as max_vol
  FROM candidates
  GROUP BY grade
  ORDER BY grade DESC
`).all();

volumeStats.forEach(v => {
  console.log(`  Grade ${v.grade || '?'}: avg $${v.avg_vol?.toFixed(2) || 0} | min $${v.min_vol?.toFixed(2) || 0} | max $${v.max_vol?.toFixed(2) || 0}`);
});
