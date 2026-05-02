import { initViewportHeightSync } from "./core/ui-shell.js";
import { initPersistence, loadRecords, loadAndApplyPreferences, syncSettingsToUI } from "./core/persistence.js";
import { renderStats, renderRecords, initRecordsActions } from "./core/records.js";
import { refs } from "./core/state.js";
import { initSidebar, initModuleSettings, initCustomSelects, initPanelScrollStates, initPanelSwitcher, setFocusFullscreenCallbacks } from "./core/ui-shell.js";
import { initSchulte } from "./games/schulte.js";
import { initTBack } from "./games/tback.js";
import { initStroop } from "./games/stroop.js";
import { initGoNoGo } from "./games/gonogo.js";
import { initAntiSaccade } from "./games/antisaccade.js";
import { initFocus, isFocusFullscreenActive, exitFocusFullscreen } from "./games/focus.js";
import { initReaction } from "./games/reaction.js";
import { initSustained } from "./games/sustained.js";
import { initBreath } from "./games/breath.js";

async function boot() {
  initViewportHeightSync();
  await initPersistence();
  await loadRecords();
  await loadAndApplyPreferences();
  syncSettingsToUI(refs);
  renderStats();
  renderRecords();
  initSidebar();
  setFocusFullscreenCallbacks(isFocusFullscreenActive, exitFocusFullscreen);
  initSchulte();
  initTBack();
  initStroop();
  initGoNoGo();
  initAntiSaccade();
  initFocus();
  initReaction();
  initSustained();
  initBreath();
  initRecordsActions();
  initModuleSettings();
  initCustomSelects();
  initPanelScrollStates();
  initPanelSwitcher();
}

boot().catch(function (err) { console.error("boot failed:", err); });
