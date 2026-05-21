import { db } from './connection.js';
import { now, safeJson, json } from '../utils.js';
import { numSetting } from './settings.js';

const SIGNAL_BUCKET_MS = 5 * 60 * 1000;

export function candidateSignalKey(candidate, signature = null) {
  if (signature) {
    return `${signature}:${candidate.token.mint}`;
  }

  const route = candidate.signals?.route || 'signal';
  const mint = candidate.token?.mint;
  const ts = Number(candidate.createdAtMs || now());
  const bucket = Math.floor(ts / SIGNAL_BUCKET_MS);

  return `${route}:${mint}:${bucket}`;
}

export function latestCandidateByMint(mint) {
  const row = db.prepare(`
    SELECT *
    FROM candidates
    WHERE mint = ?
    ORDER BY created_at_ms DESC
    LIMIT 1
  `).get(mint);

  return row
    ? { ...row, candidate: safeJson(row.candidate_json, {}) }
    : null;
}

export function shouldSkipCandidate(mint) {
  const cooldownMs = numSetting(
    'candidate_rebuy_cooldown_ms',
    30 * 60 * 1000
  );

  const row = db.prepare(`
    SELECT created_at_ms, status
    FROM candidates
    WHERE mint = ?
    ORDER BY created_at_ms DESC
    LIMIT 1
  `).get(mint);

  if (!row) return false;

  const age = now() - Number(row.created_at_ms);

  const blockedStatuses = ['buy', 'open', 'sl', 'rug'];

  return (
    blockedStatuses.includes(row.status) &&
    age < cooldownMs
  );
}

export function upsertCandidate(candidate, signature) {
  const signalKey = candidateSignalKey(candidate, signature);
  const ts = now();
  const mint = candidate.token?.mint;
  const passed = Boolean(candidate.filters?.passed);

  return db.transaction(() => {
    const existing = db.prepare(`
      SELECT id, candidate_json
      FROM candidates
      WHERE signal_key = ?
    `).get(signalKey);

    if (existing) {
      const previous = safeJson(
        existing.candidate_json,
        {}
      );

      const merged = {
        ...previous,
        ...candidate,
        lastSeenAt: ts,
        seenCount:
          (previous.seenCount || 1) + 1,
      };

      db.prepare(`
        UPDATE candidates
        SET
          status = COALESCE(status, ?),
          updated_at_ms = ?,
          candidate_json = ?,
          filter_result_json = ?
        WHERE id = ?
      `).run(
        passed ? 'candidate' : 'filtered',
        ts,
        json(merged),
        json(candidate.filters || {}),
        existing.id
      );

      return existing.id;
    }

    const result = db.prepare(`
      INSERT INTO candidates (
        mint,
        status,
        created_at_ms,
        updated_at_ms,
        signature,
        signal_key,
        candidate_json,
        filter_result_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      mint,
      passed ? 'candidate' : 'filtered',
      ts,
      ts,
      signature,
      signalKey,
      json({
        ...candidate,
        seenCount: 1,
        firstSeenAt: ts,
        lastSeenAt: ts,
      }),
      json(candidate.filters || {})
    );

    return Number(result.lastInsertRowid);
  })();
}

export function updateCandidateStatus(
  candidateId,
  status
) {
  db.prepare(`
    UPDATE candidates
    SET
      status = ?,
      updated_at_ms = ?
    WHERE id = ?
  `).run(status, now(), candidateId);
}

export function updateCandidateSnapshot(
  candidateId,
  candidate,
  status = null
) {
  db.prepare(`
    UPDATE candidates
    SET
      status = COALESCE(?, status),
      updated_at_ms = ?,
      candidate_json = ?,
      filter_result_json = ?
    WHERE id = ?
  `).run(
    status,
    now(),
    json(candidate),
    json(candidate.filters || {}),
    candidateId
  );
}

export function candidateById(id) {
  const row = db.prepare(`
    SELECT *
    FROM candidates
    WHERE id = ?
  `).get(id);

  return row
    ? { ...row, candidate: safeJson(row.candidate_json, {}) }
    : null;
}

export function candidatesByIds(ids = []) {
  if (!ids.length) return [];

  const placeholders = ids
    .map(() => '?')
    .join(',');

  const rows = db.prepare(`
    SELECT *
    FROM candidates
    WHERE id IN (${placeholders})
  `).all(...ids);

  return rows.map(row => ({
    ...row,
    candidate: safeJson(
      row.candidate_json,
      {}
    ),
  }));
}

export function recentEligibleCandidates(
  limit = 10
) {
  const maxAgeMs = numSetting(
    'llm_candidate_max_age_ms',
    10 * 60 * 1000
  );

  const cutoff =
    now() - Math.max(30_000, maxAgeMs);

  const rows = db.prepare(`
    SELECT *
    FROM candidates
    WHERE status IN (
      'candidate',
      'watch',
      'buy',
      'pass'
    )
      AND created_at_ms >= ?
      AND id NOT IN (
        SELECT COALESCE(candidate_id, -1)
        FROM dry_run_positions
        WHERE status = 'open'
      )
    ORDER BY created_at_ms DESC
    LIMIT ?
  `).all(cutoff, limit);

  return rows
    .map(row => ({
      ...row,
      candidate: safeJson(
        row.candidate_json,
        {}
      ),
    }))
    .reverse();
}