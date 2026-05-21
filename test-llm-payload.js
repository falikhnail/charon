import { db } from './src/db/connection.js';
import { compactCandidateForLlm } from './src/pipeline/llm.js';
import { buildCandidateContext } from './src/pipeline/llmContext.js';

// Get NEWEST WATCH candidate
const row = db.prepare(`
  SELECT id, candidate_json FROM candidates WHERE status = 'watch' ORDER BY id DESC LIMIT 1
`).get();

if (!row) {
  console.log('No WATCH candidates found');
  process.exit(0);
}

const candidate = JSON.parse(row.candidate_json);
const compacted = compactCandidateForLlm({ id: row.id, candidate });
const context = buildCandidateContext(candidate);

console.log('=== WHAT LLM RECEIVES ===\n');
console.log('Candidate ID:', compacted.candidate_id);
console.log('Token:', compacted.token);
console.log('Metrics:', compacted.metrics);
console.log('Signals:', compacted.signals);
console.log('\nEntry Timing:', JSON.stringify(compacted.entryTiming, null, 2));
console.log('\nChart:', JSON.stringify(compacted.chart, null, 2));
console.log('\nHealth Context for LLM:');
console.log(JSON.stringify(context, null, 2));
