const { PROFILE } = require('./profile');
const { DEADLINES, PHASES, MILESTONES } = require('./seed');
const {
  db, nowIso, makeId, getDoc, setDoc, addDoc, listDocs, queryDocs, deleteDoc,
  daysUntil, inDays, humanDate, toLocalDateStr, addDaysLocal, dhakaParts, DAY_SHORT,
} = require('./util');
const { getSettings } = require('./config');
const { ensureClassReminders, ensureDeadlineReminders } = require('./reminders');
const {
  logTaskOutcome,
  recordFact,
  reinforceFact,
  forgetFact,
  getRelevantFacts,
  getMemorySnapshot,
} = require('./learning');

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Judge/eval traffic goes to the Lite model string (same key, higher free limits).
async function getJudgeModel() {
  const s = await getSettings();
  return s.judgeModel || 'gemini-flash-lite-latest';
}

async function getModel() {
  const s = await getSettings();
  return s.geminiModel || 'gemini-flash-latest';
}

function isRetryable(msg) {
  return /429|RESOURCE_EXHAUSTED|503|500|overloaded|timeout|ETIMEDOUT|ECONNRESET/i.test(String(msg || ''));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callGemini(systemPrompt, contents, tools, opts) {
  const s = await getSettings();
  const key = s.geminiKey;
  if (!key) throw new Error('GEMINI_API_KEY not configured');
  const model = (opts && opts.model) || (await getModel());
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: contents,
    generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
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

// Resilient wrapper: retry with backoff, then fall back to the Lite model.
// Every attempt is counted in learning/stats (geminiCalls / geminiFallbacks).
async function resilientCall(systemPrompt, contents, tools, opts) {
  const { bumpStat } = require('./learning');
  const delays = [600, 2000, 5000];
  let lastErr = null;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      await bumpStat('geminiCalls');
      return await callGemini(systemPrompt, contents, tools, opts);
    } catch (e) {
      lastErr = e;
      if (!isRetryable(e.message) || attempt === delays.length) break;
      await sleep(delays[attempt]);
    }
  }
  // Final attempt on the Lite fallback model (same key).
  try {
    await bumpStat('geminiFallbacks');
    return await callGemini(systemPrompt, contents, tools, Object.assign({}, opts, { model: await getJudgeModel() }));
  } catch (e) {
    throw lastErr || e;
  }
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
    name: 'get_relevant_memory',
    description: 'Get self-learning facts ranked by relevance to a query/phase/category (replaces blind last-N).',
    parameters: { type: 'OBJECT', properties: { query: { type: 'string' }, phase: { type: 'string' }, category: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 20 } } },
  },
  {
    name: 'reinforce_fact',
    description: 'Confirm a learned fact (increases strength + confirmCount).',
    parameters: { type: 'OBJECT', properties: { factId: { type: 'string' } }, required: ['factId'] },
  },
  {
    name: 'forget_fact',
    description: 'Forget a wrong/outdated learned fact (soft-delete).',
    parameters: { type: 'OBJECT', properties: { factId: { type: 'string' } }, required: ['factId'] },
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
  {
    name: 'list_schedule',
    description: 'List the weekly class schedule (day, times, room, teacher).',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'add_class',
    description: 'Add a weekly class to the class routine. A 15-minute-before offline reminder is scheduled automatically for every occurrence.',
    parameters: { type: 'OBJECT', properties: {
      title: { type: 'string', description: 'Course name or code' }, course: { type: 'string' },
      dayOfWeek: { type: 'integer', description: '0=Sunday ... 6=Saturday' },
      startTime: { type: 'string', description: 'HH:MM (24h)' }, endTime: { type: 'string', description: 'HH:MM (24h)' },
      room: { type: 'string' }, teacher: { type: 'string' },
    }, required: ['title', 'dayOfWeek', 'startTime'] },
  },
  {
    name: 'add_test',
    description: 'Add a class test / exam deadline. A 24-hours-before offline reminder is scheduled automatically.',
    parameters: { type: 'OBJECT', properties: {
      title: { type: 'string' }, dueAt: { type: 'string', description: 'ISO datetime (YYYY-MM-DDTHH:mm)' },
      course: { type: 'string' }, notes: { type: 'string' },
    }, required: ['title', 'dueAt'] },
  },
  {
    name: 'get_classroom_status',
    description: 'Get Google Classroom connection status and last sync result.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'triage_misses',
    description: 'List overdue tasks/deadlines, stuck tasks, and 14-day deadline risks with recovery options.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'tick_checklist',
    description: 'Mark a scholarship checklist item done or not done.',
    parameters: { type: 'OBJECT', properties: {
      scholarshipId: { type: 'string' }, item: { type: 'string' }, done: { type: 'boolean' },
    }, required: ['scholarshipId', 'item', 'done'] },
  },
  {
    name: 'outreach_followups',
    description: 'List professors needing a follow-up (contacted 21+ days ago, no reply).',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'draft_followup',
    description: 'Draft a follow-up email for a professor from their lab notes and history.',
    parameters: { type: 'OBJECT', properties: { professorId: { type: 'string' } }, required: ['professorId'] },
  },
  {
    name: 'list_watches',
    description: 'List watched embassy/notice pages and their last-change state.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'add_watch',
    description: 'Watch a URL for changes (embassy notices, exam pages).',
    parameters: { type: 'OBJECT', properties: { name: { type: 'string' }, url: { type: 'string' } }, required: ['name', 'url'] },
  },
  {
    name: 'list_playbooks',
    description: 'List issue playbooks (MOI rejected, GPA shortfall, ghosting, missed deadline, attestation, portal errors).',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_playbook',
    description: 'Get the playbook matching a problem description.',
    parameters: { type: 'OBJECT', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'weekly_review',
    description: 'Get the latest weekly review (completion by category, routine streaks, proposed focus).',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'delete_task',
    description: 'Permanently delete a task. Ask the user to confirm first.',
    parameters: { type: 'OBJECT', properties: { taskId: { type: 'string' } }, required: ['taskId'] },
  },
  {
    name: 'delete_deadline',
    description: 'Permanently delete a deadline. Ask the user to confirm first.',
    parameters: { type: 'OBJECT', properties: { deadlineId: { type: 'string' } }, required: ['deadlineId'] },
  },
  {
    name: 'toggle_milestone',
    description: 'Toggle a milestone between done and pending by its exact title.',
    parameters: { type: 'OBJECT', properties: { title: { type: 'string' } }, required: ['title'] },
  },
  {
    name: 'run_daily_routine',
    description: 'Generate today\'s routine tasks (2h study + 1h project) if missing.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'list_scholarships',
    description: 'List tracked scholarships with status and deadlines.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'add_scholarship',
    description: 'Add a new scholarship tracker entry.',
    parameters: { type: 'OBJECT', properties: {
      name: { type: 'string' }, country: { type: 'string' }, deadline: { type: 'string', description: 'YYYY-MM-DD' },
      cgpaReq: { type: 'string' }, status: { type: 'string' }, priority: { type: 'string', enum: ['A', 'B', 'C'] },
      coverage: { type: 'string' }, docs: { type: 'string' }, notes: { type: 'string' }, url: { type: 'string' },
    }, required: ['name'] },
  },
  {
    name: 'update_scholarship',
    description: 'Update a scholarship tracker entry (status, notes, deadline, url). Find it with list_scholarships first.',
    parameters: { type: 'OBJECT', properties: {
      scholarshipId: { type: 'string' }, status: { type: 'string' }, notes: { type: 'string' }, deadline: { type: 'string' }, url: { type: 'string' },
    }, required: ['scholarshipId'] },
  },
  {
    name: 'list_universities',
    description: 'List tracked universities with status and deadlines.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'update_university',
    description: 'Update a university tracker entry. Find it with list_universities first.',
    parameters: { type: 'OBJECT', properties: {
      universityId: { type: 'string' }, status: { type: 'string' }, notes: { type: 'string' }, appDeadline: { type: 'string' }, url: { type: 'string' },
    }, required: ['universityId'] },
  },
  {
    name: 'list_professors',
    description: 'List contacted professors with status.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'update_professor',
    description: 'Update a professor entry (status, response, notes, contacted date). Find it with list_professors first.',
    parameters: { type: 'OBJECT', properties: {
      professorId: { type: 'string' }, status: { type: 'string', enum: ['To Contact', 'Emailed', 'No Response', 'Responded', 'Meeting Set', 'Positive', 'Negative'] }, response: { type: 'string' }, notes: { type: 'string' }, contacted: { type: 'string' },
    }, required: ['professorId'] },
  },
  {
    name: 'get_cgpa',
    description: 'Get the CGPA tracker (current, target, backlogs, plan).',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'update_cgpa',
    description: 'Update CGPA tracker fields (backlog grades, future semesters, notes).',
    parameters: { type: 'OBJECT', properties: {
      backlogs: { type: 'string', description: 'JSON array of {course,credits,done,newGrade}' }, futureSems: { type: 'string', description: 'JSON array of {gpa,credits}' }, notes: { type: 'string' },
    } },
  },
  {
    name: 'list_notes',
    description: 'List research notebooks and entries.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'add_note',
    description: 'Add an entry to a notebook (creates the notebook if needed).',
    parameters: { type: 'OBJECT', properties: {
      notebook: { type: 'string' }, title: { type: 'string' }, content: { type: 'string' },
    }, required: ['notebook', 'title'] },
  },
  {
    name: 'search_notes',
    description: 'Keyword search across all notebook entries.',
    parameters: { type: 'OBJECT', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'update_profile',
    description: 'Update profile fields (headline, currentResearch status, achievements, etc).',
    parameters: { type: 'OBJECT', properties: {
      headline: { type: 'string' }, careerGoal: { type: 'string' }, achievements: { type: 'string', description: 'JSON array of strings' }, leadership: { type: 'string', description: 'JSON array of strings' }, researchStatus: { type: 'string' },
    } },
  },
  {
    name: 'list_rhythms',
    description: 'List weekly-rhythm overrides (prep leave, semester break, custom periods).',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'set_rhythm_override',
    description: 'Create a time-varying rhythm override so the user can just describe a period in plain words (e.g. "no project work during prep leave"). academic/technical: hours per day as a number, "full" for open-ended full-day focus, or 0 to skip.',
    parameters: { type: 'OBJECT', properties: {
      name: { type: 'string' }, startDate: { type: 'string', description: 'YYYY-MM-DD' }, endDate: { type: 'string', description: 'YYYY-MM-DD' },
      academic: { type: 'string', description: 'hours number, "full" or "0"' }, technical: { type: 'string', description: 'hours number, "full" or "0"' }, note: { type: 'string' },
    }, required: ['name', 'startDate', 'endDate', 'academic', 'technical'] },
  },
  {
    name: 'delete_rhythm',
    description: 'Delete a rhythm override by id (see list_rhythms). Daily generator falls back to the default weekly rhythm.',
    parameters: { type: 'OBJECT', properties: { rhythmId: { type: 'string' } }, required: ['rhythmId'] },
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
      await logTaskOutcome({
        taskId: args.taskId,
        title: doc.title,
        outcome: args.outcome || '',
        rating: args.rating || 0,
        category: doc.category || '',
        phase: doc.phase || '',
      });
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
      const livePhases = await listDocs('phases').catch(() => []);
      const activePhase = (livePhases.length ? livePhases : PHASES).find((p) => p.status === 'active');
      let rhythm = null;
      try { rhythm = await require('./routine').describeRhythm(); } catch (e) {}
      const today = toLocalDateStr(now.toISOString());
      const tasks = await listDocs('tasks');
      const deadlines = await listDocs('deadlines');
      const schedule = await listDocs('schedule');
      const todayDow = dhakaParts(Date.now()).dow;
      const todayClasses = schedule
        .filter((e) => e.enabled !== false && e.dayOfWeek === todayDow)
        .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
        .map((e) => ({ title: e.title, time: e.startTime + (e.endTime ? '-' + e.endTime : ''), room: e.room || '' }));
      const dueTasks = tasks.filter((t) => t.status !== 'done' && t.dueAt && toLocalDateStr(t.dueAt) <= today).slice(0, 15);
      const upcomingDeadlines = deadlines.filter((d) => d.dueAt && daysUntil(d.dueAt) >= 0 && daysUntil(d.dueAt) <= 90).sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, 15);
      return {
        date: today,
        month: month,
        year: year,
        activePhase: activePhase ? activePhase.label : 'none',
        todayFocus: activePhase ? activePhase.focus : [],
        todayClasses: todayClasses,
        rhythm: rhythm,
        dueTasks: dueTasks.map((t) => ({ id: t.id, title: t.title })),
        deadlineCountdowns: upcomingDeadlines.map((d) => ({ title: d.title, human: inDays(d.dueAt), critical: !!d.critical })),
      };
    }
    case 'create_plan_from_text': {
      return { ok: true, note: 'Received plan text (' + args.text.length + ' chars). Run the dedicated /api/plan/ingest endpoint to fully decompose it.', preview: args.text.slice(0, 500) };
    }
    case 'get_learning_stats': {
      const snap = await getMemorySnapshot(10);
      return { stats: snap.stats || { taskOutcomes: 0, feedbackCount: 0, corrections: 0 }, facts: snap.facts.slice(0, 20).map((f) => ({ id: f.id, fact: f.fact, strength: f.strength, source: f.source })), recentEvents: snap.recentEvents.map((e) => e.text) };
    }
    case 'record_fact': {
      const rec = await recordFact({ fact: args.fact, strength: args.strength || 3, source: 'agent' });
      return { ok: true, id: rec.id, reinforced: !!rec.reinforced };
    }
    case 'get_relevant_memory': {
      const facts = await getRelevantFacts({ query: args.query || '', phase: args.phase || '', category: args.category || '', limit: args.limit || 8 });
      return { facts: facts.map((f) => ({ id: f.id, fact: f.fact, strength: f.strength, source: f.source })) };
    }
    case 'reinforce_fact': {
      try {
        const rec = await reinforceFact(args.factId);
        return { ok: true, fact: rec };
      } catch (e) {
        return { error: e.message };
      }
    }
    case 'forget_fact': {
      try {
        await forgetFact(args.factId);
        return { ok: true };
      } catch (e) {
        return { error: e.message };
      }
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
    case 'list_schedule': {
      const items = await listDocs('schedule');
      items.sort((a, b) => (a.dayOfWeek - b.dayOfWeek) || (a.startTime || '').localeCompare(b.startTime || ''));
      return { schedule: items.map((x) => ({
        day: DAY_SHORT[x.dayOfWeek], time: x.startTime + (x.endTime ? '-' + x.endTime : ''),
        course: x.course || x.title, room: x.room || '', teacher: x.teacher || '',
      })) };
    }
    case 'add_class': {
      const rec = await addDoc('schedule', {
        title: args.title, course: args.course || '', dayOfWeek: parseInt(args.dayOfWeek, 10),
        startTime: args.startTime, endTime: args.endTime || '', room: args.room || '', teacher: args.teacher || '',
        color: '', enabled: true, createdAt: nowIso(),
      });
      await ensureClassReminders();
      return { ok: true, class: rec };
    }
    case 'add_test': {
      const rec = await addDoc('deadlines', {
        title: args.title, dueAt: args.dueAt, category: 'class_test',
        notes: (args.course ? args.course + ' · ' : '') + (args.notes || ''),
        critical: false, status: 'pending', createdAt: nowIso(),
      });
      await ensureDeadlineReminders();
      return { ok: true, test: rec };
    }
    case 'get_classroom_status': {
      const { getStatus } = require('./classroom');
      return await getStatus();
    }
    case 'triage_misses': {
      const { triageMisses } = require('./triage');
      return await triageMisses();
    }
    case 'tick_checklist': {
      const { buildChecklist } = require('./trackers');
      const doc = await getDoc('scholarships/' + args.scholarshipId);
      if (!doc) return { error: 'scholarship not found' };
      const items = buildChecklist(doc);
      const hit = items.find((i) => i.item.toLowerCase() === String(args.item || '').toLowerCase());
      if (!hit) return { error: 'item not found. Available: ' + items.map((i) => i.item).join('; ') };
      hit.done = !!args.done;
      await setDoc('scholarships/' + args.scholarshipId, { checklist: items });
      return { ok: true, done: items.filter((i) => i.done).length, total: items.length };
    }
    case 'outreach_followups': {
      const profs = await listDocs('professors');
      const cutoff = new Date(Date.now() - 21 * 86400000).toISOString();
      return {
        followups: profs
          .filter((p) => ['Emailed', 'No Response'].includes(p.status) && p.contacted && p.contacted < cutoff && !p.followUpSent)
          .map((p) => ({ id: p.id, name: p.name || '(unnamed)', university: p.university, status: p.status, contacted: p.contacted })),
      };
    }
    case 'draft_followup': {
      const p = await getDoc('professors/' + args.professorId);
      if (!p) return { error: 'professor not found' };
      const lines = [
        'Subject: Follow-up: prospective MSc student — ' + (p.university || 'your lab'),
        '',
        'Dear Professor ' + (p.name || '').replace(/^(Prof\.|Dr\.)\s*/, '') + ',',
        '',
        'I am following up on my email from ' + (p.contacted || 'a few weeks ago') + ' about joining your lab as a funded MSc student.',
        'Since writing, ' + (p.response ? 'noted your reply (' + p.response + '). ' : '') + 'My context: ' + (p.field || 'robotics') + ' at ' + (p.university || '') + '.',
        (p.notes ? 'Re your work: ' + p.notes + ' ' : '') + 'Would a brief 15-minute call work to discuss fit?',
        '',
        'Best regards, Sadnan',
      ];
      return { ok: true, draft: lines.join('\n'), note: 'Review and personalize before sending. Sending is manual.' };
    }
    case 'list_watches': {
      const { ensureWatches } = require('./watcher');
      const items = await ensureWatches();
      return { watches: items.map((w) => ({ id: w.id, name: w.name, url: w.url, lastCheck: w.lastCheck || '', lastChange: w.lastChange || '' })) };
    }
    case 'add_watch': {
      if (!args.url) return { error: 'url required' };
      const rec = await addDoc('watches', { name: args.name || args.url, url: args.url, hash: '', lastCheck: '', lastChange: '', createdAt: nowIso() });
      return { ok: true, watch: rec };
    }
    case 'list_playbooks': {
      const { ensurePlaybooks } = require('./playbooks');
      const items = await ensurePlaybooks();
      return { playbooks: items.map((p) => ({ id: p.id, title: p.title })) };
    }
    case 'get_playbook': {
      const { ensurePlaybooks, matchPlaybook } = require('./playbooks');
      const items = await ensurePlaybooks();
      const hit = matchPlaybook(items, args.query || '');
      if (!hit) return { error: 'no matching playbook. Available: ' + items.map((p) => p.title).join('; ') };
      return { title: hit.title, body: hit.body };
    }
    case 'weekly_review': {
      const r = await getDoc('review/weekly');
      return r ? { review: r } : { note: 'no weekly review yet - runs Sundays' };
    }
    case 'delete_task': {
      const doc = await getDoc('tasks/' + args.taskId);
      if (!doc) return { error: 'task not found' };
      await deleteDoc('tasks/' + args.taskId);
      return { ok: true, deleted: doc.title };
    }
    case 'delete_deadline': {
      const doc = await getDoc('deadlines/' + args.deadlineId);
      if (!doc) return { error: 'deadline not found' };
      await deleteDoc('deadlines/' + args.deadlineId);
      return { ok: true, deleted: doc.title };
    }
    case 'toggle_milestone': {
      const items = await listDocs('milestones');
      const m = items.find((x) => (x.title || '').toLowerCase() === String(args.title || '').toLowerCase())
        || items.find((x) => (x.title || '').toLowerCase().includes(String(args.title || '').toLowerCase()));
      if (!m) return { error: 'milestone not found' };
      const next = m.status === 'done' ? 'pending' : 'done';
      await setDoc('milestones/' + m.id, { status: next });
      return { ok: true, title: m.title, status: next };
    }
    case 'run_daily_routine': {
      const { ensureDailyRoutine } = require('./routine');
      return await ensureDailyRoutine();
    }
    case 'list_scholarships': {
      const items = await listDocs('scholarships');
      return { scholarships: items.map((s) => ({ id: s.id, name: s.name, country: s.country, deadline: s.deadline, status: s.status, priority: s.priority })) };
    }
    case 'add_scholarship': {
      if (!args.name) return { error: 'name required' };
      const rec = await addDoc('scholarships', {
        name: args.name, country: args.country || '', deadline: args.deadline || '', cgpaReq: args.cgpaReq || '',
        status: args.status || 'Research', priority: args.priority || 'B', coverage: args.coverage || '',
        docs: args.docs || '', notes: args.notes || '', url: args.url || '', createdAt: nowIso(),
      });
      return { ok: true, scholarship: rec };
    }
    case 'update_scholarship': {
      const doc = await getDoc('scholarships/' + args.scholarshipId);
      if (!doc) return { error: 'scholarship not found' };
      const patch = {};
      ['status', 'notes', 'deadline', 'url'].forEach((k) => { if (args[k] !== undefined) patch[k] = args[k]; });
      await setDoc('scholarships/' + args.scholarshipId, patch);
      return { ok: true };
    }
    case 'list_universities': {
      const items = await listDocs('universities');
      return { universities: items.map((u) => ({ id: u.id, name: u.name, country: u.country, status: u.status, appDeadline: u.appDeadline })) };
    }
    case 'update_university': {
      const doc = await getDoc('universities/' + args.universityId);
      if (!doc) return { error: 'university not found' };
      const patch = {};
      ['status', 'notes', 'appDeadline', 'url'].forEach((k) => { if (args[k] !== undefined) patch[k] = args[k]; });
      await setDoc('universities/' + args.universityId, patch);
      return { ok: true };
    }
    case 'list_professors': {
      const items = await listDocs('professors');
      return { professors: items.map((p) => ({ id: p.id, name: p.name || '(unnamed)', university: p.university, status: p.status })) };
    }
    case 'update_professor': {
      const doc = await getDoc('professors/' + args.professorId);
      if (!doc) return { error: 'professor not found' };
      const patch = {};
      ['status', 'response', 'notes', 'contacted'].forEach((k) => { if (args[k] !== undefined) patch[k] = args[k]; });
      await setDoc('professors/' + args.professorId, patch);
      return { ok: true };
    }
    case 'get_cgpa': {
      const c = await getDoc('mission/cgpa');
      if (!c) return { error: 'no cgpa tracker' };
      return { cgpa: c.cgpa, target: c.target, completedCredits: c.completedCredits, totalDegreeCredits: c.totalDegreeCredits, backlogs: c.backlogs, futureSems: c.futureSems || [] };
    }
    case 'update_cgpa': {
      const patch = {};
      if (args.notes !== undefined) patch.notes = args.notes;
      for (const k of ['backlogs', 'futureSems']) {
        if (args[k] !== undefined) {
          try { patch[k] = JSON.parse(args[k]); }
          catch (e) { return { error: 'invalid JSON for ' + k }; }
        }
      }
      if (!Object.keys(patch).length) return { error: 'nothing to update' };
      await setDoc('mission/cgpa', patch);
      return { ok: true };
    }
    case 'list_notes': {
      const items = await listDocs('notes');
      return { notebooks: items.map((n) => ({ id: n.id, title: n.title, entries: (n.entries || []).length })) };
    }
    case 'add_note': {
      const items = await listDocs('notes');
      const nb = items.find((n) => (n.title || '').toLowerCase() === String(args.notebook || '').toLowerCase());
      const entry = { title: args.title, content: args.content || '', createdAt: nowIso() };
      if (!nb) {
        await addDoc('notes', { title: args.notebook, color: '#f59e0b', entries: [entry], createdAt: nowIso() });
        return { ok: true, created: args.notebook };
      }
      await setDoc('notes/' + nb.id, { entries: (nb.entries || []).concat([entry]) });
      return { ok: true, notebook: nb.title };
    }
    case 'search_notes': {
      const q = String(args.query || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
      const items = await listDocs('notes');
      const hits = [];
      for (const n of items) {
        for (const e of (n.entries || [])) {
          const text = ((e.title || '') + ' ' + (e.content || '')).toLowerCase();
          const score = q.filter((w) => text.includes(w)).length;
          if (score > 0 && hits.length < 10) hits.push({ notebook: n.title, title: e.title, snippet: String(e.content || '').slice(0, 200), score });
        }
      }
      hits.sort((a, b) => b.score - a.score);
      return { hits };
    }
    case 'update_profile': {
      const doc = (await getDoc('profile/main')) || {};
      const patch = {};
      if (args.headline !== undefined) patch.headline = args.headline;
      if (args.careerGoal !== undefined) patch.careerGoal = args.careerGoal;
      if (args.researchStatus !== undefined) {
        patch.currentResearch = Object.assign({}, doc.currentResearch, { status: args.researchStatus });
      }
      for (const k of ['achievements', 'leadership']) {
        if (args[k] !== undefined) {
          try { patch[k] = JSON.parse(args[k]); }
          catch (e) { return { error: 'invalid JSON for ' + k }; }
        }
      }
      if (!Object.keys(patch).length) return { error: 'nothing to update' };
      await setDoc('profile/main', patch);
      return { ok: true };
    }
    case 'list_rhythms': {
      const items = await listDocs('rhythms');
      items.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
      return { rhythms: items.map((r) => ({ id: r.id, name: r.name, startDate: r.startDate, endDate: r.endDate, academic: r.academic, technical: r.technical, status: r.status || 'active', note: r.note || '' })) };
    }
    case 'set_rhythm_override': {
      const parseHours = (v) => {
        const s = String(v == null ? '' : v).trim().toLowerCase();
        if (s === 'full') return 'full';
        const n = Number(s);
        if (!Number.isFinite(n) || n < 0 || n > 24) return null;
        return n;
      };
      const academic = parseHours(args.academic);
      const technical = parseHours(args.technical);
      if (!args.name || !/^\d{4}-\d{2}-\d{2}$/.test(args.startDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(args.endDate || '')) {
        return { error: 'name, startDate (YYYY-MM-DD) and endDate (YYYY-MM-DD) required' };
      }
      if (academic === null || technical === null) return { error: 'academic/technical must be hours 0-24, "full" or "0"' };
      if (args.startDate > args.endDate) return { error: 'startDate must be on or before endDate' };
      const rec = await addDoc('rhythms', {
        name: args.name, startDate: args.startDate, endDate: args.endDate,
        academic, technical, note: args.note || '', status: 'active', createdAt: nowIso(),
      });
      return { ok: true, rhythm: rec };
    }
    case 'delete_rhythm': {
      const doc = await getDoc('rhythms/' + args.rhythmId);
      if (!doc) return { error: 'rhythm not found' };
      await deleteDoc('rhythms/' + args.rhythmId);
      return { ok: true, deleted: doc.name };
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
  const deadlines = await listDocs('deadlines');
  const milestones = await listDocs('milestones');
  const tasks = await listDocs('tasks');
  const schedule = await listDocs('schedule');
  const events = await listDocs('learning_events');
  const dbPhases = await listDocs('phases').catch(() => []);
  const livePhases = dbPhases.length ? dbPhases : PHASES;

  const today = new Date();
  const activePhase = livePhases.find((p) => p.status === 'active');
  const todayStr = toLocalDateStr(today.toISOString());
  const todayDow = dhakaParts(Date.now()).dow;
  const todayClasses = schedule
    .filter((e) => e.enabled !== false && e.dayOfWeek === todayDow)
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
    .map((e) => '  - ' + e.title + ' ' + e.startTime + (e.endTime ? '-' + e.endTime : '') + (e.room ? ' (Rm ' + e.room + ')' : '') + (e.teacher ? ' · ' + e.teacher : ''));
  const upcomingTests = deadlines
    .filter((d) => (d.category === 'class_test' || d.category === 'classroom') && d.dueAt && daysUntil(d.dueAt) >= 0 && daysUntil(d.dueAt) <= 30)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 8)
    .map((d) => '  - ' + d.title + ' (' + humanDate(d.dueAt) + ', ' + inDays(d.dueAt) + ')');
  const scholarships = await listDocs('scholarships').catch(() => []);
  const professors = await listDocs('professors').catch(() => []);
  const uniCount = (await listDocs('universities').catch(() => [])).length;
  const topScholarships = scholarships
    .filter((s) => s.deadline && s.status !== 'Applied' && s.status !== 'Accepted')
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 6)
    .map((s) => '  - ' + s.name + ' (' + s.country + ', ' + humanDate(s.deadline) + ', ' + inDays(s.deadline) + ')');
  const posProfs = professors.filter((p) => ['Responded', 'Meeting Set', 'Positive'].includes(p.status)).length;
  const upcoming = deadlines
    .filter((d) => d.dueAt && daysUntil(d.dueAt) >= 0 && daysUntil(d.dueAt) <= 120)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 12)
    .map((d) => '  - ' + d.title + ' (' + humanDate(d.dueAt) + ', ' + inDays(d.dueAt) + ')');

  const openTasks = tasks.filter((t) => t.status !== 'done').slice(0, 10).map((t) => '  - [' + (t.status === 'in_progress' ? 'IN PROGRESS' : 'OPEN') + '] ' + t.title + (t.dueAt ? ' due ' + humanDate(t.dueAt) : ''));

  const pendingMilestones = milestones.filter((m) => m.status !== 'done').slice(0, 8).map((m) => '  - ' + m.title + ' (' + humanDate(m.dueAt) + ', ' + inDays(m.dueAt) + ')');

  // Today's routine completion state (focus timers feed these tasks).
  const routineToday = tasks.filter((t) => t.source === 'daily-routine' && t.dueAt && toLocalDateStr(t.dueAt) === todayStr)
    .map((t) => '  - ' + t.title + ': ' + t.status);
  // CGPA snapshot for grounded advice.
  let cgpaLine = '  (no CGPA tracker)';
  try {
    const c = await getDoc('mission/cgpa');
    if (c) cgpaLine = '  Current ' + c.cgpa + ' (' + c.completedCredits + '/' + c.totalDegreeCredits + 'cr), target ' + c.target + ', backlogs pending: ' + (c.backlogs || []).filter((b) => !b.done).length;
  } catch (e) {}
  // Unread notification pressure.
  let unreadLine = '';
  try {
    const notifs = await listDocs('notifications');
    const unread = notifs.filter((n) => !n.read).length;
    if (unread) unreadLine = 'Unread notifications: ' + unread + '.';
  } catch (e) {}

  // Phase 1: relevance-ranked memory (tag overlap + strength + recency) instead of blind last-15.
  const relevantFacts = await getRelevantFacts({
    limit: 12,
    phase: activePhase ? activePhase.label : '',
    query: openTasks.slice(0, 3).join(' '),
  });
  const learnedFacts = relevantFacts.map((f) => '  - ' + f.fact + (f.strength ? ' (strength ' + f.strength + ')' : ''));
  const recentEvents = events.slice(-8).map((e) => '  - [' + (e.type || 'event') + '] ' + e.text);

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
  if (PROFILE.ieltsStrategy) lines.push('IELTS strategy: ' + PROFILE.ieltsStrategy);
  if (PROFILE.twoCycleStrategy) lines.push('Two-cycle strategy: ' + PROFILE.twoCycleStrategy);
  lines.push('');
  lines.push('=== CURRENT PLAN ===');
  lines.push('Today is ' + todayStr + ' (' + today.toDateString() + '), Bangladesh time (UTC+6).');
  if (unreadLine) lines.push(unreadLine);
  lines.push('Active phase: ' + (activePhase ? activePhase.label : 'none') + ' | Focus: ' + (activePhase && activePhase.focus ? activePhase.focus.join(', ') : ''));
  lines.push('Phases: ' + livePhases.map((p) => p.label || p.key).join(' -> '));
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
  lines.push('Today\'s routine (2h study + 1h project):');
  lines.push(routineToday.length ? routineToday.join('\n') : '  (not generated yet — use run_daily_routine)');
  lines.push('');
  lines.push('CGPA tracker:');
  lines.push(cgpaLine);
  lines.push('');
  try {
    const { describeRhythm } = require('./routine');
    const rh = await describeRhythm();
    const fmtR = (v) => (v === 'full' ? 'full-day focus' : (v > 0 ? v + 'h' : 'rest'));
    lines.push('=== WEEKLY RHYTHM (' + (rh.mode === 'override' ? 'OVERRIDE: ' + rh.name + ' until ' + rh.until : 'default weekly rhythm') + ') ===');
    lines.push('Today: academic ' + fmtR(rh.academic) + ', technical/project ' + fmtR(rh.technical) + '.');
    if (rh.mode === 'default') lines.push('Default week: Fri/Sat/Sun 3h academic, Thu academic rest, Fri/Sat 2.5h project, otherwise 2h/1h.');
  } catch (e) {}
  lines.push('');
  lines.push('=== TODAY\'S CLASSES (' + DAY_SHORT[todayDow] + ') ===');
  lines.push(todayClasses.length ? todayClasses.join('\n') : '  (no classes today)');
  lines.push('');
  lines.push('Upcoming class tests / classroom deadlines (next 30 days):');
  lines.push(upcomingTests.length ? upcomingTests.join('\n') : '  (none)');
  lines.push('');
  lines.push('=== MASTERS MISSION TRACKERS ===');
  lines.push('Scholarships (priority order by deadline):');
  lines.push(topScholarships.length ? topScholarships.join('\n') : '  (none)');
  lines.push('Universities tracked: ' + uniCount + ' | Professors contacted: ' + professors.length + ' (' + posProfs + ' positive responses)');
  lines.push('');
  lines.push('=== SELF-LEARNING MEMORY (facts learned about Sadnan) ===');
  lines.push(learnedFacts.length ? learnedFacts.join('\n') : '  (none yet)');
  lines.push('Recent learning events:');
  lines.push(recentEvents.length ? recentEvents.join('\n') : '  (none yet)');
  lines.push('');
  if (PROFILE.keyDates && PROFILE.keyDates.length) {
    lines.push('=== CONFIRMED CALENDAR (user-verified: prefer over older plan dates) ===');
    PROFILE.keyDates.forEach((k) => lines.push('  - ' + k));
    lines.push('');
  }
  lines.push('=== BEHAVIOUR RULES ===');
  lines.push('1. Be proactive: if a critical deadline is within 14 days, say so and offer concrete next steps.');
  lines.push('2. When the user shares a career plan/path file, use create_plan_from_text and guide them to the /api/plan/ingest flow for full decomposition.');
  lines.push('3. When a task is completed, record the outcome and rating via complete_task - this is how you learn.');
  lines.push('4. Respect his CGPA situation: never sound discouraged; always frame strategy around achievements, paper, and recommendations.');
  lines.push('5. Keep answers concise and actionable. Use lists. No fluff.');
  lines.push('6. Use tools for real data - never invent dates or statuses.');
  lines.push('7. Timezone is Asia/Dhaka (UTC+6).');
  lines.push('8. If the user changes career direction, propose updating goals and regenerating the plan.');
  lines.push('9. Destructive actions (delete_task, delete_deadline): state exactly what will be deleted and ask for confirmation first — execute only on an explicit yes.');
  lines.push('10. Tracker updates (scholarships/universities/professors/CGPA/notes): list first to get the id, then update. Never invent ids.');
  lines.push('11. Weekly rhythm is time-varying and fully yours to manage: the user may describe any period in plain words ("no project work during prep leave", "full study days until finals", "research focus over the break"). Convert it into a rhythm override with set_rhythm_override (hours number, "full", or 0) covering exact dates, confirm what you created, and mention it ends automatically. Use list_rhythms before creating overlapping ones.');
  lines.push('12. When the user reports a problem (missed deadline, rejected document, ghosting professor, portal error), check get_playbook FIRST and ground your answer in it - do not improvise over a playbook.');
  lines.push('13. Be the specialist on duty: proactively surface triage_misses risks, scholarship readiness gaps, and due follow-ups. Offer the concrete fix (reschedule via update_task, draft via draft_followup), never just the warning.');
  return lines.join('\n');
}

module.exports = {
  callGemini,
  resilientCall,
  buildSystemPrompt,
  executeTool,
  TOOL_DEFS,
  textFrom,
  getModel,
  getJudgeModel,
};
