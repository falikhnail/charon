import { db } from './src/db/connection.js';

const buy = db.prepare(`
  SELECT id, candidate_id, mint, confidence, created_at_ms, reason 
  FROM llm_decisions 
  WHERE verdict = 'BUY' 
  ORDER BY created_at_ms DESC
`).all();

console.log('BUY verdicts:');
buy.forEach(b => {
  console.log(`ID: ${b.id}, mint: ${b.mint.slice(0, 8)}..., conf: ${b.confidence}%`);
  console.log(`  time: ${new Date(b.created_at_ms).toISOString()}`);
  console.log(`  reason: ${b.reason}`);
  console.log('');
});
