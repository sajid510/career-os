'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { makeDb, install } = require('./helpers/mock-firebase');
const db = makeDb();
install(db);

const p = require('../api/lib/plan');

test('plan has the expected restart-mission shape', () => {
  assert.ok(p.TASKS.length >= 100, 'at least 100 tasks');
  assert.ok(p.DEADLINES.length >= 15);
  assert.ok(p.MILESTONES.length >= 8);
  assert.ok(p.PHASES.length >= 4);
  assert.ok(p.GOALS.length >= 4);
  assert.ok(p.SUMMARY && p.SUMMARY.includes('August 2026'));
});

test('all tasks have unique titles, descriptions and valid dates', () => {
  const titles = new Set(p.TASKS.map((t) => t.title));
  assert.strictEqual(titles.size, p.TASKS.length, 'task titles are unique');
  for (const t of p.TASKS) {
    assert.ok(t.description, 'task has description: ' + t.title);
    assert.ok(!Number.isNaN(new Date(t.dueAt).getTime()), 'valid dueAt: ' + t.title);
    assert.ok(['high', 'medium', 'low', 'critical'].includes(t.priority), 'valid priority: ' + t.title);
  }
});

test('plan tasks start at/after August 2026 and end at/around December 2027', () => {
  const earliest = Math.min(...p.TASKS.map((t) => new Date(t.dueAt).getTime()));
  const latest = Math.max(...p.TASKS.map((t) => new Date(t.dueAt).getTime()));
  assert.ok(earliest >= Date.parse('2026-08-01T00:00:00Z'), 'starts in August 2026 or later');
  assert.ok(latest <= Date.parse('2028-01-01T00:00:00Z'), 'does not extend past 2028');
});

test('deadlines have valid dates and phases that exist', () => {
  const phaseKeys = new Set(p.PHASES.map((ph) => ph.key));
  for (const d of p.DEADLINES) {
    assert.ok(!Number.isNaN(new Date(d.dueAt).getTime()), 'valid deadline date: ' + d.title);
    assert.ok(phaseKeys.has(d.phase), 'deadline references an existing phase: ' + d.title);
  }
});

test('milestones have valid dates and one final "offer secured" milestone', () => {
  for (const m of p.MILESTONES) {
    assert.ok(!Number.isNaN(new Date(m.dueAt).getTime()), 'valid milestone date: ' + m.title);
  }
  assert.ok(p.MILESTONES.some((m) => m.title.toLowerCase().includes('funded')));
});

test('phases have exactly one active phase', () => {
  assert.strictEqual(p.PHASES.filter((ph) => ph.status === 'active').length, 1);
});
