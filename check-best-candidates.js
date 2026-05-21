import { db } from './src/db/connection.js';

const bestCandidates = db.prepare(`
  SELECT id, candidate_json, created_at_ms, status
  FROM candidates
  ORDER BY candidate_json DESC
  LIMIT 15
`).all();

console.log('Top candidates by health:');
bestCandidates.forEach(c => {
  const candidate = JSON.parse(c.candidate_json);
  const mint = candidate.token?.mint?.slice(0, 8) || 'unknown';
  const health = candidate.health?.score || 'N/A';
  const grade = candidate.health?.grade || '?';
  const volume = candidate.metrics?.volume24h || 0;
  console.log(`  ${mint}... Grade ${grade} (score: ${health}, vol: $${volume}, status: ${c.status})`);
});

// Count by grade
console.log('\nGrade distribution:');
const gradeCount = db.prepare(`
  SELECT
    JSON_EXTRACT(candidate_json, '$.health.grade') as grade,
    COUNT(*) as count
  FROM candidates
  GROUP BY grade
  ORDER BY grade DESC
`).all();

gradeCount.forEach(g => {
  console.log(`  Grade ${g.grade || '?'}: ${g.count} tokens`);
});
