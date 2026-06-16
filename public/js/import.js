// js/import.js
// Orchestrates importing NEW pulls only, by calling the /api forwarders.

import { GENSHIN_BANNERS, WUWA_QUERY_TYPES, wuwaBanner } from './config.js';
import { addGenshinPulls, mergeWuwaPoolFresh, genshinKnownMaxId, bigIntGt, save } from './store.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Genshin ────────────────────────────────────────────────────────────────
export async function importGenshin(authUrl, onProgress = () => {}) {
  if (!/^https?:\/\//.test(authUrl.trim())) {
    throw new Error('That does not look like a wish-history URL. Paste the full https:// link.');
  }
  const lang = new URL(authUrl).searchParams.get('lang') || 'en';
  let totalNew = 0;
  const perBanner = {};

  for (const banner of GENSHIN_BANNERS) {
    let bannerNew = 0;
    for (const gachaType of banner.fetchTypes) {
      const knownMax = genshinKnownMaxId(banner.key, gachaType);
      const fresh = []; // newest-first as fetched
      let endId = '0';
      let page = 1;
      let stop = false;

      while (!stop) {
        onProgress(`Genshin · ${banner.name} · reading new pulls (${totalNew + bannerNew + fresh.length})`);
        const res = await fetch('/api/genshin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authUrl, gachaType, page, size: 20, endId, lang }),
        });
        const json = await res.json();

        if (json.retcode !== undefined && json.retcode !== 0) {
          // -101 authkey timeout/invalid, -110 too frequent, etc.
          throw new Error(`HoYoverse error ${json.retcode}: ${json.message || 'request rejected'} ` +
            `(authkeys expire ~24h after you generate the link — re-run the script if so).`);
        }
        const list = (json.data && json.data.list) || [];
        if (!list.length) break;

        for (const it of list) {
          if (!bigIntGt(it.id, knownMax)) { stop = true; break; } // reached already-stored pulls
          fresh.push(normalizeGenshin(it));
        }
        if (stop) break;
        endId = list[list.length - 1].id;
        page++;
        await sleep(350); // be gentle with the API to avoid rate limiting
      }

      // fresh is newest-first; store oldest-first.
      fresh.reverse();
      bannerNew += addGenshinPulls(banner.key, fresh);
    }
    perBanner[banner.key] = bannerNew;
    totalNew += bannerNew;
  }

  save();
  return { totalNew, perBanner };
}

function normalizeGenshin(it) {
  return {
    id: String(it.id),
    name: it.name,
    rarity: Number(it.rank_type),
    itemType: it.item_type, // "Character" | "Weapon"
    time: it.time,
    gachaType: String(it.gacha_type),
  };
}

// ── Wuthering Waves ──────────────────────────────────────────────────────────
export async function importWuwa(conveneUrl, onProgress = () => {}) {
  const params = parseWuwaUrl(conveneUrl);
  if (!params) {
    throw new Error('Could not read the convene URL. Paste the full link that starts with https://aki-gm-resources...');
  }
  let totalNew = 0;
  const perBanner = {};
  let okPools = 0;
  let lastError = null;

  for (const poolType of WUWA_QUERY_TYPES) {
    const banner = wuwaBanner(poolType);
    onProgress(`Wuthering Waves · ${banner.name} · reading pulls`);
    const res = await fetch('/api/wuwa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: params.playerId,
        cardPoolId: params.cardPoolId,
        cardPoolType: Number(poolType),
        serverId: params.serverId,
        languageCode: params.languageCode,
        recordId: params.recordId,
      }),
    });
    const json = await res.json();

    if (json.code !== 0) {
      // Some pool types may not exist for this account — skip those, remember the error.
      lastError = `Kuro error ${json.code}: ${json.message || 'request rejected'}`;
      continue;
    }
    okPools++;
    const list = json.data || []; // newest-first
    const asc = list.map(normalizeWuwa).reverse(); // oldest-first
    const added = mergeWuwaPoolFresh(banner.key, asc);
    if (added) perBanner[banner.key] = added;
    totalNew += added;
    await sleep(150);
  }

  // If every pool failed, the link itself is almost certainly the problem.
  if (okPools === 0) {
    throw new Error(`${lastError || 'No convene data returned'} — the convene link expires, so re-run the script for a fresh one.`);
  }

  save();
  return { totalNew, perBanner };
}

function normalizeWuwa(it) {
  return {
    name: it.name,
    rarity: Number(it.qualityLevel),
    itemType: it.resourceType || '', // "Resonator" | "Weapon"
    time: normWuwaTime(it.time),
  };
}

// Normalize convene timestamps to "YYYY-MM-DD HH:MM:SS" (strip ISO 'T' and timezone).
export function normWuwaTime(t) {
  if (!t) return '';
  return String(t).replace('T', ' ').replace(/(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/, '').trim();
}

// The convene URL keeps its params in the hash fragment (#/record?...).
export function parseWuwaUrl(raw) {
  try {
    const url = new URL(raw.trim());
    const hash = url.hash || '';
    const qs = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : url.search.slice(1);
    const p = new URLSearchParams(qs);
    const playerId = p.get('player_id');
    const recordId = p.get('record_id');
    const serverId = p.get('svr_id');
    if (!playerId || !recordId || !serverId) return null;
    return {
      playerId,
      recordId,
      serverId,
      cardPoolId: p.get('resources_id') || '',
      languageCode: p.get('lang') || 'en',
    };
  } catch {
    return null;
  }
}
