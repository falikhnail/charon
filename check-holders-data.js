import { db } from './src/db/connection.js';

// Check several candidates for holders data
const candidates = db.prepare(`
  SELECT id, candidate_json FROM candidates ORDER BY id DESC LIMIT 5
`).all();

candidates.forEach(row => {
  const candidate = JSON.parse(row.candidate_json);
  console.log(`\nCandidate ${row.id}:`);
  console.log(`  Has holders field: ${!!candidate.holders}`);
  console.log(`  Holders type: ${typeof candidate.holders}`);
  
  if (Array.isArray(candidate.holders)) {
    console.log(`  Holders count: ${candidate.holders.length}`);
    if (candidate.holders.length > 0) {
      console.log(`  First holder:`, JSON.stringify(candidate.holders[0]).substring(0, 150));
    }
  } else if (candidate.holders) {
    console.log(`  Holders value:`, JSON.stringify(candidate.holders).substring(0, 150));
  }
  
  // Check gmgn for holder info
  if (candidate.gmgn?.holder_count) {
    console.log(`  GMGN holder_count: ${candidate.gmgn.holder_count}`);
  }
});

// Check if any candidate has holders array
const withHolders = db.prepare(`
  SELECT COUNT(*) as cnt FROM candidates 
  WHERE candidate_json LIKE '%"holders":%[%'
`).get();

console.log(`\n\nCandidates with holders array: ${withHolders.cnt} out of 241`);
