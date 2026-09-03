import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../public/builds.html', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../public/js/builds.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/builds.css', import.meta.url), 'utf8');

assert.match(html, /id="character-roster-view"/);
assert.match(html, /id="character-grid"/);
assert.match(html, /data-roster-filter="owned"/);
assert.match(html, /data-roster-filter="locked"/);
assert.match(html, /id="character-detail-view" hidden/);
assert.match(js, /const initialCharacterId = new URLSearchParams\(location\.search\)\.get\('character'\)/);
assert.match(js, /if \(initialCharacterId\) \{/);
assert.match(js, /openRoster\('none'\)/);
assert.match(js, /roster-character-card--locked/);
assert.match(js, /characterHistoryStatus\(entry\.name, ownership, 0, overrides\)/);
assert.match(css, /\.roster-character-card--locked/);
assert.match(css, /filter: grayscale\(1\)/);

console.log('Build roster landing tests passed');
