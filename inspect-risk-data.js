import { db } from './src/db/connection.js';

// Get newest candidate with risks data
const newest = db.prepare(`
  SELECT id, candidate_json FROM candidates ORDER BY id DESC LIMIT 1
`).get();

if (newest) {
  const candidate = JSON.parse(newest.candidate_json);
  console.log('=== NEWEST CANDIDATE RISKS DATA ===\n');
  console.log('Candidate ID:', newest.id);
  console.log('\nRisks object structure:');
  console.log(JSON.stringify(candidate.risks, null, 2));
  
  console.log('\n=== OLDER CANDIDATE (ID=11) ===\n');
  const old = db.prepare(`SELECT candidate_json FROM candidates WHERE id = 11`).get();
  if (old) {
    const oldData = JSON.parse(old.candidate_json);
    console.log('Has risks:', !!oldData.risks);
    if (oldData.risks) {
      console.log('Risks keys:', Object.keys(oldData.risks));
    }
  }
}

// Count candidates with complete risk data
const withCompleteRisks = db.prepare(`
  SELECT COUNT(*) as cnt FROM candidates 
  WHERE candidate_json LIKE '%"holderRisks"%'
`).get();

console.log('\n=== RISK DATA PRESENCE ===');
console.log('Candidates with holderRisks field:', withCompleteRisks.cnt, 'out of 241');

// Get sample of risks data structure
const samples = db.prepare(`
  SELECT id, candidate_json FROM candidates 
  WHERE candidate_json LIKE '%"holderRisks"%'
  LIMIT 1
`).all();

if (samples.length > 0) {
  console.log('\n=== SAMPLE RISKS STRUCTURE ===');
  const data = JSON.parse(samples[0].candidate_json);
  console.log('holderRisks count:', data.risks?.holderRisks?.length || 0);
  console.log('liquidityRisks count:', data.risks?.liquidityRisks?.length || 0);
  console.log('manipulationRisks count:', data.risks?.manipulationRisks?.length || 0);
  console.log('ageRisks count:', data.risks?.ageRisks?.length || 0);
  console.log('signalRisks count:', data.risks?.signalRisks?.length || 0);
  console.log('riskFactor:', data.risks?.riskFactor);
}
