'use strict';

// Daily routine generator: 2h academic study + 1h project work, completable any time.
// Called by POST /api/cron/daily (07:00 Dhaka) and POST /api/routine/today.
// Idempotent per Dhaka day via routineKey; completions feed self-learning like any task.

const { nowIso, addDoc, listDocs, toLocalDateStr, dhakaParts, dhakaIso } = require('./util');

const DAILY_ROUTINE = [
  {
    title: 'Academic study — 2 hours',
    category: 'academic',
    priority: 'high',
    description: 'Focused academic study (any 2 hours today). Syllabus, backlog retakes, assignments.',
  },
  {
    title: 'Project / technical work — 1 hour',
    category: 'research',
    priority: 'high',
    description: 'Hands-on project or technical work (any 1 hour today). Robot, paper, portfolio, code.',
  },
];

async function ensureDailyRoutine() {
  const parts = dhakaParts(Date.now());
  const todayStr = toLocalDateStr(new Date().toISOString());
  const dueAt = dhakaIso(parts.y, parts.m, parts.day, 23, 59);
  const tasks = await listDocs('tasks');
  let created = 0;
  for (const r of DAILY_ROUTINE) {
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
      outcome: '',
      rating: 0,
      completedAt: '',
      createdAt: nowIso(),
    });
    created++;
  }
  return { created, date: todayStr };
}

module.exports = { DAILY_ROUTINE, ensureDailyRoutine };
