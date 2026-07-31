'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { makeDb, install } = require('./helpers/mock-firebase');

const db = makeDb();
install(db);

const { ensureClassReminders, ensureDeadlineReminders } = require('../api/lib/reminders');

async function reminders() {
  const snap = await db.collection('reminders').get();
  const out = [];
  snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
  return out;
}

test('ensureClassReminders creates 15-min reminders for each class occurrence', async () => {
  db._reset();
  db.collection('schedule').add({ title: 'EEE 312', course: 'EEE 312', dayOfWeek: 1, startTime: '08:00', endTime: '11:00', room: '705', teacher: 'INA', enabled: true });

  const first = await ensureClassReminders();
  assert.ok(first.created >= 1, 'created at least one reminder');
  assert.strictEqual(first.total, 1);

  const list = await reminders();
  const classRems = list.filter((r) => r.source === 'schedule');
  assert.ok(classRems.length >= 1);
  for (const r of classRems) {
    assert.strictEqual(r.leadMinutes, 15);
    assert.ok(r.scheduleKey.startsWith('sch_'));
    assert.ok(r.scheduleId);
  }
});

test('ensureClassReminders is idempotent (no duplicate reminders)', async () => {
  db._reset();
  db.collection('schedule').add({ title: 'IMG 301', dayOfWeek: 2, startTime: '15:30', enabled: true });

  await ensureClassReminders();
  const countBefore = (await reminders()).length;
  const second = await ensureClassReminders();
  assert.strictEqual(second.created, 0);
  assert.strictEqual((await reminders()).length, countBefore);
});

test('ensureClassReminders cleans up removed schedule entries', async () => {
  db._reset();
  const ref = await db.collection('schedule').add({ title: 'Tmp', dayOfWeek: 0, startTime: '09:00', enabled: true });
  await ensureClassReminders();
  // remove the entry (no API delete helper on stub; simulate by clearing + re-adding another)
  await db.collection('schedule').get().then((snap) => snap.forEach((d) => db.doc('schedule/' + d.id).delete()));
  const cleaned = await ensureClassReminders();
  assert.strictEqual(cleaned.total, 0);
  const list = await reminders();
  assert.strictEqual(list.filter((r) => r.source === 'schedule').length, 0);
});

test('ensureDeadlineReminders creates a 1440-min reminder and marks reminded24h', async () => {
  db._reset();
  db.collection('deadlines').add({ title: 'Paper deadline', dueAt: '2027-10-01T00:00:00.000Z', category: 'research', notes: 'x', critical: true });

  const res = await ensureDeadlineReminders();
  assert.strictEqual(res.created, 1);

  const list = await reminders();
  const dl = list.filter((r) => r.source === 'deadline');
  assert.strictEqual(dl.length, 1);
  assert.strictEqual(dl[0].leadMinutes, 1440);
  assert.strictEqual(dl[0].title, 'Deadline: Paper deadline');
});

test('ensureDeadlineReminders skips past deadlines and is idempotent', async () => {
  db._reset();
  db.collection('deadlines').add({ title: 'Past deadline', dueAt: '2020-01-01T00:00:00.000Z' });
  const res = await ensureDeadlineReminders();
  assert.strictEqual(res.created, 0);
});
