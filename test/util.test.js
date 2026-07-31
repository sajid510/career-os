'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { makeDb, install } = require('./helpers/mock-firebase');

const db = makeDb();
install(db);

const u = require('../api/lib/util');

test('dhakaParts converts a UTC timestamp to Dhaka wall-clock components', () => {
  const p = u.dhakaParts(Date.parse('2026-07-31T19:00:00Z')); // = 2026-08-01 01:00 Dhaka (Sat)
  assert.strictEqual(p.y, 2026);
  assert.strictEqual(p.m, 8);
  assert.strictEqual(p.day, 1);
  assert.strictEqual(p.dow, 6);
  assert.strictEqual(p.h, 1);
  assert.strictEqual(p.min, 0);
});

test('dhakaIso builds the correct UTC instant from Dhaka local components', () => {
  assert.strictEqual(u.dhakaIso(2026, 8, 1, 14, 0), '2026-08-01T08:00:00.000Z');
  assert.strictEqual(u.dhakaIso(2026, 8, 1, 0, 30), '2026-07-31T18:30:00.000Z'); // rolls over midnight
});

test('nextClassOccurrences finds the next Monday class in Dhaka time', () => {
  const now = Date.parse('2026-07-31T19:00:00Z'); // Dhaka Sat Aug 1 01:00
  const mondays = u.nextClassOccurrences(1, '08:00', 4, now);
  assert.deepStrictEqual(mondays, ['2026-08-03T02:00:00.000Z']); // Mon Aug 3 08:00 Dhaka
});

test('nextClassOccurrences returns empty when the day is beyond the horizon', () => {
  const now = Date.parse('2026-07-31T19:00:00Z'); // Dhaka Sat Aug 1
  const thursdays = u.nextClassOccurrences(4, '12:30', 4, now); // Thu is 5 days out
  assert.deepStrictEqual(thursdays, []);
});

test('daysUntil / inDays classify dates relative to today', () => {
  const today = new Date();
  const past = new Date(today.getTime() - 2 * 86400000).toISOString();
  const sameDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  assert.ok(u.daysUntil(past) < 0);
  assert.ok(u.daysUntil(sameDay) === 0);
  assert.strictEqual(u.inDays(sameDay), 'TODAY');
  assert.ok(u.inDays(past).includes('past'));
});

test('toLocalDateStr renders a Dhaka date string', () => {
  assert.strictEqual(u.toLocalDateStr('2026-08-01T08:00:00.000Z'), '2026-08-01');
});
