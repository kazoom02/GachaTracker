// Account optimizer helpers. Imported history is evidence of ownership, never proof of
// non-ownership; manual roster corrections can fill gaps in time-limited wish history.

import { canonicalCharacterName } from './build-catalog.js';

function clean(value) { return String(value ?? '').trim(); }
function isCharacterPull(pull) { return /character/i.test(clean(pull?.itemType)); }
function isWeaponPull(pull) { return /weapon/i.test(clean(pull?.itemType)); }

export function analyzeGenshinOwnership(data = {}) {
  const characters = new Map();
  const weapons = new Map();
  let characterPulls = 0;
  let weaponPulls = 0;
  let typedPulls = 0;

  for (const pulls of Object.values(data?.genshin || {})) {
    for (const pull of pulls || []) {
      const rawName = clean(pull?.name);
      if (!rawName) continue;
      if (isCharacterPull(pull)) {
        typedPulls++;
        characterPulls++;
        const name = canonicalCharacterName(rawName);
        characters.set(name, (characters.get(name) || 0) + 1);
      } else if (isWeaponPull(pull)) {
        typedPulls++;
        weaponPulls++;
        weapons.set(rawName, (weapons.get(rawName) || 0) + 1);
      }
    }
  }
  return { characters, weapons, characterPulls, weaponPulls, typedPulls, hasTypedHistory: typedPulls > 0 };
}

export function characterHistoryStatus(name, ownership, minimumConstellation = 0, overrides = {}) {
  const canonical = canonicalCharacterName(name);
  const required = Math.max(0, Number(minimumConstellation || 0));
  const manual = Object.prototype.hasOwnProperty.call(overrides || {}, canonical) ? Number(overrides[canonical]) : null;

  if (manual === -1) {
    return { state: 'unowned', source: 'manual', copies: 0, constellation: null, requirementMet: false, label: 'Marked not owned' };
  }
  if (Number.isInteger(manual) && manual >= 0 && manual <= 6) {
    const met = manual >= required;
    return {
      state: met ? 'verified' : 'short', source: 'manual', copies: manual + 1, constellation: manual, requirementMet: met,
      label: met ? `Roster C${manual}` : `Roster C${manual} · C${required} required`,
    };
  }

  // The Traveler is account-owned by definition and does not appear in wish history.
  // Treat each elemental form as at least C0; higher constellation requirements still
  // need an explicit roster correction because free constellation unlocks vary by progress.
  if (/^(Traveler \(|Cryo Traveler$)/.test(canonical)) {
    const met = required <= 0;
    return { state: met ? 'verified' : 'short', source: 'free', copies: 1, constellation: 0, requirementMet: met, label: met ? 'Free Traveler · C0+' : `Free Traveler · C0+ · C${required} required` };
  }

  const copies = ownership?.characters?.get(canonical) || 0;
  if (!copies) return { state: 'unknown', source: 'history', copies: 0, constellation: null, requirementMet: false, label: 'Ownership unknown' };
  const constellation = Math.min(6, Math.max(0, copies - 1));
  const met = constellation >= required;
  return {
    state: met ? 'verified' : 'short', source: 'history', copies, constellation, requirementMet: met,
    label: met ? `Seen C${constellation}+` : `Seen C${constellation}+ · C${required} required`,
  };
}

export function weaponHistoryStatus(name, ownership) {
  const copies = ownership?.weapons?.get(clean(name)) || 0;
  return { state: copies ? 'verified' : 'unknown', copies, label: copies ? `Seen in history${copies > 1 ? ` ×${copies}` : ''}` : 'Not seen in imported history' };
}

export function teamHistoryStatus(team, ownership, overrides = {}) {
  const members = (team?.members || []).map((member) => ({
    member,
    status: characterHistoryStatus(member.name, ownership, member.minConstellation || 0, overrides),
  }));
  const counts = { verified: 0, short: 0, unknown: 0, unowned: 0 };
  for (const entry of members) counts[entry.status.state] = (counts[entry.status.state] || 0) + 1;
  return {
    members, ...counts,
    fullyVerified: members.length > 0 && counts.verified === members.length,
    blockers: members.filter((entry) => entry.status.state !== 'verified'),
  };
}


function roleKey(role) {
  const value = clean(role).toLowerCase();
  if (!value) return '';
  if (/heal|sustain/.test(value)) return 'sustain';
  if (/shield/.test(value)) return 'shield';
  if (/main dps|on[- ]?field|carry|driver|core\s*\/\s*dps/.test(value)) return 'main-dps';
  if (/sub dps|off[- ]?field/.test(value)) return 'sub-dps';
  if (/support|buffer|buff|debuff|battery|enabler|teammate/.test(value)) return 'support';
  if (/\bdps\b/.test(value)) return 'dps';
  return value.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function hasPublishedDps(value) { return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)); }

