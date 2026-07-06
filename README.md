# Bartleby Software

A personal, local-first suite of small web apps. Each "app" is a self-contained
module; a lightweight shell switches between them from the sidebar.

Live apps:

- **Workout** — 4-day upper/lower program tracker with a muscle-map modal
  (tap an exercise to set its working weight) and a bodyweight trend chart.
- **Finance** — expense tracker: log spending by category (add/delete your own
  categories) with a calendar date picker and notes, a filterable history with
  tap-to-view details, and Insights (category donut + jump-to-any month/year +
  12-month trend).

All data is stored locally in your browser (`localStorage`). Nothing is sent
anywhere. Use **Settings → Export Backup** to save a `.json` file before
switching devices, and **Import Backup** to restore it.

---

## Project structure

```
Bartleby Software/
├── index.html               # the shell (loads the apps)
├── assets/
│   ├── css/
│   │   ├── tokens.css        # design system: colors, fonts, reset, shared bits
│   │   └── shell.css         # sidebar / app-switcher layout
│   └── js/
│       ├── shell.js          # app registry + router
│       ├── storage.js        # localStorage helpers
│       └── ui.js             # toast helper
├── apps/
│   ├── workout/              # workout app  (data.js + index.js + workout.css)
│   └── finance/              # finance scaffold
├── .github/workflows/deploy.yml   # auto-deploy to GitHub Pages on every push
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

The apps use ES modules, so they need to be served over `http://` (not opened
as a `file://` path). Any static server works, e.g.:

```
npx serve .
```

Then open the printed URL (e.g. http://localhost:3000).

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
