'use strict';

// Miss triage (Phase 1): find slipped items and propose concrete recovery
// options. Application happens client-side / via agent tools on existing
// endpoints (PATCH dueAt, DELETE) — this module only diagnoses.

const { listDocs, daysUntil, toLocalDateStr } = require('./util');

function optionsFor(kind, id, title) {
  return [
    { action: 'reschedule_7d', label: 'Push 7 days', kind, id, title },
    { action: 'shrink_today', label: 'Shrink to a 25-min slice today', kind, id, title },
    { action: 'drop', label: 'Drop it', kind, id, title },
  ];
}

async function triageMisses() {
  const [tasks, deadlines] = await Promise.all([listDocs('tasks'), listDocs('deadlines')]);
  const todayStr = toLocalDateStr(new Date().toISOString());
  const out = { date: todayStr, overdueTasks: [], overdueDeadlines: [], stuckTasks: [], upcomingRisks: [] };
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
  for (const t of tasks) {
    if (t.status === 'done' || !t.dueAt) continue;
    if (t.dueAt.slice(0, 10) < todayStr) {
      out.overdueTasks.push({ id: t.id, title: t.title, dueAt: t.dueAt, category: t.category || '', options: optionsFor('task', t.id, t.title) });
      continue;
    }
    if (t.status === 'in_progress' && (!t.createdAt || t.createdAt < threeDaysAgo)) {
      out.stuckTasks.push({ id: t.id, title: t.title, dueAt: t.dueAt, options: optionsFor('task', t.id, t.title) });
    }
  }
  for (const d of deadlines) {
    if (!d.dueAt || d.archived) continue;
    if (d.dueAt.slice(0, 10) < todayStr && (d.status || 'pending') !== 'done') {
      out.overdueDeadlines.push({ id: d.id, title: d.title, dueAt: d.dueAt, critical: !!d.critical, options: optionsFor('deadline', d.id, d.title) });
    } else {
      const days = daysUntil(d.dueAt);
      if (days !== null && days >= 0 && days <= 14) {
        out.upcomingRisks.push({ id: d.id, title: d.title, dueAt: d.dueAt, days, critical: !!d.critical });
      }
    }
  }
  out.upcomingRisks.sort((a, b) => (b.critical - a.critical) || (a.days - b.days));
  return out;
}

module.exports = { triageMisses, optionsFor };
