'use strict';

// Scholarship checklist + readiness scorecard. Checklist state lives on the
// scholarship doc; items default to parsing the free-text `docs` field.
const { getDoc } = require('./util');

function buildChecklist(sch) {
  if (Array.isArray(sch.checklist) && sch.checklist.length) return sch.checklist;
  return String(sch.docs || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((item) => ({ item, done: false }));
}

function scorecard(sch) {
  const items = buildChecklist(sch);
  const done = items.filter((i) => i.done).length;
  return {
    id: sch.id, name: sch.name, deadline: sch.deadline || '', status: sch.status || '',
    total: items.length, done, pct: items.length ? Math.round((done / items.length) * 100) : 0,
    items,
  };
}

module.exports = { buildChecklist, scorecard };
