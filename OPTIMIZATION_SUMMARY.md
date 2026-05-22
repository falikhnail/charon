# Charon Trading Bot - Optimization Summary
## Multi-Level SL + Hard TP + Intelligent Trailing Strategy

### Issues Identified
1. **Polling too slow (10s)** → meme tokens dump -14% before bot reads price
2. **Trailing TP default** → exits with small profit instead of holding trending markets  
3. **SL single-level** → kecolongan jauh karena nggak ada soft/emergency staging
4. **Learning bias** → trailing TP dihitung sama seperti winner besar, padahal profit kecil/minus
5. **Filtering loose** → masuk token jelek (low liquidity, concentrated holders)

---

## Implementation Summary

### ✅ 1. Accelerated Position Monitoring
- **Before**: `POSITION_CHECK_MS = 10,000ms` (10 seconds)
- **After**: `POSITION_CHECK_MS = 1,000ms` (1 second)
- **Benefit**: Bot can catch SL/TP triggers before price swings too far

### ✅ 2. Multi-Level Stop Loss Strategy
New columns added to `dry_run_positions`:
- `soft_sl_percent` (default -10%)
  - Triggers 20% partial sell to reduce exposure
  - Keeps 80% position alive for recovery
- `emergency_sl_percent` (default -15%)
  - Hard exit on remaining position
  - Prevents further losses
- Original `sl_percent` (default -25%)
  - Hard kill for worst-case scenarios

**Exit priority order**:
```
-25% (HARD_SL) → -15% (EMERGENCY_SL) → -10% (SOFT_SL, partial 20%) → TP → TRAILING
```

### ✅ 3. Hard TP for Small Profits
- `hard_tp_percent` (default 12%)
- If profit reaches 12% before main TP threshold (e.g., 50%), exit hard
- Prevents small profits from becoming trailing TP traps
- Only uses trailing when: trending market + PnL > main TP + volume > 10 swaps

### ✅ 4. Intelligent Trailing Strategy
- **Trailing now market-aware**: Only activates in trending markets
- `trending.get(mint)` checks for volume velocity + swap count
- Trailing percent increased from default 20% to 6-8% range:
  - Less likely to get swept by wick
  - Still captures continuation moves
- If market NOT trending → force exit at TP instead of waiting

### ✅ 5. PnL-Weighted Learning
Modified `learning/summary.js` to analyze exit reasons by:
- Win rate (40% weight)
- Average PnL quality (60% weight)
- **Result**: Prevents trailing TP from being recommended if it "wins often but profits small"

Learning now surfaces:
- `byExitReason` with `quality_score` calculation
- Warnings about low-quality trailing TP usage
- Recommendations for hard TP adoption

### ✅ 6. Tightened Token Filtering
**Stricter candidate requirements** (settings defaults):
- Minimum liquidity: **40k** (↑ from 10k)
- Minimum market cap: **100k** (↑ from unset)
- Max holder concentration: **40%** (↓ from 75%)
- Minimum 24h volume: **25k** (↑ from 1k)
- Minimum token age: **3 hours** (↑ from 0.5h)
- Health score grade: **B minimum** (↑ from any)
- Reject active fee claims for scalping

**Impact**: Fewer entry signals but MUCH higher quality (avoid quick rugs)

---

## Recommended Settings for Solana Meme Trading

