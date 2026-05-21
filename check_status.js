import Database from 'better-sqlite3';

const db = new Database('./charon.sqlite');

// List all tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();

console.log('📦 DATABASE TABLES:\n');
tables.forEach(t => {
  try {
    const count = db.prepare('SELECT COUNT(*) as cnt FROM ' + t.name).get();
    console.log('  • ' + t.name + ' (' + count.cnt + ' rows)');
  } catch (e) {
    console.log('  • ' + t.name + ' (error)');
  }
});

// Check recent candidates and their filters
console.log('\n🎯 RECENT CANDIDATES (WHY FILTERED?):\n');
const candidates = db.prepare('SELECT id, mint, status, filter_result_json FROM candidates ORDER BY created_at_ms DESC LIMIT 3').all();
candidates.forEach(c => {
  console.log('  Mint: ' + c.mint.slice(0, 8) + '...');
  console.log('  Status: ' + c.status);
  
  try {
    const filterResult = JSON.parse(c.filter_result_json || '{}');
    console.log('  Filter reasons: ' + JSON.stringify(filterResult).slice(0, 100) + '...');
  } catch (e) {
    console.log('  Filter: (no data)');
  }
  console.log();
});

// Check LLM decisions
console.log('📊 RECENT LLM DECISIONS:\n');
const decisions = db.prepare('SELECT * FROM llm_decisions ORDER BY created_at_ms DESC LIMIT 5').all();
console.log('Total decisions: ' + decisions.length);
decisions.slice(0, 3).forEach(d => {
  const age = Math.round((Date.now() - d.created_at_ms) / 1000);
  console.log('  • ' + d.decision + ' (' + age + 's ago) - confidence: ' + d.confidence);
});

// Check dry run positions
const positions = db.prepare('SELECT COUNT(*) as cnt FROM dry_run_positions WHERE status = ?').get('open');
console.log('\n💰 Open positions (dry run): ' + positions.cnt);

db.close();
