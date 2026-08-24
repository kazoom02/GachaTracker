// js/store.js
// Browser storage + the logic that keeps only NEW pulls and computes pity.

import { STORAGE_KEY, GENSHIN_BANNERS } from './config.js?v=20260824d';
import { mergeGenshinHistory, sortGenshinHistory } from './genshin-merge.js?v=20260824d';
import { mergeWuwaHistory } from './wuwa-merge.js?v=20260824d';

const PROFILE_STATE_VERSION = 2;
const PROFILE_BACKUP_TYPE = 'gacha-tracker-profiles-backup';

function emptyData() {
  const genshin = {};
  GENSHIN_BANNERS.forEach((b) => (genshin[b.key] = []));
  // WuWa pools are keyed dynamically by their real pool number, so start empty.
  return { version: 1, updatedAt: null, genshin, wuwa: {} };
}

function normalizeData(data = {}) {
  const base = emptyData();
  return {
    version: 1,
    updatedAt: data.updatedAt || null,
    genshin: { ...base.genshin, ...(data.genshin || {}) },
    wuwa: { ...(data.wuwa || {}) },
  };
}

function makeProfileId() {
  if (globalThis.crypto?.randomUUID) return `profile-${crypto.randomUUID()}`;
  return `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function cleanProfileName(name, fallback = 'New Profile') {
  const cleaned = String(name ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
  return cleaned || fallback;
}

function makeProfile(name, data = emptyData(), id = makeProfileId()) {
  const now = new Date().toISOString();
  return {
    id,
    name: cleanProfileName(name),
    createdAt: now,
    updatedAt: data.updatedAt || now,
    data: normalizeData(data),
  };
}

function normalizeProfileState(value) {
  const sourceProfiles = value?.profiles && typeof value.profiles === 'object'
    ? Object.values(value.profiles)
    : [];
  const profiles = {};

  for (const source of sourceProfiles) {
    if (!source || typeof source !== 'object') continue;
    const id = String(source.id || makeProfileId());
    const profile = makeProfile(source.name, source.data, id);
    profile.createdAt = source.createdAt || profile.createdAt;
    profile.updatedAt = source.updatedAt || profile.data.updatedAt || profile.updatedAt;
    profiles[id] = profile;
  }

  if (!Object.keys(profiles).length) {
    const profile = makeProfile('My Account', emptyData(), 'profile-default');
    profiles[profile.id] = profile;
  }

  const requestedActive = String(value?.activeProfileId || '');
  const activeProfileId = profiles[requestedActive] ? requestedActive : Object.keys(profiles)[0];
  return { version: PROFILE_STATE_VERSION, type: PROFILE_BACKUP_TYPE, activeProfileId, profiles };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizeProfileState(null);
    const parsed = JSON.parse(raw);
    if (parsed?.version === PROFILE_STATE_VERSION && parsed?.profiles) {
      return normalizeProfileState(parsed);
    }

    // v1 stored one account directly. Preserve it as the first profile.
    const profile = makeProfile('My Account', normalizeData(parsed), 'profile-default');
    return normalizeProfileState({ activeProfileId: profile.id, profiles: { [profile.id]: profile } });
  } catch {
    return normalizeProfileState(null);
  }
}

let STATE = loadState();
let DATA = STATE.profiles[STATE.activeProfileId].data;

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE));
}

// Persist the profile container immediately so a legacy v1 account is migrated even
// when the user only opens the site and switches profiles later.
try { persistState(); } catch { /* Storage may be disabled; the in-memory app still works. */ }

export function load() {
  return DATA;
}

export function getData() {
  return DATA;
}

export function save() {
  const now = new Date().toISOString();
  DATA.updatedAt = now;
  const profile = STATE.profiles[STATE.activeProfileId];
  profile.data = DATA;
  profile.updatedAt = now;
  persistState();
}

export function replaceAll(newData) {
  DATA = normalizeData(newData);
  save();
}

export function clearAll() {
  DATA = emptyData();
  save();
}

function pullCount(data) {
  const genshin = Object.values(data.genshin || {}).reduce((sum, pulls) => sum + (pulls?.length || 0), 0);
  const wuwa = Object.values(data.wuwa || {}).reduce((sum, pulls) => sum + (pulls?.length || 0), 0);
  return genshin + wuwa;
}

function profileSummary(profile) {
  return {
    id: profile.id,
    name: profile.name,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    pullCount: pullCount(profile.data),
  };
}

export function getProfiles() {
  return Object.values(STATE.profiles).map(profileSummary);
}

export function getActiveProfile() {
  return profileSummary(STATE.profiles[STATE.activeProfileId]);
}

export function createProfile(name) {
  const profile = makeProfile(cleanProfileName(name));
  STATE.profiles[profile.id] = profile;
  STATE.activeProfileId = profile.id;
  DATA = profile.data;
  persistState();
  return profileSummary(profile);
}

export function switchProfile(id) {
  const profile = STATE.profiles[String(id)];
  if (!profile) throw new Error('That profile no longer exists.');
  STATE.activeProfileId = profile.id;
  DATA = profile.data;
  persistState();
  return profileSummary(profile);
}

export function renameProfile(id, name) {
  const profile = STATE.profiles[String(id)];
  if (!profile) throw new Error('That profile no longer exists.');
  profile.name = cleanProfileName(name, profile.name);
  profile.updatedAt = new Date().toISOString();
  persistState();
  return profileSummary(profile);
}

export function deleteProfile(id) {
  const key = String(id);
  if (!STATE.profiles[key]) throw new Error('That profile no longer exists.');
  if (Object.keys(STATE.profiles).length <= 1) throw new Error('Keep at least one profile.');
  delete STATE.profiles[key];
  if (STATE.activeProfileId === key) STATE.activeProfileId = Object.keys(STATE.profiles)[0];
  DATA = STATE.profiles[STATE.activeProfileId].data;
  persistState();
  return getActiveProfile();
}

export function exportProfilesBackup() {
  const snapshot = JSON.parse(JSON.stringify(STATE));
  return { ...snapshot, type: PROFILE_BACKUP_TYPE, exportedAt: new Date().toISOString() };
}

export function replaceProfilesBackup(backup) {
  if (backup?.type !== PROFILE_BACKUP_TYPE || !backup?.profiles) {
    throw new Error('That is not a Convene profiles backup.');
  }
  STATE = normalizeProfileState(backup);
  DATA = STATE.profiles[STATE.activeProfileId].data;
  persistState();
  return getProfiles().length;
}

// Highest Genshin pull id we already stored for a given gacha_type (for incremental fetch).
export function genshinKnownMaxId(bannerKey, gachaType) {
  const list = DATA.genshin[bannerKey] || [];
  let max = '0';
  for (const p of list) {
    if (p.gachaType === gachaType && bigIntGt(p.id, max)) max = p.id;
  }
  return max;
}

// Compare numeric id strings safely (ids are large snowflake numbers).
export function bigIntGt(a, b) {
  try {
    return BigInt(a) > BigInt(b);
  } catch {
    return Number(a) > Number(b);
  }
}

// Add genshin pulls. Dedupe by a content signature (counting multiplicity), so the
// same pull is never stored twice even when it arrives from different sources (live URL
// vs an imported .xlsx, which has no ids), while genuine duplicates inside one 10-pull
// are preserved. Pulls are kept in chronological order.
export function addGenshinPulls(bannerKey, pulls) {
  const list = DATA.genshin[bannerKey] || (DATA.genshin[bannerKey] = []);
  const merged = mergeGenshinHistory(list, pulls);
  DATA.genshin[bannerKey] = merged.list;
  return merged.added;
}

// WuWa pulls have no per-pull id, and timestamps can differ by timezone between tools
// (a wuwatracker file is UTC; the live API is server-local). Merging across sources by
// content is therefore unreliable, so each pool is handled as a snapshot.

// File import: the file is the authoritative full history for that pool — replace it.
export function replaceWuwaPool(key, listAsc) {
  DATA.wuwa[String(key)] = listAsc.slice();
  return listAsc.length;
}

// Live import: Kuro can return either the full pool history or a rolling recent window.
// Reconcile the overlapping sequences so new pulls are still appended when the response
// is shorter than the browser's stored history. Returns how many pulls were added.
export function mergeWuwaPoolFresh(key, freshAsc) {
  const k = String(key);
  const stored = DATA.wuwa[k] || [];
  const merged = mergeWuwaHistory(stored, freshAsc);
  DATA.wuwa[k] = merged.list;
  return merged.added;
}

// Genshin file import (.xlsx) is also a full snapshot per banner — replace it.
export function replaceGenshinBanner(key, pulls) {
  DATA.genshin[key] = sortGenshinHistory(pulls);
  return pulls.length;
}

// ── Pity analysis ──────────────────────────────────────────────────────────
// Walk pulls oldest->newest, recording how many pulls each 5★ (and 4★) took.
export function analyze(pulls) {
  let since5 = 0;
  let since4 = 0;
  const five = [];
  const four = [];
  for (const p of pulls) {
    since5++;
    since4++;
    if (p.rarity === 5) {
      five.push({ name: p.name, pity: since5, time: p.time, itemType: p.itemType });
      since5 = 0;
      since4 = 0;
    } else if (p.rarity === 4) {
      four.push({ name: p.name, pity: since4, time: p.time, itemType: p.itemType });
      since4 = 0;
    }
  }
  const sum5 = five.reduce((a, b) => a + b.pity, 0);
  return {
    total: pulls.length,
    five,            // newest 5★ is last
    four,
    count5: five.length,
    count4: four.length,
    currentPity: since5,      // pulls since last 5★
    current4Pity: since4,
    avgPity: five.length ? sum5 / five.length : 0,
  };
}
