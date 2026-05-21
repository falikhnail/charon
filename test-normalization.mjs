import Database from 'better-sqlite3';
import { normalizeForRiskAnalysis } from './src/pipeline/candidateBuilder.js';
import { analyzeTokenRisks } from './src/pipeline/tokenRiskAnalyzer.js';

const db = new Database('charon.sqlite', { readonly: true });

console.log('\n=== TESTING FIELD NORMALIZATION ===\n');

// Get a few candidates to test
const candidates = db.prepare(`
  SELECT 
    mint,
    json_extract(candidate_json, '$.token.name') as name,
    candidate_json
  FROM candidates
  LIMIT 3
`).all();

candidates.forEach((row, idx) => {
  const candidate = JSON.parse(row.candidate_json);
  
  console.log(`\n--- Candidate ${idx + 1}: ${candidate.token.name} ---`);
  
  // Show before normalization
  console.log('BEFORE normalization:');
  console.log(`  holderData: ${candidate.holderData ? JSON.stringify(candidate.holderData) : 'undefined'}`);
  console.log(`  liquidity: ${candidate.liquidity ? JSON.stringify(candidate.liquidity) : 'undefined'}`);
  console.log(`  bundlerData: ${candidate.bundlerData ? JSON.stringify(candidate.bundlerData) : 'undefined'}`);
  console.log(`  ageData: ${candidate.ageData ? JSON.stringify(candidate.ageData) : 'undefined'}`);
  
  // Apply normalization
  normalizeForRiskAnalysis(candidate);
  
  console.log('\nAFTER normalization:');
  console.log(`  holderData: ${JSON.stringify(candidate.holderData)}`);
  console.log(`  liquidity: ${JSON.stringify(candidate.liquidity)}`);
  console.log(`  bundlerData: ${JSON.stringify(candidate.bundlerData)}`);
  console.log(`  ageData: ${JSON.stringify(candidate.ageData)}`);
  
  // Run risk analysis
  const risks = analyzeTokenRisks(candidate);
  console.log('\nRISK ANALYSIS RESULTS:');
  console.log(`  Holder Risks: ${JSON.stringify(risks.holderRisks)}`);
  console.log(`  Liquidity Risks: ${JSON.stringify(risks.liquidityRisks)}`);
  console.log(`  Bundler Risks: ${JSON.stringify(risks.manipulationRisks)}`);
  console.log(`  Age Risks: ${JSON.stringify(risks.ageRisks)}`);
  console.log(`  Risk Factor Score: ${risks.riskFactor}/100`);
});

db.close();
console.log('\n=== TEST COMPLETE ===\n');
