'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { makeDb, install } = require('./helpers/mock-firebase');

const db = makeDb();
install(db);

const { executeTool, TOOL_DEFS, resilientCall } = require('../lib/gemini');
const { detectSlips } = require('../lib/proactive');
const { judgeRecentConversations } = require('../lib/eval');
const { listDocs, addDoc, setDoc } = require('../lib/util');

test('tool catalog grew: tracker, delete, routine, notes, profile tools exist', () => {
  const names = TOOL_DEFS.map((t) => t.name);
  for (const n of ['delete_task', 'delete_deadline', 'toggle_milestone', 'run_daily_routine',
    'list_scholarships', 'add_scholarship', 'update_scholarship', 'list_universities', 'update_university',
    'list_professors', 'update_professor', 'get_cgpa', 'update_cgpa', 'list_notes', 'add_note',
    'search_notes', 'update_profile', 'get_relevant_memory']) {
    assert.ok(names.includes(n), 'tool present: ' + n);
  }
});

test('delete_task / delete_deadline remove docs (confirmation is a prompt rule)', async () => {
  db._reset();
  const t = await addDoc('tasks', { title: 'Temp task', status: 'open' });
  assert.ok((await executeTool('delete_task', { taskId: t.id })).ok);
  assert.strictEqual((await executeTool('delete_task', { taskId: t.id })).error, 'task not found');
  const d = await addDoc('deadlines', { title: 'Temp dl', dueAt: '2027-01-01T00:00:00.000Z' });
  assert.ok((await executeTool('delete_deadline', { deadlineId: d.id })).ok);
});

test('add_scholarship creates entries with defaults, requires name', async () => {
  db._reset();
  assert.ok((await executeTool('add_scholarship', {})).error);
  const r = await executeTool('add_scholarship', { name: 'Test Sch', country: 'X' });
  assert.ok(r.ok && r.scholarship.id);
  const items = await listDocs('scholarships');
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].status, 'Research');
  assert.strictEqual(items[0].priority, 'B');
});

test('toggle_milestone flips by title, update_scholarship patches allowlist', async () => {
  db._reset();
  await addDoc('milestones', { title: 'Test Milestone', status: 'pending' });
  const r1 = await executeTool('toggle_milestone', { title: 'test milestone' });
  assert.strictEqual(r1.status, 'done');
  const s = await addDoc('scholarships', { name: 'Test Sch', status: 'Research' });
  assert.ok((await executeTool('update_scholarship', { scholarshipId: s.id, status: 'Applied', bogus: 1 })).ok);
  const after = await listDocs('scholarships');
  assert.strictEqual(after[0].status, 'Applied');
  assert.strictEqual(after[0].bogus, undefined);
});

test('add_note creates notebook, search_notes ranks keyword hits', async () => {
  db._reset();
  assert.ok((await executeTool('add_note', { notebook: 'Research Notes', title: 'SLAM tuning', content: 'LiDAR IMU fusion params' })).ok);
  const r = await executeTool('search_notes', { query: 'lidar fusion' });
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].title, 'SLAM tuning');
  assert.ok((await executeTool('search_notes', { query: 'quantum xyz' })).hits.length === 0);
});

test('update_cgpa and update_profile patch narrowly', async () => {
  db._reset();
  await setDoc('mission/cgpa', { cgpa: 2.59, backlogs: [] }, false);
  assert.ok((await executeTool('update_cgpa', { notes: 'agent note' })).ok);
  assert.ok((await executeTool('update_cgpa', { backlogs: 'not json' })).error);
  assert.ok((await executeTool('update_profile', { headline: 'New headline' })).ok);
  assert.ok((await executeTool('update_profile', {})).error);
});

test('resilientCall retries then succeeds without fallback', async () => {
  db._reset();
  await setDoc('settings/hub', { geminiKey: 'k', geminiModel: 'm' }, false);
  let calls = 0;
  const orig = global.fetch;
  global.fetch = async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 429, text: async () => 'RESOURCE_EXHAUSTED' };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'hi' }] } }] }) };
  };
  try {
    const out = await resilientCall('sys', [{ role: 'user', parts: [{ text: 'hi' }] }], []);
    assert.strictEqual(out.parts[0].text, 'hi');
    assert.strictEqual(calls, 2);
  } finally { global.fetch = orig; }
});

