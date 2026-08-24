// Pure adapters for third-party export formats. Keeping these free of browser APIs
// makes the parsing rules independently testable.

const GENSHIN_GACHA_TYPE = {
  character: '301',
  weapon: '302',
  standard: '200',
  novice: '100',
  chronicled: '500',
};

const WUWA_WEAPON_POOLS = new Set(['2', '4', '11', '13']);

function text(value) {
  return String(value ?? '').trim();
}

function headerToken(value) {
  return text(value).toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function findColumn(keys, ...aliases) {
  const wanted = aliases.map(headerToken);
  const exact = keys.find((key) => wanted.includes(headerToken(key)));
  if (exact) return exact;
  return keys.find((key) => wanted.some((alias) => alias.length > 2 && headerToken(key).includes(alias)));
}

function parseRarity(value) {
  const valueText = text(value);
  const digit = valueText.match(/[3-5]/);
  if (digit) return Number(digit[0]);
  const stars = (valueText.match(/[★⭐]/g) || []).length;
  return stars >= 3 && stars <= 5 ? stars : null;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function matchGenshinBanner(sheetName) {
  const name = text(sheetName).toLowerCase();
  if (/char/.test(name)) return 'character';
  if (/weap/.test(name)) return 'weapon';
  if (/chronic/.test(name)) return 'chronicled';
  if (/begin|novice/.test(name)) return 'novice';
  if (/standard|perm/.test(name)) return 'standard';
  return null;
}

export function normalizePaimonRows(rows, bannerKey) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const keys = Object.keys(rows[0]);
  const columns = {
    name: findColumn(keys, 'name', 'item name'),
    time: findColumn(keys, 'time', 'date', 'date received'),
    rarity: findColumn(keys, 'rarity', 'star', 'stars', '⭐', 'rank'),
    type: findColumn(keys, 'item type', 'type'),
    pity: findColumn(keys, 'pity'),
    order: findColumn(keys, '#roll', 'roll', 'pull no', 'pull number', 'index'),
  };

  const records = rows
    .map((row, sourceIndex) => ({
      name: columns.name ? text(row[columns.name]) : '',
      time: columns.time ? text(row[columns.time]) : '',
      itemType: columns.type ? text(row[columns.type]) : '',
      rarity: columns.rarity ? parseRarity(row[columns.rarity]) : null,
      pity: columns.pity ? finiteNumber(row[columns.pity]) : null,
      order: columns.order ? finiteNumber(row[columns.order]) : null,
      sourceIndex,
    }))
    .filter((record) => record.name);

  records.sort((a, b) => {
    if (a.time !== b.time) return a.time < b.time ? -1 : 1;
    if (a.order != null && b.order != null && a.order !== b.order) return a.order - b.order;
    return a.sourceIndex - b.sourceIndex;
  });

  // Older paimon.moe exports may omit rarity. Recover 5★ boundaries from pity resets.
  const hasRarity = records.some((record) => record.rarity);
  if (!hasRarity && columns.pity) {
    for (let index = 0; index < records.length; index++) {
      const next = records[index + 1];
      records[index].rarity = next && next.pity <= records[index].pity ? 5 : 3;
    }
  }

  const gachaType = GENSHIN_GACHA_TYPE[bannerKey] || '';
  return records.map((record) => ({
    id: '',
    name: record.name,
    rarity: record.rarity || 3,
    itemType: record.itemType,
    time: record.time,
    gachaType,
  }));
}

export function detectWuwaJsonSource(obj) {
  if (Array.isArray(obj?.pulls) && (obj.siteVersion || obj.playerId || obj.version)) return 'WuWa Tracker';
  if (obj?.type === 'gacha-tracker-wuwa') return 'Convene';
  return 'Wuthering Waves';
}

export function groupWuwaJson(obj) {
  if (obj?.banners && typeof obj.banners === 'object') return obj.banners;
  if (obj?.wuwa && typeof obj.wuwa === 'object') return obj.wuwa;
  const pulls = Array.isArray(obj)
    ? obj
    : Array.isArray(obj?.pulls)
    ? obj.pulls
    : Array.isArray(obj?.list)
    ? obj.list
    : null;
  if (!pulls) return null;

  const grouped = {};
  for (const pull of pulls) {
    const key = String(pull.cardPoolType ?? pull.bannerType ?? pull.gachaType ?? pull.pool ?? pull.poolId ?? '1');
    (grouped[key] = grouped[key] || []).push(pull);
  }
  return grouped;
}

export function normalizeWuwaFilePull(entry, poolKey = '') {
  const rarity = Number(entry.rarity ?? entry.qualityLevel ?? entry.quality ?? entry.star ?? 3);
  const resourceId = text(entry.resourceId ?? entry.resourceID ?? '');
  let itemType = text(entry.itemType || entry.resourceType || '');
  if (!itemType) {
    const numericResourceId = Number(resourceId);
    itemType = WUWA_WEAPON_POOLS.has(String(poolKey)) || numericResourceId >= 20000000 ? 'Weapon' : 'Resonator';
  }
  return {
    resourceId,
    name: entry.name || entry.resourceName || '',
    rarity: rarity >= 3 && rarity <= 5 ? rarity : 3,
    itemType,
    time: normalizeExportTime(entry.time || entry.timestamp || ''),
    group: finiteNumber(entry.group ?? entry.drawNumber ?? entry.order),
  };
}

export function sortWuwaFilePulls(pulls) {
  return pulls.slice().sort((a, b) => {
    if (a.time !== b.time) return a.time < b.time ? -1 : 1;
    if (a.group != null && b.group != null && a.group !== b.group) return a.group - b.group;
    return 0;
  });
}

export function normalizeExportTime(value) {
  if (!value) return '';
  return String(value).replace('T', ' ').replace(/(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/, '').trim();
}
