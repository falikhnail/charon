import axios from 'axios';
import { LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, LLM_TIMEOUT_MS } from './src/config.js';
import { buildCandidateContext, buildLLMSystemPrompt } from './src/pipeline/llmContext.js';
import { compactCandidateForLlm, activeLessonsForPrompt } from './src/pipeline/llm.js';
import { db } from './src/db/connection.js';

// Get 3 newest WATCH candidates
const watchRows = db.prepare(`
  SELECT id, candidate_json FROM candidates 
  WHERE status = 'watch' 
  ORDER BY id DESC 
  LIMIT 3
`).all();

if (watchRows.length === 0) {
  console.log('No WATCH candidates to test');
  process.exit(0);
}

// Build payload like LLM would
const enrichedCandidates = watchRows.map(row => {
  const candidate = JSON.parse(row.candidate_json);
  const context = buildCandidateContext(candidate);
  return {
    ...compactCandidateForLlm({ id: row.id, candidate }),
    health_context: context,
  };
});

const firstContext = enrichedCandidates[0]?.health_context || {};
const system = buildLLMSystemPrompt(firstContext);

const user = {
  task: 'Pick the best dry-run buy candidate from this recent batch, or choose none.',
  recent_lessons: activeLessonsForPrompt(),
  output_schema: {
    verdict: 'BUY|WATCH|PASS',
    selected_candidate_id: 'integer or null',
    selected_mint: 'mint or null',
    confidence: '0-100',
    reason: 'string',
    risks: 'array of strings',
    suggested_tp_percent: 'number',
    suggested_sl_percent: 'number',
    size_multiplier: 'decimal 0.0-1.0',
  },
  candidates: enrichedCandidates,
};

const payload = {
  model: LLM_MODEL,
  temperature: 0.2,
  messages: [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify(user) },
  ],
};

console.log('=== SENDING TO LLM ===\n');
console.log('Model:', LLM_MODEL);
console.log('Candidates:', enrichedCandidates.length);
console.log('First candidate:');
console.log('  Grade:', enrichedCandidates[0].health_context.grade);
console.log('  Size Multiplier:', enrichedCandidates[0].health_context.sizingGuidance.sizeMultiplier);
console.log('  Entry Strategy:', enrichedCandidates[0].entryTiming?.strategy);
console.log('  Liquidity:', enrichedCandidates[0].metrics.liquidityUsd);

console.log('\n=== CALLING LLM ===\n');

try {
  const res = await axios.post(`${LLM_BASE_URL.replace(/\/$/, '')}/chat/completions`, payload, {
    timeout: LLM_TIMEOUT_MS,
    headers: { 
      authorization: `Bearer ${LLM_API_KEY}`, 
      'content-type': 'application/json' 
    },
  });

  console.log('Status:', res.status);
  console.log('\nLLM Response:');
  const content = res.data?.choices?.[0]?.message?.content || '';
  console.log(content);
  
  // Try to parse JSON
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('\n=== PARSED ===');
      console.log('Verdict:', parsed.verdict);
      console.log('Confidence:', parsed.confidence);
      console.log('Selected ID:', parsed.selected_candidate_id);
      console.log('Reason:', parsed.reason);
      console.log('Size Multiplier:', parsed.size_multiplier);
    }
  } catch (e) {
    console.log('Could not parse JSON from response');
  }
} catch (err) {
  console.error('Error:', err.response?.status, err.response?.data?.error?.message || err.message);
}
