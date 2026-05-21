import { db } from './src/db/connection.js';

const recentVerdicts = db.prepare(`
  SELECT verdict, COUNT(*) as c 
  FROM llm_decisions 
  WHERE created_at_ms > ?
  GROUP BY verdict
`, Date.now() - 120000).all(Date.now() - 120000);

console.log('Decisions in last 120s:');
recentVerdicts.forEach(row => {
  console.log(`  ${row.verdict}: ${row.c}`);
});

const allBuy = db.prepare('SELECT COUNT(*) as c FROM llm_decisions WHERE verdict = ?').get('BUY');
console.log('\nTotal BUY verdicts ever:', allBuy.c);
