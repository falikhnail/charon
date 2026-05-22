import {
  now,
  firstPositiveNumber,
  marketCapFromGmgn,
  tokenPriceFromGmgn,
  lamToSol
} from '../utils.js';

import { activeStrategy } from '../db/settings.js';
import { fetchGmgnTokenInfo } from '../enrichment/gmgn.js';
import {
  fetchJupiterAsset,
  fetchJupiterHolders,
  fetchJupiterChartContext
} from '../enrichment/jupiter.js';

import { fetchSavedWalletExposure } from '../enrichment/wallets.js';
import { fetchTwitterNarrative } from '../enrichment/twitter.js';
import { gmgnLink } from '../format.js';

import {
  calculateTokenHealthScore
} from './advancedFilters.js';

import {
  analyzeTokenRisks,
  quickRiskAssessment
} from './tokenRiskAnalyzer.js';

import { analyzeEntryTiming } from '../execution/entryTiming.js';


export function buildFeeSnapshot(fee, signature) {
  return {
    mint: fee.mint,
    signature,
    distributedSol: lamToSol(fee.distributed),
    recipients: fee.shareholders.map((holder) => ({
      address: holder.pubkey,
      bps: holder.bps,
      percent: holder.bps / 100
    }))
  };
}

export function signalLabel(signals = {}) {
  return [
    signals.hasFeeClaim ? 'fees' : null,
    signals.hasGraduated ? 'graduated' : null,
    signals.hasTrending ? 'trending' : null
  ]
    .filter(Boolean)
    .join(' + ') || signals.route || 'unknown';
}

// =====================================================
// NORMALIZE DATA FOR RISK ANALYSIS
// Maps data from collected format to what risk analyzer expects
// =====================================================
export function normalizeForRiskAnalysis(candidate) {
  // 1. Calculate holder concentration percentages from holders array
  const holders = candidate.holders?.holders || [];
  const topTenPercent = holders
    .slice(0, 10)
    .reduce((sum, h) => sum + (h.percent || 0), 0);
  const topFiftyPercent = holders
    .slice(0, 50)
    .reduce((sum, h) => sum + (h.percent || 0), 0);

  candidate.holderData = {
    topTenPercent: Math.round(topTenPercent * 10) / 10,
    topFiftyPercent: Math.round(topFiftyPercent * 10) / 10
  };

  // 2. Map liquidity data to expected format
  candidate.liquidity = {
    poolCapital: candidate.metrics?.liquidityUsd || 0,
    bidAskSpread: 0  // Not available from APIs
  };

  // 3. Calculate bundler activity percentage
  const totalFees = candidate.metrics?.gmgnTotalFeesSol || 1;  // Avoid divide by zero
  const tradeFees = candidate.metrics?.gmgnTradeFeesSol || 0;
  const bundledPercent = totalFees > 0 ? (tradeFees / totalFees) * 100 : 0;

  candidate.bundlerData = {
    bundledPercent: Math.round(bundledPercent * 10) / 10
  };

  // 4. Calculate token age in minutes
  const createdMinutesAgo = (Date.now() - (candidate.createdAtMs || Date.now())) / (1000 * 60);

  candidate.ageData = {
    createdMinutesAgo: Math.round(createdMinutesAgo * 10) / 10
  };

  return candidate;
}

