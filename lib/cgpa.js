'use strict';

// CGPA math (pure, unit-tested). Bridge between the UAP portal grade report
// (copy-pasted semester results) and the mission/cgpa tracker document.
// UAP model (portal-verified Oct 2026): CGPA = QP / EARNED credits. F grades
// earn 0 credits and sit OUTSIDE the divisor until retaken and passed - a
// retake then adds BOTH its quality points and its credits. Grade scale 4.0;
// F must be repeated, non-F cannot be retaken (full grade assumed on retake).

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

// Parse pasted rows: "Course Name | credits | grade" (also accepts comma/tab).
function parseGradeRows(text) {
  const rows = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const parts = t.split(/\s*[|,\t]\s*/);
    if (parts.length < 3) return { error: 'Bad line (need Course | credits | grade): ' + t };
    const credits = Number(parts[parts.length - 2]);
    const grade = Number(parts[parts.length - 1]);
    const course = parts.slice(0, parts.length - 2).join(' ').trim();
    if (!course) return { error: 'Missing course name: ' + t };
    if (!Number.isFinite(credits) || credits <= 0 || credits > 12) return { error: 'Bad credits: ' + t };
    if (!Number.isFinite(grade) || grade < 0 || grade > 4) return { error: 'Bad grade (0-4): ' + t };
    rows.push({ course, credits, grade: round3(grade) });
  }
  if (!rows.length) return { error: 'No rows found' };
  return { rows };
}

function norm(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function applySemesterResults(doc, rows, semester) {
  const before = { cgpa: doc.cgpa || 0, completedCredits: doc.completedCredits || 0 };
  let qp = before.cgpa * before.completedCredits;
  let completed = before.completedCredits;
  const backlogs = (doc.backlogs || []).map((b) => Object.assign({}, b));
  const applied = [];
  const total = doc.totalDegreeCredits || 0;

  for (const r of rows) {
    const pending = backlogs.find((b) => !b.done && norm(b.course) === norm(r.course));
    if (pending && r.grade > 0) {
      // Retake passed: F was outside the divisor, so both QP and credits grow.
      pending.done = true;
      pending.newGrade = r.grade;
      qp += r.grade * r.credits;
      completed += r.credits;
      applied.push({ course: r.course, credits: r.credits, grade: r.grade, kind: 'retake' });
    } else {
      qp += r.grade * r.credits;
      completed += r.credits;
      if (r.grade === 0 && !backlogs.some((b) => norm(b.course) === norm(r.course))) {
        backlogs.push({ course: r.course, credits: r.credits, done: false, newGrade: 0 });
      }
      applied.push({ course: r.course, credits: r.credits, grade: r.grade, kind: pending ? 'retake-failed' : 'new' });
    }
  }
  if (total > 0 && completed > total) completed = total;
  const after = { cgpa: completed > 0 ? round3(qp / completed) : 0, completedCredits: completed };
  const next = Object.assign({}, doc, {
    cgpa: after.cgpa,
    completedCredits: after.completedCredits,
    backlogs,
    notes: (doc.notes || '') + (semester ? ' [Imported ' + semester + ': ' + applied.length + ' courses]' : ''),
  });
  return { doc: next, applied, before, after };
}

// What average GPA is needed on remaining credits to hit target?
function requiredGpa(doc) {
  const completed = doc.completedCredits || 0;
  const total = doc.totalDegreeCredits || 0;
  const remaining = total - completed;
  if (remaining <= 0) return { value: null, verdict: 'graduated' };
  const req = ((doc.target || 0) * total - (doc.cgpa || 0) * completed) / remaining;
  if (req <= 0) return { value: 0, verdict: 'already-secured' };
  if (req > 4) return { value: round3(req), verdict: 'unreachable' };
  return { value: round3(req), verdict: 'reachable' };
}

module.exports = { parseGradeRows, applySemesterResults, requiredGpa, round3 };
