const day = 86_400_000;

export function formatTime(ts: number): string {
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const period = h >= 12 ? "م" : "ص";
  h = h % 12 || 12;
  return `${h}:${m} ${period}`;
}

export function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "الآن";
  if (diff < 3600_000) return `قبل ${Math.floor(diff / 60_000)} د`;
  if (diff < day) return `اليوم، ${formatTime(ts)}`;
  if (diff < 2 * day) return `أمس، ${formatTime(ts)}`;
  if (diff < 7 * day) return `قبل ${Math.floor(diff / day)} أيام`;
  return new Date(ts).toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "صباح الخير";
  return "مساء الخير";
}

export function plainTextFromHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}