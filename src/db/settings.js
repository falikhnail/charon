import { db } from './connection.js';

const STRATEGY_CACHE_TTL = 5000;

const strategyCache = {
  id: null,
  config: null,
  at: 0,
};

function safeParseStrategy(json) {
  try {
    if (!json) return {};
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeStrategy(rowOrConfig = {}) {
  const base = defaultStrategy();

  const cfg =
    rowOrConfig?.config_json !== undefined
      ? safeParseStrategy(rowOrConfig.config_json)
      : rowOrConfig;

  return {
    ...base,
    ...cfg,
    ...(rowOrConfig.id ? { id: rowOrConfig.id } : {}),
    ...(rowOrConfig.name ? { name: rowOrConfig.name } : {}),
  };
}

export function setting(key, fallback = '') {
  const row = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(key);

  return row?.value ?? fallback;
}

export function setSetting(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key)
    DO UPDATE SET value = excluded.value
  `).run(key, String(value));
}

export function boolSetting(key, fallback = false) {
  const raw = String(
    setting(key, fallback ? 'true' : 'false')
  )
    .trim()
    .toLowerCase();

  return ['true', '1', 'yes', 'on'].includes(raw);
}

export function numSetting(key, fallback = 0) {
  const raw = Number(setting(key, String(fallback)));
  return Number.isFinite(raw) ? raw : fallback;
}

export function activeStrategy() {
  const now = Date.now();

  if (
    strategyCache.config &&
    now - strategyCache.at < STRATEGY_CACHE_TTL
  ) {
    return strategyCache.config;
  }

  // deterministic kalau ada multiple enabled
  const row = db.prepare(`
    SELECT *
    FROM strategies
    WHERE enabled = 1
    ORDER BY id DESC
    LIMIT 1
  `).get();

  let config;

  if (!row) {
    const fallback = strategyById('sniper');
    config = fallback ?? defaultStrategy();
  } else {
    config = normalizeStrategy(row);
  }

  strategyCache.id = config.id;
  strategyCache.config = config;
  strategyCache.at = now;

  return config;
}

export function strategyById(id) {
  const row = db
    .prepare('SELECT * FROM strategies WHERE id = ?')
    .get(id);

  if (!row) return null;

  return normalizeStrategy(row);
}

export function allStrategies() {
  return db
    .prepare('SELECT * FROM strategies ORDER BY id')
    .all()
    .map((row) => ({
      enabled: Boolean(row.enabled),
      ...normalizeStrategy(row),
    }));
}

export function setActiveStrategy(id) {
  const row = db
    .prepare('SELECT id FROM strategies WHERE id = ?')
    .get(id);

  if (!row) {
    throw new Error(`Strategy not found: ${id}`);
  }

  const tx = db.transaction(() => {
    db.prepare('UPDATE strategies SET enabled = 0').run();
    db.prepare(
      'UPDATE strategies SET enabled = 1 WHERE id = ?'
    ).run(id);
  });

  tx();

  strategyCache.id = null;
  strategyCache.config = null;
  strategyCache.at = 0;
}

export function updateStrategyConfig(id, config) {
  const merged = normalizeStrategy(config);

  db.prepare(`
    UPDATE strategies
    SET config_json = ?
    WHERE id = ?
  `).run(JSON.stringify(merged), id);

  if (strategyCache.id === id) {
    strategyCache.id = null;
    strategyCache.config = null;
    strategyCache.at = 0;
  }
}

export function strategySetting(key, fallback) {
  const strat = activeStrategy();

  if (
    Object.prototype.hasOwnProperty.call(strat, key) &&
    strat[key] !== undefined &&
    strat[key] !== null
  ) {
    return strat[key];
  }

  if (typeof fallback === 'boolean') {
    return boolSetting(key, fallback);
  }

  if (typeof fallback === 'number') {
    return numSetting(key, fallback);
  }

  return setting(key, fallback);
}

function defaultStrategy() {
  return {
    id: 'sniper',
    name: 'Sniper',

    // ENTRY
    entry_mode: 'immediate',
    min_source_count: 5,
    require_fee_claim: true,

    // TOKEN FILTER
    token_age_max_ms: 900000,
    min_mcap_usd: 25000,
    max_mcap_usd: 300000,

    // FEES
    min_fee_claim_sol: 0.05,
    min_gmgn_total_fee_sol: 0.02,

    // HOLDER
    min_holders: 300,
    max_top20_holder_percent: 12,
    min_saved_wallet_holders: 3,

    // TREND
    min_graduated_volume_usd: 25000,
    trending_min_volume_usd: 15000,
    trending_min_swaps: 25,

    // RUG FILTER
    trending_max_rug_ratio: 0.12,
    trending_max_bundler_rate: 0.12,

    rug_exit_enabled: true,
    rug_mcap_drop_percent: -45,
    rug_liquidity_drop_percent: -60,

    // POSITION
    position_size_sol: 0.1,
    max_open_positions: 2,

    // TP / SL
    tp_percent: 18,
    sl_percent: -12,

    // TRAILING
    trailing_enabled: true,
    trailing_percent: 6,

    // PARTIAL TP
    partial_tp: true,
    partial_tp_at_percent: 15,
    partial_tp_sell_percent: 50,

    // HOLD
    max_hold_ms: 0,

    // SAFETY
    stale_data_max_ms: 15000,
    min_exit_liquidity_usd: 8000,
    max_loss_streak: 4,
    cooldown_after_loss_ms: 1200000,
    parallel_refresh_limit: 5,

    // FILTER THRESHOLDS (execution-time lenient check)
    healthFilterGrade: 'D',
    minAgeHours: 0,
    minLiquidity: 5000,

    // AI
    use_llm: true,
    llm_min_confidence: 30,
  };
}