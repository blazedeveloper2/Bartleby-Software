# Archive

Apps parked here are kept intact but not loaded by the shell. Nothing in this
folder is imported, fetched, or shipped to the browser.

## Scripture (archived 2026-08-31)

The full app plus its generated data, moved here unchanged:

- `apps/scripture/` — `index.js` + `bible.js` + `scripture.css`
- `assets/data/kjv/` — 66 books of KJV text (~4 MB)
- `assets/data/commentary/` — patristic commentary, one file per chapter (~100 MB)

The folder layout mirrors the repo root on purpose: `bible.js` resolves its
data with a relative `../../assets/data` path, so the pieces still line up
with each other in here.

Saved verses and notes (`sc_` localStorage keys) are untouched in the
browser — they just aren't shown, and drop out of Settings backups until the
app is restored.

### To restore

1. Move `archive/apps/scripture` back to `apps/scripture`.
2. Move `archive/assets/data` back to `assets/data`.
3. In `assets/js/shell.js`: re-add
   `import scripture from '../../apps/scripture/index.js';` and put
   `scripture` back in the `APPS` array.
4. Restore the Scripture entries in the root `README.md` and `manifest.json`
   description if you care to.
