'use strict';

// Embassy-notice watcher: polls a small list of scholarship/announcement
// pages, hashes normalized text, and notifies on change. Lazy-seeds defaults.
const crypto = require('crypto');
const { nowIso, addDoc, listDocs, setDoc, getDoc } = require('./util');

const DEFAULT_WATCHES = [
  { name: 'MEXT Bangladesh notice', url: 'https://www.bd.emb-japan.go.jp/en/education/scholarshipNotice.html' },
  { name: 'CampusFrance Eiffel 2027 call', url: 'https://www.campusfrance.org/en/actu/call-for-france-excellence-eiffel-applications-2027' },
  { name: 'GKS notices (Study in Korea)', url: 'https://www.studyinkorea.go.kr/ko/notice/scholarshipsList.do?boardSort=3' },
  { name: 'JLPT Dhaka (JUAAB)', url: 'https://juaabjlpt-bd.org' },
];

function hashText(s) {
  return crypto.createHash('sha256').update(String(s || '').replace(/\s+/g, ' ').trim().slice(0, 20000)).digest('hex');
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'CareerOS-Watcher/1.0' } });
    if (!r.ok) return { error: 'HTTP ' + r.status };
    const text = await r.text();
    return { text: text.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ') };
  } catch (e) {
    return { error: e.message };
  } finally {
    clearTimeout(timer);
  }
}

async function ensureWatches() {
  const items = await listDocs('watches');
  if (items.length) return items;
  for (const w of DEFAULT_WATCHES) {
    await addDoc('watches', Object.assign({}, w, { hash: '', lastCheck: '', lastChange: '', createdAt: nowIso() }));
  }
  return listDocs('watches');
}

async function checkWatches() {
  const items = await ensureWatches();
  const out = [];
  for (const w of items) {
    const got = await fetchText(w.url);
    const row = { id: w.id, name: w.name, changed: false };
    if (got.error) {
      row.error = got.error;
    } else {
      const h = hashText(got.text);
      await setDoc('watches/' + w.id, { lastCheck: nowIso() });
      if (w.hash && w.hash !== h) {
        row.changed = true;
        await setDoc('watches/' + w.id, { hash: h, lastChange: nowIso() });
        await addDoc('notifications', {
          title: 'Page changed: ' + w.name, body: 'The watched page changed since last check. Open it to review deadlines.', type: 'connector',
          level: 'warn', read: false, createdAt: nowIso(), source: 'watcher',
        });
      } else if (!w.hash) {
        await setDoc('watches/' + w.id, { hash: h });
        row.baselined = true;
      }
    }
    out.push(row);
  }
  return out;
}

module.exports = { checkWatches, ensureWatches, hashText, DEFAULT_WATCHES };
