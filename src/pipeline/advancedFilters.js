// Paste code ini ke file baru src/pipeline/advancedFilters.js
export function calculateTokenHealthScore(candidate, context = {}) {
  const components = {
    liquidity: calculateLiquidityScore(candidate),
    holders: calculateHolderScore(candidate),
    feeClaim: calculateFeeClaimScore(candidate),
    agePhase: calculateAgePhaseScore(candidate),
    volumeVelocity: calculateVolumeVelocityScore(candidate),
    bundlerBurden: calculateBundlerBurdenScore(candidate),
    volatility: calculateVolatilityScore(candidate),
    twitter: calculateTwitterScore(candidate)
  };

  // Weights: total = 1.0
  const weights = {
    liquidity: 0.12,
    holders: 0.14,
    feeClaim: 0.13,
    agePhase: 0.13,
    volumeVelocity: 0.12,
    bundlerBurden: 0.12,
    volatility: 0.11,
    twitter: 0.03
  };

  const score = Object.entries(components).reduce((sum, [key, value]) => {
    return sum + (value * weights[key]);
  }, 0);

  const grade = getGrade(score);
  const risks = identifyRisks(candidate, components);
  const warnings = identifyWarnings(candidate, components);
  const recommendation = getRecommendation(score, risks);

  return {
    score: Math.round(score),
    grade,
    components,
    risks,
    warnings,
    recommendation,
    emoji: getGradeEmoji(grade)
  };
}

function calculateLiquidityScore(candidate) {
  if (!candidate.liquidity) return 30;
  const pc = candidate.liquidity.poolCapital || 0;
  if (pc < 10000) return 20;
  if (pc < 50000) return 40;
  if (pc < 100000) return 60;
  if (pc < 500000) return 80;
  return 95;
}

function calculateHolderScore(candidate) {
  if (!candidate.holders || !candidate.holderData) return 40;
  const topTenPercent = candidate.holderData.topTenPercent || 0;
  if (topTenPercent > 80) return 10;
  if (topTenPercent > 60) return 30;
  if (topTenPercent > 40) return 60;
  if (topTenPercent > 20) return 85;
  return 95;
}

function calculateFeeClaimScore(candidate) {
  if (!candidate.feeClaim) return 50;
  const isActive = candidate.feeClaim.isActive || false;
  const daysInactive = candidate.feeClaim.daysInactiveClaimBuffer || 0;
  if (!isActive) return 85;
  if (daysInactive > 180) return 75;
  if (daysInactive > 90) return 60;
  if (daysInactive > 30) return 40;
  return 20;
}

function calculateAgePhaseScore(candidate) {
  if (!candidate.createdAt) return 50;
  const ageSeconds = (Date.now() - candidate.createdAt) / 1000;
  const ageHours = ageSeconds / 3600;
  if (ageHours < 1) return 30;
  if (ageHours < 6) return 50;
  if (ageHours < 24) return 70;
  if (ageHours < 168) return 85;
  return 95;
}

function calculateVolumeVelocityScore(candidate) {
  if (!candidate.volume24h) return 40;
  const vol = candidate.volume24h;
  if (vol < 1000) return 25;
  if (vol < 10000) return 45;
  if (vol < 100000) return 70;
  if (vol < 1000000) return 85;
  return 95;
}

function calculateBundlerBurdenScore(candidate) {
  if (!candidate.bundlerData) return 70;
  const bundledPercent = candidate.bundlerData.bundledPercent || 0;
  if (bundledPercent > 80) return 10;
  if (bundledPercent > 60) return 30;
  if (bundledPercent > 40) return 60;
  if (bundledPercent > 20) return 80;
  return 90;
}

function calculateVolatilityScore(candidate) {
  if (!candidate.priceHistory || candidate.priceHistory.length < 2) return 50;
  const prices = candidate.priceHistory.map(p => p.price);
  const mean = prices.reduce((a, b) => a + b) / prices.length;
  const variance = prices.reduce((a, p) => a + Math.pow(p - mean, 2), 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  const cv = (stdDev / mean) * 100;
  if (cv > 200) return 15;
  if (cv > 100) return 35;
  if (cv > 50) return 60;
  if (cv > 25) return 80;
  return 90;
}

function calculateTwitterScore(candidate) {
  if (!candidate.twitterData) return 40;
  const followers = candidate.twitterData.followers || 0;
  const engagement = candidate.twitterData.engagementRate || 0;
  let score = 40;
  if (followers > 100000) score += 30;
  else if (followers > 10000) score += 15;
  else if (followers > 1000) score += 5;
  if (engagement > 10) score += 15;
  else if (engagement > 5) score += 8;
  return Math.min(score, 100);
}

export function identifyRisks(candidate, components) {
  const risks = [];
  if (components.holders < 30) {
    risks.push({
      level: 'CRITICAL',
      message: 'Extreme holder concentration - rug pull risk',
      action: 'REJECT'
    });
  }
  if (components.bundlerBurden < 25) {
    risks.push({
      level: 'CRITICAL',
      message: 'Heavy bundler pressure - manipulation likely',
      action: 'REJECT'
    });
  }
  if (components.liquidity < 25) {
    risks.push({
      level: 'HIGH',
      message: 'Insufficient liquidity - exit risk',
      action: 'REJECT'
    });
  }
  if (components.volumeVelocity < 20) {
    risks.push({
      level: 'HIGH',
      message: 'Extremely low volume - illiquid',
      action: 'REJECT'
    });
  }
  if (components.volatility < 25) {
    risks.push({
      level: 'MEDIUM',
      message: 'Extreme volatility - uncontrollable risk'
    });
  }
  if (components.feeClaim < 25 && candidate.feeClaim?.isActive) {
    risks.push({
      level: 'MEDIUM',
      message: 'Active fee claim - regular income for creators'
    });
  }
  return risks;
}

export function identifyWarnings(candidate, components) {
  const warnings = [];
  if (components.agePhase < 40) {
    warnings.push('⚠️ Very new token - unproven');
  }
  if (components.liquidity < 50) {
    warnings.push('⚠️ Low liquidity - slippage risk');
  }
  if (components.holders < 60) {
    warnings.push('⚠️ Concentrated holders - watch carefully');
  }
  if (components.twitter < 30) {
    warnings.push('⚠️ Minimal Twitter presence');
  }
  return warnings;
}

export function getGrade(score) {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 45) return 'C';
  return 'D';
}

export function getRecommendation(score, risks) {
  const criticalRisks = risks.filter(r => r.level === 'CRITICAL');
  if (criticalRisks.some(r => r.action === 'REJECT')) return 'REJECT';
  if (score >= 80) return 'STRONG_BUY';
  if (score >= 65) return 'BUY';
  if (score >= 50) return 'HOLD';
  if (score >= 35) return 'CAUTION';
  return 'REJECT';
}

export function getGradeEmoji(grade) {
  const emojis = { A: '🟢', B: '🟡', C: '🟠', D: '🔴' };
  return emojis[grade] || '⚪';
}