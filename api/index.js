const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const {
  db, admin, nowIso, makeId, getDoc, setDoc, addDoc, listDocs, deleteDoc,
  daysUntil, inDays, humanDate, toLocalDateStr, addDaysLocal, localNow, dhakaParts, DAY_SHORT,
} = require('./lib/util');
const { getSettings, saveSettings, getHubToken, setHubToken } = require('./lib/config');
const { PROFILE } = require('./lib/profile');
const { DEADLINES, PHASES, MILESTONES, TASKS, GOALS } = require('./lib/seed');
const { callGemini, buildSystemPrompt, executeTool, TOOL_DEFS, textFrom } = require('./lib/gemini');
const { syncAll, syncCareerIo, syncTeamDashboard, ingestConnectorData } = require('./lib/connectors');
const { ensureClassReminders, ensureDeadlineReminders } = require('./lib/reminders');
const { buildAuthUrl, syncClassroom, getStatus: getClassroomStatus, HUB_BASE, CALLBACK_PATH } = require('./lib/classroom');

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '5mb' }));

// ---------- auth ----------
async function authOk(req) {
  const token = req.headers['x-hub-token'];
  const expected = await getHubToken();
  return !!expected && token === expected;
}

async function requireAuth(req, res, next) {
  if (!(await authOk(req))) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

// ---------- notifications + fcm ----------
async function sendPush(title, body, type, level) {
  try {
    const snap = await db.collection('devices').get();
    const tokens = [];
    snap.forEach((d) => tokens.push(d.id));
    if (!tokens.length) return { sent: 0 };
    const res = await admin.messaging().sendEachForMulticast({
      notification: { title, body },
      data: { title, body, type: type || 'system', level: level || 'info', ts: nowIso() },
      tokens,
    });
    const dead = [];
    res.responses.forEach((r, i) => { if (!r.success) dead.push(tokens[i]); });
    for (const t of dead) { await db.collection('devices').doc(t).delete().catch(() => {}); }
    return { sent: res.successCount, removed: dead.length };
  } catch (e) {
    console.warn('FCM send failed (non-fatal): ' + e.message);
    return { sent: 0, error: e.message };
  }
}

async function notify(title, body, type, level, opts) {
  const rec = await addDoc('notifications', {
    title, body, type: type || 'system', level: level || 'info', read: false, createdAt: nowIso(), source: (opts && opts.source) || 'hub',
  });
  const push = await sendPush(title, body, type, level);
  return { notification: rec, push };
}

// ---------- reminders ----------
async function processReminders() {
  const reminders = await listDocs('reminders');
  const now = Date.now();
  let fired = 0;
  for (const r of reminders) {
    if (r.fired) continue;
    if (!r.dueAt) continue;
    const due = new Date(r.dueAt).getTime();
    const lead = (r.leadMinutes || 60) * 60000;
    if (now >= due - lead) {
      await setDoc('reminders/' + r.id, { fired: true, firedAt: nowIso() });
      await notify(r.title, r.body || r.title, 'reminder', 'reminder', { source: 'reminder' });
      fired++;
    }
  }
  return { fired };
}

// ---------- deadline reminders (once per horizon) ----------
async function deadlineReminders() {
  const deadlines = await listDocs('deadlines');
  const horizons = [7, 3, 1];
  const made = [];
  for (const d of deadlines) {
    const days = daysUntil(d.dueAt);
    if (days === null || days < 0) continue;
    for (const h of horizons) {
      const key = 'reminded_' + h + 'd';
      if (!d[key] && days <= h) {
        await setDoc('deadlines/' + d.id, { [key]: nowIso() });
        made.push({ title: d.title, human: inDays(d.dueAt) });
      }
    }
  }
  return made;
}

// ---------- seed / init ----------
async function seedEverything() {
  const seeded = {};
  const existingProfile = await getDoc('profile/main');
  if (!existingProfile) {
    await setDoc('profile/main', PROFILE, false);
    seeded.profile = true;
  }
  const deadlineCount = (await listDocs('deadlines')).length;
  if (deadlineCount === 0) {
    for (const d of DEADLINES) await addDoc('deadlines', Object.assign({}, d, { status: 'pending', createdAt: nowIso() }));
    seeded.deadlines = DEADLINES.length;
  }
  const phaseCount = (await listDocs('phases')).length;
  if (phaseCount === 0) {
    for (const p of PHASES) await addDoc('phases', Object.assign({}, p, { createdAt: nowIso() }));
    seeded.phases = PHASES.length;
  }
  const milestoneCount = (await listDocs('milestones')).length;
  if (milestoneCount === 0) {
    for (const m of MILESTONES) await addDoc('milestones', Object.assign({}, m, { createdAt: nowIso() }));
    seeded.milestones = MILESTONES.length;
  }
  const taskCount = (await listDocs('tasks')).length;
  if (taskCount === 0) {
    for (const t of TASKS) await addDoc('tasks', Object.assign({}, t, { description: '', outcome: '', rating: 0, source: 'seed', completedAt: '', createdAt: nowIso() }));
    seeded.tasks = TASKS.length;
  }
  const goalCount = (await listDocs('goals')).length;
  if (goalCount === 0) {
    for (const g of GOALS) await addDoc('goals', Object.assign({}, g, { createdAt: nowIso() }));
    seeded.goals = GOALS.length;
  }
  if (!(await getDoc('learning/stats'))) {
    await setDoc('learning/stats', { taskOutcomes: 0, feedbackCount: 0, corrections: 0, facts: 0, lastUpdated: nowIso() }, false);
  }
  return seeded;
}

// ---------- plan ingest (agent decomposes a career file) ----------
async function decomposePlanText(text, graduationDate) {
  const s = await getSettings();
  const key = s.geminiKey;
  if (!key) throw new Error('GEMINI_API_KEY not configured');
  const prompt =
    'You are an expert career-plan architect. Analyze the career plan below and output STRICT JSON (no markdown fences, no extra text) with this exact shape:\n' +
    '{\n' +
    '  "phases": [{"key":"unique","label":"Phase name","focus":["..."],"status":"active|pending"}],\n' +
    '  "milestones": [{"title":"...","dueAt":"ISO date or null","category":"...","status":"pending"}],\n' +
    '  "deadlines": [{"title":"...","dueAt":"ISO date","category":"...","notes":"...","critical":true|false}],\n' +
    '  "tasks": [{"title":"...","dueAt":"ISO date or null","category":"...","priority":"high|medium|low","phase":"phase key"}],\n' +
    '  "goals": [{"goal":"...","by":"when"}],\n' +
    '  "summary": "one-paragraph strategy summary"\n' +
    '}\n' +
    'Use concrete realistic dates (today is ' + toLocalDateStr(new Date().toISOString()) + '). Backwards milestones and deadlines from the stated goal. Graduation/target: ' + (graduationDate || 'unknown') + '.\n' +
    'PLAN TEXT:\n' + text.slice(0, 60000);
  const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + (s.geminiModel || 'gemini-flash-latest') + ':generateContent?key=' + encodeURIComponent(key), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
  });
  if (!resp.ok) throw new Error('Gemini HTTP ' + resp.status + ': ' + (await resp.text()).slice(0, 200));
  const data = await resp.json();
  const textOut = data.candidates && data.candidates[0] ? data.candidates[0].content.parts.map((p) => p.text || '').join('') : '';
  const cleaned = textOut.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON in agent output');
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function applyDecomposedPlan(plan) {
  const out = {};
  if (plan.phases && plan.phases.length) {
    await db.collection('phases').get().then((snap) => { const ops = []; snap.forEach((d) => ops.push(d.ref.delete())); return Promise.all(ops); });
    for (const p of plan.phases) await addDoc('phases', Object.assign({}, p, { createdAt: nowIso() }));
    out.phases = plan.phases.length;
  }
  if (plan.milestones && plan.milestones.length) {
    await db.collection('milestones').get().then((snap) => { const ops = []; snap.forEach((d) => ops.push(d.ref.delete())); return Promise.all(ops); });
    for (const m of plan.milestones) await addDoc('milestones', Object.assign({}, m, { createdAt: nowIso() }));
    out.milestones = plan.milestones.length;
  }
  if (plan.deadlines && plan.deadlines.length) {
    await db.collection('deadlines').get().then((snap) => { const ops = []; snap.forEach((d) => ops.push(d.ref.delete())); return Promise.all(ops); });
    for (const d of plan.deadlines) await addDoc('deadlines', Object.assign({}, d, { status: 'pending', createdAt: nowIso() }));
    out.deadlines = plan.deadlines.length;
  }
  if (plan.tasks && plan.tasks.length) {
    await db.collection('tasks').get().then((snap) => { const ops = []; snap.forEach((d) => ops.push(d.ref.delete())); return Promise.all(ops); });
    for (const t of plan.tasks) await addDoc('tasks', Object.assign({}, t, { status: 'open', description: '', outcome: '', rating: 0, source: 'plan', completedAt: '', createdAt: nowIso() }));
    out.tasks = plan.tasks.length;
  }
  if (plan.goals && plan.goals.length) {
    await db.collection('goals').get().then((snap) => { const ops = []; snap.forEach((d) => ops.push(d.ref.delete())); return Promise.all(ops); });
    for (const g of plan.goals) await addDoc('goals', Object.assign({}, g, { status: 'active', createdAt: nowIso() }));
    out.goals = plan.goals.length;
  }
  if (plan.summary) await setDoc('plan/main', { summary: plan.summary, updatedAt: nowIso(), source: 'user_upload' }, true);
  await notify('New career plan applied', 'The AI decomposed your plan into ' + (out.tasks || 0) + ' tasks, ' + (out.deadlines || 0) + ' deadlines, ' + (out.milestones || 0) + ' milestones.', 'milestone', 'info', { source: 'plan' });
  return out;
}

