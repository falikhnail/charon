-- Migration: Add multi-level SL and hard TP columns to positions table
-- Date: 2025-05-23

-- Add new columns to dry_run_positions table for multi-level stop loss and hard TP for small profits
ALTER TABLE dry_run_positions ADD COLUMN soft_sl_percent REAL DEFAULT -10;
ALTER TABLE dry_run_positions ADD COLUMN emergency_sl_percent REAL DEFAULT -15;
ALTER TABLE dry_run_positions ADD COLUMN hard_tp_percent REAL DEFAULT 12;
ALTER TABLE dry_run_positions ADD COLUMN soft_sl_done INTEGER DEFAULT 0;

-- Update existing records with default values from settings table
-- (optional: can be run manually if preferred)
UPDATE dry_run_positions 
SET 
  soft_sl_percent = -10,
  emergency_sl_percent = -15,
  hard_tp_percent = 12,
  soft_sl_done = 0
WHERE soft_sl_percent IS NULL;
