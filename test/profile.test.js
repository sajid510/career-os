'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { PROFILE } = require('../lib/profile');

test('profile reflects post-BSc status: no pre-BSc IELTS, current roles and submissions', () => {
  const strings = [];
  JSON.stringify(PROFILE, (k, v) => (typeof v === 'string' ? (strings.push(v), v) : v));
  assert.ok(!strings.some((s) => /ielts/i.test(s) && /2026/.test(s)), 'no 2026 IELTS commitment remains');
  assert.ok(PROFILE.leadership.some((l) => l.includes('Webmaster') && l.includes('WIE')), 'Webmaster @ WIE present');
  assert.ok(!PROFILE.leadership.some((l) => l.includes('EEE Project Club')), 'EEE Project Club role removed');
  assert.ok(PROFILE.achievements.some((a) => a.includes('Top 38') && a.includes('BEAR Summit 2026')), 'BEAR Summit achievement present');
  assert.ok(PROFILE.achievements.some((a) => a.includes('Prime Minister')), 'PM presentation recorded');
  const venues = (PROFILE.currentResearch.submissions || []).map((s) => s.venue);
  assert.ok(venues.includes('ICECE 2026') && venues.includes('ICCIT 2026'), 'both paper submissions tracked');
  assert.ok(PROFILE.currentResearch.status.includes('results pending'), 'pending status visible to agent');
});
