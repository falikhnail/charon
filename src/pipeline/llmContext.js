/**
 * LLM Context Builder
 * Creates rich context from health scores and risk data for informed LLM decisions
 */

import { getGradeEmoji } from './advancedFilters.js';

/**
 * Build comprehensive candidate context for LLM decision-making
 * Includes health summary, risk context, and sizing guidance
 */
export function buildCandidateContext(candidate) {
  const health = candidate.health || {};
  const risks = candidate.risks || {};
  
  const healthSummary = formatHealthSummary(health);
  const riskContext = formatRiskContext(risks);
  const recommendationStrength = getRecommendationStrength(health, risks);
  const sizingGuidance = buildSizingGuidance(health, risks);
  
  return {
    healthSummary,
    riskContext,
    recommendationStrength,
    sizingGuidance,
    gradeEmoji: getGradeEmoji(health.grade),
    score: health.score,
    grade: health.grade,
  };
}

/**
 * Build system prompt with health data context and decision framework
 */
export function buildLLMSystemPrompt(context) {
  const healthStr = context.healthSummary || 'N/A';
  const riskStr = context.riskContext || 'N/A';
  const sizing = context.sizingGuidance || {};
  
  return [
    'You are Charon, a Solana meme coin analyst with quantified risk assessment and entry timing.',
    'Return strict JSON only.',
    'You receive candidates with comprehensive health scores, risk data, and price action context.',
    'Candidates are pre-filtered for basic quality; your role is final decision-making with timing awareness.',
    '',
    'HEALTH SCORE SYSTEM:',
    '  Grade A (80-100): Strong fundamentals, low risk - Normal to full position sizing',
    '  Grade B (60-79): Good fundamentals, moderate risk - 80% position sizing',
    '  Grade C (45-59): Risky fundamentals, needs caution - 40-50% position sizing',
    '  Grade D (<45): Poor fundamentals - ACCEPTABLE for OPPORTUNISTIC BUY if IMMEDIATE_ENTRY + strong volume',
    '',
    'ENTRY TIMING FRAMEWORK:',
    '  IMMEDIATE_ENTRY: Price near 24h low, strong fundamentals - enter full position',
    '  GOOD_ENTRY: Price in lower half of 24h range - enter full or near-full position',
    '  SCALE_IN: Price mid-range or pullback expected - consider 40% immediate, 60% scale',
    '  WAIT_PULLBACK: Price near 24h high - wait for 5-10% pullback or SKIP',
    '',
    'DECISION FRAMEWORK:',
    'Your job: Return BUY, WATCH, or PASS. Use BUY liberally for good timing+volume setups.',
    '',
    'Quick Decision Tree:',
    '  1. IMMEDIATE_ENTRY timing + volume > $15k → STRONG BUY signal (likely BUY verdict)',
    '  2. GOOD_ENTRY timing + volume > $10k + Grade C/D → BUY or WATCH (volume is key)',
    '  3. WAIT_PULLBACK timing → WATCH or PASS (avoid immediate entry)',
    '  4. Weak volume <$5k regardless of grade → PASS (insufficient liquidity)',
    '',
    'Use verdict BUY for asymmetric opportunities:',
    '  PRIMARY (confidence 75-100): Grade A/B with IMMEDIATE_ENTRY or GOOD_ENTRY timing + volume evidence',
    '  SECONDARY (confidence 50-75): Grade C with IMMEDIATE_ENTRY + strong volume + single signal',
    '  OPPORTUNISTIC (confidence 40-60): Grade D with IMMEDIATE_ENTRY + strong volume ($>15k) → YES, use BUY',
    '',
    'DECISION EXAMPLES:',
    '  ✓ Grade D + IMMEDIATE_ENTRY + $25k volume + trending signal → BUY (confidence 45%, size 0.2)',
    '  ✓ Grade D + GOOD_ENTRY + $20k volume + SINGLE SIGNAL is OK → BUY (confidence 40%, size 0.15)',
    '  ✓ Grade C + IMMEDIATE_ENTRY + $10k volume → BUY (confidence 60%)',  
    '  ✓ Grade D + GOOD_ENTRY but weak volume ($2k) → WATCH (not enough conviction)',
    '  ✗ Grade D + WAIT_PULLBACK → PASS (poor timing)',
    '',
    'NOTE: Single signal sources are acceptable for Grade D if volume/liquidity are strong.',
    'Use WATCH if timing is GOOD_ENTRY or SCALE_IN but grade is C/D and volume is weak ($<10k)',
    'Use PASS if WAIT_PULLBACK timing, very weak volume (<$5k), or multiple critical risks',
    '',
    'SIZING GUIDANCE (adjusted for entry timing):',
    `  - IMMEDIATE_ENTRY + Grade A: size_multiplier = 1.0-1.2 (premium entry)`,
    `  - GOOD_ENTRY + Grade B: size_multiplier = 0.8-1.0`,
    `  - SCALE_IN timing: reduce position 40% (40% now, 60% on pullback)`,
    `  - WAIT_PULLBACK: either PASS or WATCH (avoid immediate entry)`,
    `  - Critical risks detected: reduce by 50% or SKIP`,
    `  - High volatility (>75%): reduce by 20-40%`,
    `  - Thin liquidity (<$25k): reduce by 40%+`,
    '',
    'PRICE ACTION SIGNALS:',
    '  ✓ Price < 20% from 24h low = excellent entry',
    '  ✓ Price 20-50% from 24h low = good entry',
    '  ✓ Price 50-80% from 24h low = neutral, consider scale-in',
    '  ✗ Price > 80% from 24h low = wait for pullback',
    '',
    'RISK AWARENESS:',
    'Prioritize tokens with:',
    '  ✓ Distributed holder base (concentration <60%)',
    '  ✓ Adequate liquidity (>$25k minimum)',
    '  ✓ Reasonable volatility (40-70%)',
    '  ✓ Clean fee history (low bundler burden)',
    '  ✓ Optimal entry timing (IMMEDIATE or GOOD entry)',
    '',
    'Avoid tokens with:',
    '  ✗ Holder concentration >75% (pump & dump risk)',
    '  ✗ Thin liquidity <$5k (extreme slippage)',
    '  ✗ Very new (<5 min, <15 min if no confirmed signals)',
    '  ✗ Multiple critical risks (manipulation, insider activity)',
    '  ✗ Dead twitter or no narrative',
    '  ✗ Poor entry timing (WAIT_PULLBACK strategy)',
    '',
    'Your confidence reflects your conviction, not probability.',
    'Size_multiplier output guides how much to risk on this pick.',
    'Consider timing_strategy in your decision - poor timing warrants smaller sizes or PASS.',
  ].join('\n');
}

