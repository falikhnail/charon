import axios from 'axios';
import { ENABLE_LLM, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, LLM_TIMEOUT_MS } from '../config.js';
import { strictJsonFromText } from '../utils.js';
import { numSetting } from '../db/settings.js';
import { db } from '../db/connection.js';
import { buildCandidateContext, buildLLMSystemPrompt } from './llmContext.js';

export function normalizeDecision(parsed, fallbackReason = '') {
  const verdict = ['BUY', 'WATCH', 'PASS'].includes(String(parsed?.verdict).toUpperCase())
    ? String(parsed.verdict).toUpperCase()
    : 'WATCH';
  return {
    verdict,
    confidence: Math.max(0, Math.min(100, Number(parsed?.confidence) || 0)),
    reason: String(parsed?.reason || fallbackReason).slice(0, 1000),
    risks: Array.isArray(parsed?.risks) ? parsed.risks.map(String).slice(0, 8) : [],
    suggested_tp_percent: Number(parsed?.suggested_tp_percent) || numSetting('default_tp_percent', 50),
    suggested_sl_percent: Number(parsed?.suggested_sl_percent) || numSetting('default_sl_percent', -25),
    size_multiplier: Number(parsed?.size_multiplier) || 1.0,
    raw: parsed,
  };
}

export function activeLessonsForPrompt(limit = 6) {
  return db.prepare(`
    SELECT lesson
    FROM learning_lessons
    WHERE status = 'active'
    ORDER BY id DESC
    LIMIT ?
  `).all(limit).map(row => row.lesson);
}

export function compactCandidateForLlm(row) {
  const c = row.candidate;
  const athWindow = c.chart?.windows?.find(window => window.label === 'ath_context_24h_5m' && window.available)
    || c.chart?.windows?.find(window => window.label === 'recent_24h_5m' && window.available);
  
  const trimmedSignals = c.signals ? {
    route: c.signals.route,
    label: c.signals.label,
    hasFeeClaim: c.signals.hasFeeClaim,
    hasGraduated: c.signals.hasGraduated,
    hasTrending: c.signals.hasTrending,
  } : {};
  
  const trimmedMetrics = c.metrics ? {
    priceUsd: c.metrics.priceUsd,
    marketCapUsd: c.metrics.marketCapUsd,
    liquidityUsd: c.metrics.liquidityUsd,
    holderCount: c.metrics.holderCount,
    volume24hUsd: Math.max(
      c.metrics.trendingVolumeUsd || 0,
      c.metrics.graduatedVolumeUsd || 0
    ),
  } : {};
  
  const trimmedToken = c.token ? {
    mint: c.token.mint,
    name: c.token.name,
    symbol: c.token.symbol,
  } : {};
  
  return {
    candidate_id: row.id,
    mint: c.token?.mint,
    signals: trimmedSignals,
    token: trimmedToken,
    metrics: trimmedMetrics,
    entryTiming: c.entryTiming || null,
    chart: {
      currentNative: c.chart?.currentNative,
      rangeHighNative: c.chart?.rangeHighNative,
      distanceFromAthPercent: c.chart?.distanceFromAthPercent ?? c.chart?.belowRangeHighPercent,
      athContext24h: athWindow ? {
        current: athWindow.current,
        high: athWindow.high,
        low: athWindow.low,
        distanceFromHighPercent: athWindow.belowHighPercent,
        aboveLowPercent: athWindow.aboveLowPercent,
      } : null,
    },
  };
}

/**
 * Main LLM decision function - LLM is primary system
 * Sends batch of candidates to LLM API for decision making
 * Implements aggressive retry with exponential backoff
 */
