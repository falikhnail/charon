/**
 * Dynamic Position Sizer
 * Advanced position sizing with entry timing, risk management, and portfolio constraints
 */

/**
 * Calculate final position size with all factors
 * Combines health grade, entry timing, risk, and portfolio constraints
 */
export function calculateFinalPositionSize(candidate, decision, portfolioState, constraints = {}) {
  const health = candidate.health || {};
  const risks = candidate.risks || {};
  const entryTiming = candidate.entryTiming || {};
  const metrics = candidate.metrics || {};
  
  // Start with LLM size multiplier
  let sizeMultiplier = decision.size_multiplier || 1.0;
  
  // Apply health grade scaling
  const gradeMultiplier = getGradeMultiplier(health.grade);
  sizeMultiplier *= gradeMultiplier;
  
  // Apply entry timing adjustment (better timing = larger size)
  if (entryTiming.entryQuality) {
    const timingAdjustment = getTimingAdjustment(entryTiming.entryQuality);
    sizeMultiplier *= timingAdjustment;
  }
  
  // Apply risk factor reduction
  const riskMultiplier = getRiskMultiplier(risks);
  sizeMultiplier *= riskMultiplier;
  
  // Apply portfolio constraint adjustments
  const portfolioMultiplier = getPortfolioMultiplier(portfolioState, constraints);
  sizeMultiplier *= portfolioMultiplier;
  
  // Apply liquidity adjustment
  const liquidityMultiplier = getLiquidityMultiplier(metrics.liquidityUsd, sizeMultiplier);
  sizeMultiplier *= liquidityMultiplier;
  
  // Ensure within bounds
  const finalMultiplier = Math.max(0, Math.min(1, sizeMultiplier));
  
  const baseSize = constraints.basePositionSize || 0.1;
  const finalSize = baseSize * finalMultiplier;
  
  return {
    finalSize,
    finalMultiplier,
    baseSize,
    gradeMultiplier,
    timingAdjustment: entryTiming.entryQuality ? getTimingAdjustment(entryTiming.entryQuality) : 1.0,
    riskMultiplier,
    portfolioMultiplier,
    liquidityMultiplier,
    breakdown: {
      grade: health.grade,
      entry_quality: entryTiming.entryQuality?.grade,
      risk_level: risks.riskFactor ? Math.round(risks.riskFactor) : 0,
      open_positions: portfolioState.openPositions || 0,
      max_positions: constraints.maxOpenPositions || 3,
      available_liquidity: portfolioState.availableSol || 0,
    },
  };
}

function getGradeMultiplier(grade) {
  const multipliers = {
    'A': 1.0,
    'B': 0.8,
    'C': 0.5,
    'D': 0.0,
  };
  return multipliers[grade] || 0;
}

function getTimingAdjustment(entryQuality) {
  const score = entryQuality.score || 50;
  
  if (score >= 85) return 1.3;      // Excellent - 30% size premium
  if (score >= 75) return 1.15;     // Very good - 15% premium
  if (score >= 65) return 1.0;      // Good - normal size
  if (score >= 50) return 0.85;     // Fair - 15% reduction
  if (score >= 40) return 0.6;      // Poor - 40% reduction
  return 0.3;  // Very poor - 70% reduction
}

function getRiskMultiplier(risks) {
  const allRisks = [
    ...(risks.holderRisks || []),
    ...(risks.liquidityRisks || []),
    ...(risks.manipulationRisks || []),
    ...(risks.ageRisks || []),
    ...(risks.signalRisks || []),
  ];
  
  const criticalCount = allRisks.filter(r => r.severity === 'CRITICAL').length;
  const highCount = allRisks.filter(r => r.severity === 'HIGH').length;
  const mediumCount = allRisks.filter(r => r.severity === 'MEDIUM').length;
  
  // Hard stops
  if (criticalCount > 0) return 0;
  
  // Risk penalty
  let multiplier = 1.0;
  multiplier -= (highCount * 0.25);    // -25% per high risk
  multiplier -= (mediumCount * 0.10);  // -10% per medium risk
  
  return Math.max(0, multiplier);
}

