# Convene — Genshin Impact + Wuthering Waves pull tracker

A self-hosted clone of paimon.moe (Genshin) and wuwatracker (Wuthering Waves), both in
one site. Paste your in-game history link and it shows each banner separately with the
**name of every 5★ and how many pulls it took** (its pity). Imports read **only new
pulls** — your existing history is never re-read or duplicated.

Your pull data is stored **in your browser**. You can back it up to your **computer** or
to **Google Drive** at any time.

---

## Why it needs Vercel (and can't be a plain HTML file)

The browser cannot call HoYoverse's or Kuro Games' APIs directly — those servers don't
send CORS headers, so the request is blocked. paimon.moe and wuwatracker solve this with
their own backend. This project does the same with two tiny **Vercel Functions** that
forward your request to the official game server and pass the answer back. They store and
log nothing.

```
public/                 ← the static site (HTML/CSS/JS)
api/
   genshin.js           ← forwards one getGachaLog page to HoYoverse
   wuwa.js              ← forwards one convene query to Kuro Games
vercel.json             ← tells Vercel where everything lives
```

---

## Deploy to Vercel

**Option A — Git (recommended)**
1. Push this folder to a GitHub repo.
2. Go to <https://vercel.com/new> and import the repo.
3. Leave all build settings at their defaults — `vercel.json` handles everything.

**Option B — CLI**
```bash
npm install -g vercel
vercel --prod
```

