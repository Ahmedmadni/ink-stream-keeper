const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("memoFlowDesktop", {
  isDesktop: true,
  version: "1.2.10",
  setFloatingOwner: (userId) => ipcRenderer.invoke("memoflow:floating:owner", userId),
  openFloatingNote: (note) => ipcRenderer.invoke("memoflow:floating:open", note),
  dropFloatingNote: (input) => ipcRenderer.invoke("memoflow:floating:drop", input),
  syncFloatingNotes: (input) => ipcRenderer.invoke("memoflow:floating:sync", input),
  getFloatingStatus: () => ipcRenderer.invoke("memoflow:floating:status"),
  closeFloatingNotes: () => ipcRenderer.invoke("memoflow:floating:close-all"),
  onFloatingStatus: (listener) => {
    const receive = (_event, status) => listener(status);
    ipcRenderer.on("memoflow:floating:status", receive);
    return () => ipcRenderer.removeListener("memoflow:floating:status", receive);
  },
  onOpenNote: (listener) => {
    const receive = (_event, id) => listener(id);
    ipcRenderer.on("memoflow:floating:open-note", receive);
    return () => ipcRenderer.removeListener("memoflow:floating:open-note", receive);
  },
  openOAuth: (url) => ipcRenderer.invoke("memoflow:auth:open", url),
  getLaunchUrl: () => ipcRenderer.invoke("memoflow:auth:launch"),
  onAuthCallback: (listener) => {
    const receive = (_event, url) => listener(url);
    ipcRenderer.on("memoflow:auth:callback", receive);
    return () => ipcRenderer.removeListener("memoflow:auth:callback", receive);
  },
});
