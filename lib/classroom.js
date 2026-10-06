const { getSettings, saveSettings } = require('./config');
const { nowIso, getDoc, setDoc, addDoc, listDocs } = require('./util');

const HUB_BASE = process.env.HUB_BASE_URL || 'https://career-os-hub.vercel.app';
const CALLBACK_PATH = '/api/classroom/oauth_callback';

const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.announcements.readonly',
].join(' ');

function buildAuthUrl(s, state) {
  return 'https://accounts.google.com/o/oauth2/v2/auth' +
    '?client_id=' + encodeURIComponent(s.classroomClientId) +
    '&redirect_uri=' + encodeURIComponent(HUB_BASE + CALLBACK_PATH) +
    '&response_type=code' +
    '&scope=' + encodeURIComponent(SCOPES) +
    '&access_type=offline&prompt=consent' +
    '&state=' + encodeURIComponent(state);
}

async function getAccessToken(s) {
  if (s.classroomAccessToken && s.classroomTokenExpiry && Date.now() < s.classroomTokenExpiry) {
    return s.classroomAccessToken;
  }
  if (!s.classroomRefreshToken) throw new Error('Google Classroom not connected');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: s.classroomClientId,
      client_secret: s.classroomClientSecret,
      refresh_token: s.classroomRefreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error('Classroom token refresh failed: ' + (j.error_description || j.error || r.status));
  await saveSettings({
    classroomAccessToken: j.access_token,
    classroomTokenExpiry: Date.now() + (j.expires_in - 60) * 1000,
  });
  return j.access_token;
}

async function classroomGet(token, path) {
  const r = await fetch('https://classroom.googleapis.com/v1/' + path, { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) {
    const t = await r.text();
    throw new Error('Classroom HTTP ' + r.status + ': ' + t.slice(0, 200));
  }
  return r.json();
}

// Google dueDate/dueTime -> ISO UTC assuming Asia/Dhaka (+6) course timezone.
function isoFromGoogleDue(dueDate, dueTime) {
  if (!dueDate) return null;
  const h = dueTime ? dueTime.hours || 0 : 0;
  const min = dueTime ? dueTime.minutes || 0 : 0;
  return new Date(Date.UTC(dueDate.year, dueDate.month - 1, dueDate.day, h - 6, min, 0, 0)).toISOString();
}

async function syncClassroom() {
  const s = await getSettings();
  if (!s.classroomRefreshToken) return { ok: false, error: 'Google Classroom not connected' };
  const token = await getAccessToken(s);

  const coursesRes = await classroomGet(token, 'courses?courseStates=ACTIVE&pageSize=100');
  const courses = coursesRes.courses || [];

  const existing = await listDocs('deadlines');
  const known = {};
  existing.forEach((d) => { if (d.source === 'classroom' && d.sourceId) known[d.sourceId] = d.id; });

  const sys = (await getDoc('systems/classroom')) || {};
  const seen = new Set(sys.seenAnnouncements || []);

  let workTotal = 0, newDeadlines = 0, newAnnouncements = 0;

  for (const c of courses) {
    const cw = await classroomGet(token, 'courses/' + encodeURIComponent(c.id) + '/courseWork?pageSize=100')
      .catch(() => ({ courseWork: [] }));
    for (const w of cw.courseWork || []) {
      if (w.state !== 'PUBLISHED' || !w.dueDate) continue;
      workTotal++;
      if (known[w.id]) continue;
      const due = isoFromGoogleDue(w.dueDate, w.dueTime);
      if (!due) continue;
      await addDoc('deadlines', {
        title: w.title,
        dueAt: due,
        category: 'classroom',
        notes: 'Google Classroom · ' + c.name,
        critical: false,
        status: 'pending',
        createdAt: nowIso(),
        source: 'classroom',
        sourceId: w.id,
      });
      newDeadlines++;
    }

    const ann = await classroomGet(token, 'courses/' + encodeURIComponent(c.id) + '/announcements?pageSize=10')
      .catch(() => ({ announcements: [] }));
    for (const a of ann.announcements || []) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      await addDoc('notifications', {
        title: c.name + ' announcement',
        body: String(a.text || '(announcement)').slice(0, 300),
        type: 'connector',
        level: 'info',
        read: false,
        createdAt: a.creationTime || nowIso(),
        source: 'classroom',
      });
      newAnnouncements++;
    }
  }

  const summary = courses.length + ' courses · ' + workTotal + ' assignments · +' + newDeadlines + ' deadlines · +' + newAnnouncements + ' announcements';
  await setDoc('systems/classroom', {
    name: 'Google Classroom',
    key: 'classroom',
    status: 'ok',
    summary: summary,
    lastSync: nowIso(),
    courseNames: courses.map((c) => c.name).slice(0, 50),
    seenAnnouncements: Array.from(seen).slice(-600),
    data: { courseCount: courses.length, workTotal },
  }, false);
  return { ok: true, courses: courses.length, workTotal, newDeadlines, newAnnouncements, summary };
}

async function getStatus() {
  const s = await getSettings();
  const sys = await getDoc('systems/classroom');
  return {
    connected: !!s.classroomRefreshToken,
    email: s.classroomEmail || '',
    lastSync: (sys && sys.lastSync) || '',
    summary: (sys && sys.summary) || '',
    courses: (sys && sys.courseNames) || [],
  };
}

module.exports = { buildAuthUrl, getAccessToken, syncClassroom, getStatus, HUB_BASE, CALLBACK_PATH };
