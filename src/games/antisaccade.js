import { state, refs } from "../core/state.js";
import { shuffle, formatShort, setStatus } from "../core/utils.js";
import { addRecord } from "../core/records.js";
import { scheduleSavePreferences } from "../core/persistence.js";

      export function initAntiSaccade() {
        refs.antisaccadeRounds.addEventListener("change", () => {
          if (!state.antisaccade.active) {
            state.antisaccade.rounds = Number(refs.antisaccadeRounds.value);
            scheduleSavePreferences();
            state.antisaccade.currentIndex = -1;
            state.antisaccade.currentStimulus = null;
            state.antisaccade.hits = 0;
            state.antisaccade.wrong = 0;
            state.antisaccade.misses = 0;
            state.antisaccade.totalRt = 0;
            renderAntiSaccadeBoard();
            refs.antisaccadeHint.textContent = "看到哪边动，就先看反方向，再把视线带回中间，最后点击你看的那一侧。";
            setStatus(refs.antisaccadeStatus, "重点不是快按，而是先完成“反方向看一眼，再回中心”的动作序列。", "");
            updateAntiSaccadePanel();
          }
        });
        refs.antisaccadeStartBtn.addEventListener("click", startAntiSaccadeGame);
        refs.antisaccadeLeftBtn.addEventListener("click", () => {
          handleAntiSaccadeAnswer("left");
        });
        refs.antisaccadeRightBtn.addEventListener("click", () => {
          handleAntiSaccadeAnswer("right");
        });
        renderAntiSaccadeBoard();
        updateAntiSaccadePanel();
      }

      function buildAntiSaccadeSequence(rounds) {
        return Array.from({ length: rounds }, () => (Math.random() < 0.5 ? "left" : "right"));
      }

      function stopAntiSaccadeTimer() {
        if (state.antisaccade.timeoutId) {
          clearTimeout(state.antisaccade.timeoutId);
          state.antisaccade.timeoutId = null;
        }
      }

      function renderAntiSaccadeBoard(stimulusSide, answerSide, answerTone) {
        refs.antisaccadeLeftBtn.className = "saccade-node";
        refs.antisaccadeRightBtn.className = "saccade-node";
        refs.antisaccadeCenterNode.className = "saccade-node center";
        refs.antisaccadeLeftSymbol.textContent = "◐";
        refs.antisaccadeCenterSymbol.textContent = "◎";
        refs.antisaccadeRightSymbol.textContent = "◑";

        if (stimulusSide === "left") {
          refs.antisaccadeLeftBtn.classList.add("stimulus");
          refs.antisaccadeLeftSymbol.textContent = "✦";
        } else if (stimulusSide === "right") {
          refs.antisaccadeRightBtn.classList.add("stimulus");
          refs.antisaccadeRightSymbol.textContent = "✦";
        }

        if (answerSide === "left") {
          refs.antisaccadeLeftBtn.classList.add(answerTone);
        } else if (answerSide === "right") {
          refs.antisaccadeRightBtn.classList.add(answerTone);
        }
      }

      function startAntiSaccadeGame() {
        stopAntiSaccadeTimer();
        state.antisaccade.rounds = Number(refs.antisaccadeRounds.value);
        state.antisaccade.sequence = buildAntiSaccadeSequence(state.antisaccade.rounds);
        state.antisaccade.currentIndex = -1;
        state.antisaccade.currentStimulus = null;
        state.antisaccade.trialStartedAt = 0;
        state.antisaccade.sessionStart = performance.now();
        state.antisaccade.active = true;
        state.antisaccade.awaitingResponse = false;
        state.antisaccade.hits = 0;
        state.antisaccade.wrong = 0;
        state.antisaccade.misses = 0;
        state.antisaccade.totalRt = 0;
        refs.antisaccadeStartBtn.disabled = true;
        refs.antisaccadeLeftBtn.disabled = false;
        refs.antisaccadeRightBtn.disabled = false;
        refs.antisaccadeProgress.style.width = "0%";
        refs.antisaccadeHint.textContent = "刺激会出现在左右一侧。先看反方向，再回中，然后点击你看的那一侧。";
        setStatus(refs.antisaccadeStatus, "训练开始。先做反扫视动作，再完成点击。", "");
        nextAntiSaccadeTrial();
      }

      function nextAntiSaccadeTrial() {
        state.antisaccade.currentIndex += 1;

        if (state.antisaccade.currentIndex >= state.antisaccade.rounds) {
          finishAntiSaccadeGame();
          return;
        }

        state.antisaccade.currentStimulus = state.antisaccade.sequence[state.antisaccade.currentIndex];
        state.antisaccade.awaitingResponse = true;
        state.antisaccade.trialStartedAt = performance.now();
        renderAntiSaccadeBoard(state.antisaccade.currentStimulus);
        refs.antisaccadeHint.textContent = "先看反方向，再回中，然后点你看的那一侧。";
        refs.antisaccadeProgress.style.width = (((state.antisaccade.currentIndex + 1) / state.antisaccade.rounds) * 100).toFixed(1) + "%";
        updateAntiSaccadePanel();

        state.antisaccade.timeoutId = window.setTimeout(() => {
          if (!state.antisaccade.awaitingResponse) {
            return;
          }
          state.antisaccade.awaitingResponse = false;
          state.antisaccade.misses += 1;
          refs.antisaccadeHint.textContent = "超时，这一轮记为未完成。";
          setStatus(refs.antisaccadeStatus, "超时，下一轮继续。", "warn");
          updateAntiSaccadePanel();
          renderAntiSaccadeBoard(state.antisaccade.currentStimulus);
          state.antisaccade.timeoutId = window.setTimeout(() => {
            nextAntiSaccadeTrial();
          }, 380);
        }, 2100);
      }

      function handleAntiSaccadeAnswer(side) {
        if (!state.antisaccade.active || !state.antisaccade.awaitingResponse) {
          return;
        }

        stopAntiSaccadeTimer();
        state.antisaccade.awaitingResponse = false;
        const rt = performance.now() - state.antisaccade.trialStartedAt;
        const correctSide = state.antisaccade.currentStimulus === "left" ? "right" : "left";
        const isCorrect = side === correctSide;
        state.antisaccade.totalRt += rt;

        if (isCorrect) {
          state.antisaccade.hits += 1;
          refs.antisaccadeHint.textContent = "正确。继续保持先看反方向，再回中。";
          setStatus(refs.antisaccadeStatus, "正确。", "ok");
        } else {
          state.antisaccade.wrong += 1;
          refs.antisaccadeHint.textContent = "这轮点错了。刺激在哪边，就应该点相反侧。";
          setStatus(refs.antisaccadeStatus, "方向选错了。", "warn");
        }

        renderAntiSaccadeBoard(state.antisaccade.currentStimulus, side, isCorrect ? "correct" : "wrong");
        updateAntiSaccadePanel();

        state.antisaccade.timeoutId = window.setTimeout(() => {
          nextAntiSaccadeTrial();
        }, 320);
      }

      function updateAntiSaccadePanel() {
        const configuredRounds = state.antisaccade.active ? state.antisaccade.rounds : Number(refs.antisaccadeRounds.value);
        const finishedCount = state.antisaccade.hits + state.antisaccade.wrong + state.antisaccade.misses;
        const shownStep = state.antisaccade.active
          ? Math.min(state.antisaccade.currentIndex + 1, configuredRounds)
          : finishedCount > 0
          ? Math.min(finishedCount, configuredRounds)
          : 0;
        const accuracy = finishedCount > 0 ? (state.antisaccade.hits / finishedCount) * 100 : 0;
        const respondedCount = state.antisaccade.hits + state.antisaccade.wrong;
        const avgRt = respondedCount > 0 ? state.antisaccade.totalRt / respondedCount : 0;

        refs.antisaccadeStep.textContent = shownStep + " / " + configuredRounds;
        refs.antisaccadeAccuracy.textContent = accuracy.toFixed(0) + "%";
        refs.antisaccadeAvg.textContent = respondedCount > 0 ? formatShort(avgRt) : "-";
        if (!state.antisaccade.active) {
          refs.antisaccadeProgress.style.width = (configuredRounds > 0 ? (finishedCount / configuredRounds) * 100 : 0).toFixed(1) + "%";
        }
      }

      function finishAntiSaccadeGame() {
        stopAntiSaccadeTimer();
        state.antisaccade.active = false;
        state.antisaccade.awaitingResponse = false;
        refs.antisaccadeStartBtn.disabled = false;
        refs.antisaccadeLeftBtn.disabled = true;
        refs.antisaccadeRightBtn.disabled = true;

        const finishedCount = state.antisaccade.hits + state.antisaccade.wrong + state.antisaccade.misses;
        const accuracy = finishedCount > 0 ? (state.antisaccade.hits / finishedCount) * 100 : 0;
        const respondedCount = state.antisaccade.hits + state.antisaccade.wrong;
        const avgRt = respondedCount > 0 ? state.antisaccade.totalRt / respondedCount : 0;
        const durationMs = performance.now() - state.antisaccade.sessionStart;

        renderAntiSaccadeBoard();
        refs.antisaccadeProgress.style.width = "100%";
        refs.antisaccadeStep.textContent = state.antisaccade.rounds + " / " + state.antisaccade.rounds;
        refs.antisaccadeAccuracy.textContent = accuracy.toFixed(0) + "%";
        refs.antisaccadeAvg.textContent = respondedCount > 0 ? formatShort(avgRt) : "-";
        refs.antisaccadeHint.textContent = "这一组结束。下次开始会生成新的左右刺激顺序。";
        setStatus(
          refs.antisaccadeStatus,
          "完成，正确率 " + accuracy.toFixed(0) + "%，平均响应 " + formatShort(avgRt) + "。",
          accuracy >= 80 ? "ok" : ""
        );

        addRecord({
          id: "antisaccade-" + Date.now(),
          game: "反扫视",
          timestamp: Date.now(),
          durationMs: Math.round(durationMs),
          metricMs: respondedCount > 0 ? Math.round(avgRt) : 0,
          score: Number(accuracy.toFixed(2)),
          summary: state.antisaccade.rounds + " 轮反扫视",
          detailText: "正确率 " + accuracy.toFixed(0) + "% / 平均响应 " + formatShort(avgRt) + " / 超时 " + state.antisaccade.misses
        });
      }

