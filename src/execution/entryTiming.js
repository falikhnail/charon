/**
 * Entry Timing Optimizer
 * Analyzes price action to find optimal entry points and timing strategies
 */

/**
 * Analyze entry timing
 * Returns timing strategy and context ONLY - NOT a verdict
 * Verdict is LLM's responsibility
 */
export function analyzeEntryTiming(candidate) {
  const chart = candidate.chart || {};
  const metrics = candidate.metrics || {};
  const health = candidate.health || {};
  
  // Get available price data
  const currentPrice = chart.currentNative || metrics.priceUsd;
  const rangeHigh = chart.rangeHighNative;
  const distanceFromAth = chart.distanceFromAthPercent || 0;
  const athWindow = chart.windows?.find(w => w.label === 'ath_context_24h_5m' && w.available);
  
  const timing = analyzeTimingStrategy(candidate);
  const quality = getEntryQuality(candidate);
  const position = analyzePricePosition(athWindow, rangeHigh, distanceFromAth);
  
  // Return ONLY timing info - LLM makes final decision
  return {
    strategy: timing.strategy,
    reason: timing.reason,
    priceDistanceFromAth: distanceFromAth,
    entryQualityScore: quality.score,
    entryQualityGrade: quality.grade,
    supportLevel: position.supportLevel,
    resistanceLevel: position.resistanceLevel,
  };
}

/**
 * Analyze timing strategy based on price pattern
 */
function analyzeTimingStrategy(candidate) {
  const athWindow = candidate.chart?.athContext24h;
  if (!athWindow) return { strategy: 'immediate', reason: 'No chart context available' };
  
  const current = athWindow.current || 0;
  const high = athWindow.high || current;
  const low = athWindow.low || current;
  
  if (!high || !low || low === 0) {
    return { strategy: 'immediate', reason: 'Insufficient price data' };
  }
  
  const percentFromLow = ((current - low) / low) * 100;
  const percentFromHigh = ((high - current) / high) * 100;
  
  // Strategy logic based on price position in 24h range
  if (percentFromLow < 20) {
    // At bottom - great entry
    return {
      strategy: 'immediate',
      confidence: 90,
      reason: 'Price at 24h low - strong entry point',
      percentFromLow,
      percentFromHigh,
    };
  } else if (percentFromLow < 40) {
    // Lower half - good entry
    return {
      strategy: 'immediate',
      confidence: 75,
      reason: 'Price in lower half of 24h range - solid entry',
      percentFromLow,
      percentFromHigh,
    };
  } else if (percentFromLow < 60) {
    // Middle range - neutral
    return {
      strategy: 'scale_in',
      confidence: 60,
      reason: 'Price midway through 24h range - consider scale-in',
      percentFromLow,
      percentFromHigh,
    };
  } else if (percentFromLow < 80) {
    // Upper half - risky
    return {
      strategy: 'scale_in',
      confidence: 45,
      reason: 'Price in upper half - higher risk, scale smaller',
      percentFromLow,
      percentFromHigh,
    };
  } else {
    // At top - wait for pullback
    return {
      strategy: 'wait_pullback',
      confidence: 30,
      reason: 'Price near 24h high - wait for pullback',
      percentFromLow,
      percentFromHigh,
    };
  }
}

/**
 * Analyze price position relative to key levels
 */
function analyzePricePosition(athWindow, rangeHigh, distanceFromAth) {
  const analysis = {
    pricePosition: 'unknown',
    supportLevel: null,
    resistanceLevel: null,
    risk: 'unknown',
  };
  
  if (!athWindow) return analysis;
  
  const current = athWindow.current || 0;
  const high = athWindow.high || current;
  const low = athWindow.low || current;
  
  // Support and resistance levels
  analysis.supportLevel = low;
  analysis.resistanceLevel = high;
  
  // Determine position
  const range = high - low;
  if (range === 0) {
    analysis.pricePosition = 'unknown';
  } else {
    const positionInRange = (current - low) / range;
    
    if (positionInRange < 0.25) {
      analysis.pricePosition = 'near_support';
      analysis.risk = 'low_entry_risk';
    } else if (positionInRange < 0.5) {
      analysis.pricePosition = 'lower_half';
      analysis.risk = 'medium_entry_risk';
    } else if (positionInRange < 0.75) {
      analysis.pricePosition = 'upper_half';
      analysis.risk = 'medium_to_high_entry_risk';
    } else {
      analysis.pricePosition = 'near_resistance';
      analysis.risk = 'high_entry_risk';
    }
  }
  
  // Distance from ATH assessment
  if (distanceFromAth < 10) {
    analysis.athRisk = 'at_ath_or_very_close';
  } else if (distanceFromAth < 30) {
    analysis.athRisk = 'close_to_ath';
  } else if (distanceFromAth < 60) {
    analysis.athRisk = 'moderate_distance_from_ath';
  } else {
    analysis.athRisk = 'significant_distance_from_ath';
  }
  
  return analysis;
}

