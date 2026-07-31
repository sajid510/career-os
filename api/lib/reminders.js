const { nowIso, getDoc, setDoc, addDoc, listDocs, deleteDoc, nextClassOccurrences } = require('./util');

// Generate offline-capable class reminders (15 min before) for the next 7 days
// and clean up stale ones. Idempotent: safe to call on every cron tick.
async function ensureClassReminders() {
  const entries = await listDocs('schedule');
  const reminders = await listDocs('reminders');
  const entryIds = new Set(entries.map((e) => e.id));
  const liveKeys = new Set();
  let created = 0;

  for (const e of entries) {
    if (e.enabled === false) continue;
    const occs = nextClassOccurrences(e.dayOfWeek, e.startTime, 7);
    for (const occ of occs) {
      const key = 'sch_' + e.id + '_' + occ.slice(0, 10);
      liveKeys.add(key);
      if (reminders.some((r) => r.source === 'schedule' && r.scheduleKey === key)) continue;
      await addDoc('reminders', {
        title: e.title + (e.course && e.title !== e.course ? ' (' + e.course + ')' : ''),
        body: (e.room ? 'Room ' + e.room : '') + (e.teacher ? ' · ' + e.teacher : ''),
        dueAt: occ,
        leadMinutes: 15,
        status: 'pending',
        fired: false,
        createdAt: nowIso(),
        source: 'schedule',
        scheduleKey: key,
        scheduleId: e.id,
      });
      created++;
    }
  }

  // cleanup: removed entries, or past occurrences no longer in the rolling window
  for (const r of reminders) {
    if (r.source !== 'schedule') continue;
    if (!entryIds.has(r.scheduleId)) { await deleteDoc('reminders/' + r.id); continue; }
    if (liveKeys.has(r.scheduleKey)) continue;
    if (r.dueAt && r.dueAt < nowIso()) await deleteDoc('reminders/' + r.id);
  }

  return { created, total: entries.length };
}

// Ensure every future deadline has a 24h-before offline reminder. Idempotent.
async function ensureDeadlineReminders() {
  const deadlines = await listDocs('deadlines');
  const reminders = await listDocs('reminders');
  const dlIds = new Set(deadlines.map((d) => d.id));
  let created = 0;

  for (const d of deadlines) {
    if (!d.dueAt || new Date(d.dueAt).getTime() <= Date.now()) continue;
    const existing = reminders.find((r) => r.source === 'deadline' && r.deadlineId === d.id);
    if (existing) {
      if (!d.reminded24h) await setDoc('deadlines/' + d.id, { reminded24h: nowIso() });
      continue;
    }
    await addDoc('reminders', {
      title: 'Deadline: ' + d.title,
      body: (d.category ? String(d.category).replace('_', ' ') : '') + (d.notes ? ' · ' + d.notes : ''),
      dueAt: d.dueAt,
      leadMinutes: 1440,
      status: 'pending',
      fired: false,
      createdAt: nowIso(),
      source: 'deadline',
      deadlineId: d.id,
    });
    await setDoc('deadlines/' + d.id, { reminded24h: nowIso() });
    created++;
  }

  // cleanup orphaned deadline reminders (e.g. after a plan re-ingest)
  for (const r of reminders) {
    if (r.source !== 'deadline') continue;
    if (!dlIds.has(r.deadlineId)) await deleteDoc('reminders/' + r.id);
  }

  return { created, total: deadlines.length };
}

module.exports = { ensureClassReminders, ensureDeadlineReminders };
