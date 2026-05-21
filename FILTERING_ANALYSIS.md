# FILTERING LOGIC ANALYSIS & ROADMAP

## Current Status: 250 Candidates
- ✅ **PASSED**: 130 (52%)
- ❌ **FAILED**: 120 (48%)

---

## CURRENT FILTERING LOGIC (filterCandidate function)

### 1. **QUICK RISK ASSESSMENT** ⚠️ NOT WORKING
```javascript
const quickRisk = quickRiskAssessment(candidate);
if (quickRisk.shouldReject) {
  return { passed: false, reason: `Risk: ${quickRisk.reason}` };
}
```
**Status**: Function exists but `candidate.holderData` is undefined
**Impact**: Risk rejection not triggering

---

### 2. **HEALTH SCORE** ✅ WORKING
```javascript
const health = calculateTokenHealthScore(candidate);
const healthRequirement = settings.healthFilterGrade || 'B';  // Default: Grade B
```
**Current Threshold**: Grade B or better (rejects Grade C, D)
**Example Pass**: Grade B + good metrics
**Example Fail**: `HEALTH_SCORE_D` rejection for low-quality tokens

---

### 3. **LIQUIDITY CHECK** ✅ WORKING
```javascript
if (candidate.metrics?.liquidityUsd < (settings.minLiquidity ?? 10000)) {
  failedFilters.push('LIQUIDITY');
}
```
**Current Threshold**: $10,000 USD minimum
**Status**: Using database setting (minLiquidity from strategy config)
**Working**: ✅ Yes - liquidityUsd properly populated in metrics

---

### 4. **HOLDER CONCENTRATION** ❌ BROKEN
```javascript
if (candidate.holders?.topTenPercent > (settings.maxTopTenPercent ?? 75)) {
  failedFilters.push('HOLDER_CONCENTRATION');
}
```
**Current Threshold**: Top 10 holders > 75% = FAIL
**Problem**: `candidate.holders.topTenPercent` is UNDEFINED
**Why**: Data stored as `candidate.holders.holders[].percent` array, not pre-calculated
**Impact**: rug risk detection NOT triggering for high-concentration tokens

---

### 5. **VOLUME CHECK** ✅ WORKING
```javascript
const volume24h = 
  candidate.metrics?.graduatedVolumeUsd ||
  candidate.metrics?.trendingVolumeUsd || 0;

if (volume24h < (settings.minVolume24h ?? 1000)) {
  failedFilters.push('VOLUME');
}
```
**Current Threshold**: $1,000 USD minimum
**Status**: Using database setting (minVolume24h from strategy config)
**Working**: ✅ Yes - volume metrics properly populated

---

### 6. **AGE CHECK** ✅ WORKING
```javascript
const ageHours = (Date.now() - candidate.createdAtMs) / (1000 * 3600);
if (ageHours < (settings.minAgeHours ?? 0.5)) {
  failedFilters.push('TOO_NEW');
}
```
**Current Threshold**: 0.5 hours (30 minutes) minimum
**Status**: Configurable via database, nullish coalescing working
**Working**: ✅ Yes - createdAtMs available

---

## FAILURE BREAKDOWN (120 failed candidates)

| Filter | Count | Action |
|--------|-------|--------|
| null/corrupted | 44 | Need to investigate |
| TOO_NEW | 34 | Too young (< 30 min) |
| HEALTH_SCORE_D | ? | Grade D rejected |
| VOLUME | ? | Volume too low |
| LIQUIDITY | ? | Liquidity too low |
| Missing filters object | ? | Data corruption |

---

## KEY PROBLEMS IDENTIFIED

### Problem 1: Holder Concentration NOT Calculating ❌
**Location**: filterCandidate() line ~104
```javascript
if (candidate.holders?.topTenPercent > (settings.maxTopTenPercent ?? 75)) {
  failedFilters.push('HOLDER_CONCENTRATION');
}
```
**Issue**: `candidate.holders.topTenPercent` = undefined
**Data Available**: `candidate.holders.holders[{rank: 1, percent: 48.3}, ...]`
**Impact**: Top holders with 80%+ concentration not being filtered out

