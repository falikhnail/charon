import { db } from './src/db/connection.js';

const recentCandidates = db.prepare(`
  SELECT id, candidate_json, created_at_ms, status
  FROM candidates
  ORDER BY created_at_ms DESC
  LIMIT 10
`).all();

console.log('Recent candidates:');
recentCandidates.forEach(c => {
  const candidate = JSON.parse(c.candidate_json);
  const mint = candidate.token?.mint?.slice(0, 8) || 'unknown';
  const health = candidate.health?.score || 'N/A';
  const volume = candidate.metrics?.volume24h || 0;
  console.log(`  ${mint}... (status: ${c.status}, health: ${health}, vol: $${volume})`);
  console.log(`    name: ${candidate.token?.name}`);
  console.log(`    grade: ${candidate.health?.grade}`);
});