function getPortfolioMultiplier(portfolioState, constraints) {
  const maxPositions = constraints.maxOpenPositions || 3;
  const openPositions = portfolioState.openPositions || 0;
  const availableSol = portfolioState.availableSol || 0;
  
  let multiplier = 1.0;
  
  // Reduce size if approaching max positions
  if (openPositions >= maxPositions * 0.8) {
    multiplier *= 0.5;  // Half size if at 80% capacity
  }
  
  if (openPositions >= maxPositions) {
    multiplier = 0;  // Cannot open more
  }
  
  // Reduce if low on capital
  if (availableSol < 0.5) {
    multiplier *= 0.3;  // Very low capital - minimal size
  } else if (availableSol < 1.0) {
    multiplier *= 0.6;  // Low capital - 40% reduction
  }
  
  return Math.max(0, multiplier);
}

function getLiquidityMultiplier(liquidityUsd, proposedMultiplier) {
  if (!liquidityUsd || liquidityUsd === 0) return 0.3;
  
  if (liquidityUsd > 500000) return 1.2;   // Very deep - can scale up
  if (liquidityUsd > 100000) return 1.0;   // Good liquidity - normal
  if (liquidityUsd > 50000) return 0.9;    // Decent liquidity
  if (liquidityUsd > 25000) return 0.7;    // Limited liquidity - 30% reduction
  if (liquidityUsd > 10000) return 0.4;    // Thin liquidity - 60% reduction
  return 0.2;  // Very thin - 80% reduction
}

/**
 * Calculate risk-adjusted position sizing
 * Returns size with max loss constraints
 */
export function calculateRiskAdjustedSize(
  baseSize,
  entryPrice,
  stopLossPercent,
  maxLossPerPositionUsd = 50,
  accountSizeUsd = 1000
) {
  // Calculate max loss from stop loss
  const riskPerUnit = entryPrice * (Math.abs(stopLossPercent) / 100);
  
  // How many units can we trade to respect max loss limit
  const maxUnitsForMaxLoss = maxLossPerPositionUsd / riskPerUnit;
  
  // How many units can we trade with base size
  const baseUnitsUsd = baseSize * entryPrice;
  const baseUnits = baseUnitsUsd / entryPrice;
  
  // Take the smaller of the two
  const finalUnits = Math.min(baseUnits, maxUnitsForMaxLoss);
  const finalSize = finalUnits * entryPrice;
  
  // Ensure it doesn't exceed max percent of account
  const maxPercentOfAccount = 0.15;  // Max 15% per position
  const maxSizeFromAccount = accountSizeUsd * maxPercentOfAccount;
  const constrainedSize = Math.min(finalSize, maxSizeFromAccount);
  
  return {
    finalSize: constrainedSize,
    maxUnitsForMaxLoss,
    baseUnits,
    constraints: {
      maxLoss: maxLossPerPositionUsd,
      riskPerUnit,
      maxPercentOfAccount: (constrainedSize / accountSizeUsd) * 100,
    },
  };
}

/**
 * Calculate position count constraint
 * Reduces size based on open positions
 */
export function getPositionCountConstraint(openPositions, maxPositions = 3) {
  if (openPositions >= maxPositions) {
    return { canOpen: false, multiplier: 0, reason: 'Max positions reached' };
  }
  
  const remaining = maxPositions - openPositions;
  
  // Reduce size as we fill slots
  let multiplier = 1.0;
  if (remaining === 1) multiplier = 0.7;  // Last slot - risky
  else if (remaining === 2) multiplier = 0.85;
  
  return {
    canOpen: true,
    multiplier,
    remaining,
    reason: `${remaining} slot(s) available`,
  };
}

/**
 * Calculate Kelly Criterion sizing
 * Optimal sizing based on win rate and risk/reward ratio
 */
