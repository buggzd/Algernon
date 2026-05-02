import { MAX_RECORDS } from "./constants.js";
import { state, refs } from "./state.js";
import { formatDuration, formatTotal, formatShort, escapeHtml, formatTimeStamp, setStatus } from "./utils.js";
import { saveRecords, getIsTauri, getTauriModules } from "./persistence.js";

function getRecordsByGame(game) {
  return state.records.filter((item) => item.game === game);
}

export function renderStats() {
  const totalDurationMs = state.records.reduce((sum, item) => sum + (item.durationMs || 0), 0);
  refs.totalSessions.textContent = String(state.records.length);
  refs.totalDuration.textContent = formatTotal(totalDurationMs);

  const schulteRecords = getRecordsByGame("舒尔特方格");
  const tbackRecords = getRecordsByGame("T-Back");
  const reactionRecords = getRecordsByGame("反应时");

  if (schulteRecords.length > 0) {
    const best = Math.min(...schulteRecords.map((item) => item.durationMs));
    refs.bestSchulte.textContent = formatDuration(best);
  } else {
    refs.bestSchulte.textContent = "-";
  }

  if (tbackRecords.length > 0) {
    const best = Math.max(...tbackRecords.map((item) => item.score || 0));
    refs.bestTBack.textContent = best.toFixed(0) + "%";
  } else {
    refs.bestTBack.textContent = "-";
  }

  if (reactionRecords.length > 0) {
    const bestReaction = Math.min(...reactionRecords.map((item) => item.bestMs || item.metricMs || item.durationMs));
    refs.reactionBest.textContent = formatShort(bestReaction);
  } else {
    refs.reactionBest.textContent = "-";
  }

  refs.reactionFalseCount.textContent = String(state.reaction.falseStarts);
}

export function renderRecords() {
  if (state.records.length === 0) {
    refs.historyList.innerHTML = '<div class="empty-state">暂无记录，先开始一次训练。</div>';
    return;
  }

  refs.historyList.innerHTML = state.records.slice(0, 18).map((record) => {
    return [
      '<div class="history-item">',
      "<div>",
      "<strong>" + escapeHtml(record.game) + "</strong>",
      '<div class="history-meta">' + escapeHtml(record.summary) + "</div>",
      "</div>",
      '<div class="history-meta">' + escapeHtml(formatTimeStamp(record.timestamp)) + "</div>",
      '<div class="history-meta">' + escapeHtml(record.detailText || "") + "</div>",
      "</div>"
    ].join("");
  }).join("");
}

export async function addRecord(record) {
  state.records.unshift(record);
  state.records = state.records.slice(0, MAX_RECORDS);
  await saveRecords();
  renderRecords();
  renderStats();
}

async function exportRecords() {
  const isTauri = getIsTauri();
  const tauriModules = getTauriModules();

  if (state.records.length === 0) {
    setStatus(refs.reactionStatus, "当前没有可导出的记录。", "warn");
    return;
  }

  if (isTauri) {
    const { save } = tauriModules.dialog;
    const { writeTextFile } = tauriModules.fs;

    const defaultName = "brain-training-records-" + new Date().toISOString().slice(0, 10) + ".json";
    const filePath = await save({
      defaultPath: defaultName,
      filters: [{ name: "JSON", extensions: ["json"] }]
    });

    if (!filePath) return;

    await writeTextFile(filePath, JSON.stringify(state.records, null, 2));
    setStatus(refs.reactionStatus, "记录已导出。", "ok");
  } else {
    const blob = new Blob([JSON.stringify(state.records, null, 2)], {
      type: "application/json;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "brain-training-records-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
}

async function importRecords() {
  const isTauri = getIsTauri();
  const tauriModules = getTauriModules();

  if (isTauri) {
    const { open } = tauriModules.dialog;
    const { readTextFile } = tauriModules.fs;

    const filePath = await open({
      filters: [{ name: "JSON", extensions: ["json"] }],
      multiple: false
    });

    if (!filePath) return;

    try {
      const content = await readTextFile(filePath);
      const imported = JSON.parse(content);

      if (!Array.isArray(imported)) {
        throw new Error("文件格式不正确");
      }

      const validRecords = imported.filter(function (r) { return r && r.game && r.timestamp; });
      if (validRecords.length === 0) {
        setStatus(refs.reactionStatus, "文件中没有找到有效记录。", "warn");
        return;
      }

      state.records = validRecords.concat(state.records).slice(0, MAX_RECORDS);
      await saveRecords();
      renderRecords();
      renderStats();
      setStatus(refs.reactionStatus, "成功导入 " + validRecords.length + " 条记录。", "ok");
    } catch (e) {
      setStatus(refs.reactionStatus, "导入失败：" + e.message, "warn");
    }
  } else {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async function (e) {
      var file = e.target.files[0];
      if (!file) return;
      try {
        var text = await file.text();
        var imported = JSON.parse(text);
        if (!Array.isArray(imported)) {
          throw new Error("文件格式不正确");
        }
        var validRecords = imported.filter(function (r) { return r && r.game && r.timestamp; });
        if (validRecords.length === 0) {
          setStatus(refs.reactionStatus, "文件中没有找到有效记录。", "warn");
          return;
        }
        state.records = validRecords.concat(state.records).slice(0, MAX_RECORDS);
        await saveRecords();
        renderRecords();
        renderStats();
        setStatus(refs.reactionStatus, "成功导入 " + validRecords.length + " 条记录。", "ok");
      } catch (err) {
        setStatus(refs.reactionStatus, "导入失败：" + err.message, "warn");
      }
    };
    input.click();
  }
}

async function clearRecords() {
  if (!window.confirm("确定要清空所有训练记录吗？")) {
    return;
  }
  state.records = [];
  await saveRecords();
  renderRecords();
  renderStats();
}

export function initRecordsActions() {
  refs.exportBtn.addEventListener("click", exportRecords);
  refs.importBtn.addEventListener("click", importRecords);
  refs.clearBtn.addEventListener("click", clearRecords);
}
