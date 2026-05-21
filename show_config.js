import Database from 'better-sqlite3';
import { safeJson } from './src/utils.js';

const db = new Database('./charon.sqlite');
const strat = db.prepare('SELECT config_json FROM strategies WHERE id = ?').get('sniper');
const config = safeJson(strat.config_json, {});

console.log('Current strategy config:\n');
console.log(JSON.stringify(config, null, 2));

db.close();
