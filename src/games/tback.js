import { state, refs } from "../core/state.js";
import { shuffle, formatDuration, setStatus } from "../core/utils.js";
import { addRecord } from "../core/records.js";
import { scheduleSavePreferences } from "../core/persistence.js";

      export function initTBack() {
        refs.tbackLevel.addEventListener("change", () => {
          scheduleSavePreferences();
          updateTBackIdleStatus();
        });
        refs.tbackRounds.addEventListener("change", () => { scheduleSavePreferences(); });
        refs.tbackInterval.addEventListener("change", () => { scheduleSavePreferences(); });
        refs.tbackStartBtn.addEventListener("click", startTBackGame);
        refs.tbackMatchBtn.addEventListener("click", registerTBackMatch);
        updateTBackIdleStatus();
        updateTBackPanel();
      }

      function getTBackLevelText() {
        return (Number(refs.tbackLevel.value) || state.tback.level) + "-Back";
      }

      function updateTBackIdleStatus() {
        if (state.tback.active) {
          return;
        }
        setStatus(refs.tbackStatus, "当前设置：" + getTBackLevelText() + "。保持稳定节奏，不要抢点。", "");
      }

      function buildTBackSequence(rounds, level) {
        const alphabet = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P", "Q", "R", "S", "T"];
        const seq = [];
        for (let i = 0; i < rounds; i += 1) {
          if (i >= level && Math.random() < 0.34) {
            seq.push(seq[i - level]);
          } else {
            let next = alphabet[Math.floor(Math.random() * alphabet.length)];
            if (i >= level && next === seq[i - level]) {
              const alternatives = alphabet.filter((ch) => ch !== seq[i - level]);
              next = alternatives[Math.floor(Math.random() * alternatives.length)];
            }
            seq.push(next);
          }
        }
        return seq;
      }

      function startTBackGame() {
        stopTBackTimers();
        state.tback.level = Number(refs.tbackLevel.value);
        state.tback.rounds = Number(refs.tbackRounds.value);
        state.tback.interval = Number(refs.tbackInterval.value);
        scheduleSavePreferences();
        state.tback.sequence = buildTBackSequence(state.tback.rounds, state.tback.level);
        state.tback.currentIndex = -1;
        state.tback.active = true;
        state.tback.pressedIndices = new Set();
        state.tback.hits = 0;
        state.tback.misses = 0;
        state.tback.falseAlarms = 0;
        state.tback.targets = 0;
        state.tback.durationMs = state.tback.rounds * state.tback.interval;
        refs.tbackMatchBtn.disabled = false;
        refs.tbackStartBtn.disabled = true;
        refs.tbackSymbol.textContent = "...";
        refs.tbackHint.textContent = "训练已开始，注意当前字母与 " + state.tback.level + " 步前是否一致。";
        setStatus(refs.tbackStatus, "训练中：" + state.tback.level + "-Back。只有在你判断相同时才点“匹配”。", "");
        nextTBackStep();
      }

      function stopTBackTimers() {
        if (state.tback.timerId) {
          clearTimeout(state.tback.timerId);
          state.tback.timerId = null;
        }
      }

      function nextTBackStep() {
        state.tback.currentIndex += 1;

        if (state.tback.currentIndex >= state.tback.rounds) {
          finishTBackGame();
          return;
        }

        const symbol = state.tback.sequence[state.tback.currentIndex];
        state.tback.stepStartedAt = performance.now();
        refs.tbackSymbol.textContent = symbol;
        refs.tbackStep.textContent = (state.tback.currentIndex + 1) + " / " + state.tback.rounds;
        refs.tbackProgress.style.width = (((state.tback.currentIndex + 1) / state.tback.rounds) * 100).toFixed(1) + "%";
        updateTBackPanel();

        state.tback.timerId = window.setTimeout(() => {
          evaluateCurrentTBackStep();
          nextTBackStep();
        }, state.tback.interval);
      }

      function registerTBackMatch() {
        if (!state.tback.active) {
          return;
        }
        state.tback.pressedIndices.add(state.tback.currentIndex);
        refs.tbackHint.textContent = "已标记第 " + (state.tback.currentIndex + 1) + " 轮。";
      }

      function evaluateCurrentTBackStep() {
        const i = state.tback.currentIndex;
        const isTarget = i >= state.tback.level && state.tback.sequence[i] === state.tback.sequence[i - state.tback.level];
        const pressed = state.tback.pressedIndices.has(i);

        if (isTarget) {
          state.tback.targets += 1;
          if (pressed) {
            state.tback.hits += 1;
          } else {
            state.tback.misses += 1;
          }
        } else if (pressed) {
          state.tback.falseAlarms += 1;
        }

        updateTBackPanel();
      }

      function updateTBackPanel() {
        const totalChecked = state.tback.hits + state.tback.misses + state.tback.falseAlarms;
        const correct = state.tback.hits + Math.max((state.tback.currentIndex + 1) - state.tback.targets - state.tback.falseAlarms, 0);
        const denominator = Math.max(state.tback.currentIndex + 1, 1);
        const accuracy = Math.max(Math.min((correct / denominator) * 100, 100), 0);
        refs.tbackAccuracy.textContent = accuracy.toFixed(0) + "%";
        refs.tbackFalse.textContent = String(state.tback.falseAlarms);

        if (!state.tback.active && totalChecked === 0) {
          refs.tbackStep.textContent = "0 / 0";
          refs.tbackProgress.style.width = "0%";
        }
      }

      function finishTBackGame() {
        stopTBackTimers();
        state.tback.active = false;
        refs.tbackMatchBtn.disabled = true;
        refs.tbackStartBtn.disabled = false;

        const totalRounds = state.tback.rounds;
        const correctNonTargets = totalRounds - state.tback.targets - state.tback.falseAlarms;
        const accuracy = ((state.tback.hits + Math.max(correctNonTargets, 0)) / totalRounds) * 100;
        refs.tbackAccuracy.textContent = accuracy.toFixed(0) + "%";
        refs.tbackHint.textContent = "训练结束。命中 " + state.tback.hits + " 次，漏报 " + state.tback.misses + " 次。";
        setStatus(
          refs.tbackStatus,
          "完成，准确率 " + accuracy.toFixed(0) + "%，误报 " + state.tback.falseAlarms + " 次。",
          accuracy >= 80 ? "ok" : ""
        );

        addRecord({
          id: "tback-" + Date.now(),
          game: "T-Back",
          timestamp: Date.now(),
          durationMs: state.tback.durationMs,
          score: Number(accuracy.toFixed(2)),
          summary: state.tback.level + "-Back · " + totalRounds + " 轮",
          detailText: "准确率 " + accuracy.toFixed(0) + "% / 误报 " + state.tback.falseAlarms
        });
      }

