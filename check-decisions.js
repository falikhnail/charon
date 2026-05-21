import { db } from './src/db/connection.js';

const recentDecisions = db.prepare(`
  SELECT id, verdict, confidence, reason, risks_json, raw_json, created_at_ms
  FROM llm_decisions
  ORDER BY created_at_ms DESC
  LIMIT 3
`).all();

console.log('Recent LLM decisions:\n');
recentDecisions.forEach((d, i) => {
  console.log(`Decision ${i + 1}:`);
  console.log(`  Verdict: ${d.verdict} (${d.confidence}%)`);
  console.log(`  Reason: ${d.reason}`);
  console.log(`  Risks: ${d.risks_json}`);
  if (d.raw_json) {
    try {
      const raw = JSON.parse(d.raw_json);
      console.log(`  Raw reason from LLM: ${raw.reason}`);
    } catch (e) {
      console.log(`  Raw: ${d.raw_json}`);
    }
  }
  console.log('');
});
