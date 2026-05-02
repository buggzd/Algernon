import { state, refs } from "../core/state.js";
import { shuffle, formatDuration, setStatus } from "../core/utils.js";
import { addRecord } from "../core/records.js";
import { scheduleSavePreferences } from "../core/persistence.js";

export function initSchulte() {
  refs.schulteSize.addEventListener("change", () => {
    state.schulte.size = Number(refs.schulteSize.value);
    scheduleSavePreferences();
    resetSchulteBoard(false);
  });

  refs.schulteShowSelected.addEventListener("change", () => {
    state.schulte.showSelected = refs.schulteShowSelected.value !== "off";
    scheduleSavePreferences();
    renderSchulteBoard();
  });

  refs.schulteStartBtn.addEventListener("click", () => {
    startSchulteGame();
  });

  refs.schulteResetBtn.addEventListener("click", () => {
    resetSchulteBoard(true);
  });

  resetSchulteBoard(false);
}

function startSchulteGame() {
  clearInterval(state.schulte.timerId);
  state.schulte.startTime = performance.now();
  state.schulte.next = 1;
  state.schulte.finished = false;
  state.schulte.wrongValue = null;
  state.schulte.board = state.schulte.board.map((item) => ({
    value: item.value,
    done: false
  }));
  state.schulte.timerId = window.setInterval(() => {
    if (!state.schulte.startTime) {
      return;
    }
    refs.schulteTimer.textContent = formatDuration(performance.now() - state.schulte.startTime);
  }, 50);
  renderSchulteBoard();
  updateSchulteInfo();
  setStatus(refs.schulteStatus, "游戏开始。请从 1 按顺序点击到最后一个数字。", "");
}

function resetSchulteBoard(showMessage) {
  clearInterval(state.schulte.timerId);
  state.schulte.size = Number(refs.schulteSize.value);
  state.schulte.showSelected = refs.schulteShowSelected.value !== "off";
  const total = state.schulte.size * state.schulte.size;
  state.schulte.board = shuffle(Array.from({ length: total }, (_, index) => ({
    value: index + 1,
    done: false
  })));
  state.schulte.startTime = null;
  state.schulte.next = 1;
  state.schulte.finished = false;
  state.schulte.wrongValue = null;
  refs.schulteTimer.textContent = "0.00s";
  if (showMessage) {
    setStatus(refs.schulteStatus, "棋盘已重置。点击\u201C开始新一局\u201D后开始计时。", "");
  }
  renderSchulteBoard();
  updateSchulteInfo();
}

function updateSchulteInfo() {
  const total = state.schulte.size * state.schulte.size;
  const progress = ((state.schulte.next - 1) / total) * 100;
  refs.schulteTarget.textContent = state.schulte.next <= total ? String(state.schulte.next) : "完成";
  refs.schulteProgress.textContent = Math.round(progress) + "%";
  refs.schulteOverview.textContent = state.schulte.startTime
    ? "训练中"
    : state.schulte.finished
    ? "已完成"
    : "未开始";
}

function renderSchulteBoard() {
  refs.schulteBoard.style.gridTemplateColumns = "repeat(" + state.schulte.size + ", minmax(0, 1fr))";
  refs.schulteBoard.innerHTML = "";
  state.schulte.board.forEach((item, index) => {
    const cell = document.createElement("button");
    cell.className = "schulte-cell";
    cell.textContent = item.value;
    cell.type = "button";
    cell.addEventListener("click", () => handleSchulteClick(index));
    refs.schulteBoard.appendChild(cell);
    if (item.done) {
      cell.classList.add("done");
    } else if (state.schulte.wrongValue === item.value) {
      cell.classList.add("wrong");
    }
  });
}

function handleSchulteClick(index) {
  if (!state.schulte.startTime || state.schulte.finished) return;
  const item = state.schulte.board[index];
  if (item.done) return;
  if (item.value === state.schulte.next) {
    item.done = true;
    state.schulte.wrongValue = null;
    state.schulte.next += 1;
    const total = state.schulte.size * state.schulte.size;
    if (state.schulte.next > total) {
      finishSchulteGame();
    }
  } else {
    state.schulte.wrongValue = item.value;
    setStatus(refs.schulteStatus, "点错了，继续找 " + state.schulte.next + "。", "warn");
  }
  renderSchulteBoard();
  updateSchulteInfo();
}

function finishSchulteGame() {
  clearInterval(state.schulte.timerId);
  const durationMs = performance.now() - state.schulte.startTime;
  state.schulte.startTime = null;
  state.schulte.finished = true;
  refs.schulteTimer.textContent = formatDuration(durationMs);
  updateSchulteInfo();
  renderSchulteBoard();
  setStatus(refs.schulteStatus, "完成，用时 " + formatDuration(durationMs) + "。", "ok");

  addRecord({
    id: "schulte-" + Date.now(),
    game: "舒尔特方格",
    timestamp: Date.now(),
    durationMs: Math.round(durationMs),
    score: Number((100000 / Math.max(durationMs, 1)).toFixed(2)),
    showSelected: state.schulte.showSelected,
    summary: state.schulte.size + " × " + state.schulte.size + " 完成 · 点选显示" + (state.schulte.showSelected ? "开" : "关"),
    detailText: "用时 " + formatDuration(durationMs) + " / 已点选显示" + (state.schulte.showSelected ? "开启" : "关闭")
  });
}
