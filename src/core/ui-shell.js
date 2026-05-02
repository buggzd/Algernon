import { PANEL_IDS } from "./constants.js";
import { state, refs, $ } from "./state.js";
import { setStatus } from "./utils.js";
import { scheduleSavePreferences } from "./persistence.js";

// Module-level DOM references (initialized when module loads)
const panelTabs = Array.from(document.querySelectorAll(".quick-nav-tab"));
const panelMap = new Map(PANEL_IDS.map((id) => [id, $(id)]));

// Focus module dependency - set via setFocusFullscreenCallbacks from main.js
let isFocusFullscreenActive, exitFocusFullscreen;

export function setFocusFullscreenCallbacks(isActive, exit) {
  isFocusFullscreenActive = isActive;
  exitFocusFullscreen = exit;
}

function updateAppViewportHeight() {
  const height = Math.max(320, Math.round((window.visualViewport && window.visualViewport.height) || window.innerHeight || 0));
  document.documentElement.style.setProperty("--app-vh", height + "px");
  if (state && state.ui) {
    syncPanelScrollState(panelMap.get(state.ui.activePanelId));
  }
}

export function initViewportHeightSync() {
  updateAppViewportHeight();
  window.addEventListener("resize", updateAppViewportHeight, { passive: true });
  window.addEventListener("orientationchange", updateAppViewportHeight);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", updateAppViewportHeight, { passive: true });
    window.visualViewport.addEventListener("scroll", updateAppViewportHeight, { passive: true });
  }
}

function isSidebarDrawerMode() {
  return window.innerWidth <= 980;
}

export function setSidebarOpen(open) {
  const drawerMode = isSidebarDrawerMode();
  if (open && drawerMode) {
    document.body.classList.add("sidebar-open");
    refs.sidebarScrim.setAttribute("aria-hidden", "false");
    refs.sidebarToggle.setAttribute("aria-expanded", "true");
    refs.sideRail.setAttribute("aria-hidden", "false");
    refs.sideRail.querySelector(".quick-nav-tab:not([tabindex='-1'])")?.focus();
  } else if (!open && drawerMode) {
    document.body.classList.remove("sidebar-open");
    refs.sidebarScrim.setAttribute("aria-hidden", "true");
    refs.sidebarToggle.setAttribute("aria-expanded", "false");
    refs.sideRail.setAttribute("aria-hidden", "true");
  }
}

export function closeSidebar() {
  setSidebarOpen(false);
}

function toggleSidebar() {
  const isOpen = document.body.classList.contains("sidebar-open");
  setSidebarOpen(!isOpen);
}

function handleSidebarEscape(event) {
  if (event.key === "Escape" && document.body.classList.contains("sidebar-open")) {
    closeSidebar();
    refs.sidebarToggle.focus();
  }
}

export function syncSidebarViewportMode() {
  const drawerMode = isSidebarDrawerMode();
  if (drawerMode) {
    document.body.classList.remove("sidebar-collapsed");
    refs.sideRail.removeAttribute("aria-hidden");
  } else {
    document.body.classList.remove("sidebar-open");
    refs.sidebarScrim.setAttribute("aria-hidden", "true");
    refs.sidebarToggle.setAttribute("aria-expanded", "false");
  }
}

function toggleSidebarCollapsed() {
  if (isSidebarDrawerMode()) return;
  const isCollapsed = document.body.classList.contains("sidebar-collapsed");
  document.body.classList.toggle("sidebar-collapsed", !isCollapsed);
  refs.sideRailCollapse.setAttribute("aria-expanded", isCollapsed ? "true" : "false");
}

function syncSideRailScrollState() {
  const sideRailCard = refs.sideRail.querySelector(".side-rail-card");
  if (!sideRailCard) return;
  sideRailCard.classList.toggle("is-rail-scrolled", sideRailCard.scrollTop > 24);
}

export function initSidebar() {
  refs.sidebarToggle.addEventListener("click", toggleSidebar);
  refs.sidebarScrim.addEventListener("click", closeSidebar);
  refs.sideRailClose.addEventListener("click", closeSidebar);
  refs.sideRailCollapse.addEventListener("click", toggleSidebarCollapsed);
  refs.sideRail.querySelector(".side-rail-card")?.addEventListener("scroll", syncSideRailScrollState, { passive: true });
  document.addEventListener("keydown", handleSidebarEscape);
  window.addEventListener("resize", syncSidebarViewportMode, { passive: true });
  syncSideRailScrollState();
  syncSidebarViewportMode();
}