/**
 * Build user prompt with specific candidate data and JSON format request
 */
export function buildLLMUserPrompt(candidate, context) {
  const mint = candidate.token?.mint || 'unknown';
  const signals = candidate.signals || {};
  const signalCount = [signals.hasFeeClaim, signals.hasGraduated, signals.hasTrending].filter(Boolean).length;
  const entryTiming = candidate.entryTiming || {};
  
  const userMessage = {
    task: 'Analyze this candidate with quantified health data and entry timing, make a BUY/WATCH/PASS decision.',
    candidate_summary: {
      mint,
      signal_sources: `${signalCount}/3 (feeClaim: ${signals.hasFeeClaim ? '✓' : '✗'}, graduated: ${signals.hasGraduated ? '✓' : '✗'}, trending: ${signals.hasTrending ? '✓' : '✗'})`,
      health_grade: `${context.gradeEmoji} ${context.grade}`,
      health_score: context.score,
      age_minutes: candidate.metrics?.ageMinutes || 'unknown',
      liquidity_usd: candidate.metrics?.liquidityUsd ? `$${Math.round(candidate.metrics.liquidityUsd)}` : 'unknown',
    },
    health_breakdown: {
      components: context.healthSummary,
      recommendation: context.recommendationStrength,
    },
    risk_assessment: context.riskContext,
    entry_timing: {
      strategy: entryTiming.timing?.strategy || 'unknown',
      confidence: entryTiming.timing?.confidence || 0,
      reason: entryTiming.timing?.reason || 'no timing data',
      price_position: entryTiming.pricePosition?.pricePosition || 'unknown',
      distance_from_ath_percent: candidate.chart?.distanceFromAthPercent || 0,
      entry_quality: entryTiming.entryQuality?.grade || 'UNKNOWN',
      entry_quality_score: entryTiming.entryQuality?.score || 0,
      recommendation: entryTiming.recommendation?.recommendation || 'PASS',
      timing_reason: entryTiming.recommendation?.reason || 'insufficient data',
    },
    sizing_guidance: {
      recommended_multiplier: context.sizingGuidance?.sizeMultiplier || 0,
      confidence_level: context.sizingGuidance?.confidence || 0,
      stop_loss_percent: context.sizingGuidance?.slPercentage || -12,
      take_profit_percent: context.sizingGuidance?.tpPercentage || 20,
      max_loss_per_position: '$25-50 per position (adjust based on account size)',
    },
    output_schema: {
      verdict: 'BUY (only for best opportunity), WATCH (interesting but wait), or PASS (weak/risky)',
      selected_candidate_id: 'copy candidate ID if BUY, else null',
      selected_mint: 'copy mint if BUY, else null',
      confidence: 'your conviction 0-100 (not probability)',
      reason: 'one sentence summary of decision',
      risks: ['list up to 3 specific risks to monitor'],
      suggested_tp_percent: 'positive number for take profit target',
      suggested_sl_percent: 'negative number for stop loss',
      size_multiplier: 'decimal 0.0-1.0 for position size adjustment based on health/risk/timing',
      suggested_entry_strategy: 'IMMEDIATE, SCALE_IN, or WAIT_PULLBACK based on timing analysis',
    },
  };
  
  return userMessage;
}

