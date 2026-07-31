const { PROFILE } = require('./profile');
const { DEADLINES, PHASES, MILESTONES } = require('./seed');
const {
  db, nowIso, makeId, getDoc, setDoc, addDoc, listDocs, queryDocs, deleteDoc,
  daysUntil, inDays, humanDate, toLocalDateStr, addDaysLocal,
} = require('./util');
const { getSettings } = require('./config');

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

async function getModel() {
  const s = await getSettings();
  return s.geminiModel || 'gemini-flash-latest';
}

async function callGemini(systemPrompt, contents, tools) {
  const s = await getSettings();
  const key = s.geminiKey;
  if (!key) throw new Error('GEMINI_API_KEY not configured');
  const model = await getModel();
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: contents,
  };
  if (tools && tools.length) {
    body.tools = [{ functionDeclarations: tools }];
    body.toolConfig = { functionCallingConfig: { mode: 'AUTO' } };
  }
  const resp = await fetch(GEMINI_URL + '/' + model + ':generateContent?key=' + encodeURIComponent(key), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error('Gemini HTTP ' + resp.status + ': ' + err.slice(0, 300));
  }
  const data = await resp.json();
  if (data.promptFeedback && data.promptFeedback.blockReason) {
    throw new Error('Prompt blocked: ' + data.promptFeedback.blockReason);
  }
  return data.candidates && data.candidates[0] ? data.candidates[0].content : null;
}

function textFrom(content) {
  if (!content || !content.parts) return '';
  return content.parts.filter((p) => p.text).map((p) => p.text).join('');
}

// ---------------- TOOLS ----------------

const TOOL_DEFS = [
  {
    name: 'list_tasks',
    description: 'List tasks. Filter by status (open/in_progress/done), category (academic/research/outreach/scholarship/documents/language/presence/milestone), or phase.',
    parameters: { type: 'OBJECT', properties: { status: { type: 'string' }, category: { type: 'string' }, phase: { type: 'string' } } },
  },
  {
    name: 'add_task',
    description: 'Create a new task.',
    parameters: { type: 'OBJECT', properties: {
      title: { type: 'string' }, description: { type: 'string' }, dueAt: { type: 'string', description: 'ISO date (YYYY-MM-DD)' },
      category: { type: 'string' }, priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }, phase: { type: 'string' },
    }, required: ['title'] },
  },
  {
    name: 'update_task',
    description: 'Update a task (status, priority, dueAt, title, description).',
    parameters: { type: 'OBJECT', properties: {
      taskId: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' },
      dueAt: { type: 'string' }, status: { type: 'string', enum: ['open', 'in_progress', 'done', 'blocked'] }, priority: { type: 'string' },
    }, required: ['taskId'] },
  },
  {
    name: 'complete_task',
    description: 'Mark a task done and record the outcome. This feeds the self-learning memory.',
    parameters: { type: 'OBJECT', properties: {
      taskId: { type: 'string' }, outcome: { type: 'string' }, rating: { type: 'integer', minimum: 1, maximum: 5 },
    }, required: ['taskId', 'outcome'] },
  },
  {
    name: 'list_deadlines',
    description: 'List application deadlines. Optional daysAhead filter (e.g. 30 = only next 30 days).',
    parameters: { type: 'OBJECT', properties: { daysAhead: { type: 'integer' } } },
  },
  {
    name: 'add_deadline',
    description: 'Add a deadline.',
    parameters: { type: 'OBJECT', properties: {
      title: { type: 'string' }, dueAt: { type: 'string', description: 'ISO date (YYYY-MM-DD)' },
      category: { type: 'string' }, notes: { type: 'string' }, critical: { type: 'boolean' },
    }, required: ['title', 'dueAt'] },
  },
  {
    name: 'list_milestones',
    description: 'List plan milestones with status.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'add_reminder',
    description: 'Schedule an Android reminder (fires even offline on the phone).',
    parameters: { type: 'OBJECT', properties: {
      title: { type: 'string' }, body: { type: 'string' }, dueAt: { type: 'string', description: 'ISO datetime when the reminder should fire' },
      leadMinutes: { type: 'integer', description: 'Minutes before dueAt to remind (default 60)' },
    }, required: ['title', 'dueAt'] },
  },
  {
    name: 'get_today',
    description: 'Get today\'s focus: current phase, tasks due, deadline countdowns.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'create_plan_from_text',
    description: 'Ingest a career plan/path text (markdown/txt) and decompose it into phases, milestones, deadlines and tasks automatically.',
    parameters: { type: 'OBJECT', properties: {
      text: { type: 'string' }, graduationDate: { type: 'string', description: 'ISO date or empty' },
    }, required: ['text'] },
  },
  {
    name: 'get_learning_stats',
    description: 'Get self-learning memory stats (feedback, outcomes, learned facts).',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'record_fact',
    description: 'Record a learned fact/preference about the user into self-learning memory.',
    parameters: { type: 'OBJECT', properties: { fact: { type: 'string' }, strength: { type: 'integer', minimum: 1, maximum: 5 } }, required: ['fact'] },
  },
  {
    name: 'get_system_status',
    description: 'Get status of all connected systems (robowatch, EEE_Academic_OS, team dashboard, career-io, news-pulse).',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'notify',
    description: 'Create a notification for the user (shown in dashboard + pushed to Android).',
    parameters: { type: 'OBJECT', properties: {
      title: { type: 'string' }, body: { type: 'string' }, type: { type: 'string', enum: ['system', 'deadline', 'task', 'connector', 'agent', 'milestone'] },
    }, required: ['title', 'body'] },
  },
  {
    name: 'add_event',
    description: 'Add a calendar event (meeting, exam, class, etc).',
    parameters: { type: 'OBJECT', properties: {
      title: { type: 'string' }, startAt: { type: 'string', description: 'ISO datetime' }, endAt: { type: 'string' }, notes: { type: 'string' },
    }, required: ['title', 'startAt'] },
  },
  {
    name: 'set_goal',
    description: 'Add or update a career goal.',
    parameters: { type: 'OBJECT', properties: { goal: { type: 'string' }, by: { type: 'string' } }, required: ['goal'] },
  },
];

