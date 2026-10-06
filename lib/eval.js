'use strict';

// Eval harness (Phase C): the judge runs on the Flash-Lite model string (same key,
// higher free limits). Weekly cron scores up to 5 unrated conversations; low scores
// become correction-style learning events so monthly refinement sees the pattern.

const { nowIso, getDoc, setDoc, addDoc, listDocs } = require('./util');
const { logEvent, bumpStat } = require('./learning');

const JUDGE_RUBRIC =
  'You rate AI assistant answers. Output STRICT JSON only: {"score":1-5,"reason":"..."}.\n' +
  '5 = correct, used real data/tools, actionable. 3 = okay but vague or missed an obvious tool/data. ' +
  '1 = invented dates/statuses, ignored the question, or gave harmful advice.';

async function judgeRecentConversations(limit) {
  const { getSettings } = require('./config');
  const { getJudgeModel } = require('./gemini');
  const s = await getSettings();
  if (!s.geminiKey) return { ok: true, note: 'no gemini key' };
  const all = await listDocs('conversations');
  const candidates = all
    .filter((c) => !c.rated && c.user && c.assistant)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, Math.min(5, limit || 5));
  if (!candidates.length) return { ok: true, judged: 0 };
  const model = await getJudgeModel();
  let judged = 0;
  let flagged = 0;
  for (const c of candidates) {
    try {
      const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(s.geminiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: JUDGE_RUBRIC }] },
          contents: [{ role: 'user', parts: [{ text: 'USER ASKED:\n' + String(c.user).slice(0, 1500) + '\n\nASSISTANT ANSWERED:\n' + String(c.assistant).slice(0, 2500) }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
        }),
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      const text = data.candidates && data.candidates[0] ? data.candidates[0].content.parts.map((p) => p.text || '').join('') : '';
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end === -1) continue;
      const { score, reason } = JSON.parse(text.slice(start, end + 1));
      await setDoc('conversations/' + c.id, { rated: true, judgeScore: score, judgeModel: model, judgedAt: nowIso() });
      judged++;
      if (score <= 2) {
        flagged++;
        await logEvent({ type: 'correction', entity: 'chat', entityId: c.id, text: 'Poor answer (judge ' + score + '/5) for: ' + String(c.user).slice(0, 300), rating: 2, correction: String(reason || '').slice(0, 500) });
      }
      await bumpStat('geminiCalls');
    } catch (e) { /* skip failures, try next */ }
  }
  return { ok: true, judged, flagged, model };
}

module.exports = { judgeRecentConversations, JUDGE_RUBRIC };
