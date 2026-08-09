const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  powerMonitor,
  screen,
  shell,
  Tray
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { DEFAULT_SETTINGS, canEndBreak, sanitizeSettings } = require("./settings");
const { resolvedLanguage, translate } = require("./i18n");

const APP_ROOT = path.join(__dirname, "..");
const SETTINGS_PAGE = path.join(__dirname, "renderer", "settings.html");
const OVERLAY_PAGE = path.join(__dirname, "renderer", "overlay.html");
const ICON_PATH = path.join(APP_ROOT, "assets", "icons", "app.png");

let tray = null;
let settingsWindow = null;
let overlayWindows = [];
let settings = { ...DEFAULT_SETTINGS };
let focusElapsedMs = 0;
let lastTickAt = Date.now();
let warningShown = false;
let breakStartedAt = null;
let breakPreview = false;
let manualPauseUntil = 0;
let systemAwayStartedAt = null;
let quitting = false;
let latestReleaseUrl = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function loadSettings() {
  try {
    settings = sanitizeSettings(JSON.parse(fs.readFileSync(settingsPath(), "utf8")));
  } catch {
    settings = { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

function language() {
  return resolvedLanguage(settings.language, app.getLocale());
}

function t(key) {
  return translate(language(), key);
}

function windowOptions(extra = {}) {
  return {
    icon: ICON_PATH,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    ...extra
  };
}

function showSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow(windowOptions({
    width: 760,
    height: 720,
    minWidth: 680,
    minHeight: 640,
    title: t("appName"),
    backgroundColor: "#f6f3ed",
    autoHideMenuBar: true
  }));
  settingsWindow.loadFile(SETTINGS_PAGE);
  settingsWindow.once("ready-to-show", () => settingsWindow?.show());
  settingsWindow.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      settingsWindow.hide();
    }
  });
  settingsWindow.on("closed", () => { settingsWindow = null; });
}