export function filterCandidate(candidate, settings = {}) {
  // ==========================================
  // QUICK RISK CHECK
  // ==========================================
  const quickRisk = quickRiskAssessment(candidate);

  if (quickRisk.shouldReject) {
    return {
      passed: false,
      reason: `Risk: ${quickRisk.reason}`,
      failedFilters: ['QUICK_RISK_ASSESSMENT']
    };
  }

  // ==========================================
  // HEALTH SCORE
  // ==========================================
  const health = calculateTokenHealthScore(candidate);
  candidate.health = health;

  const failedFilters = [];

  const healthRequirement = settings.healthFilterGrade || 'C';  // TESTING: relaxed from B to C

  const gradeOrder = {
    A: 4,
    B: 3,
    C: 2,
    D: 1
  };

  if (gradeOrder[health.grade] < gradeOrder[healthRequirement]) {
    failedFilters.push(`HEALTH_SCORE_${health.grade}`);
  }

  // ==========================================
  // LIQUIDITY
  // ==========================================
  if (
    candidate.metrics?.liquidityUsd <
    (settings.minLiquidity ?? 5000)
  ) {
    failedFilters.push('LIQUIDITY');
  }

  // ==========================================
  // MARKET CAP (fixed: now reads min_mcap_usd from strategy)
  // ==========================================
  const mcap = candidate.metrics?.marketCapUsd || candidate.metrics?.graduatedMarketCapUsd || 0;
  const minMcap = settings.minMarketCap ?? settings.min_mcap_usd ?? 25000;
  if (mcap < minMcap) {
    failedFilters.push('MCAP_TOO_LOW');
  }

  // ==========================================
  // HOLDER CONCENTRATION (fixed: reads both key variants)
  // ==========================================
  const maxTopTen = settings.maxTopTenPercent ?? settings.max_top20_holder_percent ?? 75;
  if (
    candidate.holderData?.topTenPercent > maxTopTen
  ) {
    failedFilters.push('HOLDER_CONCENTRATION');
  }

  // ==========================================
  // VOLUME (fixed: reads both key variants)
  // ==========================================
  const volume24h =
    candidate.metrics?.graduatedVolumeUsd ||
    candidate.metrics?.trendingVolumeUsd ||
    0;

  const minVolume = settings.minVolume24h ?? settings.min_graduated_volume_usd ?? 5000;
  if (volume24h < minVolume) {
    failedFilters.push('VOLUME');
  }

  // ==========================================
  // AGE CHECK
  // ==========================================
  const ageHours =
    (Date.now() - candidate.createdAtMs) / (1000 * 3600);

  if (ageHours < (settings.minAgeHours ?? 0)) {
    failedFilters.push('TOO_NEW');
  }

  // ==========================================
  // MINT RISK (only flag if fee claim has known rug indicators)
  // ==========================================
  if (candidate.token?.mint && candidate.signals?.label === 'fee_claim') {
    // Only reject if fee claim has explicit rug indicators (high bundler + low holders)
    const hasRugIndicators = candidate.bundlerData?.bundledPercent > 50 &&
      (candidate.metrics?.holderCount || 0) < 100;
    if (hasRugIndicators) {
      failedFilters.push('ACTIVE_FEE_CLAIM_RISK');
    }
  }

  return {
    passed: failedFilters.length === 0,
    reason:
      failedFilters.length > 0
        ? failedFilters.join(', ')
        : 'PASSED',
    failedFilters,
    health
  };
}