export function calculateKellySizing(winRate, avgWinPercent, avgLossPercent, baseSize = 0.1) {
  if (winRate <= 0 || winRate >= 1) {
    return { size: baseSize, note: 'Invalid win rate for Kelly calculation' };
  }
  
  // Kelly formula: f = (bp - q) / b
  // f = fraction of bankroll to bet
  // b = odds (reward/risk)
  // p = win probability
  // q = loss probability (1-p)
  
  const b = avgWinPercent / avgLossPercent;
  const p = winRate;
  const q = 1 - p;
  
  const kellyFraction = (b * p - q) / b;
  
  // Use fractional Kelly (50%) for conservative sizing
  const fractionalKelly = kellyFraction * 0.5;
  
  // Ensure between 0 and 1
  const finalKelly = Math.max(0, Math.min(1, fractionalKelly));
  
  return {
    kellyFraction,
    fractionalKelly,
    finalSize: baseSize * finalKelly,
    multiplier: finalKelly,
    sizing: {
      winRate: (winRate * 100).toFixed(1),
      avgWinPercent: avgWinPercent.toFixed(1),
      avgLossPercent: avgLossPercent.toFixed(1),
      riskRewardRatio: (b).toFixed(2),
    },
  };
}

/**
 * Calculate equity curve constraint
 * Reduce sizes during drawdowns
 */
export function getEquityConstraint(currentEquity, peakEquity, maxDrawdownPercent = 20) {
  const drawdown = ((peakEquity - currentEquity) / peakEquity) * 100;
  
  if (drawdown >= maxDrawdownPercent) {
    return { multiplier: 0, reason: `Max drawdown reached (${drawdown.toFixed(1)}%)` };
  }
  
  const remainingDrawdown = maxDrawdownPercent - drawdown;
  const drawdownPercent = (drawdown / maxDrawdownPercent) * 100;
  
  // Scale back sizes as drawdown increases
  let multiplier = 1.0;
  if (drawdownPercent > 80) multiplier = 0.3;
  else if (drawdownPercent > 60) multiplier = 0.5;
  else if (drawdownPercent > 40) multiplier = 0.7;
  else if (drawdownPercent > 20) multiplier = 0.85;
  
  return {
    multiplier,
    drawdown: drawdown.toFixed(2),
    maxDrawdown: maxDrawdownPercent,
    remainingDrawdown: remainingDrawdown.toFixed(2),
    reason: `Drawdown control: ${drawdown.toFixed(1)}% of ${maxDrawdownPercent}%`,
  };
}

/**
 * Suggest position size based on all constraints
 */
export function suggestPositionSize(candidate, decision, portfolioMetrics) {
  const finalSizing = calculateFinalPositionSize(
    candidate,
    decision,
    portfolioMetrics,
    {
      basePositionSize: 0.1,
      maxOpenPositions: portfolioMetrics.maxOpenPositions || 3,
    }
  );
  
  const positionConstraint = getPositionCountConstraint(
    portfolioMetrics.openPositions,
    portfolioMetrics.maxOpenPositions
  );
  
  const equityConstraint = getEquityConstraint(
    portfolioMetrics.currentEquity,
    portfolioMetrics.peakEquity,
    20  // 20% max drawdown
  );
  
  // Apply all constraints
  let finalSize = finalSizing.finalSize;
  
  if (!positionConstraint.canOpen) {
    finalSize = 0;
  } else {
    finalSize *= positionConstraint.multiplier;
  }
  
  finalSize *= equityConstraint.multiplier;
  
  return {
    recommendedSize: Math.max(0, finalSize),
    canOpen: positionConstraint.canOpen,
    constraints: {
      position_count: positionConstraint,
      equity: equityConstraint,
      sizing_factors: finalSizing,
    },
    recommendation: finalSize > 0 ? 'PROCEED' : 'SKIP',
  };
}

/**
 * Format sizing recommendation for logging
 */
export function formatSizingRationale(sizing) {
  const lines = [
    `📊 Position Sizing: ${sizing.recommendedSize.toFixed(4)} SOL`,
    `Grade Multiplier: ${sizing.constraints.sizing_factors.gradeMultiplier.toFixed(2)}x`,
  ];
  
  if (sizing.constraints.sizing_factors.timingAdjustment !== 1.0) {
    lines.push(`Entry Timing: ${sizing.constraints.sizing_factors.timingAdjustment.toFixed(2)}x`);
  }
  
  if (sizing.constraints.position_count.remaining !== undefined) {
    lines.push(`Positions: ${sizing.constraints.position_count.remaining} slots remaining`);
  }
  
  if (sizing.constraints.equity.drawdown !== undefined) {
    lines.push(`Equity: ${sizing.constraints.equity.drawdown}% drawdown (max ${sizing.constraints.equity.maxDrawdown}%)`);
  }
  
  return lines.join('\n');
}
