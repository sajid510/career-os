'use strict';

// Proactive slip detector (Phase B): at most one advisory notification per day,
// only when something actually slipped. Called from POST /api/cron/daily.

const { nowIso, addDoc, listDocs, daysUntil, inDays, toLocalDateStr } = require('./util');
const { bumpStat } = require('./learning');

async function detectSlips() {
  const todayStr = toLocalDateStr(new Date().toISOString());
  const notifs = await listDocs('notifications');
  const already = notifs.some((n) => n.source === 'proactive' && n.createdAt && toLocalDateStr(n.createdAt) === todayStr);
  if (already) return { sent: false, reason: 'already-sent-today' };

  const [tasks, deadlines] = await Promise.all([listDocs('tasks'), listDocs('deadlines')]);
  const slips = [];
  const overdueTasks = tasks.filter((t) => t.status !== 'done' && t.dueAt && new Date(t.dueAt).getTime() < Date.now() - 24 * 3600000);
  if (overdueTasks.length) slips.push(overdueTasks.length + ' overdue task' + (overdueTasks.length === 1 ? '' : 's') + ' (' + overdueTasks.slice(0, 3).map((t) => t.title).join('; ') + ')');
  const urgent = deadlines.filter((d) => d.dueAt && daysUntil(d.dueAt) >= 0 && daysUntil(d.dueAt) <= 7);
  if (urgent.length) slips.push(urgent.length + ' deadline' + (urgent.length === 1 ? '' : 's') + ' within 7 days (' + urgent.slice(0, 3).map((d) => d.title + ' ' + inDays(d.dueAt)).join('; ') + ')');
  const stale = tasks.filter((t) => t.status === 'in_progress' && t.dueAt && new Date(t.dueAt).getTime() < Date.now() - 3 * 24 * 3600000);
  if (stale.length) slips.push(stale.length + ' task' + (stale.length === 1 ? '' : 's') + ' stuck in-progress 3+ days');
  if (!slips.length) return { sent: false, reason: 'nothing-slipping' };

  const body = 'Slipping: ' + slips.join('. ') + '. Ask Pulse "what should I focus on?" for a recovery plan, or reply to adjust deadlines.';
  await addDoc('notifications', { title: 'Heads-up: plan slipping', body, type: 'agent', level: 'warn', read: false, createdAt: nowIso(), source: 'proactive' });
  await bumpStat('proactiveSent');
  return { sent: true, slips: slips.length };
}

module.exports = { detectSlips };
