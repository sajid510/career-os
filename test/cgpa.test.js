'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { parseGradeRows, applySemesterResults, requiredGpa } = require('../lib/cgpa');

// UAP earned-credit model: CGPA = QP / earned; F sits outside until retaken.
const BASE = { cgpa: 2.59, completedCredits: 76, totalDegreeCredits: 151, target: 3.2, backlogs: [{ course: 'Digital Electronics', credits: 3, done: false, newGrade: 0 }], futureSems: [], notes: '' };

test('parseGradeRows accepts pipe/comma/tab and rejects bad lines', () => {
  const ok = parseGradeRows('Digital Electronics | 3 | 3.50\nAccounting,2,3.25\nEEE 311\t3\t4.00');
  assert.strictEqual(ok.rows.length, 3);
  assert.deepStrictEqual(ok.rows[0], { course: 'Digital Electronics', credits: 3, grade: 3.5 });
  assert.ok(parseGradeRows('Bad line').error);
  assert.ok(parseGradeRows('X | 0 | 3').error);
  assert.ok(parseGradeRows('X | 3 | 4.5').error);
});

test('retake adds BOTH grade points and credits (F was outside divisor)', () => {
  const out = applySemesterResults(BASE, [{ course: 'digital electronics', credits: 3, grade: 3.5 }], 'Fall 2026');
  assert.strictEqual(out.applied[0].kind, 'retake');
  assert.strictEqual(out.doc.completedCredits, 79);
  assert.ok(out.doc.backlogs[0].done && out.doc.backlogs[0].newGrade === 3.5);
  // QP: 2.59*76 + 3.5*3 = 196.84 + 10.5 = 207.34 → /79 = 2.625
  assert.strictEqual(out.after.cgpa, 2.625);
  assert.ok(out.doc.notes.includes('Fall 2026'));
});

test('new courses add credits; F grade creates a backlog entry', () => {
  const out = applySemesterResults(BASE, [{ course: 'EEE 311', credits: 3, grade: 4 }, { course: 'EEE 309', credits: 3, grade: 0 }], '');
  assert.strictEqual(out.doc.completedCredits, 82);
  // QP: 196.84 + 12 + 0 = 208.84 → /82 = 2.547
  assert.strictEqual(out.after.cgpa, 2.547);
  assert.ok(out.doc.backlogs.some((b) => b.course === 'EEE 309' && !b.done));
});

test('completed credits never exceed the degree total', () => {
  const doc = Object.assign({}, BASE, { completedCredits: 150 });
  const out = applySemesterResults(doc, [{ course: 'X', credits: 3, grade: 4 }], '');
  assert.strictEqual(out.doc.completedCredits, 151);
});

test('requiredGpa verdicts: reachable, unreachable, graduated', () => {
  // (3.2*151 - 2.59*76)/75 = 286.36/75 = 3.818 — extreme but possible
  const r = requiredGpa(BASE);
  assert.strictEqual(r.verdict, 'reachable');
  assert.strictEqual(r.value, 3.818);
  const bad = Object.assign({}, BASE, { cgpa: 2.0, completedCredits: 140 });
  assert.strictEqual(requiredGpa(bad).verdict, 'unreachable');
  const done = Object.assign({}, BASE, { completedCredits: 151 });
  assert.strictEqual(requiredGpa(done).verdict, 'graduated');
  const safe = Object.assign({}, BASE, { cgpa: 3.9, completedCredits: 150 });
  assert.strictEqual(requiredGpa(safe).verdict, 'already-secured');
});