// ---------- chat ----------
async function agentChat(userMessages) {
  const sys = await buildSystemPrompt();
  const contents = [];
  for (const m of userMessages) {
    if (!m || !m.content) continue;
    contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content) }] });
  }
  if (!contents.length) contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
  let finalText = '';
  const toolLog = [];
  let rounds = 0;
  for (let i = 0; i < 8; i++) {
    rounds = i + 1;
    const content = await callGemini(sys, contents, TOOL_DEFS);
    if (!content) return { text: finalText.trim(), toolLog, rounds, done: true };
    const funcCalls = content.parts.filter((p) => p.functionCall);
    if (!funcCalls.length) {
      const t = textFrom(content);
      if (t) finalText += t;
      return { text: finalText.trim(), toolLog, rounds, done: true };
    }
    const results = [];
    for (const fc of funcCalls) {
      const name = fc.functionCall.name;
      const args = fc.functionCall.args || {};
      let res;
      try {
        res = await executeTool(name, args);
      } catch (e) {
        res = { error: e.message };
      }
      results.push(res);
      toolLog.push({ name, args });
      const outText = res && res.title ? res.title : (res && res.ok ? 'ok' : JSON.stringify(res).slice(0, 80));
      finalText += '[' + name + ' → ' + outText + '] ';
    }
    contents.push(content);
    contents.push({
      role: 'model',
      parts: funcCalls.map((fc, idx) => ({ functionResponse: { name: fc.functionCall.name, response: results[idx] || { ok: true } } })),
    });
  }
  return { text: finalText.trim() || '(agent completed a multi-step task)', toolLog, rounds, done: true };
}

