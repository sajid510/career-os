// Scheduler + external connectors, run by GitHub Actions.
// Fetches data from external systems (robowatch, EEE_Academic_OS, news-pulse)
// and calls the Career OS hub cron endpoints.
const HUB = process.env.HUB_URL || 'https://career-os-hub.vercel.app';
const TOKEN = process.env.HUB_TOKEN || '';
const headers = { 'Content-Type': 'application/json', 'x-hub-token': TOKEN };

async function post(path, body) {
  const r = await fetch(HUB + path, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  const txt = await r.text();
  console.log(path, '->', r.status, txt.slice(0, 200));
  return txt;
}

async function getRaw(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'career-os-hub' } });
    if (!r.ok) return null;
    return await r.text();
  } catch (e) {
    return null;
  }
}

async function fetchRobowatch() {
  const memory = await getRaw('https://raw.githubusercontent.com/sajid510/robowatch/main/memory/memory.json');
  const feedback = await getRaw('https://raw.githubusercontent.com/sajid510/robowatch/main/feedback.txt');
  const seen = memory ? JSON.parse(memory).length || Object.keys(JSON.parse(memory)).length : 0;
  const summary = 'memory synced' + (feedback ? ' | feedback.txt present' : '');
  await post('/api/connector/ingest', {
    system: 'robowatch',
    status: 'ok',
    summary: 'Digest memory + feedback synced',
    data: { memory: memory ? memory.slice(0, 4000) : '', feedback: feedback ? feedback.slice(0, 2000) : '', seenCount: seen },
  });
}

async function fetchEEE() {
  const readme = await getRaw('https://raw.githubusercontent.com/sajid510/EEE_Academic_OS/main/README.md');
  const memory = await getRaw('https://raw.githubusercontent.com/sajid510/EEE_Academic_OS/main/memory/tutor_memory.json');
  await post('/api/connector/ingest', {
    system: 'eeeAcademicOS',
    status: 'ok',
    summary: 'Tutor memory + repo synced',
    data: { readme: readme ? readme.slice(0, 3000) : '', tutorMemory: memory ? memory.slice(0, 4000) : '' },
  });
}

async function fetchNewsPulse() {
  try {
    const list = await fetch('https://api.github.com/repos/sajid510/news-pulse/contents/', { headers: { 'User-Agent': 'career-os-hub' } });
    if (!list.ok) { await post('/api/connector/ingest', { system: 'newsPulse', status: 'ok', summary: 'tracked (no public reports yet)', data: {} }); return; }
    const files = await list.json();
    const report = files.find((f) => /report|digest/i.test(f.name));
    const content = report ? await (await fetch(report.download_url, { headers: { 'User-Agent': 'career-os-hub' } })).text() : '';
    await post('/api/connector/ingest', {
      system: 'newsPulse',
      status: 'ok',
      summary: report ? 'latest report: ' + report.name : 'tracked',
      data: { report: content.slice(0, 4000) },
    });
  } catch (e) {
    await post('/api/connector/ingest', { system: 'newsPulse', status: 'ok', summary: 'tracked', data: {} });
  }
}

async function main() {
  const schedule = process.env.TRIGGER_SCHEDULE || '';
  await fetchRobowatch().catch((e) => console.error('robowatch err', e.message));
  await fetchEEE().catch((e) => console.error('eee err', e.message));
  await fetchNewsPulse().catch((e) => console.error('news err', e.message));
  await post('/api/cron/15min').catch((e) => console.error('cron15 err', e.message));
  if (schedule === '0 1 * * *') await post('/api/cron/daily').catch((e) => console.error('daily err', e.message));
  if (schedule === '0 3 * * 0') await post('/api/cron/weekly').catch((e) => console.error('weekly err', e.message));
  if (schedule === '0 4 1 * *') await post('/api/cron/monthly').catch((e) => console.error('monthly err', e.message));
}

main();
