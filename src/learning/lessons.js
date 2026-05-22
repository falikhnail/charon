import axios from 'axios';
import { ENABLE_LLM, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, LLM_TIMEOUT_MS } from '../config.js';
import { now, json, stripThinking, strictJsonFromText } from '../utils.js';
import { fmtPct } from '../format.js';
import { db } from '../db/connection.js';

export function fallbackLessons(summary) {
  const lessons = [];
  
  // Analyze exit reasons with quality weighting
  const byExitReason = summary.positions.byExitReason || [];
  const trailingTpData = byExitReason.find(r => r.exitReason === 'TRAILING_TP');
  const hardTpData = byExitReason.find(r => r.exitReason === 'HARD_TP_SMALL');
  const slData = byExitReason.find(r => r.exitReason === 'SL' || r.exitReason === 'HARD_SL' || r.exitReason === 'EMERGENCY_SL');
  
  // Warning: Trailing TP with low quality (frequent but low PnL)
  if (trailingTpData && trailingTpData.count >= 3 && trailingTpData.avgPnlPercent < 3) {
    lessons.push({
      lesson: `Trailing TP exiting too early with low profit: avg ${fmtPct(trailingTpData.avgPnlPercent)} across ${trailingTpData.count} trades. Consider: (1) increase trailing_percent from 3-4% to 6-8%, (2) only enable trailing after +20% confirmation, (3) harder market detection.`,
      evidence: trailingTpData,
    });
  }
  
  // Recommendation: Hard TP performs better for small profits
  if (hardTpData && hardTpData.count >= 2 && hardTpData.avgPnlPercent > (trailingTpData?.avgPnlPercent || 0)) {
    lessons.push({
      lesson: `Hard TP for small profits (${fmtPct(hardTpData.avgPnlPercent)} avg) outperforms trailing in current market. Keep hard_tp_percent at 12%.`,
      evidence: hardTpData,
    });
  }
  
  // SL being too tight or slippage issue
  if (slData && slData.count >= 3 && slData.avgPnlPercent < -10) {
    lessons.push({
      lesson: `SL exits averaging ${fmtPct(slData.avgPnlPercent)}—suggest multi-level: soft_sl -10% (20% partial), emergency_sl -15% (hard close), hard_kill -25%.`,
      evidence: slData,
    });
  }
  
  const bestRoute = summary.positions.byRoute?.[0];
  const worstRoute = [...(summary.positions.byRoute || [])].sort((a, b) => a.pnlPercent - b.pnlPercent)[0];
  
  if (bestRoute && bestRoute.count >= 2 && bestRoute.pnlPercent > 0) {
    lessons.push({
      lesson: `Prefer ${bestRoute.route} when other filters are clean; it led the window with ${fmtPct(bestRoute.avgPnlPercent)} avg PnL across ${bestRoute.count} closed dry-runs.`,
      evidence: bestRoute,
    });
  }
  
  if (worstRoute && worstRoute.count >= 2 && worstRoute.pnlPercent < 0) {
    lessons.push({
      lesson: `Be stricter on ${worstRoute.route}; it underperformed with ${fmtPct(worstRoute.avgPnlPercent)} avg PnL across ${worstRoute.count} closed dry-runs.`,
      evidence: worstRoute,
    });
  }
  
  const slCount = summary.positions.worst?.filter(row => row.exitReason === 'SL' || row.exitReason === 'HARD_SL').length || 0;
  if (slCount >= 2) {
    lessons.push({
      lesson: `Recent worst exits clustered around SL; require stronger fresh pre-entry mcap/liquidity confirmation before accepting late entries.`,
      evidence: { slWorstCount: slCount, worst: summary.positions.worst },
    });
  }
  
  if (!lessons.length) {
    lessons.push({
      lesson: 'Not enough closed dry-run evidence yet; keep collecting decisions before changing filters aggressively.',
      evidence: { closed: summary.positions.closed },
    });
  }
  
  return lessons.slice(0, 6);
}

export async function generateLessons(summary) {
  const fallback = fallbackLessons(summary);
  if (!ENABLE_LLM || !LLM_API_KEY) return { lessons: fallback, raw: { fallback: true } };
  try {
    const res = await axios.post(`${LLM_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
      model: LLM_MODEL,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: [
            'You are Charon learning from dry-run trading evidence.',
            'Return strict JSON only.',
            'Do not invent trades or outcomes.',
            'Create compact operational lessons that can improve the next screening prompt.',
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'Analyze this dry-run window and produce up to 6 lessons for future candidate screening.',
            output_schema: {
              lessons: [{ lesson: 'short actionable rule', evidence: 'specific supporting data' }],
            },
            summary,
          }),
        },
      ],
    }, {
      timeout: LLM_TIMEOUT_MS,
      headers: { authorization: `Bearer ${LLM_API_KEY}`, 'content-type': 'application/json' },
    });
    const parsed = strictJsonFromText(res.data?.choices?.[0]?.message?.content || '');
    const lessons = Array.isArray(parsed.lessons)
      ? parsed.lessons.map(item => ({
          lesson: String(item.lesson || '').slice(0, 500),
          evidence: item.evidence ?? {},
        })).filter(item => item.lesson)
      : [];
    return { lessons: lessons.length ? lessons.slice(0, 6) : fallback, raw: parsed };
  } catch (err) {
    console.log(`[learn] LLM failed: ${err.message}`);
    return { lessons: fallback, raw: { error: err.message, fallback: true } };
  }
}

export function storeLearningRun(windowMs, summary, lessons, raw) {
  const result = db.prepare(`
    INSERT INTO learning_runs (created_at_ms, window_ms, summary_json, lessons_json, raw_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(now(), windowMs, json(summary), json(lessons), json(raw));
  const runId = Number(result.lastInsertRowid);
  const insert = db.prepare(`
    INSERT INTO learning_lessons (run_id, created_at_ms, status, lesson, evidence_json)
    VALUES (?, ?, 'active', ?, ?)
  `);
  for (const item of lessons) insert.run(runId, now(), item.lesson, json(item.evidence || {}));
  return runId;
}
