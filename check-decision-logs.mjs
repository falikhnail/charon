import Database from 'better-sqlite3';

const db = new Database('charon.sqlite', { readonly: true });

const logs = db.prepare(`
  SELECT 
    id, 
    action, 
    verdict, 
    confidence,
    guardrails_json,
    at_ms
  FROM decision_logs
  WHERE at_ms > (SELECT MAX(opened_at_ms) FROM dry_run_positions)
  ORDER BY id DESC
  LIMIT 10
`).all();

console.log('\n=== DECISION LOGS (After Last Position) ===\n');

logs.forEach(log => {
  const dt = new Date(log.at_ms).toLocaleString();
  let guardrails = {};
  try {
    guardrails = JSON.parse(log.guardrails_json);
  } catch (e) {
    // ignore
  }
  
  console.log(`\n[${log.action}] ${log.verdict} (${log.confidence}%) at ${dt}`);
  console.log(`  Agent Enabled: ${guardrails.agentEnabled}`);
  console.log(`  Confidence Threshold: ${guardrails.confidenceThreshold}`);
  console.log(`  Open Positions: ${guardrails.openPositions}/${guardrails.maxOpenPositions}`);
});

db.close();