**Run it locally**
```bash
npm install -g vercel
vercel dev
```
Open the URL it prints (usually <http://localhost:3000>). You need `vercel dev` rather
than opening `index.html` directly, because the `/api/*` forwarders must run.

---

## Getting your history link

You generate the link once per session using the scripts included in this repo.
Run the matching command in **PowerShell** (Windows) after opening the game's history
screen in-game.

**Genshin Impact** — open *Wish → History* in-game first, then:
```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\get-genshin-url.ps1"
```

**Wuthering Waves** — open *Convene → Convene History* in-game first, then:
```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\get-wuwa-url.ps1"
```

Each script finds the URL automatically, prints it, and copies it to your clipboard.
Pick the matching game tab on the site, paste, and click **Import new pulls**.

> The link contains a temporary access key (`authkey` / `record_id`) that expires after a
> day or so. Don't post it publicly. When it stops working, just re-run the script.

---

## How banners and pity are shown

**Genshin** — Character Event (types 301 + 400 merged), Weapon Event, Chronicled,
Standard, and Beginners'. Character/Standard/Chronicled use 90 hard pity; Weapon uses 80.

**Wuthering Waves** — Featured Resonator, Featured Weapon, Standard Resonator, Standard
Weapon, and the three Beginner banners. All use 80 hard pity (soft pity ~66).

Each banner card shows current pity, total pulls, 5★ / 4★ counts, average 5★ pity, and a
chip per 5★ with the character/weapon name and the pulls it took. Green = lucky (≤50),
red = late (≥75).

The highlight timeline shows every matching pull at once and can be ordered **newest first**
or **oldest first**, so the complete 4★ or 5★ history stays visible.

---

## Backups & file import/export

Open **Data** to manage your saved pulls. You can **drag a file anywhere onto the page**
to import it, or use the drop zone / file picker in the panel.

### Profiles

Use the profile switcher in the header for separate main and alt account histories. Existing
single-account browser data is migrated automatically into **My Account**. Link imports, file
imports, game exports, and clearing pulls affect only the selected profile. The **Everything**
JSON and Google Drive backup include every profile.

| File | Game | Notes |
| --- | --- | --- |
| `.xlsx` | Genshin Impact | Reads **paimon.moe v3** workbooks directly, including the `⭐` rarity and `#Roll` ordering columns, plus Convene exports. |
| `.json` | Wuthering Waves | Reads **WuWa Tracker** exports directly (the `pulls` array), including ten-pull group ordering, plus Convene exports. |
| `.json` (full backup) | Both | One file holding every profile and both games; restoring it replaces all profiles. |

- **Exports:** *Export Genshin* → `.xlsx`, *Export Wuthering Waves* → `.json`, *Everything* → a full backup `.json`.
- **A file is a full snapshot.** Importing one replaces the stored data for the banners/pools it
  contains (other banners are left alone). Re-importing the same file is therefore safe and
  idempotent. The **live URL import** is the incremental path that tops up with new pulls.
- **Wuthering Waves pools:** Kuro numbers convene pools `1`–`4` for the four main banners and
  `10` / `11` for the beginner & selector banners. Pulls are keyed by their real pool number, so
  every banner shows up and live + file imports always land in the same bucket.
- **Importing a real paimon.moe export:** supported. Current exports use `⭐` for rarity and
  `#Roll` for stable ordering; older files with a `Rarity` column also work. If neither rarity
  column exists, 5★ boundaries are recovered from pity resets as a compatibility fallback.

## Character & weapon portraits

Portraits load **automatically from the game wikis** — no setup, no downloads. Each pull's
name is converted to its Fandom image URL client-side (Genshin →
`static.wikia.nocookie.net/gensin-impact/…`, WuWa → `…/wutheringwaves/…`). Anything the
wiki doesn't have yet shows a rarity-colored monogram tile instead, so nothing breaks.

- **Want your own art instead?** Drop files into `public/icons/genshin/` or
  `public/icons/wuwa/` using the wiki naming (`Neuvillette_Icon.png`, `Weapon_Static_Mist.png`).
  They're matched the same way, so a Drive/wiki download drops straight in.
- **Source order** is configurable per game in `js/config.js` (`ICON_SOURCES`): it defaults
  to `[{ wiki }, { base: 'icons/...' }]`. Put your local folder first to prefer it, delete the
  `wiki` entry to go fully offline, or set `base` to a remote URL (e.g. a GitHub raw path).
- **Exact local matching (optional):** after adding files, run
  `node tools/build-icon-manifest.mjs` to generate `icons/<game>/manifest.json` (skips skins).

Note: Drive is used only for **backup/export-import**, not for images. Backups are
saved as a visible `gacha-tracker-data.json` file in the user's Drive. See
`public/icons/README.txt` for the full filename rules.

## Character builds

Open **Character builds** from the tracker header. The Builds area is currently **Genshin-only** and
opens on a full 125-character Version 7.0 roster grid from `public/js/build-catalog.js`. Characters
confirmed by the selected profile are shown normally; unconfirmed or manually unowned characters are
greyed out with a lock icon. Locked cards remain clickable so users can still inspect future-pull builds.

Most characters use a small server-side normalizer (`/api/build-guide`) so Convene can refresh current
weapon/artifact/stat ordering from Genshin.gg and ranked team guides from Genshin-Builds.com without
hard-coding 125 pages that immediately go stale. Responses are cached, and the browser keeps a recent
local copy so a temporary source outage does not erase a previously loaded guide. The six pre-Cryo
Traveler elements have explicit guide-backed team fallbacks because the current Team Lab does not have
dedicated pages for them.

**Odette remains a curated exception:** her compatible published DPS calculations stay in
`public/js/build-data.js`, so her numerical rankings are not replaced by a generic qualitative tier.

### Numerical theorycraft

Build pages also query the public **Simpact / gcsim** database through `/api/sim-teams`. When compatible
validated simulations exist, Convene shows the exact team DPS together with every character constellation,
weapon/refinement, artifact set, talent levels, target assumptions, iteration count, and a link to the exact
gcsim config. Numerical results are grouped by investment and methodology instead of blindly sorting every
public database number together:

- **KQMS-like**: Lv.100 / 10% RES target, at least 1000 iterations, at least 90 seconds mean duration, random
  execution delays, and the KQM-standard clear-particle energy line.
- **Comparable gcsim**: Lv.100 / 10% RES target, at least 1000 iterations and at least 60 seconds mean duration.
- **Validated gcsim**: accepted gcsim database entries that are useful evidence but may use a different standard.
- **F2P Gear**: all non-Traveler 5-stars at C0 and no 5-star weapons.
- **Budget Roster**: F2P Gear plus at most one non-focus 5-star teammate.
- **4★ Supports**: the focus character plus only 4-star/free support slots.
- **Low-Const 4★**: the same 4-star-support constraint, with every non-focus 4-star capped at C2.
- **Mid-Const 4★**: the same constraint, with every non-focus 4-star capped at C4.

The site preserves the exact 4-star constellation used by each simulation (for example Bennett C1, Xiangling
C4, Sucrose C6) and labels it as a **simulation assumption**, not an invented minimum requirement. The server
scans multiple DPS-sorted pages before applying F2P/4-star filters so lower-investment teams are less likely to
be crowded out by high-investment uploads. If no trustworthy numerical coverage exists for a character, the
multi-source guide/theorycraft ranking remains available and Convene does not fabricate DPS.

### Account optimizer

The page reads the active Convene profile and ranks **Best teams you can actually build** separately from
the unrestricted source ranking:

- Characters found in imported wish history are marked as seen, including the minimum constellation
  witnessed by saved copies (one copy = C0+, two = C1+, and so on).
- The optimizer only promotes a lineup when every listed member/constellation is verified. Locked high-rank
  teams show their exact blockers.
- **Roster corrections** are saved per profile. Use Auto, Not owned, or C0-C6 to fill gaps caused by old,
  free, or incomplete wish history. Traveler forms are treated as free C0 by default because Traveler never
  appears in wish history; higher Traveler constellations still need a correction when required.
- Gacha weapons found in history are marked too. Craftable, event, quest, and other non-gacha equipment
  may remain unknown.
- Missing wish-history records are always **Unknown**, never automatically “not owned.”

The live endpoints construct their own allow-listed source URLs; they do not accept arbitrary URLs from the
browser. Current build evidence comes from Genshin.gg, Genshin-Builds.com, KQM limited-roster guidance, and
Simpact/gcsim numerical simulations (with gcsim's own metadata files used to resolve exact names/rarities).

### Enable Google Drive (optional)
1. In [Google Cloud Console](https://console.cloud.google.com/): create a project.
2. *APIs & Services → Library* → enable **Google Drive API**.
3. *Credentials → Create credentials → OAuth client ID* → type **Web application**.
4. Under *Authorized JavaScript origins* add your site URL (e.g. `https://yoursite.netlify.app`
   and `http://localhost:8888` for local dev).
5. Copy the client ID into `public/js/config.js`:
   ```js
   export const GOOGLE_CLIENT_ID = 'xxxxxxxx.apps.googleusercontent.com';
   ```
6. Redeploy. The Drive buttons light up.

---

## Privacy & notes

- Pull data never leaves your browser except when **you** export/back it up.
- The forwarders only contact `*.hoyoverse.com` / `*.mihoyo.com` (Genshin) and
  `gmserver-api.aki-game2.net/.com` (Wuthering Waves). They don't log your keys.
- This is a fan tool and isn't affiliated with HoYoverse or Kuro Games.
