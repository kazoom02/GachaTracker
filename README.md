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

---

## Backups & file import/export

Open **Data** to manage your saved pulls. You can **drag a file anywhere onto the page**
to import it, or use the drop zone / file picker in the panel.

| File | Game | Notes |
| --- | --- | --- |
| `.xlsx` | Genshin Impact | Per-banner sheets (paimon.moe-style), columns `Type, Name, Time, Rarity, Pity`. |
| `.json` | Wuthering Waves | Reads **wuwatracker** exports directly (the `pulls` array), plus our own format. |
| `.json` (full backup) | Both | One file holding everything; restoring it replaces all stored data. |

- **Exports:** *Export Genshin* → `.xlsx`, *Export Wuthering Waves* → `.json`, *Everything* → a full backup `.json`.
- **A file is a full snapshot.** Importing one replaces the stored data for the banners/pools it
  contains (other banners are left alone). Re-importing the same file is therefore safe and
  idempotent. The **live URL import** is the incremental path that tops up with new pulls.
- **Wuthering Waves pools:** Kuro numbers convene pools `1`–`4` for the four main banners and
  `10` / `11` for the beginner & selector banners. Pulls are keyed by their real pool number, so
  every banner shows up and live + file imports always land in the same bucket.
- **Importing a real paimon.moe export:** supported. Our own `.xlsx` stores an explicit `Rarity`
  column so it round-trips exactly. A foreign paimon file has no rarity column, so 5★ are
  recovered from the `Pity` column (which resets after each 5★); 4★ may not be distinguished in
  that case. Re-export from this tool afterward for clean data.

## Character & weapon portraits

Portraits load **automatically from the game wikis** — no setup, no downloads. Each pull's
name is converted to its Fandom image URL client-side (Genshin →
`static.wikia.nocookie.net/genshin-impact/…`, WuWa → `…/wutheringwaves/…`). Anything the
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
