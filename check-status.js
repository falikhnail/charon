import { db } from './src/db/connection.js';

// Check candidates by status and volume
const byStatus = db.prepare(`
  SELECT status, COUNT(*) as count
  FROM candidates
  GROUP BY status
`).all();

console.log('Candidates by status:');
byStatus.forEach(row => {
  console.log(`  ${row.status}: ${row.count}`);
});

// Check watch vs filtered
const watchCandidates = db.prepare(`
  SELECT id, candidate_json
  FROM candidates
  WHERE status = 'watch'
  LIMIT 5
`).all();

console.log('\nWatch status candidates (passed filters):');
watchCandidates.forEach(c => {
  const candidate = JSON.parse(c.candidate_json);
  const filters = candidate.filters || {};
  const volume24h = candidate.metrics?.graduatedVolumeUsd || candidate.metrics?.trendingVolumeUsd || 0;
  console.log(`  ${candidate.token?.mint?.slice(0, 8)}... (vol: $${volume24h}, filters.passed: ${filters.passed})`);
});
