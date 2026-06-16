PORTRAITS / ICONS
=================

By DEFAULT the tracker fetches portraits straight from the game wikis — no setup and
no downloads. Each pull's name is turned into the wiki's image URL automatically:

  Genshin  -> static.wikia.nocookie.net/genshin-impact/...
  WuWa     -> static.wikia.nocookie.net/wutheringwaves/...

Anything the wiki doesn't have (e.g. a brand-new unit not uploaded yet) simply shows a
rarity-colored monogram tile, so the layout never breaks.

USING YOUR OWN LOCAL FILES (optional)
  Drop images here and they're used too (and can override the wiki — see config order):
    icons/genshin/   icons/wuwa/
  Filenames are matched in this order (spaces become underscores):
    <Name>_Icon.png      e.g. Neuvillette_Icon.png    (characters / resonators)
    Weapon_<Name>.png    e.g. Weapon_Static_Mist.png  (weapons)
    <Name>.png  /  <slug>.png
  This is the same naming the wikis use, so a Drive/wiki download drops straight in.
  PNG/WEBP/JPG, square images look best.

SOURCE ORDER (js/config.js)
  ICON_SOURCES lists sources per game, tried in order. Defaults to wiki, then local:
    genshin: [{ wiki: 'genshin-impact' }, { base: 'icons/genshin' }],
    wuwa:    [{ wiki: 'wutheringwaves' }, { base: 'icons/wuwa' }],
  - Prefer your own files? Put the { base: ... } entry first.
  - Offline / wiki off? Delete the { wiki: ... } entry.
  - Remote host? Use a URL as the base, e.g.
      { base: 'https://raw.githubusercontent.com/<user>/<repo>/main/icons' }

OPTIONAL: EXACT MATCHING FOR A LOCAL FOLDER
  After adding local files, run once from the project root:
      node tools/build-icon-manifest.mjs
  It writes icons/<game>/manifest.json (name -> exact file, skins skipped).

WUWA ICON DOWNLOADS (if you want them local)
  Wuthering Waves Fandom Wiki:
    https://wutheringwaves.fandom.com/wiki/Category:Playable_Resonator_Icons
    https://wutheringwaves.fandom.com/wiki/Category:Weapon_Icons
  GitHub mirrors: github.com/ryanbenson/wuthering-waves-assets

NOTE ON ART
  Official Genshin / Wuthering Waves art is owned by HoYoverse / Kuro Games.
  Wiki images are hotlinked for personal use; use only images you have the right to use.
