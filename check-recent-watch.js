import { db } from './src/db/connection.js';

const watchRecent = db.prepare(`
  SELECT id, candidate_json, created_at_ms, status
  FROM candidates
  WHERE status = 'watch'
  ORDER BY created_at_ms DESC
  LIMIT 10
`).all();

console.log('Most recent WATCH candidates (should have passed filters & have volume):\n');
watchRecent.forEach((c, i) => {
  const candidate = JSON.parse(c.candidate_json);
  const mint = candidate.token?.mint?.slice(0, 8) || 'unknown';
  const volume = candidate.metrics?.graduatedVolumeUsd || candidate.metrics?.trendingVolumeUsd || 0;
  const grade = candidate.health?.grade || '?';
  const health = candidate.health?.score || '?';
  const filters = candidate.filters || {};
  
  console.log(`${i + 1}. ${mint}... (health: ${health}/${grade}, vol: $${volume})`);
  console.log(`   Created: ${new Date(c.created_at_ms).toISOString()}`);
  console.log(`   Filters passed: ${filters.passed}`);
  console.log('');
});
