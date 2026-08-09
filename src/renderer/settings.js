const COPY = {
  "zh-CN": {
    eyebrow: "休息提醒助手", title: "臭臭监督官", subtitle: "专注工作，也要记得看看远处。",
    preview: "立即预览", schedule: "时间安排", focusDuration: "专注时长", breakDuration: "休息时长",
    minutes: "分钟", preferences: "偏好设置", language: "界面语言", languageHint: "默认跟随系统",
    closeMode: "提醒关闭方式", closeModeHint: "选择提醒出现后是否需要等待 30 秒",
    closeImmediate: "立即关闭", closeAfter30: "30 秒后关闭",
    launch: "开机自动启动", launchHint: "默认关闭，可随时更改", updates: "检查新版本",
    updatesHint: "每天最多检查一次，只提示下载", save: "保存设置", saved: "设置已保存",
    active: "监督中", paused: "已暂停", remaining: "距离下次休息还有", pausedUntil: "将在指定时间自动恢复"
  },
  en: {
    eyebrow: "BREAK REMINDER", title: "Chouchou Supervisor", subtitle: "Stay focused, and remember to rest your eyes.",
    preview: "Preview now", schedule: "Schedule", focusDuration: "Focus duration", breakDuration: "Break duration",
    minutes: "minutes", preferences: "Preferences", language: "Language", languageHint: "Follows the system by default",
    closeMode: "Close reminder", closeModeHint: "Choose whether the first 30 seconds are protected",
    closeImmediate: "Close immediately", closeAfter30: "After 30 seconds",
    launch: "Launch at startup", launchHint: "Off by default; change anytime", updates: "Check for updates",
    updatesHint: "At most once daily; download is never automatic", save: "Save settings", saved: "Settings saved",
    active: "Supervising", paused: "Paused", remaining: "Time until next break", pausedUntil: "Will resume automatically"
  }
};

let state;

function copy() { return COPY[state?.resolvedLanguage || "zh-CN"]; }
function formatTime(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
function applyLanguage() {
  const text = copy();
  document.documentElement.lang = state.resolvedLanguage;
  document.querySelectorAll("[data-i18n]").forEach((node) => { node.textContent = text[node.dataset.i18n]; });
  document.title = text.title;
}
function renderStatus() {
  const text = copy();
  document.querySelector(".status-dot").classList.toggle("paused", state.paused);
  document.querySelector("#status-title").textContent = state.paused ? text.paused : text.active;
  document.querySelector("#status-detail").textContent = state.paused
    ? text.pausedUntil
    : `${text.remaining} ${formatTime(state.focusRemainingSeconds)}`;
}
function fillForm() {
  document.querySelector("#focus-minutes").value = state.focusMinutes;
  document.querySelector("#break-minutes").value = state.breakMinutes;
  document.querySelector("#close-mode").value = state.closeMode;
  document.querySelector("#language").value = state.language;
  document.querySelector("#launch-at-login").checked = state.launchAtLogin;
  document.querySelector("#update-checks").checked = state.updateChecks;
}
function render(next, fill = false) {
  state = next;
  applyLanguage();
  renderStatus();
  if (fill) fillForm();
}

document.querySelectorAll("[data-focus]").forEach((button) => button.addEventListener("click", () => {
  document.querySelector("#focus-minutes").value = button.dataset.focus;
  document.querySelector("#break-minutes").value = button.dataset.break;
}));
document.querySelector("#preview").addEventListener("click", () => window.chouchou.previewBreak());
document.querySelector("#settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const saved = await window.chouchou.saveSettings({
    focusMinutes: Number(document.querySelector("#focus-minutes").value),
    breakMinutes: Number(document.querySelector("#break-minutes").value),
    closeMode: document.querySelector("#close-mode").value,
    language: document.querySelector("#language").value,
    launchAtLogin: document.querySelector("#launch-at-login").checked,
    updateChecks: document.querySelector("#update-checks").checked
  });
  render(saved, true);
  const message = document.querySelector("#save-message");
  message.textContent = copy().saved;
  setTimeout(() => { message.textContent = ""; }, 2200);
});

window.chouchou.onSettingsChanged((next) => render(next, false));
window.chouchou.getSettings().then((initial) => render(initial, true));
setInterval(async () => render(await window.chouchou.getSettings(), false), 1000);
