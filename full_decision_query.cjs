const Database = require("better-sqlite3");
const db = new Database("charon.sqlite");

console.log("\n=== MOST RECENT LLM DECISION ===\n");

// Get the most recent LLM decision
const decision = db.prepare(`
  SELECT * FROM llm_decisions
  ORDER BY id DESC
  LIMIT 1
`).get();

if (!decision) {
  console.log("No decisions found");
  db.close();
  process.exit(0);
}

console.log("Decision Summary:");
console.log(`  ID: ${decision.id}`);
console.log(`  Candidate ID: ${decision.candidate_id}`);
console.log(`  Verdict: ${decision.verdict}`);
console.log(`  Confidence: ${decision.confidence}%`);
console.log(`  Reason: ${decision.reason}`);

// Get the candidate
const candidate = db.prepare(`SELECT * FROM candidates WHERE id = ?`).get(decision.candidate_id);

if (candidate) {
  console.log("\n=== CANDIDATE DATA (ID ${candidate.id}) ===\n");
  console.log(`  Mint: ${candidate.mint}`);
  console.log(`  Status: ${candidate.status}`);
  
  if (candidate.candidate_json) {
    try {
      const candData = JSON.parse(candidate.candidate_json);
      console.log("\n  Full Candidate JSON:");
      const json_str = JSON.stringify(candData, null, 2);
      json_str.split('\n').forEach(line => console.log(`    ${line}`));
    } catch (e) {
      console.log(`  Candidate JSON: ${candidate.candidate_json}`);
    }
  }
}

console.log("\n=== DECISION ANALYSIS ===");
console.log(`Verdict: ${decision.verdict}`);
console.log(`Confidence Level: ${decision.confidence}% (very low - high uncertainty)`);
console.log(`Reasoning: ${decision.reason}`);

if (decision.risks_json) {
  try {
    const risks = JSON.parse(decision.risks_json);
    console.log("\nRisks Identified:");
    console.log(JSON.stringify(risks, null, 2));
  } catch (e) {
    console.log(`\nRisks: ${decision.risks_json}`);
  }
}

db.close();
