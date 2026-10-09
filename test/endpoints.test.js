'use strict';

// API integration tests: boot the real Express app (mocked Firestore) on an
// ephemeral port and exercise the surgical-sync endpoints.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { makeDb, install } = require('./helpers/mock-firebase');

const db = makeDb();
install(db);

const app = require('../api/index');

let server;
let base;
let token;

async function api(path, method, body, tok) {
  const r = await fetch(base + path, {
    method: method || 'GET',
    headers: { 'Content-Type': 'application/json', 'x-hub-token': tok === undefined ? token : tok },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, json: j };
}

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = 'http://127.0.0.1:' + server.address().port;
  const init = await api('/api/init', 'POST', {}, '');
  assert.ok(init.json.hubToken);
  token = init.json.hubToken;
});

after(() => new Promise((r) => server.close(r)));

test('unauthorized without token', async () => {
  const r = await api('/api/milestones', 'GET', null, 'wrong');
  assert.strictEqual(r.status, 401);
});

test('milestones: create, list, toggle, delete', async () => {
  const c = await api('/api/milestones', 'POST', { title: 'M1', dueAt: '2027-01-01T00:00:00.000Z', phase: 'X' });
  assert.ok(c.json.ok && c.json.milestone.id);
  const id = c.json.milestone.id;
  assert.strictEqual(c.json.milestone.status, 'pending');
  const t1 = await api('/api/milestones/' + id + '/toggle', 'POST', {});
  assert.strictEqual(t1.json.status, 'done');
  const del = await api('/api/milestones/' + id, 'DELETE');
  assert.ok(del.json.ok);
  const list = await api('/api/milestones');
  assert.ok(!list.json.milestones.some((m) => m.id === id));
});

test('milestones: create requires title', async () => {
  const r = await api('/api/milestones', 'POST', {});
  assert.strictEqual(r.status, 400);
});

test('goals: create and delete', async () => {
  const c = await api('/api/goals', 'POST', { goal: 'G1', by: 'soon' });
  assert.ok(c.json.ok);
  const list = await api('/api/goals');
  const g = list.json.goals.find((x) => x.goal === 'G1');
  assert.ok(g);
  assert.ok((await api('/api/goals/' + g.id, 'DELETE')).json.ok);
});

test('phases: patch status and focus', async () => {
  await db.collection('phases').add({ key: 'Restart', label: 'R', status: 'active', focus: ['a'] });
  const list = await api('/api/phases');
  const ph = list.json.phases.find((x) => x.key === 'Restart');
  const p = await api('/api/phases/' + ph.id, 'PATCH', { status: 'done', focus: ['b'] });
  assert.ok(p.json.ok);
  const afterList = await api('/api/phases');
  const updated = afterList.json.phases.find((x) => x.id === ph.id);
  assert.strictEqual(updated.status, 'done');
  assert.deepStrictEqual(updated.focus, ['b']);
  assert.strictEqual((await api('/api/phases/nope', 'PATCH', { status: 'x' })).status, 404);
  assert.strictEqual((await api('/api/phases/' + ph.id, 'PATCH', {})).status, 400);
});

test('overview dueToday works in the evening Dhaka window (no double timezone shift)', async () => {
  const RealDate = Date;
  const frozen = Date.parse('2026-10-07T15:32:00.000Z');
  global.Date = class extends RealDate {
    constructor(...a) { super(...(a.length ? a : [frozen])); }
    static now() { return frozen; }
  };
  try {
    await db.collection('tasks').add({ title: 'Evening probe', status: 'open', category: 'general', priority: 'low', dueAt: '2026-10-07T17:59:00.000Z' });
    const o = await api('/api/overview');
    assert.strictEqual(o.json.today, '2026-10-07');
    assert.ok(o.json.dueTodayTasks.some((t) => t.title === 'Evening probe'), 'evening task is due today');
  } finally {
    global.Date = RealDate;
  }
});
