import { db } from './src/db/connection.js';

// Get all tables
const tables = db.prepare(`
  SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
`).all();

console.log('=== DATABASE TABLES ===\n');
tables.forEach(t => {
  console.log(`- ${t.name}`);
});

console.log('\n=== DECISIONS ===');
const decisions = db.prepare(`SELECT COUNT(*) as cnt FROM decisions`).get();
console.log(`Total decisions: ${decisions.cnt}`);

const buyDecisions = db.prepare(`SELECT COUNT(*) as cnt FROM decisions WHERE verdict = 'BUY'`).get();
console.log(`BUY verdicts: ${buyDecisions.cnt}`);

console.log('\n=== RECENT BUY DECISIONS ===');
const recentBuy = db.prepare(`
  SELECT candidate_id, verdict, confidence, reason FROM decisions WHERE verdict = 'BUY' ORDER BY id DESC LIMIT 3
`).all();

recentBuy.forEach(d => {
  console.log(`Candidate ${d.candidate_id}: ${d.verdict} (${d.confidence}%)`);
  console.log(`  Reason: ${d.reason}`);
});
