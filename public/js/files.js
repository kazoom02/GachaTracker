// js/files.js
// PC import/export. Genshin uses .xlsx (paimon.moe style, per-banner sheets);
// Wuthering Waves uses .json. A dropped/selected file is routed by its type.

import { GENSHIN_BANNERS } from './config.js?v=20260824b';
import { getData, replaceGenshinBanner, replaceWuwaPool, replaceAll, save } from './store.js?v=20260824b';
import {
  detectWuwaJsonSource,
  groupWuwaJson,
  matchGenshinBanner,
  normalizePaimonRows,
  normalizeWuwaFilePull,
  sortWuwaFilePulls,
} from './file-formats.js?v=20260824b';

const SHEET_NAMES = {
  character: 'Character Event',
  weapon: 'Weapon Event',
  standard: 'Standard',
  novice: "Beginners' Wish",
  chronicled: 'Chronicled Wish',
};

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
  const informationTitle = wb.Sheets.Information?.A1?.v || '';
  const source = /paimon\.moe/i.test(String(informationTitle)) ? 'paimon.moe' : 'Genshin Impact';

  for (const sheetName of wb.SheetNames) {
    const bannerKey = matchGenshinBanner(sheetName);
    if (!bannerKey) continue;
    recognizedSheets++;
    const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
    if (!rows.length) continue;

    const pulls = normalizePaimonRows(rows, bannerKey);
    const n = replaceGenshinBanner(bannerKey, pulls);
    perBanner[bannerKey] = n;
    added += n;
  }

  if (!recognizedSheets) {
    throw new Error('No recognizable banner sheets found. Expected an exported Genshin wish .xlsx.');
  }
  save();
  return { game: 'Genshin Impact', source, added, perBanner };
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
  const banners = groupWuwaJson(obj);
  if (!banners) throw new Error('Could not read this as Wuthering Waves data.');

  const perBanner = {};
  let added = 0;
  for (const key of Object.keys(banners)) {
    const list = sortWuwaFilePulls(banners[key].map((entry) => normalizeWuwaFilePull(entry, key)).filter((pull) => pull.name));
    if (!list.length) continue;
    const n = replaceWuwaPool(key, list); // file is the authoritative snapshot for this pool
    perBanner[key] = n;
    added += n;
  }
  save();
  return { game: 'Wuthering Waves', source: detectWuwaJsonSource(obj), added, perBanner };
}
