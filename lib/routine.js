'use strict';

// Daily routine generator with per-weekday targets (Dhaka day).
// Fri/Sat/Sun: 3h academic ・ Thu: no academic block ・ other days: 2h.
// Fri/Sat: 2.5h project ・ all other days: 1h.
// Called by POST /api/cron/daily (07:00 Dhaka) and POST /api/routine/today.
// Idempotent per Dhaka day via routineKey; completions feed self-learning.

const { nowIso, addDoc, listDocs, toLocalDateStr, dhakaParts, dhakaIso } = require('./util');

// Index = JS day-of-week of the Dhaka date (0=Sunday).
const ROUTINE_BY_DOW = [
  { academic: 3, technical: 1 }, // Sunday
  { academic: 2, technical: 1 }, // Monday
  { academic: 2, technical: 1 }, // Tuesday
  { academic: 2, technical: 1 }, // Wednesday
  { academic: 0, technical: 1 }, // Thursday (no academic block)
  { academic: 3, technical: 2.5 }, // Friday
  { academic: 3, technical: 2.5 }, // Saturday
];

function fmtHours(h) {
  const n = h % 1 === 0 ? String(h) : h.toFixed(1);
  return n + (h === 1 ? ' hour' : ' hours');
}

function routineForDow(dow) {
  const cfg = ROUTINE_BY_DOW[dow] || { academic: 2, technical: 1 };
  return entriesFromConfig(cfg, '');
}

// Time-varying overrides (prep leave, semester break, new semesters).
// Doc: { name, startDate/endDate 'YYYY-MM-DD', academic/technical: hours number | 'full' | 0, note, status }.
// 'full' = open-ended full-day focus (targetSeconds 0, count-up timer, manual completion).
async function getActiveRhythm(todayStr) {
  const all = await listDocs('rhythms');
  const hit = all
    .filter((r) => (r.status || 'active') === 'active' && r.startDate && r.endDate && r.startDate <= todayStr && todayStr <= r.endDate)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
  return hit || null;
}

function entriesFromConfig(cfg, suffix) {
  const out = [];
  const suf = suffix ? ' (' + suffix + ')' : '';
  if (cfg.academic === 'full') {
    out.push({
      key: 'study', title: 'Academic study — full day' + suf, category: 'academic',
      priority: 'critical', targetSeconds: 0,
      description: 'Full-day academic focus. Timer counts up; complete the task manually at day end.',
    });
  } else if (cfg.academic > 0) {
    out.push({
      key: 'study', title: 'Academic study — ' + fmtHours(cfg.academic) + suf, category: 'academic',
      priority: 'high', targetSeconds: Math.round(cfg.academic * 3600),
      description: 'Focused academic study. Syllabus, backlog retakes, assignments.',
    });
  }
  if (cfg.technical === 'full') {
    out.push({
      key: 'project', title: 'Project / technical work — full day' + suf, category: 'research',
      priority: 'critical', targetSeconds: 0,
      description: 'Full-day project/research focus. Timer counts up; complete manually at day end.',
    });
  } else if (cfg.technical > 0) {
    out.push({
      key: 'project', title: 'Project / technical work — ' + fmtHours(cfg.technical) + suf, category: 'research',
      priority: 'high', targetSeconds: Math.round(cfg.technical * 3600),
      description: 'Hands-on project or technical work. Robot, paper, portfolio, code.',
    });
  }
  return out;
}

async function ensureDailyRoutine() {
  const parts = dhakaParts(Date.now());
  const todayStr = toLocalDateStr(new Date().toISOString());
  const dueAt = dhakaIso(parts.y, parts.m, parts.day, 23, 59);
  const override = await getActiveRhythm(todayStr);
  const entries = override ? entriesFromConfig({ academic: override.academic, technical: override.technical }, override.name) : routineForDow(parts.dow);
  const tasks = await listDocs('tasks');
  let created = 0;
  for (const r of entries) {
    const key = todayStr + '|' + r.title;
    const exists = tasks.some((t) => t.source === 'daily-routine' && t.routineKey === key);
    if (exists) continue;
    await addDoc('tasks', {
      title: r.title,
      description: r.description,
      dueAt,
      category: r.category,
      priority: r.priority,
      phase: '',
      status: 'open',
      source: 'daily-routine',
      routineKey: key,
      targetSeconds: r.targetSeconds,
      outcome: '',
      rating: 0,
      completedAt: '',
      createdAt: nowIso(),
    });
    created++;
  }
  return { created, date: todayStr, entries: entries.map((e) => e.title), rhythm: override ? override.name : 'default' };
}

// Short description of today's rhythm for prompts, briefs and get_today.
async function describeRhythm() {
  const todayStr = toLocalDateStr(new Date().toISOString());
  const override = await getActiveRhythm(todayStr).catch(() => null);
  if (override) {
    return { mode: 'override', name: override.name, academic: override.academic, technical: override.technical, until: override.endDate };
  }
  const dow = dhakaParts(Date.now()).dow;
  const cfg = ROUTINE_BY_DOW[dow] || { academic: 2, technical: 1 };
  return { mode: 'default', name: 'weekly rhythm', academic: cfg.academic, technical: cfg.technical, until: '' };
}

module.exports = { ROUTINE_BY_DOW, routineForDow, entriesFromConfig, getActiveRhythm, describeRhythm, ensureDailyRoutine };
