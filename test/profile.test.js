'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { PROFILE } = require('../lib/profile');

test('profile reflects strategy v2: August-2027 IELTS program, current roles and submissions', () => {
  const strings = [];
  JSON.stringify(PROFILE, (k, v) => (typeof v === 'string' ? (strings.push(v), v) : v));
  assert.ok(!strings.some((s) => /ielts.*after BSc/i.test(s)), 'old post-BSc deferral line gone');
  assert.ok(strings.some((s) => /IELTS.*Aug.*2027/i.test(s)), 'August-2027 IELTS program present');
  assert.ok(PROFILE.leadership.some((l) => l.includes('Webmaster') && l.includes('WIE')), 'Webmaster @ WIE present');
  assert.ok(!PROFILE.leadership.some((l) => l.includes('EEE Project Club')), 'EEE Project Club role removed');
  assert.ok(PROFILE.achievements.some((a) => a.includes('Top 38') && a.includes('BEAR Summit 2026')), 'BEAR Summit achievement present');
  assert.ok(PROFILE.achievements.some((a) => a.includes('Prime Minister')), 'PM presentation recorded');
  const venues = (PROFILE.currentResearch.submissions || []).map((s) => s.venue);
  assert.ok(venues.includes('ICECE 2026') && venues.includes('ICCIT 2026'), 'both paper submissions tracked');
  assert.ok(PROFILE.currentResearch.status.includes('results pending'), 'pending status visible to agent');
});
