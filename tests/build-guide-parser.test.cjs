const assert = require('assert');
const { htmlToLines, parseGenshinGG, parseTeamGuide, inferArchetype } = require('../server/build-guide-core.cjs');

const gg = `
<html><body>
<h1>Genshin Impact Albedo Build</h1><div>Geo</div><div>Sword</div><div>Sub DPS</div>
<h2>Albedo Best Weapons</h2>
<div>1</div><div>Peak Patrol Song</div><div>2</div><div>Uraku Misugiri</div><div>3</div><div>Flute of Ezpitzal R5</div>
<h2>Albedo Best Artifacts</h2>
<div>1</div><div>Husk of Opulent Dreams</div><div>4</div>
<div>2</div><div>Golden Troupe</div><div>4</div>
<div>3</div><div>Archaic Petra</div><div>2</div><div>Husk of Opulent Dreams</div><div>2</div>
<h2>Albedo Best Stats</h2>
<div>Sands: DEF%</div><div>Goblet: Geo DMG</div><div>Circlet: CRIT Rate / CRIT DMG</div><div>Substats: CRIT Rate / CRIT DMG &gt; DEF% &gt; Energy Recharge</div>
<h2>Albedo Showcase</h2>
</body></html>`;

const parsed = parseGenshinGG(gg, 'Albedo');
assert.equal(parsed.element, 'Geo');
assert.equal(parsed.weaponType, 'Sword');
assert.equal(parsed.role, 'Sub DPS');
assert.equal(parsed.weapons[0].name, 'Peak Patrol Song');
assert.equal(parsed.weapons[2].refinement, 'R5');
assert.equal(parsed.artifacts[0].name, 'Husk of Opulent Dreams');
assert.equal(parsed.artifacts[0].pieces, 4);
assert.equal(parsed.artifacts[2].name, 'Archaic Petra + Husk of Opulent Dreams');
assert.equal(parsed.artifacts[2].pieces, '2+2');
assert(parsed.stats.main.includes('Sands: DEF%'));
assert(parsed.stats.sub.includes('Energy Recharge'));

const teamsHtml = `
<html><body>
<h1>Genshin Impact Arlecchino Best Team Guide</h1>
<p>Last updated September 3, 2026. Looking for the best teams.</p>
<p>Best teams for Arlecchino, primarily an on-field Pyro DPS. Top archetypes include Melt and Vaporize.</p>
<h2>#1 Arlecchino Melt Team #1</h2><p>Tier SS</p>
<p>A high-damage Melt team that combines Arlecchino with strong supports for front-loaded damage.</p>
<p>Arlecchino, Citlali, Xilonen, Bennett — Arlecchino Melt Team #1. Arlecchino (Main DPS), Citlali (Support), Xilonen (Support), Bennett (Support).</p>
<h3>Core Idea</h3><p>Stuff.</p>
<h2>#2 Arlecchino Vaporize Team #1</h2><p>Tier S</p>
<p>A reliable Vaporize setup for sustained damage and buffs across the full rotation.</p>
<p>Arlecchino, Yelan, Kaedehara Kazuha, Bennett — Arlecchino Vaporize Team #1. Arlecchino (Main DPS), Yelan (Sub DPS), Kaedehara Kazuha (Support), Bennett (Support).</p>
</body></html>`;
const guide = parseTeamGuide(teamsHtml, 'Arlecchino');
assert.equal(guide.updated, 'September 3, 2026');
assert.equal(guide.teams.length, 2);
assert.equal(guide.teams[0].tier, 'SS');
assert.equal(guide.teams[0].reaction, 'Melt');
assert.deepEqual(guide.teams[0].members.map(m => m.name), ['Arlecchino','Citlali','Xilonen','Bennett']);
assert.equal(guide.teams[1].reaction, 'Vaporize');
assert.equal(guide.teams[1].members[1].role, 'Sub DPS');
assert.equal(inferArchetype('Arlecchino Pure Pyro Team #2','Arlecchino'), 'Pure Pyro');
assert(htmlToLines('<p>A &amp; B</p>').includes('A & B'));
console.log('build guide parser tests passed');

(async () => {
  const { getBuildGuide } = require('../server/build-guide-core.cjs');
  const mockFetch = async (url) => {
    if (String(url).includes('genshin.gg')) return { ok:true, text:async()=>gg };
    return { ok:false, status:404, statusText:'Not Found', text:async()=>'' };
  };
  const traveler = await getBuildGuide({ id:'traveler-dendro', name:'Traveler (Dendro)', guideName:'Traveler (Dendro)', ggSlug:'traveler%28dendro%29', teamSlug:'traveler_dendro', rarity:'5' }, mockFetch);
  assert(traveler.teams.length >= 3);
  assert.equal(traveler.teams[0].reaction, 'Hyperbloom');
  assert(traveler.sources.some(source => /KQM/.test(source.label)));
  console.log('traveler fallback tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
