import { db } from './src/db/connection.js';

const positions = db.prepare(`
  SELECT id, mint, status, opened_at_ms, closed_at_ms, pnl_percent
  FROM dry_run_positions
  ORDER BY opened_at_ms DESC
  LIMIT 10
`).all();

console.log('Recent positions:');
positions.forEach(p => {
  const status = p.status || 'open';
  const opened = new Date(p.opened_at_ms).toISOString();
  const closed = p.closed_at_ms ? new Date(p.closed_at_ms).toISOString() : 'open';
  const pnl = p.pnl_percent ? `${p.pnl_percent.toFixed(2)}%` : 'N/A';
  console.log(`${p.mint.slice(0, 8)}... ${status} @ ${opened} → ${closed} | PnL: ${pnl}`);
});

const totalPositions = db.prepare('SELECT COUNT(*) as c FROM dry_run_positions').get().c;
console.log(`\nTotal positions: ${totalPositions}`);

const openPositions = db.prepare('SELECT COUNT(*) as c FROM dry_run_positions WHERE status IS NULL OR status = "open"').get().c;
console.log(`Open positions: ${openPositions}`);
