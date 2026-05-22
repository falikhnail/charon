# Charon Trading Bot - Optimization Deployment Guide

## 🚀 Quick Summary
Bot sudah dioptimasi untuk Solana meme trading dengan:
- **10x faster polling** (1s dari 10s) - tangkap SL/TP sebelum dump
- **Multi-level SL** - soft/emergency staging vs hard kill
- **Hard TP for small profits** - jangan trap di trailing TP yang minus
- **Smart trailing** - hanya di trending market
- **Better filtering** - reject low quality tokens
- **PnL-weighted learning** - belajar dari kualitas, bukan frekuensi

---

## 📋 Deployment Steps

### Step 1: Backup Database
```bash
cp charon.sqlite charon.sqlite.backup
```

### Step 2: Apply Database Migration
```bash
# Option A: Using sqlite3 CLI
sqlite3 charon.sqlite < migrations/20250523_add_multilevel_sl_and_hard_tp.sql

# Option B: Manual SQL (paste in SQLite client)
ALTER TABLE dry_run_positions ADD COLUMN soft_sl_percent REAL DEFAULT -10;
ALTER TABLE dry_run_positions ADD COLUMN emergency_sl_percent REAL DEFAULT -15;
ALTER TABLE dry_run_positions ADD COLUMN hard_tp_percent REAL DEFAULT 12;
ALTER TABLE dry_run_positions ADD COLUMN soft_sl_done INTEGER DEFAULT 0;
```

### Step 3: Verify Migration
```bash
sqlite3 charon.sqlite
sqlite> .schema dry_run_positions
# Verify new columns exist: soft_sl_percent, emergency_sl_percent, hard_tp_percent, soft_sl_done
sqlite> .quit
```

### Step 4: Update Strategy Settings (Database)
```bash
sqlite3 charon.sqlite
```

Then update or insert your strategy with new settings:
```sql
-- If strategy exists (e.g., id=1), update it:
UPDATE strategies 
SET settings_json = json_set(settings_json,
  '$.soft_sl_percent', -10,
  '$.emergency_sl_percent', -15,
  '$.hard_tp_percent', 12,
  '$.trailing_percent', 7,
  '$.min_liquidity', 40000,
  '$.min_market_cap', 100000,
  '$.min_volume_24h', 25000,
  '$.min_age_hours', 3,
  '$.max_top_ten_percent', 40
)
WHERE id = 1;

-- Or insert new strategy with recommended settings:
INSERT INTO strategies (name, settings_json, created_at_ms, is_active)
VALUES (
  'solana_meme_optimized_v2',
  json('{
    "trading_mode": "confirm",
    "max_open_positions": 5,
    "buy_confidence": 0.82,
    "health_filter_grade": "B",
    "min_liquidity": 40000,
    "min_market_cap": 100000,
    "min_volume_24h": 25000,
    "min_age_hours": 3,
    "max_top_ten_percent": 40,
    "sl_percent": -25,
    "soft_sl_percent": -10,
    "emergency_sl_percent": -15,
    "tp_percent": 50,
    "hard_tp_percent": 12,
    "trailing_enabled": true,
    "trailing_percent": 7,
    "position_size_sol": 0.15,
    "max_hold_ms": 86400000
  }'),
  datetime('now', 'unixepoch') * 1000,
  1
);
```

### Step 5: Stop Bot & Restart
```bash
# Stop current process
# (Ctrl+C if running in terminal, or kill if background)

# Start bot
npm run start

# Or if using PM2:
pm2 restart charon
```

### Step 6: Verify Exit Logic in Logs
Watch for:
- ✅ `[position] X refreshed` every ~1s (new polling rate)
- ✅ `HARD_TP_SMALL` exits when 0-12% profit (new hard TP)
- ✅ `SOFT_SL` exits at -10% (new multi-level SL)
- ✅ `EMERGENCY_SL` exits at -15% (new multi-level SL)
- ✅ `TRAILING_TP` only in trending markets (new market detection)

---

## 🧪 Testing Phase (48-72 hours)

### First 24h: DRY RUN ONLY
```bash
# Ensure trading_mode = 'dry_run' in strategy
# Run bot and collect ~10-20 closed trades
# Check:
# - SL exiting correctly at soft (-10%) then emergency (-15%)
# - Hard TP exiting small profits (0-12%)
# - Trailing TP only appearing in trending markets
# - Position checks happening ~1/sec (look at logs)
```

