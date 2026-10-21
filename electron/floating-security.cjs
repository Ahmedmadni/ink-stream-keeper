const { join } = require("node:path");

function floatingOwner(value) {
  if (value === null) return null;
  if (typeof value !== "string" || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value))
    throw new Error("Invalid account");
  return value;
}

function floatingNote(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof value.id !== "string" ||
    !/^[a-z0-9_-]{1,128}$/i.test(value.id) ||
    typeof value.title !== "string" ||
    value.title.length > 500 ||
    typeof value.text !== "string" ||
    value.text.length > 200000
  )
    throw new Error("Invalid note");
  const userId = floatingOwner(value.userId);
  if (!userId) throw new Error("Missing account");
  return {
    id: value.id,
    userId,
    title: value.title.trim() || "مذكرة",
    text: value.text,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt.slice(0, 64) : "",
    dark: value.dark === true,
  };
}

function floatingPoint(value) {
  if (
    !value ||
    ![value.x, value.y].every(
      (n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 1e7,
    )
  )
    throw new Error("Invalid position");
  return { x: Math.round(value.x), y: Math.round(value.y) };
}

function floatingCard(value) {
  if (!["note", "task"].includes(value?.kind)) throw new Error("Invalid card type");
  const base = floatingNote(value);
  if (value.kind === "note") return { ...base, kind: "note" };
  if (!Array.isArray(value.items) || value.items.length > 1000 || typeof value.done !== "boolean")
    throw new Error("Invalid task");
  const ids = new Set();
  const items = value.items.map((item) => {
    if (
      !item ||
      typeof item.id !== "string" ||
      !/^[a-z0-9_-]{1,128}$/i.test(item.id) ||
      ids.has(item.id) ||
      typeof item.title !== "string" ||
      item.title.length > 4000 ||
      typeof item.done !== "boolean"
    )
      throw new Error("Invalid task item");
    ids.add(item.id);
    return { id: item.id, title: item.title, done: item.done };
  });
  return { ...base, title: value.title.trim() || "مهمة", kind: "task", done: value.done, items };
}

function floatingCardKey(card) {
  return card.kind + ":" + card.id;
}

function containsPoint(bounds, point) {
  return (
    point.x >= bounds.x &&
    point.y >= bounds.y &&
    point.x < bounds.x + bounds.width &&
    point.y < bounds.y + bounds.height
  );
}

function visibleBounds(point, area) {
  const width = Math.min(360, area.width),
    height = Math.min(400, area.height);
  return {
    x: Math.round(Math.max(area.x, Math.min(point.x - 32, area.x + area.width - width))),
    y: Math.round(Math.max(area.y, Math.min(point.y - 24, area.y + area.height - height))),
    width,
    height,
  };
}

function isFloatingUrl(raw) {
  try {
    const url = new URL(raw);
    return (
      url.protocol === "memoflow:" && url.host === "floating" && !url.username && !url.password
    );
  } catch {
    return false;
  }
}

function floatingAssetPath(root, raw) {
  if (!isFloatingUrl(raw)) return null;
  let path;
  try {
    path = decodeURIComponent(new URL(raw).pathname);
  } catch {
    return null;
  }
  if (
    !["/index.html", "/floating.css", "/floating.js"].includes(path) &&
    !/^\/fonts\/ibm-plex-sans-arabic-(arabic|latin)-(400|600)-normal\.woff2$/.test(path)
  )
    return null;
  return join(root, path.slice(1));
}

module.exports = {
  floatingOwner,
  floatingNote,
  floatingCard,
  floatingCardKey,
  floatingPoint,
  containsPoint,
  visibleBounds,
  isFloatingUrl,
  floatingAssetPath,
};
