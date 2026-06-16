import fs from 'fs/promises';
import path from 'path';

const API = 'https://wutheringwaves.fandom.com/api.php';

async function api(params) {
  const url = new URL(API);

  Object.entries(params).forEach(([k, v]) =>
    url.searchParams.set(k, v)
  );

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }

  return res.json();
}

async function getCategoryMembers(category) {
  const pages = [];
  let cmcontinue;

  do {
    const data = await api({
      action: 'query',
      format: 'json',
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

async function getPageImage(title) {
  const data = await api({
    action: 'query',
    format: 'json',
    prop: 'pageimages',
    piprop: 'name',
    titles: title,
  });

  const page = Object.values(data.query.pages)[0];

  return page?.pageimage ?? null;
}

async function buildManifest() {
  const manifest = {};

  const categories = [
    'Resonators',
    'Weapons',
  ];

  for (const category of categories) {
    console.log(`Fetching ${category}...`);

    const pages = await getCategoryMembers(category);

    for (const page of pages) {
      const title = page.title;

      try {
        const image = await getPageImage(title);

        if (!image) {
          console.warn(`No image: ${title}`);
          continue;
        }

        manifest[title] = image;

        console.log(`${title} -> ${image}`);
      } catch (err) {
        console.warn(`Failed: ${title}`, err.message);
      }

      await new Promise(r => setTimeout(r, 100));
    }
  }

  return manifest;
}

async function main() {
  const manifest = await buildManifest();

  const outDir = path.resolve('icons/wuwa');

  await fs.mkdir(outDir, { recursive: true });

  const outFile = path.join(outDir, 'manifest.json');

  await fs.writeFile(
    outFile,
    JSON.stringify(
      Object.fromEntries(
        Object.entries(manifest)
          .sort(([a], [b]) => a.localeCompare(b))
      ),
      null,
      2
    )
  );

  console.log(
    `\nWrote ${Object.keys(manifest).length} entries to ${outFile}`
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});