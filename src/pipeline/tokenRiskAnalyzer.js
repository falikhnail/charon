// Paste ke file baru: src/pipeline/tokenRiskAnalyzer.js
export function analyzeTokenRisks(candidate) {
  const risks = {
    holderRisks: analyzeHolderRisks(candidate),
    liquidityRisks: analyzeLiquidityRisks(candidate),
    manipulationRisks: analyzeManipulationRisks(candidate),
    ageRisks: analyzeAgeRisks(candidate),
    signalRisks: analyzeSignalRisks(candidate)
  };
  
  // Calculate risk factor score from the risks we just gathered
  const allRisksList = [
    ...risks.holderRisks,
    ...risks.liquidityRisks,
    ...risks.manipulationRisks,
    ...risks.ageRisks,
    ...risks.signalRisks
  ];
  
  const criticalCount = allRisksList.filter(r => r.severity === 'CRITICAL').length;
  const highCount = allRisksList.filter(r => r.severity === 'HIGH').length;
  const mediumCount = allRisksList.filter(r => r.severity === 'MEDIUM').length;
  
  risks.riskFactor = Math.min(
    Math.round(criticalCount * 35 + highCount * 20 + mediumCount * 8),
    100
  );
  
  return risks;
}

function analyzeHolderRisks(candidate) {
  const risks = [];
  if (!candidate.holderData) return risks;
  
  const { topTenPercent, topFiftyPercent } = candidate.holderData;
  if (topTenPercent && topTenPercent > 75) {
    risks.push({
      name: 'EXTREME_CONCENTRATION',
      severity: 'CRITICAL',
      description: `Top 10 holders own ${topTenPercent}% - severe rug risk`,
      threshold: 75,
      actual: topTenPercent
    });
  }
  if (topFiftyPercent && topFiftyPercent > 90) {
    risks.push({
      name: 'HIGH_CONCENTRATION',
      severity: 'HIGH',
      description: `Top 50 holders own ${topFiftyPercent}%`,
      threshold: 90,
      actual: topFiftyPercent
    });
  }
  return risks;
}

function analyzeLiquidityRisks(candidate) {
  const risks = [];
  if (!candidate.liquidity) return risks;
  
  const pc = candidate.liquidity.poolCapital || 0;
  if (pc < 5000) {
    risks.push({
      name: 'CRITICAL_LOW_LIQUIDITY',
      severity: 'CRITICAL',
      description: `Pool capital $${pc} - cannot support trading`,
      threshold: 5000,
      actual: pc
    });
  }
  if (pc < 20000) {
    risks.push({
      name: 'THIN_ORDERBOOK',
      severity: 'HIGH',
      description: `Pool capital $${pc} - high slippage expected`,
      threshold: 20000,
      actual: pc
    });
  }
  
  const spread = candidate.liquidity.bidAskSpread || 0;
  if (spread > 5) {
    risks.push({
      name: 'WIDE_SPREAD',
      severity: 'MEDIUM',
      description: `Bid-ask spread ${spread}% - poor fill quality`,
      threshold: 5,
      actual: spread
    });
  }
  return risks;
}

function analyzeManipulationRisks(candidate) {
  const risks = [];
  if (!candidate.bundlerData) return risks;
  
  const bundledPercent = candidate.bundlerData.bundledPercent || 0;
  if (bundledPercent > 70) {
    risks.push({
      name: 'HEAVY_BUNDLER_ACTIVITY',
      severity: 'CRITICAL',
      description: `${bundledPercent}% bundled - wash trading likely`,
      threshold: 70,
      actual: bundledPercent
    });
  }
  
  // Check volume spikes
  if (candidate.volume1h && candidate.volume24h) {
    const spikeRatio = candidate.volume1h / (candidate.volume24h / 24);
    if (spikeRatio > 5) {
      risks.push({
        name: 'VOLUME_SPIKE',
        severity: 'HIGH',
        description: `1h volume ${spikeRatio.toFixed(1)}x above average`,
        threshold: 5,
        actual: spikeRatio
      });
    }
  }
  return risks;
}

function analyzeAgeRisks(candidate) {
  const risks = [];
  if (!candidate.createdAt) return risks;
  
  const ageSeconds = (Date.now() - candidate.createdAt) / 1000;
  const ageHours = ageSeconds / 3600;
  const ageMinutes = ageSeconds / 60;
  
  if (ageMinutes < 5) {
    risks.push({
      name: 'ULTRA_NEW_LAUNCH',
      severity: 'CRITICAL',
      description: `Launched only ${ageMinutes.toFixed(0)} minutes ago - extremely risky`,
      threshold: 5,
      actual: ageMinutes,
      unit: 'minutes'
    });
  }
  
  if (ageHours < 1) {
    risks.push({
      name: 'VERY_NEW_LAUNCH',
      severity: 'HIGH',
      description: `Launched only ${ageHours.toFixed(2)} hours ago`,
      threshold: 1,
      actual: ageHours,
      unit: 'hours'
    });
  }
  return risks;
}

function analyzeSignalRisks(candidate) {
  const risks = [];
  
  // Check signal source confirmation (signals is an object with boolean flags)
  const signalCount = [
    candidate.signals?.hasFeeClaim,
    candidate.signals?.hasGraduated,
    candidate.signals?.hasTrending
  ].filter(Boolean).length;
  
  if (signalCount < 2) {
    risks.push({
      name: 'WEAK_SIGNAL_CONFIRMATION',
      severity: 'MEDIUM',
      description: `Only ${signalCount} signal source${signalCount === 1 ? '' : 's'} - needs multiple confirmations`,
      threshold: 2,
      actual: signalCount
    });
  }
  
  // Check trusted sources (graduated and trending are trusted)
  const trustedSources = [
    candidate.signals?.hasTrending,
    candidate.signals?.hasGraduated
  ].filter(Boolean).length;
  
  if (trustedSources === 0 && !candidate.signals?.hasFeeClaim) {
    risks.push({
      name: 'NO_TRUSTED_SOURCES',
      severity: 'HIGH',
      description: 'No trusted signal sources detected',
      threshold: 1,
      actual: trustedSources
    });
  }
  return risks;
}

export function getRiskFactorScore(candidate) {
  const allRisks = analyzeTokenRisks(candidate);
  const allRisksList = [
    ...allRisks.holderRisks,
    ...allRisks.liquidityRisks,
    ...allRisks.manipulationRisks,
    ...allRisks.ageRisks,
    ...allRisks.signalRisks
  ];
  
  const criticalCount = allRisksList.filter(r => r.severity === 'CRITICAL').length;
  const highCount = allRisksList.filter(r => r.severity === 'HIGH').length;
  const mediumCount = allRisksList.filter(r => r.severity === 'MEDIUM').length;
  
  // Score: lower is safer (0-100)
  let riskScore = 0;
  riskScore += criticalCount * 35;
  riskScore += highCount * 20;
  riskScore += mediumCount * 8;
  
  return Math.min(Math.round(riskScore), 100);
}

export function quickRiskAssessment(candidate) {
  const analysis = analyzeTokenRisks(candidate);
  const allRisks = [
    ...analysis.holderRisks,
    ...analysis.liquidityRisks,
    ...analysis.manipulationRisks,
    ...analysis.ageRisks,
    ...analysis.signalRisks
  ];
  
  const criticalRisks = allRisks.filter(r => r.severity === 'CRITICAL');
  return {
    shouldReject: criticalRisks.length > 0,
    reason: criticalRisks.length > 0 ? criticalRisks[0].description : null,
    riskCount: allRisks.length,
    criticalCount: criticalRisks.length
  };
}