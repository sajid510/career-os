'use strict';

// Phase 1 self-learning memory layer (free-tier, Firestore-only, no vector DB).
// Single writer for learning_events / learning_facts / learning/stats so that
// REST routes (api/index.js) and agent tools (api/lib/gemini.js) stay consistent.
// Uses only getDoc/setDoc/addDoc/listDocs/deleteDoc from util.js so the
// in-memory mock in test/helpers/mock-firebase.js keeps working (no .where()).

const {
  nowIso,
  getDoc,
  setDoc,
  addDoc,
  listDocs,
  deleteDoc,
  dhakaParts,
  toLocalDateStr,
} = require('./util');

const EVENT_TYPES = ['task_outcome', 'feedback', 'correction', 'preference', 'struggle'];
const FACT_STATUSES = ['active', 'superseded', 'forgotten'];
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'have', 'has', 'was', 'were',
  'are', 'but', 'not', 'you', 'your', 'his', 'her', 'she', 'him', 'our', 'out',
  'about', 'into', 'over', 'after', 'before', 'very', 'more', 'most', 'than',
  'then', 'them', 'they', 'will', 'would', 'should', 'could', 'when', 'where',
]);

function normalizeType(t) {
  const v = String(t || '').toLowerCase().trim();
  return EVENT_TYPES.includes(v) ? v : 'feedback';
}

function clampStrength(n) {
  const v = parseInt(n, 10);
  if (!Number.isFinite(v)) return 3;
  return Math.max(1, Math.min(5, v));
}

function clampRating(n) {
  const v = Number(n) || 0;
  if (v <= 0) return 0;
  return Math.max(1, Math.min(5, Math.round(v)));
}

// Lightweight keyword tags, no embeddings / no extra infra.
function extractTags(text) {
  const words = String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  const uniq = [];
  for (const w of words) {
    if (!uniq.includes(w)) uniq.push(w);
    if (uniq.length >= 12) break;
  }
  return uniq;
}

function dhakaContext(dateIso) {
  const ms = dateIso ? new Date(dateIso).getTime() : Date.now();
  const p = dhakaParts(ms);
  return { dow: p.dow, hour: p.h, dateStr: toLocalDateStr(new Date(ms).toISOString()) };
}

async function bumpStat(kind) {
  const allowed = ['taskOutcomes', 'feedbackCount', 'corrections', 'facts'];
  const key = allowed.includes(kind) ? kind : 'taskOutcomes';
  const s = (await getDoc('learning/stats')) || {};
  s[key] = (s[key] || 0) + 1;
  s.lastUpdated = nowIso();
  await setDoc('learning/stats', s, false);
  return s;
}

async function logEvent(input) {
  const type = normalizeType(input.type);
  const text = String(input.text || '').slice(0, 2000);
  const ctx = dhakaContext();
  const rec = await addDoc('learning_events', {
    ts: nowIso(),
    type,
    entity: input.entity || 'general',
    entityId: input.entityId || '',
    text,
    rating: clampRating(input.rating),
    correction: String(input.correction || '').slice(0, 2000),
    category: String(input.category || ''),
    phase: String(input.phase || ''),
    tags: extractTags(text + ' ' + (input.correction || '')),
    dow: ctx.dow,
    hour: ctx.hour,
    dateStr: ctx.dateStr,
  });
  return rec;
}

async function logTaskOutcome({ taskId, title, outcome, rating, category, phase }) {
  const rec = await logEvent({
    type: 'task_outcome',
    entity: 'task',
    entityId: taskId || '',
    text: 'Completed: ' + (title || taskId || 'task') + (outcome ? ' | ' + outcome : ''),
    rating,
    category,
    phase,
  });
  await bumpStat('taskOutcomes');
  return rec;
}

async function logFeedback({ entity, entityId, text, rating, correction, category }) {
  const hasCorrection = !!(correction && String(correction).trim());
  const rec = await logEvent({
    type: hasCorrection ? 'correction' : 'feedback',
    entity: entity || 'general',
    entityId: entityId || '',
    text: text || '',
    rating,
    correction: correction || '',
    category,
  });
  await bumpStat('feedbackCount');
  if (hasCorrection) await bumpStat('corrections');
  // Immediate correction: don't wait for the monthly cron.
  let autoFact = null;
  if (hasCorrection) {
    autoFact = await recordFact({
      fact: 'Correction: ' + String(correction).slice(0, 500),
      strength: 4,
      source: 'correction',
      tags: extractTags(correction),
    });
  }
  return { event: rec, autoFact };
}

