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

- **`index.html`** — Entry HTML. References `styles.css` and `src/main.js`. Contains the full DOM structure: sidebar navigation, 9 game panels, and the records panel.
- **`styles.css`** — All CSS. CSS custom properties for theming (`--bg`, `--ink`, `--brand`, `--accent`, etc.). Grid-based app shell layout, panel cards with backdrop blur, responsive sidebar-as-drawer.
- **`src/main.js`** — ES Module entry point. Imports all core and game modules, runs the `boot()` sequence.

### Module structure (`src/`)

```
src/
├── main.js                   # Entry: imports all modules, boot() sequence
├── core/
│   ├── constants.js          # STORAGE_KEY, MAX_RECORDS, PANEL_IDS, etc.
│   ├── state.js              # state object, refs object, $ helper
│   ├── utils.js              # Pure functions: shuffle, formatDuration, setStatus, etc.
│   ├── persistence.js        # Tauri/localStorage dual-backend persistence
│   ├── records.js            # Record rendering, addRecord, import/export
│   └── ui-shell.js           # Sidebar, panel routing, custom selects, viewport sync
└── games/
    ├── schulte.js            # Schulte grid
    ├── tback.js              # T-Back
    ├── stroop.js             # Stroop
    ├── gonogo.js             # Go/No-Go
    ├── antisaccade.js        # Anti-saccade
    ├── focus.js              # Focus/gaze + fullscreen + Troxler grid
    ├── reaction.js           # Reaction time
    ├── sustained.js          # Sustained attention
    └── breath.js             # Breath rhythm
```

Each game module exports a single `init<Game>()` function and imports `state`/`refs` from `core/state.js` and utilities from `core/utils.js`.

### JavaScript architecture

- **State management**: A nested `state` object (in `core/state.js`) holds all mutable state for the 9 training games plus `ui.activePanelId`.
- **DOM references**: Collected in a `refs` object (in `core/state.js`) via `$` shorthand for `document.getElementById`.
- **Panel routing**: Hash-based navigation drives which training panel is visible. `switchTrainingPanel()` in `core/ui-shell.js` handles transitions and blocks switches while a session is active.
- **Sidebar**: Adaptive layout — sticky side rail at wide viewports, slide-out drawer at narrow viewports.
- **Focus fullscreen**: `focus.js` exports `isFocusFullscreenActive` and `exitFocusFullscreen`, which are wired into `ui-shell.js` via `setFocusFullscreenCallbacks()` during boot.

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

### UI components

- **Custom select dropdowns**: `initCustomSelects()` (called during init) wraps every native `<select>` element in a `.custom-select` container with a styled trigger button and dropdown menu. The native `<select>` is visually hidden (`opacity: 0`) but kept in the DOM so form state and change events continue to work. Keyboard navigation (ArrowDown/ArrowUp, Enter, Escape) and ARIA attributes are fully supported.

### Special rendering behaviors

- **Focus stage pseudo-fullscreen**: The antisaccade / focus training stage (`refs.focusStage`) can enter a pseudo-fullscreen mode. When activated, the element is **reparented to `document.body`** via a comment-node placeholder system (`focusStagePlaceholder`). This allows the stage to break out of its panel's stacking context and cover the full viewport. On deactivation, the placeholder is replaced and the element returns to its original parent.

### Initialization (`src/main.js` boot sequence)

`initViewportHeightSync()` → `initPersistence()` → `loadRecords()` → `loadAndApplyPreferences()` → `renderStats()` / `renderRecords()` → `initSidebar()` → `setFocusFullscreenCallbacks()` → all 9 `init<Game>()` calls → `initRecordsActions()` → `initModuleSettings()` → `initCustomSelects()` → `initPanelScrollStates()` → `initPanelSwitcher()`

### Legacy file

`brain-training-camp.html` is the original ~5,600-line monolithic version with embedded CSS and JS. It is still functional standalone but no longer the primary development target.
