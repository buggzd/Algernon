import { state, refs } from "../core/state.js";
import { shuffle, formatShort, setStatus } from "../core/utils.js";
import { addRecord } from "../core/records.js";
import { scheduleSavePreferences } from "../core/persistence.js";

      export function initReaction() {
        refs.reactionRounds.addEventListener("change", () => {
          if (!state.reaction.active) {
            state.reaction.rounds = Number(refs.reactionRounds.value);
            scheduleSavePreferences();
            state.reaction.status = "idle";
            state.reaction.falseStarts = 0;
            state.reaction.lastMs = null;
            state.reaction.completedRounds = 0;
            state.reaction.results = [];
            refs.reactionZone.className = "reaction-zone";
            refs.reactionTitle.textContent = "等待开始";
            refs.reactionText.textContent = "点击“开始整组测试”，看到绿色后立刻点这里。";
            setStatus(refs.reactionStatus, "点击“开始整组测试”后请耐心等待颜色切换。", "");
            updateReactionPanel();
          }
        });
        refs.reactionStartBtn.addEventListener("click", startReactionSession);
        refs.reactionZone.addEventListener("click", handleReactionTap);
        refs.reactionZone.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleReactionTap();
          }
        });
        updateReactionPanel();
      }

      function clearReactionTimer() {
        if (state.reaction.timeoutId) {
          clearTimeout(state.reaction.timeoutId);
          state.reaction.timeoutId = null;
        }
      }

      function startReactionSession() {
        clearReactionTimer();
        state.reaction.rounds = Number(refs.reactionRounds.value);
        state.reaction.active = true;
        state.reaction.status = "idle";
        state.reaction.falseStarts = 0;
        state.reaction.lastMs = null;
        state.reaction.completedRounds = 0;
        state.reaction.results = [];
        state.reaction.sessionStart = performance.now();
        refs.reactionStartBtn.disabled = true;
        refs.reactionZone.className = "reaction-zone";
        refs.reactionTitle.textContent = "准备开始";
        refs.reactionText.textContent = "整组测试开始后会自动连续多轮。";
        setStatus(refs.reactionStatus, "测试开始。每轮看到绿色后再点。", "");
        updateReactionPanel();
        queueReactionRound(400);
      }

      function queueReactionRound(delayMs) {
        clearReactionTimer();
        state.reaction.timeoutId = window.setTimeout(() => {
          prepareReactionRound();
        }, delayMs);
      }

      function prepareReactionRound() {
        if (!state.reaction.active) {
          return;
        }

        if (state.reaction.completedRounds >= state.reaction.rounds) {
          finishReactionSession();
          return;
        }

        state.reaction.status = "waiting";
        refs.reactionZone.className = "reaction-zone waiting";
        refs.reactionTitle.textContent = "第 " + (state.reaction.completedRounds + 1) + " 轮";
        refs.reactionText.textContent = "现在不要点，等它变绿。";
        updateReactionPanel();

        const delay = 1400 + Math.random() * 2200;
        clearReactionTimer();
        state.reaction.timeoutId = window.setTimeout(() => {
          state.reaction.status = "ready";
          state.reaction.readyTime = performance.now();
          refs.reactionZone.className = "reaction-zone ready";
          refs.reactionTitle.textContent = "第 " + (state.reaction.completedRounds + 1) + " 轮";
          refs.reactionText.textContent = "现在点，越快越好。";
        }, delay);
      }

      function handleReactionTap() {
        refs.reactionZone.classList.add("pressed");
        window.setTimeout(() => {
          refs.reactionZone.classList.remove("pressed");
        }, 100);

        if (!state.reaction.active) {
          return;
        }

        if (state.reaction.status === "waiting") {
          clearReactionTimer();
          state.reaction.status = "resetting";
          state.reaction.falseStarts += 1;
          refs.reactionZone.className = "reaction-zone";
          refs.reactionTitle.textContent = "抢跑了";
          refs.reactionText.textContent = "你点早了，这一轮将重来。";
          setStatus(refs.reactionStatus, "抢跑，这一轮重来。", "warn");
          updateReactionPanel();
          queueReactionRound(650);
          return;
        }

        if (state.reaction.status !== "ready") {
          return;
        }

        const reactionMs = performance.now() - state.reaction.readyTime;
        state.reaction.status = "resting";
        state.reaction.lastMs = Math.round(reactionMs);
        state.reaction.completedRounds += 1;
        state.reaction.results.push(Math.round(reactionMs));
        refs.reactionLast.textContent = formatShort(reactionMs);
        refs.reactionZone.className = "reaction-zone";
        refs.reactionTitle.textContent = "本轮完成";
        refs.reactionText.textContent = "本次反应 " + formatShort(reactionMs) + "。";
        setStatus(
          refs.reactionStatus,
          "已记录第 " + state.reaction.completedRounds + " 轮成绩。",
          reactionMs < 280 ? "ok" : ""
        );
        updateReactionPanel();

        if (state.reaction.completedRounds >= state.reaction.rounds) {
          queueReactionRound(450);
        } else {
          queueReactionRound(520);
        }
      }

      function updateReactionPanel() {
        const configuredRounds = state.reaction.active ? state.reaction.rounds : Number(refs.reactionRounds.value);
        const avgMs = state.reaction.results.length > 0
          ? state.reaction.results.reduce((sum, value) => sum + value, 0) / state.reaction.results.length
          : 0;
        const shownStep = state.reaction.active
          ? Math.min(state.reaction.completedRounds + 1, configuredRounds)
          : state.reaction.completedRounds > 0
          ? Math.min(state.reaction.completedRounds, configuredRounds)
          : 0;

        refs.reactionStep.textContent = shownStep + " / " + configuredRounds;
        refs.reactionLast.textContent = state.reaction.lastMs ? formatShort(state.reaction.lastMs) : "-";
        refs.reactionAvg.textContent = state.reaction.results.length > 0 ? formatShort(avgMs) : "-";
        refs.reactionFalseCount.textContent = String(state.reaction.falseStarts);
      }

      function finishReactionSession() {
        clearReactionTimer();
        state.reaction.active = false;
        state.reaction.status = "done";
        refs.reactionStartBtn.disabled = false;

        const avgMs = state.reaction.results.length > 0
          ? state.reaction.results.reduce((sum, value) => sum + value, 0) / state.reaction.results.length
          : 0;
        const bestMs = state.reaction.results.length > 0 ? Math.min(...state.reaction.results) : 0;
        const durationMs = performance.now() - state.reaction.sessionStart;

        refs.reactionZone.className = "reaction-zone";
        refs.reactionTitle.textContent = "整组完成";
        refs.reactionText.textContent = "平均 " + formatShort(avgMs) + "，最佳 " + formatShort(bestMs) + "。";
        refs.reactionStep.textContent = state.reaction.rounds + " / " + state.reaction.rounds;
        refs.reactionAvg.textContent = state.reaction.results.length > 0 ? formatShort(avgMs) : "-";
        refs.reactionLast.textContent = state.reaction.lastMs ? formatShort(state.reaction.lastMs) : "-";
        refs.reactionFalseCount.textContent = String(state.reaction.falseStarts);
        setStatus(
          refs.reactionStatus,
          "完成，平均 " + formatShort(avgMs) + "，最佳 " + formatShort(bestMs) + "。",
          avgMs > 0 && avgMs < 300 ? "ok" : ""
        );

        addRecord({
          id: "reaction-" + Date.now(),
          game: "反应时",
          timestamp: Date.now(),
          durationMs: Math.round(durationMs),
          metricMs: Math.round(avgMs),
          bestMs: Math.round(bestMs),
          score: avgMs > 0 ? Number((1000 / avgMs).toFixed(2)) : 0,
          summary: state.reaction.rounds + " 轮反应测试",
          detailText: "平均 " + formatShort(avgMs) + " / 最佳 " + formatShort(bestMs) + " / 抢跑 " + state.reaction.falseStarts
        });
      }


