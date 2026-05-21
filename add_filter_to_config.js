import Database from 'better-sqlite3';
import { safeJson } from './src/utils.js';

const db = new Database('./charon.sqlite');

const strat = db.prepare('SELECT config_json FROM strategies WHERE id = ?').get('sniper');
const config = safeJson(strat.config_json, {});

// Add candidate filter settings to strategy config
const updated = {
  ...config,
  // Candidate-level filters (for code to read)
  healthFilterGrade: 'D',      // D or better
  minLiquidity: 3000,          // $3k minimum
  minAgeHours: 0,              // Brand new OK
  minVolume24h: 500,           // $500 min volume
  maxTopTenPercent: 85         // Top 10 holders up to 85%
};

db.prepare('UPDATE strategies SET config_json = ? WHERE id = ?')
  .run(JSON.stringify(updated), 'sniper');

console.log('✅ CANDIDATE FILTER SETTINGS ADDED TO STRATEGY CONFIG:\n');
console.log(JSON.stringify(updated, null, 2));

db.close();
