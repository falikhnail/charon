import { db } from './src/db/connection.js';
import { buildCandidateContext, buildLLMSystemPrompt } from './src/pipeline/llmContext.js';
import { compactCandidateForLlm } from './src/pipeline/llm.js';

// Get 3 newest WATCH candidates
const watchCandidates = db.prepare(`
  SELECT 
    id, 
    mint, 
    candidate_json
  FROM candidates 
  WHERE status = 'watch' 
  ORDER BY id DESC 
  LIMIT 3
`).all();

console.log(`\n=== ANALYZING ${watchCandidates.length} WATCH CANDIDATES ===\n`);

watchCandidates.forEach((row, idx) => {
  const candidate = JSON.parse(row.candidate_json);
  
  console.log(`\n📍 CANDIDATE #${idx + 1} (ID: ${row.id}, Mint: ${row.mint})`);
  console.log(`   Status: WATCH (should it be BUY?)`);
  
  // Show health summary
  if (candidate.health) {
    console.log(`   Health: Grade ${candidate.health.grade} (${candidate.health.score}/100)`);
  }
  
  // Show what gets sent to LLM
  const compacted = compactCandidateForLlm({ id: row.id, candidate });
  const context = buildCandidateContext(candidate);
  
  console.log(`   Entry Timing:`, compacted.entryTiming?.timing?.strategy || 'UNKNOWN');
  console.log(`   Metrics:`, {
    liquidity: compacted.metrics.liquidityUsd,
    volume24h: candidate.metrics.trendingVolumeUsd || 'N/A'
  });
  
  console.log(`   Chart Context:`, {
    pricePosition: compacted.chart.distanceFromAthPercent?.toFixed(1) + '%' || 'N/A',
    athHigh: compacted.chart.athContext24h?.high?.toExponential(2) || 'N/A',
    current: compacted.chart.athContext24h?.current?.toExponential(2) || 'N/A',
  });
  
  console.log(`   LLM Sizing Guidance:`, context.sizingGuidance);
  console.log(`   Risk Summary:`, context.riskContext?.split('\n')[0] || 'N/A');
});

// Show prompt example
console.log('\n\n=== LLM SYSTEM PROMPT EXCERPT ===');
const exampleContext = buildCandidateContext({
  health: { score: 42, grade: 'D' },
  risks: {}
});
const systemPrompt = buildLLMSystemPrompt(exampleContext);
const lines = systemPrompt.split('\n');
console.log(lines.slice(20, 40).join('\n'));

// Check decision history
console.log('\n\n=== RECENT LLM DECISIONS ===');
const decisions = db.prepare(`
  SELECT 
    candidate_id, 
    verdict, 
    confidence, 
    reason 
  FROM decisions 
  WHERE verdict != 'WATCH'
  ORDER BY id DESC 
  LIMIT 5
`).all();

if (decisions.length === 0) {
  console.log('❌ NO BUY/PASS DECISIONS RECORDED - only WATCH?');
} else {
  decisions.forEach(d => {
    console.log(`  ${d.verdict} (${d.confidence}%) - Candidate ${d.candidate_id}: ${d.reason}`);
  });
}
