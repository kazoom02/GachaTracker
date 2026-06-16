// js/config.js
// Central configuration: banner definitions for both games + optional Google Drive setup.

import { md5 } from './md5.js';

// ── Google Drive (optional) ────────────────────────────────────────────────
// Leave blank to disable Drive sync (PC export/import and browser storage still work).
// To enable: create an OAuth Client ID (type: Web application) in Google Cloud Console,
// add your Netlify URL to "Authorized JavaScript origins", and paste the ID here.
export const GOOGLE_CLIENT_ID = '199344597634-rmchj41j1c5ju5ltdn6bgg7bvdkojjrr.apps.googleusercontent.com';

export const STORAGE_KEY = 'gacha-tracker-data-v1';
export const DRIVE_FILENAME = 'gacha-tracker-data.json';

// ── Character / weapon portraits ───────────────────────────────────────────
// Each pull tries to load an image, falling back to a styled monogram tile if none
// is found. By default it pulls portraits straight from the game wikis (no setup, no
// downloads) and then falls back to a local "icons/<game>/" folder if you add one.
//
// Each game has an ORDERED list of sources, tried in turn:
//   { wiki: '<fandom-subdomain>' }  → builds Fandom CDN URLs by filename (md5 path)
//   { base: '<folder or URL>' }     → local folder or a remote host (e.g. GitHub raw)
// Reorder or delete entries to taste (e.g. put your local folder first, or drop the wiki).
export const ICON_SOURCES = {
  genshin: [{ wiki: 'gensin-impact' }, { base: 'icons/genshin' }],
  wuwa: [{ wiki: 'wutheringwaves' }, { base: 'icons/wuwa' }],
};

// Optional name->filename maps (icons/<game>/manifest.json) for local/remote folders.
const MANIFESTS = { genshin: null, wuwa: null };
export function setManifest(game, obj) { MANIFESTS[game] = obj || null; }

