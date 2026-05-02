import { state, refs } from "../core/state.js";
import { shuffle, formatDuration, formatCountdown, setStatus } from "../core/utils.js";
import { addRecord } from "../core/records.js";
import { scheduleSavePreferences } from "../core/persistence.js";
import { getFocusPhaseLabel, getFocusIntensityConfig } from "../core/utils.js";

const FOCUS_DISTRACTORS = [
  { symbol: "✺", className: "spark" },
  { symbol: "◎", className: "ring" },
  { symbol: "▤", className: "block" },
  { symbol: "◈", className: "block" },
  { symbol: "◢", className: "chevron" },
  { symbol: "◣", className: "chevron" }
];

const FOCUS_TROXLER_GRID_SIZE = 11;
const FOCUS_SLOTS = [
  { x: 14, y: 18 },
  { x: 30, y: 14 },
  { x: 70, y: 16 },
  { x: 86, y: 22 },
  { x: 15, y: 50 },
  { x: 84, y: 48 },
  { x: 18, y: 78 },
  { x: 34, y: 84 },
  { x: 66, y: 84 },
  { x: 82, y: 78 }
];

const FOCUS_COLORS = ["#0ea5e9", "#f97316", "#ef4444", "#22c55e", "#8b5cf6", "#f59e0b"];

let focusStagePlaceholder = null;
let focusStageOriginalParent = null;
let focusStageOriginalNextSibling = null;

