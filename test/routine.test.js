'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { makeDb, install } = require('./helpers/mock-firebase');

const db = makeDb();
install(db);

const { DAILY_ROUTINE, ensureDailyRoutine } = require('../lib/routine');
const { listDocs, toLocalDateStr } = require('../lib/util');

test('routine defines 2h study + 1h project blocks', () => {
  assert.strictEqual(DAILY_ROUTINE.length, 2);
  assert.ok(DAILY_ROUTINE[0].title.includes('2 hour'));
  assert.ok(DAILY_ROUTINE[1].title.includes('1 hour'));
});

test('ensureDailyRoutine creates two open tasks due today, then is idempotent', async () => {
  db._reset();
  const first = await ensureDailyRoutine();
  assert.strictEqual(first.created, 2);
  const second = await ensureDailyRoutine();
  assert.strictEqual(second.created, 0);
  const tasks = await listDocs('tasks');
  assert.strictEqual(tasks.length, 2);
  const today = toLocalDateStr(new Date().toISOString());
  for (const t of tasks) {
    assert.strictEqual(t.status, 'open');
    assert.strictEqual(t.source, 'daily-routine');
    assert.ok(t.routineKey.startsWith(today + '|'));
    assert.strictEqual(toLocalDateStr(t.dueAt), today);
  }
  assert.ok(tasks.some((t) => t.category === 'academic'));
  assert.ok(tasks.some((t) => t.category === 'research'));
});

test('manual same-title tasks do not block routine generation', async () => {
  db._reset();
  await db.collection('tasks').add({ title: 'Academic study — 2 hours', status: 'open', source: 'manual' });
  const res = await ensureDailyRoutine();
  assert.strictEqual(res.created, 2);
});
