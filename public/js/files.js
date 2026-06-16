// js/files.js
// PC import/export. Genshin uses .xlsx (paimon.moe style, per-banner sheets);
// Wuthering Waves uses .json. A dropped/selected file is routed by its type.

import { GENSHIN_BANNERS } from './config.js';
import { getData, replaceGenshinBanner, replaceWuwaPool, replaceAll, save } from './store.js';

const SHEET_NAMES = {
  character: 'Character Event',
  weapon: 'Weapon Event',
  standard: 'Standard',
  novice: "Beginners' Wish",
  chronicled: 'Chronicled Wish',
};
const BANNER_GACHA_TYPE = { character: '301', weapon: '302', standard: '200', novice: '100', chronicled: '500' };

const today = () => new Date().toISOString().slice(0, 10);
const byTime = (a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0);

function download(text, filename, mime) {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Exports ──────────────────────────────────────────────────────────────────
export function exportGenshinXlsx() {
  if (!window.XLSX) throw new Error('Spreadsheet engine still loading — try again in a moment.');
  const data = getData().genshin;
  const wb = window.XLSX.utils.book_new();
  let total = 0;

  for (const b of GENSHIN_BANNERS) {
    const pulls = (data[b.key] || []).slice().sort(byTime);
    if (!pulls.length) continue;
    let pity = 0;
    const rows = pulls.map((p) => {
      pity += 1;
      const row = { Type: p.itemType || '', Name: p.name, Time: p.time, Rarity: p.rarity, Pity: pity };
      if (p.rarity === 5) pity = 0;
      return row;
    });
    const ws = window.XLSX.utils.json_to_sheet(rows, { header: ['Type', 'Name', 'Time', 'Rarity', 'Pity'] });
    window.XLSX.utils.book_append_sheet(wb, ws, SHEET_NAMES[b.key]);
    total += pulls.length;
  }
  if (!total) throw new Error('No Genshin pulls to export yet.');
  window.XLSX.writeFile(wb, `genshin-wishes-${today()}.xlsx`);
  return total;
}

export function exportWuwaJson() {
  const data = getData().wuwa;
  const banners = {};
  let total = 0;
  for (const key of Object.keys(data)) {
    const list = data[key] || [];
    if (!list.length) continue;
    banners[key] = list.map((p) => ({ name: p.name, rarity: p.rarity, itemType: p.itemType || '', time: p.time }));
    total += list.length;
  }
  if (!total) throw new Error('No Wuthering Waves pulls to export yet.');
  download(
    JSON.stringify({ type: 'gacha-tracker-wuwa', exportedAt: new Date().toISOString(), banners }, null, 2),
    `wuwa-convenes-${today()}.json`,
    'application/json'
  );
  return total;
}

export function exportFullBackup() {
  download(
    JSON.stringify({ ...getData(), type: 'gacha-tracker-backup' }, null, 2),
    `gacha-tracker-backup-${today()}.json`,
    'application/json'
  );
}

// ── Import (auto-routed by file type) ────────────────────────────────────────
export async function importFromFile(file) {
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'xlsx' || ext === 'xls') return importGenshinXlsx(file);
  if (ext === 'json') return importJson(file);
  throw new Error(`Unsupported file ".${ext}". Use a Genshin .xlsx or a Wuthering Waves .json.`);
}

async function importGenshinXlsx(file) {
  if (!window.XLSX) throw new Error('Spreadsheet engine still loading — try again in a moment.');
  const buf = await file.arrayBuffer();
  const wb = window.XLSX.read(buf, { type: 'array' });

  const perBanner = {};
  let added = 0;
  let recognizedSheets = 0;

  for (const sheetName of wb.SheetNames) {
    const bannerKey = matchBanner(sheetName);
    if (!bannerKey) continue;
    recognizedSheets++;
    const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
    if (!rows.length) continue;

    const pulls = rowsToPulls(rows, bannerKey);
    const n = replaceGenshinBanner(bannerKey, pulls);
    perBanner[bannerKey] = n;
    added += n;
  }

  if (!recognizedSheets) {
    throw new Error('No recognizable banner sheets found. Expected an exported Genshin wish .xlsx.');
  }
  save();
  return { game: 'Genshin Impact', added, perBanner };
}

function matchBanner(sheetName) {
  const n = String(sheetName).toLowerCase();
  if (/char/.test(n)) return 'character';
  if (/weap/.test(n)) return 'weapon';
  if (/chronic/.test(n)) return 'chronicled';
  if (/begin|novice/.test(n)) return 'novice';
  if (/standard|perm/.test(n)) return 'standard';
  return null;
}

