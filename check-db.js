import { db } from './src/db/connection.js';

const candidates = db.prepare('SELECT COUNT(*) as c FROM candidates').get().c;
const decisions = db.prepare('SELECT COUNT(*) as c FROM llm_decisions').get().c;
const recentDecisions = db.prepare(`
  SELECT verdict, confidence, created_at_ms 
  FROM llm_decisions 
  ORDER BY created_at_ms DESC 
  LIMIT 5
`).all();

console.log('Candidates:', candidates);
console.log('Decisions:', decisions);
console.log('Recent decisions:');
recentDecisions.forEach(d => {
  console.log(`  ${d.verdict} (${d.confidence}%) at ${new Date(d.created_at_ms).toISOString()}`);
});
