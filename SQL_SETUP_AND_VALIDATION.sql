-- SQL Setup: Recommended Strategy Settings for Charon v2 Optimization

-- ============================================================
-- Option 1: Update existing strategy with new recommended settings
-- ============================================================
-- UPDATE this if you already have a strategy you want to upgrade

UPDATE strategies 
SET settings_json = json_set(settings_json,
  -- Entry control (stricter)
  '$.min_liquidity', 40000,
  '$.min_market_cap', 100000,
  '$.min_volume_24h', 25000,
  '$.min_age_hours', 3,
  '$.max_top_ten_percent', 40,
  '$.health_filter_grade', 'B',
  '$.buy_confidence', 0.82,
  
  -- SL control (multi-level)
  '$.sl_percent', -25,
  '$.soft_sl_percent', -10,
  '$.emergency_sl_percent', -15,
  
  -- TP control (hard + trailing smart)
  '$.tp_percent', 50,
  '$.hard_tp_percent', 12,
  '$.trailing_enabled', 1,
  '$.trailing_percent', 7,
  
  -- Position & timing
  '$.position_size_sol', 0.15,
  '$.max_hold_ms', 86400000,
  '$.trading_mode', 'confirm'
)
WHERE id = 1;  -- Change ID to your strategy ID

-- ============================================================
-- Option 2: Insert new strategy with recommended settings
-- ============================================================
-- Run this if you want a fresh strategy record

INSERT INTO strategies (
  name,
  settings_json,
  created_at_ms,
  is_active
) VALUES (
  'Charon_Solana_Meme_Optimized_v2',
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
    "second_take_profit": 20,
    
    "trailing_enabled": true,
    "trailing_percent": 7,
    "trailing_enable_after": 20,
    
    "position_size_sol": 0.15,
    "max_position_risk": 3,
    "max_hold_ms": 86400000,
    
    "partial_tp": true,
    "partial_tp_at_percent": 20,
    "partial_tp_sell_percent": 25,
    
    "polling_ms": 1000
  }'),
  cast(strftime('%s', 'now') as integer) * 1000,
  1
);

-- ============================================================
-- Verify settings were updated correctly
-- ============================================================
-- Run this to check:

SELECT 
  id,
  name,
  json_extract(settings_json, '$.min_liquidity') as min_liq,
  json_extract(settings_json, '$.min_market_cap') as min_mcap,
  json_extract(settings_json, '$.soft_sl_percent') as soft_sl,
  json_extract(settings_json, '$.emergency_sl_percent') as emergency_sl,
  json_extract(settings_json, '$.hard_tp_percent') as hard_tp,
  json_extract(settings_json, '$.trailing_percent') as trailing_pct,
  is_active
FROM strategies
WHERE name LIKE '%Optimized%' OR id = 1;

-- ============================================================
-- Check current strategy settings (for reference)
-- ============================================================

SELECT 
  'Settings' as section,
  json_extract(settings_json, '$.trading_mode') as trading_mode,
  json_extract(settings_json, '$.buy_confidence') as buy_confidence,
  json_extract(settings_json, '$.min_liquidity') as min_liquidity,
  json_extract(settings_json, '$.min_market_cap') as min_mcap,
  json_extract(settings_json, '$.max_top_ten_percent') as max_holder_concentration,
  json_extract(settings_json, '$.trailing_enabled') as trailing_enabled,
  json_extract(settings_json, '$.trailing_percent') as trailing_percent
FROM strategies
WHERE is_active = 1
LIMIT 1;

-- ============================================================
-- Post-Optimization Validation Queries
-- ============================================================

