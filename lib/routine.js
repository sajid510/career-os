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
  const out = [];
  if (cfg.academic > 0) {
    out.push({
      key: 'study', title: 'Academic study — ' + fmtHours(cfg.academic), category: 'academic',
      priority: 'high', targetSeconds: Math.round(cfg.academic * 3600),
      description: 'Focused academic study. Syllabus, backlog retakes, assignments.',
    });
  }
  if (cfg.technical > 0) {
    out.push({
      key: 'project', title: 'Project / technical work — ' + fmtHours(cfg.technical), category: 'research',
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
  const entries = routineForDow(parts.dow);
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
  return { created, date: todayStr, entries: entries.map((e) => e.title) };
}

module.exports = { ROUTINE_BY_DOW, routineForDow, ensureDailyRoutine };
