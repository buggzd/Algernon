# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Algernon** — a zero-dependency brain training web app with 9 training games. Built with **Vite + Tauri v2** — runs in the browser (`npm run dev`) or as a native desktop app (`npm run tauri dev`).

A legacy single-file version also exists at `brain-training-camp.html` (self-contained, open directly in browser).

## Commands

```bash
npm run dev          # Start Vite dev server (port 1420), open in browser
npm run build        # Production build to dist/
npm run tauri dev    # Run as native Tauri desktop app (dev mode)
npm run tauri build  # Build native Tauri desktop app
```

No lint or test commands exist.

## Architecture

The app is split across three source files:

- **`index.html`** (~707 lines) — Entry HTML. References `styles.css` and `app.js` as external files. Contains the full DOM structure: sidebar navigation, 9 game panels, and the records panel.
- **`styles.css`** (~1,757 lines) — All CSS extracted from the original monolithic HTML. CSS custom properties for theming (`--bg`, `--ink`, `--brand`, `--accent`, etc.). Grid-based app shell layout, panel cards with backdrop blur, responsive sidebar-as-drawer.
- **`app.js`** (~3,395 lines) — A single IIFE `(function () { ... })();` containing all app logic. Loaded as `<script type="module">`.

### JavaScript architecture

- **State management**: A nested `state` object holds all mutable state for the 9 training games (schulte, tback, stroop, gonogo, antisaccade, focus, reaction, sustained, breath) plus a `ui.activePanelId` field.
- **DOM references**: Collected in a `refs` object via `$` shorthand for `document.getElementById`.
- **Panel routing**: Hash-based navigation (`#schulte-card`, `#tback-card`, etc.) drives which training panel is visible. `switchTrainingPanel()` handles transitions and blocks switches while a session is active.
- **Sidebar**: Adaptive layout — sticky side rail at wide viewports, slide-out drawer at narrow viewports. Controlled via `setSidebarOpen()` / `closeSidebar()`.

### Game panel pattern

Each of the 9 training games follows the same pattern:

1. `init<Game>()` — binds DOM event listeners for the game's controls
2. `start<Game>()` — initializes game state, starts timers, renders the active UI
3. `finish<Game>()` — stops timers, computes results, saves a record, re-renders stats
4. Some games also have `render<Game>()` for updating the board between trials

### Persistence (dual-backend)

- **Browser mode**: Records stored in `localStorage` under key `"brainTrainingCampRecords"` (max 120 records).
- **Tauri/native mode**: Records stored as `records.json` in the app's local data directory (`appLocalDataDir()`). On first run, migrates from localStorage automatically. Uses `@tauri-apps/plugin-fs` for file I/O and `@tauri-apps/plugin-dialog` for save/open dialogs.
- **Preferences**: Also persisted to `preferences.json` in Tauri mode.
- `loadRecords()` / `saveRecords()` delegate to the appropriate backend via `initPersistence()`.
- Export/import as JSON file and clear-all are supported via buttons wired in `initRecordsActions()`.

### Tauri backend

- **`src-tauri/src/main.rs`** — Entry point, calls `lib::run()`.
- **`src-tauri/src/lib.rs`** — Registers `tauri-plugin-fs` and `tauri-plugin-dialog` plugins.
- **`src-tauri/capabilities/default.json`** — Permissions: core defaults + FS read/write/exists + dialog save/open.

### Initialization (bottom of app.js)

`initPersistence()` → `loadRecords()` → `renderStats()` / `renderRecords()` → `initSidebar()` → all 9 `init<Game>()` calls → `initRecordsActions()` → `initPanelSwitcher()`

### Legacy file

`brain-training-camp.html` is the original ~5,600-line monolithic version with embedded CSS and JS. It is still functional standalone but no longer the primary development target.
