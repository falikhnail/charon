const Database = require('better-sqlite3');
const db = new Database('charon.sqlite');

// Get summary stats
const summary = db.prepare(`
  SELECT 
    COUNT(*) as total_candidates,
    SUM(CASE WHEN json_extract(filters, '$.passed') = 1 THEN 1 ELSE 0 END) as passed_filters,
    SUM(CASE WHEN json_extract(filters, '$.passed') = 0 THEN 1 ELSE 0 END) as failed_filters,
    GROUP_CONCAT(DISTINCT json_extract(filters, '$.reason'), ', ') as failure_reasons
  FROM candidates;
`).all();

console.log('=== CANDIDATE FILTERING SUMMARY ===');
console.log(JSON.stringify(summary, null, 2));

// Get examples of PASSED candidates
console.log('\n=== EXAMPLES OF PASSED CANDIDATES ===');
const passed = db.prepare(`
  SELECT id, name, json_extract(filters, '$.passed') as passed, json_extract(filters, '$.reason') as reason
  FROM candidates 
  WHERE json_extract(filters, '$.passed') = 1
  LIMIT 3;
`).all();
console.log(JSON.stringify(passed, null, 2));

// Get examples of FAILED candidates
console.log('\n=== EXAMPLES OF FAILED CANDIDATES ===');
const failed = db.prepare(`
  SELECT id, name, json_extract(filters, '$.passed') as passed, json_extract(filters, '$.reason') as reason
  FROM candidates 
  WHERE json_extract(filters, '$.passed') = 0
  LIMIT 3;
`).all();
console.log(JSON.stringify(failed, null, 2));

db.close();
