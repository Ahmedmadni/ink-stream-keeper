const { app, BrowserWindow, session, shell, protocol, net, ipcMain } = require("electron");
const { join, basename } = require("node:path");
const { pathToFileURL } = require("node:url");
const { existsSync } = require("node:fs");
const { createFloatingNotes } = require("./floating-notes.cjs");
const { floatingAssetPath } = require("./floating-security.cjs");
const {
  APP_URL,
  RECOVERY_SCHEME,
  isAppUrl,
  isAuthCallback,
  isOAuthUrl,
  externalUrl,
  bundledPath,
} = require("./security.cjs");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "memoflow",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

let mainWindow;
let floatingNotes;
let callbackReady = false;
let pendingCallback = process.argv.find(isAuthCallback);

function receiveCallback(raw) {
  if (!isAuthCallback(raw)) return;
  pendingCallback = raw;
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    if (callbackReady) {
      mainWindow.webContents.send("memoflow:auth:callback", pendingCallback);
      pendingCallback = undefined;
    }
  }
}
app.on("open-url", (event, url) => {
  event.preventDefault();
  receiveCallback(url);
});

function trusted(event) {
  return (
    mainWindow &&
    event.sender === mainWindow.webContents &&
    event.senderFrame === mainWindow.webContents.mainFrame &&
    isAppUrl(event.senderFrame.url)
  );
}

function createWindow() {
  callbackReady = false;
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 380,
    minHeight: 600,
    title: "MemoFlow",
    icon: join(__dirname, "app.png"),
    backgroundColor: "#f5f6f8",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (externalUrl(url)) void shell.openExternal(url).catch(() => {});
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    if (externalUrl(url)) void shell.openExternal(url).catch(() => {});
  });
  mainWindow.webContents.on("did-start-navigation", (_event, _url, inPlace, mainFrame) => {
    if (mainFrame && !inPlace) callbackReady = false;
  });
  mainWindow.on("closed", () => {
    floatingNotes?.closeAll();
    mainWindow = undefined;
    callbackReady = false;
  });
  void mainWindow.loadURL(`${APP_URL}/`);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const callback = argv.find(isAuthCallback);
    if (callback) receiveCallback(callback);
    else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  app.whenReady().then(() => {
    if (process.windowsStore) {
      const identity = require("./store-identity.json");
      app.setAppUserModelId(`${identity.packageFamilyName}!${identity.applicationId}`);
    }
    if (app.isPackaged && !process.windowsStore) {
      for (const scheme of ["lovable", RECOVERY_SCHEME.slice(0, -1)])
        app.setAsDefaultProtocolClient(scheme);
    }
    const webRoot = join(__dirname, "web");
    protocol.handle("memoflow", (request) => {
      if (!["GET", "HEAD"].includes(request.method))
        return new Response("Method not allowed", { status: 405 });
      const path =
        bundledPath(webRoot, request.url) ||
        floatingAssetPath(join(__dirname, "floating"), request.url);
      if (!path || !existsSync(path)) return new Response("Not found", { status: 404 });
      return net.fetch(pathToFileURL(path).toString());
    });
    floatingNotes = createFloatingNotes({
      trustedMain: trusted,
      getMainWindow: () => mainWindow,
      openMainCard: (card) => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send("memoflow:floating:open-card", card);
      },
    });
    ipcMain.handle("memoflow:auth:open", async (event, url) => {
      if (!trusted(event) || typeof url !== "string" || !isOAuthUrl(url))
        throw new Error("Invalid authentication request");
      await shell.openExternal(url);
    });
    ipcMain.handle("memoflow:auth:launch", (event) => {
      if (!trusted(event)) throw new Error("Invalid authentication origin");
      const url = pendingCallback;
      pendingCallback = undefined;
      callbackReady = true;
      return url ? { url } : {};
    });
    const allowed = ["media", "notifications", "clipboard-sanitized-write", "fullscreen"];
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback) =>
      callback(
        wc === mainWindow?.webContents && isAppUrl(wc.getURL()) && allowed.includes(permission),
      ),
    );
    session.defaultSession.setPermissionCheckHandler(
      (wc, permission) =>
        wc === mainWindow?.webContents && isAppUrl(wc.getURL()) && allowed.includes(permission),
    );
    session.defaultSession.on("will-download", (_event, item, wc) => {
      if (wc !== mainWindow?.webContents) {
        item.cancel();
        return;
      }
      item.setSaveDialogOptions({
        title: "حفظ ملف MemoFlow",
        defaultPath: join(app.getPath("downloads"), basename(item.getFilename())),
      });
    });
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
