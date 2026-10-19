const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("memoFlowDesktop", {
  isDesktop: true,
  version: "1.2.8",
  openOAuth: (url) => ipcRenderer.invoke("memoflow:auth:open", url),
  getLaunchUrl: () => ipcRenderer.invoke("memoflow:auth:launch"),
  onAuthCallback: (listener) => {
    const receive = (_event, url) => listener(url);
    ipcRenderer.on("memoflow:auth:callback", receive);
    return () => ipcRenderer.removeListener("memoflow:auth:callback", receive);
  },
});
