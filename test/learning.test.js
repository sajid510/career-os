'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { makeDb, install } = require('./helpers/mock-firebase');

const db = makeDb();
install(db);

const {
  extractTags,
  logTaskOutcome,
  logFeedback,
  recordFact,
  reinforceFact,
  forgetFact,
  upsertRefinedFacts,
  getRelevantFacts,
  scoreFacts,
} = require('../api/lib/learning');
const { listDocs, getDoc } = require('../api/lib/util');

test('extractTags lowercases, dedupes and drops stopwords', () => {
  const tags = extractTags('Morning ROS2 SLAM morning the and');
  assert.ok(tags.includes('morning'));
  assert.ok(tags.includes('ros2') || tags.includes('slam'));
  assert.ok(!tags.includes('the'));
  assert.strictEqual(new Set(tags).size, tags.length);
});

test('logTaskOutcome writes typed event with Dhaka context + bumps stats', async () => {
  db._reset();
  const rec = await logTaskOutcome({ taskId: 't1', title: 'Paper draft', outcome: 'v1 done', rating: 5, category: 'research', phase: 'Submit' });
  assert.ok(rec.id);
  const events = await listDocs('learning_events');
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].type, 'task_outcome');
  assert.strictEqual(events[0].rating, 5);
  assert.ok(typeof events[0].dow === 'number');
  assert.ok(typeof events[0].hour === 'number');
  assert.ok(Array.isArray(events[0].tags));
  const stats = await getDoc('learning/stats');
  assert.strictEqual(stats.taskOutcomes, 1);
});

test('logFeedback with correction creates immediate auto-fact', async () => {
  db._reset();
  const { event, autoFact } = await logFeedback({ entity: 'task', text: 'too late', rating: 2, correction: 'prefer morning reminders' });
  assert.strictEqual(event.type, 'correction');
  assert.ok(autoFact && autoFact.id);
  const stats = await getDoc('learning/stats');
  assert.strictEqual(stats.feedbackCount, 1);
  assert.strictEqual(stats.corrections, 1);
});

test('recordFact dedupes by reinforcing instead of duplicating', async () => {
  db._reset();
  const a = await recordFact({ fact: 'Works best in morning', strength: 3, source: 'manual' });
  const b = await recordFact({ fact: 'works best in MORNING', strength: 4, source: 'agent' });
  assert.strictEqual(a.id, b.id);
  assert.ok(b.reinforced);
  const facts = await listDocs('learning_facts');
  assert.strictEqual(facts.length, 1);
  assert.strictEqual(facts[0].confirmCount, 2);
  assert.strictEqual(facts[0].strength, 4);
});

test('reinforce + forget lifecycle keeps history (soft-delete)', async () => {
  db._reset();
  const rec = await recordFact({ fact: 'Prefers IELTS morning practice', strength: 3, source: 'manual' });
  const r = await reinforceFact(rec.id);
  assert.strictEqual(r.confirmCount, 2);
  assert.strictEqual(r.strength, 4);
  await forgetFact(rec.id);
  const doc = await getDoc('learning_facts/' + rec.id);
  assert.strictEqual(doc.status, 'forgotten');
  assert.strictEqual(doc.fact, 'Prefers IELTS morning practice');
  const relevant = await getRelevantFacts({ limit: 10 });
  assert.ok(!relevant.find((f) => f.id === rec.id));
});

test('upsertRefinedFacts merges instead of wiping', async () => {
  db._reset();
  await recordFact({ fact: 'Existing habit', strength: 3, source: 'manual' });
  const out = await upsertRefinedFacts([{ fact: 'Existing habit', strength: 5 }, { fact: 'New habit: evening review', strength: 4 }]);
  assert.strictEqual(out.reinforced, 1);
  assert.strictEqual(out.added, 1);
  const facts = await listDocs('learning_facts');
  assert.strictEqual(facts.length, 2);
});

test('getRelevantFacts ranks tag overlap above strength', async () => {
  db._reset();
  await recordFact({ fact: 'IELTS reading strategy', strength: 3, source: 'manual' });
  await recordFact({ fact: 'ROS2 navigation tuning', strength: 5, source: 'manual' });
  const res = await getRelevantFacts({ query: 'IELTS reading', limit: 5 });
  assert.ok(res.length >= 2);
  assert.ok(res[0].fact.toLowerCase().includes('ielts'));
});

test('scoreFacts is pure and sorts by score desc', () => {
  const out = scoreFacts(
    [
      { id: 'a', fact: 'x', strength: 5, confirmCount: 1, tags: [], status: 'active', lastUsed: new Date().toISOString() },
      { id: 'b', fact: 'IELTS morning', strength: 3, confirmCount: 1, tags: ['ielts'], status: 'active', lastUsed: new Date().toISOString() },
    ],
    { query: 'IELTS' }
  );
  assert.strictEqual(out[0].id, 'b');
});
