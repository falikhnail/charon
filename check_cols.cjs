const Database = require("better-sqlite3");
const db = new Database("charon.sqlite");

// Get candidates table schema
const candidatesSchema = db.prepare(`PRAGMA table_info(candidates)`).all();
console.log("Candidates Table Columns:");
candidatesSchema.forEach(col => {
  console.log(`  ${col.name} (${col.type})`);
});

// Get the raw candidate record
console.log("\nCandidate ID 167 Record:");
const rawCandidate = db.prepare(`SELECT * FROM candidates WHERE id = 167`).get();
if (rawCandidate) {
  Object.keys(rawCandidate).forEach(key => {
    console.log(`  ${key}: ${typeof rawCandidate[key] === "object" ? JSON.stringify(rawCandidate[key]) : rawCandidate[key]}`);
  });
} else {
  console.log("  Candidate not found");
}

db.close();
