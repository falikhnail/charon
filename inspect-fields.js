import { db } from './src/db/connection.js';

const candidate = db.prepare(`
  SELECT candidate_json FROM candidates WHERE status = 'watch' LIMIT 1
`).get();

if (candidate) {
  const c = JSON.parse(candidate.candidate_json);
  
  console.log('=== DETAILED FIELD INSPECTION ===\n');
  
  console.log('📍 Entry Timing Object:');
  if (c.entryTiming) {
    console.log(JSON.stringify(c.entryTiming, null, 2));
  } else {
    console.log('  ✗ MISSING - entryTiming tidak ada');
  }
  
  console.log('\n⚠️ Risks Object:');
  if (c.risks) {
    console.log(JSON.stringify(c.risks, null, 2));
  } else {
    console.log('  ✗ MISSING');
  }
  
  console.log('\n🏥 Health Object:');
  console.log(JSON.stringify(c.health, null, 2));
  
  console.log('\n💰 Full Metrics:');
  console.log(JSON.stringify(c.metrics, null, 2));
  
  console.log('\n📊 Chart Data:');
  console.log(JSON.stringify(c.chart, null, 2));
}