// ---------- learning refinement ----------
async function refineLearning() {
  const events = await listDocs('learning_events');
  const facts = await listDocs('learning_facts');
  if (!events.length && !facts.length) return { ok: true, note: 'nothing to refine yet' };
  const s = await getSettings();
  if (!s.geminiKey) return { ok: true, note: 'no gemini key' };
  const sample = events.slice(-30).map((e) => ' - ' + e.text).join('\n');
  const existing = facts.map((f) => ' - ' + f.fact).join('\n');
  const prompt =
    'You are the self-learning module of Sadnan OS. From the user\'s learning events and existing facts, distill at most 10 concise, durable facts about how Sadnan works best (preferences, habits, strengths, what to remind him about). Output STRICT JSON array only, e.g. [{"fact":"...","strength":4}]. No markdown.\n' +
    'EXISTING FACTS:\n' + existing + '\nLEARNING EVENTS:\n' + sample;
  try {
    const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + (s.geminiModel || 'gemini-flash-latest') + ':generateContent?key=' + encodeURIComponent(s.geminiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
    });
    const data = await resp.json();
    const textOut = data.candidates && data.candidates[0] ? data.candidates[0].content.parts.map((p) => p.text || '').join('') : '';
    const cleaned = textOut.replace(/```json/gi, '').replace(/```/g, '').trim();
    const arr = JSON.parse(cleaned.slice(cleaned.indexOf('['), cleaned.lastIndexOf(']') + 1));
    await db.collection('learning_facts').get().then((snap) => { const ops = []; snap.forEach((d) => ops.push(d.ref.delete())); return Promise.all(ops); });
    for (const f of arr) await addDoc('learning_facts', { fact: f.fact, strength: f.strength || 3, source: 'auto-refine', createdAt: nowIso() });
    return { ok: true, facts: arr.length };
  } catch (e) {
    return { ok: true, note: 'refine skipped: ' + e.message };
  }
}

// ================= API ROUTES =================

app.get('/api/health', async (req, res) => {
  res.json({ ok: true, app: 'Career OS Hub', time: nowIso(), initialized: (await getDoc('settings/hub')) ? true : false });
});

