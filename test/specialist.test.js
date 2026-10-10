'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { makeDb, install } = require('./helpers/mock-firebase');

const db = makeDb();
install(db);

const { triageMisses } = require('../lib/triage');
const { buildChecklist, scorecard } = require('../lib/trackers');
const { ensurePlaybooks, matchPlaybook } = require('../lib/playbooks');
const { buildWeeklyReview } = require('../lib/review');
const { ensureWatches, hashText } = require('../lib/watcher');
const { toLocalDateStr } = require('../lib/util');

test('triage finds overdue, stuck, and 14-day risks with options', async () => {
  db._reset();
  await db.collection('tasks').add({ title: 'Late', status: 'open', category: 'academic', dueAt: '2020-01-01T00:00:00.000Z', createdAt: '2020-01-01T00:00:00.000Z' });
  await db.collection('tasks').add({ title: 'Stuck', status: 'in_progress', category: 'research', dueAt: '2030-01-01T00:00:00.000Z', createdAt: '2020-01-01T00:00:00.000Z' });
  await db.collection('deadlines').add({ title: 'Old DL', dueAt: '2020-01-01T00:00:00.000Z', status: 'pending' });
  const out = await triageMisses();
  assert.strictEqual(out.overdueTasks.length, 1);
  assert.strictEqual(out.overdueDeadlines.length, 1);
  assert.strictEqual(out.stuckTasks.length, 1);
  assert.strictEqual(out.overdueTasks[0].options.length, 3);
});

test('checklist parses docs and scores completion', () => {
  const items = buildChecklist({ docs: 'SOP, CV, Transcripts' });
  assert.strictEqual(items.length, 3);
  assert.deepStrictEqual(buildChecklist({ docs: 'x', checklist: [{ item: 'Custom', done: true }] }), [{ item: 'Custom', done: true }]);
  const sc = scorecard({ id: 's', name: 'N', docs: 'A, B, C, D', checklist: [{ item: 'A', done: true }, { item: 'B', done: false }, { item: 'C', done: true }, { item: 'D', done: false }] });
  assert.strictEqual(sc.pct, 50);
});

test('playbooks seed and match by problem words', async () => {
  db._reset();
  const items = await ensurePlaybooks();
  assert.ok(items.length >= 6);
  const hit = matchPlaybook(items, 'professor ghosted me, no reply for weeks');
  assert.ok(hit && /ghosting/i.test(hit.title));
  assert.strictEqual(matchPlaybook(items, 'xyzzy quantum banana'), null);
});

test('review streak counts consecutive routine days', async () => {
  db._reset();
  const today = new Date();
  for (let i = 0; i < 3; i++) {
    const d = new Date(today.getTime() - i * 86400000);
    await db.collection('tasks').add({ title: 'R' + i, status: 'done', source: 'daily-routine', completedAt: d.toISOString(), category: 'academic', createdAt: d.toISOString() });
  }
  const r = await buildWeeklyReview();
  assert.strictEqual(r.routineStreak, 3);
  assert.ok(Array.isArray(r.proposal));
});

test('watcher baselines then flags changes, tolerates errors', async () => {
  db._reset();
  const orig = global.fetch;
  let body = 'hello world version one';
  global.fetch = async () => ({ ok: true, text: async () => body });
  try {
    const { checkWatches } = require('../lib/watcher');
    const first = await checkWatches();
    assert.ok(first.length >= 4);
    assert.ok(first.every((w) => w.baselined || w.error));
    body = 'hello world version TWO changed';
    const second = await checkWatches();
    assert.ok(second.some((w) => w.changed));
  } finally { global.fetch = orig; }
});

test('hashText is whitespace-insensitive', () => {
  assert.strictEqual(hashText('a  b\nc'), hashText('a b c'));
});

// ---- endpoint coverage via booted app ----
const app = require('../api/index');
let server, base, token;
async function api(path, method, body) {
  const r = await fetch(base + path, { method: method || 'GET', headers: { 'Content-Type': 'application/json', 'x-hub-token': token }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}
// Lib tests above wipe the mock DB (incl. settings/hub), so endpoint tests
// must re-acquire a token first.
async function reauth() {
  const init = await api('/api/init', 'POST', {});
  token = init.json.hubToken;
  assert.ok(token);
}

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = 'http://127.0.0.1:' + server.address().port;
  const init = await api('/api/init', 'POST', {});
  token = init.json.hubToken;
});
after(() => new Promise((r) => server.close(r)));

test('PATCH goals/deadlines/events/reminders/rhythms + snooze', async () => {
  await reauth();
  const g = await api('/api/goals', 'POST', { goal: 'G9', by: 'soon' });
  const gid = (await api('/api/goals')).json.goals.find((x) => x.goal === 'G9').id;
  assert.ok((await api('/api/goals/' + gid, 'PATCH', { by: 'later' })).json.ok);
  assert.strictEqual((await api('/api/goals/' + gid, 'PATCH', {})).status, 400);
  const e = await api('/api/events', 'POST', { title: 'E9', startAt: '2027-01-01T00:00:00.000Z' });
  const eid = e.json.event.id;
  assert.ok((await api('/api/events/' + eid, 'PATCH', { notes: 'n' })).json.ok);
  assert.ok((await api('/api/events/' + eid, 'DELETE')).json.ok);
  const rem = await api('/api/reminders', 'POST', { title: 'R9', dueAt: '2027-01-01T00:00:00.000Z' });
  const rid = rem.json.reminder.id;
  assert.ok((await api('/api/reminders/' + rid, 'PATCH', { leadMinutes: 30 })).json.ok);
  const sn = await api('/api/reminders/' + rid + '/snooze', 'POST', { hours: 48 });
  assert.ok(sn.json.ok && sn.json.dueAt);
  assert.strictEqual((await api('/api/reminders/nope', 'PATCH', { title: 'x' })).status, 404);
  const rh = await api('/api/rhythms', 'POST', { name: 'RH9', startDate: '2027-01-01', endDate: '2027-01-02', academic: 1, technical: 1 });
  assert.ok((await api('/api/rhythms/' + rh.json.rhythm.id, 'PATCH', { note: 'n' })).json.ok);
});

test('triage + scorecard + followups + watches + playbooks + review + usage + export endpoints', async () => {
  await reauth();
  assert.ok((await api('/api/triage')).json.triage);
  const s = await api('/api/scholarships', 'POST', { name: 'S9', docs: 'A, B' });
  const sid = s.json.scholarship.id;
  const sc = await api('/api/scholarships/' + sid + '/scorecard');
  assert.strictEqual(sc.json.scorecard.total, 2);
  assert.ok((await api('/api/outreach/followups')).json.followups);
  const w = await api('/api/watches', 'POST', { name: 'W9', url: 'https://example.com/x' });
  assert.ok((await api('/api/watches')).json.watches.length >= 4);
  assert.ok((await api('/api/watches/' + w.json.watch.id, 'DELETE')).json.ok);
  assert.ok((await api('/api/playbooks')).json.playbooks.length >= 6);
  assert.ok('review' in (await api('/api/review/weekly')).json);
  const u = await api('/api/usage');
  assert.ok(typeof u.json.usage.geminiCalls === 'number');
  const ex = await api('/api/export');
  assert.ok(ex.json.export.collections.tasks && ex.json.export.exportedAt);
  assert.ok(!('geminiKey' in (ex.json.export.collections['settings/hub'] || {})));
});

test('notifications read-all', async () => {
  await reauth();
  const n = await api('/api/notifications?unread=1');
  const r = await api('/api/notifications/read', 'POST', { all: true });
  assert.ok(r.json.ok && r.json.marked >= 0);
});