async function executeTool(name, args) {
  switch (name) {
    case 'list_tasks': {
      let items = await listDocs('tasks');
      if (args.status) items = items.filter((t) => t.status === args.status);
      if (args.category) items = items.filter((t) => t.category === args.category);
      if (args.phase) items = items.filter((t) => t.phase === args.phase);
      return { tasks: items.map((t) => ({ id: t.id, title: t.title, status: t.status, category: t.category, priority: t.priority, dueAt: t.dueAt, phase: t.phase })) };
    }
    case 'add_task': {
      const rec = await addDoc('tasks', {
        title: args.title, description: args.description || '', dueAt: args.dueAt || '', category: args.category || 'general',
        priority: args.priority || 'medium', phase: args.phase || '', status: 'open', source: 'agent', createdAt: nowIso(), completedAt: '', outcome: '', rating: 0,
      });
      return { ok: true, task: rec };
    }
    case 'update_task': {
      const doc = await getDoc('tasks/' + args.taskId);
      if (!doc) return { error: 'task not found' };
      const patch = {};
      ['title', 'description', 'dueAt', 'status', 'priority'].forEach((k) => { if (args[k] !== undefined) patch[k] = args[k]; });
      if (patch.status === 'done' && !doc.completedAt) patch.completedAt = nowIso();
      await setDoc('tasks/' + args.taskId, patch);
      return { ok: true };
    }
    case 'complete_task': {
      const doc = await getDoc('tasks/' + args.taskId);
      if (!doc) return { error: 'task not found' };
      await setDoc('tasks/' + args.taskId, { status: 'done', completedAt: nowIso(), outcome: args.outcome || '', rating: args.rating || 0 });
      await addDoc('learning_events', { ts: nowIso(), type: 'task_outcome', entity: 'task', entityId: args.taskId, text: 'Completed: ' + doc.title + ' | Outcome: ' + (args.outcome || '') , rating: args.rating || 0 });
      await bumpStats();
      return { ok: true };
    }
    case 'list_deadlines': {
      let items = await listDocs('deadlines');
      if (args.daysAhead) {
        const cutoff = addDaysLocal(args.daysAhead).toISOString();
        items = items.filter((d) => d.dueAt <= cutoff);
      }
      items.sort((a, b) => (a.dueAt || '').localeCompare(b.dueAt || ''));
      return { deadlines: items.map((d) => ({ id: d.id, title: d.title, dueAt: d.dueAt, days: daysUntil(d.dueAt), human: inDays(d.dueAt), category: d.category, critical: !!d.critical })) };
    }
    case 'add_deadline': {
      const rec = await addDoc('deadlines', {
        title: args.title, dueAt: args.dueAt, category: args.category || 'scholarship', notes: args.notes || '', critical: !!args.critical, status: 'pending',
      });
      return { ok: true, deadline: rec };
    }
    case 'list_milestones': {
      let items = await listDocs('milestones');
      return { milestones: items.map((m) => ({ title: m.title, dueAt: m.dueAt, human: inDays(m.dueAt), status: m.status, category: m.category })) };
    }
    case 'add_reminder': {
      const rec = await addDoc('reminders', {
        title: args.title, body: args.body || '', dueAt: args.dueAt, leadMinutes: args.leadMinutes || 60,
        status: 'pending', fired: false, createdAt: nowIso(),
      });
      return { ok: true, reminder: rec };
    }
    case 'get_today': {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const activePhase = PHASES.find((p) => p.status === 'active');
      const today = toLocalDateStr(now.toISOString());
      const tasks = await listDocs('tasks');
      const deadlines = await listDocs('deadlines');
      const dueTasks = tasks.filter((t) => t.status !== 'done' && t.dueAt && toLocalDateStr(t.dueAt) <= today).slice(0, 15);
      const upcomingDeadlines = deadlines.filter((d) => d.dueAt && daysUntil(d.dueAt) >= 0 && daysUntil(d.dueAt) <= 90).sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, 15);
      return {
        date: today,
        month: month,
        year: year,
        activePhase: activePhase ? activePhase.label : 'none',
        todayFocus: activePhase ? activePhase.focus : [],
        dueTasks: dueTasks.map((t) => ({ id: t.id, title: t.title })),
        deadlineCountdowns: upcomingDeadlines.map((d) => ({ title: d.title, human: inDays(d.dueAt), critical: !!d.critical })),
      };
    }
    case 'create_plan_from_text': {
      return { ok: true, note: 'Received plan text (' + args.text.length + ' chars). Run the dedicated /api/plan/ingest endpoint to fully decompose it.', preview: args.text.slice(0, 500) };
    }
    case 'get_learning_stats': {
      const stats = await getDoc('learning/stats');
      const facts = await listDocs('learning_facts');
      const events = await listDocs('learning_events');
      return { stats: stats || { taskOutcomes: 0, feedbackCount: 0, corrections: 0 }, facts: facts.map((f) => ({ fact: f.fact, strength: f.strength, source: f.source })).slice(0, 20), recentEvents: events.slice(-10).map((e) => e.text) };
    }
    case 'record_fact': {
      await addDoc('learning_facts', { fact: args.fact, strength: args.strength || 3, source: 'agent', createdAt: nowIso() });
      await bumpStats();
      return { ok: true };
    }
    case 'get_system_status': {
      const systems = await listDocs('systems');
      return { systems: systems.map((s) => ({ key: s.id, name: s.name, status: s.status, lastSync: s.lastSync, summary: s.summary || '' })) };
    }
    case 'notify': {
      const rec = await addDoc('notifications', { title: args.title, body: args.body, type: args.type || 'agent', level: 'info', read: false, createdAt: nowIso(), source: 'agent' });
      return { ok: true, notification: rec };
    }
    case 'add_event': {
      const rec = await addDoc('events', { title: args.title, startAt: args.startAt, endAt: args.endAt || args.startAt, notes: args.notes || '', createdAt: nowIso() });
      return { ok: true, event: rec };
    }
    case 'set_goal': {
      const rec = await addDoc('goals', { goal: args.goal, by: args.by || '', status: 'active', createdAt: nowIso() });
      return { ok: true, goal: rec };
    }
    default:
      return { error: 'unknown tool ' + name };
  }
}

