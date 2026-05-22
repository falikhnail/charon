import { db } from '../db/connection.js';
import { now, safeJson, parseWindowMs, formatWindow } from '../utils.js';

export function positionSnapshotCandidate(position) {
  return safeJson(position.snapshot_json, {})?.candidate || {};
}

export function summarizeLearningWindow(windowMs) {
  const cutoff = now() - windowMs;
  const positions = db.prepare(`
    SELECT *
    FROM dry_run_positions
    WHERE opened_at_ms >= ?
      AND COALESCE(execution_mode, 'dry_run') = 'dry_run'
    ORDER BY opened_at_ms ASC
  `).all(cutoff);
  const closed = positions.filter(position => position.status === 'closed');
  const winners = closed.filter(position => Number(position.pnl_percent || 0) > 0);
  const losers = closed.filter(position => Number(position.pnl_percent || 0) < 0);
  const totalPnlPercent = closed.reduce((sum, position) => sum + Number(position.pnl_percent || 0), 0);
  const totalPnlSol = closed.reduce((sum, position) => sum + Number(position.pnl_sol || 0), 0);
  
  // PnL-weighted exit reason analysis (critical for learning!)
  const byExitReason = new Map();
  for (const position of closed) {
    const exitReason = position.exit_reason || 'UNKNOWN';
    const pnl = Number(position.pnl_percent || 0);
    const pnlSol = Number(position.pnl_sol || 0);
    
    const row = byExitReason.get(exitReason) || {
      exitReason,
      count: 0,
      wins: 0,
      losses: 0,
      avgPnlPercent: 0,
      avgPnlSol: 0,
      totalPnlPercent: 0,
      totalPnlSol: 0,
      winRate: 0,
      quality_score: 0  // Weighted score: avg PnL weighted by win rate
    };
    
    row.count += 1;
    row.wins += pnl > 0 ? 1 : 0;
    row.losses += pnl < 0 ? 1 : 0;
    row.totalPnlPercent += pnl;
    row.totalPnlSol += pnlSol;
    row.avgPnlPercent = row.totalPnlPercent / row.count;
    row.avgPnlSol = row.totalPnlSol / row.count;
    row.winRate = row.count ? row.wins / row.count * 100 : 0;
    
    // Quality score = (win% * 0.5 + avg_pnl_normalized * 0.5)
    // This prevents trailing TP from being preferred if it wins often but with small PnL
    const avgPnlNormalized = Math.max(-100, Math.min(100, row.avgPnlPercent)); // Normalize to -100..100
    row.quality_score = (row.winRate / 100) * 0.4 + (avgPnlNormalized / 50) * 0.6; // 40% win rate, 60% PnL quality
    
    byExitReason.set(exitReason, row);
  }
  
  const byRoute = new Map();
  for (const position of closed) {
    const candidate = positionSnapshotCandidate(position);
    const route = candidate.signals?.route || candidate.signals?.label || 'unknown';
    const pnl = Number(position.pnl_percent || 0);
    const pnlSol = Number(position.pnl_sol || 0);
    
    const row = byRoute.get(route) || {
      route,
      count: 0,
      wins: 0,
      losses: 0,
      pnlPercent: 0,
      pnlSol: 0,
      winRate: 0,
      avgPnlPercent: 0,
      quality_score: 0
    };
    
    row.count += 1;
    row.wins += pnl > 0 ? 1 : 0;
    row.losses += pnl < 0 ? 1 : 0;
    row.pnlPercent += pnl;
    row.pnlSol += pnlSol;
    row.winRate = row.count ? row.wins / row.count * 100 : 0;
    row.avgPnlPercent = row.count ? row.pnlPercent / row.count : 0;
    
    // Same quality scoring for routes
    const avgPnlNormalized = Math.max(-100, Math.min(100, row.avgPnlPercent));
    row.quality_score = (row.winRate / 100) * 0.4 + (avgPnlNormalized / 50) * 0.6;
    
    byRoute.set(route, row);
  }
  
  const batches = db.prepare(`
    SELECT verdict, COUNT(*) AS count, AVG(confidence) AS avg_confidence
    FROM llm_batches
    WHERE created_at_ms >= ?
    GROUP BY verdict
  `).all(cutoff);
  const actions = db.prepare(`
    SELECT action, COUNT(*) AS count
    FROM decision_logs
    WHERE at_ms >= ?
    GROUP BY action
    ORDER BY count DESC
  `).all(cutoff);
  const best = [...closed].sort((a, b) => Number(b.pnl_percent || 0) - Number(a.pnl_percent || 0)).slice(0, 5).map(position => ({
    mint: position.mint,
    symbol: position.symbol,
    pnlPercent: Number(position.pnl_percent || 0),
    exitReason: position.exit_reason,
    entryMcap: position.entry_mcap,
    exitMcap: position.exit_mcap,
    route: positionSnapshotCandidate(position).signals?.route || 'unknown',
  }));
  const worst = [...closed].sort((a, b) => Number(a.pnl_percent || 0) - Number(b.pnl_percent || 0)).slice(0, 5).map(position => ({
    mint: position.mint,
    symbol: position.symbol,
    pnlPercent: Number(position.pnl_percent || 0),
    exitReason: position.exit_reason,
    entryMcap: position.entry_mcap,
    exitMcap: position.exit_mcap,
    route: positionSnapshotCandidate(position).signals?.route || 'unknown',
  }));
  return {
    windowMs,
    fromMs: cutoff,
    toMs: now(),
    positions: {
      opened: positions.length,
      closed: closed.length,
      open: positions.length - closed.length,
      wins: winners.length,
      losses: losers.length,
      winRate: closed.length ? winners.length / closed.length * 100 : null,
      totalPnlPercent,
      avgPnlPercent: closed.length ? totalPnlPercent / closed.length : null,
      totalPnlSol,
      byRoute: [...byRoute.values()].map(row => ({
        ...row,
        winRate: row.count ? row.wins / row.count * 100 : null,
        avgPnlPercent: row.count ? row.pnlPercent / row.count : null,
      })).sort((a, b) => b.quality_score - a.quality_score), // Sort by quality, not just PnL
      byExitReason: [...byExitReason.values()].sort((a, b) => b.quality_score - a.quality_score),
      best,
      worst,
    },
    llm: { batches, actions },
  };
}
