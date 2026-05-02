import { state, refs } from "../core/state.js";
import { formatMetricMs, setStatus } from "../core/utils.js";
import { addRecord } from "../core/records.js";
import { scheduleSavePreferences } from "../core/persistence.js";
import { getBreathPhaseLabel, getBreathCueModeLabel } from "../core/utils.js";

const BREATH_TOTAL_BEATS = 10;
      const BREATH_TAP_WINDOW_MS = 420;
      let breathAudioContext = null;

      function createBreathBeatStates() {
        return Array.from({ length: BREATH_TOTAL_BEATS }, () => "pending");
      }

      function ensureBreathAudioContext() {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) {
          return null;
        }
        if (!breathAudioContext) {
          breathAudioContext = new AudioContextCtor();
        }
        if (breathAudioContext.state === "suspended") {
          breathAudioContext.resume().catch(() => {});
        }
        return breathAudioContext;
      }

      function playBreathCue(accented) {
        if (state.breath.cueMode !== "audio") {
          return;
        }

        const audioContext = ensureBreathAudioContext();
        if (!audioContext) {
          return;
        }

        const now = audioContext.currentTime;
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(accented ? 660 : 440, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(accented ? 0.05 : 0.032, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + (accented ? 0.16 : 0.12));
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(now);
        oscillator.stop(now + (accented ? 0.18 : 0.14));
      }

      function renderBreathTrack() {
        refs.breathTrack.innerHTML = "";
        for (let i = 0; i < BREATH_TOTAL_BEATS; i += 1) {
          const marker = document.createElement("div");
          marker.className = "breath-beat";
          refs.breathTrack.appendChild(marker);
        }
      }

      function updateBreathTrack() {
        const markers = refs.breathTrack.children;

        for (let i = 0; i < markers.length; i += 1) {
          let className = "breath-beat";
          const result = state.breath.cycleBeatStates[i];
          if (result && result !== "pending") {
            className += " " + result;
          }
          if (state.breath.active && i === state.breath.beatInCycle) {
            className += " current";
          }
          markers[i].className = className;
        }
      }

      function getBreathOrbScale(phase, beatInCycle, inhaleBeats, exhaleBeats) {
        if (phase === "inhale") {
          const inhaleProgress = (beatInCycle + 1) / inhaleBeats;
          return 0.82 + inhaleProgress * 0.34;
        }
        const exhaleBeat = beatInCycle - inhaleBeats;
        const exhaleProgress = (exhaleBeat + 1) / exhaleBeats;
        return 1.16 - exhaleProgress * 0.38;
      }

      export function initBreath() {
        const resetWhenIdle = () => {
          if (state.breath.active) {
            return;
          }

          state.breath.cycles = Number(refs.breathCycles.value);
          state.breath.cueMode = refs.breathCueMode.value;
          state.breath.phase = "idle";
          state.breath.cycleIndex = 0;
          state.breath.beatInCycle = -1;
          state.breath.totalBeatIndex = -1;
          state.breath.startTime = 0;
          state.breath.expectedAt = 0;
          state.breath.currentBeatResponse = null;
          state.breath.hits = 0;
          state.breath.misses = 0;
          state.breath.offBeats = 0;
          state.breath.totalAbsDelta = 0;
          state.breath.lastDeltaMs = null;
          state.breath.completedCycles = 0;
          state.breath.durationMs = 0;
          state.breath.cycleBeatStates = createBreathBeatStates();
          refs.breathStartBtn.disabled = false;
          refs.breathStopBtn.disabled = true;
          refs.breathZone.className = "breath-zone";
          refs.breathWord.textContent = "准备";
          refs.breathSubtext.textContent = "点击开始后，跟着每一拍轻点一下，吸 4 秒，呼 6 秒。";
          refs.breathOrb.classList.remove("beat");
          refs.breathOrb.style.transform = "scale(0.82)";
          refs.breathProgress.style.width = "0%";
          setStatus(refs.breathStatus, "每拍轻点一次，吸气 4 拍，呼气 6 拍，动作尽量小。", "");
          renderBreathTrack();
          updateBreathTrack();
          updateBreathPanel();
        };

        refs.breathCycles.addEventListener("change", () => { scheduleSavePreferences(); resetWhenIdle(); });
        refs.breathCueMode.addEventListener("change", () => { scheduleSavePreferences(); resetWhenIdle(); });
        refs.breathStartBtn.addEventListener("click", startBreathSession);
        refs.breathStopBtn.addEventListener("click", () => {
          if (state.breath.active) {
            finishBreathSession(true);
          }
        });
        refs.breathZone.addEventListener("pointerdown", registerBreathTap);
        refs.breathZone.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            registerBreathTap(event);
          }
        });

        resetWhenIdle();
      }

      function clearBreathTimer() {
        if (state.breath.timeoutId) {
          clearTimeout(state.breath.timeoutId);
          state.breath.timeoutId = null;
        }
      }

      function startBreathSession() {
        clearBreathTimer();
        state.breath.cycles = Number(refs.breathCycles.value);
        state.breath.cueMode = refs.breathCueMode.value;
        state.breath.active = true;
        state.breath.phase = "ready";
        state.breath.cycleIndex = 0;
        state.breath.beatInCycle = -1;
        state.breath.totalBeatIndex = -1;
        state.breath.startTime = performance.now();
        state.breath.expectedAt = 0;
        state.breath.currentBeatResponse = null;
        state.breath.hits = 0;
        state.breath.misses = 0;
        state.breath.offBeats = 0;
        state.breath.totalAbsDelta = 0;
        state.breath.lastDeltaMs = null;
        state.breath.completedCycles = 0;
        state.breath.durationMs = 0;
        state.breath.cycleBeatStates = createBreathBeatStates();
        refs.breathStartBtn.disabled = true;
        refs.breathStopBtn.disabled = false;
        refs.breathZone.className = "breath-zone active";
        refs.breathWord.textContent = "预备";
        refs.breathSubtext.textContent = "第一拍即将开始。轻点屏幕跟拍，吸 4 秒，呼 6 秒。";
        refs.breathOrb.classList.remove("beat");
        refs.breathOrb.style.transform = "scale(0.82)";
        refs.breathProgress.style.width = "0%";
        renderBreathTrack();
        updateBreathTrack();
        updateBreathPanel();

        const audioReady = state.breath.cueMode !== "audio" || !!ensureBreathAudioContext();
        setStatus(
          refs.breathStatus,
          audioReady
            ? "训练开始。每拍轻点一次，把呼吸和动作都放慢。"
            : "当前环境可能不支持节拍音，本次继续使用视觉提示。",
          audioReady ? "" : "warn"
        );

        state.breath.timeoutId = window.setTimeout(() => {
          state.breath.totalBeatIndex = 0;
          startCurrentBreathBeat();
        }, 900);
      }

      function startCurrentBreathBeat() {
        if (!state.breath.active) {
          return;
        }

        const totalPlannedBeats = state.breath.cycles * BREATH_TOTAL_BEATS;
        if (state.breath.totalBeatIndex >= totalPlannedBeats) {
          finishBreathSession(false);
          return;
        }

        state.breath.cycleIndex = Math.floor(state.breath.totalBeatIndex / BREATH_TOTAL_BEATS);
        state.breath.beatInCycle = state.breath.totalBeatIndex % BREATH_TOTAL_BEATS;
        if (state.breath.beatInCycle === 0) {
          state.breath.cycleBeatStates = createBreathBeatStates();
        }

        state.breath.phase = state.breath.beatInCycle < state.breath.inhaleBeats ? "inhale" : "exhale";
        state.breath.expectedAt = performance.now();
        state.breath.currentBeatResponse = null;
        refs.breathZone.className = "breath-zone active " + state.breath.phase;
        refs.breathWord.textContent = state.breath.phase === "inhale" ? "吸" : "呼";

        const phaseBeat = state.breath.phase === "inhale"
          ? state.breath.beatInCycle + 1
          : state.breath.beatInCycle - state.breath.inhaleBeats + 1;
        const phaseTotal = state.breath.phase === "inhale"
          ? state.breath.inhaleBeats
          : state.breath.exhaleBeats;
        refs.breathSubtext.textContent = state.breath.phase === "inhale"
          ? "第 " + (state.breath.cycleIndex + 1) + " 轮：吸气第 " + phaseBeat + " / " + phaseTotal + " 拍，轻点一次。"
          : "第 " + (state.breath.cycleIndex + 1) + " 轮：呼气第 " + phaseBeat + " / " + phaseTotal + " 拍，轻点一次。";
        refs.breathOrb.classList.remove("beat");
        void refs.breathOrb.offsetWidth;
        refs.breathOrb.classList.add("beat");
        refs.breathOrb.style.transform = "scale(" + getBreathOrbScale(
          state.breath.phase,
          state.breath.beatInCycle,
          state.breath.inhaleBeats,
          state.breath.exhaleBeats
        ).toFixed(2) + ")";
        updateBreathTrack();
        updateBreathPanel();
        playBreathCue(
          state.breath.beatInCycle === 0 || state.breath.beatInCycle === state.breath.inhaleBeats
        );

        if (state.breath.totalBeatIndex === totalPlannedBeats - 1) {
          state.breath.timeoutId = window.setTimeout(() => {
            evaluateCurrentBreathBeat();
            finishBreathSession(false);
          }, state.breath.beatMs);
          return;
        }

        state.breath.timeoutId = window.setTimeout(() => {
          evaluateCurrentBreathBeat();
          state.breath.totalBeatIndex += 1;
          startCurrentBreathBeat();
        }, state.breath.beatMs);
      }

      function registerBreathTap(event) {
        if (event && typeof event.preventDefault === "function") {
          event.preventDefault();
        }

        refs.breathZone.classList.remove("pressed");
        void refs.breathZone.offsetWidth;
        refs.breathZone.classList.add("pressed");
        window.setTimeout(() => {
          refs.breathZone.classList.remove("pressed");
        }, 90);

        if (!state.breath.active || state.breath.expectedAt <= 0 || state.breath.currentBeatResponse !== null) {
          return;
        }

        const delta = performance.now() - state.breath.expectedAt;
        state.breath.currentBeatResponse = delta;
        refs.breathSubtext.textContent = delta <= BREATH_TAP_WINDOW_MS
          ? "这一拍已记录，继续稳住节奏。"
          : "这一拍已记录，但偏慢了一点，下一拍再贴近节拍。";
        updateBreathPanel();
      }

      function evaluateCurrentBreathBeat() {
        if (!state.breath.active || state.breath.beatInCycle < 0) {
          return;
        }

        const beatIndex = state.breath.beatInCycle;
        const response = state.breath.currentBeatResponse;

        if (response === null) {
          state.breath.misses += 1;
          state.breath.cycleBeatStates[beatIndex] = "miss";
        } else {
          const absDelta = Math.abs(response);
          state.breath.lastDeltaMs = Math.round(absDelta);
          if (absDelta <= BREATH_TAP_WINDOW_MS) {
            state.breath.hits += 1;
            state.breath.totalAbsDelta += absDelta;
            state.breath.cycleBeatStates[beatIndex] = "hit";
          } else {
            state.breath.offBeats += 1;
            state.breath.cycleBeatStates[beatIndex] = "off";
          }
        }

        if (beatIndex === BREATH_TOTAL_BEATS - 1) {
          state.breath.completedCycles = Math.min(state.breath.cycleIndex + 1, state.breath.cycles);
        }

        updateBreathTrack();
        updateBreathPanel();
      }

      function updateBreathPanel() {
        const configuredCycles = state.breath.active ? state.breath.cycles : Number(refs.breathCycles.value);
        const totalPlannedBeats = configuredCycles * BREATH_TOTAL_BEATS;
        const evaluatedBeats = state.breath.hits + state.breath.misses + state.breath.offBeats;
        const accuracy = evaluatedBeats > 0 ? (state.breath.hits / evaluatedBeats) * 100 : 0;
        const avgDelta = state.breath.hits > 0 ? state.breath.totalAbsDelta / state.breath.hits : 0;

        let progress = 0;
        if (state.breath.active && totalPlannedBeats > 0) {
          progress = Math.min((state.breath.totalBeatIndex + 1) / totalPlannedBeats, 1);
        } else if (state.breath.phase === "done") {
          progress = 1;
        } else if (totalPlannedBeats > 0) {
          progress = Math.min(evaluatedBeats / totalPlannedBeats, 1);
        }

        let beatLabel = "0 / " + BREATH_TOTAL_BEATS;
        if (state.breath.phase === "done") {
          beatLabel = BREATH_TOTAL_BEATS + " / " + BREATH_TOTAL_BEATS;
        } else if (state.breath.beatInCycle >= 0) {
          beatLabel = (state.breath.beatInCycle + 1) + " / " + BREATH_TOTAL_BEATS;
        }

        refs.breathPhase.textContent = getBreathPhaseLabel(state.breath.phase);
        refs.breathBeat.textContent = beatLabel;
        refs.breathCyclesDone.textContent = state.breath.completedCycles + " / " + configuredCycles;
        refs.breathAccuracy.textContent = accuracy.toFixed(0) + "%";
        refs.breathAvgDelta.textContent = state.breath.hits > 0 ? formatMetricMs(avgDelta) : "-";
        refs.breathErrors.textContent = state.breath.misses + " / " + state.breath.offBeats;
        refs.breathProgress.style.width = (progress * 100).toFixed(1) + "%";
      }

      function finishBreathSession(aborted) {
        clearBreathTimer();
        state.breath.durationMs = state.breath.startTime ? performance.now() - state.breath.startTime : 0;
        state.breath.active = false;
        state.breath.phase = aborted ? "stopped" : "done";
        refs.breathStartBtn.disabled = false;
        refs.breathStopBtn.disabled = true;
        refs.breathZone.className = "breath-zone done";
        refs.breathOrb.classList.remove("beat");
        refs.breathOrb.style.transform = "scale(0.9)";

        const evaluatedBeats = state.breath.hits + state.breath.misses + state.breath.offBeats;
        const accuracy = evaluatedBeats > 0 ? (state.breath.hits / evaluatedBeats) * 100 : 0;
        const avgDelta = state.breath.hits > 0 ? state.breath.totalAbsDelta / state.breath.hits : 0;

        if (aborted) {
          refs.breathWord.textContent = "暂停";
          refs.breathSubtext.textContent = "本次已提前结束，没有写入记录。";
          setStatus(refs.breathStatus, "已提前结束，当前这次不写入记录。", "warn");
          updateBreathTrack();
          updateBreathPanel();
          return;
        }

        state.breath.completedCycles = state.breath.cycles;
        refs.breathWord.textContent = "完成";
        refs.breathSubtext.textContent = "已完成 " + state.breath.cycles + " 轮，重新开始会生成一组新的节拍流程。";
        setStatus(
          refs.breathStatus,
          "完成，节拍命中 " + accuracy.toFixed(0) + "%，平均偏差 " + (state.breath.hits > 0 ? formatMetricMs(avgDelta) : "-") + "。",
          accuracy >= 80 ? "ok" : ""
        );
        updateBreathTrack();
        updateBreathPanel();

        addRecord({
          id: "breath-" + Date.now(),
          game: "节拍呼吸",
          timestamp: Date.now(),
          durationMs: Math.round(state.breath.durationMs),
          metricMs: state.breath.hits > 0 ? Math.round(avgDelta) : 0,
          score: Number(accuracy.toFixed(2)),
          summary: state.breath.cycles + " 轮 4 吸 6 呼",
          detailText: getBreathCueModeLabel(state.breath.cueMode)
            + " / 命中 " + accuracy.toFixed(0) + "%"
            + " / 平均偏差 " + (state.breath.hits > 0 ? formatMetricMs(avgDelta) : "-")
            + " / 漏拍 " + state.breath.misses
            + " / 偏拍 " + state.breath.offBeats
        });
      }



