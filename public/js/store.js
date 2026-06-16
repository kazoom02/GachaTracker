// js/store.js
// Browser storage + the logic that keeps only NEW pulls and computes pity.

import { STORAGE_KEY, GENSHIN_BANNERS } from './config.js';

function emptyData() {
  const genshin = {};
  GENSHIN_BANNERS.forEach((b) => (genshin[b.key] = []));
  // WuWa pools are keyed dynamically by their real pool number, so start empty.
  return { version: 1, updatedAt: null, genshin, wuwa: {} };
}

let DATA = load();

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw);
    const base = emptyData();
    // Merge defensively so a missing banner key never crashes the UI.
    return {
      version: 1,
      updatedAt: parsed.updatedAt || null,
      genshin: { ...base.genshin, ...(parsed.genshin || {}) },
      wuwa: { ...base.wuwa, ...(parsed.wuwa || {}) },
    };
  } catch {
    return emptyData();
  }
}

export function getData() {
  return DATA;
}

export function save() {
  DATA.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA));
}

export function replaceAll(newData) {
  const base = emptyData();
  DATA = {
    version: 1,
    updatedAt: newData.updatedAt || new Date().toISOString(),
    genshin: { ...base.genshin, ...(newData.genshin || {}) },
    wuwa: { ...base.wuwa, ...(newData.wuwa || {}) },
  };
  save();
}

export function clearAll() {
  DATA = emptyData();
  save();
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
  if (!pulls.length) return 0;
  const list = DATA.genshin[bannerKey] || (DATA.genshin[bannerKey] = []);

  const have = new Map();
  for (const p of list) {
    const s = gsig(p);
    have.set(s, (have.get(s) || 0) + 1);
  }
  const used = new Map();
  let added = 0;
  for (const p of pulls) {
    const s = gsig(p);
    const seen = used.get(s) || 0;
    if (seen < (have.get(s) || 0)) {
      used.set(s, seen + 1); // already stored — skip
      continue;
    }
    list.push(p);
    used.set(s, seen + 1);
    added++;
  }
  list.sort(byChrono);
  return added;
}

function gsig(p) {
  return `${p.gachaType || ''}|${p.time}|${p.name}|${p.rarity}`;
}

// Chronological order: by time string, then by id (real ids sort newest last).
function byChrono(a, b) {
  if (a.time !== b.time) return a.time < b.time ? -1 : 1;
  return bigIntGt(a.id, b.id) ? 1 : -1;
}

// WuWa pulls have no per-pull id, and timestamps can differ by timezone between tools
// (a wuwatracker file is UTC; the live API is server-local). Merging across sources by
// content is therefore unreliable, so each pool is handled as a snapshot.

// File import: the file is the authoritative full history for that pool — replace it.
export function replaceWuwaPool(key, listAsc) {
  DATA.wuwa[String(key)] = listAsc.slice();
  return listAsc.length;
}

// Live import: the API returns the full pool history each time. Adopt it, but never
// shrink — if the API returned fewer than we already have (e.g. it trimmed old records),
// keep the larger stored history. Returns how many pulls were added.
export function mergeWuwaPoolFresh(key, freshAsc) {
  const k = String(key);
  const stored = DATA.wuwa[k] || [];
  if (freshAsc.length >= stored.length) {
    DATA.wuwa[k] = freshAsc.slice();
    return freshAsc.length - stored.length;
  }
  return 0;
}

// Genshin file import (.xlsx) is also a full snapshot per banner — replace it.
export function replaceGenshinBanner(key, pulls) {
  DATA.genshin[key] = pulls.slice().sort(byChrono);
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
