import Database from 'better-sqlite3';

const db = new Database('charon.sqlite');

// Get current Sniper config
const current = db.prepare(`
  SELECT id, config_json FROM strategies WHERE id = 'sniper'
`).get();

if (!current) {
  console.log('Sniper strategy not found!');
  db.close();
  process.exit(1);
}

const config = JSON.parse(current.config_json);

// Update filter thresholds
config.healthFilterGrade = 'D';
config.minAgeHours = 0;
config.minLiquidity = 5000;
config.llm_min_confidence = 30;

// Update in database
db.prepare(`
  UPDATE strategies
  SET config_json = ?
  WHERE id = 'sniper'
`).run(JSON.stringify(config));

console.log('✅ Sniper strategy updated:');
console.log(`  healthFilterGrade: ${config.healthFilterGrade}`);
console.log(`  minAgeHours: ${config.minAgeHours}`);
console.log(`  minLiquidity: ${config.minLiquidity}`);
console.log(`  llm_min_confidence: ${config.llm_min_confidence}`);

db.close();
