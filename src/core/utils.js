export function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "0.00s";
  }
  if (ms < 60000) {
    return (ms / 1000).toFixed(2) + "s";
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(1).padStart(4, "0");
  return minutes + "m " + seconds + "s";
}

export function formatShort(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "-";
  }
  return Math.round(ms) + "ms";
}

export function formatMetricMs(ms) {
  if (!Number.isFinite(ms) || ms < 0) {
    return "-";
  }
  return Math.round(ms) + "ms";
}

export function formatCountdown(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "0s";
  }
  return Math.ceil(ms / 1000) + "s";
}

export function formatTotal(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "0s";
  }
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) {
    return totalSeconds + "s";
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return minutes + "m " + seconds + "s";
  }
  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  return hours + "h " + remainMinutes + "m";
}

export function getFocusPhaseLabel(phase) {
  if (phase === "warmup") {
    return "热身";
  }
  if (phase === "challenge") {
    return "抗干扰";
  }
  if (phase === "done") {
    return "已完成";
  }
  if (phase === "stopped") {
    return "已停止";
  }
  return "未开始";
}

export function getBreathPhaseLabel(phase) {
  if (phase === "ready") {
    return "预备";
  }
  if (phase === "inhale") {
    return "吸气";
  }
  if (phase === "exhale") {
    return "呼气";
  }
  if (phase === "done") {
    return "已完成";
  }
  if (phase === "stopped") {
    return "已停止";
  }
  return "未开始";
}

export function getBreathCueModeLabel(mode) {
  return mode === "visual" ? "仅视觉" : "节拍音 + 视觉";
}

export function getFocusIntensityConfig(intensity) {
  if (intensity === "gentle") {
    return { count: 3, interval: 920, life: 1100 };
  }
  if (intensity === "intense") {
    return { count: 7, interval: 500, life: 1450 };
  }
  return { count: 5, interval: 690, life: 1280 };
}

export function formatTimeStamp(ts) {
  return new Date(ts).toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function setStatus(element, message, tone) {
  element.textContent = message;
  element.className = "status" + (tone ? " " + tone : "");
}
