const { nowIso, setDoc, getDoc, addDoc, listDocs } = require('./util');
const { getSettings } = require('./config');
const { syncClassroom } = require('./classroom');

function summarizeText(text, max) {
  if (!text) return '';
  return String(text).length > max ? String(text).slice(0, max) + '...' : String(text);
}

async function upsertSystem(key, patch) {
  const existing = (await getDoc('systems/' + key)) || {};
  const next = Object.assign({}, existing, patch, { lastSync: nowIso(), key });
  await setDoc('systems/' + key, next, false);
  return next;
}

async function addSystemNotification(key, title, body) {
  await addDoc('notifications', { title, body, type: 'connector', level: 'info', read: false, createdAt: nowIso(), source: key });
}

// ---- career-intelligence-agent-os webhook ----
async function syncCareerIo() {
  const s = await getSettings();
  const url = s.careerIoWebhook;
  if (!url) return { ok: false, error: 'careerIoWebhook not configured' };
  const headers = { 'Content-Type': 'application/json' };

  async function post(type) {
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ secret: s.careerIoSecret, type }),
    });
    const txt = await resp.text();
    let json = null;
    try { json = JSON.parse(txt); } catch (e) { /* ignore */ }
    return { status: resp.status, json, txt: txt.slice(0, 200) };
  }

  const results = {};
  try {
    const stats = await post('admin_learning_stats');
    results.learningStats = stats.status === 200 ? stats.json : stats.txt;
  } catch (e) { results.learningStats = { error: e.message }; }

  try {
    const metrics = await post('admin_refresh_metrics');
    results.metrics = metrics.status === 200 ? metrics.json : metrics.txt;
  } catch (e) { results.metrics = { error: e.message }; }

  const summaryParts = [];
  const stats = results.learningStats;
  if (stats && stats.drafts_total !== undefined) {
    summaryParts.push(stats.drafts_total + ' drafts');
  }
  if (stats && stats.feedback_events !== undefined) {
    summaryParts.push(stats.feedback_events + ' feedback events');
  }
  if (stats && stats.personalization) {
    summaryParts.push('AI personalization active');
  }
  const summary = summaryParts.length ? summaryParts.join(' | ') : 'Synced';

  await upsertSystem('careerIo', {
    name: 'career-intelligence-agent-os',
    status: 'ok',
    summary: summary,
    data: { learningStats: results.learningStats, metrics: results.metrics },
    spreadsheetUrl: s.careerIoSpreadsheetUrl,
  });
  return { ok: true, results };
}

// ---- robot-oda-dashboard Firebase RTDB (read-only) ----
async function syncTeamDashboard() {
  const s = await getSettings();
  const base = s.robotDbUrl || 'https://robot-oda-dashboard-default-rtdb.firebaseio.com';
  const results = {};
  try {
    const [members, tasks, memory] = await Promise.all([
      fetch(base + '/members.json').then((r) => r.json()),
      fetch(base + '/tasks.json').then((r) => r.json()),
      fetch(base + '/learning/memory.json').then((r) => r.json()),
    ]);
    results.members = members;
    results.tasks = tasks;
    results.memory = memory;

    const memberCount = members ? Object.keys(members).length : 0;
    const taskList = tasks ? Object.values(tasks) : [];
    const open = taskList.filter((t) => t && t.status && String(t.status).toLowerCase() !== 'done' && String(t.status).toLowerCase() !== 'completed').length;
    const total = taskList.length;
    const summary = memberCount + ' members | ' + open + '/' + total + ' tasks open';

    await upsertSystem('teamDashboard', {
      name: 'robot-oda-dashboard',
      status: 'ok',
      summary: summary,
      data: { members: summarizeText(JSON.stringify(members), 2000), tasks: summarizeText(JSON.stringify(taskList), 4000), memory: summarizeText(JSON.stringify(memory), 1000) },
    });
  } catch (e) {
    await upsertSystem('teamDashboard', { name: 'robot-oda-dashboard', status: 'error', summary: 'Sync failed: ' + e.message, data: {} });
  }
  return { ok: true, results };
}

// ---- CI ingest (robowatch / EEE_Academic_OS / news-pulse, fetched by GitHub Actions) ----
async function ingestConnectorData(systemKey, payload) {
  const names = {
    robowatch: 'robowatch',
    eeeAcademicOS: 'EEE_Academic_OS',
    newsPulse: 'news-pulse',
  };
  const name = names[systemKey] || systemKey;
  const data = payload.data || {};
  await upsertSystem(systemKey, {
    name,
    status: payload.status || 'ok',
    summary: payload.summary || (data.summary ? data.summary : 'Synced via CI'),
    data: data,
    reportUrl: payload.reportUrl || '',
  });
  return { ok: true };
}

async function syncAll(scope) {
  const s = await getSettings();
  const out = {};
  const enabled = s.systemsEnabled || {};
  if (scope === 'light') {
    if (enabled.careerIo !== false) out.careerIo = await syncCareerIo();
    if (enabled.teamDashboard !== false) out.teamDashboard = await syncTeamDashboard();
  } else {
    if (enabled.careerIo !== false) out.careerIo = await syncCareerIo();
    if (enabled.teamDashboard !== false) out.teamDashboard = await syncTeamDashboard();
  }
  if (enabled.classroom !== false) {
    try {
      out.classroom = await syncClassroom();
    } catch (e) {
      out.classroom = { ok: false, error: e.message };
    }
  }
  return out;
}

module.exports = { syncCareerIo, syncTeamDashboard, ingestConnectorData, syncAll, upsertSystem, addSystemNotification };
