'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { makeDb, install } = require('./helpers/mock-firebase');

const db = makeDb();
install(db);

const { syncClassroom } = require('../lib/classroom');
const { listDocs, getDoc, setDoc } = require('../lib/util');

const COURSE = { id: 'c1', name: 'EEE-320(B2)' };
const WORK = { id: 'w1', title: 'Assignment 7', state: 'PUBLISHED', dueDate: { year: 2026, month: 4, day: 20 }, dueTime: { hours: 17, minutes: 59 } };

function mockClassroom() {
  const orig = global.fetch;
  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes('classroom.googleapis.com/v1/courses?')) return { ok: true, json: async () => ({ courses: [COURSE] }) };
    if (u.includes('/courseWork')) return { ok: true, json: async () => ({ courseWork: [WORK] }) };
    if (u.includes('/announcements')) return { ok: true, json: async () => ({ announcements: [] }) };
    throw new Error('unexpected fetch: ' + u);
  };
  return () => { global.fetch = orig; };
}

async function connect() {
  await setDoc('settings/hub', {
    classroomRefreshToken: 'rt', classroomAccessToken: 'tok',
    classroomTokenExpiry: Date.now() + 3600000,
    classroomClientId: 'id', classroomClientSecret: 's',
  }, false);
}

test('sync creates one deadline per coursework, idempotent across runs', async () => {
  db._reset();
  await connect();
  const restore = mockClassroom();
  try {
    const r1 = await syncClassroom();
    assert.strictEqual(r1.newDeadlines, 1);
    const r2 = await syncClassroom();
    assert.strictEqual(r2.newDeadlines, 0);
    const all = await listDocs('deadlines');
    assert.strictEqual(all.length, 1);
    assert.strictEqual(all[0].sourceId, 'w1');
  } finally { restore(); }
});

test('legacy rows without sourceId are healed, never duplicated', async () => {
  db._reset();
  await connect();
  await db.collection('deadlines').add({
    title: 'Assignment 7', dueAt: '2026-04-20T11:59:00.000Z', category: 'classroom',
    notes: 'Google Classroom · EEE-320(B2)', status: 'pending', source: 'classroom',
  });
  const restore = mockClassroom();
  try {
    const r = await syncClassroom();
    assert.strictEqual(r.newDeadlines, 0);
    const all = await listDocs('deadlines');
    assert.strictEqual(all.length, 1);
    assert.strictEqual(all[0].sourceId, 'w1');
    assert.strictEqual(all[0].title, 'Assignment 7');
    const r2 = await syncClassroom();
    assert.strictEqual((await listDocs('deadlines')).length, 1);
    assert.strictEqual(r2.newDeadlines, 0);
  } finally { restore(); }
});
