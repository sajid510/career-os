'use strict';

// Issue playbooks: vetted responses to recurring scholarship-process problems.
// Pulse consults these before improvising. Lazy-seeded on first read.
const { nowIso, addDoc, listDocs } = require('./util');

const DEFAULT_PLAYBOOKS = [
  {
    title: 'MOI certificate rejected', triggers: 'moi rejected english proof medium instruction',
    body: '1) Ask the requester IN WRITING which exact proof they accept (IELTS/TOEFL/MOI+stamp). 2) Get a fresh MOI on university letterhead with registrar seal + contact details. 3) Parallel-path: book the cheapest accepted test date immediately while appealing — do not wait for the appeal outcome. 4) Log the exact wording of the rejection for the next application.',
  },
  {
    title: 'CGPA below cutoff', triggers: 'gpa cutoff too low cgpa shortfall eligibility',
    body: '1) Confirm whether the cutoff is a hard gate (GKS 2.64: yes, binary) or holistic (MEXT: no fixed bar). 2) Hard gate + shortfall = do NOT apply this cycle; redirect that effort to retakes (each cleared F both adds points and credits). 3) Holistic shortfall = compensate explicitly: accepted papers, professor endorsement, research plan quality. Never inflate the number.',
  },
  {
    title: 'Professor ghosting (3+ weeks)', triggers: 'professor no reply ghosting follow-up silence',
    body: '1) One polite follow-up only: forward the original + 3 lines (new result since first email + one specific question about their recent paper). 2) After a second silence, stop — reallocate to the next name on the list. 3) Never mass-email; never email two professors in the same lab simultaneously.',
  },
  {
    title: 'Missed an internal deadline', triggers: 'missed deadline late internal nomination closed',
    body: '1) Within 48h: email asking for late acceptance with a one-line reason + proof of readiness (all documents attached). 2) Simultaneously shift that effort to the next open window (list the backup: e.g. missed Eiffel-internal -> CSC window). 3) Record what caused the miss so the reminder lead time gets fixed, not just the task.',
  },
  {
    title: 'Document attestation delays', triggers: 'attestation transcript police clearance bank statement slow',
    body: '1) Start attestation chains 6+ weeks before the earliest deadline (registrar -> ministry -> embassy legs each queue). 2) Keep scanned + 10 sealed copies the day anything is issued. 3) Track each document as its own task with the ISSUE date as the deadline, not the scholarship date.',
  },
  {
    title: 'Portal / submission errors', triggers: 'portal error upload failed submission rejected technical',
    body: '1) Screenshot everything with timestamps. 2) Try a second browser + PDF/A-1a exports under size limits (compress scans to <2MB). 3) Email the helpdesk the same day with screenshots; never wait until deadline day. 4) Submit at T-7 days minimum — portals fail most in the final 48h.',
  },
];

async function ensurePlaybooks() {
  const items = await listDocs('playbooks');
  if (items.length) return items;
  for (const p of DEFAULT_PLAYBOOKS) {
    await addDoc('playbooks', Object.assign({}, p, { createdAt: nowIso() }));
  }
  return listDocs('playbooks');
}

function matchPlaybook(items, query) {
  const words = String(query || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
  let best = null;
  let bestScore = 0;
  for (const p of items) {
    const hay = ((p.title || '') + ' ' + (p.triggers || '')).toLowerCase();
    const score = words.filter((w) => hay.includes(w)).length;
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return bestScore > 0 ? best : null;
}

module.exports = { ensurePlaybooks, matchPlaybook, DEFAULT_PLAYBOOKS };
