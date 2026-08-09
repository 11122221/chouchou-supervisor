const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("chouchou", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  previewBreak: () => ipcRenderer.invoke("break:preview"),
  endBreak: () => ipcRenderer.invoke("break:end"),
  openUpdate: () => ipcRenderer.invoke("update:open"),
  onBreakState: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on("break:state", handler);
    return () => ipcRenderer.removeListener("break:state", handler);
  },
  onSettingsChanged: (callback) => {
    const handler = (_event, settings) => callback(settings);
    ipcRenderer.on("settings:changed", handler);
    return () => ipcRenderer.removeListener("settings:changed", handler);
  }
});