// Dedupe on normalized fact text: reinforce instead of duplicating.
async function recordFact({ fact, strength, source, tags }) {
  const clean = String(fact || '').trim().slice(0, 1000);
  if (!clean) throw new Error('fact required');
  const existing = await listDocs('learning_facts');
  const dup = existing.find(
    (f) => f.status !== 'forgotten' && String(f.fact || '').trim().toLowerCase() === clean.toLowerCase()
  );
  if (dup) {
    const next = {
      ...dup,
      confirmCount: (dup.confirmCount || 1) + 1,
      strength: Math.max(dup.strength || 3, clampStrength(strength)),
      lastUsed: nowIso(),
      status: 'active',
    };
    await setDoc('learning_facts/' + dup.id, next, false);
    return { id: dup.id, ...next, reinforced: true };
  }
  const rec = await addDoc('learning_facts', {
    fact: clean,
    strength: clampStrength(strength),
    source: source || 'agent',
    tags: Array.isArray(tags) && tags.length ? tags.slice(0, 12) : extractTags(clean),
    status: 'active',
    confirmCount: 1,
    createdAt: nowIso(),
    lastUsed: nowIso(),
  });
  await bumpStat('facts');
  return rec;
}

async function reinforceFact(id) {
  const doc = await getDoc('learning_facts/' + id);
  if (!doc) throw new Error('fact not found');
  const next = {
    ...doc,
    confirmCount: (doc.confirmCount || 1) + 1,
    strength: Math.min(5, (doc.strength || 3) + 1),
    lastUsed: nowIso(),
    status: 'active',
  };
  await setDoc('learning_facts/' + id, next, false);
  return { id, ...next };
}

async function forgetFact(id) {
  const doc = await getDoc('learning_facts/' + id);
  if (!doc) throw new Error('fact not found');
  const next = { ...doc, status: 'forgotten', lastUsed: nowIso() };
  await setDoc('learning_facts/' + id, next, false);
  return { ok: true, id };
}

// Merge Gemini-distilled facts instead of wiping the collection (old bug).
async function upsertRefinedFacts(arr) {
  const list = Array.isArray(arr) ? arr : [];
  let added = 0;
  let reinforced = 0;
  for (const f of list.slice(0, 10)) {
    if (!f || !f.fact) continue;
    const r = await recordFact({
      fact: String(f.fact).slice(0, 1000),
      strength: clampStrength(f.strength),
      source: 'auto-refine',
    });
    if (r.reinforced) reinforced++;
    else added++;
  }
  const stats = (await getDoc('learning/stats')) || {};
  stats.facts = (await listDocs('learning_facts')).filter((f) => f.status !== 'forgotten').length;
  stats.lastUpdated = nowIso();
  await setDoc('learning/stats', stats, false);
  return { added, reinforced, total: stats.facts };
}

function scoreFacts(facts, ctx) {
  const c = ctx || {};
  const ctxTags = new Set([
    ...extractTags(c.query || ''),
    ...(c.category ? [String(c.category).toLowerCase()] : []),
    ...(c.phase ? [String(c.phase).toLowerCase()] : []),
  ]);
  const now = Date.now();
  return facts
    .filter((f) => (f.status || 'active') === 'active')
    .map((f) => {
      const tags = Array.isArray(f.tags) ? f.tags : [];
      let overlap = 0;
      for (const t of tags) if (ctxTags.has(String(t).toLowerCase())) overlap++;
      const ageDays = f.lastUsed ? Math.max(0, (now - new Date(f.lastUsed).getTime()) / 86400000) : 30;
      const score = overlap * 3 + (f.strength || 3) * 0.5 + (f.confirmCount || 1) * 0.3 - ageDays * 0.02;
      return { ...f, _score: score, _overlap: overlap };
    })
    .sort((a, b) => b._score - a._score);
}

async function getRelevantFacts({ limit, phase, category, query } = {}) {
  const n = Math.max(1, Math.min(20, limit || 12));
  const facts = await listDocs('learning_facts');
  return scoreFacts(facts, { phase, category, query }).slice(0, n);
}

async function getMemorySnapshot(n) {
  const stats = await getDoc('learning/stats');
  const facts = await listDocs('learning_facts');
  const events = await listDocs('learning_events');
  return {
    stats: stats || {},
    facts: facts.filter((f) => (f.status || 'active') === 'active'),
    recentEvents: events.sort((a, b) => (b.ts || '').localeCompare(a.ts || '')).slice(0, n || 10),
  };
}

module.exports = {
  EVENT_TYPES,
  FACT_STATUSES,
  normalizeType,
  clampStrength,
  clampRating,
  extractTags,
  dhakaContext,
  bumpStat,
  logEvent,
  logTaskOutcome,
  logFeedback,
  recordFact,
  reinforceFact,
  forgetFact,
  upsertRefinedFacts,
  scoreFacts,
  getRelevantFacts,
  getMemorySnapshot,
};