/**
 * Rate entry quality based on multiple factors
 */
function getEntryQuality(candidate) {
  const health = candidate.health || {};
  const chart = candidate.chart || {};
  const signals = candidate.signals || {};
  
  let score = 50;  // Base score
  
  // Grade factor (0-30 points)
  const gradeScore = {
    'A': 30,
    'B': 22,
    'C': 14,
    'D': 5,
  };
  score += gradeScore[health.grade] || 0;
  
  // Signal confirmation (0-20 points)
  const signalCount = [signals.hasFeeClaim, signals.hasGraduated, signals.hasTrending].filter(Boolean).length;
  score += signalCount * 7;  // Max 21, scales 7 per signal
  
  // Price position factor (0-20 points)
  const athWindow = chart.athContext24h;
  if (athWindow) {
    const current = athWindow.current || 0;
    const low = athWindow.low || current;
    const high = athWindow.high || current;
    
    if (high > 0) {
      const positionInRange = (current - low) / (high - low);
      if (positionInRange < 0.3) score += 20;
      else if (positionInRange < 0.5) score += 15;
      else if (positionInRange < 0.7) score += 10;
      else score += 5;
    }
  }
  
  // Volatility factor (0-10 points)
  const volatility = health.components?.volatility || 50;
  if (volatility >= 40 && volatility <= 70) {
    score += 10;  // Ideal volatility range
  } else if (volatility >= 30 && volatility <= 80) {
    score += 5;
  }
  
  // Cap at 100
  score = Math.min(100, score);
  
  return {
    score: Math.round(score),
    grade: getQualityGrade(score),
    factors: {
      health_grade: health.grade,
      signal_count: signalCount,
      volatility,
    },
  };
}

function getQualityGrade(score) {
  if (score >= 85) return 'EXCELLENT';
  if (score >= 70) return 'GOOD';
  if (score >= 55) return 'FAIR';
  if (score >= 40) return 'POOR';
  return 'VERY_POOR';
}

/**
 * Get entry recommendation
 */
function getEntryRecommendation(candidate) {
  const timing = analyzeTimingStrategy(candidate);
  const quality = getEntryQuality(candidate);
  const position = analyzePricePosition(candidate.chart?.athContext24h, candidate.chart?.rangeHighNative, candidate.chart?.distanceFromAthPercent);
  
  let recommendation = 'PASS';
  let confidence = 0;
  let reason = '';
  
  // Decision matrix
  if (quality.score >= 80 && timing.confidence >= 75) {
    recommendation = 'IMMEDIATE_ENTRY';
    confidence = Math.min(95, (quality.score + timing.confidence) / 2);
    reason = `Excellent entry: ${quality.grade} quality, ${timing.reason}`;
  } else if (quality.score >= 70 && timing.confidence >= 60) {
    recommendation = 'GOOD_ENTRY';
    confidence = (quality.score + timing.confidence) / 2;
    reason = `Good entry: ${quality.grade} quality, ${timing.reason}`;
  } else if (quality.score >= 60 && timing.strategy === 'scale_in') {
    recommendation = 'SCALE_IN';
    confidence = quality.score * 0.8;
    reason = `Scale in: ${quality.grade} quality, ${timing.reason}`;
  } else if (timing.strategy === 'wait_pullback') {
    recommendation = 'WAIT_PULLBACK';
    confidence = 50;
    reason = `${timing.reason}. Wait for pullback before entering.`;
  } else {
    recommendation = 'PASS';
    confidence = 0;
    reason = `Entry quality insufficient: ${quality.grade} (${quality.score}/100)`;
  }
  
  return {
    recommendation,
    confidence: Math.round(confidence),
    reason,
    timing_strategy: timing.strategy,
    price_position: position.pricePosition,
  };
}