// Turn a display name into a filename-safe slug, e.g. "Moongazer's Sigil" -> "moongazers-sigil".
export function slugify(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Fandom/MediaWiki image URL: /<m0>/<m0m1>/<Filename> where m = md5(Filename), and the
// first letter of the filename is capitalized before hashing (MediaWiki normalizes it).
function fandomUrl(wiki, filename) {
  const n = filename.charAt(0).toUpperCase() + filename.slice(1);
  const h = md5(n);
  return `https://static.wikia.nocookie.net/${wiki}/images/${h[0]}/${h.slice(0, 2)}/${encodeURIComponent(n)}`;
}

// WuWa weapon sub-types returned by the Kuro API as resourceType.
// The API never returns "Weapon" generically — it returns the specific weapon category.
const WUWA_WEAPON_TYPES = /^(weapon|sword|broadblade|pistols|gauntlets|rectifier)$/i;

// Candidate FILENAMES for a pull, most-likely first (wiki conventions + slug fallback).
function candidateFilenames(game, name, itemType, poolKey = '') {
  const u = String(name).trim().replace(/\s+/g, '_'); // wiki style: spaces -> underscores
  const s = slugify(name);
  const wuwaWeaponPool = game === 'wuwa' && ['2', '4', '11', '13'].includes(String(poolKey));
  // For WuWa, check against all weapon sub-types (Sword, Broadblade, Pistols, Gauntlets, Rectifier).
  // For Genshin, the API returns "Weapon" directly so the simple regex is enough.
  const weapon = game === 'wuwa'
    ? (WUWA_WEAPON_TYPES.test(itemType || '') || wuwaWeaponPool)
    : /weapon/i.test(itemType || '');
  const files = [];
  const man = MANIFESTS[game];
  if (man && man[name]) files.push(man[name]); // exact override first
  if (game === 'wuwa') {
    if (weapon) files.push(`Weapon_${u}.png`, `${u}_Icon.png`, `${u}.png`);
    else files.push(`Resonator_${u}.png`, `Resonators_${u}.png`, `${u}_Icon.png`, `${u}.png`);
  } else if (weapon) files.push(`Weapon_${u}.png`, `${u}_Icon.png`);
  else files.push(`${u}_Icon.png`, `Weapon_${u}.png`);
  files.push(`${u}.png`, `${s}.png`);
  return [...new Set(files.filter(Boolean))];
}

// Ordered list of candidate image URLs to try for a given pull. The <img> walks these
// until one loads; if all fail, the monogram tile shows instead.
export function iconCandidates(game, name, itemType, poolKey = '') {
  const files = candidateFilenames(game, name, itemType, poolKey);
  const sources = ICON_SOURCES[game] || [{ base: `icons/${game}` }];
  const urls = [];
  for (const src of sources) {
    for (const f of files) {
      if (src.wiki) urls.push(fandomUrl(src.wiki, f));
      else {
        const base = (src.base || `icons/${game}`).replace(/\/$/, '');
        urls.push(`${base}/${encodeURIComponent(f)}`);
      }
    }
  }
  return [...new Set(urls)];
}

// ── "How to get your link" scripts (shown in-app) ──────────────────────────
export const LINK_GUIDES = {
  genshin: {
    label: 'Genshin Impact',
    steps: [
      'In-game, open Wish → History and let the page load.',
      'On your PC, open PowerShell and paste this, then press Enter:',
    ],
    script:
      'Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex "&{$((New-Object System.Net.WebClient).DownloadString(\'https://gist.github.com/MadeBaruna/1d75c1d37d19eca71591ec8a31178235/raw/getlink.ps1\'))} global"',
    after: 'Copy the long https:// link it prints, paste it into the box above, and import.',
    credit: 'Script by MadeBaruna (paimon.moe).',
  },
  wuwa: {
    label: 'Wuthering Waves',
    steps: [
      'In-game, open Convene → Convene History and let it load.',
      'On your PC, open PowerShell and paste this, then press Enter:',
    ],
    script:
      'iwr -UseBasicParsing -Headers @{"User-Agent"="Mozilla/5.0"} https://raw.githubusercontent.com/wuwatracker/wuwatracker/c46dbadc006ed0d2c3f3a20b06b448a45475d32b/import.ps1 | iex',
    after: 'Copy the link it prints, paste it into the box above, and import.',
    credit: 'Script by the wuwatracker project.',
  },
};

// ── Genshin Impact ─────────────────────────────────────────────────────────
// gacha_type values are fetched and grouped into display banners.
// The Character banner merges types 301 and 400 (the game splits them but they are one pool).
export const GENSHIN_BANNERS = [
  { key: 'character', name: 'Character Event Wish', fetchTypes: ['301', '400'], hardPity: 90, softPity: 74 },
  { key: 'weapon',    name: 'Weapon Event Wish',    fetchTypes: ['302'],        hardPity: 80, softPity: 63 },
  { key: 'chronicled',name: 'Chronicled Wish',      fetchTypes: ['500'],        hardPity: 90, softPity: 74 },
  { key: 'standard',  name: 'Standard Wish',        fetchTypes: ['200'],        hardPity: 90, softPity: 74 },
  { key: 'novice',    name: "Beginners' Wish",      fetchTypes: ['100'],        hardPity: 90, softPity: 74 },
];

// ── Wuthering Waves ────────────────────────────────────────────────────────
// Kuro numbers the convene pools. The four main pools are 1-4; the beginner /
// selector banners show up as 10 / 11 in real data (and some accounts use 5-7).
// All convene banners share 80 hard pity / ~66 soft pity. We key WuWa data by the
// real pool number so live imports and file imports always land in the same bucket.
export const WUWA_HARD_PITY = 80;
export const WUWA_SOFT_PITY = 66;

// Live import asks for each of these pool types (the API returns each pool's full
// history). Unknown/empty ones are simply skipped. Includes collab pools (10/11) and a
// few spares so future collab/limited banners get picked up automatically.
export const WUWA_QUERY_TYPES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export const WUWA_POOL_NAMES = {
  '1': 'Featured Resonator',
  '2': 'Featured Weapon',
  '3': 'Standard Resonator',
  '4': 'Standard Weapon',
  '5': 'Beginner Convene',
  '6': "Beginner's Choice Convene",
  '7': "Beginner's Choice (Custom)",
  '8': 'Beginner Convene',
  '10': 'Collab Resonator',
  '11': 'Collab Weapon',
  '12': 'Collab Resonator',
  '13': 'Collab Weapon',
};

// Preferred display order; any other pool keys are appended after these.
const WUWA_ORDER = ['1', '2', '10', '11', '12', '13', '3', '4', '5', '6', '7', '8', '9'];

export function wuwaBanner(key) {
  const k = String(key);
  return { key: k, name: WUWA_POOL_NAMES[k] || `Convene Pool ${k}`, hardPity: WUWA_HARD_PITY, softPity: WUWA_SOFT_PITY };
}

// Ordered list of WuWa banners that actually have pulls stored.
export function wuwaBannersFor(wuwaData) {
  const keys = Object.keys(wuwaData || {}).filter((k) => (wuwaData[k] || []).length);
  keys.sort((a, b) => {
    const ia = WUWA_ORDER.indexOf(a);
    const ib = WUWA_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return keys.map(wuwaBanner);
}

export const GAMES = {
  genshin: { label: 'Genshin Impact', currency: 'wishes' },
  wuwa: { label: 'Wuthering Waves', currency: 'convenes' },
};
