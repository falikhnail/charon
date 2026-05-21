import { db } from './src/db/connection.js';

// Get one older candidate (ID 11)
const row = db.prepare(`SELECT id, candidate_json FROM candidates WHERE id = 11`).get();

if (row) {
  const data = JSON.parse(row.candidate_json);
  console.log('=== CANDIDATE 11 RAW DATA ===\n');
  console.log('ID:', data.id);
  console.log('Has health object:', !!data.health);
  console.log('Has risks object:', !!data.risks);
  console.log('Has entryTiming object:', !!data.entryTiming);
  
  if (data.health) {
    console.log('\nHealth:', JSON.stringify(data.health, null, 2));
  }
  
  if (data.risks) {
    console.log('\nRisks:', JSON.stringify(data.risks, null, 2).substring(0, 300));
  }
  
  if (data.entryTiming) {
    console.log('\nEntry Timing:', JSON.stringify(data.entryTiming, null, 2).substring(0, 300));
  }
}

// Also check newest candidate
console.log('\n\n=== CANDIDATE 222 (NEWEST) ===\n');
const newRow = db.prepare(`SELECT id, candidate_json FROM candidates WHERE id = 222`).get();

if (newRow) {
  const data = JSON.parse(newRow.candidate_json);
  console.log('Has health object:', !!data.health);
  console.log('Has risks object:', !!data.risks);
  console.log('Has entryTiming object:', !!data.entryTiming);
  
  if (data.health) {
    console.log('\nHealth Grade:', data.health.grade, 'Score:', data.health.score);
  }
  
  if (data.entryTiming) {
    console.log('\nEntry Timing Strategy:', data.entryTiming.timing?.strategy);
  }
}
