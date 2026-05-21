import { db } from './src/db/connection.js';

// Get 5 newest candidates
const newCandidates = db.prepare(`
  SELECT id, mint, status, created_at_ms, updated_at_ms 
  FROM candidates 
  ORDER BY created_at_ms DESC 
  LIMIT 5
`).all();

console.log('=== 5 NEWEST CANDIDATES ===\n');
newCandidates.forEach(c => {
  console.log(`ID: ${c.id} | ${c.status.toUpperCase()} | Created: ${new Date(c.created_at_ms).toISOString()}`);
});

// Now inspect newest candidate in detail
if (newCandidates.length > 0) {
  const newestId = newCandidates[0].id;
  const newest = db.prepare(`SELECT candidate_json FROM candidates WHERE id = ?`).get(newestId);
  
  if (newest) {
    const data = JSON.parse(newest.candidate_json);
    console.log(`\n=== NEWEST CANDIDATE ${newestId} STRUCTURE ===\n`);
    
    console.log('Has health:', !!data.health);
    console.log('Has risks:', !!data.risks);
    console.log('Has entryTiming:', !!data.entryTiming);
    console.log('Has filters:', !!data.filters);
    
    if (data.health) {
      console.log('\n📊 Health object:');
      console.log(JSON.stringify(data.health, null, 2).substring(0, 300));
    }
    
    if (data.risks) {
      console.log('\n⚠️ Risks object:');
      console.log(JSON.stringify(data.risks, null, 2).substring(0, 300));
    }
    
    if (data.entryTiming) {
      console.log('\n📍 Entry Timing object:');
      console.log(JSON.stringify(data.entryTiming, null, 2).substring(0, 300));
    }
  }
}

// Count candidates by status
const counts = db.prepare(`
  SELECT status, COUNT(*) as count FROM candidates GROUP BY status
`).all();

console.log('\n=== CANDIDATES BY STATUS ===');
counts.forEach(c => {
  console.log(`  ${c.status}: ${c.count}`);
});
