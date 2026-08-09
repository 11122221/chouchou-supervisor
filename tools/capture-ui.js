const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const output = path.join(root, ".tmp", "ui-captures");

ipcMain.handle("settings:get", () => ({
  focusMinutes: 45,
  breakMinutes: 5,
  closeMode: "after30",
  language: "system",
  launchAtLogin: false,
  updateChecks: true,
  resolvedLanguage: "zh-CN",
  paused: false,
  pauseUntil: null,
  focusRemainingSeconds: 2674,
  updateAvailable: false
}));
ipcMain.handle("settings:save", (_event, settings) => settings);
ipcMain.handle("break:preview", () => true);
ipcMain.handle("break:end", () => true);
ipcMain.handle("update:open", () => false);

async function makeWindow(file, size) {
  const win = new BrowserWindow({
    show: false,
    width: size.width,
    height: size.height,
    backgroundColor: "#f4f0e9",
    webPreferences: {
      preload: path.join(root, "src", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  await win.loadFile(file);
  return win;
}

app.whenReady().then(async () => {
  fs.mkdirSync(output, { recursive: true });

  const settings = await makeWindow(path.join(root, "src", "renderer", "settings.html"), { width: 760, height: 950 });
  await new Promise((resolve) => setTimeout(resolve, 1000));
  fs.writeFileSync(path.join(output, "settings.png"), (await settings.webContents.capturePage()).toPNG());

  const overlay = await makeWindow(path.join(root, "src", "renderer", "overlay.html"), { width: 1440, height: 900 });
  overlay.webContents.send("break:state", {
    active: true,
    preview: true,
    remainingSeconds: 300,
    canEnd: false,
    closeMode: "after30",
    language: "zh-CN"
  });
  await new Promise((resolve) => setTimeout(resolve, 1700));
  fs.writeFileSync(path.join(output, "overlay.png"), (await overlay.webContents.capturePage()).toPNG());
  settings.destroy();
  overlay.destroy();
  app.quit();
});
