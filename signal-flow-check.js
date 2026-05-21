import Database from 'better-sqlite3';

const db = new Database('./charon.sqlite');

console.log('🔄 SIGNAL FLOW CHECK\n');

// Check signal events
const signals = db.prepare('SELECT COUNT(*) as count FROM signal_events').get();
const recentSignals = db.prepare('SELECT COUNT(*) as count FROM signal_events WHERE created_at_ms > ?').get(Date.now() - 60*1000);

console.log('1. SIGNAL EVENTS:');
console.log('   Total events:', signals.count);
console.log('   Last 1 minute:', recentSignals.count);

// Check if bot is alive
const recentCandidates = db.prepare('SELECT COUNT(*) as count FROM candidates WHERE created_at_ms > ?').get(Date.now() - 5*60*1000);
console.log('\n2. RECENT CANDIDATE PROCESSING:');
console.log('   Last 5 minutes:', recentCandidates.count);

// Check price alerts
const priceAlerts = db.prepare('SELECT COUNT(*) as count FROM price_alerts').get();
console.log('\n3. PRICE ALERTS:');
console.log('   Total price alerts:', priceAlerts.count);

// Check telegam messages
const decisions = db.prepare('SELECT COUNT(*) as count FROM llm_decisions').get();
const recentDecisions = db.prepare('SELECT COUNT(*) as count FROM llm_decisions WHERE created_at_ms > ?').get(Date.now() - 60*1000);

console.log('\n4. LLM DECISIONS:');
console.log('   Total decisions:', decisions.count);
console.log('   Last 1 minute:', recentDecisions.count);

// Recommendations
console.log('\n5. DIAGNOSIS:');
if (recentCandidates.count === 0) {
  console.log('   ⚠️  No candidates processed in last 5 minutes');
  console.log('   → Bot might not be receiving signals from server');
  console.log('   → Or signal processing is extremely slow');
} else {
  console.log('   ✅ Bot is actively processing candidates');
}

if (recentDecisions.count === 0) {
  console.log('   → No LLM decisions in last 1 minute');
} else {
  console.log('   → LLM is making decisions');
}

console.log('\n6. ACTION REQUIRED:');
console.log('   [ ] Check signal server connection');
console.log('   [ ] Verify SIGNAL_SERVER_URL in .env');
console.log('   [ ] Check network connectivity to signal server');
console.log('   [ ] Wait 5 minutes and recheck');

db.close();
