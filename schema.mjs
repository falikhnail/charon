import Database from 'better-sqlite3';
const db = new Database('charon.sqlite');

// Check the schema
console.log('=== DATABASE SCHEMA ===');
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='candidates';").all();
console.log(JSON.stringify(schema, null, 2));

// Check column names
console.log('\n=== CANDIDATES TABLE COLUMNS ===');
const columns = db.prepare("PRAGMA table_info(candidates);").all();
console.log(JSON.stringify(columns, null, 2));

// Show a sample row
console.log('\n=== SAMPLE ROW ===');
const sample = db.prepare("SELECT * FROM candidates LIMIT 1;").all();
console.log(JSON.stringify(sample, null, 2));

db.close();