app.post('/api/init', async (req, res) => {
  try {
    const existingToken = await getHubToken();
    if (existingToken && req.body && req.body.hubToken && req.body.hubToken !== existingToken) {
      return res.status(401).json({ ok: false, error: 'hub already initialized' });
    }
    let token = existingToken;
    if (!token) {
      token = makeId('hub') + Math.random().toString(36).slice(2, 10);
      await setHubToken(token);
    }
    const seeded = await seedEverything();
    const careerIoWebhook = (req.body && req.body.careerIoWebhook) || '';
    const careerIoSecret = (req.body && req.body.careerIoSecret) || '';
    const careerIoSpreadsheetUrl = (req.body && req.body.careerIoSpreadsheetUrl) || '';
    await saveSettings({
      hubToken: token,
      initialized: true,
      geminiKey: (req.body && req.body.geminiKey) || (await getSettings()).geminiKey,
      careerIoWebhook,
      careerIoSecret,
      careerIoSpreadsheetUrl,
    });
    await notify('Welcome to Career OS', 'Your command center is live. I\'ve loaded your profile and roadmap - ' + (seeded.deadlines || 0) + ' deadlines, ' + (seeded.tasks || 0) + ' starting tasks, ' + (seeded.milestones || 0) + ' milestones.', 'system', 'info', { source: 'init' });
    res.json({ ok: true, hubToken: token, seeded, note: 'Store hubToken safely. It authenticates every call.' });
  } catch (e) {
    console.error('init error', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---- overview ----
app.get('/api/overview', requireAuth, async (req, res) => {
  try {
    const today = localNow();
    const tasks = await listDocs('tasks');
    const deadlines = await listDocs('deadlines');
    const milestones = await listDocs('milestones');
    const notifications = await listDocs('notifications');
    const systems = await listDocs('systems');
    const learning = await getDoc('learning/stats');
    const profile = await getDoc('profile/main');
    const schedule = await listDocs('schedule');
    const todayDow = dhakaParts(Date.now()).dow;
    const todayClasses = schedule
      .filter((e) => e.enabled !== false && e.dayOfWeek === todayDow)
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
      .map((e) => ({ title: e.title, course: e.course || '', startTime: e.startTime, endTime: e.endTime || '', room: e.room || '', teacher: e.teacher || '' }));

    const openTasks = tasks.filter((t) => t.status !== 'done');
    const dueToday = openTasks.filter((t) => t.dueAt && toLocalDateStr(t.dueAt) === toLocalDateStr(today.toISOString()));
    const overdue = openTasks.filter((t) => t.dueAt && t.dueAt < today.toISOString());
    const nextDeadlines = deadlines.filter((d) => d.dueAt && daysUntil(d.dueAt) >= 0).sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, 6);
    const recentNotifications = notifications.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 12);
    const unread = notifications.filter((n) => !n.read).length;

    res.json({
      ok: true,
      today: toLocalDateStr(today.toISOString()),
      stats: {
        openTasks: openTasks.length,
        dueToday: dueToday.length,
        overdue: overdue.length,
        totalDeadlines: deadlines.length,
        milestonesDone: milestones.filter((m) => m.status === 'done').length,
        milestonesTotal: milestones.length,
        unreadNotifications: unread,
      },
      dueTodayTasks: dueToday.map((t) => ({ id: t.id, title: t.title, category: t.category, priority: t.priority })),
      todayClasses: todayClasses,
      nextDeadlines: nextDeadlines.map((d) => ({ id: d.id, title: d.title, human: inDays(d.dueAt), date: humanDate(d.dueAt), critical: !!d.critical, category: d.category })),
      notifications: recentNotifications.map((n) => ({ id: n.id, title: n.title, body: n.body, type: n.type, read: n.read, createdAt: n.createdAt })),
      systems: systems.map((s) => ({ key: s.id, name: s.name, status: s.status, summary: s.summary || '', lastSync: s.lastSync })),
      learning: learning || {},
      profile: profile ? { name: profile.name, careerGoal: profile.careerGoal, cgpa: profile.education && profile.education.cgpa, grad: profile.education && profile.education.years } : {},
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---- profile ----
app.get('/api/profile', requireAuth, async (req, res) => {
  const profile = await getDoc('profile/main');
  res.json({ ok: true, profile: profile || PROFILE });
});

// ---- goals ----
app.get('/api/goals', requireAuth, async (req, res) => {
  const goals = await listDocs('goals');
  res.json({ ok: true, goals });
});
app.post('/api/goals', requireAuth, async (req, res) => {
  const rec = await addDoc('goals', { goal: req.body.goal, by: req.body.by || '', status: 'active', createdAt: nowIso() });
  res.json({ ok: true, goal: rec });
});

// ---- tasks ----
app.get('/api/tasks', requireAuth, async (req, res) => {
  let tasks = await listDocs('tasks');
  tasks = tasks.sort((a, b) => ((a.dueAt || '9999').localeCompare(b.dueAt || '9999')));
  res.json({ ok: true, tasks: tasks.map((t) => ({ id: t.id, title: t.title, description: t.description || '', category: t.category, priority: t.priority, status: t.status, dueAt: t.dueAt, human: t.dueAt ? inDays(t.dueAt) : '', phase: t.phase || '', source: t.source || '', outcome: t.outcome || '', rating: t.rating || 0, completedAt: t.completedAt || '' })) });
});
app.post('/api/tasks', requireAuth, async (req, res) => {
  const rec = await addDoc('tasks', {
    title: req.body.title, description: req.body.description || '', dueAt: req.body.dueAt || '', category: req.body.category || 'general',
    priority: req.body.priority || 'medium', phase: req.body.phase || '', status: 'open', source: 'manual', outcome: '', rating: 0, completedAt: '', createdAt: nowIso(),
  });
  res.json({ ok: true, task: rec });
});
app.patch('/api/tasks/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  const doc = await getDoc('tasks/' + id);
  if (!doc) return res.status(404).json({ ok: false, error: 'not found' });
  const patch = {};
  ['title', 'description', 'dueAt', 'category', 'priority', 'phase', 'status'].forEach((k) => { if (req.body[k] !== undefined) patch[k] = req.body[k]; });
  if (patch.status === 'done' && !doc.completedAt) patch.completedAt = nowIso();
  if (patch.status && patch.status !== 'done') patch.completedAt = '';
  await setDoc('tasks/' + id, patch);
  res.json({ ok: true });
});
app.post('/api/tasks/:id/complete', requireAuth, async (req, res) => {
  const id = req.params.id;
  const doc = await getDoc('tasks/' + id);
  if (!doc) return res.status(404).json({ ok: false, error: 'not found' });
  const outcome = req.body.outcome || '';
  const rating = req.body.rating || 0;
  await setDoc('tasks/' + id, { status: 'done', completedAt: nowIso(), outcome, rating });
  await addDoc('learning_events', { ts: nowIso(), type: 'task_outcome', entity: 'task', entityId: id, text: 'Completed: ' + doc.title + (outcome ? ' | ' + outcome : ''), rating });
  res.json({ ok: true });
});
app.delete('/api/tasks/:id', requireAuth, async (req, res) => {
  await deleteDoc('tasks/' + req.params.id);
  res.json({ ok: true });
});

// ---- deadlines ----
app.get('/api/deadlines', requireAuth, async (req, res) => {
  let deadlines = await listDocs('deadlines');
  deadlines = deadlines.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  res.json({ ok: true, deadlines: deadlines.map((d) => ({ id: d.id, title: d.title, dueAt: d.dueAt, human: inDays(d.dueAt), date: humanDate(d.dueAt), category: d.category, notes: d.notes || '', critical: !!d.critical, status: d.status || 'pending' })) });
});
app.post('/api/deadlines', requireAuth, async (req, res) => {
  const rec = await addDoc('deadlines', { title: req.body.title, dueAt: req.body.dueAt, category: req.body.category || 'scholarship', notes: req.body.notes || '', critical: !!req.body.critical, status: 'pending', createdAt: nowIso() });
  const reminders = await ensureDeadlineReminders();
  res.json({ ok: true, deadline: rec, reminder24hCreated: reminders.created });
});
app.delete('/api/deadlines/:id', requireAuth, async (req, res) => {
  await deleteDoc('deadlines/' + req.params.id);
  res.json({ ok: true });
});

// ---- milestones & phases ----
app.get('/api/milestones', requireAuth, async (req, res) => {
  const milestones = await listDocs('milestones');
  res.json({ ok: true, milestones });
});
app.post('/api/milestones/:id/toggle', requireAuth, async (req, res) => {
  const doc = await getDoc('milestones/' + req.params.id);
  if (!doc) return res.status(404).json({ ok: false, error: 'not found' });
  const nextStatus = doc.status === 'done' ? 'pending' : 'done';
  await setDoc('milestones/' + req.params.id, { status: nextStatus });
  if (nextStatus === 'done') await notify('Milestone completed 🎉', doc.title, 'milestone', 'success', { source: 'milestone' });
  res.json({ ok: true, status: nextStatus });
});
app.get('/api/phases', requireAuth, async (req, res) => {
  const phases = await listDocs('phases');
  res.json({ ok: true, phases });
});

// ---- plan ----
app.get('/api/plan', requireAuth, async (req, res) => {
  const plan = await getDoc('plan/main');
  const phases = await listDocs('phases');
  const milestones = await listDocs('milestones');
  res.json({ ok: true, plan: plan || {}, phases, milestones });
});
app.post('/api/plan/ingest', requireAuth, async (req, res) => {
  try {
    const text = req.body.text || '';
    if (!text) return res.status(400).json({ ok: false, error: 'text is required' });
    const graduationDate = req.body.graduationDate || '';
    const decomposed = await decomposePlanText(text, graduationDate);
    const applied = await applyDecomposedPlan(decomposed);
    res.json({ ok: true, applied, summary: decomposed.summary || '' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---- events ----
app.get('/api/events', requireAuth, async (req, res) => {
  const events = await listDocs('events');
  res.json({ ok: true, events });
});
app.post('/api/events', requireAuth, async (req, res) => {
  const rec = await addDoc('events', { title: req.body.title, startAt: req.body.startAt, endAt: req.body.endAt || req.body.startAt, notes: req.body.notes || '', createdAt: nowIso() });
  res.json({ ok: true, event: rec });
});

// ---- notifications ----
app.get('/api/notifications', requireAuth, async (req, res) => {
  let notifications = await listDocs('notifications');
  notifications = notifications.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  if (req.query.since) notifications = notifications.filter((n) => n.createdAt > req.query.since);
  if (req.query.unread) notifications = notifications.filter((n) => !n.read);
  res.json({ ok: true, notifications: notifications.slice(0, 200) });
});
app.post('/api/notifications/read', requireAuth, async (req, res) => {
  const ids = req.body.ids || [];
  for (const id of ids) { await setDoc('notifications/' + id, { read: true }); }
  res.json({ ok: true, marked: ids.length });
});
app.delete('/api/notifications/:id', requireAuth, async (req, res) => {
  await deleteDoc('notifications/' + req.params.id);
  res.json({ ok: true });
});

// ---- reminders (offline schedule for the APK) ----
app.get('/api/reminders', requireAuth, async (req, res) => {
  const reminders = await listDocs('reminders');
  res.json({ ok: true, reminders });
});
app.post('/api/reminders', requireAuth, async (req, res) => {
  const rec = await addDoc('reminders', { title: req.body.title, body: req.body.body || '', dueAt: req.body.dueAt, leadMinutes: req.body.leadMinutes || 60, status: 'pending', fired: false, createdAt: nowIso() });
  res.json({ ok: true, reminder: rec });
});
app.delete('/api/reminders/:id', requireAuth, async (req, res) => {
  await deleteDoc('reminders/' + req.params.id);
  res.json({ ok: true });
});

// ---- weekly class schedule (routine) ----
app.get('/api/schedule', requireAuth, async (req, res) => {
  const items = await listDocs('schedule');
  items.sort((a, b) => (a.dayOfWeek - b.dayOfWeek) || (a.startTime || '').localeCompare(b.startTime || ''));
  res.json({ ok: true, schedule: items.map((x) => ({
    id: x.id, title: x.title, course: x.course || '', dayOfWeek: x.dayOfWeek,
    startTime: x.startTime, endTime: x.endTime || '', room: x.room || '', teacher: x.teacher || '',
    color: x.color || '', enabled: x.enabled !== false,
  })) });
});
app.post('/api/schedule', requireAuth, async (req, res) => {
  const b = req.body || {};
  const dayOfWeek = parseInt(b.dayOfWeek, 10);
  if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return res.status(400).json({ ok: false, error: 'dayOfWeek must be 0-6 (0=Sunday)' });
  if (!b.title) return res.status(400).json({ ok: false, error: 'title required' });
  if (!b.startTime) return res.status(400).json({ ok: false, error: 'startTime required (HH:MM)' });
  const rec = await addDoc('schedule', {
    title: b.title, course: b.course || '', dayOfWeek, startTime: b.startTime, endTime: b.endTime || '',
    room: b.room || '', teacher: b.teacher || '', color: b.color || '', enabled: b.enabled === undefined ? true : !!b.enabled, createdAt: nowIso(),
  });
  const reminders = await ensureClassReminders();
  res.json({ ok: true, schedule: rec, remindersCreated: reminders.created });
});
app.patch('/api/schedule/:id', requireAuth, async (req, res) => {
  const doc = await getDoc('schedule/' + req.params.id);
  if (!doc) return res.status(404).json({ ok: false, error: 'not found' });
  const patch = {};
  ['title', 'course', 'startTime', 'endTime', 'room', 'teacher', 'color'].forEach((k) => { if (req.body[k] !== undefined) patch[k] = req.body[k]; });
  if (req.body.dayOfWeek !== undefined) patch.dayOfWeek = parseInt(req.body.dayOfWeek, 10);
  if (req.body.enabled !== undefined) patch.enabled = !!req.body.enabled;
  await setDoc('schedule/' + req.params.id, patch);
  await ensureClassReminders();
  res.json({ ok: true });
});
app.delete('/api/schedule/:id', requireAuth, async (req, res) => {
  await deleteDoc('schedule/' + req.params.id);
  const reminders = await listDocs('reminders');
  for (const r of reminders) {
    if (r.source === 'schedule' && r.scheduleId === req.params.id) await deleteDoc('reminders/' + r.id);
  }
  res.json({ ok: true });
});

// ---- chat ----
app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const messages = req.body.messages || [];
    const result = await agentChat(messages);
    res.json({ ok: true, text: result.text, toolLog: result.toolLog || [] });
  } catch (e) {
    console.error('chat error', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---- feedback (self-learning) ----
app.post('/api/feedback', requireAuth, async (req, res) => {
  const rec = await addDoc('learning_events', {
    ts: nowIso(), type: 'feedback', entity: req.body.entity || 'general', entityId: req.body.entityId || '',
    text: req.body.text || '', rating: req.body.rating || 0, correction: req.body.correction || '',
  });
  const stats = (await getDoc('learning/stats')) || { feedbackCount: 0 };
  stats.feedbackCount = (stats.feedbackCount || 0) + 1;
  stats.lastUpdated = nowIso();
  await setDoc('learning/stats', stats, false);
  if (req.body.correction) {
    const stats2 = await getDoc('learning/stats');
    stats2.corrections = (stats2.corrections || 0) + 1;
    await setDoc('learning/stats', stats2, false);
  }
  res.json({ ok: true, event: rec });
});

// ---- learning ----
app.get('/api/learning', requireAuth, async (req, res) => {
  const stats = await getDoc('learning/stats');
  const facts = await listDocs('learning_facts');
  const events = await listDocs('learning_events');
  res.json({
    ok: true,
    stats: stats || {},
    facts: facts.map((f) => ({ fact: f.fact, strength: f.strength, source: f.source })),
    events: events.sort((a, b) => (b.ts || '').localeCompare(a.ts || '')).slice(0, 50),
  });
});

// ---- devices (FCM tokens) ----
app.post('/api/device', requireAuth, async (req, res) => {
  const token = req.body.token;
  if (!token) return res.status(400).json({ ok: false, error: 'token required' });
  await db.collection('devices').doc(token).set({ token, registeredAt: nowIso(), platform: req.body.platform || 'android', name: req.body.name || '' }, { merge: true });
  res.json({ ok: true });
});

// ---- systems ----
app.get('/api/systems', requireAuth, async (req, res) => {
  const systems = await listDocs('systems');
  res.json({ ok: true, systems: systems.map((s) => ({ key: s.id, name: s.name, status: s.status, summary: s.summary || '', lastSync: s.lastSync })) });
});
app.post('/api/systems/sync', requireAuth, async (req, res) => {
  const results = await syncAll(req.body.scope === 'light' ? 'light' : 'full');
  res.json({ ok: true, results });
});

// ---- connector ingest (GitHub Actions pushes external data) ----
app.post('/api/connector/ingest', requireAuth, async (req, res) => {
  const key = req.body.system;
  if (!['robowatch', 'eeeAcademicOS', 'newsPulse'].includes(key)) return res.status(400).json({ ok: false, error: 'unknown system' });
  const result = await ingestConnectorData(key, req.body);
  res.json({ ok: true, result });
});

// ---- settings ----
app.get('/api/settings', requireAuth, async (req, res) => {
  const s = await getSettings();
  res.json({
    ok: true,
    settings: {
      hubName: s.hubName, hubTagline: s.hubTagline, ownerEmail: s.ownerEmail, geminiModel: s.geminiModel,
      careerIoWebhook: s.careerIoWebhook ? 'set' : '', careerIoSpreadsheetUrl: s.careerIoSpreadsheetUrl || '',
      robotDbUrl: s.robotDbUrl, systemsEnabled: s.systemsEnabled || {}, reminderLeadMinutes: s.reminderLeadMinutes,
      classroomClientIdSet: !!s.classroomClientId, classroomConnected: !!s.classroomRefreshToken,
    },
  });
});
app.post('/api/settings', requireAuth, async (req, res) => {
  const allowed = ['hubName', 'hubTagline', 'ownerEmail', 'geminiModel', 'careerIoWebhook', 'careerIoSecret', 'careerIoSpreadsheetUrl', 'robotDbUrl', 'systemsEnabled', 'reminderLeadMinutes', 'classroomClientId', 'classroomClientSecret'];
  const patch = {};
  allowed.forEach((k) => { if (req.body[k] !== undefined) patch[k] = req.body[k]; });
  if (req.body.geminiKey) patch.geminiKey = req.body.geminiKey;
  const s = await saveSettings(patch);
  res.json({ ok: true, geminiKeySet: !!s.geminiKey, hubTokenSet: !!s.hubToken });
});

// ---- Google Classroom ----
app.get('/api/classroom/status', requireAuth, async (req, res) => {
  res.json({ ok: true, classroom: await getClassroomStatus() });
});
app.get('/api/classroom/auth', requireAuth, async (req, res) => {
  const s = await getSettings();
  if (!s.classroomClientId || !s.classroomClientSecret) {
    return res.status(400).json({ ok: false, error: 'Set the Google Classroom Client ID and Client secret in Settings first.' });
  }
  const state = makeId('clr') + Math.random().toString(36).slice(2, 8);
  await setDoc('oauth/state', { state, createdAt: nowIso() }, false);
  res.redirect(buildAuthUrl(s, state));
});
app.get('/api/classroom/oauth_callback', async (req, res) => {
  try {
    if (req.query.error) return res.redirect('/?classroom=error:' + encodeURIComponent(req.query.error));
    const st = await getDoc('oauth/state');
    if (!st || st.state !== req.query.state) return res.redirect('/?classroom=error:state_mismatch');
    await deleteDoc('oauth/state');
    const s = await getSettings();
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: req.query.code,
        client_id: s.classroomClientId,
        client_secret: s.classroomClientSecret,
        redirect_uri: HUB_BASE + CALLBACK_PATH,
        grant_type: 'authorization_code',
      }),
    });
    const j = await r.json();
    if (!r.ok || !j.refresh_token) {
      return res.redirect('/?classroom=error:' + encodeURIComponent(j.error_description || j.error || 'no refresh token'));
    }
    await saveSettings({
      classroomRefreshToken: j.refresh_token,
      classroomAccessToken: j.access_token,
      classroomTokenExpiry: Date.now() + (j.expires_in - 60) * 1000,
      classroomEmail: j.email || '',
    });
    await syncClassroom().catch(() => {});
    res.redirect('/?classroom=connected');
  } catch (e) {
    res.redirect('/?classroom=error:' + encodeURIComponent(e.message));
  }
});
app.post('/api/classroom/sync', requireAuth, async (req, res) => {
  try {
    const r = await syncClassroom();
    if (!r.ok) return res.status(400).json({ ok: false, error: r.error });
    const reminders = await ensureDeadlineReminders();
    res.json({ ok: true, courses: r.courses, workTotal: r.workTotal, newDeadlines: r.newDeadlines, newAnnouncements: r.newAnnouncements, summary: r.summary, reminder24hCreated: reminders.created });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
app.post('/api/classroom/disconnect', requireAuth, async (req, res) => {
  await saveSettings({ classroomRefreshToken: '', classroomAccessToken: '', classroomTokenExpiry: 0, classroomEmail: '' });
  res.json({ ok: true });
});

// ---- cron endpoints (called by GitHub Actions) ----
app.post('/api/cron/15min', requireAuth, async (req, res) => {
  try {
    const reminders = await processReminders();
    const classReminders = await ensureClassReminders();
    const connectors = await syncAll('light');
    res.json({ ok: true, reminders, classReminders, connectors });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
app.post('/api/cron/daily', requireAuth, async (req, res) => {
  try {
    const reminders = await processReminders();
    const classReminders = await ensureClassReminders();
    const dlReminders = await ensureDeadlineReminders();
    const connectors = await syncAll('light');
    const deadlinePings = await deadlineReminders();
    const overview = {
      tasks: await listDocs('tasks'),
      deadlines: await listDocs('deadlines'),
    };
    const due = overview.tasks.filter((t) => t.status !== 'done' && t.dueAt && toLocalDateStr(t.dueAt) === toLocalDateStr(new Date().toISOString()));
    const todayStr = toLocalDateStr(new Date().toISOString());
    const todayDate = new Date(todayStr);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const countdowns = overview.deadlines.filter((d) => d.dueAt && daysUntil(d.dueAt) >= 0 && daysUntil(d.dueAt) <= 90).sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, 8);
    let brief = 'Good morning, Sadnan. ' + todayDate.getDate() + ' ' + monthNames[todayDate.getMonth()] + ' ' + todayDate.getFullYear() + '.';
    if (due.length) brief += ' You have ' + due.length + ' task' + (due.length > 1 ? 's' : '') + ' due today: ' + due.map((t) => t.title).join(', ') + '.';
    else brief += ' No tasks due today - use the time to pull ahead.';
    const schedule = await listDocs('schedule');
    const todayDow = dhakaParts(Date.now()).dow;
    const todayClasses = schedule.filter((e) => e.enabled !== false && e.dayOfWeek === todayDow).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
    if (todayClasses.length) brief += ' Classes today (' + DAY_SHORT[todayDow] + '): ' + todayClasses.map((c) => c.title + ' at ' + c.startTime + (c.room ? ' (Rm ' + c.room + ')' : '')).join('; ') + '.';
    if (countdowns.length) brief += ' Deadlines ahead: ' + countdowns.map((d) => d.title + ' (' + inDays(d.dueAt) + ')').join('; ') + '.';
    await notify('Morning brief', brief, 'agent', 'info', { source: 'daily' });
    res.json({ ok: true, brief, reminders, classReminders, dlReminders, deadlinePings, connectors });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
app.post('/api/cron/weekly', requireAuth, async (req, res) => {
  try {
    const connectors = await syncAll('full');
    const tasks = await listDocs('tasks');
    const events = await listDocs('learning_events');
    const completed = tasks.filter((t) => t.status === 'done' && t.completedAt && daysUntil(t.completedAt) >= -7);
    await notify('Weekly review', 'This week: ' + completed.length + ' task' + (completed.length === 1 ? '' : 's') + ' completed. Systems synced: ' + Object.keys(connectors).join(', ') + '.', 'agent', 'info', { source: 'weekly' });
    res.json({ ok: true, completed: completed.length, connectors });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
app.post('/api/cron/monthly', requireAuth, async (req, res) => {
  try {
    const refined = await refineLearning();
    const connectors = await syncAll('full');
    await notify('Monthly intelligence update', 'Self-learning memory refreshed (' + (refined.facts || refined.note || '') + '). All systems synced.', 'agent', 'info', { source: 'monthly' });
    res.json({ ok: true, refined, connectors });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Serve the static dashboard + SPA fallback (for Vercel)
const publicDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

module.exports = app;