### Problem 2: Risk Analysis Arrays Stay Empty ❌
**Location**: tokenRiskAnalyzer.js analyzeHolderRisks()
```javascript
function analyzeHolderRisks(candidate) {
  const risks = [];
  if (!candidate.holderData) return risks;  // ← Always returns empty!
  // ... code never executes
}
```
**Issue**: `candidate.holderData` not created by candidateBuilder
**Impact**: Risk factor = 0 for all candidates, no risk-based rejection

### Problem 3: Missing Field Mapping ❌
Risk analyzer expects → Actual data stored as:
- `holderData.topTenPercent` → `holders.holders[0-9].percent` array
- `holderData.topFiftyPercent` → `holders.holders[0-49].percent` array
- `liquidity.poolCapital` → `metrics.liquidityUsd`
- `bundlerData.bundledPercent` → Calculate from fee ratios
- `ageData.createdMinutesAgo` → Calculate from createdAtMs

---

## SOLUTION: FIELD NORMALIZATION FUNCTION

Add this function before `candidate.risks = analyzeTokenRisks(candidate)` in candidateBuilder.js:

```javascript
function normalizeForRiskAnalysis(candidate) {
  // 1. Calculate holder concentration percentages
  const holders = candidate.holders?.holders || [];
  const topTenPercent = holders
    .slice(0, 10)
    .reduce((sum, h) => sum + (h.percent || 0), 0);
  const topFiftyPercent = holders
    .slice(0, 50)
    .reduce((sum, h) => sum + (h.percent || 0), 0);

  candidate.holderData = {
    topTenPercent: Math.round(topTenPercent * 10) / 10,  // 48.3% not 48.32...
    topFiftyPercent: Math.round(topFiftyPercent * 10) / 10
  };

  // 2. Map liquidity data
  candidate.liquidity = {
    poolCapital: candidate.metrics?.liquidityUsd || 0,
    bidAskSpread: 0  // NOT AVAILABLE from APIs
  };

  // 3. Calculate bundler activity
  const totalFees = candidate.metrics?.gmgnTotalFeesSol || 1;  // Avoid divide by 0
  const tradeFees = candidate.metrics?.gmgnTradeFeesSol || 0;
  const bundledPercent = (tradeFees / totalFees) * 100;

  candidate.bundlerData = {
    bundledPercent: Math.round(bundledPercent * 10) / 10
  };

  // 4. Calculate token age
  const createdMinutesAgo = 
    (Date.now() - candidate.createdAtMs) / (1000 * 60);

  candidate.ageData = {
    createdMinutesAgo: Math.round(createdMinutesAgo * 10) / 10
  };

  return candidate;
}
```

---

## ENHANCED FILTERING THRESHOLDS (Recommended)

### Current vs. Recommended:

| Filter | Current | Recommended | Reason |
|--------|---------|-------------|--------|
| **Health Grade** | B or better | D acceptable (with high vol) | Allow opportunistic entries |
| **Liquidity** | $10k min | $5k min | Pump.fun tokens smaller |
| **Volume 24h** | $1k min | $3k min | Ensure actual trading |
| **Holder Top 10** | 75% max | 70% max | Earlier rug detection |
| **Age** | 30 min min | 5 min min | Catch early tokens |
| **Bundler %** | Not checked | >65% = FAIL | Prevent pump manipulation |

---

## IMPLEMENTATION ROADMAP

### Step 1: Normalize Fields ⏭️ (DO THIS FIRST)
Add `normalizeForRiskAnalysis()` function to candidateBuilder.js
Call it BEFORE `candidate.risks = analyzeTokenRisks(candidate);`

### Step 2: Verify Risk Detection Triggers
Run audit to check if risk arrays now populate with detected risks

### Step 3: Add Risk-Based Filtering
Update filterCandidate() to:
- Check `candidate.risks.riskFactor > threshold`
- Reject CRITICAL and HIGH severity risks
- Log which risks rejected which candidates

### Step 4: Adjust Thresholds
Fine-tune minLiquidity, minVolume24h, maxTopTenPercent via database settings

### Step 5: Monitor & Learn
Track which tokens pass filters and convert to BUY
Adjust thresholds based on actual performance

---

## EXPECTED OUTCOMES AFTER FIX

**Before**: 52% pass filters (many rug risks not caught)
**After**: ~30-40% pass filters (harmful tokens removed)
**Quality Improvement**: 
- Fewer rug-pulls in passed candidates
- Risk scores reflecting actual token quality
- BUY verdicts on higher-quality tokens only

