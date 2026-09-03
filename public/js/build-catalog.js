// Current Genshin Impact combat roster used by Convene Builds (Version 7.0).
// The catalog is intentionally metadata-light: build details are refreshed through
// /api/build-guide, while this file keeps the selector fast and ownership matching stable.

const FIVE_STAR_GUIDE_NAMES = [
  'Albedo','Alhaitham','Aloy','Arlecchino','Ayaka','Ayato','Baizhu','Chasca','Childe','Chiori','Citlali','Clorinde','Columbina','Cyno','Dehya','Diluc','Durin','Emilie','Escoffier','Eula','Flins','Furina','Ganyu','Hu Tao','Ineffa','Itto','Jean','Kazuha','Keqing','Kinich','Klee','Kokomi','Lauma','Linnea','Lohen','Lyney','Mavuika','Mona','Mualani','Nahida','Navia','Nefer','Neuvillette','Nicole','Nilou','Odette','Qiqi','Raiden','Sandrone','Shenhe','Sigewinne','Skirk','Tighnari','Traveler (Anemo)','Traveler (Dendro)','Traveler (Electro)','Traveler (Geo)','Traveler (Hydro)','Traveler (Pyro)','Traveler (Cryo)','Varesa','Varka','Venti','Wanderer','Wriothesley','Xianyun','Xiao','Xilonen','Yae Miko','Yelan','Yoimiya','Yumemizuki Mizuki','Zhongli','Zibai',
];

const FOUR_STAR_GUIDE_NAMES = [
  'Aino','Alyosha','Amber','Barbara','Beidou','Bennett','Candace','Charlotte','Chevreuse','Chongyun','Collei','Dahlia','Diona','Dori','Faruzan','Fischl','Freminet','Gaming','Gorou','Heizou','Iansan','Ifa','Illuga','Jahoda','Kachina','Kaeya','Kaveh','Kirara','Kuki Shinobu','Lan Yan','Layla','Lisa','Lynette','Mika','Ningguang','Noelle','Ororon','Prune','Razor','Rosaria','Sara','Sayu','Sethos','Sucrose','Thoma','Xiangling','Xingqiu','Xinyan','Yanfei','Yaoyao','Yun Jin',
];

const OFFICIAL_NAME = {
  Ayaka: 'Kamisato Ayaka',
  Ayato: 'Kamisato Ayato',
  Childe: 'Tartaglia',
  Itto: 'Arataki Itto',
  Kazuha: 'Kaedehara Kazuha',
  Kokomi: 'Sangonomiya Kokomi',
  Raiden: 'Raiden Shogun',
  Heizou: 'Shikanoin Heizou',
  Sara: 'Kujou Sara',
  'Traveler (Cryo)': 'Cryo Traveler',
};

const TEAM_SLUG = {
  'Traveler (Anemo)': 'traveler_anemo',
  'Traveler (Dendro)': 'traveler_dendro',
  'Traveler (Electro)': 'traveler_electro',
  'Traveler (Geo)': 'traveler_geo',
  'Traveler (Hydro)': 'traveler_hydro',
  'Traveler (Pyro)': 'traveler_pyro',
  'Traveler (Cryo)': 'traveler_cryo',
};


const GCSIM_KEY = {
  Itto: 'aratakiitto',
  Ayaka: 'kamisatoayaka',
  Ayato: 'kamisatoayato',
  Childe: 'tartaglia',
  Kazuha: 'kaedeharakazuha',
  Kokomi: 'sangonomiyakokomi',
  Raiden: 'raidenshogun',
  Sara: 'kujousara',
  Heizou: 'shikanoinheizou',
  'Yumemizuki Mizuki': 'yumemizukimizuki',
  'Kuki Shinobu': 'kukishinobu',
  'Traveler (Anemo)': 'traveler-anemo',
  'Traveler (Dendro)': 'traveler-dendro',
  'Traveler (Electro)': 'traveler-electro',
  'Traveler (Geo)': 'traveler-geo',
  'Traveler (Hydro)': 'traveler-hydro',
  'Traveler (Pyro)': 'traveler-pyro',
  'Traveler (Cryo)': 'traveler-cryo',
};

function gcsimKeysFor(guideName) {
  const explicit = GCSIM_KEY[guideName] || simpleSlug(guideName);
  if (!explicit.startsWith('traveler-')) return [explicit];
  const element = explicit.split('-')[1];
  return [`aether${element}`, `lumine${element}`];
}

