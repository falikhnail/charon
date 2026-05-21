const Database = require('better-sqlite3');
const db = new Database('charon.sqlite');

console.log('\n=== RECENT LLM DECISIONS (Last 5 minutes) ===\n');
const decisions = db.prepare(`
  SELECT id, candidate_id, verdict, confidence, reason 
  FROM llm_decisions 
  WHERE created_at_ms > datetime('now', '-5 minutes') 
  ORDER BY created_at_ms DESC 
  LIMIT 10
`).all();

if (decisions.length === 0) {
  console.log('No recent LLM decisions found.');
} else {
  console.table(decisions);
}

console.log('\n=== OPEN POSITIONS ===\n');
const positions = db.prepare(`
  SELECT id, mint, status 
  FROM dry_run_positions 
  WHERE status = 'open' 
  LIMIT 5
`).all();

if (positions.length === 0) {
  console.log('No open positions found.');
} else {
  console.table(positions);
}

db.close();
