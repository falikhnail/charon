import { db } from './src/db/connection.js';

const buyCount = db.prepare("SELECT COUNT(*) as cnt FROM llm_decisions WHERE verdict = 'BUY'").get();
console.log('Total BUY verdicts:', buyCount.cnt);

const posCount = db.prepare("SELECT COUNT(*) as cnt FROM dry_run_positions WHERE status = 'open'").get();
console.log('Open positions:', posCount.cnt);

const recent = db.prepare("SELECT id, verdict, confidence FROM llm_decisions WHERE verdict = 'BUY' ORDER BY id DESC LIMIT 3").all();
console.log('\nRecent BUY decisions:');
recent.forEach(r => console.log(`  Candidate ${r.id}: ${r.verdict} (${r.confidence}%)`));