test('resilientCall falls back to Lite model after repeated 429s', async () => {
  db._reset();
  await setDoc('settings/hub', { geminiKey: 'k', geminiModel: 'main-m', judgeModel: 'lite-m' }, false);
  const seen = [];
  const orig = global.fetch;
  global.fetch = async (url) => {
    seen.push(url);
    if (url.includes('lite-m')) return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'lite-hi' }] } }] }) };
    return { ok: false, status: 429, text: async () => 'RESOURCE_EXHAUSTED' };
  };
  try {
    const out = await resilientCall('sys', [{ role: 'user', parts: [{ text: 'hi' }] }], []);
    assert.strictEqual(out.parts[0].text, 'lite-hi');
    assert.ok(seen.some((u) => u.includes('lite-m')));
    const stats = await require('../lib/util').getDoc('learning/stats');
    assert.ok((stats.geminiFallbacks || 0) >= 1);
  } finally { global.fetch = orig; }
});

test('detectSlips notifies once per day only when slipping', async () => {
  db._reset();
  assert.deepStrictEqual((await detectSlips()).reason, 'nothing-slipping');
  await addDoc('tasks', { title: 'Overdue thing', status: 'open', dueAt: '2020-01-01T00:00:00.000Z' });
  const r1 = await detectSlips();
  assert.strictEqual(r1.sent, true);
  assert.strictEqual((await detectSlips()).reason, 'already-sent-today');
});

test('rhythm tools: set validates, list shows, delete removes', async () => {
  db._reset();
  const ok = await executeTool('set_rhythm_override', { name: 'Prep', startDate: '2026-11-05', endDate: '2026-11-14', academic: 'full', technical: '0', note: 'x' });
  assert.ok(ok.ok && ok.rhythm.id);
  assert.ok((await executeTool('set_rhythm_override', { name: 'Bad', startDate: 'Nov 5', endDate: '2026-11-14', academic: 2, technical: 1 })).error);
  assert.ok((await executeTool('set_rhythm_override', { name: 'Back', startDate: '2026-11-14', endDate: '2026-11-05', academic: 2, technical: 1 })).error);
  assert.ok((await executeTool('set_rhythm_override', { name: 'Wild', startDate: '2026-11-05', endDate: '2026-11-14', academic: 99, technical: 1 })).error);
  const list = await executeTool('list_rhythms', {});
  assert.strictEqual(list.rhythms.length, 1);
  assert.strictEqual(list.rhythms[0].academic, 'full');
  assert.ok((await executeTool('delete_rhythm', { rhythmId: ok.rhythm.id })).ok);
  assert.ok((await executeTool('delete_rhythm', { rhythmId: ok.rhythm.id })).error);
});

test('judge flags low scores as correction events, skips rated', async () => {
  db._reset();
  await setDoc('settings/hub', { geminiKey: 'k', judgeModel: 'lite-m' }, false);
  await addDoc('conversations', { user: 'Q1', assistant: 'A1', createdAt: '2026-10-01T00:00:00.000Z', rated: false });
  await addDoc('conversations', { user: 'Q2', assistant: 'A2', createdAt: '2026-10-02T00:00:00.000Z', rated: true });
  const orig = global.fetch;
  global.fetch = async (url, opts) => {
    assert.ok(url.includes('lite-m'), 'judge uses Lite model');
    const body = JSON.parse(opts.body);
    assert.ok(body.systemInstruction.parts[0].text.includes('STRICT JSON'));
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"score":2,"reason":"vague, no tools"}' }] } }] }) };
  };
  try {
    const r = await judgeRecentConversations(5);
    assert.strictEqual(r.judged, 1);
    assert.strictEqual(r.flagged, 1);
    const events = await listDocs('learning_events');
    assert.ok(events.some((e) => e.type === 'correction' && e.text.includes('judge 2/5')));
  } finally { global.fetch = orig; }
});
