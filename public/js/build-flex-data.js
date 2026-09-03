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
        { name:'Xilonen', role:'Healer / RES shred' },
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
        { name:'Mika', role:'Cryo healer / support' },
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
        { name:'Citlali', role:'Cryo support / shield' },
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
        { name:'Charlotte', role:'Cryo healer' },
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
        { name:'Shenhe', role:'Cryo buffer' },
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
        { name:'Jean', role:'Anemo healer / VV support' },
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
        { name:'Yelan', role:'Hydro sub-DPS / buffer' },
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
        { name:'Xingqiu', role:'Hydro sub-DPS' },
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
