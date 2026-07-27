# Bartleby Software

A personal, local-first suite of small web apps. Each "app" is a self-contained
module; a lightweight shell switches between them from the sidebar.

Live apps:

- **Workout** — 4-day upper/lower program tracker with a muscle-map modal
  (tap an exercise to set its working weight), a bodyweight trend chart, and a
  **Rank** tab: a letter grade (F→SS) computed from your working weights
  against published population strength standards relative to your bodyweight,
  plus streaks, a consistency heatmap, milestones and a daily verse.
- **Finance** — expense tracker: log spending by category (add/delete your own
  categories) with a calendar date picker and notes, a filterable history with
  tap-to-view details, and Insights (category donut + jump-to-any month/year +
  12-month trend).

**Settings** (gear, bottom of the sidebar) holds the theme picker, the
pull-up-bar toggle, and backup.

All data is stored locally in your browser (`localStorage`). Nothing is sent
anywhere. Use **Settings → Export Backup** to save a `.json` file before
switching devices, and **Import Backup** to restore it. Backups cover every
`bp_` (workout), `fin_` (finance) and `bs_` (suite settings, e.g. theme) key.

## Themes

`Arcade` (orange game-HUD, animated) is the default; `Midnight` is the original
still blue-grey. A theme is one block of CSS variables plus an optional
animation set — see `assets/css/themes.css` and `assets/js/theme.js`.

---

## Project structure

```
Bartleby Software/
├── index.html               # the shell (loads the apps)
├── assets/
│   ├── css/
│   │   ├── tokens.css        # theme-independent tokens + reset + shared bits
│   │   ├── themes.css        # one palette block per theme + arcade animations
│   │   └── shell.css         # sidebar / app-switcher / settings layout
│   └── js/
│       ├── shell.js          # app registry + router + settings/backup
│       ├── theme.js          # theme registry, get/set/apply
│       ├── storage.js        # localStorage helpers
│       └── ui.js             # toast helper
├── apps/
│   ├── workout/              # index.js + data.js + rank.js + standards.js + workout.css
│   └── finance/              # expense tracker
├── .github/workflows/deploy.yml   # auto-deploy to GitHub Pages on every push
├── start.bat                 # one-click: run locally (double-click this)
├── sync.bat                  # one-click: commit + push
└── README.md
```

### Adding a new app

1. Create `apps/<name>/index.js` that default-exports:
   `{ id, name, icon, styles, mount(root), unmount() }`.
2. Add its CSS at `apps/<name>/<name>.css`.
3. Import it in `assets/js/shell.js` and add it to the `APPS` array.

That's it — it shows up as a tab automatically.

---

## Running locally

**Double-click `start.bat`.** It serves the folder and opens your browser.
Leave the console window open while you use the app.

Do **not** open `index.html` directly — the apps use ES modules, which browsers
refuse to load from a `file://` path, so you'd get a blank page. Any static
server works if you'd rather do it by hand:

```
npx serve .
```

Note that each origin has its own `localStorage`: data you enter on
`localhost` is separate from data on the published GitHub Pages site. Use
Export/Import to move between them.

---

## Publishing online (GitHub Pages)

A one-time setup, then it auto-deploys forever.

**1. Create the repo** (on <https://github.com/new>): name it `bartleby-software`,
keep it Public (Pages is free for public repos), and **don't** add a README —
this folder already has one.

**2. Connect this folder and push** (run once, in this folder):

```
git remote add origin https://github.com/<your-username>/bartleby-software.git
git branch -M main
git push -u origin main
```

**3. Turn on Pages:** repo → **Settings → Pages → Build and deployment →
Source: GitHub Actions**. The included workflow does the rest.

Your site goes live at:
`https://<your-username>.github.io/bartleby-software/`

### Syncing changes after that

Just double-click **`sync.bat`** whenever you want to save + publish. It commits
everything and pushes; GitHub rebuilds the site in ~1 minute.
