const { BrowserWindow, ipcMain, screen } = require("electron");
const { join } = require("node:path");
const {
  floatingOwner,
  floatingNote,
  floatingPoint,
  containsPoint,
  visibleBounds,
  isFloatingUrl,
} = require("./floating-security.cjs");

function createFloatingNotes({ trustedMain, getMainWindow, openMainNote }) {
  let owner = null;
  const cards = new Map();
  const status = () => ({ ids: [...cards.keys()] });
  function announce() {
    const main = getMainWindow();
    if (main && !main.isDestroyed()) main.webContents.send("memoflow:floating:status", status());
  }
  function closeAll() {
    for (const card of [...cards.values()]) card.window.close();
  }
  const view = (card) => ({
    id: card.note.id,
    title: card.note.title,
    text: card.note.text,
    updatedAt: card.note.updatedAt,
    dark: card.note.dark,
    pinned: card.window.isAlwaysOnTop(),
  });
  function publish(card) {
    card.window.setTitle(card.note.title + " — MemoFlow");
    card.window.webContents.send("memoflow:floating:data", view(card));
  }
  function cardFor(event) {
    const card = [...cards.values()].find((c) => c.window.webContents === event.sender);
    if (
      !card ||
      event.senderFrame !== event.sender.mainFrame ||
      !isFloatingUrl(event.senderFrame.url)
    )
      throw new Error("Invalid floating origin");
    return card;
  }
  function open(raw, point, inactive = false) {
    const note = floatingNote(raw);
    if (!owner || note.userId !== owner) throw new Error("Account mismatch");
    const existing = cards.get(note.id);
    if (existing) {
      existing.note = note;
      existing.window.setAlwaysOnTop(true);
      publish(existing);
      if (inactive) existing.window.showInactive();
      else {
        existing.window.show();
        existing.window.focus();
      }
      return status();
    }
    if (cards.size >= 8) throw new Error("يمكن فتح 8 بطاقات في الوقت نفسه. أغلق بطاقة أولًا.");
    const mainBounds = getMainWindow()?.getBounds() ?? screen.getPrimaryDisplay().workArea;
    const target = point ?? {
      x: mainBounds.x + mainBounds.width - 360 + cards.size * 24,
      y: mainBounds.y + 100 + cards.size * 24,
    };
    const bounds = visibleBounds(target, screen.getDisplayNearestPoint(target).workArea);
    const window = new BrowserWindow({
      ...bounds,
      minWidth: 240,
      minHeight: 160,
      useContentSize: true,
      title: note.title + " — MemoFlow",
      icon: join(__dirname, "app.png"),
      frame: false,
      alwaysOnTop: true,
      resizable: true,
      minimizable: false,
      maximizable: false,
      skipTaskbar: true,
      show: false,
      backgroundColor: note.dark ? "#192332" : "#fdfcf8",
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, "floating-preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: false,
      },
    });
    const card = { window, note };
    cards.set(note.id, card);
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", (event) => event.preventDefault());
    window.once("ready-to-show", () => {
      if (inactive) window.showInactive();
      else window.show();
    });
    window.once("closed", () => {
      cards.delete(note.id);
      announce();
    });
    void window.loadURL("memoflow://floating/index.html");
    announce();
    return status();
  }
  function mainHandler(channel, fn) {
    ipcMain.handle("memoflow:floating:" + channel, (event, input) => {
      if (!trustedMain(event)) throw new Error("Invalid application origin");
      return fn(input);
    });
  }
  mainHandler("owner", (raw) => {
    const next = floatingOwner(raw);
    if (next !== owner) {
      closeAll();
      owner = next;
    }
    return status();
  });
  mainHandler("open", (raw) => open(raw));
  mainHandler("drop", (input) => {
    const point = floatingPoint(input?.point);
    const main = getMainWindow();
    if (!main || containsPoint(main.getBounds(), point)) return { opened: false };
    open(input.note, point, true);
    return { opened: true };
  });
  mainHandler("sync", (input) => {
    if (
      !owner ||
      input?.userId !== owner ||
      !Array.isArray(input.notes) ||
      input.notes.length > 10000
    )
      throw new Error("Invalid note synchronization");
    const notes = new Map(
      input.notes.map((raw) => {
        const note = floatingNote(raw);
        if (note.userId !== owner) throw new Error("Account mismatch");
        return [note.id, note];
      }),
    );
    for (const [id, card] of [...cards]) {
      const note = notes.get(id);
      if (!note) card.window.close();
      else {
        card.note = note;
        publish(card);
      }
    }
    return status();
  });
  mainHandler("status", status);
  mainHandler("close-all", () => {
    closeAll();
    return status();
  });
  ipcMain.handle("memoflow:floating:read", (event) => view(cardFor(event)));
  ipcMain.handle("memoflow:floating:pin", (event) => {
    const card = cardFor(event);
    card.window.setAlwaysOnTop(!card.window.isAlwaysOnTop());
    publish(card);
    return view(card);
  });
  ipcMain.handle("memoflow:floating:close", (event) => cardFor(event).window.close());
  ipcMain.handle("memoflow:floating:return", (event) => {
    const card = cardFor(event),
      id = card.note.id;
    card.window.close();
    openMainNote(id);
  });
  return { closeAll };
}
module.exports = { createFloatingNotes };
