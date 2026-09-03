import assert from 'node:assert/strict';
import fs from 'node:fs';

const js = fs.readFileSync(new URL('../public/js/builds.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../public/builds.html', import.meta.url), 'utf8');
const account = fs.readFileSync(new URL('../public/js/build-account.js', import.meta.url), 'utf8');

assert.match(js, /budgetTeams/);
assert.match(js, /renderBudgetTeams/);
assert.match(js, /sourceTeamPool/);
assert.match(js, /F2P \/ Budget/);
assert.match(html, /F2P \/ Limited roster teams/);
assert.match(html, /KQM LIMITED ROSTER/);
assert.match(account, /F2P:\s*160/);
console.log('F2P budget team UI tests passed');

// Regression: null DPS must not render or rank as numeric 0 DPS.
assert.match(js, /function hasPublishedDps/);
assert.doesNotMatch(js, /Number\.isFinite\(Number\(team\.dps\)\)/);
assert.match(account, /function hasPublishedDps/);
console.log('null DPS regression checks passed');
