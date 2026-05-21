import Database from 'better-sqlite3';

const db = new Database('charon.sqlite', { readonly: true });

const logs = db.prepare(`
  SELECT 
    id,
    selected_mint,
    action,
    verdict,
    confidence,
    guardrails_json,
    at_ms
  FROM decision_logs
  WHERE action = 'entry_rejected_fresh_filters'
    AND at_ms > datetime((SELECT MAX(opened_at_ms) FROM dry_run_positions), 'unixepoch', 'milliseconds')
  ORDER BY at_ms DESC
  LIMIT 5
`).all();

console.log('\n=== FRESH FILTER REJECTIONS ===\n');

if (logs.length === 0) {
  console.log('No fresh filter rejections found - checking all recent rejections...\n');
  
  const allLogs = db.prepare(`
    SELECT 
      id,
      selected_mint,
      action,
      verdict,
      confidence,
      guardrails_json,
      at_ms
    FROM decision_logs
    WHERE action = 'entry_rejected_fresh_filters'
    ORDER BY at_ms DESC
    LIMIT 5
  `).all();
  
  allLogs.forEach(log => {
    const dt = new Date(log.at_ms).toLocaleString();
    let guardrails = {};
    try {
      guardrails = JSON.parse(log.guardrails_json);
    } catch (e) {
      console.log(`Parse error: ${e.message}`);
    }
    
    console.log(`Mint: ${log.selected_mint.slice(0, 8)}`);
    console.log(`Verdict: ${log.verdict} (${log.confidence}%)`);
    console.log(`Time: ${dt}`);
    console.log(`Failed Filters: ${JSON.stringify(guardrails.failures)}`);
    console.log('---');
  });
} else {
  logs.forEach(log => {
    const dt = new Date(log.at_ms).toLocaleString();
    let guardrails = {};
    try {
      guardrails = JSON.parse(log.guardrails_json);
    } catch (e) {
      // ignore
    }
    
    console.log(`Mint: ${log.selected_mint.slice(0, 8)}`);
    console.log(`Verdict: ${log.verdict} (${log.confidence}%)`);
    console.log(`Time: ${dt}`);
    console.log(`Failed Filters: ${guardrails.failures}`);
    console.log('---');
  });
}

db.close();
