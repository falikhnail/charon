const Database = require("better-sqlite3");
const db = new Database("charon.sqlite");

console.log("=== SIGNAL_EVENTS TABLE SCHEMA ===\n");

// Get table schema
const tableInfo = db.prepare("PRAGMA table_info(signal_events)").all();
console.table(tableInfo);

db.close();