export async function decideCandidateBatch(rows, triggerCandidateId) {
  if (!ENABLE_LLM || !LLM_API_KEY) {
    return {
      verdict: 'WATCH',
      confidence: 0,
      selected_candidate_id: null,
      selected_mint: null,
      reason: 'LLM disabled',
      risks: ['llm_disabled'],
      suggested_tp_percent: numSetting('default_tp_percent', 50),
      suggested_sl_percent: numSetting('default_sl_percent', -25),
      size_multiplier: 0,
    };
  }

  if (!rows || rows.length === 0) {
    return {
      verdict: 'PASS',
      confidence: 0,
      selected_candidate_id: null,
      selected_mint: null,
      reason: 'No candidates',
      risks: ['no_candidates'],
      suggested_tp_percent: numSetting('default_tp_percent', 50),
      suggested_sl_percent: numSetting('default_sl_percent', -25),
      size_multiplier: 0,
    };
  }

  // Build compact candidate data
  const enrichedCandidates = rows.map(row => {
    const context = buildCandidateContext(row.candidate);
    return {
      ...compactCandidateForLlm(row),
      health_context: context,
    };
  });

  const firstContext = enrichedCandidates[0]?.health_context || {};
  const system = buildLLMSystemPrompt(firstContext);

  const user = {
    task: 'Pick the best dry-run buy candidate from this recent batch, or choose none.',
    recent_lessons: activeLessonsForPrompt(),
    output_schema: {
      verdict: 'BUY|WATCH|PASS',
      selected_candidate_id: 'integer or null',
      selected_mint: 'mint or null',
      confidence: '0-100',
      reason: 'string',
      risks: 'array of strings',
      suggested_tp_percent: 'number',
      suggested_sl_percent: 'number',
      size_multiplier: 'decimal 0.0-1.0',
    },
    candidates: enrichedCandidates,
  };

  // DEBUG: Log candidate data being sent
  if (process.env.DEBUG_LLM === 'true') {
    console.log('[llm:debug]', {
      candidates: enrichedCandidates.map(c => ({
        id: c.candidate_id,
        health: c.health_context?.grade,
        timing: c.entryTiming?.timing?.strategy,
        volume: c.metrics?.holderCount,
        sizeGuide: c.health_context?.sizingGuidance?.sizeMultiplier,
      }))
    });
  }

  // Aggressive retry with exponential backoff
  let lastError = null;
  for (let attempt = 0; attempt <= 4; attempt++) {
    try {
      const payload = {
        model: LLM_MODEL,
        temperature: 0.2,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(user) },
        ],
      };

      const res = await axios.post(`${LLM_BASE_URL.replace(/\/$/, '')}/chat/completions`, payload, {
        timeout: LLM_TIMEOUT_MS,
        headers: { 
          authorization: `Bearer ${LLM_API_KEY}`, 
          'content-type': 'application/json' 
        },
      });

      const content = res.data?.choices?.[0]?.message?.content || '';
      const parsed = strictJsonFromText(content);
      const decision = normalizeDecision(parsed);
      const selectedId = Number(parsed.selected_candidate_id);
      const selectedMint = String(parsed.selected_mint || '');
      const row = rows.find(item => item.id === selectedId || item.candidate.token?.mint === selectedMint);
      
      const result = {
        ...decision,
        selected_candidate_id: decision.verdict === 'BUY' && row ? row.id : null,
        selected_mint: decision.verdict === 'BUY' && row ? row.candidate.token.mint : null,
        selected_row: decision.verdict === 'BUY' && row ? row : null,
      };
      
      console.log(`[llm] ${decision.verdict} (${decision.confidence}%) - ${rows.length} candidates screened${row ? ` - selected ${row.candidate.token.mint.slice(0, 8)}` : ''}`);
      return result;
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      const errorData = err.response?.data;
      const retryAfter = err.response?.headers?.['retry-after'];

      if (status === 400) {
        console.log(`[llm] 400 bad request:`, errorData?.error?.message || 'unknown');
      }

      if ((status === 429 || status === 503) && attempt < 4) {
        const waitMs = retryAfter 
          ? Math.max(parseInt(retryAfter) * 1000, 500)
          : Math.pow(2, attempt) * 500 + Math.random() * 500;
        
        console.log(`[llm] ${status}, retry ${attempt + 1}/4 in ${Math.round(waitMs)}ms`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }

      console.log(`[llm] error: ${err.message}`);
      break;
    }
  }

  // Return WATCH on error (conservative fallback)
  return {
    verdict: 'WATCH',
    confidence: 0,
    selected_candidate_id: null,
    selected_mint: null,
    reason: `LLM error: ${lastError?.message || 'unknown error'}`,
    risks: ['llm_error'],
    suggested_tp_percent: numSetting('default_tp_percent', 50),
    suggested_sl_percent: numSetting('default_sl_percent', -25),
    size_multiplier: 0,
  };
}

export async function decideCandidate(candidate) {
  const pseudoRow = { id: 0, candidate };
  const decision = await decideCandidateBatch([pseudoRow], 0);
  return normalizeDecision(decision.raw || decision, decision.reason);
}
