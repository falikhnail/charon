import Database from 'better-sqlite3';
const db = new Database('charon.sqlite');

// Check column names
const columns = db.prepare("PRAGMA table_info(candidates);").all();
console.log('Column names:');
columns.forEach(c => console.log(`  ${c.name} (${c.type})`));

// Show first row keys
const sample = db.prepare("SELECT * FROM candidates LIMIT 1;").all();
if (sample.length > 0) {
  console.log('\nFirst row keys:', Object.keys(sample[0]));
}

db.close();
