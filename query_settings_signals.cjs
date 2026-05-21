const Database = require("better-sqlite3");
const db = new Database("charon.sqlite");

console.log("\n=== SETTINGS TABLE QUERY ===\n");

// Query 1: Settings related to filters and health
const settingsResults = db.prepare(`
  SELECT key, value FROM settings 
  WHERE key LIKE 'min%' OR key LIKE 'health%' OR key LIKE 'max%'
  ORDER BY key
`).all();

console.log("Candidate Filter Settings:");
console.table(settingsResults);

console.log("\n=== SIGNAL EVENTS SUMMARY ===\n");

// Query 2: Count recent signals from last 10 minutes
const tenMinutesAgoMs = Date.now() - (10 * 60 * 1000);

const recentSignalCount = db.prepare(`
  SELECT COUNT(*) as count FROM signal_events
  WHERE created_at_ms > ?
`).get(tenMinutesAgoMs);

console.log(`Total signals in last 10 minutes: ${recentSignalCount.count}`);

// Count by kind
const signalsByKind = db.prepare(`
  SELECT kind, COUNT(*) as count FROM signal_events
  WHERE created_at_ms > ?
  GROUP BY kind
  ORDER BY count DESC
`).all(tenMinutesAgoMs);

console.log("\nSignals by Kind (Last 10 minutes):");
console.table(signalsByKind);

// Overall signal stats
console.log("\n=== OVERALL SIGNAL STATS ===\n");
const totalSignals = db.prepare(`
  SELECT COUNT(*) as count FROM signal_events
`).get();

const allSignalsByKind = db.prepare(`
  SELECT kind, COUNT(*) as count FROM signal_events
  GROUP BY kind
  ORDER BY count DESC
`).all();

console.log(`Total signals (all time): ${totalSignals.count}`);
console.log("\nAll Signals by Kind:");
console.table(allSignalsByKind);

db.close();
