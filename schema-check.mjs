import Database from 'better-sqlite3';

const db = new Database('charon.sqlite', { readonly: true });

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();

tables.forEach(t => {
  const info = db.prepare(`PRAGMA table_info(${t.name})`).all();
  console.log(`\n=== TABLE: ${t.name} ===`);
  info.forEach(col => console.log(`  ${col.name} (${col.type})`));
});

db.close();
