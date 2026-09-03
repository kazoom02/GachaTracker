import assert from 'node:assert/strict';
import fs from 'node:fs';

const js = fs.readFileSync(new URL('../public/js/builds.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../public/builds.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/builds.css', import.meta.url), 'utf8');

assert.match(js, /accountCandidates/);
assert.match(js, /lowConstFourStarSupports/);
assert.match(js, /midConstFourStarSupports/);
assert.match(js, /4★ constellation assumptions for this DPS/);
assert.match(js, /4★ ≤ C2/);
assert.match(js, /My exact roster/);
assert.match(html, /exact C0–C6 assumptions/);
assert.match(css, /\.simulation-constellations\s*\{/);
console.log('Simulation investment UI tests passed');
