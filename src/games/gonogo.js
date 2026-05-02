import { state, refs } from "../core/state.js";
import { shuffle, formatShort, setStatus } from "../core/utils.js";
import { addRecord } from "../core/records.js";
import { scheduleSavePreferences } from "../core/persistence.js";

      export function initGoNoGo() {
        refs.gonogoRounds.addEventListener("change", () => {
          if (!state.gonogo.active) {
            state.gonogo.rounds = Number(refs.gonogoRounds.value);
            scheduleSavePreferences();
            updateGoNoGoPanel();
          }
        });
        refs.gonogoInterval.addEventListener("change", () => {
          if (!state.gonogo.active) {
            state.gonogo.interval = Number(refs.gonogoInterval.value);
            scheduleSavePreferences();
          }
        });
        refs.gonogoStartBtn.addEventListener("click", startGoNoGoGame);
        refs.gonogoActBtn.addEventListener("click", registerGoNoGoResponse);
        updateGoNoGoPanel();
      }

      function buildGoNoGoSequence(rounds) {
        const noGoCount = Math.max(4, Math.round(rounds * 0.28));
        const sequence = [];

        for (let i = 0; i < rounds - noGoCount; i += 1) {
          sequence.push("go");
        }
        for (let i = 0; i < noGoCount; i += 1) {
          sequence.push("nogo");
        }

        return shuffle(sequence);
      }

      function stopGoNoGoTimers() {
        if (state.gonogo.timerId) {
          clearTimeout(state.gonogo.timerId);
          state.gonogo.timerId = null;
        }
      }

      function startGoNoGoGame() {
        stopGoNoGoTimers();
        state.gonogo.rounds = Number(refs.gonogoRounds.value);
        state.gonogo.interval = Number(refs.gonogoInterval.value);
        state.gonogo.sequence = buildGoNoGoSequence(state.gonogo.rounds);
        state.gonogo.currentIndex = -1;
        state.gonogo.stepStartedAt = 0;
        state.gonogo.active = true;
        state.gonogo.responses = new Map();
        state.gonogo.hits = 0;
        state.gonogo.misses = 0;
        state.gonogo.falseAlarms = 0;
        state.gonogo.correctInhibitions = 0;
        state.gonogo.goCount = 0;
        state.gonogo.noGoCount = 0;
        state.gonogo.hitRtTotal = 0;
        state.gonogo.durationMs = state.gonogo.rounds * state.gonogo.interval;
        refs.gonogoStartBtn.disabled = true;
        refs.gonogoActBtn.disabled = false;
        refs.gonogoDisplay.className = "gng-display";
        refs.gonogoProgress.style.width = "0%";
        refs.gonogoHint.textContent = "注意刺激变化，只有 GO 才能按。";
        setStatus(refs.gonogoStatus, "训练开始。先看清，再决定是否出手。", "");
        nextGoNoGoStep();
      }

      function nextGoNoGoStep() {
        state.gonogo.currentIndex += 1;

        if (state.gonogo.currentIndex >= state.gonogo.rounds) {
          finishGoNoGoGame();
          return;
        }

        const stimulus = state.gonogo.sequence[state.gonogo.currentIndex];
        state.gonogo.stepStartedAt = performance.now();
        refs.gonogoDisplay.className = "gng-display " + stimulus;
        refs.gonogoSymbol.textContent = stimulus === "go" ? "GO" : "NO-GO";
        refs.gonogoHint.textContent = stimulus === "go"
          ? "这一轮要出手。"
          : "这一轮必须忍住，不要点。";
        refs.gonogoStep.textContent = (state.gonogo.currentIndex + 1) + " / " + state.gonogo.rounds;
        refs.gonogoProgress.style.width = (((state.gonogo.currentIndex + 1) / state.gonogo.rounds) * 100).toFixed(1) + "%";
        updateGoNoGoPanel();

        state.gonogo.timerId = window.setTimeout(() => {
          evaluateGoNoGoStep();
          nextGoNoGoStep();
        }, state.gonogo.interval);
      }

      function registerGoNoGoResponse() {
        if (!state.gonogo.active) {
          return;
        }
        if (state.gonogo.responses.has(state.gonogo.currentIndex)) {
          return;
        }

        state.gonogo.responses.set(
          state.gonogo.currentIndex,
          performance.now() - state.gonogo.stepStartedAt
        );

        refs.gonogoHint.textContent = "已记录你的动作。";
      }

      function evaluateGoNoGoStep() {
        const i = state.gonogo.currentIndex;
        const stimulus = state.gonogo.sequence[i];
        const responded = state.gonogo.responses.has(i);

        if (stimulus === "go") {
          state.gonogo.goCount += 1;
          if (responded) {
            state.gonogo.hits += 1;
            state.gonogo.hitRtTotal += state.gonogo.responses.get(i);
          } else {
            state.gonogo.misses += 1;
          }
        } else {
          state.gonogo.noGoCount += 1;
          if (responded) {
            state.gonogo.falseAlarms += 1;
          } else {
            state.gonogo.correctInhibitions += 1;
          }
        }

        updateGoNoGoPanel();
      }

      function updateGoNoGoPanel() {
        const configuredRounds = state.gonogo.active ? state.gonogo.rounds : Number(refs.gonogoRounds.value);
        const evaluated = state.gonogo.hits + state.gonogo.misses + state.gonogo.falseAlarms + state.gonogo.correctInhibitions;
        const overall = evaluated > 0 ? ((state.gonogo.hits + state.gonogo.correctInhibitions) / evaluated) * 100 : 0;
        const inhibition = state.gonogo.noGoCount > 0 ? (state.gonogo.correctInhibitions / state.gonogo.noGoCount) * 100 : 0;

        if (!state.gonogo.active) {
          refs.gonogoStep.textContent = "0 / " + configuredRounds;
          refs.gonogoProgress.style.width = (configuredRounds > 0 ? (evaluated / configuredRounds) * 100 : 0).toFixed(1) + "%";
        }

        refs.gonogoAccuracy.textContent = overall.toFixed(0) + "%";
        refs.gonogoInhibition.textContent = state.gonogo.noGoCount > 0 ? inhibition.toFixed(0) + "%" : "-";
      }

      function finishGoNoGoGame() {
        stopGoNoGoTimers();
        state.gonogo.active = false;
        refs.gonogoStartBtn.disabled = false;
        refs.gonogoActBtn.disabled = true;

        const overall = ((state.gonogo.hits + state.gonogo.correctInhibitions) / state.gonogo.rounds) * 100;
        const inhibition = state.gonogo.noGoCount > 0 ? (state.gonogo.correctInhibitions / state.gonogo.noGoCount) * 100 : 0;
        const avgHitRt = state.gonogo.hits > 0 ? state.gonogo.hitRtTotal / state.gonogo.hits : 0;

        refs.gonogoDisplay.className = "gng-display";
        refs.gonogoSymbol.textContent = "完成";
        refs.gonogoHint.textContent = "命中 " + state.gonogo.hits + " 次，误报 " + state.gonogo.falseAlarms + " 次。";
        refs.gonogoAccuracy.textContent = overall.toFixed(0) + "%";
        refs.gonogoInhibition.textContent = state.gonogo.noGoCount > 0 ? inhibition.toFixed(0) + "%" : "-";
        refs.gonogoProgress.style.width = "100%";
        refs.gonogoStep.textContent = state.gonogo.rounds + " / " + state.gonogo.rounds;
        setStatus(
          refs.gonogoStatus,
          "完成，总准确率 " + overall.toFixed(0) + "%，抑制成功率 " + inhibition.toFixed(0) + "%。",
          overall >= 80 ? "ok" : ""
        );

        addRecord({
          id: "gonogo-" + Date.now(),
          game: "Go/No-Go",
          timestamp: Date.now(),
          durationMs: state.gonogo.durationMs,
          score: Number(overall.toFixed(2)),
          summary: state.gonogo.rounds + " 轮冲动克制",
          detailText: "抑制率 " + inhibition.toFixed(0) + "% / GO反应 " + formatShort(avgHitRt)
        });
      }


