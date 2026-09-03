const assert = require('node:assert/strict');
const { buildSimpactQuery, parseConfigAssumptions, getSimulationTeams } = require('../server/sim-team-core.cjs');

const query = buildSimpactQuery(['lohen']);
assert.equal(query.limit, 150);
assert.equal(query.sort['summary.mean_dps_per_target'], -1);
assert(query.query.$and.some((clause) => clause['summary.char_names'] === 'lohen'));
const querySkip = buildSimpactQuery(['lohen'], 300);
assert.equal(querySkip.skip, 300);

const config = `
options iteration=1000 duration=100 swap_delay=4;
fn rand_delay(mean, stddev, min, max) { let del = randnorm() * stddev + mean; delay(del); }
energy every interval=480,720 amount=1;
target lvl=100 resist=0.1 radius=2 pos=0,2.4 hp=999999999;
`;
const assumptions = parseConfigAssumptions(config, { sim_duration: { mean: 95 } }, [1,6]);
assert.equal(assumptions.quality, 'KQMS-like');
assert.equal(assumptions.qualityRank, 3);

const dbPayload = {
  data: [
    {
      _id: 'f2p',
      config,
      description: 'Lohen Xiangling Bennett Sucrose budget melt',
      accepted_tags: [1,6],
      is_db_valid: true,
      share_key: 'F2P123',
      create_date: 100,
      last_update: 200,
      summary: {
        target_count: 1,
        mean_dps_per_target: 65432.1,
        sim_duration: { mean: 96 },
        team: [
          { name:'lohen', cons:0, level:90, max_level:90, weapon:{name:'whitetassel',refine:5,level:90}, talents:{attack:9,skill:9,burst:9}, sets:{finaleofthedeepgalleries:4} },
          { name:'xiangling', cons:4, level:90, max_level:90, weapon:{name:'thecatch',refine:5,level:90}, talents:{attack:6,skill:9,burst:12}, sets:{emblemofseveredfate:4} },
          { name:'bennett', cons:1, level:90, max_level:90, weapon:{name:'sapwoodblade',refine:1,level:90}, talents:{attack:6,skill:9,burst:9}, sets:{noblesseoblige:4} },
          { name:'sucrose', cons:6, level:90, max_level:90, weapon:{name:'thrillingtalesofdragonslayers',refine:5,level:90}, talents:{attack:6,skill:9,burst:9}, sets:{viridescentvenerer:4} },
        ],
      },
    },
    {
      _id: 'whale',
      config,
      description: 'Lohen premium',
      accepted_tags: [1,6],
      is_db_valid: true,
      share_key: 'WHALE1',
      create_date: 101,
      last_update: 201,
      summary: {
        target_count: 1,
        mean_dps_per_target: 160000,
        sim_duration: { mean: 95 },
        team: [
          { name:'lohen', cons:2, level:90, max_level:90, weapon:{name:'disasterandremorse',refine:1,level:90}, talents:{attack:10,skill:10,burst:10}, sets:{finaleofthedeepgalleries:4} },
          { name:'durin', cons:2, level:90, max_level:90, weapon:{name:'mistsplitterreforged',refine:1,level:90}, talents:{attack:9,skill:10,burst:10}, sets:{noblesseoblige:4} },
          { name:'nicole', cons:2, level:90, max_level:90, weapon:{name:'athousandfloatingdreams',refine:1,level:90}, talents:{attack:9,skill:10,burst:10}, sets:{celestialgift:4} },
          { name:'citlali', cons:0, level:90, max_level:90, weapon:{name:'starcallerswatch',refine:1,level:90}, talents:{attack:9,skill:10,burst:10}, sets:{scrolloftheheroofcindercity:4} },
        ],
      },
    }
  ],
};
const namesPayload = {
  English: {
    character_names: { lohen:'Lohen', xiangling:'Xiangling', bennett:'Bennett', sucrose:'Sucrose', durin:'Durin', nicole:'Nicole', citlali:'Citlali' },
    weapon_names: {
      whitetassel:'White Tassel', thecatch:'The Catch', sapwoodblade:'Sapwood Blade',
      thrillingtalesofdragonslayers:'Thrilling Tales of Dragon Slayers',
      disasterandremorse:'Disaster and Remorse', mistsplitterreforged:'Mistsplitter Reforged',
      athousandfloatingdreams:'A Thousand Floating Dreams', starcallerswatch:"Starcaller's Watch",
    },
    artifact_names: {
      finaleofthedeepgalleries:'Finale of the Deep Galleries', emblemofseveredfate:'Emblem of Severed Fate',
      noblesseoblige:'Noblesse Oblige', viridescentvenerer:'Viridescent Venerer', celestialgift:'Celestial Gift',
      scrolloftheheroofcindercity:'Scroll of the Hero of Cinder City',
    },
  },
};
const weaponPayload = {
  data: {
    whitetassel:{rarity:3}, thecatch:{rarity:4}, sapwoodblade:{rarity:4}, thrillingtalesofdragonslayers:{rarity:3},
    disasterandremorse:{rarity:5}, mistsplitterreforged:{rarity:5}, athousandfloatingdreams:{rarity:5}, starcallerswatch:{rarity:5},
  },
};

async function mockFetch(url) {
  const str = String(url);
  if (str.includes('simpact.app/api/db')) return { ok:true, json:async()=>dbPayload };
  if (str.includes('names.dm.json')) return { ok:true, json:async()=>namesPayload };
  if (str.includes('weapon.dm.json')) return { ok:true, json:async()=>weaponPayload };
  return { ok:false, status:404, statusText:'Not Found', json:async()=>({}) };
}

(async () => {
  const result = await getSimulationTeams({ id:'lohen', name:'Lohen', rarity:'5', gcsimKeys:'lohen' }, mockFetch);
  assert.equal(result.supported, true);
  assert.equal(result.strict.length, 2);
  assert.equal(result.f2p.length, 1);
  assert.equal(result.budget.length, 1);
  assert.equal(result.fourStarSupports.length, 1);
  assert.equal(result.lowConstFourStarSupports.length, 0);
  assert.equal(result.midConstFourStarSupports.length, 0);
  assert.equal(result.accountCandidates.length, 2);
  assert.equal(result.coverage.pagesRequested, 3);
  assert.equal(result.coverage.pagesLoaded, 3);
  assert.equal(result.f2p[0].dps, 65432.1);
  assert.equal(result.f2p[0].team[1].constellation, 4);
  assert.equal(result.f2p[0].team[2].constellation, 1);
  assert.equal(result.f2p[0].team[3].constellation, 6);
  assert.equal(result.f2p[0].team[3].weapon, 'Thrilling Tales of Dragon Slayers');
  assert.equal(result.teams[0].dps, 160000);
  assert.equal(result.teams[0].investment.f2pGear, false);
  console.log('Numerical gcsim source tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
