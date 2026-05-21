import Database from 'better-sqlite3';
import { safeJson } from './src/utils.js';

const db = new Database('./charon.sqlite');

const strat = db.prepare('SELECT config_json FROM strategies WHERE id = ?').get('sniper');
const config = safeJson(strat.config_json, {});

// Update candidate filter settings for trending tokens
const updated = {
  ...config,
  // Loosen candidate-level filters to allow trending tokens
  healthFilterGrade: 'D',      // D or better (was default B)
  minLiquidity: 3000,          // $3k minimum (was default $10k)
  minAgeHours: 0,              // Allow brand new tokens (was default 0.5 hours)
  minVolume24h: 500,           // $500 min volume (was default $1k)
  maxTopTenPercent: 85         // Top 10 holders up to 85% (reasonable for trending)
};

db.prepare('UPDATE strategies SET config_json = ? WHERE id = ?')
  .run(JSON.stringify(updated), 'sniper');

console.log('✅ CANDIDATE FILTER SETTINGS UPDATED:\n');
console.log('  healthFilterGrade: B → D (allow new tokens)');
console.log('  minLiquidity: $10k → $3k');
console.log('  minAgeHours: 0.5h → 0min (allow brand new)');
console.log('  minVolume24h: $1k → $500');
console.log('  maxTopTenPercent: 75 → 85%');

console.log('\n💡 Trending tokens should now pass candidate filters!');

db.close();
