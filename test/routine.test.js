'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { makeDb, install } = require('./helpers/mock-firebase');

const db = makeDb();
install(db);

const { ROUTINE_BY_DOW, routineForDow, ensureDailyRoutine } = require('../lib/routine');
const { listDocs, toLocalDateStr, dhakaParts } = require('../lib/util');

test('weekday table matches the agreed schedule', () => {
  assert.deepStrictEqual(ROUTINE_BY_DOW[0], { academic: 3, technical: 1 }); // Sun
  assert.deepStrictEqual(ROUTINE_BY_DOW[4], { academic: 0, technical: 1 }); // Thu: no academic
  assert.deepStrictEqual(ROUTINE_BY_DOW[5], { academic: 3, technical: 2.5 }); // Fri
  assert.deepStrictEqual(ROUTINE_BY_DOW[6], { academic: 3, technical: 2.5 }); // Sat
  for (const d of [1, 2, 3]) assert.deepStrictEqual(ROUTINE_BY_DOW[d], { academic: 2, technical: 1 });
});

test('routineForDow builds titled entries with second-precise targets', () => {
  const fri = routineForDow(5);
  assert.strictEqual(fri.length, 2);
  assert.ok(fri[0].title.includes('3 hours'));
  assert.strictEqual(fri[0].targetSeconds, 10800);
  assert.ok(fri[1].title.includes('2.5 hours'));
  assert.strictEqual(fri[1].targetSeconds, 9000);
  const thu = routineForDow(4);
  assert.strictEqual(thu.length, 1);
  assert.ok(thu[0].title.includes('Project'));
  assert.strictEqual(thu[0].targetSeconds, 3600);
});

test('ensureDailyRoutine creates the weekday entries with targetSeconds, idempotent', async () => {
  db._reset();
  const dow = dhakaParts(Date.now()).dow;
  const expected = routineForDow(dow);
  const first = await ensureDailyRoutine();
  assert.strictEqual(first.created, expected.length);
  assert.strictEqual((await ensureDailyRoutine()).created, 0);
  const tasks = await listDocs('tasks');
  assert.strictEqual(tasks.length, expected.length);
  const today = toLocalDateStr(new Date().toISOString());
  for (const t of tasks) {
    assert.strictEqual(t.status, 'open');
    assert.strictEqual(t.source, 'daily-routine');
    assert.ok(t.routineKey.startsWith(today + '|'));
    assert.ok(t.targetSeconds > 0);
    assert.strictEqual(toLocalDateStr(t.dueAt), today);
  }
});

test('manual same-title tasks do not block routine generation', async () => {
  db._reset();
  await db.collection('tasks').add({ title: 'Academic study — 2 hours', status: 'open', source: 'manual' });
  const dow = dhakaParts(Date.now()).dow;
  const res = await ensureDailyRoutine();
  assert.strictEqual(res.created, routineForDow(dow).length);
});