export function initFocus() {
        const resetWhenIdle = () => {
          if (state.focus.active) {
            return;
          }
          state.focus.warmupMs = Number(refs.focusWarmup.value);
          state.focus.challengeMs = Number(refs.focusChallenge.value);
          state.focus.intensity = refs.focusIntensity.value;
          state.focus.phase = "idle";
          state.focus.waveCount = 0;
          state.focus.interruptions = 0;
          state.focus.durationMs = 0;
          resetFocusArena();
          refs.focusHint.textContent = "热身阶段请稳盯中心绿点，不要检查外围黄点还在不在。训练中尽量不要碰画面。";
          setStatus(refs.focusStatus, "热身会依赖真实的视觉适应错觉，不会由程序定时把黄点或图阵隐藏。", "");
          updateFocusPanel();
        };

        buildFocusWarmupScene();
        scheduleFocusWarmupLayoutSync();
        refs.focusWarmup.addEventListener("change", () => { scheduleSavePreferences(); resetWhenIdle(); });
        refs.focusChallenge.addEventListener("change", () => { scheduleSavePreferences(); resetWhenIdle(); });
        refs.focusIntensity.addEventListener("change", () => { scheduleSavePreferences(); resetWhenIdle(); });
        refs.focusStartBtn.addEventListener("click", startFocusGame);
        refs.focusStopBtn.addEventListener("click", () => {
          if (state.focus.active) {
            finishFocusGame(true);
          }
        });
        refs.focusFullscreenBtn.addEventListener("click", toggleFocusFullscreen);
        refs.focusFullscreenExitBtn.addEventListener("click", exitFocusFullscreen);
        refs.focusArena.addEventListener("pointerdown", handleFocusArenaTouch);
        window.addEventListener("resize", scheduleFocusWarmupLayoutSync);
        document.addEventListener("fullscreenchange", handleFocusFullscreenChange);
        document.addEventListener("webkitfullscreenchange", handleFocusFullscreenChange);
        document.addEventListener("keydown", handleFocusFullscreenEscape);

        resetFocusArena();
        scheduleFocusWarmupLayoutSync();
        syncFocusFullscreenUi();
        updateFocusPanel();
      }

      function clearFocusTimers() {
        if (state.focus.tickId) {
          clearInterval(state.focus.tickId);
          state.focus.tickId = null;
        }
        clearFocusPhaseTimers();
      }

      function clearFocusPhaseTimers() {
        if (state.focus.phaseTimeoutId) {
          clearTimeout(state.focus.phaseTimeoutId);
          state.focus.phaseTimeoutId = null;
        }
        if (state.focus.distractorIntervalId) {
          clearInterval(state.focus.distractorIntervalId);
          state.focus.distractorIntervalId = null;
        }
        state.focus.transientTimeoutIds.forEach((id) => clearTimeout(id));
        state.focus.transientTimeoutIds = [];
      }

      function resetFocusArena() {
        refs.focusArena.className = "focus-arena";
        refs.focusDistractorLayer.innerHTML = "";
        refs.focusCaption.textContent = "先盯住中心绿点，不要来回确认外围黄点。它们和红色图阵始终都在。";
        scheduleFocusWarmupLayoutSync();
      }

      function startFocusTicker() {
        if (state.focus.tickId) {
          clearInterval(state.focus.tickId);
        }
        state.focus.tickId = window.setInterval(() => {
          updateFocusPanel();
        }, 120);
      }

      function startFocusGame() {
        clearFocusTimers();
        state.focus.warmupMs = Number(refs.focusWarmup.value);
        state.focus.challengeMs = Number(refs.focusChallenge.value);
        state.focus.intensity = refs.focusIntensity.value;
        state.focus.active = true;
        state.focus.phase = "warmup";
        state.focus.startTime = performance.now();
        state.focus.phaseStartedAt = state.focus.startTime;
        state.focus.waveCount = 0;
        state.focus.interruptions = 0;
        state.focus.durationMs = 0;
        refs.focusStartBtn.disabled = true;
        refs.focusStopBtn.disabled = false;
        resetFocusArena();
        startFocusTicker();
        startFocusWarmup();
      }

      function startFocusWarmup() {
        clearFocusPhaseTimers();
        state.focus.phase = "warmup";
        state.focus.phaseStartedAt = performance.now();
        refs.focusArena.className = "focus-arena warmup";
        scheduleFocusWarmupLayoutSync();
        refs.focusCaption.textContent = "只盯住中间绿点，不要来回确认三个黄点。红色图阵会缓慢转动，但所有元素始终都在。";
        refs.focusHint.textContent = "热身阶段：三个黄点固定成等边三角，外围粗线图阵不会被程序删除。若定视稳定，黄点可能在主观上淡化甚至短暂消失。";
        setStatus(refs.focusStatus, "热身开始。让消逝来自视觉适应，而不是由代码定时触发。", "");

        state.focus.phaseTimeoutId = window.setTimeout(() => {
          startFocusChallenge();
        }, state.focus.warmupMs);
        updateFocusPanel();
      }

      function startFocusChallenge() {
        clearFocusPhaseTimers();

        state.focus.phase = "challenge";
        state.focus.phaseStartedAt = performance.now();
        refs.focusArena.className = "focus-arena challenge";
        scheduleFocusWarmupLayoutSync();
        refs.focusCaption.textContent = "旁边会动，但你的视线只留在中心红点。";
        refs.focusHint.textContent = "抗干扰阶段：别追闪动、跳动、旋转的图案，始终看红点。";
        setStatus(refs.focusStatus, "抗干扰开始。训练中尽量不要碰画面。", "");

        const config = getFocusIntensityConfig(state.focus.intensity);
        spawnFocusDistractorWave(config);
        state.focus.distractorIntervalId = window.setInterval(() => {
          spawnFocusDistractorWave(config);
        }, config.interval);
        state.focus.phaseTimeoutId = window.setTimeout(() => {
          finishFocusGame(false);
        }, state.focus.challengeMs);
        updateFocusPanel();
      }

      function spawnFocusDistractorWave(config) {
        if (!state.focus.active || state.focus.phase !== "challenge") {
          return;
        }

        const slots = shuffle(FOCUS_SLOTS).slice(0, config.count);
        state.focus.waveCount += 1;

        slots.forEach((slot, index) => {
          const distractor = FOCUS_DISTRACTORS[Math.floor(Math.random() * FOCUS_DISTRACTORS.length)];
          const motionClass = Math.random() < 0.5 ? "sweep" : "spin";
          const node = document.createElement("div");
          const x = slot.x + (Math.random() * 8 - 4);
          const y = slot.y + (Math.random() * 8 - 4);
          const driftX = (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 34);
          const driftY = (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 30);
          const duration = config.life + Math.random() * 260;

          node.className = "focus-distractor " + distractor.className + " " + motionClass;
          node.textContent = distractor.symbol;
          node.style.left = x.toFixed(1) + "%";
          node.style.top = y.toFixed(1) + "%";
          node.style.fontSize = (26 + Math.random() * 24).toFixed(0) + "px";
          node.style.color = FOCUS_COLORS[Math.floor(Math.random() * FOCUS_COLORS.length)];
          node.style.setProperty("--dx", driftX.toFixed(0) + "px");
          node.style.setProperty("--dy", driftY.toFixed(0) + "px");
          node.style.setProperty("--rot", (Math.random() * 120 - 60).toFixed(0) + "deg");
          node.style.setProperty("--scale-end", (0.92 + Math.random() * 0.42).toFixed(2));
          node.style.setProperty("--dur", duration.toFixed(0) + "ms");
          node.style.animationDelay = (index * 35).toFixed(0) + "ms";
          refs.focusDistractorLayer.appendChild(node);

          const timeoutId = window.setTimeout(() => {
            node.remove();
          }, duration + 120);
          state.focus.transientTimeoutIds.push(timeoutId);
        });

        refs.focusWaves.textContent = String(state.focus.waveCount);
      }

      function handleFocusArenaTouch(event) {
        if (!state.focus.active) {
          return;
        }

        event.preventDefault();
        state.focus.interruptions += 1;
        refs.focusArena.classList.remove("disturbed");
        void refs.focusArena.offsetWidth;
        refs.focusArena.classList.add("disturbed");
        refs.focusHint.textContent = state.focus.phase === "warmup"
          ? "记录到一次触碰。把视线重新锁回中心绿点，不要回头确认黄点。"
          : "记录到一次触碰。把视线重新锁回中心红点。";
        setStatus(refs.focusStatus, "记录到一次触碰中断。继续凝视中心。", "warn");
        refs.focusBreaks.textContent = String(state.focus.interruptions);
      }

      function updateFocusPanel() {
        const configuredWarmup = state.focus.active ? state.focus.warmupMs : Number(refs.focusWarmup.value);
        const configuredChallenge = state.focus.active ? state.focus.challengeMs : Number(refs.focusChallenge.value);
        const totalConfigured = Math.max(configuredWarmup + configuredChallenge, 1);
        let phaseLabel = getFocusPhaseLabel(state.focus.phase);
        let countdown = "-";
        let progress = 0;

        if (state.focus.active) {
          const phaseDuration = state.focus.phase === "warmup" ? configuredWarmup : configuredChallenge;
          const phaseElapsed = performance.now() - state.focus.phaseStartedAt;
          const totalElapsed = performance.now() - state.focus.startTime;
          countdown = formatCountdown(Math.max(phaseDuration - phaseElapsed, 0));
          progress = Math.min(totalElapsed / totalConfigured, 1);
        } else if (state.focus.phase === "done") {
          countdown = "0s";
          progress = 1;
        } else if (state.focus.phase === "stopped") {
          countdown = "已停";
          progress = Math.min(state.focus.durationMs / totalConfigured, 1);
        } else {
          phaseLabel = "未开始";
        }

        refs.focusPhase.textContent = phaseLabel;
        refs.focusCountdown.textContent = countdown;
        refs.focusWaves.textContent = String(state.focus.waveCount);
        refs.focusBreaks.textContent = String(state.focus.interruptions);
        refs.focusProgress.style.width = (progress * 100).toFixed(1) + "%";
      }

      function finishFocusGame(aborted) {
        clearFocusTimers();
        state.focus.durationMs = state.focus.startTime ? performance.now() - state.focus.startTime : 0;
        state.focus.active = false;
        state.focus.phase = aborted ? "stopped" : "done";
        refs.focusStartBtn.disabled = false;
        refs.focusStopBtn.disabled = true;
        resetFocusArena();
        refs.focusArena.className = "focus-arena done";

        if (aborted) {
          refs.focusCaption.textContent = "训练已提前结束，可重新开始。";
          refs.focusHint.textContent = "本次已停止，未写入记录。";
          setStatus(refs.focusStatus, "已提前结束，当前这次不写入记录。", "warn");
          updateFocusPanel();
          return;
        }

        const intensityLabel = state.focus.intensity === "gentle"
          ? "柔和"
          : state.focus.intensity === "intense"
          ? "猛烈"
          : "标准";
        const score = Math.max(
          0,
          Math.min(
            100,
            100 - state.focus.interruptions * 12 + (state.focus.intensity === "intense" ? 6 : state.focus.intensity === "gentle" ? -4 : 0)
          )
        );

        refs.focusCaption.textContent = "两阶段完成，重新开始会生成新的干扰节奏。";
        refs.focusHint.textContent = "本次完成后已经写入本地记录。";
        setStatus(
          refs.focusStatus,
          "完成，热身 " + formatDuration(state.focus.warmupMs) + "，抗干扰 " + formatDuration(state.focus.challengeMs) + "。",
          "ok"
        );
        updateFocusPanel();

        addRecord({
          id: "focus-" + Date.now(),
          game: "凝视专注抗干扰",
          timestamp: Date.now(),
          durationMs: Math.round(state.focus.durationMs),
          score: Number(score.toFixed(2)),
          summary: formatDuration(state.focus.warmupMs) + " 热身 + " + formatDuration(state.focus.challengeMs) + " 抗干扰",
          detailText: "强度 " + intensityLabel + " / 干扰波次 " + state.focus.waveCount + " / 触碰中断 " + state.focus.interruptions
        });
      }

      function appendFocusTroxlerSegment(parent, width, height, left, top, transform) {
        const segment = document.createElement("span");
        segment.className = "focus-troxler-seg";
        segment.style.width = width + "px";
        segment.style.height = height + "px";
        segment.style.left = left;
        segment.style.top = top;
        segment.style.transform = transform;
        parent.appendChild(segment);
      }

      function createFocusTroxlerMark(shape) {
        const node = document.createElement("div");
        node.className = "focus-troxler-mark";
        const stroke = 3;
        const plusSpan = 18;
        const edgeLong = 22;
        const edgeShort = 16;

        if (shape === "shape-plus") {
          appendFocusTroxlerSegment(node, plusSpan, stroke, "50%", "50%", "translate(-50%, -50%)");
          appendFocusTroxlerSegment(node, stroke, plusSpan, "50%", "50%", "translate(-50%, -50%)");
          return node;
        }

        if (shape === "shape-edge-top") {
          appendFocusTroxlerSegment(node, edgeLong, stroke, "50%", "50%", "translate(-50%, -50%)");
          appendFocusTroxlerSegment(node, stroke, edgeShort, "50%", "50%", "translate(-50%, 0)");
          return node;
        }

        if (shape === "shape-edge-bottom") {
          appendFocusTroxlerSegment(node, edgeLong, stroke, "50%", "50%", "translate(-50%, -50%)");
          appendFocusTroxlerSegment(node, stroke, edgeShort, "50%", "50%", "translate(-50%, -100%)");
          return node;
        }

        if (shape === "shape-edge-left") {
          appendFocusTroxlerSegment(node, edgeLong, stroke, "50%", "50%", "translate(-50%, -50%)");
          appendFocusTroxlerSegment(node, edgeShort, stroke, "50%", "50%", "translate(0, -50%)");
          return node;
        }

        if (shape === "shape-edge-right") {
          appendFocusTroxlerSegment(node, edgeLong, stroke, "50%", "50%", "translate(-50%, -50%)");
          appendFocusTroxlerSegment(node, edgeShort, stroke, "50%", "50%", "translate(-100%, -50%)");
          return node;
        }

        if (shape === "shape-corner-tl") {
          appendFocusTroxlerSegment(node, edgeShort, stroke, "50%", "50%", "translate(0, -50%)");
          appendFocusTroxlerSegment(node, stroke, edgeShort, "50%", "50%", "translate(-50%, 0)");
          return node;
        }

        if (shape === "shape-corner-tr") {
          appendFocusTroxlerSegment(node, edgeShort, stroke, "50%", "50%", "translate(-100%, -50%)");
          appendFocusTroxlerSegment(node, stroke, edgeShort, "50%", "50%", "translate(-50%, 0)");
          return node;
        }

        if (shape === "shape-corner-bl") {
          appendFocusTroxlerSegment(node, edgeShort, stroke, "50%", "50%", "translate(0, -50%)");
          appendFocusTroxlerSegment(node, stroke, edgeShort, "50%", "50%", "translate(-50%, -100%)");
          return node;
        }

        appendFocusTroxlerSegment(node, edgeShort, stroke, "50%", "50%", "translate(-100%, -50%)");
        appendFocusTroxlerSegment(node, stroke, edgeShort, "50%", "50%", "translate(-50%, -100%)");
        return node;
      }

      function buildFocusWarmupScene() {
        if (!refs.focusTroxlerGrid) {
          return;
        }

        refs.focusTroxlerGrid.innerHTML = "";
        const size = FOCUS_TROXLER_GRID_SIZE;
        const step = 100 / (size - 1);

        for (let row = 0; row < size; row += 1) {
          for (let col = 0; col < size; col += 1) {
            let shape = "shape-plus";

            if (row === 0 && col === 0) {
              shape = "shape-corner-tl";
            } else if (row === 0 && col === size - 1) {
              shape = "shape-corner-tr";
            } else if (row === size - 1 && col === 0) {
              shape = "shape-corner-bl";
            } else if (row === size - 1 && col === size - 1) {
              shape = "shape-corner-br";
            } else if (row === 0) {
              shape = "shape-edge-top";
            } else if (row === size - 1) {
              shape = "shape-edge-bottom";
            } else if (col === 0) {
              shape = "shape-edge-left";
            } else if (col === size - 1) {
              shape = "shape-edge-right";
            }

            const node = createFocusTroxlerMark(shape);
            node.style.left = (col * step).toFixed(2) + "%";
            node.style.top = (row * step).toFixed(2) + "%";
            refs.focusTroxlerGrid.appendChild(node);
          }
        }
      }

      function syncFocusWarmupLayout() {
        if (!refs.focusArena || !refs.focusTroxlerGridShell || !refs.focusTroxlerTriangle) {
          return;
        }

        const rect = refs.focusArena.getBoundingClientRect();
        const arenaWidth = Math.round(rect.width) || refs.focusArena.clientWidth || 0;
        const arenaHeight = Math.round(rect.height) || refs.focusArena.clientHeight || refs.focusArena.offsetHeight || 0;

        if (!arenaWidth || !arenaHeight) {
          return;
        }

        const shellSize = Math.max(230, Math.min(Math.min(arenaWidth, arenaHeight) * 0.78, 420));
        const triangleSide = shellSize * 0.72;
        const triangleHeight = triangleSide * 0.8660254;

        refs.focusTroxlerGridShell.style.width = Math.round(shellSize) + "px";
        refs.focusTroxlerGridShell.style.height = Math.round(shellSize) + "px";
        refs.focusTroxlerTriangle.style.width = Math.round(triangleSide) + "px";
        refs.focusTroxlerTriangle.style.height = Math.round(triangleHeight) + "px";
      }

      function scheduleFocusWarmupLayoutSync() {
        window.requestAnimationFrame(() => {
          syncFocusWarmupLayout();
          window.requestAnimationFrame(() => {
            syncFocusWarmupLayout();
          });
        });
      }

      function getDocumentFullscreenElement() {
        return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;
      }

      function isFocusNativeFullscreen() {
        return !!refs.focusStage && getDocumentFullscreenElement() === refs.focusStage;
      }

      function isFocusPseudoFullscreen() {
        return !!refs.focusStage && refs.focusStage.classList.contains("is-pseudo-fullscreen");
      }

      export function isFocusFullscreenActive() {
        return isFocusNativeFullscreen() || isFocusPseudoFullscreen();
      }

      function setFocusPseudoFullscreen(active) {
        if (!refs.focusStage) {
          return;
        }

        if (active && !focusStagePlaceholder) {
          focusStageOriginalParent = refs.focusStage.parentNode;
          focusStageOriginalNextSibling = refs.focusStage.nextSibling;
          focusStagePlaceholder = document.createComment("focus-stage-placeholder");
          focusStageOriginalParent.insertBefore(focusStagePlaceholder, refs.focusStage);
          document.body.appendChild(refs.focusStage);
        }

        if (!active && focusStagePlaceholder && focusStageOriginalParent) {
          focusStageOriginalParent.insertBefore(refs.focusStage, focusStagePlaceholder);
          focusStagePlaceholder.remove();
          focusStagePlaceholder = null;
          focusStageOriginalParent = null;
          focusStageOriginalNextSibling = null;
        }

        refs.focusStage.classList.toggle("is-pseudo-fullscreen", active);
        document.body.classList.toggle("focus-stage-lock", active);
      }

      function refreshFocusViewportLayout() {
        scheduleFocusWarmupLayoutSync();
        window.setTimeout(scheduleFocusWarmupLayoutSync, 140);
        window.setTimeout(scheduleFocusWarmupLayoutSync, 320);
      }

      function syncFocusFullscreenUi() {
        if (!refs.focusFullscreenBtn) {
          return;
        }

        const active = isFocusFullscreenActive();
        refs.focusFullscreenBtn.textContent = active ? "\u9000\u51FA\u8BAD\u7EC3\u753B\u9762\u5168\u5C4F" : "\u8BAD\u7EC3\u753B\u9762\u5168\u5C4F";
        refs.focusFullscreenBtn.setAttribute("aria-pressed", active ? "true" : "false");
      }

      function requestElementFullscreen(element) {
        if (!element) {
          return false;
        }

        const method = element.requestFullscreen || element.webkitRequestFullscreen || element.msRequestFullscreen;
        if (typeof method !== "function") {
          return false;
        }

        try {
          const result = method.call(element);
          if (result && typeof result.catch === "function") {
            result.catch(() => {
              if (!isFocusNativeFullscreen() && !isFocusPseudoFullscreen()) {
                setFocusPseudoFullscreen(true);
                syncFocusFullscreenUi();
                refreshFocusViewportLayout();
              }
            });
          }
          return true;
        } catch (error) {
          return false;
        }
      }

      function exitDocumentFullscreen() {
        const method = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
        if (typeof method !== "function") {
          return;
        }

        try {
          method.call(document);
        } catch (error) {
          return;
        }
      }

      function enterFocusFullscreen() {
        if (!refs.focusStage) {
          return;
        }

        setFocusPseudoFullscreen(true);
        syncFocusFullscreenUi();
        refreshFocusViewportLayout();
      }

      export function exitFocusFullscreen() {
        if (isFocusPseudoFullscreen()) {
          setFocusPseudoFullscreen(false);
        }

        if (isFocusNativeFullscreen()) {
          exitDocumentFullscreen();
        }

        syncFocusFullscreenUi();
        refreshFocusViewportLayout();
      }

      function toggleFocusFullscreen() {
        if (isFocusFullscreenActive()) {
          exitFocusFullscreen();
          return;
        }

        enterFocusFullscreen();
      }

      function handleFocusFullscreenChange() {
        if (isFocusNativeFullscreen()) {
          setFocusPseudoFullscreen(false);
        }

        syncFocusFullscreenUi();
        refreshFocusViewportLayout();
      }

      function handleFocusFullscreenEscape(event) {
        if (event.key !== "Escape") {
          return;
        }

        if (isFocusPseudoFullscreen()) {
          exitFocusFullscreen();
        }
      }
