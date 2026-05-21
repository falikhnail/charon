const Database = require("better-sqlite3");
const db = new Database("charon.sqlite");

console.log("\n=== RECENT CANDIDATES WITH HEALTH SCORES (Last 10 minutes) ===\n");

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
    let healthGrade = null;
    let recommendation = null;
    let warnings = [];
    
    try {
      const candidateData = JSON.parse(row.candidate_json);
      if (candidateData.filters && candidateData.filters.health) {
        healthScore = candidateData.filters.health.score;
        healthGrade = candidateData.filters.health.grade;
        recommendation = candidateData.filters.health.recommendation;
        warnings = candidateData.filters.health.warnings || [];
      }
    } catch (e) {
      // If not valid JSON, skip
    }
    
    return {
      id: row.id,
      mint: row.mint.substring(0, 15) + '...',
      status: row.status,
      healthScore: healthScore,
      grade: healthGrade,
      recommendation: recommendation,
      warnings: warnings.join(" | ")
    };
  });
  
  console.table(results);
  
  // Filter by health score
  const sortedByHealth = [...results].sort((a, b) => (b.healthScore || 0) - (a.healthScore || 0));
  
  console.log("\n=== SORTED BY HEALTH SCORE (HIGHEST FIRST) ===\n");
  console.table(sortedByHealth);
  
  // Statistics
  const withScore = results.filter(r => r.healthScore !== null);
  if (withScore.length > 0) {
    const scores = withScore.map(r => r.healthScore);
    const avg = scores.reduce((a, b) => a + b) / scores.length;
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    
    console.log("\n=== HEALTH SCORE STATISTICS ===");
    console.log(`Total with scores: ${withScore.length}`);
    console.log(`Average score: ${avg.toFixed(2)}`);
    console.log(`Max score: ${max}`);
    console.log(`Min score: ${min}`);
  }
} else {
  console.log("No candidates found in the last 10 minutes");
}

db.close();