function colMap(sample) {
  const keys = Object.keys(sample);
  const find = (...alts) =>
    keys.find((k) => {
      const lk = k.toLowerCase().trim();
      return alts.some((a) => lk === a || lk.includes(a));
    });
  return {
    name: find('name'),
    time: find('time', 'date'),
    rarity: find('rarity', 'star', '⭐', 'rank'),
    type: find('item type', 'type'),
    pity: find('pity', 'pull', 'count', 'roll'),
  };
}

function parseRarity(v) {
  const s = String(v);
  const m = s.match(/[3-5]/);
  if (m) return Number(m[0]);
  const stars = (s.match(/★/g) || []).length;
  if (stars >= 3 && stars <= 5) return stars;
  return null;
}

function rowsToPulls(rows, bannerKey) {
  const map = colMap(rows[0]);
  const gachaType = BANNER_GACHA_TYPE[bannerKey];

  // Normalize each row to {name, time, type, rarity?, pity?}; sort chronologically by time.
  let recs = rows
    .map((r) => ({
      name: map.name ? String(r[map.name]).trim() : '',
      time: map.time ? String(r[map.time]).trim() : '',
      itemType: map.type ? String(r[map.type]).trim() : '',
      rarity: map.rarity ? parseRarity(r[map.rarity]) : null,
      pity: map.pity ? Number(r[map.pity]) : null,
    }))
    .filter((r) => r.name);

  recs.sort(byTime);

  // If there is no rarity column, recover 5★ from the pity column (it resets after each 5★).
  const haveRarity = recs.some((r) => r.rarity);
  if (!haveRarity && map.pity) {
    for (let i = 0; i < recs.length; i++) {
      const next = recs[i + 1];
      const isFive = next ? next.pity <= recs[i].pity : false; // pity resets after a 5★
      recs[i].rarity = isFive ? 5 : 3;
    }
  }

  return recs.map((r) => ({
    id: '',
    name: r.name,
    rarity: r.rarity || 3,
    itemType: r.itemType,
    time: r.time,
    gachaType,
  }));
}

async function importJson(file) {
  const text = await file.text();
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }

  // Full backup (both games) → restore everything.
  if (obj.type === 'gacha-tracker-backup' || (obj.genshin && obj.wuwa)) {
    replaceAll(obj);
    return { game: 'full backup', restored: true };
  }

  // Otherwise treat it as Wuthering Waves convene data.
  const banners = wuwaBannersFromJson(obj);
  if (!banners) throw new Error('Could not read this as Wuthering Waves data.');

  const perBanner = {};
  let added = 0;
  for (const key of Object.keys(banners)) {
    const list = banners[key].map(normalizeWuwa).filter((p) => p.name).sort(byTime);
    if (!list.length) continue;
    const n = replaceWuwaPool(key, list); // file is the authoritative snapshot for this pool
    perBanner[key] = n;
    added += n;
  }
  save();
  return { game: 'Wuthering Waves', added, perBanner };
}

function wuwaBannersFromJson(obj) {
  if (obj.banners && typeof obj.banners === 'object') return obj.banners; // our export format
  if (obj.wuwa && typeof obj.wuwa === 'object') return obj.wuwa;
  // Flat array of pulls (wuwatracker uses obj.pulls) → group by pool type.
  const arr = Array.isArray(obj)
    ? obj
    : Array.isArray(obj.pulls)
    ? obj.pulls
    : Array.isArray(obj.list)
    ? obj.list
    : null;
  if (arr) {
    const grouped = {};
    for (const e of arr) {
      const key = String(e.cardPoolType ?? e.bannerType ?? e.gachaType ?? e.pool ?? e.poolId ?? '1');
      (grouped[key] = grouped[key] || []).push(e);
    }
    return grouped;
  }
  return null;
}

function normalizeWuwa(e) {
  const rarity = Number(e.rarity ?? e.qualityLevel ?? e.quality ?? e.star ?? 3);
  return {
    name: e.name || e.resourceName || '',
    rarity: rarity >= 3 && rarity <= 5 ? rarity : 3,
    itemType: e.itemType || e.resourceType || '',
    time: normTime(e.time || e.timestamp || ''),
  };
}

// Normalize convene timestamps to "YYYY-MM-DD HH:MM:SS" (strip ISO 'T' and timezone).
function normTime(t) {
  if (!t) return '';
  return String(t).replace('T', ' ').replace(/(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/, '').trim();
}