/**
 * Calculate scale-in sizes for multi-leg entries
 * Returns array of {percentage, trigger, size_multiplier}
 */
export function calculateScaleInLevels(candidateSize, priceAction) {
  const levels = [];
  
  const athWindow = priceAction.athContext24h;
  if (!athWindow || !athWindow.low) return [{ percentage: 100, size_multiplier: candidateSize }];
  
  const low = athWindow.low;
  const current = athWindow.current;
  
  // Scale-in strategy: buy 40% at current, 30% at -5%, 30% at -10%
  levels.push({
    name: 'immediate',
    percentage: 40,
    trigger_price: current,
    trigger_percent_below_current: 0,
    size_multiplier: candidateSize * 0.4,
  });
  
  const level2 = current * 0.95;  // 5% pullback
  if (level2 >= low) {
    levels.push({
      name: 'pullback_5pct',
      percentage: 30,
      trigger_price: level2,
      trigger_percent_below_current: -5,
      size_multiplier: candidateSize * 0.3,
    });
  }
  
  const level3 = current * 0.90;  // 10% pullback
  if (level3 >= low) {
    levels.push({
      name: 'pullback_10pct',
      percentage: 30,
      trigger_price: level3,
      trigger_percent_below_current: -10,
      size_multiplier: candidateSize * 0.3,
    });
  }
  
  return levels;
}

/**
 * Adjust position size based on entry timing quality
 * Better entry timing allows larger positions
 */
export function adjustSizeByEntryTiming(baseSize, entryQuality, timing) {
  if (entryQuality.score < 40) return baseSize * 0.5;  // Poor entry - halve size
  if (entryQuality.score < 55) return baseSize * 0.7;  // Fair entry - 70%
  if (entryQuality.score < 70) return baseSize * 0.85; // Good entry - 85%
  if (entryQuality.score < 85) return baseSize;        // Excellent entry - full size
  return baseSize * 1.2;  // Outstanding entry - slight premium
}

/**
 * Estimate slippage based on timing and liquidity
 */
export function estimateSlippage(liquidityUsd, positionSize, entryTiming) {
  if (!liquidityUsd || liquidityUsd === 0) return 2.0;
  
  // Base slippage calculation
  const slippagePercent = (positionSize / liquidityUsd) * 100;
  
  // Adjust for timing quality
  let adjustedSlippage = slippagePercent;
  
  if (entryTiming.timing.strategy === 'wait_pullback') {
    adjustedSlippage *= 0.8;  // Better conditions expected
  } else if (entryTiming.timing.strategy === 'immediate') {
    adjustedSlippage *= 1.1;  // Higher slippage on immediate entry
  }
  
  // Cap slippage at reasonable levels
  return Math.min(5.0, Math.max(0.1, adjustedSlippage));
}

/**
 * Calculate optimal entry price with slippage
 */
export function calculateEntryPrice(currentPrice, slippagePercent, positionSize = 1) {
  const slippageMultiplier = 1 + (slippagePercent / 100);
  return currentPrice * slippageMultiplier;
}

/**
 * Determine if should wait for better entry
 */
export function shouldWaitForBetterEntry(candidate, riskScore, marketCondition = 'normal') {
  const recommendation = getEntryRecommendation(candidate);
  const health = candidate.health || {};
  const risks = candidate.risks || {};
  
  // If critical risks, wait
  const allRisks = [
    ...(risks.holderRisks || []),
    ...(risks.liquidityRisks || []),
    ...(risks.manipulationRisks || []),
    ...(risks.ageRisks || []),
    ...(risks.signalRisks || []),
  ];
  const criticalCount = allRisks.filter(r => r.severity === 'CRITICAL').length;
  
  if (criticalCount > 0) {
    return { shouldWait: true, reason: 'Critical risks detected' };
  }
  
  // Wait if poor entry quality
  if (recommendation.recommendation === 'WAIT_PULLBACK') {
    return { shouldWait: true, reason: recommendation.reason };
  }
  
  // Wait if market condition is adverse
  if (marketCondition === 'high_volatility' && health.components?.volatility > 80) {
    return { shouldWait: true, reason: 'Extreme volatility detected' };
  }
  
  // Otherwise, proceed
  return { shouldWait: false, reason: 'Entry conditions acceptable' };
}
