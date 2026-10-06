'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { parseGradeRows, applySemesterResults, requiredGpa } = require('../lib/cgpa');

const BASE = { cgpa: 2.61, completedCredits: 70, totalDegreeCredits: 151, target: 3.2, backlogs: [{ course: 'Digital Electronics', credits: 3, done: false, newGrade: 0 }], futureSems: [], notes: '' };

test('parseGradeRows accepts pipe/comma/tab and rejects bad lines', () => {
  const ok = parseGradeRows('Digital Electronics | 3 | 3.50\nAccounting,2,3.25\nEEE 311\t3\t4.00');
  assert.strictEqual(ok.rows.length, 3);
  assert.deepStrictEqual(ok.rows[0], { course: 'Digital Electronics', credits: 3, grade: 3.5 });
  assert.ok(parseGradeRows('Bad line').error);
  assert.ok(parseGradeRows('X | 0 | 3').error);
  assert.ok(parseGradeRows('X | 3 | 4.5').error);
});

test('retake replaces backlog 0.00 in place without adding credits', () => {
  const out = applySemesterResults(BASE, [{ course: 'digital electronics', credits: 3, grade: 3.5 }], 'Fall 2026');
  assert.strictEqual(out.applied[0].kind, 'retake');
  assert.strictEqual(out.doc.completedCredits, 70);
  assert.ok(out.doc.backlogs[0].done && out.doc.backlogs[0].newGrade === 3.5);
  // QP: 2.61*70 + 3.5*3 = 182.7 + 10.5 = 193.2 → /70 = 2.76
  assert.strictEqual(out.after.cgpa, 2.76);
  assert.ok(out.doc.notes.includes('Fall 2026'));
});

test('new courses add credits; F grade creates a backlog entry', () => {
  const out = applySemesterResults(BASE, [{ course: 'EEE 311', credits: 3, grade: 4 }, { course: 'EEE 309', credits: 3, grade: 0 }], '');
  assert.strictEqual(out.doc.completedCredits, 76);
  assert.strictEqual(out.after.cgpa, 2.562);
  assert.ok(out.doc.backlogs.some((b) => b.course === 'EEE 309' && !b.done));
});

test('completed credits never exceed the degree total', () => {
  const doc = Object.assign({}, BASE, { completedCredits: 150 });
  const out = applySemesterResults(doc, [{ course: 'X', credits: 3, grade: 4 }], '');
  assert.strictEqual(out.doc.completedCredits, 151);
});

test('requiredGpa verdicts: reachable, unreachable, graduated', () => {
  assert.deepStrictEqual(requiredGpa(BASE).verdict, 'reachable');
  assert.ok(requiredGpa(BASE).value > 3.2 && requiredGpa(BASE).value <= 4);
  const bad = Object.assign({}, BASE, { cgpa: 2.0, completedCredits: 140 });
  assert.strictEqual(requiredGpa(bad).verdict, 'unreachable');
  const done = Object.assign({}, BASE, { completedCredits: 151 });
  assert.strictEqual(requiredGpa(done).verdict, 'graduated');
  const safe = Object.assign({}, BASE, { cgpa: 3.9, completedCredits: 150 });
  assert.strictEqual(requiredGpa(safe).verdict, 'already-secured');
});