async function bumpStats() {
  const s = await getDoc('learning/stats');
  const next = s || { taskOutcomes: 0, feedbackCount: 0, corrections: 0, facts: 0, lastUpdated: '' };
  next.taskOutcomes = (next.taskOutcomes || 0) + 1;
  next.lastUpdated = nowIso();
  await setDoc('learning/stats', next, false);
}

// ---------------- SYSTEM PROMPT ----------------

async function buildSystemPrompt() {
  const facts = await listDocs('learning_facts');
  const events = await listDocs('learning_events');
  const deadlines = await listDocs('deadlines');
  const milestones = await listDocs('milestones');
  const tasks = await listDocs('tasks');

  const today = new Date();
  const activePhase = PHASES.find((p) => p.status === 'active');
  const upcoming = deadlines
    .filter((d) => d.dueAt && daysUntil(d.dueAt) >= 0 && daysUntil(d.dueAt) <= 120)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 12)
    .map((d) => '  - ' + d.title + ' (' + humanDate(d.dueAt) + ', ' + inDays(d.dueAt) + ')');

  const openTasks = tasks.filter((t) => t.status !== 'done').slice(0, 10).map((t) => '  - [' + (t.status === 'in_progress' ? 'IN PROGRESS' : 'OPEN') + '] ' + t.title + (t.dueAt ? ' due ' + humanDate(t.dueAt) : ''));

  const pendingMilestones = milestones.filter((m) => m.status !== 'done').slice(0, 8).map((m) => '  - ' + m.title + ' (' + humanDate(m.dueAt) + ', ' + inDays(m.dueAt) + ')');

  const learnedFacts = facts.slice(-15).map((f) => '  - ' + f.fact + (f.strength ? ' (strength ' + f.strength + ')' : ''));
  const recentEvents = events.slice(-8).map((e) => '  - ' + e.text);

  const lines = [];
  lines.push('You are the default intelligence ("Pulse") inside Sadnan OS, the all-in-one command center that unifies all of Sadnan Sajid\'s automation systems (robowatch, EEE_Academic_OS, robot-oda-dashboard, career-intelligence-agent-os, news-pulse).');
  lines.push('');
  lines.push('You are a career strategist, project manager, and personal mentor rolled into one. You manage Sadnan\'s journey to a fully funded MSc/RA in Robotics or Autonomous Systems (2027-28 intake). You are proactive, direct, encouraging, and precise about dates.');
  lines.push('');
  lines.push('=== SADNAN\'S PROFILE ===');
  lines.push('Name: ' + PROFILE.name);
  lines.push('Education: ' + PROFILE.education.degree + ', ' + PROFILE.education.school + ' (' + PROFILE.education.years + '). CGPA ' + PROFILE.education.cgpa + '.');
  lines.push('Career goal: ' + PROFILE.careerGoal);
  lines.push('Country targets (priority): ' + PROFILE.priorityOrder.join('; '));
  lines.push('Critical path items: ' + PROFILE.criticalPath.join('; '));
  lines.push('Research: ' + PROFILE.currentResearch.title + ' | ' + PROFILE.currentResearch.stack + ' | ' + PROFILE.currentResearch.status);
  lines.push('Achievements: ' + PROFILE.achievements.join('; '));
  lines.push('Experience: ' + PROFILE.experience.map((e) => e.role + ' @ ' + e.org + ' (' + e.years + ')').join('; '));
  lines.push('Operating principles: ' + PROFILE.operatingPrinciples.join(' | '));
  lines.push('');
  lines.push('=== CURRENT PLAN ===');
  lines.push('Today is ' + toLocalDateStr(today.toISOString()) + ' (' + today.toDateString() + '), Bangladesh time (UTC+6).');
  lines.push('Active phase: ' + (activePhase ? activePhase.label : 'none') + ' | Focus: ' + (activePhase ? activePhase.focus.join(', ') : ''));
  lines.push('Phases: ' + PHASES.map((p) => p.label).join(' -> '));
  lines.push('');
  lines.push('Upcoming deadlines (next 120 days):');
  lines.push(upcoming.length ? upcoming.join('\n') : '  (none)');
  lines.push('');
  lines.push('Pending milestones:');
  lines.push(pendingMilestones.length ? pendingMilestones.join('\n') : '  (none)');
  lines.push('');
  lines.push('Open tasks:');
  lines.push(openTasks.length ? openTasks.join('\n') : '  (none)');
  lines.push('');
  lines.push('=== SELF-LEARNING MEMORY (facts learned about Sadnan) ===');
  lines.push(learnedFacts.length ? learnedFacts.join('\n') : '  (none yet)');
  lines.push('Recent learning events:');
  lines.push(recentEvents.length ? recentEvents.join('\n') : '  (none yet)');
  lines.push('');
  lines.push('=== BEHAVIOUR RULES ===');
  lines.push('1. Be proactive: if a critical deadline is within 14 days, say so and offer concrete next steps.');
  lines.push('2. When the user shares a career plan/path file, use create_plan_from_text and guide them to the /api/plan/ingest flow for full decomposition.');
  lines.push('3. When a task is completed, record the outcome and rating via complete_task - this is how you learn.');
  lines.push('4. Respect his CGPA situation: never sound discouraged; always frame strategy around achievements, paper, and recommendations.');
  lines.push('5. Keep answers concise and actionable. Use lists. No fluff.');
  lines.push('6. Use tools for real data - never invent dates or statuses.');
  lines.push('7. Timezone is Asia/Dhaka (UTC+6).');
  lines.push('8. If the user changes career direction, propose updating goals and regenerating the plan.');
  return lines.join('\n');
}

module.exports = {
  callGemini,
  buildSystemPrompt,
  executeTool,
  TOOL_DEFS,
  textFrom,
  getModel,
};
