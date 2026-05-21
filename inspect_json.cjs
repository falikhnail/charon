const Database = require("better-sqlite3");
const db = new Database("charon.sqlite");

console.log("\n=== CANDIDATE JSON STRUCTURE INSPECTION ===\n");

// Get a recent candidate and inspect its JSON structure
const candidate = db.prepare(`
  SELECT id, candidate_json
  FROM candidates
  LIMIT 1
`).get();

if (candidate) {
  try {
    const data = JSON.parse(candidate.candidate_json);
    console.log(`Candidate ID: ${candidate.id}`);
    console.log("\nCandidate JSON Keys:");
    console.log(Object.keys(data));
    console.log("\nFull JSON (first 1000 chars):");
    const jsonStr = JSON.stringify(data, null, 2);
    console.log(jsonStr.substring(0, 1000));
  } catch (e) {
    console.log("Error parsing JSON:", e.message);
  }
}

db.close();