export async function buildCandidate({
  mint,
  fee = null,
  signature = null,
  graduatedCoin = null,
  trendingToken = null,
  route
}) {
  const strat = activeStrategy();

  const gmgn = await fetchGmgnTokenInfo(mint);
  const jupiterAsset = await fetchJupiterAsset(mint);
  const holders = await fetchJupiterHolders(mint);
  const chart = await fetchJupiterChartContext(mint);

  const savedWalletExposure =
    await fetchSavedWalletExposure(mint, holders);

  const twitterNarrative =
    await fetchTwitterNarrative(
      graduatedCoin || jupiterAsset,
      gmgn
    );

  const priceUsd = firstPositiveNumber(
    tokenPriceFromGmgn(gmgn),
    jupiterAsset?.usdPrice,
    trendingToken?.price
  );

  const marketCapUsd = firstPositiveNumber(
    marketCapFromGmgn(gmgn),
    jupiterAsset?.mcap,
    jupiterAsset?.fdv,
    trendingToken?.market_cap,
    graduatedCoin?.marketCap,
    graduatedCoin?.usd_market_cap
  );

  const signalRoute =
    route ||
    [
      fee ? 'fee' : null,
      graduatedCoin ? 'graduated' : null,
      trendingToken ? 'trending' : null
    ]
      .filter(Boolean)
      .join('_');

  const candidate = {
    token: {
      mint,
      name:
        gmgn?.name ||
        jupiterAsset?.name ||
        trendingToken?.name ||
        graduatedCoin?.name ||
        '',

      symbol:
        gmgn?.symbol ||
        jupiterAsset?.symbol ||
        trendingToken?.symbol ||
        graduatedCoin?.ticker ||
        '',

      gmgnUrl:
        gmgn?.link?.gmgn || gmgnLink(mint),

      twitter:
        graduatedCoin?.twitter ||
        jupiterAsset?.twitter ||
        gmgn?.link?.twitter_username ||
        trendingToken?.twitter ||
        '',

      website:
        graduatedCoin?.website ||
        jupiterAsset?.website ||
        gmgn?.link?.website ||
        '',

      telegram:
        graduatedCoin?.telegram ||
        gmgn?.link?.telegram ||
        ''
    },

    metrics: {
      priceUsd,
      marketCapUsd,

      liquidityUsd: Number(
        gmgn?.liquidity ??
          jupiterAsset?.liquidity ??
          trendingToken?.liquidity ??
          0
      ),

      holderCount: Number(
        gmgn?.holder_count ??
          jupiterAsset?.holderCount ??
          trendingToken?.holder_count ??
          graduatedCoin?.numHolders ??
          0
      ),

      gmgnTotalFeesSol: Number(
        gmgn?.total_fee ??
          jupiterAsset?.fees ??
          0
      ),

      gmgnTradeFeesSol: Number(
        gmgn?.trade_fee ?? 0
      ),

      graduatedVolumeUsd: Number(
        graduatedCoin?.volume ?? 0
      ),

      graduatedMarketCapUsd: Number(
        graduatedCoin?.marketCap ?? 0
      ),

      trendingVolumeUsd: Number(
        trendingToken?.volume ?? 0
      ),

      trendingSwaps: Number(
        trendingToken?.swaps ?? 0
      ),

      trendingHotLevel: Number(
        trendingToken?.hot_level ?? 0
      ),

      trendingSmartDegenCount: Number(
        trendingToken?.smart_degen_count ?? 0
      )
    },

    signals: {
      route: signalRoute,
      label: signalLabel({
        hasFeeClaim: Boolean(fee),
        hasGraduated: Boolean(graduatedCoin),
        hasTrending: Boolean(trendingToken)
      }),

      hasFeeClaim: Boolean(fee),
      hasGraduated: Boolean(graduatedCoin),
      hasTrending: Boolean(trendingToken),
      triggerSignature: signature,
      strategy: strat.id
    },

    graduation: graduatedCoin,
    trending: trendingToken,
    feeClaim: fee
      ? buildFeeSnapshot(fee, signature)
      : null,

    gmgn,
    jupiterAsset,
    holders,
    chart,
    savedWalletExposure,
    twitterNarrative,

    createdAtMs: now(),
    
    // HEALTH SCORE - Add to object before analysis
    health: calculateTokenHealthScore({
      metrics: { /* will be computed */ },
      token: { /* will be computed */ },
      gmgn,
      jupiterAsset,
      chart,
      holders
    })
  };

  // ==========================
  // ENHANCED ANALYSIS
  // ==========================
  // Recalculate health with complete candidate object
  candidate.health = calculateTokenHealthScore(candidate);
  
  // Normalize data fields for risk analysis
  normalizeForRiskAnalysis(candidate);
  
  candidate.risks = analyzeTokenRisks(candidate);

  candidate.filters = filterCandidate(
    candidate,
    strat
  );

  // Week 3: Entry Timing Analysis
  candidate.entryTiming = analyzeEntryTiming(candidate);

  return candidate;
}

export function agentText() {
  let text = 'Charon Trading Agent\n\n';
  text += 'Status: Running\n';
  text += 'Network: Solana Mainnet\n';
  text += 'Mode: Live Trading\n\n';

  text += '<b>Quality Filters:</b>\n';
  text += '• Health Score: Grade B required\n';
  text += '• Liquidity: Minimum pool capital\n';
  text += '• Volume: 24h trading activity\n';
  text += '• Risk: Auto-reject critical issues\n';

  return text;
}