-- 1. Check exit reason distribution (should show quality improvement)
SELECT 
  exit_reason,
  COUNT(*) as count,
  ROUND(AVG(pnl_percent), 2) as avg_pnl_percent,
  ROUND(SUM(pnl_percent), 2) as total_pnl,
  ROUND(SUM(CASE WHEN pnl_percent > 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as win_rate_percent
FROM dry_run_positions
WHERE status = 'closed'
  AND opened_at_ms > (strftime('%s', 'now') - 3600000) * 1000  -- Last hour
GROUP BY exit_reason
ORDER BY avg_pnl_percent DESC;

-- 2. Check polling rate (should see many position updates per minute)
SELECT 
  COUNT(*) as total_updates,
  COUNT(*) / (SELECT COUNT(*) FROM dry_run_positions WHERE status = 'open') as updates_per_open_position_per_window
FROM dry_run_positions
WHERE status = 'closed'
  AND opened_at_ms > (strftime('%s', 'now') - 3600000) * 1000;

-- 3. Check entry filtering strictness
SELECT 
  COUNT(*) as total_entries,
  COUNT(CASE WHEN json_extract(snapshot_json, '$.candidate.metrics.liquidityUsd') >= 40000 THEN 1 END) as passed_liq_filter,
  COUNT(CASE WHEN json_extract(snapshot_json, '$.candidate.metrics.marketCapUsd') >= 100000 THEN 1 END) as passed_mcap_filter,
  ROUND(100.0 * COUNT(CASE WHEN json_extract(snapshot_json, '$.candidate.metrics.liquidityUsd') >= 40000 
    AND json_extract(snapshot_json, '$.candidate.metrics.marketCapUsd') >= 100000 THEN 1 END) / COUNT(*), 1) as filter_pass_rate
FROM dry_run_positions
WHERE opened_at_ms > (strftime('%s', 'now') - 86400000) * 1000;  -- Last 24h

-- 4. Check SL execution (should see SOFT_SL reducing losses)
SELECT 
  'SL Stats' as metric,
  COUNT(CASE WHEN exit_reason IN ('SL', 'HARD_SL', 'SOFT_SL', 'EMERGENCY_SL') THEN 1 END) as total_sl_exits,
  ROUND(AVG(CASE WHEN exit_reason IN ('SOFT_SL') THEN pnl_percent END), 2) as soft_sl_avg_pnl,
  ROUND(AVG(CASE WHEN exit_reason IN ('EMERGENCY_SL') THEN pnl_percent END), 2) as emergency_sl_avg_pnl,
  ROUND(AVG(CASE WHEN exit_reason IN ('SL', 'HARD_SL') THEN pnl_percent END), 2) as hard_sl_avg_pnl
FROM dry_run_positions
WHERE status = 'closed'
  AND opened_at_ms > (strftime('%s', 'now') - 86400000) * 1000;

-- ============================================================
-- Test Scenario: 12-Hour Window Analysis
-- ============================================================

-- Run this after 12 hours to see if optimization working

SELECT 
  'Window Analysis (12h)' as metric,
  COUNT(*) as total_positions,
  COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed,
  COUNT(CASE WHEN status = 'open' THEN 1 END) as open,
  ROUND(100.0 * SUM(CASE WHEN pnl_percent > 0 THEN 1 END) / COUNT(CASE WHEN status = 'closed' THEN 1 END), 1) as win_rate_percent,
  ROUND(AVG(pnl_percent), 2) as avg_pnl_percent,
  ROUND(SUM(pnl_percent), 2) as total_pnl_percent,
  ROUND(SUM(pnl_percent) / COUNT(CASE WHEN status = 'closed' THEN 1 END), 2) as avg_pnl_per_closed
FROM dry_run_positions
WHERE opened_at_ms > (strftime('%s', 'now') - 43200000) * 1000;  -- Last 12 hours

-- ============================================================
-- Before/After Comparison (run if you have backup)
-- ============================================================

-- This shows comparison between pre- and post-optimization
-- Only works if you kept backup positions with timestamp markers

SELECT 
  'PRE-OPTIMIZATION' as period,
  COUNT(*) as closed_trades,
  ROUND(100.0 * SUM(CASE WHEN pnl_percent > 0 THEN 1 END) / COUNT(*), 1) as win_rate,
  ROUND(AVG(pnl_percent), 2) as avg_pnl_pct
FROM dry_run_positions
WHERE status = 'closed'
  AND opened_at_ms BETWEEN (strftime('%s', 'now') - 432000000) * 1000 
    AND (strftime('%s', 'now') - 345600000) * 1000  -- 5 days - 4 days ago
UNION ALL
SELECT 
  'POST-OPTIMIZATION' as period,
  COUNT(*) as closed_trades,
  ROUND(100.0 * SUM(CASE WHEN pnl_percent > 0 THEN 1 END) / COUNT(*), 1) as win_rate,
  ROUND(AVG(pnl_percent), 2) as avg_pnl_pct
FROM dry_run_positions
WHERE status = 'closed'
  AND opened_at_ms > (strftime('%s', 'now') - 86400000) * 1000;  -- Last 24 hours