/**
 * Format health score breakdown for display
 */
function formatHealthSummary(health) {
  const components = health.components || {};
  
  return {
    grade: health.grade,
    score: health.score,
    breakdown: {
      liquidity: `${components.liquidity?.toFixed(0) || '0'}/100 - Market depth`,
      holders: `${components.holders?.toFixed(0) || '0'}/100 - Distribution`,
      feeClaim: `${components.feeClaim?.toFixed(0) || '0'}/100 - Fee history`,
      agePhase: `${components.agePhase?.toFixed(0) || '0'}/100 - Launch phase`,
      volumeVelocity: `${components.volumeVelocity?.toFixed(0) || '0'}/100 - Trading activity`,
      bundlerBurden: `${components.bundlerBurden?.toFixed(0) || '0'}/100 - Bundler activity`,
      volatility: `${components.volatility?.toFixed(0) || '0'}/100 - Price swings`,
      twitter: `${components.twitter?.toFixed(0) || '0'}/100 - Social presence`,
    },
  };
}

/**
 * Format risk context for display
 */
function formatRiskContext(risks) {
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
  
  const topRisks = allRisks
    .sort((a, b) => {
      const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    })
    .slice(0, 3);
  
  return {
    critical_count: criticalCount,
    high_count: highCount,
    medium_count: mediumCount,
    risk_factor: `${risks.riskFactor?.toFixed(0) || '0'}/100`,
    top_risks: topRisks.map(r => `${r.severity}: ${r.description}`),
    risk_severity: formatRiskSeverity(criticalCount, highCount, mediumCount),
  };
}

function formatRiskSeverity(critical, high, medium) {
  if (critical > 0) return '🔴 CRITICAL - Major red flags, high caution';
  if (high > 1) return '🔴 HIGH - Multiple significant risks';
  if (high > 0) return '🟠 ELEVATED - Considerable risk';
  if (medium > 2) return '🟠 MODERATE - Several concerns';
  if (medium > 0) return '🟡 MILD - Some caution needed';
  return '🟢 LOW - Well-vetted candidate';
}

