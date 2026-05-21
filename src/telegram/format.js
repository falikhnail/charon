import { escapeHtml, fmtPct, fmtSol, fmtUsd, short, gmgnLink, txLink, accountLink } from '../format.js';
import { getGradeEmoji } from '../pipeline/advancedFilters.js';

export function formatRecipients(shareholders) {
  if (!shareholders?.length) return '';
  return shareholders.slice(0, 5).map((holder, index) => {
    const pct = holder.bps != null ? ` (${fmtPct(holder.bps / 100)})` : '';
    const label = shareholders.length > 1 ? `Recipient ${index + 1}` : 'Recipient';
    return `${label}: <a href="${accountLink(holder.pubkey)}">${short(holder.pubkey)}</a>${pct}`;
  }).join('\n') + '\n';
}

export function signalLabel(signals = {}) {
  return [
    signals.hasFeeClaim ? 'fees' : null,
    signals.hasGraduated ? 'graduated' : null,
    signals.hasTrending ? 'trending' : null,
  ].filter(Boolean).join(' + ') || signals.route || 'unknown';
}

export function candidateSummary(candidate) {
  const health = candidate.health;
  const healthEmoji = health ? getGradeEmoji(health.grade) : '⚪';
  const healthScore = health ? `${health.score}` : '?';
  
  let summary = `<b>Token: ${escapeHtml(candidate.symbol)}</b>\n`;
  summary += `Health: ${healthEmoji} <b>${health?.grade || '?'}</b> (${healthScore}/100)\n`;
  summary += `Price: $${candidate.priceUsd?.toFixed(8) || '?'}\n`;
  summary += `Liquidity: $${Math.round(candidate.liquidity?.poolCapital || 0).toLocaleString()}\n`;
  summary += `Volume 24h: $${Math.round(candidate.volume24h || 0).toLocaleString()}\n`;
  summary += `Holders: ${candidate.holders || '?'}\n`;

  // Risk alerts
  if (health && health.risks.length > 0) {
    summary += `\n<b>⚠️ Risk Alerts:</b>\n`;
    health.risks.slice(0, 3).forEach(risk => {
      summary += `• <i>${risk.message}</i>\n`;
    });
  }

  // Warnings
  if (health && health.warnings.length > 0) {
    summary += `\n<b>Warnings:</b>\n`;
    health.warnings.forEach(w => {
      summary += `${w}\n`;
    });
  }

  return summary;
}

export function compactCandidateLine(row, index = null) {
  const candidate = row.candidate;
  const prefix = index == null ? '' : `${index}. `;
  const name = candidate.token?.symbol || candidate.token?.name || short(candidate.token?.mint || '');
  const signal = candidate.signals?.label || signalLabel(candidate.signals);
  return [
    `${prefix}<b>${escapeHtml(name)}</b>`,
    `<a href="${gmgnLink(candidate.token.mint)}">${short(candidate.token.mint)}</a>`,
    escapeHtml(signal),
    `mcap ${fmtUsd(candidate.metrics?.marketCapUsd)}`,
    `liq ${fmtUsd(candidate.metrics?.liquidityUsd)}`,
    candidate.feeClaim ? `fee ${fmtSol(candidate.feeClaim.distributedSol)} SOL` : null,
  ].filter(Boolean).join(' · ');
}

export function batchRevealSummary(batchId, rows, decision, triggerCandidateId = null) {
  const selected = rows.find(row => row.id === Number(decision.selected_candidate_id));
  const trigger = rows.find(row => row.id === Number(triggerCandidateId));
  const lines = [
    '🧭 <b>Charon Screening</b>',
    '',
    `Batch: <b>#${batchId}</b> · Screened: <b>${rows.length}</b>`,
    trigger ? `Trigger: ${compactCandidateLine(trigger)}` : null,
    selected ? `Pick: ${compactCandidateLine(selected)}` : 'Pick: <b>none</b>',
    `Decision: <b>${escapeHtml(decision.verdict || 'WATCH')}</b> ${fmtPct(decision.confidence || 0)}`,
    decision.reason ? `Reason: ${escapeHtml(String(decision.reason).slice(0, 420))}` : null,
  ];
  return lines.filter(Boolean).join('\n');
}

export function formatPosition(position) {
  const pnl = position.pnl_percent != null
    ? Number(position.pnl_percent)
    : position.entry_mcap && position.high_water_mcap
      ? (Number(position.high_water_mcap) / Number(position.entry_mcap) - 1) * 100
      : 0;
  return [
    `📍 <b>${escapeHtml(position.symbol || short(position.mint))}</b> #${position.id}`,
    `Token: <a href="${gmgnLink(position.mint)}">${short(position.mint)}</a>`,
    `Status: <b>${escapeHtml(position.status)}</b> · Mode: <b>${escapeHtml(position.execution_mode || 'dry_run')}</b> · Strategy: <b>${escapeHtml(position.strategy_id || 'sniper')}</b>`,
    position.entry_signature ? `Entry TX: <a href="${txLink(position.entry_signature)}">${short(position.entry_signature)}</a>` : null,
    `Entry mcap: ${fmtUsd(position.entry_mcap)} · High: ${fmtUsd(position.high_water_mcap)}`,
    `Size: ${fmtSol(position.size_sol)} SOL · PnL: ${fmtPct(pnl)}`,
    `TP: ${fmtPct(position.tp_percent)} · SL: ${fmtPct(position.sl_percent)} · Trail: ${position.trailing_enabled ? `${fmtPct(position.trailing_percent)}` : 'off'}`,
    position.exit_reason ? `Exit: ${escapeHtml(position.exit_reason)} at ${fmtUsd(position.exit_mcap)} (${fmtPct(position.pnl_percent)})` : null,
    position.exit_signature ? `Exit TX: <a href="${txLink(position.exit_signature)}">${short(position.exit_signature)}</a>` : null,
  ].filter(Boolean).join('\n');
}

export function compactDecisionCandidate(row) {
  if (!row) return null;
  const c = row.candidate;
  return {
    candidateId: row.id,
    mint: c.token?.mint,
    route: c.signals?.route,
    signals: c.signals,
    token: c.token,
    metrics: c.metrics,
    feeClaim: c.feeClaim,
    trending: c.trending,
    jupiterAsset: c.jupiterAsset ? {
      liquidity: c.jupiterAsset.liquidity,
      mcap: c.jupiterAsset.mcap,
      fdv: c.jupiterAsset.fdv,
      usdPrice: c.jupiterAsset.usdPrice,
      fees: c.jupiterAsset.fees,
      holderCount: c.jupiterAsset.holderCount,
      audit: c.jupiterAsset.audit,
      stats1h: c.jupiterAsset.stats1h,
      stats24h: c.jupiterAsset.stats24h,
    } : null,
    holders: {
      count: c.holders?.count,
      top20Percent: c.holders?.top20Percent,
      maxHolderPercent: c.holders?.maxHolderPercent,
      top20: c.holders?.top20,
    },
    chart: c.chart,
    savedWalletExposure: c.savedWalletExposure,
    twitterNarrative: c.twitterNarrative,
    filters: c.filters,
    createdAtMs: c.createdAtMs,
  };
}
