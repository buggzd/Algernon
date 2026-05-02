import { state, refs } from "../core/state.js";
import { shuffle, formatShort, setStatus } from "../core/utils.js";
import { addRecord } from "../core/records.js";
import { scheduleSavePreferences } from "../core/persistence.js";

const SUSTAINED_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const SUSTAINED_SYMBOLS = ["+", "-", "%", "#"];

export function initSustained() {
        const resetWhenIdle = () => {
          if (state.sustained.active) {
            return;
          }

          state.sustained.rounds = Number(refs.sustainedRounds.value);
          state.sustained.interval = Number(refs.sustainedInterval.value);
          state.sustained.poolSize = Number(refs.sustainedPoolSize.value);
          state.sustained.customLetters = refs.sustainedLetters.value;
          state.sustained.sequence = [];
          state.sustained.targetLetters = [];
          state.sustained.currentIndex = -1;
          state.sustained.currentStimulus = null;
          state.sustained.stepStartedAt = 0;
          state.sustained.responses = new Map();
          state.sustained.hits = 0;
          state.sustained.misses = 0;
          state.sustained.falseAlarms = 0;
          state.sustained.correctSkips = 0;
          state.sustained.totalRt = 0;
          state.sustained.sessionStart = 0;
          refs.sustainedZone.className = "sustained-zone";
          refs.sustainedStimulus.textContent = "准备";
          refs.sustainedText.textContent = "点击开始后，字符会连续出现。看到目标字母就点这里，看到其他字母或符号就保持不动。";
          refs.sustainedProgress.style.width = "0%";
          setStatus(refs.sustainedStatus, "保持一条规则即可：只有目标字母点，其他字母和符号都别点。开始后会自动连续呈现整组刺激。", "");
          updateSustainedPoolPreview();
          updateSustainedPanel();
        };

        refs.sustainedRounds.addEventListener("change", () => { scheduleSavePreferences(); resetWhenIdle(); });
        refs.sustainedInterval.addEventListener("change", () => { scheduleSavePreferences(); resetWhenIdle(); });
        refs.sustainedPoolSize.addEventListener("change", () => { scheduleSavePreferences(); resetWhenIdle(); });
        refs.sustainedLetters.addEventListener("input", resetWhenIdle);
        refs.sustainedLetters.addEventListener("change", () => {
          if (state.sustained.active) {
            return;
          }
          const normalized = sanitizeSustainedLetters(refs.sustainedLetters.value);
          refs.sustainedLetters.value = normalized.length ? normalized.join(" ") : "X";
          scheduleSavePreferences();
          resetWhenIdle();
        });
        refs.sustainedStartBtn.addEventListener("click", startSustainedGame);
        refs.sustainedZone.addEventListener("pointerdown", registerSustainedResponse);
        refs.sustainedZone.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            registerSustainedResponse(event);
          }
        });

        resetWhenIdle();
      }

      function sanitizeSustainedLetters(raw) {
        const matches = String(raw || "").toUpperCase().match(/[A-Z]/g) || [];
        return matches.filter((letter, index) => matches.indexOf(letter) === index);
      }

      function buildSustainedTargetConfig(poolSize, customLettersRaw) {
        const requestedSize = Math.max(1, Math.min(6, Number(poolSize) || 1));
        const typedLetters = sanitizeSustainedLetters(customLettersRaw);
        const fallbackLetters = typedLetters.length ? typedLetters : ["X"];
        const targetLetters = fallbackLetters.slice(0, requestedSize);

        return {
          targetLetters,
          requestedSize,
          typedLetters,
          usingDefaultX: typedLetters.length === 0,
          hasOverflow: fallbackLetters.length > requestedSize
        };
      }

      function updateSustainedPoolPreview() {
        const targetInfo = buildSustainedTargetConfig(refs.sustainedPoolSize.value, refs.sustainedLetters.value);
        updateSustainedRuleSummary(targetInfo);

        if (targetInfo.usingDefaultX) {
          refs.sustainedPool.textContent = "当前目标字母：X。未填写时默认只对 X 点按。";
          return;
        }

        if (targetInfo.typedLetters.length < targetInfo.requestedSize) {
          refs.sustainedPool.textContent = "当前已设置目标字母：" + targetInfo.targetLetters.join(" / ") + "。如需更多，可继续补充到最多 " + targetInfo.requestedSize + " 个。";
          return;
        }

        if (targetInfo.hasOverflow) {
          refs.sustainedPool.textContent = "当前生效目标字母：" + targetInfo.targetLetters.join(" / ") + "。多出的字母暂未启用。";
          return;
        }

        refs.sustainedPool.textContent = "当前目标字母：" + targetInfo.targetLetters.join(" / ");
      }

      function updateSustainedRuleSummary(targetInfo) {
        if (!refs.sustainedRuleSummary) {
          return;
        }

        const configuredRounds = Number(refs.sustainedRounds.value) || state.sustained.rounds;
        const intervalLabel = refs.sustainedInterval.options[refs.sustainedInterval.selectedIndex]?.textContent || "标准";
        const tempoText = intervalLabel.endsWith("节奏") ? intervalLabel : intervalLabel + "节奏";
        refs.sustainedRuleSummary.textContent = "当前规则：只点 " + targetInfo.targetLetters.join(" / ") + "；" + configuredRounds + " 个刺激；" + tempoText + "。其余字母和符号不点。";
      }

      function buildSustainedSequence(rounds, targetLetters) {
        const totalRounds = Math.max(1, Number(rounds) || 48);
        const nonTargetLetters = SUSTAINED_ALPHABET.filter((letter) => !targetLetters.includes(letter));
        const targetCount = Math.max(8, Math.min(totalRounds - 12, Math.round(totalRounds * 0.26)));
        const symbolCount = Math.max(8, Math.min(totalRounds - targetCount - 1, Math.round(totalRounds * 0.22)));
        const letterCount = Math.max(totalRounds - targetCount - symbolCount, 1);
        const categories = [];

        for (let i = 0; i < targetCount; i += 1) {
          categories.push("target");
        }
        for (let i = 0; i < letterCount; i += 1) {
          categories.push("letter");
        }
        for (let i = 0; i < symbolCount; i += 1) {
          categories.push("symbol");
        }

        return shuffle(categories).slice(0, totalRounds).map((type) => {
          if (type === "target") {
            return {
              type: "target",
              value: targetLetters[Math.floor(Math.random() * targetLetters.length)]
            };
          }
          if (type === "letter") {
            return {
              type: "letter",
              value: nonTargetLetters[Math.floor(Math.random() * nonTargetLetters.length)]
            };
          }
          return {
            type: "symbol",
            value: SUSTAINED_SYMBOLS[Math.floor(Math.random() * SUSTAINED_SYMBOLS.length)]
          };
        });
      }

      function stopSustainedTimer() {
        if (state.sustained.timeoutId) {
          clearTimeout(state.sustained.timeoutId);
          state.sustained.timeoutId = null;
        }
      }

      function startSustainedGame() {
        stopSustainedTimer();
        state.sustained.rounds = Number(refs.sustainedRounds.value);
        state.sustained.interval = Number(refs.sustainedInterval.value);
        state.sustained.poolSize = Number(refs.sustainedPoolSize.value);
        state.sustained.customLetters = refs.sustainedLetters.value;
        const targetInfo = buildSustainedTargetConfig(state.sustained.poolSize, state.sustained.customLetters);
        updateSustainedRuleSummary(targetInfo);
        state.sustained.targetLetters = targetInfo.targetLetters;
        state.sustained.sequence = buildSustainedSequence(state.sustained.rounds, state.sustained.targetLetters);
        state.sustained.currentIndex = -1;
        state.sustained.currentStimulus = null;
        state.sustained.stepStartedAt = 0;
        state.sustained.active = true;
        state.sustained.responses = new Map();
        state.sustained.hits = 0;
        state.sustained.misses = 0;
        state.sustained.falseAlarms = 0;
        state.sustained.correctSkips = 0;
        state.sustained.totalRt = 0;
        state.sustained.sessionStart = performance.now();
        refs.sustainedStartBtn.disabled = true;
        refs.sustainedZone.className = "sustained-zone active";
        refs.sustainedStimulus.textContent = "准备";
        refs.sustainedText.textContent = "马上开始。把规则保持住：只有目标字母点，其他字母和符号都不点。";
        refs.sustainedPool.textContent = "本组目标字母：" + state.sustained.targetLetters.join(" / ");
        refs.sustainedProgress.style.width = "0%";
        setStatus(refs.sustainedStatus, "训练开始。刺激会连续出现，先稳住节奏。", "");
        updateSustainedPanel();

        state.sustained.timeoutId = window.setTimeout(() => {
          nextSustainedStimulus();
        }, 800);
      }

      function nextSustainedStimulus() {
        if (!state.sustained.active) {
          return;
        }

        state.sustained.currentIndex += 1;
        if (state.sustained.currentIndex >= state.sustained.rounds) {
          finishSustainedGame();
          return;
        }

        state.sustained.currentStimulus = state.sustained.sequence[state.sustained.currentIndex];
        state.sustained.stepStartedAt = performance.now();
        refs.sustainedZone.className = "sustained-zone active";
        refs.sustainedStimulus.style.animation = "none";
        refs.sustainedStimulus.textContent = state.sustained.currentStimulus.value;
        void refs.sustainedStimulus.offsetWidth;
        refs.sustainedStimulus.style.animation = "";
        refs.sustainedText.textContent = "保持规则：只有目标字母点，其他字母和符号都不点。";
        updateSustainedPanel();

        state.sustained.timeoutId = window.setTimeout(() => {
          evaluateSustainedStimulus();
          nextSustainedStimulus();
        }, state.sustained.interval);
      }

      function registerSustainedResponse(event) {
        if (event && typeof event.preventDefault === "function") {
          event.preventDefault();
        }

        if (!state.sustained.active || state.sustained.currentIndex < 0) {
          return;
        }

        refs.sustainedZone.classList.remove("pressed");
        void refs.sustainedZone.offsetWidth;
        refs.sustainedZone.classList.add("pressed");
        window.setTimeout(() => {
          refs.sustainedZone.classList.remove("pressed");
        }, 90);

        if (state.sustained.responses.has(state.sustained.currentIndex)) {
          return;
        }

        state.sustained.responses.set(
          state.sustained.currentIndex,
          performance.now() - state.sustained.stepStartedAt
        );
        refs.sustainedText.textContent = "本次点击已记录，准备接下一个字符。";
      }

      function evaluateSustainedStimulus() {
        const stimulus = state.sustained.sequence[state.sustained.currentIndex];
        const responded = state.sustained.responses.has(state.sustained.currentIndex);

        if (!stimulus) {
          return;
        }

        if (stimulus.type === "target") {
          if (responded) {
            state.sustained.hits += 1;
            state.sustained.totalRt += state.sustained.responses.get(state.sustained.currentIndex);
          } else {
            state.sustained.misses += 1;
            refs.sustainedText.textContent = "刚才漏按了一次目标字母，继续盯住下一个字符。";
            setStatus(refs.sustainedStatus, "出现漏按，后面继续把节奏拉回来。", "warn");
          }
        } else if (responded) {
          state.sustained.falseAlarms += 1;
          refs.sustainedText.textContent = "刚才不是目标字母，误按已记录。继续。";
          setStatus(refs.sustainedStatus, "刚才对非目标刺激出手了，误按已记录。", "warn");
        } else {
          state.sustained.correctSkips += 1;
        }

        updateSustainedPanel();
      }

      function updateSustainedPanel() {
        const configuredRounds = state.sustained.active ? state.sustained.rounds : Number(refs.sustainedRounds.value);
        const evaluated = state.sustained.hits + state.sustained.misses + state.sustained.falseAlarms + state.sustained.correctSkips;
        const shownStep = state.sustained.active
          ? Math.max(0, Math.min(state.sustained.currentIndex + 1, configuredRounds))
          : evaluated > 0
          ? Math.min(evaluated, configuredRounds)
          : 0;
        const accuracy = evaluated > 0
          ? ((state.sustained.hits + state.sustained.correctSkips) / evaluated) * 100
          : 0;
        const avgRt = state.sustained.hits > 0 ? state.sustained.totalRt / state.sustained.hits : 0;
        const progressBase = state.sustained.active ? shownStep : evaluated;

        refs.sustainedStep.textContent = shownStep + " / " + configuredRounds;
        refs.sustainedAccuracy.textContent = accuracy.toFixed(0) + "%";
        refs.sustainedAvgRt.textContent = state.sustained.hits > 0 ? formatShort(avgRt) : "-";
        refs.sustainedMisses.textContent = String(state.sustained.misses);
        refs.sustainedFalse.textContent = String(state.sustained.falseAlarms);
        refs.sustainedProgress.style.width = (configuredRounds > 0 ? (progressBase / configuredRounds) * 100 : 0).toFixed(1) + "%";
      }

      function finishSustainedGame() {
        stopSustainedTimer();
        state.sustained.active = false;
        refs.sustainedStartBtn.disabled = false;

        const targetCount = state.sustained.hits + state.sustained.misses;
        const totalEvaluated = targetCount + state.sustained.falseAlarms + state.sustained.correctSkips;
        const accuracy = totalEvaluated > 0
          ? ((state.sustained.hits + state.sustained.correctSkips) / totalEvaluated) * 100
          : 0;
        const hitRate = targetCount > 0 ? (state.sustained.hits / targetCount) * 100 : 0;
        const avgRt = state.sustained.hits > 0 ? state.sustained.totalRt / state.sustained.hits : 0;
        const durationMs = state.sustained.sessionStart ? performance.now() - state.sustained.sessionStart : 0;

        refs.sustainedZone.className = "sustained-zone";
        refs.sustainedStimulus.textContent = "完成";
        refs.sustainedText.textContent = "目标字母命中 " + hitRate.toFixed(0) + "%，平均反应 " + formatShort(avgRt) + "。";
        refs.sustainedProgress.style.width = "100%";
        refs.sustainedStep.textContent = state.sustained.rounds + " / " + state.sustained.rounds;
        refs.sustainedAccuracy.textContent = accuracy.toFixed(0) + "%";
        refs.sustainedAvgRt.textContent = state.sustained.hits > 0 ? formatShort(avgRt) : "-";
        refs.sustainedMisses.textContent = String(state.sustained.misses);
        refs.sustainedFalse.textContent = String(state.sustained.falseAlarms);
        setStatus(
          refs.sustainedStatus,
          "完成，总准确率 " + accuracy.toFixed(0) + "%，目标字母命中 " + hitRate.toFixed(0) + "%。",
          accuracy >= 84 ? "ok" : ""
        );

        addRecord({
          id: "sustained-" + Date.now(),
          game: "持续注意力",
          timestamp: Date.now(),
          durationMs: Math.round(durationMs),
          metricMs: state.sustained.hits > 0 ? Math.round(avgRt) : 0,
          score: Number(accuracy.toFixed(2)),
          summary: state.sustained.rounds + " 个刺激 / 目标字母 " + state.sustained.targetLetters.join(" "),
          detailText: "目标命中 " + hitRate.toFixed(0) + "% / 平均反应 " + formatShort(avgRt) + " / 漏按 " + state.sustained.misses + " / 误按 " + state.sustained.falseAlarms
        });
      }
