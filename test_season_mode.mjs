import test from 'node:test';
import assert from 'node:assert/strict';
import {seasonMode} from './public/season-mode.mjs';

const snapshot = games => ({weekly_schedule:{games_seen:games}});

test('October with no full regular-season week is offseason', () => {
  const mode = seasonMode(snapshot(8), new Date('2026-10-05T18:00:00-07:00'));
  assert.equal(mode.offseason, true);
  assert.equal(mode.label, 'OFFSEASON MODE');
});

test('September is in-season', () => {
  assert.equal(seasonMode(snapshot(0), new Date('2026-09-20T12:00:00-07:00')).inSeason, true);
});

test('verified full schedule week can keep mode in-season outside normal calendar window', () => {
  assert.equal(seasonMode(snapshot(90), new Date('2026-10-01T12:00:00-07:00')).inSeason, true);
});

test('winter is offseason', () => {
  assert.equal(seasonMode(snapshot(0), new Date('2027-01-15T12:00:00-07:00')).offseason, true);
});
