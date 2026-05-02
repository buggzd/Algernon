import { STORAGE_KEY, MAX_RECORDS, RECORDS_FILENAME, PREFS_FILENAME } from "./constants.js";
import { state } from "./state.js";

let appDataDir = null;
let isTauri = false;
let tauriModules = null;
var savePrefsTimer = null;

// ---- Tauri file-based persistence ----

async function initPersistence() {
  isTauri = !!(window.__TAURI__ || window.__TAURI_INTERNALS__);

  if (isTauri) {
    const path = await import("@tauri-apps/api/path");
    const fs = await import("@tauri-apps/plugin-fs");
    const dialog = await import("@tauri-apps/plugin-dialog");
    appDataDir = await path.appLocalDataDir();
    tauriModules = { path, fs, dialog };
  }
}

async function loadRecordsFile() {
  if (tauriModules) {
    try {
      const filePath = await tauriModules.path.join(appDataDir, RECORDS_FILENAME);
      const exists = await tauriModules.fs.exists(filePath);
      if (!exists) {
        // Migrate from localStorage on first run
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          await tauriModules.fs.writeTextFile(filePath, JSON.stringify(parsed, null, 2));
          localStorage.removeItem(STORAGE_KEY);
          return parsed;
        }
        return [];
      }
      const contents = await tauriModules.fs.readTextFile(filePath);
      return JSON.parse(contents);
    } catch (err) {
      console.warn("loadRecordsFile failed, falling back to localStorage:", err);
      return loadRecordsLocalStorage();
    }
  }
  return loadRecordsLocalStorage();
}

function loadRecordsLocalStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    // corrupted data
  }
  return [];
}

async function writeRecordsFile(records) {
  if (tauriModules) {
    try {
      const filePath = await tauriModules.path.join(appDataDir, RECORDS_FILENAME);
      await tauriModules.fs.writeTextFile(filePath, JSON.stringify(records, null, 2));
    } catch (err) {
      console.warn("writeRecordsFile failed, falling back to localStorage:", err);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    }
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }
}

// ---- Preferences persistence ----

async function loadPreferencesFile() {
  if (tauriModules && appDataDir) {
    try {
      const filePath = await tauriModules.path.join(appDataDir, PREFS_FILENAME);
      const exists = await tauriModules.fs.exists(filePath);
      if (exists) {
        const contents = await tauriModules.fs.readTextFile(filePath);
        return JSON.parse(contents);
      }
    } catch (err) {
      console.warn("loadPreferencesFile failed:", err);
    }
  }
  return null;
}

async function writePreferencesFile(prefs) {
  if (tauriModules && appDataDir) {
    try {
      const filePath = await tauriModules.path.join(appDataDir, PREFS_FILENAME);
      await tauriModules.fs.writeTextFile(filePath, JSON.stringify(prefs, null, 2));
    } catch (err) {
      // Silent fail
    }
  }
}

function extractPreferences() {
  return {
    schulteSize: state.schulte.size,
    schulteShowSelected: state.schulte.showSelected ? "on" : "off",
    tbackLevel: state.tback.level,
    tbackRounds: state.tback.rounds,
    tbackInterval: state.tback.interval,
    stroopRounds: state.stroop.rounds,
    gonogoRounds: state.gonogo.rounds,
    gonogoInterval: state.gonogo.interval,
    antisaccadeRounds: state.antisaccade.rounds,
    focusWarmup: state.focus.warmupMs,
    focusChallenge: state.focus.challengeMs,
    focusIntensity: state.focus.intensity,
    reactionRounds: state.reaction.rounds,
    sustainedRounds: state.sustained.rounds,
    sustainedInterval: state.sustained.interval,
    sustainedPoolSize: state.sustained.poolSize,
    sustainedLetters: state.sustained.customLetters,
    breathCycles: state.breath.cycles,
    breathCueMode: state.breath.cueMode
  };
}

