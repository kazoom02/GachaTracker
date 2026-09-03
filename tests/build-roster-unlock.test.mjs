import assert from 'node:assert/strict';
import fs from 'node:fs';

const js = fs.readFileSync(new URL('../public/js/builds.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../public/builds.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/builds.css', import.meta.url), 'utf8');

assert.match(js, /data-roster-quick-set/);
assert.match(js, /setRosterOverride\(profileId, select\.dataset\.rosterQuickSet, select\.value\)/);
assert.match(js, /Owned · C0/);
assert.match(js, /Owned · C6/);
assert.match(html, /manually unlocked as C0–C6/i);
assert.match(css, /\.roster-character__unlock\s*\{/);
console.log('Roster quick-unlock UI tests passed');
