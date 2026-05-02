import { state, refs } from "../core/state.js";
import { shuffle, formatShort, setStatus } from "../core/utils.js";
import { addRecord } from "../core/records.js";
import { scheduleSavePreferences } from "../core/persistence.js";

const STROOP_COLORS = [
        { key: "red", label: "红", value: "#dc2626", text: "#ffffff" },
        { key: "blue", label: "蓝", value: "#2563eb", text: "#ffffff" },
        { key: "green", label: "绿", value: "#16a34a", text: "#ffffff" },
        { key: "yellow", label: "黄", value: "#ca8a04", text: "#111827" },
        { key: "purple", label: "紫", value: "#7c3aed", text: "#ffffff" }
      ];

      export function initStroop() {
        refs.stroopRounds.addEventListener("change", () => {
          if (!state.stroop.active) {
            state.stroop.rounds = Number(refs.stroopRounds.value);
            scheduleSavePreferences();
            updateStroopPanel();
          }
        });
        refs.stroopStartBtn.addEventListener("click", startStroopGame);
        renderStroopOptions([], true);
        updateStroopPanel();
      }

      function buildStroopTrials(rounds) {
        const trials = [];
        for (let i = 0; i < rounds; i += 1) {
          const wordSource = STROOP_COLORS[Math.floor(Math.random() * STROOP_COLORS.length)];
          const congruent = Math.random() < 0.38;
          let colorSource = wordSource;

          if (!congruent) {
            const alternatives = STROOP_COLORS.filter((item) => item.key !== wordSource.key);
            colorSource = alternatives[Math.floor(Math.random() * alternatives.length)];
          }

          trials.push({
            wordLabel: wordSource.label,
            colorKey: colorSource.key,
            colorValue: colorSource.value,
            colorLabel: colorSource.label
          });
        }
        return trials;
      }

      function renderStroopOptions(order, disabled) {
        const choices = order.length > 0 ? order : STROOP_COLORS;
        refs.stroopOptions.innerHTML = "";

        choices.forEach((item) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "color-btn";
          button.textContent = item.label;
          button.style.background = item.value;
          button.style.color = item.text;
          button.disabled = disabled;
          button.addEventListener("click", () => {
            handleStroopAnswer(item.key);
          });
          refs.stroopOptions.appendChild(button);
        });
      }

      function startStroopGame() {
        state.stroop.rounds = Number(refs.stroopRounds.value);
        state.stroop.trials = buildStroopTrials(state.stroop.rounds);
        state.stroop.currentIndex = -1;
        state.stroop.currentTrial = null;
        state.stroop.active = true;
        state.stroop.locked = false;
        state.stroop.startTime = performance.now();
        state.stroop.trialStartedAt = 0;
        state.stroop.correct = 0;
        state.stroop.wrong = 0;
        state.stroop.totalRt = 0;
        state.stroop.optionOrder = [];
        refs.stroopStartBtn.disabled = true;
        refs.stroopDisplay.className = "stroop-display";
        refs.stroopWord.style.color = "var(--ink)";
        refs.stroopProgress.style.width = "0%";
        setStatus(refs.stroopStatus, "训练开始。盯住颜色，不要被文字含义误导。", "");
        nextStroopTrial();
      }

      function nextStroopTrial() {
        state.stroop.currentIndex += 1;

        if (state.stroop.currentIndex >= state.stroop.rounds) {
          finishStroopGame();
          return;
        }

        state.stroop.currentTrial = state.stroop.trials[state.stroop.currentIndex];
        state.stroop.optionOrder = shuffle(STROOP_COLORS);
        state.stroop.locked = false;
        state.stroop.trialStartedAt = performance.now();
        refs.stroopWord.textContent = state.stroop.currentTrial.wordLabel;
        refs.stroopWord.style.color = state.stroop.currentTrial.colorValue;
        refs.stroopHint.textContent = "按显示颜色作答，第 " + (state.stroop.currentIndex + 1) + " 轮。";
        renderStroopOptions(state.stroop.optionOrder, false);
        updateStroopPanel();
      }

      function handleStroopAnswer(colorKey) {
        if (!state.stroop.active || state.stroop.locked || !state.stroop.currentTrial) {
          return;
        }

        state.stroop.locked = true;
        const rt = performance.now() - state.stroop.trialStartedAt;
        const isCorrect = colorKey === state.stroop.currentTrial.colorKey;
        state.stroop.totalRt += rt;

        if (isCorrect) {
          state.stroop.correct += 1;
          refs.stroopHint.textContent = "正确。";
          setStatus(refs.stroopStatus, "正确，继续下一轮。", "ok");
        } else {
          state.stroop.wrong += 1;
          refs.stroopHint.textContent = "正确答案是 " + state.stroop.currentTrial.colorLabel + "。";
          setStatus(refs.stroopStatus, "答错了，正确颜色是 " + state.stroop.currentTrial.colorLabel + "。", "warn");
        }

        renderStroopOptions(state.stroop.optionOrder, true);
        updateStroopPanel();

        window.setTimeout(() => {
          nextStroopTrial();
        }, 260);
      }

      function updateStroopPanel() {
        const configuredRounds = state.stroop.active ? state.stroop.rounds : Number(refs.stroopRounds.value);
        const answered = state.stroop.correct + state.stroop.wrong;
        const currentShown = state.stroop.active ? Math.min(state.stroop.currentIndex + 1, configuredRounds) : 0;
        const accuracy = answered > 0 ? (state.stroop.correct / answered) * 100 : 0;
        const avgRt = answered > 0 ? state.stroop.totalRt / answered : 0;

        refs.stroopStep.textContent = currentShown + " / " + configuredRounds;
        refs.stroopAccuracy.textContent = accuracy.toFixed(0) + "%";
        refs.stroopAvgRt.textContent = answered > 0 ? formatShort(avgRt) : "-";
        refs.stroopProgress.style.width = (configuredRounds > 0 ? (answered / configuredRounds) * 100 : 0).toFixed(1) + "%";
      }

      function finishStroopGame() {
        state.stroop.active = false;
        state.stroop.locked = false;
        refs.stroopStartBtn.disabled = false;

        const answered = state.stroop.correct + state.stroop.wrong;
        const accuracy = answered > 0 ? (state.stroop.correct / answered) * 100 : 0;
        const avgRt = answered > 0 ? state.stroop.totalRt / answered : 0;
        const durationMs = performance.now() - state.stroop.startTime;

        refs.stroopWord.textContent = "完成";
        refs.stroopWord.style.color = "var(--brand)";
        refs.stroopHint.textContent = "本轮结束，重新开始可生成新的干扰序列。";
        renderStroopOptions(state.stroop.optionOrder, true);
        refs.stroopProgress.style.width = "100%";
        refs.stroopStep.textContent = state.stroop.rounds + " / " + state.stroop.rounds;
        refs.stroopAccuracy.textContent = accuracy.toFixed(0) + "%";
        refs.stroopAvgRt.textContent = answered > 0 ? formatShort(avgRt) : "-";
        setStatus(
          refs.stroopStatus,
          "完成，正确率 " + accuracy.toFixed(0) + "%，平均反应 " + formatShort(avgRt) + "。",
          accuracy >= 80 ? "ok" : ""
        );

        addRecord({
          id: "stroop-" + Date.now(),
          game: "Stroop",
          timestamp: Date.now(),
          durationMs: Math.round(durationMs),
          score: Number(accuracy.toFixed(2)),
          summary: state.stroop.rounds + " 轮色词测试",
          detailText: "正确率 " + accuracy.toFixed(0) + "% / 平均反应 " + formatShort(avgRt)
        });
      }