function applyPreferences(prefs) {
  if (!prefs) return;
  if (typeof prefs.schulteSize === "number") state.schulte.size = prefs.schulteSize;
  if (prefs.schulteShowSelected !== undefined) state.schulte.showSelected = prefs.schulteShowSelected !== "off";
  if (typeof prefs.tbackLevel === "number") state.tback.level = prefs.tbackLevel;
  if (typeof prefs.tbackRounds === "number") state.tback.rounds = prefs.tbackRounds;
  if (typeof prefs.tbackInterval === "number") state.tback.interval = prefs.tbackInterval;
  if (typeof prefs.stroopRounds === "number") state.stroop.rounds = prefs.stroopRounds;
  if (typeof prefs.gonogoRounds === "number") state.gonogo.rounds = prefs.gonogoRounds;
  if (typeof prefs.gonogoInterval === "number") state.gonogo.interval = prefs.gonogoInterval;
  if (typeof prefs.antisaccadeRounds === "number") state.antisaccade.rounds = prefs.antisaccadeRounds;
  if (typeof prefs.focusWarmup === "number") state.focus.warmupMs = prefs.focusWarmup;
  if (typeof prefs.focusChallenge === "number") state.focus.challengeMs = prefs.focusChallenge;
  if (prefs.focusIntensity !== undefined) state.focus.intensity = prefs.focusIntensity;
  if (typeof prefs.reactionRounds === "number") state.reaction.rounds = prefs.reactionRounds;
  if (typeof prefs.sustainedRounds === "number") state.sustained.rounds = prefs.sustainedRounds;
  if (typeof prefs.sustainedInterval === "number") state.sustained.interval = prefs.sustainedInterval;
  if (typeof prefs.sustainedPoolSize === "number") state.sustained.poolSize = prefs.sustainedPoolSize;
  if (prefs.sustainedLetters !== undefined) state.sustained.customLetters = prefs.sustainedLetters;
  if (typeof prefs.breathCycles === "number") state.breath.cycles = prefs.breathCycles;
  if (prefs.breathCueMode !== undefined) state.breath.cueMode = prefs.breathCueMode;
}

export function scheduleSavePreferences() {
  if (savePrefsTimer) clearTimeout(savePrefsTimer);
  savePrefsTimer = setTimeout(async () => {
    await writePreferencesFile(extractPreferences());
  }, 500);
}

export async function loadAndApplyPreferences() {
  const prefs = await loadPreferencesFile();
  applyPreferences(prefs);
}

export function syncSettingsToUI(refs) {
  refs.schulteSize.value = state.schulte.size;
  refs.schulteShowSelected.value = state.schulte.showSelected ? "on" : "off";
  refs.tbackLevel.value = state.tback.level;
  refs.tbackRounds.value = state.tback.rounds;
  refs.tbackInterval.value = state.tback.interval;
  refs.stroopRounds.value = state.stroop.rounds;
  refs.gonogoRounds.value = state.gonogo.rounds;
  refs.gonogoInterval.value = state.gonogo.interval;
  refs.antisaccadeRounds.value = state.antisaccade.rounds;
  refs.focusWarmup.value = state.focus.warmupMs;
  refs.focusChallenge.value = state.focus.challengeMs;
  refs.focusIntensity.value = state.focus.intensity;
  refs.reactionRounds.value = state.reaction.rounds;
  refs.sustainedRounds.value = state.sustained.rounds;
  refs.sustainedInterval.value = state.sustained.interval;
  refs.sustainedPoolSize.value = state.sustained.poolSize;
  refs.sustainedLetters.value = state.sustained.customLetters;
  refs.breathCycles.value = state.breath.cycles;
  refs.breathCueMode.value = state.breath.cueMode;
}

export async function loadRecords() {
  try {
    state.records = await loadRecordsFile();
  } catch (error) {
    state.records = [];
  }
}

export async function saveRecords() {
  try {
    await writeRecordsFile(state.records);
  } catch (error) {
    // Silent fail -- next successful save will overwrite
  }
}

export function getIsTauri() { return isTauri; }
export function getTauriModules() { return tauriModules; }

export { initPersistence, loadRecordsFile, writeRecordsFile, extractPreferences, applyPreferences };
