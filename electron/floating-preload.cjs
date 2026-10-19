const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("memoFlowFloating", {
  read: () => ipcRenderer.invoke("memoflow:floating:read"),
  pin: () => ipcRenderer.invoke("memoflow:floating:pin"),
  close: () => ipcRenderer.invoke("memoflow:floating:close"),
  returnToApp: () => ipcRenderer.invoke("memoflow:floating:return"),
  onData: (listener) => {
    const receive = (_event, note) => listener(note);
    ipcRenderer.on("memoflow:floating:data", receive);
    return () => ipcRenderer.removeListener("memoflow:floating:data", receive);
  },
});