```javascript
// Strategy configuration (in database settings or environment)
{
  trading_mode: 'confirm',
  max_open_positions: 5,
  
  // Entry control
  buy_confidence: 0.82,
  health_filter_grade: 'B',
  min_liquidity: 40000,
  min_market_cap: 100000,
  min_volume_24h: 25000,
  min_age_hours: 3,
  max_top_ten_percent: 40,
  
  // Exit control - multi-level SL
  sl_percent: -25,              // Hard kill
  soft_sl_percent: -10,         // Soft SL (partial sell 20%)
  emergency_sl_percent: -15,    // Emergency SL (hard close)
  
  // TP control - hard + trailing combo
  tp_percent: 50,               // Main TP threshold
  hard_tp_percent: 12,          // Hard exit for small profits
  second_take_profit: 20,       // Optional: intermediate TP
  
  // Trailing (only enabled + market trending + above thresholds)
  trailing_enabled: true,
  trailing_percent: 7,          // ↑ from 20% default (less sweep)
  trailing_enable_after: 20,    // Only trail after +20% confirmed
  
  // Position sizing
  position_size_sol: 0.15,      // Per position
  max_position_risk: 3,         // Max % of wallet per trade
  
  // Partial TP (optional - intermediate lock-in)
  partial_tp: true,
  partial_tp_at_percent: 20,
  partial_tp_sell_percent: 25,  // Sell 25% at +20%
  
  // Timing
  max_hold_ms: 86400000,        // 24h max hold
  polling_ms: 1000,             // ← Already set in config.js
}
```

---

## Database Changes Required

Run migration to add new columns:
```bash
sqlite3 charon.sqlite < migrations/20250523_add_multilevel_sl_and_hard_tp.sql
```

Or manually in SQLite:
```sql
ALTER TABLE dry_run_positions ADD COLUMN soft_sl_percent REAL DEFAULT -10;
ALTER TABLE dry_run_positions ADD COLUMN emergency_sl_percent REAL DEFAULT -15;
ALTER TABLE dry_run_positions ADD COLUMN hard_tp_percent REAL DEFAULT 12;
ALTER TABLE dry_run_positions ADD COLUMN soft_sl_done INTEGER DEFAULT 0;
```

---

## Testing Checklist

- [ ] Run migrations successfully
- [ ] Start bot with new polling (should see position checks every ~1s in logs)
- [ ] Verify new SL levels trigger correctly (check trade logs for SOFT_SL → EMERGENCY_SL flow)
- [ ] Verify hard TP for small profits exits <12% gains correctly
- [ ] Run 2-3 learning windows to collect PnL-weighted analysis
- [ ] Check that lessons now warn about trailing TP quality
- [ ] Monitor 1-2 trades to confirm entry filtering is stricter (fewer false entries)
- [ ] Compare 12h window win rate & avg PnL before/after

---

## Expected Improvements

| Metric | Before | Target After |
|--------|--------|--------------|
| Win Rate | Low (30-40%) | **40-50%** |
| Avg Win | Small (2-5%) | **5-8%** |
| Avg Loss | Large (-12%) | **-7 to -8%** |
| SL Kecolongan | Frequent | **Rare** (soft SL catches early) |
| Trailing TP Profit | Inconsistent | **Hard exit at 12%, let trending run** |
| False Entries | High (low quality) | **Low** (stricter filters) |
| Exit Reason Bias | Trailing TP preferred | **PnL-weighted decisions** |

---

## Files Modified

1. **src/config.js**
   - POSITION_CHECK_MS: 10_000 → 1_000

2. **src/db/positions.js**
   - `createDryRunPosition()`: Added soft_sl, emergency_sl, hard_tp fields
   - `createLivePosition()`: Added soft_sl, emergency_sl, hard_tp fields

3. **src/execution/positions.js**
   - `refreshPosition()`: Complete rewrite with multi-level SL + hard TP logic
   - Exit priority: HARD_SL → EMERGENCY_SL → SOFT_SL → HARD_TP_SMALL → TP → TRAILING_TP

4. **src/learning/summary.js**
   - Added `byExitReason` analysis with quality_score
   - Added PnL-weighted scoring (40% win rate, 60% avg PnL)

5. **src/learning/lessons.js**
   - Enhanced fallback lessons with exit reason analysis
   - Warnings about trailing TP quality
   - Recommendations for hard TP usage

6. **src/pipeline/candidateBuilder.js**
   - filterCandidate(): Tightened thresholds
   - Min liquidity: 10k → 40k
   - Min mcap: none → 100k
   - Max top 10%: 75% → 40%
   - Min volume: 1k → 25k
   - Min age: 0.5h → 3h

7. **migrations/20250523_add_multilevel_sl_and_hard_tp.sql**
   - Database schema migration for new columns
