const { app, BrowserWindow, session, shell } = require("electron");
const APP_URL = "https://ink-stream-keeper.lovable.app";
function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 380, minHeight: 600,
    title: "MemoFlow", backgroundColor: "#ffffff", autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.loadURL(APP_URL);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(APP_URL)) return { action: "allow" };
    shell.openExternal(url); return { action: "deny" };
  });
}
app.whenReady().then(() => {
  const allowed = ["media", "notifications", "clipboard-sanitized-write", "fullscreen"];
  session.defaultSession.setPermissionRequestHandler((_wc, p, cb) => cb(allowed.includes(p)));
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
