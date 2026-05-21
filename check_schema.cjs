const Database = require("better-sqlite3");
const db = new Database("charon.sqlite");

console.log("\n=== SCHEMA CHECK ===\n");

// Check candidates table schema
const candidatesSchema = db.prepare(`PRAGMA table_info(candidates)`).all();
console.log("Candidates Table Schema:");
console.log(JSON.stringify(candidatesSchema, null, 2));

// Check llm_decisions table schema
console.log("\n\nLLM Decisions Table Schema:");
const decisionsSchema = db.prepare(`PRAGMA table_info(llm_decisions)`).all();
console.log(JSON.stringify(decisionsSchema, null, 2));

// Get the raw candidate record
console.log("\n\n=== RAW CANDIDATE RECORD 167 ===\n");
const rawCandidate = db.prepare(`SELECT * FROM candidates WHERE id = 167`).get();
console.log(JSON.stringify(rawCandidate, null, 2));

db.close();