### Next 24h: Review Learning Output
```bash
# After 1 day of trades, run:
npm run learning:report

# Check output for:
# - byExitReason analysis (new feature)
# - quality_score values
# - Warnings about exit reasons
# - Recommendations for settings adjustments
```

### Final Phase: Manual Validation
Before going LIVE, manually verify 5 open positions:
- [ ] Correct entry (passed stricter filters)
- [ ] Correct TP/SL levels
- [ ] Position checks happening every ~1 second
- [ ] No errors in console

---

## ⚠️ Troubleshooting

### Issue: "Column not found" error
**Solution**: Migration didn't run or failed
```bash
sqlite3 charon.sqlite ".schema dry_run_positions" | grep soft_sl_percent
# If empty, rerun migration
sqlite3 charon.sqlite < migrations/20250523_add_multilevel_sl_and_hard_tp.sql
```

### Issue: Bot crashing with "Cannot read property X"
**Solution**: Old position records missing new columns
- Restart bot (will use defaults for old positions)
- Or manually set: `UPDATE dry_run_positions SET soft_sl_percent = -10 WHERE soft_sl_percent IS NULL;`

### Issue: TRAILING_TP still appearing in non-trending markets
**Solution**: trending.js not connected properly
- Check `src/signals/trending.js` is loaded
- Verify `trending.get(mint)` returns data

### Issue: Positions closing too fast (hard TP at 12%)
**This is expected!** If you want to test without it:
```javascript
// In config or strategy settings, temporarily set:
hard_tp_percent: 0  // Disable hard TP
// Then re-enable after testing trailing

trailing_percent: 10  // Test with bigger trailing too
```

---

## 📊 Monitoring Checklist

After deployment, monitor for 72 hours:

- [ ] **Polling Rate**: Check logs for ~1s intervals (not 10s)
- [ ] **SL Execution**: Verify SOFT_SL → EMERGENCY_SL flow for losing trades
- [ ] **TP Execution**: HARD_TP_SMALL for small wins, TRAILING_TP rare
- [ ] **Entry Quality**: Fewer entries (stricter filtering), but higher quality
- [ ] **Win Rate Trend**: Should improve over 24-48h as LLM learns new exit reasons
- [ ] **PnL Stability**: Average winner size should be 5-8% (up from 2-5%)
- [ ] **Learning Output**: Check that lessons now mention "quality_score" and exit reasons

---

## 🔄 Rollback (if needed)

If something goes wrong:
```bash
# Stop bot
# Restore database backup
cp charon.sqlite.backup charon.sqlite

# Check git for any uncommitted changes
git status

# Revert code changes (if pushed to git)
git checkout src/execution/positions.js src/db/positions.js src/learning/summary.js src/learning/lessons.js src/pipeline/candidateBuilder.js src/config.js

# Restart
npm run start
```

---

## 📈 Expected Results (72-168 hours)

| Metric | Before Changes | Expected After | Notes |
|--------|-----------------|-----------------|-------|
| **Win Rate** | 30-40% | 40-55% | More selective entry + better exit |
| **Avg Win** | 3-5% | 6-10% | Hard TP locks in small wins reliably |
| **Avg Loss** | -10 to -15% | -7 to -8% | Soft SL catches early, prevents deep losses |
| **SL Surprises** | Common | Rare | Multi-level SL catches degradation early |
| **Trailing TP Traps** | Frequent | Rare | Market-aware trailing prevents choppy exits |
| **False Entries** | High | Low | Stricter filtering (40k liq, 100k mcap, 3h age) |
| **Exit Slippage** | -2 to -4% | -1 to -2% | Faster polling catches prices better |

---

## 🎯 Next Steps After Validation

1. **Week 2-3**: Run in CONFIRM mode (no actual swaps, just logs)
2. **Week 3-4**: Small LIVE positions (0.05 SOL, 2-3 trades/day)
3. **Week 4+**: Scale up if consistent profitability

---

## 📞 Debug Logs to Check

```bash
# Real-time log of position checks (should be every ~1000ms):
tail -f charon.sqlite-wal | grep "position.*refreshed"

# Check exit reasons (should see variety):
sqlite3 charon.sqlite "SELECT exit_reason, COUNT(*) FROM dry_run_positions WHERE status='closed' GROUP BY exit_reason;"

# Check learning weights:
sqlite3 charon.sqlite "SELECT lesson FROM learning_lessons WHERE status='active' LIMIT 5;"
```

---

## Questions?

Check OPTIMIZATION_SUMMARY.md for:
- Detailed technical explanation of each change
- Database schema changes
- Configuration examples
- Expected improvements breakdown
