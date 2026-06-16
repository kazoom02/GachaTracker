#!/usr/bin/env node
// Build icons/<game>/manifest.json by scanning the image files you dropped in.
// This maps each pull's display name (e.g. "Static Mist") to the exact filename
// (e.g. "Weapon_Static_Mist.png"), which makes portrait matching exact and fast.
//
// Usage (from the project root):
//   node tools/build-icon-manifest.mjs
//
// It handles the Genshin / Wuthering Waves wiki naming you already have:
//   "Neuvillette_Icon.png"        -> "Neuvillette"
//   "Weapon_Static_Mist.png"      -> "Static Mist"
//   "Moongazer's_Sigil_Icon.png"  -> "Moongazer's Sigil"
// Skin / outfit variants (files containing "_skin_") are skipped so the base art wins.

import { readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const games = ['genshin', 'wuwa'];

function displayName(file) {
  let n = file.replace(/\.(png|webp|jpg|jpeg|gif)$/i, '');

  if (/_skin_/i.test(n)) return null;

  // Prefixes
  n = n.replace(/^(Weapon|Resonator|Item|Character)[_ ]/i, '');
  n = n.replace(/^Icon[_ ]/i, '');

  // Suffixes
  n = n.replace(/[_ ]Icon$/i, '');
  n = n.replace(/[_ ]Portrait$/i, '');
  n = n.replace(/[_ ]Avatar$/i, '');

  // Convert underscores to spaces
  n = n.replace(/_/g, ' ').trim();

  return n || null;
}

let totalsLine = [];
for (const game of games) {
  const dir = join(root, 'public', 'icons', game);
  if (!existsSync(dir)) { totalsLine.push(`${game}: (folder missing)`); continue; }

  const files = readdirSync(dir).filter((f) => /\.(png|webp|jpg|jpeg|gif)$/i.test(f));
  const map = {};
  let skipped = 0;
  for (const f of files) {
    const name = displayName(f);
    if (!name) { skipped++; continue; }
    if (!(name in map)) map[name] = f; // first match wins
  }
  // Sort keys for a tidy, diff-friendly file.
  const sorted = Object.fromEntries(Object.keys(map).sort().map((k) => [k, map[k]]));
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(sorted, null, 2));
  totalsLine.push(`${game}: ${Object.keys(sorted).length} mapped${skipped ? `, ${skipped} skins skipped` : ''}`);
}

console.log('Manifests written →', totalsLine.join('  |  '));
