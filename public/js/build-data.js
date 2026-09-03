// Versioned, source-backed character build snapshots.
// Numerical rankings should only compare values calculated under compatible assumptions.

export const BUILD_CHARACTERS = [
  {
    id: 'odette',
    game: 'genshin',
    name: 'Odette',
    rarity: 5,
    element: 'Cryo',
    weaponType: 'Sword',
    role: 'Off-field DPS / Stellar Glimmer support',
    patch: '7.0',
    updated: '2026-09-03',
    summary: 'Enables and buffs Stellar-Conduct and Stellar-Swirl while contributing strong off-field Stellar damage.',
    quick: {
      bestTeam: 'Sandrone · Yae Miko C1 · Odette · Qiqi',
      bestTeamDps: 189617,
      bestWeapon: 'Whitelake Frostfeather R1',
      bestArtifact: '4pc Heart of the Furnace',
    },
    stats: {
      main: ['ATK% Sands', 'ATK% Goblet', 'CRIT Rate Circlet'],
      alternativeCirclet: 'CRIT DMG can work if CRIT Rate is already balanced, but the cited C0/R5 Finale sheet ranks CRIT Rate higher.',
      sub: ['CRIT Rate', 'CRIT DMG', 'ATK%', 'Elemental Mastery', 'flat ATK'],
      notes: [
        'Aim near 3,000 ATK to cap the cited A4 scaling target.',
        'Energy Recharge is low priority unless you intentionally Burst every rotation.',
      ],
    },
    teams: [
      {
        rank: 1,
        name: 'Sandrone Conduct',
        reaction: 'Stellar-Conduct',
        dps: 189617,
        relative: 100,
        cost: 3,
        note: 'Highest published early-7.0 Conduct ceiling in this same-source F2P-weapon comparison.',
        members: [
          { name: 'Sandrone', role: 'Main DPS' },
          { name: 'Yae Miko', role: 'Electro sub-DPS', minConstellation: 1 },
          { name: 'Odette', role: 'Stellar support' },
          { name: 'Qiqi', role: 'Sustain / support' },
        ],
      },
      {
        rank: 2,
        name: 'Wriothesley Conduct',
        reaction: 'Stellar-Conduct',
        dps: 169059,
        relative: 89.2,
        cost: 4,
        note: 'High ceiling if Wriothesley C1 and Yae C1 are already available.',
        members: [
          { name: 'Wriothesley', role: 'Main DPS', minConstellation: 1 },
          { name: 'Yae Miko', role: 'Electro sub-DPS', minConstellation: 1 },
          { name: 'Odette', role: 'Stellar support' },
          { name: 'Nicole', role: 'Support' },
        ],
      },
      {
        rank: 3,
        name: 'Alyosha C6 Conduct',
        reaction: 'Stellar-Conduct',
        dps: 158706,
        relative: 83.7,
        cost: 2,
        note: 'Strong Sandrone alternative when Yae is unavailable; the published sheet assumes C6 Alyosha.',
        members: [
          { name: 'Sandrone', role: 'Main DPS' },
          { name: 'Alyosha', role: 'Electro support', minConstellation: 6 },
          { name: 'Odette', role: 'Stellar support' },
          { name: 'Qiqi', role: 'Sustain / support' },
        ],
      },
      {
        rank: 4,
        name: 'Wriothesley + Lan Yan',
        reaction: 'Stellar-Conduct',
        dps: 155234,
        relative: 81.9,
        cost: 3,
        note: 'Shielded Wriothesley variant, trading some output for comfort.',
        members: [
          { name: 'Wriothesley', role: 'Main DPS', minConstellation: 1 },
          { name: 'Yae Miko', role: 'Electro sub-DPS', minConstellation: 1 },
          { name: 'Odette', role: 'Stellar support' },
          { name: 'Lan Yan', role: 'Shield', minConstellation: 2 },
        ],
      },
      {
        rank: 5,
        name: 'Mizuki Swirl',
        reaction: 'Stellar-Swirl',
        dps: 138963,
        relative: 73.3,
        cost: 1,
        note: 'Lowest-cost quantified option in the cited sheet, using a short 15-second rotation.',
        members: [
          { name: 'Yumemizuki Mizuki', role: 'Main DPS', minConstellation: 2 },
          { name: 'Sucrose', role: 'Anemo support', minConstellation: 6 },
          { name: 'Odette', role: 'Stellar enabler' },
          { name: 'Qiqi', role: 'Cryo sustain', minConstellation: 1 },
        ],
      },
      {
        rank: 6,
        name: 'Alyosha C2 Conduct',
        reaction: 'Stellar-Conduct',
        dps: 138693,
        relative: 73.1,
        cost: 2,
        note: 'Lower-investment Alyosha version of the Sandrone core.',
        members: [
          { name: 'Sandrone', role: 'Main DPS' },
          { name: 'Alyosha', role: 'Electro support', minConstellation: 2 },
          { name: 'Odette', role: 'Stellar support' },
          { name: 'Qiqi', role: 'Sustain / support' },
        ],
      },
    ],
    variants: [
      {
        reaction: 'Stellar-Conduct',
        members: ['Sandrone', 'Yae Miko', 'Odette', 'Alyosha'],
        note: 'Premium Conduct core supported by KQM. Alyosha becomes notably stronger at C2/C6, but his direct buff/heal targets the on-fielder.',
      },
      {
        reaction: 'Stellar-Conduct',
        members: ['Cyno', 'Yae Miko', 'Odette', 'Alyosha'],
        note: 'KQM lists Cyno as another on-field Stellar-Conduct DPS for the Odette/Yae/Alyosha core.',
      },
      {
        reaction: 'Stellar-Conduct',
        members: ['Cryo Traveler', 'Yae Miko', 'Odette', 'Alyosha'],
        note: 'Traveler-centered Stellar-Conduct option from the current Alyosha theorycraft guide.',
      },
      {
        reaction: 'Stellar-Swirl',
        members: ['Yumemizuki Mizuki', 'Odette', 'Cryo Traveler', 'Sucrose'],
        note: 'KQM states Mizuki’s best Stellar-Swirl setup uses both Odette and Cryo Traveler; Sucrose is a natural Anemo flex.',
      },
      {
        reaction: 'Stellar-Swirl',
        members: ['Sandrone', 'Odette', 'Cryo Traveler', 'Sucrose'],
        note: 'Sandrone can also be played in Stellar-Swirl with Odette and Cryo Traveler enabling the reaction.',
      },
    ],
    weapons: [
      { rank: 1, name: 'Whitelake Frostfeather', refinement: 'R1', relative: 106.6, range: '106.6%', tier: 'Best in slot', note: 'Signature. The cited team sheet places it only ~6.6% above R5 Finale in total team DPS despite a much larger personal gain.' },
      { rank: 2, name: 'Primordial Jade Cutter / Absolution / Azurelight', refinement: 'R1', relative: 104, range: '103–105%', tier: 'Premium alternatives', note: 'Excellent 5★ stat sticks. Exact order depends on CRIT balance and the calculation scenario.' },
      { rank: 3, name: 'Exaiphanes Blade', refinement: 'R1', relative: 102.4, range: '102.4%', tier: 'Free 5★', note: 'Strong free stat stick when Cryo Traveler does not need it.' },
      { rank: 4, name: 'Freedom-Sworn', refinement: 'R1', relative: 103, range: '101–105%', tier: 'Support option', note: 'Team buff value varies substantially with rotation and teammates.' },
      { rank: 5, name: 'Finale of the Deep', refinement: 'R5', relative: 100, range: '100%', tier: 'F2P baseline', note: 'Craftable baseline used by the published team-DPS comparison.' },
      { rank: 6, name: 'Heretic’s Molten Blade', refinement: 'R1', relative: 100.5, range: '~100–101%', tier: 'Battle Pass', note: 'Good stats, though part of the ATK effect is lost after swapping off-field.' },
      { rank: 7, name: 'Emberwell', refinement: 'R5', relative: 99.7, range: '98.6–100.7%', tier: 'Conduct craftable', note: 'Best when its Stellar trigger is reliable, especially in Conduct/double-Electro contexts.' },
      { rank: 8, name: 'Wolf-Fang / Blackcliff / The Black Sword / Harbinger of Dawn', refinement: 'varies', relative: 99.5, range: '~99–100%', tier: 'Budget', note: 'Practical substitutes; Harbinger requires staying above 90% HP.' },
      { rank: 9, name: 'Favonius Sword', refinement: 'varies', relative: 98.5, range: '98.5%', tier: 'Utility', note: 'Lower damage, but its particles can be worthwhile for team Energy needs.' },
    ],
    artifacts: [
      { rank: 1, name: 'Heart of the Furnace', pieces: '4pc', teamDps: 189617, relativeTeam: 100, personalDamage: 695930, relativePersonal: 100, label: 'Best overall', note: 'Default when nobody else holds it. The teamwide Stellar bonus outweighs Odette-only alternatives in the cited sheet.' },
      { rank: 2, name: 'Disenchantment in Deep Shadow', pieces: '4pc', teamDps: 174396, relativeTeam: 92, personalDamage: 753636, relativePersonal: 108, label: 'Best personal Conduct damage', note: 'Raises Odette’s personal damage but lowers total team DPS in the cited comparison. Best when another teammate already carries Furnace.' },
      { rank: 3, name: 'Gladiator + ATK/EM mix', pieces: '2pc + 2pc', teamDps: 167991, relativeTeam: 89, personalDamage: 619123, relativePersonal: 89, label: 'Temporary', note: 'Use while farming a proper 4-piece set.' },
      { rank: 4, name: 'Tenacity of the Millelith', pieces: '4pc', teamDps: null, relativeTeam: null, personalDamage: null, relativePersonal: null, label: 'Situational support', note: 'Can work in ATK-scaling teams if another unit already supplies the Stellar support set.' },
    ],
    assumptions: [
      'The six numbered team DPS values are one August 2026 Version 7.0 snapshot using the cited F2P-weapon assumptions. They are not universal simulator results.',
      'Constellations shown in each lineup are part of that comparison and materially affect the ranking.',
      'Enemy profile, rotation length, artifact quality, weapons, refinements, constellations and execution can change the order.',
      'Recommended teams without a directly comparable calculation are deliberately shown as variants instead of receiving invented DPS numbers.',
      'Ownership is inferred only from wish records saved in the active Convene profile. Missing characters are marked Unknown, because wish history can be incomplete and some characters are obtained outside wishes.',
    ],
    sources: [
      { label: 'BitTopup — Odette Best Teams & Builds', url: 'https://bittopup.com/article/odette-best-teams-and-builds-august-2026', use: 'Comparable team DPS, weapon percentages, artifact and main-stat calculations' },
      { label: 'Genshin Builds — Odette calculations', url: 'https://genshin-impact-helper-team.github.io/genshin-builds/en/odette/', use: 'Independent weapon/build ordering cross-check' },
      { label: 'Icy Veins — Odette team guide', url: 'https://www.icy-veins.com/genshin-impact/odette-team-guide', use: 'Team archetypes and synergy cross-check' },
      { label: 'KQM — Sandrone Quick Guide', url: 'https://keqingmains.com/q/sandrone-quickguide/', use: 'Odette/Sandrone/Alyosha synergy and current 7.0 team context' },
      { label: 'KQM — Alyosha Quick Guide', url: 'https://keqingmains.com/q/alyosha-quickguide/', use: 'Odette/Yae/Alyosha core and constellation context' },
      { label: 'KQM — Mizuki Quick Guide', url: 'https://keqingmains.com/q/mizuki-quickguide/', use: 'Stellar-Swirl pairing and Odette + Cryo Traveler recommendation' },
    ],
  },
];

export function findBuildCharacter(id) {
  return BUILD_CHARACTERS.find((character) => character.id === id) || null;
}

export function getBuildCharacter(id) {
  return findBuildCharacter(id) || BUILD_CHARACTERS[0];
}