function sourceStrengthBonus(team) {
  if (hasPublishedDps(team?.dps)) {
    const dps = Math.max(0, Number(team.dps));
    return Math.min(80, dps / 5000);
  }
  const tierScores = { SS: 45, 'S+': 40, S: 36, 'A+': 30, A: 26, 'B+': 20, B: 16, C: 10, GUIDE: 12, F2P: 8, BEST: 42 };
  return (tierScores[String(team?.tier || '').toUpperCase()] || 12) + Math.max(0, 14 - Number(team?.rank || 14));
}

function canonicalTeamMembers(team) {
  return (team?.members || []).map((member) => ({ ...member, canonical: canonicalCharacterName(member.name) }));
}

/**
 * Suggest source-backed replacements for blocked team members.
 *
 * Priority:
 * 1. A character the active roster can already satisfy.
 * 2. A direct "same core, one slot changed" swap from another ranked team.
 * 3. Same functional role in another ranked team.
 * 4. Same team slot in another ranked team.
 * 5. Guide-backed variants that preserve most of the current core.
 *
 * Missing focus characters are intentionally not replaced: the build page is about that
 * character, so replacing them would turn the recommendation into a different guide.
 */
export function buildGuideVariantTeams(variants = [], startRank = 50) {
  return (variants || []).map((variant, index) => ({
    rank: startRank + index,
    sourceRank: null,
    isVariant: true,
    name: variant.name || `${variant.reaction || 'Guide'} guide variant`,
    reaction: variant.reaction || 'General',
    tier: 'Guide',
    note: variant.note || 'Guide-backed alternative lineup. No comparable DPS number is assigned.',
    members: (variant.members || []).map((member) => typeof member === 'string'
      ? { name: canonicalCharacterName(member), role: '', minConstellation: 0 }
      : { ...member, name: canonicalCharacterName(member.name), minConstellation: Number(member.minConstellation || 0) }),
  }));
}

/**
 * Exact one-slot, source-backed substitutions for blocked members.
 *
 * A suggestion is only called "instead of X" when the alternate source lineup keeps
 * every other member and removes X. This prevents misleading cases where a nearby team
 * changes two slots but the UI accidentally implies that only one character changed.
 */
export function suggestTeamSubstitutions(
  team,
  allTeams = [],
  ownership,
  overrides = {},
  focusName = '',
  variants = [],
  limitPerMember = 3,
) {
  const account = teamHistoryStatus(team, ownership, overrides);
  const baseMembers = canonicalTeamMembers(team);
  const baseNames = new Set(baseMembers.map((member) => member.canonical));
  const focus = canonicalCharacterName(focusName);
  const variantTeams = buildGuideVariantTeams(variants);
  const pool = [...(allTeams || []), ...variantTeams];
  const output = [];

  for (const blocker of account.blockers) {
    const missing = canonicalCharacterName(blocker.member.name);
    if (missing === focus) {
      output.push({ member: blocker.member, status: blocker.status, coreCharacter: true, candidates: [] });
      continue;
    }

    const candidates = new Map();
    for (const targetTeam of pool) {
      if (!targetTeam || targetTeam === team) continue;
      const targetMembers = canonicalTeamMembers(targetTeam);
      const targetNames = new Set(targetMembers.map((member) => member.canonical));
      if (focus && !targetNames.has(focus)) continue;
      if (targetNames.has(missing)) continue; // this lineup does not actually replace the blocker
      if (targetMembers.length !== baseMembers.length) continue;

      const retained = baseMembers.filter((member) => member.canonical !== missing && targetNames.has(member.canonical));
      const incoming = targetMembers.filter((member) => !baseNames.has(member.canonical));
      if (retained.length !== baseMembers.length - 1 || incoming.length !== 1) continue;

      const replacement = incoming[0];
      const status = characterHistoryStatus(replacement.canonical, ownership, replacement.minConstellation || 0, overrides);
      if (status.state === 'unowned') continue;
      const targetAccount = teamHistoryStatus(targetTeam, ownership, overrides);
      const key = replacement.canonical;
      const candidate = {
        name: replacement.canonical,
        role: replacement.role || '',
        minConstellation: Number(replacement.minConstellation || 0),
        status,
        targetTeam,
        targetAccount,
        evidence: [targetTeam.isVariant ? 'Exact one-slot guide variant' : 'Exact one-slot source swap'],
        score: (status.state === 'verified' ? 1000 : status.state === 'short' ? 160 : 20)
          + (targetAccount.fullyVerified ? 300 : 0)
          - targetAccount.blockers.length * 35
          + sourceStrengthBonus(targetTeam),
      };
      const previous = candidates.get(key);
      if (!previous || candidate.score > previous.score) candidates.set(key, candidate);
    }

    const ranked = [...candidates.values()]
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, Math.max(1, Number(limitPerMember || 3)));
    output.push({ member: blocker.member, status: blocker.status, coreCharacter: false, candidates: ranked });
  }
  return output;
}

