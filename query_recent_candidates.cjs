const Database = require("better-sqlite3");
const db = new Database("charon.sqlite");

console.log("\n=== RECENT CANDIDATES (Last 10 minutes) ===\n");

// Query candidates from last 10 minutes
const tenMinutesAgoMs = Date.now() - (10 * 60 * 1000);

const recentCandidates = db.prepare(`
  SELECT id, mint, status, created_at_ms, candidate_json
  FROM candidates
  WHERE created_at_ms > ?
  ORDER BY created_at_ms DESC
  LIMIT 5
`).all(tenMinutesAgoMs);

console.log(`Found ${recentCandidates.length} candidates in last 10 minutes\n`);

if (recentCandidates.length > 0) {
  const results = recentCandidates.map(row => {
    let healthScore = null;
    let candidateData = null;
    
    try {
      candidateData = JSON.parse(row.candidate_json);
      healthScore = candidateData.healthScore || candidateData.health_score || null;
    } catch (e) {
      // If not valid JSON, try as is
    }
    
    return {
      id: row.id,
      mint: row.mint,
      status: row.status,
      created_at_ms: new Date(row.created_at_ms).toISOString(),
      healthScore: healthScore
    };
  });
  
  console.table(results);
  
  // Show filtered by health score if available
  const withHealthScore = results.filter(r => r.healthScore !== null);
  if (withHealthScore.length > 0) {
    console.log("\n=== CANDIDATES WITH HEALTH SCORES ===\n");
    console.table(withHealthScore);
  }
} else {
  console.log("No candidates found in the last 10 minutes");
}

db.close();
