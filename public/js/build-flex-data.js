// Cross-source replacement evidence.
//
// These entries are NOT assigned invented DPS. They are used when another current
// theorycraft source explicitly supports a one-slot replacement or an exact alternate
// lineup that is absent from the primary team feed.

const FLEX_TEAMS = {
  lohen: [
    // Escoffier slot in Lohen / Furina / Mona Freeze.
    {
      name: 'Freeze — Xilonen flex',
      reaction: 'Freeze',
      tier: 'A',
      isFlexTeam: true,
      flexConfidence: 'high',
      substitutionEvidence: 'Exact Icy Veins Freeze lineup',
      flexNote: 'Icy Veins explicitly lists Lohen / Mona / Furina / Xilonen. Xilonen supplies RES shred and healing, but the team loses Escoffier’s Cryo/Hydro RES shred and Cryo Resonance.',
      sources: ['Icy Veins — Lohen Team Guide'],
      members: [
        { name:'Lohen', role:'Main DPS' },
        { name:'Furina', role:'Hydro sub-DPS / buffer' },
        { name:'Mona', role:'Hexerei support / buffer' },
        { name:'Xilonen', role:'Healer / RES shred',
          constellationBonuses:[
            { constellation:2, score:22, label:'C2 major Lohen upgrade', note:'C2 gives Cryo teammates +60% CRIT DMG while her Source Samples are active.' },
          ] },
      ],
    },
    {
      name: 'Freeze — Mika flex',
      reaction: 'Freeze',
      tier: 'B+',
      isFlexTeam: true,
      flexConfidence: 'high',
      substitutionEvidence: 'GameWith explicit Escoffier replacement',
      flexNote: 'GameWith explicitly lists Mika as an Escoffier replacement. He preserves Cryo Resonance and provides healing for Furina, but loses Escoffier’s large RES shred and personal damage.',
      sources: ['GameWith — Best Teams for Lohen'],
      members: [
        { name:'Lohen', role:'Main DPS' },
        { name:'Furina', role:'Hydro sub-DPS / buffer' },
        { name:'Mona', role:'Hexerei support / buffer' },
        { name:'Mika', role:'Cryo healer / support',
          constellationBonuses:[
            { constellation:1, score:5, label:'C1 healing QoL', note:'C1 shortens his healing interval; useful with Furina, but Mika C6 is a Physical-only payoff and receives no extra Lohen Freeze score.' },
          ] },
      ],
    },
    {
      name: 'Freeze — Citlali flex',
      reaction: 'Freeze',
      tier: 'B+',
      isFlexTeam: true,
      flexConfidence: 'high',
      substitutionEvidence: 'GameWith replacement + HoYoLAB alternate Freeze',
      flexNote: 'Citlali is explicitly listed as an Escoffier alternative and appears in alternate Lohen Freeze guidance. She preserves Cryo Resonance and defensive utility, but does not replace Escoffier’s teamwide healing for Furina.',
      sources: ['GameWith — Best Teams for Lohen', 'HoYoLAB — Lohen Team Compositions'],
      members: [
        { name:'Lohen', role:'Main DPS' },
        { name:'Furina', role:'Hydro sub-DPS / buffer' },
        { name:'Mona', role:'Hexerei support / buffer' },
        { name:'Citlali', role:'Cryo support / shield',
          constellationBonuses:[
            { constellation:1, score:10, label:'C1 stronger generic buff', note:'C1 adds a sizable damage bonus to the active character’s attacks.' },
            { constellation:2, score:4, label:'C2 extra team value', note:'C2 further improves Citlali’s support ceiling, though its EM/Pyro-Hydro shred is less valuable to Cryo Lohen than in Melt/Vape.' },
          ] },
      ],
    },
    {
      name: 'Freeze — Charlotte flex',
      reaction: 'Freeze',
      tier: 'B',
      isFlexTeam: true,
      flexConfidence: 'medium',
      substitutionEvidence: 'KQM notable Cryo teammate + Furina healer requirement',
      flexNote: 'KQM lists Charlotte among Lohen’s notable Freeze Cryo teammates and separately notes that Furina requires a healer. Charlotte preserves Cryo Resonance and supplies party healing, making her a practical budget Escoffier substitute, at a large damage/shred loss.',
      sources: ['KQM — Lohen Quick Guide'],
      members: [
        { name:'Lohen', role:'Main DPS' },
        { name:'Furina', role:'Hydro sub-DPS / buffer' },
        { name:'Mona', role:'Hexerei support / buffer' },
        { name:'Charlotte', role:'Cryo healer',
          constellationBonuses:[
            { constellation:1, score:16, label:'C1 excellent with Furina', note:'C1 adds sustained party healing after Burst, directly helping Furina Fanfare and survivability.' },
            { constellation:4, score:8, label:'C4 lowers ER burden', note:'C4 refunds up to 10 Energy and KQM estimates roughly 25% lower ER requirements.' },
          ] },
      ],
    },
    {
      name: 'Freeze — Shenhe flex',
      reaction: 'Freeze',
      tier: 'B',
      isFlexTeam: true,
      flexConfidence: 'high',
      substitutionEvidence: 'GameWith explicit Escoffier replacement',
      flexNote: 'Shenhe is explicitly listed as an Escoffier alternative and strongly buffs Cryo damage. With Furina in the same team, however, this exact four-character shell lacks the strong healer Escoffier normally provides, so Furina Fanfare/sustain is less comfortable.',
      sources: ['GameWith — Best Teams for Lohen', 'KQM — Lohen Quick Guide'],
      members: [
        { name:'Lohen', role:'Main DPS' },
        { name:'Furina', role:'Hydro sub-DPS / buffer' },
        { name:'Mona', role:'Hexerei support / buffer' },
        { name:'Shenhe', role:'Cryo buffer',
          constellationBonuses:[
            { constellation:1, score:6, label:'C1 rotation / Energy upgrade', note:'C1 adds a Skill charge and improves rotation flexibility and batterying.' },
            { constellation:2, score:14, label:'C2 strong Cryo breakpoint', note:'C2 extends Burst duration and grants active characters in the field +15% Cryo CRIT DMG.' },
          ] },
      ],
    },
    {
      name: 'Freeze — Jean flex',
      reaction: 'Freeze',
      tier: 'B',
      isFlexTeam: true,
      flexConfidence: 'medium',
      substitutionEvidence: 'KQM Freeze Anemo option + Furina healer synergy',
      flexNote: 'KQM lists Jean among Lohen’s viable Freeze Anemo teammates. Jean gives team healing for Furina and 4pc VV Cryo RES shred, but replacing Escoffier costs Cryo Resonance and Escoffier’s stronger dual RES shred/personal damage.',
      sources: ['KQM — Lohen Quick Guide'],
      members: [
        { name:'Lohen', role:'Main DPS' },
        { name:'Furina', role:'Hydro sub-DPS / buffer' },
        { name:'Mona', role:'Hexerei support / buffer' },
        { name:'Jean', role:'Anemo healer / VV support',
          constellationBonuses:[
            { constellation:2, score:5, label:'C2 modest combo QoL', note:'C2 grants 15% ATK SPD after Jean catches a particle; useful but not a major Lohen damage breakpoint.' },
          ] },
      ],
    },

    // Furina slot in the premium Freeze core.
    {
      name: 'Freeze — Yelan flex',
      reaction: 'Freeze',
      tier: 'B+',
      isFlexTeam: true,
      flexConfidence: 'high',
      substitutionEvidence: 'GameWith explicit Furina replacement',
      flexNote: 'Yelan is GameWith’s preferred Furina alternative for off-field Hydro while also providing a ramping DMG% buff.',
      sources: ['GameWith — Best Teams for Lohen'],
      members: [
        { name:'Lohen', role:'Main DPS' },
        { name:'Yelan', role:'Hydro sub-DPS / buffer',
          constellationBonuses:[
            { constellation:1, score:5, label:'C1 easier Energy', note:'C1 adds a Skill charge and improves Burst consistency.' },
            { constellation:2, score:11, label:'C2 stronger Hydro / damage', note:'C2 adds an extra Burst arrow, increasing Hydro application and personal damage.' },
          ] },
        { name:'Mona', role:'Hexerei support / buffer' },
        { name:'Escoffier', role:'Cryo sub-DPS / healer' },
      ],
    },
    {
      name: 'Freeze — Xingqiu flex',
      reaction: 'Freeze',
      tier: 'B',
      isFlexTeam: true,
      flexConfidence: 'high',
      substitutionEvidence: 'GameWith explicit Furina replacement',
      flexNote: 'Xingqiu is an accessible Furina replacement for off-field Hydro application. He gives survivability but substantially less teamwide damage amplification.',
      sources: ['GameWith — Best Teams for Lohen'],
      members: [
        { name:'Lohen', role:'Main DPS' },
        { name:'Xingqiu', role:'Hydro sub-DPS',
          constellationBonuses:[
            { constellation:2, score:12, label:'C2 important breakpoint', note:'C2 extends Burst duration and shreds 15% Hydro RES.' },
            { constellation:6, score:22, label:'C6 major breakpoint', note:'C6 substantially improves Burst damage, Hydro application and Energy economy.' },
          ] },
        { name:'Mona', role:'Hexerei support / buffer' },
        { name:'Escoffier', role:'Cryo sub-DPS / healer' },
      ],
    },

    // Mona slot.
    {
      name: 'Freeze — Skirk quickswap flex',
      reaction: 'Freeze',
      tier: 'A',
      isFlexTeam: true,
      flexConfidence: 'high',
      substitutionEvidence: 'Exact KQM Freeze variant',
      flexNote: 'KQM explicitly states Skirk can replace Mona in the Lohen / Escoffier / Furina Freeze core. KQM notes C0 Mona and C0 Skirk perform roughly similarly, while C4+ Mona pulls ahead considerably.',
      sources: ['KQM — Lohen Quick Guide'],
      members: [
        { name:'Lohen', role:'Main DPS' },
        { name:'Furina', role:'Hydro sub-DPS / buffer' },
        { name:'Skirk', role:'Cryo quickswap DPS' },
        { name:'Escoffier', role:'Cryo sub-DPS / healer' },
      ],
    },
  ],
};

export function crossSourceFlexTeams(characterId) {
  return (FLEX_TEAMS[String(characterId || '').toLowerCase()] || []).map((team, index) => ({
    ...team,
    rank: 700 + index,
    dps: null,
    relative: null,
  }));
}
