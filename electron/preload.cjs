const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("memoFlowDesktop", {
  isDesktop: true,
  version: "1.2.11",
  setFloatingOwner: (userId) => ipcRenderer.invoke("memoflow:floating:owner", userId),
  openFloatingCard: (card) => ipcRenderer.invoke("memoflow:floating:open", card),
  dropFloatingCard: (input) => ipcRenderer.invoke("memoflow:floating:drop", input),
  syncFloatingCards: (input) => ipcRenderer.invoke("memoflow:floating:sync", input),
  getFloatingStatus: () => ipcRenderer.invoke("memoflow:floating:status"),
  closeFloatingNotes: () => ipcRenderer.invoke("memoflow:floating:close-all"),
  onFloatingStatus: (listener) => {
    const receive = (_event, status) => listener(status);
    ipcRenderer.on("memoflow:floating:status", receive);
    return () => ipcRenderer.removeListener("memoflow:floating:status", receive);
  },
  onOpenCard: (listener) => {
    const receive = (_event, id) => listener(id);
    ipcRenderer.on("memoflow:floating:open-card", receive);
    return () => ipcRenderer.removeListener("memoflow:floating:open-card", receive);
  },
  openOAuth: (url) => ipcRenderer.invoke("memoflow:auth:open", url),
  getLaunchUrl: () => ipcRenderer.invoke("memoflow:auth:launch"),
  onAuthCallback: (listener) => {
    const receive = (_event, url) => listener(url);
    ipcRenderer.on("memoflow:auth:callback", receive);
    return () => ipcRenderer.removeListener("memoflow:auth:callback", receive);
  },
});
