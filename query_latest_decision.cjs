const Database = require("better-sqlite3");
const db = new Database("charon.sqlite");

console.log("\n=== MOST RECENT LLM DECISION ===\n");

// Get the most recent LLM decision
const recentDecision = db.prepare(`
  SELECT * FROM llm_decisions
  ORDER BY id DESC
  LIMIT 1
`).get();

if (!recentDecision) {
  console.log("No LLM decisions found in database");
  db.close();
  process.exit(0);
}

console.log("Latest LLM Decision:");
console.log(`ID: ${recentDecision.id}`);
console.log(`Candidate ID: ${recentDecision.candidate_id}`);
console.log(`Verdict: ${recentDecision.verdict}`);
console.log(`Confidence: ${recentDecision.confidence}`);
console.log(`Reason: ${recentDecision.reason}`);
console.log(`Model Used: ${recentDecision.model_used || "N/A"}`);
console.log(`Created At: ${recentDecision.created_at}`);

// Get the candidate data
console.log("\n=== CANDIDATE DATA ===\n");
const candidate = db.prepare(`
  SELECT * FROM candidates
  WHERE id = ?
`).get(recentDecision.candidate_id);

if (candidate) {
  console.log(`Candidate ID: ${candidate.id}`);
  console.log(`Name: ${candidate.name}`);
  console.log(`Email: ${candidate.email}`);
  console.log(`Phone: ${candidate.phone}`);
  console.log(`Status: ${candidate.status}`);
  console.log(`Applied At: ${candidate.applied_at}`);
  
  if (candidate.data) {
    try {
      const candidateData = JSON.parse(candidate.data);
      console.log("\nCandidate Full Data:");
      console.log(JSON.stringify(candidateData, null, 2));
    } catch (e) {
      console.log(`\nCandidate Data (raw): ${candidate.data}`);
    }
  }
} else {
  console.log(`Candidate ${recentDecision.candidate_id} not found`);
}

console.log("\n=== DECISION SUMMARY ===");
console.log(`✓ Verdict: ${recentDecision.verdict}`);
console.log(`✓ Confidence: ${recentDecision.confidence}%`);
console.log(`✓ Reason (Fallback Explanation):`);
console.log(`  "${recentDecision.reason}"`);

db.close();