/**
 * Full alternative lineups. Unlike one-slot substitutions these are deliberately shown as
 * complete teams, because two or more members may change. Fully playable teams are ranked
 * first, then the alternatives with the fewest blockers and greatest overlap with the base.
 */
export function suggestAlternativeLineups(
  team,
  allTeams = [],
  ownership,
  overrides = {},
  focusName = '',
  variants = [],
  limit = 4,
) {
  const baseMembers = canonicalTeamMembers(team);
  const baseNames = new Set(baseMembers.map((member) => member.canonical));
  const baseSignature = [...baseNames].sort().join('|');
  const baseAccount = teamHistoryStatus(team, ownership, overrides);
  const blockerNames = new Set(baseAccount.blockers.map((entry) => canonicalCharacterName(entry.member.name)));
  const focus = canonicalCharacterName(focusName);
  const pool = [...(allTeams || []), ...buildGuideVariantTeams(variants)];
  const seen = new Set();
  const rows = [];

  for (const targetTeam of pool) {
    if (!targetTeam || targetTeam === team) continue;
    const targetMembers = canonicalTeamMembers(targetTeam);
    if (!targetMembers.length) continue;
    const targetNames = new Set(targetMembers.map((member) => member.canonical));
    if (focus && !targetNames.has(focus)) continue;
    const signature = [...targetNames].sort().join('|');
    if (signature === baseSignature || seen.has(signature)) continue;
    seen.add(signature);

    const shared = baseMembers.filter((member) => targetNames.has(member.canonical)).length;
    const removed = baseMembers.filter((member) => !targetNames.has(member.canonical)).map((member) => member.canonical);
    const added = targetMembers.filter((member) => !baseNames.has(member.canonical)).map((member) => member.canonical);
    const solvesBlockedSlot = removed.some((name) => blockerNames.has(name));
    if (!solvesBlockedSlot && shared < Math.max(2, baseMembers.length - 2)) continue;

    const account = teamHistoryStatus(targetTeam, ownership, overrides);
    // Don't clutter the UI with an alternative that is strictly harder to build and barely related.
    if (!account.fullyVerified && account.blockers.length > baseAccount.blockers.length && shared < baseMembers.length - 1) continue;

    rows.push({
      team: targetTeam,
      account,
      shared,
      removed,
      added,
      score: (account.fullyVerified ? 10000 : 0)
        - account.blockers.length * 1000
        + shared * 150
        + sourceStrengthBonus(targetTeam),
    });
  }

  return rows
    .sort((a, b) => b.score - a.score || Number(a.team.rank || 999) - Number(b.team.rank || 999))
    .slice(0, Math.max(1, Number(limit || 4)));
}

function strength(team) {
  if (hasPublishedDps(team?.dps)) {
    const quality = team?.isSimulation ? Number(team?.simulation?.qualityRank || 1) : 4;
    return { numeric: 1, quality, value: Number(team.dps) };
  }
  const tierScores = { SS: 600, 'S+': 560, S: 520, 'A+': 460, A: 420, 'B+': 360, B: 320, C: 240, GUIDE: 200, F2P: 160 };
  return { numeric: 0, quality: 0, value: (tierScores[String(team?.tier || '').toUpperCase()] || 200) - Number(team?.rank || 999) };
}

export function rankBuildableTeams(teams = [], ownership, overrides = {}) {
  return teams
    .map((team) => ({ team, account: teamHistoryStatus(team, ownership, overrides) }))
    .filter((entry) => entry.account.fullyVerified)
    .sort((a, b) => {
      const sa = strength(a.team), sb = strength(b.team);
      return sb.numeric - sa.numeric || sb.quality - sa.quality || sb.value - sa.value || Number(a.team.rank || 999) - Number(b.team.rank || 999);
    });
}

export function rankClosestTeams(teams = [], ownership, overrides = {}, limit = 4) {
  return teams
    .map((team) => ({ team, account: teamHistoryStatus(team, ownership, overrides) }))
    .filter((entry) => !entry.account.fullyVerified)
    .sort((a, b) => {
      const blockerDiff = a.account.blockers.length - b.account.blockers.length;
      if (blockerDiff) return blockerDiff;
      const sa = strength(a.team), sb = strength(b.team);
      return sb.numeric - sa.numeric || sb.quality - sa.quality || sb.value - sa.value || Number(a.team.rank || 999) - Number(b.team.rank || 999);
    })
    .slice(0, limit);
}
