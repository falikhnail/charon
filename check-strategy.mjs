import Database from 'better-sqlite3';

const db = new Database('charon.sqlite', { readonly: true });

const strategy = db.prepare(`
  SELECT config_json FROM strategies WHERE id = 'sniper'
`).get();

if (strategy) {
  const config = JSON.parse(strategy.config_json);
  console.log('\n=== SNIPER STRATEGY CONFIG ===\n');
  console.log(`healthFilterGrade: ${config.healthFilterGrade || 'NOT SET'}`);
  console.log(`minAgeHours: ${config.minAgeHours ?? 'NOT SET'}`);
  console.log(`minLiquidity: ${config.minLiquidity || 'NOT SET'}`);
  console.log(`llm_min_confidence: ${config.llm_min_confidence}`);
} else {
  console.log('Sniper strategy NOT FOUND');
}

db.close();
