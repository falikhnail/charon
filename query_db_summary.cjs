const Database = require('better-sqlite3');
const db = new Database('charon.sqlite');

console.log('\n=== TABLE SUMMARY ===\n');

// Check llm_decisions count and samples
const decisionCount = db.prepare(`SELECT COUNT(*) as count FROM llm_decisions`).get();
console.log(`Total LLM Decisions: ${decisionCount.count}`);

if (decisionCount.count > 0) {
  console.log('\nMost Recent LLM Decisions:');
  const recentDecisions = db.prepare(`
    SELECT id, candidate_id, verdict, confidence, created_at_ms
    FROM llm_decisions
    ORDER BY created_at_ms DESC
    LIMIT 5
  `).all();
  console.table(recentDecisions);
}

// Check dry_run_positions count and samples
console.log('\n---');
const positionCount = db.prepare(`SELECT COUNT(*) as count FROM dry_run_positions`).get();
console.log(`Total Dry Run Positions: ${positionCount.count}`);

const positionByStatus = db.prepare(`
  SELECT status, COUNT(*) as count
  FROM dry_run_positions
  GROUP BY status
`).all();
console.log('\nPositions by Status:');
console.table(positionByStatus);

if (positionCount.count > 0) {
  console.log('\nSample Positions:');
  const samplePositions = db.prepare(`
    SELECT id, mint, status
    FROM dry_run_positions
    LIMIT 5
  `).all();
  console.table(samplePositions);
}

db.close();