function formatPauseLabel() {
  if (!manualPauseUntil || manualPauseUntil <= Date.now()) return "";
  return new Date(manualPauseUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function rebuildTrayMenu() {
  if (!tray) return;
  const paused = manualPauseUntil > Date.now();
  const menu = Menu.buildFromTemplate([
    { label: t("settings"), click: showSettings },
    { label: t("immediateBreak"), click: () => startBreak(true) },
    { type: "separator" },
    { label: t("pause30"), click: () => pauseFor(30) },
    { label: t("pause60"), click: () => pauseFor(60) },
    { label: t("pauseTomorrow"), click: pauseUntilTomorrow },
    { label: paused ? `${t("resume")} (${formatPauseLabel()})` : t("resume"), enabled: paused, click: resumeNow },
    { type: "separator" },
    { label: t("quit"), click: () => { quitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(t("appName"));
}

function createTray() {
  let icon = nativeImage.createFromPath(ICON_PATH);
  if (!icon.isEmpty()) icon = icon.resize({ width: 24, height: 24 });
  tray = new Tray(icon);
  tray.on("double-click", showSettings);
  rebuildTrayMenu();
}

function pauseFor(minutes) {
  manualPauseUntil = Date.now() + minutes * 60_000;
  rebuildTrayMenu();
  broadcastSettings();
}

function pauseUntilTomorrow() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  manualPauseUntil = tomorrow.getTime();
  rebuildTrayMenu();
  broadcastSettings();
}

function resumeNow() {
  manualPauseUntil = 0;
  lastTickAt = Date.now();
  rebuildTrayMenu();
  broadcastSettings();
}

function isPaused() {
  return systemAwayStartedAt !== null || manualPauseUntil > Date.now();
}

function notifyBreakSoon() {
  if (!Notification.isSupported()) return;
  new Notification({ title: t("breakSoonTitle"), body: t("breakSoonBody"), icon: ICON_PATH }).show();
}

function createOverlay(display) {
  const win = new BrowserWindow(windowOptions({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false
  }));
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(OVERLAY_PAGE);
  win.once("ready-to-show", () => {
    win.showInactive();
    sendBreakState();
  });
  win.on("close", (event) => {
    const canClose = quitting || breakStartedAt === null || canEndBreak(settings.closeMode, Date.now() - breakStartedAt);
    if (!canClose) event.preventDefault();
  });
  return win;
}

function startBreak(preview = false) {
  if (breakStartedAt !== null) return;
  breakStartedAt = Date.now();
  breakPreview = preview;
  overlayWindows = screen.getAllDisplays().map(createOverlay);
  sendBreakState();
}

function finishBreak(force = false) {
  if (breakStartedAt === null) return false;
  if (!force && !canEndBreak(settings.closeMode, Date.now() - breakStartedAt)) return false;
  const windows = overlayWindows;
  overlayWindows = [];
  breakStartedAt = null;
  breakPreview = false;
  focusElapsedMs = 0;
  warningShown = false;
  lastTickAt = Date.now();
  for (const win of windows) {
    if (!win.isDestroyed()) win.destroy();
  }
  broadcastSettings();
  return true;
}

function currentBreakState() {
  if (breakStartedAt === null) return null;
  const totalMs = settings.breakMinutes * 60_000;
  const elapsedMs = Date.now() - breakStartedAt;
  return {
    active: true,
    preview: breakPreview,
    remainingSeconds: Math.max(0, Math.ceil((totalMs - elapsedMs) / 1000)),
    canEnd: canEndBreak(settings.closeMode, elapsedMs),
    closeMode: settings.closeMode,
    language: language()
  };
}

function sendBreakState() {
  const state = currentBreakState();
  if (!state) return;
  for (const win of overlayWindows) {
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send("break:state", state);
  }
}

function schedulerTick() {
  const now = Date.now();
  const delta = Math.min(5_000, Math.max(0, now - lastTickAt));
  lastTickAt = now;

  if (manualPauseUntil && manualPauseUntil <= now) {
    manualPauseUntil = 0;
    rebuildTrayMenu();
    broadcastSettings();
  }

  if (breakStartedAt !== null) {
    const totalMs = settings.breakMinutes * 60_000;
    if (now - breakStartedAt >= totalMs) finishBreak(true);
    else sendBreakState();
    return;
  }

  if (isPaused()) return;
  focusElapsedMs += delta;
  const focusTotalMs = settings.focusMinutes * 60_000;
  if (!warningShown && focusTotalMs - focusElapsedMs <= 60_000 && focusTotalMs > 60_000) {
    warningShown = true;
    notifyBreakSoon();
  }
  if (focusElapsedMs >= focusTotalMs) startBreak(false);
}

function beginSystemAway() {
  if (systemAwayStartedAt === null) systemAwayStartedAt = Date.now();
}

function endSystemAway() {
  if (systemAwayStartedAt === null) return;
  const awayMs = Date.now() - systemAwayStartedAt;
  systemAwayStartedAt = null;
  if (awayMs >= 5 * 60_000) {
    focusElapsedMs = 0;
    warningShown = false;
  }
  lastTickAt = Date.now();
  broadcastSettings();
}

function publicState() {
  const focusTotalMs = settings.focusMinutes * 60_000;
  return {
    ...settings,
    resolvedLanguage: language(),
    paused: isPaused(),
    pauseUntil: manualPauseUntil || null,
    focusRemainingSeconds: Math.max(0, Math.ceil((focusTotalMs - focusElapsedMs) / 1000)),
    updateAvailable: Boolean(latestReleaseUrl)
  };
}

function broadcastSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send("settings:changed", publicState());
  }
}

async function checkForUpdates() {
  if (!settings.updateChecks || settings.updateRepository.startsWith("YOUR_")) return;
  const markerPath = path.join(app.getPath("userData"), "last-update-check.txt");
  try {
    const lastCheck = Number(fs.readFileSync(markerPath, "utf8"));
    if (Date.now() - lastCheck < 24 * 60 * 60_000) return;
  } catch {}
  fs.writeFileSync(markerPath, String(Date.now()), "utf8");
  try {
    const response = await fetch(`https://api.github.com/repos/${settings.updateRepository}/releases/latest`, {
      headers: { "User-Agent": "chouchou-supervisor" }
    });
    if (!response.ok) return;
    const release = await response.json();
    const latest = String(release.tag_name || "").replace(/^v/, "");
    if (latest && latest !== app.getVersion()) {
      latestReleaseUrl = release.html_url;
      const notification = new Notification({ title: t("updateTitle"), body: t("updateBody"), icon: ICON_PATH });
      notification.on("click", () => shell.openExternal(latestReleaseUrl));
      notification.show();
      broadcastSettings();
    }
  } catch {}
}

ipcMain.handle("settings:get", () => publicState());
ipcMain.handle("settings:save", (_event, input) => {
  settings = sanitizeSettings({ ...settings, ...input });
  saveSettings();
  app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin, path: app.getPath("exe") });
  focusElapsedMs = 0;
  warningShown = false;
  rebuildTrayMenu();
  broadcastSettings();
  return publicState();
});
ipcMain.handle("break:preview", () => { startBreak(true); return true; });
ipcMain.handle("break:end", () => finishBreak(false));
ipcMain.handle("update:open", () => latestReleaseUrl ? shell.openExternal(latestReleaseUrl) : false);

app.on("second-instance", showSettings);
app.on("before-quit", () => { quitting = true; });
app.on("window-all-closed", () => {});
app.whenReady().then(() => {
  loadSettings();
  app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin, path: app.getPath("exe") });
  createTray();
  showSettings();
  powerMonitor.on("suspend", beginSystemAway);
  powerMonitor.on("lock-screen", beginSystemAway);
  powerMonitor.on("resume", endSystemAway);
  powerMonitor.on("unlock-screen", endSystemAway);
  screen.on("display-added", () => { if (breakStartedAt !== null) { finishBreak(true); startBreak(breakPreview); } });
  screen.on("display-removed", () => { if (breakStartedAt !== null) { finishBreak(true); startBreak(breakPreview); } });
  setInterval(schedulerTick, 1000);
  setTimeout(checkForUpdates, 10_000);
});