const GG_SLUG = {
  'Traveler (Anemo)': 'traveler%28anemo%29',
  'Traveler (Dendro)': 'traveler%28dendro%29',
  'Traveler (Electro)': 'traveler%28electro%29',
  'Traveler (Geo)': 'traveler%28geo%29',
  'Traveler (Hydro)': 'traveler%28hydro%29',
  'Traveler (Pyro)': 'traveler%28pyro%29',
  // Genshin.gg did not expose Cryo Traveler on its 7.0 build index at the time of this snapshot.
  'Traveler (Cryo)': 'traveler%28cryo%29',
};

function simpleSlug(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function teamSlug(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function entry(guideName, rarity) {
  const name = OFFICIAL_NAME[guideName] || guideName;
  return {
    id: teamSlug(name),
    name,
    guideName,
    rarity,
    ggSlug: GG_SLUG[guideName] || simpleSlug(guideName),
    teamSlug: TEAM_SLUG[guideName] || teamSlug(guideName),
    gcsimKeys: gcsimKeysFor(guideName),
  };
}

export const GENSHIN_BUILD_CATALOG = [
  ...FIVE_STAR_GUIDE_NAMES.map((name) => entry(name, 5)),
  ...FOUR_STAR_GUIDE_NAMES.map((name) => entry(name, 4)),
].sort((a, b) => a.name.localeCompare(b.name));

const BY_ID = new Map(GENSHIN_BUILD_CATALOG.map((item) => [item.id, item]));
const BY_CANONICAL = new Map(GENSHIN_BUILD_CATALOG.map((item) => [item.name.toLowerCase(), item]));
const BY_GUIDE = new Map(GENSHIN_BUILD_CATALOG.map((item) => [item.guideName.toLowerCase(), item]));
const BY_GCSIM = new Map();
for (const item of GENSHIN_BUILD_CATALOG) {
  for (const key of item.gcsimKeys || []) BY_GCSIM.set(String(key).toLowerCase(), item);
}

const EXTRA_ALIASES = new Map([
  ['ayaka', 'Kamisato Ayaka'],
  ['ayato', 'Kamisato Ayato'],
  ['childe', 'Tartaglia'],
  ['tartaglia', 'Tartaglia'],
  ['itto', 'Arataki Itto'],
  ['kazuha', 'Kaedehara Kazuha'],
  ['kokomi', 'Sangonomiya Kokomi'],
  ['raiden', 'Raiden Shogun'],
  ['heizou', 'Shikanoin Heizou'],
  ['sara', 'Kujou Sara'],
  ['cryo traveler', 'Cryo Traveler'],
  ['traveler (cryo)', 'Cryo Traveler'],
  ['traveler cryo', 'Cryo Traveler'],
  ['traveler (anemo)', 'Traveler (Anemo)'],
  ['traveler (dendro)', 'Traveler (Dendro)'],
  ['traveler (electro)', 'Traveler (Electro)'],
  ['traveler (geo)', 'Traveler (Geo)'],
  ['traveler (hydro)', 'Traveler (Hydro)'],
  ['traveler (pyro)', 'Traveler (Pyro)'],
]);

export function canonicalCharacterName(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const key = raw.toLowerCase();
  if (EXTRA_ALIASES.has(key)) return EXTRA_ALIASES.get(key);
  if (BY_CANONICAL.has(key)) return BY_CANONICAL.get(key).name;
  if (BY_GUIDE.has(key)) return BY_GUIDE.get(key).name;
  if (BY_GCSIM.has(key)) return BY_GCSIM.get(key).name;
  return raw;
}

export function getCatalogCharacter(idOrName) {
  const raw = String(idOrName || '').trim();
  if (BY_ID.has(raw)) return BY_ID.get(raw);
  const canonical = canonicalCharacterName(raw).toLowerCase();
  return BY_CANONICAL.get(canonical) || GENSHIN_BUILD_CATALOG.find((item) => item.name === 'Odette') || GENSHIN_BUILD_CATALOG[0];
}

export function guideQuery(entryValue) {
  const item = typeof entryValue === 'string' ? getCatalogCharacter(entryValue) : entryValue;
  return new URLSearchParams({
    id: item.id,
    name: item.name,
    guideName: item.guideName,
    ggSlug: item.ggSlug,
    teamSlug: item.teamSlug,
    rarity: String(item.rarity),
  }).toString();
}


export function simQuery(entryValue) {
  const item = typeof entryValue === 'string' ? getCatalogCharacter(entryValue) : entryValue;
  return new URLSearchParams({
    id: item.id,
    name: item.name,
    rarity: String(item.rarity),
    gcsimKeys: (item.gcsimKeys || []).join(','),
  }).toString();
}
