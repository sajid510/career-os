'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { makeDb, install } = require('./helpers/mock-firebase');
const db = makeDb();
install(db);

const m = require('../api/lib/mission');

test('mission trackers have the expected volume', () => {
  assert.ok(m.SCHOLARSHIPS.length >= 10);
  assert.ok(m.UNIVERSITIES.length >= 20);
  assert.ok(m.PROFESSORS.length >= 15);
  assert.ok(m.CGPA && m.CGPA.backlogs.length >= 2);
  assert.ok(m.NOTES.length >= 3);
});

test('scholarships are well-formed', () => {
  for (const s of m.SCHOLARSHIPS) {
    assert.ok(s.name, 'scholarship has a name');
    assert.ok(!Number.isNaN(new Date(s.deadline).getTime()), 'valid deadline: ' + s.name);
    assert.ok(['A', 'B', 'C'].includes(s.priority), 'valid priority tier: ' + s.name);
  }
});

test('universities are well-formed', () => {
  for (const u of m.UNIVERSITIES) {
    assert.ok(u.name, 'university has a name');
    assert.ok(u.country, 'university has a country');
    assert.ok(!Number.isNaN(new Date(u.appDeadline).getTime()), 'valid app deadline: ' + u.name);
  }
});

test('professors reference universities and valid statuses', () => {
  const statuses = ['To Contact', 'Emailed', 'No Response', 'Responded', 'Meeting Set', 'Positive', 'Negative'];
  for (const pr of m.PROFESSORS) {
    assert.ok(pr.university, 'professor has a university');
    assert.ok(statuses.includes(pr.status), 'valid outreach status: ' + pr.university);
  }
});

test('CGPA data is internally consistent', () => {
  const c = m.CGPA;
  assert.ok(c.cgpa > 0 && c.cgpa <= 4);
  assert.ok(c.target >= c.cgpa, 'target is above current');
  assert.ok(c.totalDegreeCredits > c.completedCredits, 'remaining credits exist');
  for (const b of c.backlogs) {
    assert.ok(b.credits > 0, 'backlog credits are positive');
    assert.ok(typeof b.done === 'boolean');
  }
});