function createSettingsPanel(panelId, itemCount) {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  const controls = panel.querySelector(".controls");
  const sectionHead = panel.querySelector(".section-head");
  const heading = sectionHead ? sectionHead.querySelector("h2") : null;
  if (!controls || !sectionHead || !heading || sectionHead.querySelector(".module-settings")) return;

  const items = Array.from(controls.children).slice(0, itemCount);
  if (items.length === 0) return;

  const titleRow = document.createElement("div");
  titleRow.className = "section-title-row";
  heading.parentNode.insertBefore(titleRow, heading);
  titleRow.appendChild(heading);

  const details = document.createElement("details");
  details.className = "module-settings";

  const summary = document.createElement("summary");
  summary.className = "module-settings-summary";
  summary.setAttribute("aria-label", "训练设置");
  summary.title = "训练设置";
  summary.innerHTML = '<span class="module-settings-icon" aria-hidden="true">⚙</span>';

  const body = document.createElement("div");
  body.className = "module-settings-body";

  details.appendChild(summary);
  details.appendChild(body);
  titleRow.appendChild(details);

  items.forEach((item) => {
    body.appendChild(item);
  });
}

export function initModuleSettings() {
  [
    ["schulte-card", 1],
    ["tback-card", 2],
    ["stroop-card", 1],
    ["gonogo-card", 1],
    ["antisaccade-card", 1],
    ["focus-card", 2],
    ["reaction-card", 1],
    ["sustained-card", 3],
    ["breath-card", 2]
  ].forEach(([panelId, itemCount]) => {
    createSettingsPanel(panelId, itemCount);
  });
}

export function closeCustomSelects(except) {
  document.querySelectorAll(".custom-select.is-open").forEach((select) => {
    if (select === except) return;
    select.classList.remove("is-open");
    const trigger = select.querySelector(".custom-select-trigger");
    if (trigger) {
      trigger.setAttribute("aria-expanded", "false");
    }
  });
}

export function initCustomSelects() {
  document.querySelectorAll("select").forEach((select) => {
    if (select.closest(".custom-select")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "custom-select";

    const trigger = document.createElement("button");
    trigger.className = "custom-select-trigger";
    trigger.type = "button";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    const value = document.createElement("span");
    value.className = "custom-select-value";

    const chevron = document.createElement("span");
    chevron.className = "custom-select-chevron";
    chevron.setAttribute("aria-hidden", "true");

    const menu = document.createElement("div");
    menu.className = "custom-select-menu";
    menu.setAttribute("role", "listbox");

    function syncCustomSelect() {
      const selectedOption = select.options[select.selectedIndex];
      value.textContent = selectedOption ? selectedOption.textContent : "";
      Array.from(menu.children).forEach((option) => {
        const active = option.dataset.value === select.value;
        option.classList.toggle("is-selected", active);
        option.setAttribute("aria-selected", active ? "true" : "false");
      });
    }

    Array.from(select.options).forEach((option) => {
      const item = document.createElement("button");
      item.className = "custom-select-option";
      item.type = "button";
      item.setAttribute("role", "option");
      item.dataset.value = option.value;
      item.textContent = option.textContent;
      item.addEventListener("click", () => {
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        syncCustomSelect();
        closeCustomSelects();
        trigger.focus();
      });
      menu.appendChild(item);
    });

    select.classList.add("native-select");
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    trigger.appendChild(value);
    trigger.appendChild(chevron);
    wrapper.appendChild(trigger);
    wrapper.appendChild(menu);
    syncCustomSelect();

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = !wrapper.classList.contains("is-open");
      closeCustomSelects(wrapper);
      wrapper.classList.toggle("is-open", willOpen);
      trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });

    trigger.addEventListener("keydown", (event) => {
      if (!["ArrowDown", "Enter", " "].includes(event.key)) return;
      event.preventDefault();
      closeCustomSelects(wrapper);
      wrapper.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
      const selected = menu.querySelector(".custom-select-option.is-selected") || menu.querySelector(".custom-select-option");
      if (selected) selected.focus();
    });

    menu.addEventListener("keydown", (event) => {
      const options = Array.from(menu.querySelectorAll(".custom-select-option"));
      const index = options.indexOf(document.activeElement);
      if (event.key === "Escape") {
        event.preventDefault();
        closeCustomSelects();
        trigger.focus();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = options[(index + delta + options.length) % options.length];
      if (next) next.focus();
    });

    select.addEventListener("change", syncCustomSelect);
  });

  document.addEventListener("click", () => closeCustomSelects());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeCustomSelects();
  });
}

export function syncPanelScrollState(panel) {
  if (!panel) return;
  panel.classList.remove("is-scrolled");
}

export function initPanelScrollStates() {
  panelMap.forEach((panel) => {
    panel.addEventListener("scroll", () => {
      if (panel.classList.contains("is-active")) {
        syncPanelScrollState(panel);
      }
    }, { passive: true });
    syncPanelScrollState(panel);
  });
}

