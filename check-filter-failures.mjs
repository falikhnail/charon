import Database from 'better-sqlite3';

const db = new Database('charon.sqlite', { readonly: true });

const logs = db.prepare(`
  SELECT 
    id,
    selected_mint,
    action,
    verdict,
    confidence,
    execution_json,
    at_ms
  FROM decision_logs
  WHERE action = 'entry_rejected_fresh_filters'
    AND at_ms > (SELECT MAX(opened_at_ms) FROM dry_run_positions)
  ORDER BY at_ms DESC
  LIMIT 3
`).all();

console.log('\n=== FRESH FILTER REJECTIONS ===\n');

logs.forEach(log => {
  const dt = new Date(log.at_ms).toLocaleString();
  let execution = {};
  try {
    execution = JSON.parse(log.execution_json);
  } catch (e) {
    // ignore
  }
  
  console.log(`Mint: ${log.selected_mint.slice(0, 8)}`);
  console.log(`Verdict: ${log.verdict} (${log.confidence}%)`);
  console.log(`Time: ${dt}`);
  console.log(`Failures: ${JSON.stringify(execution.failures, null, 2)}`);
  console.log('---\n');
});

db.close();
