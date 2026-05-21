import { db } from './src/db/connection.js';

const recentWatch = db.prepare(`
  SELECT id, candidate_json, created_at_ms
  FROM candidates
  WHERE status = 'watch'
  ORDER BY created_at_ms DESC
  LIMIT 5
`).all();

console.log('Recent WATCH candidates with entry timing:\n');
recentWatch.forEach((c, i) => {
  const candidate = JSON.parse(c.candidate_json);
  const mint = candidate.token?.mint?.slice(0, 8) || 'unknown';
  const health = candidate.health?.score;
  const grade = candidate.health?.grade;
  const volume = candidate.metrics?.graduatedVolumeUsd || candidate.metrics?.trendingVolumeUsd || 0;
  const timing = candidate.chart?.entryTiming || 'N/A';
  const athDist = candidate.chart?.distanceFromAthPercent;
  const priceNative = candidate.chart?.currentNative;
  
  console.log(`${i + 1}. ${mint}... (Grade ${grade}, health: ${health}, vol: $${volume})`);
  console.log(`   Entry timing: ${timing}`);
  console.log(`   ATH distance: ${athDist}%`);
  console.log(`   Price: ${priceNative}`);
  console.log('');
});
