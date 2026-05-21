const Database = require("better-sqlite3");
const db = new Database("charon.sqlite");

// Get the most recent LLM decision
const decision = db.prepare(`SELECT * FROM llm_decisions ORDER BY id DESC LIMIT 1`).get();

console.log("LATEST LLM DECISION:");
console.log(`ID: ${decision.id}`);
console.log(`Candidate ID: ${decision.candidate_id}`);
console.log(`Verdict: ${decision.verdict}`);
console.log(`Confidence: ${decision.confidence}%`);
console.log(`Reason: ${decision.reason}`);

// Get the candidate
const candidate = db.prepare(`SELECT * FROM candidates WHERE id = ?`).get(decision.candidate_id);
if (candidate && candidate.candidate_json) {
  const candData = JSON.parse(candidate.candidate_json);
  console.log("\nCANDIDATE NAME: " + (candData.name || candData.full_name || "N/A"));
  console.log("CANDIDATE EMAIL: " + (candData.email || "N/A"));
  console.log("CANDIDATE ROLE: " + (candData.title || candData.position || "N/A"));
}

// Check risks
if (decision.risks_json) {
  try {
    const risks = JSON.parse(decision.risks_json);
    console.log("\nRISKS:");
    if (Array.isArray(risks)) {
      risks.forEach((r, i) => {
        if (i < 5) console.log(`  - ${r}`);
      });
    } else {
      console.log(JSON.stringify(risks).substring(0, 200));
    }
  } catch (e) {}
}

db.close();
