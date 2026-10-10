'use strict';

// Weekly review 2.0: counts become coaching — per-category completion,
// routine streaks, and a proposed next-week focus.
const { nowIso, addDoc, listDocs, deleteDoc, daysUntil, toLocalDateStr } = require('./util');
const { bumpStat } = require('./learning');

async function buildWeeklyReview() {
  const tasks = await listDocs('tasks');
  const deadlines = await listDocs('deadlines');
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const done = tasks.filter((t) => t.status === 'done' && t.completedAt && t.completedAt >= weekAgo);
  const byCategory = {};
  for (const t of done) byCategory[t.category || 'general'] = (byCategory[t.category || 'general'] || 0) + 1;
  // Routine streaks: consecutive Dhaka days with a completed daily-routine task.
  const routineDays = new Set(
    tasks.filter((t) => t.source === 'daily-routine' && t.status === 'done' && t.completedAt).map((t) => toLocalDateStr(t.completedAt))
  );
  let streak = 0;
  const cursor = new Date();
  if (!routineDays.has(toLocalDateStr(cursor.toISOString()))) cursor.setDate(cursor.getDate() - 1);
  while (routineDays.has(toLocalDateStr(cursor.toISOString()))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  // Proposal: top overdue (2) + nearest critical deadline.
  const todayStr = toLocalDateStr(new Date().toISOString());
  const overdue = tasks.filter((t) => t.status !== 'done' && t.dueAt && t.dueAt.slice(0, 10) < todayStr).slice(0, 2).map((t) => t.title);
  const crit = deadlines.filter((d) => d.critical && d.dueAt && daysUntil(d.dueAt) >= 0).sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
  const proposal = overdue.concat(crit ? ['Prepare: ' + crit.title] : []).slice(0, 3);
  const review = {
    createdAt: nowIso(), completed7d: done.length, byCategory, routineStreak: streak, proposal,
    openTasks: tasks.filter((t) => t.status !== 'done').length,
  };
  await setDocReview(review);
  return review;
}

async function setDocReview(review) {
  const { setDoc } = require('./util');
  await setDoc('review/weekly', Object.assign({}, review, { updatedAt: nowIso() }), false);
}

async function archiveClassroomPast() {
  const items = await listDocs('deadlines');
  const todayStr = toLocalDateStr(new Date().toISOString());
  let archived = 0;
  for (const d of items) {
    if (d.category === 'classroom' && !d.archived && d.dueAt && d.dueAt.slice(0, 10) < todayStr) {
      const { setDoc } = require('./util');
      await setDoc('deadlines/' + d.id, { archived: true });
      archived++;
    }
  }
  return { archived };
}

module.exports = { buildWeeklyReview, archiveClassroomPast };