function getPanelIdFromHash() {
  const hash = window.location.hash.slice(1);
  return panelMap.has(hash) ? hash : "home-card";
}

function updatePanelHash(panelId) {
  const hash = "#" + panelId;
  if (window.location.hash !== hash) {
    window.history.replaceState(null, "", hash);
  }
}

function syncActivePanelLayout(panelId) {
  // Refresh layout for focus panel if needed
}

function hasActiveSession(panelId) {
  if (panelId === "schulte-card") {
    return !!state.schulte.startTime && !state.schulte.finished;
  }
  if (panelId === "tback-card") {
    return state.tback.active;
  }
  if (panelId === "stroop-card") {
    return state.stroop.active;
  }
  if (panelId === "gonogo-card") {
    return state.gonogo.active;
  }
  if (panelId === "antisaccade-card") {
    return state.antisaccade.active;
  }
  if (panelId === "focus-card") {
    return state.focus.active;
  }
  if (panelId === "reaction-card") {
    return state.reaction.active;
  }
  if (panelId === "sustained-card") {
    return state.sustained.active;
  }
  if (panelId === "breath-card") {
    return state.breath.active;
  }
  return false;
}

function markPanelSwitchBlocked(panelId) {
  if (panelId === "schulte-card") {
    setStatus(refs.schulteStatus, "当前这一局还在进行中。先完成，或点\u201C重置棋盘\u201D后再切换项目。", "warn");
    return;
  }
  if (panelId === "tback-card") {
    setStatus(refs.tbackStatus, "当前训练还在进行中。请等本组结束后再切换项目。", "warn");
    return;
  }
  if (panelId === "stroop-card") {
    setStatus(refs.stroopStatus, "当前训练还在进行中。请等本组结束后再切换项目。", "warn");
    return;
  }
  if (panelId === "gonogo-card") {
    setStatus(refs.gonogoStatus, "当前训练还在进行中。请等本组结束后再切换项目。", "warn");
    return;
  }
  if (panelId === "antisaccade-card") {
    setStatus(refs.antisaccadeStatus, "当前训练还在进行中。请等本组结束后再切换项目。", "warn");
    return;
  }
  if (panelId === "focus-card") {
    setStatus(refs.focusStatus, "当前训练还在进行中。请先停止训练后再切换项目。", "warn");
    return;
  }
  if (panelId === "reaction-card") {
    setStatus(refs.reactionStatus, "当前训练还在进行中。请等本组结束后再切换项目。", "warn");
    return;
  }
  if (panelId === "sustained-card") {
    setStatus(refs.sustainedStatus, "当前训练还在进行中。请等本组结束后再切换项目。", "warn");
    return;
  }
  if (panelId === "breath-card") {
    setStatus(refs.breathStatus, "当前训练还在进行中。请先停止训练后再切换项目。", "warn");
    return;
  }
}

export function switchTrainingPanel(panelId, options) {
  const config = options || {};
  const nextPanelId = panelMap.has(panelId) ? panelId : "home-card";
  const currentPanelId = state.ui.activePanelId;

  if (currentPanelId && currentPanelId !== nextPanelId && hasActiveSession(currentPanelId)) {
    markPanelSwitchBlocked(currentPanelId);
    const currentPanel = panelMap.get(currentPanelId);
    if (currentPanel) {
      currentPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return;
  }

  // Check focus fullscreen state - uses callback set by focus module
  if (nextPanelId !== "focus-card" && typeof isFocusFullscreenActive === "function" && isFocusFullscreenActive()) {
    exitFocusFullscreen();
  }

  state.ui.activePanelId = nextPanelId;

  panelTabs.forEach((tab) => {
    const active = tab.dataset.panelTarget === nextPanelId;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
    tab.tabIndex = active ? 0 : -1;
  });

  panelMap.forEach((panel, id) => {
    const active = id === nextPanelId;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
    panel.setAttribute("aria-hidden", active ? "false" : "true");
    if (active) {
      panel.scrollTop = 0;
      syncPanelScrollState(panel);
    }
  });

  if (config.updateHash !== false) {
    updatePanelHash(nextPanelId);
  }

  if (window.innerWidth > 980) {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  closeSidebar();
  syncActivePanelLayout(nextPanelId);
}

export function initPanelSwitcher() {
  panelTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      switchTrainingPanel(tab.dataset.panelTarget);
    });
  });

  window.addEventListener("hashchange", () => {
    switchTrainingPanel(getPanelIdFromHash(), { updateHash: false });
  });

  switchTrainingPanel(getPanelIdFromHash(), { updateHash: false });
}

// Export for testing
export { hasActiveSession };
