// Pure helpers for deriving account ownership hints from imported Genshin wish history.
// A missing name is deliberately "unknown", never "not owned": HoYoverse history is
// time-limited and some characters are obtained outside wishes.

function clean(value) {
  return String(value ?? '').trim();
}

function isCharacterPull(pull) {
  return /character/i.test(clean(pull?.itemType));
}

function isWeaponPull(pull) {
  return /weapon/i.test(clean(pull?.itemType));
}

export function analyzeGenshinOwnership(data = {}) {
  const characters = new Map();
  const weapons = new Map();
  let characterPulls = 0;
  let weaponPulls = 0;
  let typedPulls = 0;

  for (const pulls of Object.values(data?.genshin || {})) {
    for (const pull of pulls || []) {
      const name = clean(pull?.name);
      if (!name) continue;
      if (isCharacterPull(pull)) {
        typedPulls++;
        characterPulls++;
        characters.set(name, (characters.get(name) || 0) + 1);
      } else if (isWeaponPull(pull)) {
        typedPulls++;
        weaponPulls++;
        weapons.set(name, (weapons.get(name) || 0) + 1);
      }
    }
  }

  return {
    characters,
    weapons,
    characterPulls,
    weaponPulls,
    typedPulls,
    hasTypedHistory: typedPulls > 0,
  };
}

export function characterHistoryStatus(name, ownership, minimumConstellation = 0) {
  const copies = ownership?.characters?.get(clean(name)) || 0;
  if (!copies) {
    return {
      state: 'unknown',
      copies: 0,
      constellation: null,
      requirementMet: false,
      label: 'Not seen in imported history',
    };
  }

  const constellation = Math.min(6, Math.max(0, copies - 1));
  const requirementMet = constellation >= Number(minimumConstellation || 0);
  return {
    state: requirementMet ? 'verified' : 'short',
    copies,
    constellation,
    requirementMet,
    label: requirementMet
      ? `Seen C${constellation}+`
      : `Seen C${constellation}+ · C${minimumConstellation} required`,
  };
}

export function weaponHistoryStatus(name, ownership) {
  const copies = ownership?.weapons?.get(clean(name)) || 0;
  return {
    state: copies ? 'verified' : 'unknown',
    copies,
    label: copies ? `Seen in history${copies > 1 ? ` ×${copies}` : ''}` : 'Not seen in imported history',
  };
}

export function teamHistoryStatus(team, ownership) {
  const members = (team?.members || []).map((member) => ({
    member,
    status: characterHistoryStatus(member.name, ownership, member.minConstellation || 0),
  }));

  const verified = members.filter((entry) => entry.status.state === 'verified').length;
  const short = members.filter((entry) => entry.status.state === 'short').length;
  const unknown = members.filter((entry) => entry.status.state === 'unknown').length;
  return {
    members,
    verified,
    short,
    unknown,
    fullyVerified: members.length > 0 && verified === members.length,
  };
}
