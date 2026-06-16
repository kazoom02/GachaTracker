import fs from 'fs/promises';
import path from 'path';

const API = 'https://wutheringwaves.fandom.com/api.php';

// ── Tunables ────────────────────────────────────────────────────────────────
const BATCH_SIZE  = 50;   // MediaWiki accepts up to 50 titles per pageimages call
const CONCURRENCY = 5;    // simultaneous in-flight requests
const MAX_RETRIES = 3;    // attempts before giving up on a batch
const RETRY_DELAY = 800;  // ms base delay, doubled each retry

// ── Core helpers ─────────────────────────────────────────────────────────────
async function api(params) {
  const url = new URL(API);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.json();
}

/** Fetch all pages from a category, following continuation tokens. */
async function getCategoryMembers(category) {
  const pages = [];
  let cmcontinue;
  do {
    const data = await api({
      action: 'query', format: 'json',
      list: 'categorymembers',
      cmtitle: `Category:${category}`,
      cmlimit: '500',
      ...(cmcontinue ? { cmcontinue } : {}),
    });
    pages.push(...data.query.categorymembers);
    cmcontinue = data.continue?.cmcontinue;
  } while (cmcontinue);
  return pages;
}

/** Fetch pageimage names for up to 50 titles in one API call, with retries. */
async function getPageImagesBatch(titles) {
  let attempt = 0;
  while (true) {
    try {
      const data = await api({
        action: 'query', format: 'json',
        prop: 'pageimages', piprop: 'name',
        titles: titles.join('|'),
      });
      // Build a normalisation map (wiki may redirect/capitalise titles)
      const norm = {};
      (data.query.normalized ?? []).forEach(n => (norm[n.from] = n.to));
      const pages = Object.values(data.query.pages);
      const result = {};
      for (const title of titles) {
        const canonical = norm[title] ?? title;
        const page = pages.find(p => p.title === canonical);
        if (page?.pageimage) result[title] = page.pageimage;
      }
      return result;
    } catch (err) {
      attempt++;
      if (attempt > MAX_RETRIES) throw err;
      const delay = RETRY_DELAY * 2 ** (attempt - 1);
      console.warn(`  Batch failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms — ${err.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ── Concurrency pool ──────────────────────────────────────────────────────────
/** Run an array of async thunks with at most `limit` running at once. */
async function pool(tasks, limit) {
  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function buildManifest() {
  const categories = ['Resonators', 'Weapons'];
  let allTitles = [];

  for (const cat of categories) {
    console.log(`Fetching category: ${cat}…`);
    const pages = await getCategoryMembers(cat);
    console.log(`  ${pages.length} pages found`);
    allTitles.push(...pages.map(p => p.title));
  }

  // Deduplicate (a title can appear in multiple categories)
  allTitles = [...new Set(allTitles)];
  console.log(`\nTotal unique titles: ${allTitles.length}`);

  // Slice into batches
  const batches = [];
  for (let i = 0; i < allTitles.length; i += BATCH_SIZE) {
    batches.push(allTitles.slice(i, i + BATCH_SIZE));
  }
  console.log(`Fetching images in ${batches.length} batch(es) × up to ${BATCH_SIZE} titles, concurrency ${CONCURRENCY}…\n`);

  let done = 0;
  const tasks = batches.map((batch, idx) => async () => {
    try {
      const result = await getPageImagesBatch(batch);
      done++;
      process.stdout.write(`  [${done}/${batches.length}] batch ${idx + 1} — ${Object.keys(result).length}/${batch.length} images found\n`);
      return result;
    } catch (err) {
      console.warn(`  Batch ${idx + 1} failed permanently: ${err.message}`);
      return {};
    }
  });

  const batchResults = await pool(tasks, CONCURRENCY);

  const manifest = {};
  for (const map of batchResults) Object.assign(manifest, map);

  const missing = allTitles.length - Object.keys(manifest).length;
  if (missing > 0) console.warn(`\n⚠  No image found for ${missing} title(s).`);

  return manifest;
}

async function main() {
  const manifest = await buildManifest();

  const outDir  = path.resolve('icons/wuwa');
  await fs.mkdir(outDir, { recursive: true });

  const outFile = path.join(outDir, 'manifest.json');
  await fs.writeFile(
    outFile,
    JSON.stringify(
      Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))),
      null, 2,
    ),
  );

  console.log(`\n✓ Wrote ${Object.keys(manifest).length} entries to ${outFile}`);
}

main().catch(err => { console.error(err); process.exit(1); });
