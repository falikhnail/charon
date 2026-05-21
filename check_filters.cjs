const Database = require("better-sqlite3");
const db = new Database("charon.sqlite");

console.log("\n=== SEARCHING FOR HEALTH SCORE / FILTER INFORMATION ===\n");

// Get a recent candidate and look for any health-related fields
const candidate = db.prepare(`
  SELECT id, mint, status, candidate_json
  FROM candidates
  ORDER BY created_at_ms DESC
  LIMIT 1
`).get();

if (candidate) {
  try {
    const data = JSON.parse(candidate.candidate_json);
    
    console.log(`Candidate ID: ${candidate.id}`);
    console.log(`Mint: ${candidate.mint}`);
    console.log(`Status: ${candidate.status}`);
    
    // Check filters
    if (data.filters) {
      console.log("\n=== Filters ===");
      console.log(JSON.stringify(data.filters, null, 2));
    }
    
    // Check signals
    if (data.signals) {
      console.log("\n=== Signals ===");
      console.log(JSON.stringify(data.signals, null, 2));
    }
    
    // Check metrics
    if (data.metrics) {
      console.log("\n=== Metrics Sample ===");
      const metricsStr = JSON.stringify(data.metrics, null, 2);
      console.log(metricsStr.substring(0, 500));
    }
    
  } catch (e) {
    console.log("Error:", e.message);
  }
}

db.close();
