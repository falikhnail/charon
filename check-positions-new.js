import { db } from './src/db/connection.js';

// Get latest positions
const positions = db.prepare(`
  SELECT id, mint, status, created_at_ms, pnl_percent, size_sol
  FROM positions
  ORDER BY created_at_ms DESC
  LIMIT 5
`).all();

console.log('=== LATEST POSITIONS ===\n');

if (positions.length === 0) {
  console.log('❌ No positions in database');
} else {
  positions.forEach(p => {
    const createdTime = new Date(p.created_at_ms);
    const isNew = Date.now() - p.created_at_ms < 60000;
    const newIndicator = isNew ? ' ✨ NEW' : '';
    console.log(`${newIndicator}ID: ${p.id} | Status: ${p.status} | Created: ${createdTime.toLocaleTimeString()}`);
    console.log(`  Mint: ${p.mint}`);
    console.log(`  Size: ${p.size_sol} SOL | PnL: ${p.pnl_percent ?? 'N/A'}%`);
  });
}

// Get decision history
console.log('\n=== RECENT DECISIONS ===\n');
const decisions = db.prepare(`
  SELECT candidate_id, verdict, confidence, reason FROM decisions ORDER BY id DESC LIMIT 5
`).all();

decisions.forEach(d => {
  console.log(`${d.verdict} (${d.confidence}%) - Candidate ${d.candidate_id}`);
  console.log(`  ${d.reason.substring(0, 80)}`);
});

// Count summary
console.log('\n=== SUMMARY ===');
const posCount = db.prepare(`SELECT COUNT(*) as cnt FROM positions WHERE status = 'open'`).get();
const totalDecisions = db.prepare(`SELECT COUNT(*) as cnt FROM decisions WHERE verdict = 'BUY'`).get();
console.log(`Open positions: ${posCount.cnt}`);
console.log(`Total BUY verdicts: ${totalDecisions.cnt}`);
