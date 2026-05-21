import Database from 'better-sqlite3';

const db = new Database('charon.sqlite', { readonly: true });

// Check recent positions
const positions = db.prepare(`
  SELECT id, mint, symbol, status, opened_at_ms
  FROM dry_run_positions
  ORDER BY opened_at_ms DESC
  LIMIT 5
`).all();

console.log('\n=== RECENT POSITIONS ===\n');

if (positions.length === 0) {
  console.log('No positions found in database');
} else {
  positions.forEach(p => {
    const dt = new Date(p.opened_at_ms).toLocaleString();
    console.log(`ID ${p.id}: ${p.symbol || p.mint.slice(0,8)} - ${p.status} - opened ${dt}`);
  });
}

// Check trade intents
const intents = db.prepare(`
  SELECT id, mint, mode, status, created_at_ms
  FROM trade_intents
  ORDER BY created_at_ms DESC
  LIMIT 5
`).all();

console.log('\n=== RECENT TRADE INTENTS ===\n');

if (intents.length === 0) {
  console.log('No trade intents found');
} else {
  intents.forEach(i => {
    const dt = new Date(i.created_at_ms).toLocaleString();
    console.log(`ID ${i.id}: ${i.mint.slice(0,8)} - ${i.mode}/${i.status} - created ${dt}`);
  });
}

// Check LLM decisions
const decisions = db.prepare(`
  SELECT id, mint, verdict, confidence, created_at_ms
  FROM llm_decisions
  ORDER BY created_at_ms DESC
  LIMIT 5
`).all();

console.log('\n=== RECENT LLM DECISIONS ===\n');

if (decisions.length === 0) {
  console.log('No LLM decisions found');
} else {
  decisions.forEach(d => {
    const dt = new Date(d.created_at_ms).toLocaleString();
    console.log(`ID ${d.id}: ${d.mint.slice(0,8)} - ${d.verdict} (${d.confidence}%) - ${dt}`);
  });
}

// Check agent enabled setting
const agentEnabled = db.prepare(`
  SELECT value FROM settings WHERE key = 'agent_enabled'
`).get();

console.log('\n=== SETTINGS CHECK ===\n');
console.log(`agent_enabled: ${agentEnabled?.value || 'NOT SET (default: true)'}`);

db.close();
console.log('\n');
