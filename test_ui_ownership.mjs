import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const website = await readFile(new URL('./public/website.mjs', import.meta.url), 'utf8');
const fa = await readFile(new URL('./public/fa-filters.mjs', import.meta.url), 'utf8');
const ficWeekly = await readFile(new URL('./public/fic-weekly.mjs', import.meta.url), 'utf8');

test('Free Agent Board has one renderer owner', () => {
  assert.equal(/function\s+freeAgents\s*\(/.test(website), false, 'legacy website.mjs freeAgents renderer must stay removed');
  assert.equal(website.includes("replaceRows('fa-rows'"), false, 'website.mjs must not write Free Agent rows');
  assert.equal(website.includes("'fa-rows'"), false, 'website.mjs must not clear or otherwise own Free Agent rows');
  assert.equal(fa.includes("document.getElementById('fa-rows')"), true, 'fa-filters.mjs must own the Free Agent rows');
});

test('Free Agent reload is scoped to the Free Agent page', () => {
  assert.equal(fa.includes("document.querySelector('#freeagents .reloadbtn')"), true);
  assert.equal(fa.includes("document.querySelectorAll('.reloadbtn').forEach(btn => btn.addEventListener('click', load))"), false);
});

test('Free Agent enriched columns stay defined by the FA module', () => {
  for (const heading of ['Signal','14D Pts','14D PPG','vs Rats','Trend','Next Wk','Wk +2','FIC']) {
    assert.ok(fa.includes(`<th>${heading}</th>`), `missing enriched column: ${heading}`);
  }
});


test('Player Lab has one renderer owner', () => {
  assert.equal(/function\s+playerLab\s*\(/.test(website), false, 'legacy website.mjs Player Lab renderer must stay removed');
  assert.equal(website.includes("replaceRows('lab-rows'"), false, 'website.mjs must not write Player Lab rows');
  assert.equal(website.includes("'lab-rows'"), false, 'website.mjs must not clear or otherwise own Player Lab rows');
  assert.equal(fa.includes("lab-rows"), false, 'Free Agent module must not own Player Lab rows');
});

test('Core reload skips dedicated Free Agent and Player Lab pages', () => {
  assert.ok(website.includes("!btn.closest('#freeagents') && !btn.closest('#lab')"));
});


test('FIC consumers require Fantrax identity before using name-keyed matchup data', () => {
  assert.ok(fa.includes("fic_matchups.fantrax_ids_by_name?.[player.name]"));
  assert.ok(website.includes("ficMatchups?.fantrax_ids_by_name?.[player.Player]"));
  assert.ok(website.includes("playerCell.dataset.playerId = record['Player ID']"));
  assert.ok(ficWeekly.includes("source.fantrax_ids_by_name?.[name] !== playerId"));
});
