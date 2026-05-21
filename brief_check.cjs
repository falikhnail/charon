const Database = require("better-sqlite3");
const db = new Database("charon.sqlite");

// Get candidates table schema
const candidatesSchema = db.prepare(`PRAGMA table_info(candidates)`).all();
console.log("CANDIDATES TABLE COLUMNS:");
candidatesSchema.forEach((col, i) => {
  if (i < 15) console.log(`  ${col.name}`);
});

// Get llm_decisions table schema
const decisionsSchema = db.prepare(`PRAGMA table_info(llm_decisions)`).all();
console.log("\nLLM_DECISIONS TABLE COLUMNS:");
decisionsSchema.forEach(col => console.log(`  ${col.name}`));

// Get latest decision full record
const decision = db.prepare(`SELECT * FROM llm_decisions ORDER BY id DESC LIMIT 1`).get();
console.log(`\nLATEST DECISION (ID ${decision.id}):`);
console.log(`  Candidate ID: ${decision.candidate_id}`);
console.log(`  Verdict: ${decision.verdict}`);
console.log(`  Confidence: ${decision.confidence}`);
console.log(`  Reason: ${decision.reason}`);

db.close();