/**
 * Get recommendation strength, adjusted by critical risks
 */
function getRecommendationStrength(health, risks) {
  const recommendation = health.recommendation || 'HOLD';
  const criticalCount = risks.criticalCount || 0;
  
  // Override to CAUTION if critical risks found
  if (criticalCount > 0 && recommendation !== 'REJECT') {
    return 'CAUTION';
  }
  
  return recommendation;
}

/**
 * Build sizing guidance from health scores and risk data
 */
function buildSizingGuidance(health, risks) {
  const grade = health.grade || 'D';
  const riskFactor = risks.riskFactor || 0;  // 0-100
  
  // Grade-based allocation
  // FIX: Grade D now has 0.2 base allocation for OPPORTUNISTIC entries with good timing/volume
  const gradeMultiplier = {
    'A': 1.0,
    'B': 0.8,
    'C': 0.5,
    'D': 0.2,  // Changed from 0.0 to allow Grade D opportunistic entries
  };
  
  let sizeMultiplier = gradeMultiplier[grade] || 0;
  
  // Risk factor reduction (0-100 scale)
  // At 100 risk, reduce by 50%
  // At 50 risk, reduce by 25%
  const riskReduction = (riskFactor / 100) * 0.5;
  sizeMultiplier *= Math.max(0, 1 - riskReduction);
  
  // Check for critical risks - zero them out
  const allRisks = [
    ...(risks.holderRisks || []),
    ...(risks.liquidityRisks || []),
    ...(risks.manipulationRisks || []),
    ...(risks.ageRisks || []),
    ...(risks.signalRisks || []),
  ];
  const criticalCount = allRisks.filter(r => r.severity === 'CRITICAL').length;
  if (criticalCount > 0) {
    sizeMultiplier = 0;
  }
  
  const confidence = getConfidenceLevel(grade, riskFactor);
  const slPercent = getStopLossPercentage(grade, riskFactor);
  const tpPercent = getTakeProfitPercentage(grade, health.components?.volatility || 50);
  
  return {
    sizeMultiplier: Math.max(0, Math.min(1, sizeMultiplier)),
    gradeAllocation: gradeMultiplier,
    confidence,
    slPercentage: slPercent,
    tpPercentage: tpPercent,
    riskRating: getRiskRating(riskFactor),
  };
}

function getConfidenceLevel(grade, riskFactor) {
  const baseConfidence = {
    'A': 90,
    'B': 70,
    'C': 40,
    'D': 10,
  };
  
  let confidence = baseConfidence[grade] || 0;
  
  // Reduce by risk factor
  const riskPenalty = (riskFactor / 100) * 30;  // Up to 30% reduction
  confidence -= riskPenalty;
  
  return Math.max(0, confidence);
}

function getStopLossPercentage(grade, riskFactor) {
  const baseSL = {
    'A': -15,
    'B': -12,
    'C': -8,
    'D': -5,
  };
  
  let sl = baseSL[grade] || -12;
  
  // Tighten by risk factor (more negative = tighter)
  const riskTightening = (riskFactor / 100) * 5;  // Up to 5% tighter
  sl = Math.min(sl, sl - riskTightening);  // More negative
  
  return sl;
}

function getTakeProfitPercentage(grade, volatility) {
  const baseTP = {
    'A': 20,
    'B': 16,
    'C': 12,
    'D': 8,
  };
  
  let tp = baseTP[grade] || 15;
  
  // Volatility adjustment
  if (volatility > 75) {
    tp *= 1.4;   // 40% wider for high volatility
  } else if (volatility > 60) {
    tp *= 1.2;   // 20% wider
  } else if (volatility < 40) {
    tp *= 0.8;   // 20% tighter for low volatility
  }
  
  return Math.round(tp);
}

function getRiskRating(riskFactor) {
  if (riskFactor > 80) return 'EXTREME';
  if (riskFactor > 60) return 'HIGH';
  if (riskFactor > 40) return 'MODERATE';
  if (riskFactor > 20) return 'MILD';
  return 'LOW';
}

