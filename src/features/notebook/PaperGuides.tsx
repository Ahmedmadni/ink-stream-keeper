import { memo } from "react";
import type { CSSProperties } from "react";
import type { NotebookPage } from "./model";
import { pageLayout } from "./page-layout";

export const PAPER_LABELS = {
  plain: "سادة", lined: "مسطرة", grid: "مربعات", dots: "منقّطة", cornell: "كورنيل", ledger: "جدول محاسبي",
  "two-column": "عمودان", weekly: "مخطط أسبوعي", flashcards: "بطاقات مذاكرة", music: "موسيقى", isometric: "رسم هندسي", hex: "شبكة سداسية",
} as const;
export const TEXTURE_LABELS = { smooth: "ناعم", grain: "حبيبات خفيفة", linen: "نسيج ورقي" } as const;
export function paperTextStyle(page: NotebookPage): CSSProperties {
  return page.lineSpacing === undefined ? {} : {
    "--notebook-line-height": page.lineSpacing + "px", "--notebook-font-size": (page.fontSize ?? 16) + "px",
  } as CSSProperties;
}

/** All guides use the logical sheet's coordinate system in editor/PDF/vault.
 * These are drawing guides, not interactive calendar cells or accounting data. */
export const PaperGuides = memo(function PaperGuides({ page, preview = false }: { page: NotebookPage; preview?: boolean }) {
  const { width: w, height: h } = pageLayout(page);
  const modern = page.lineSpacing !== undefined;
  if (!modern && page.paper !== "cornell") return null; // Legacy CSS guides remain unchanged.
  const gap = page.lineSpacing ?? 31;
  const lines: string[] = [];
  const vertical: string[] = [];
  const baseline = h * .07 + 4 + gap * .85;
  const ys: number[] = [];
  for (let y = baseline; y < h; y += gap) ys.push(y);
  const path = (x1: number, y1: number, x2: number, y2: number) => `M${x1} ${y1}H${x2} M${x2} ${y1}V${y2}`;
  if (modern && ["lined", "grid", "cornell", "ledger", "two-column"].includes(page.paper))
    for (const y of ys) lines.push(`M0 ${y}H${w}`);
  if (modern && (page.paper === "grid" || page.paper === "ledger")) {
    const xGap = gap * (page.paper === "ledger" ? 3 : 1);
    for (let x = 0; x <= w; x += xGap) lines.push(`M${x} 0V${h}`);
  }
  if (page.paper === "cornell") {
    vertical.push(`M${w * .72} ${h * .08}V${h * .85} M0 ${h * .85}H${w}`);
  }
  if (page.paper === "two-column") vertical.push(`M${w / 2} ${h * .07}V${h * .94}`);
  if (modern && page.paper === "music") {
    for (let top = h * .12; top < h * .88; top += gap * 3.6)
      for (let line = 0; line < 5; line++) lines.push(`M${w * .07} ${top + line * gap / 4}H${w * .93}`);
  }
  if (modern && page.paper === "isometric") {
    for (let x = -h * .58; x < w + h * .58; x += gap) {
      lines.push(`M${x} 0l${h * .58} ${h} M${x} 0l${-h * .58} ${h}`);
    }
    for (let y = 0; y < h; y += gap) lines.push(`M0 ${y}H${w}`);
  }
  if (modern && page.paper === "hex") {
    const r = gap * .55, dy = Math.sqrt(3) * r;
    for (let col = 0; col * r * 1.5 < w + r; col++)
      for (let row = -1; row * dy < h + dy; row++) {
        const cx = col * r * 1.5, cy = row * dy + (col % 2 ? dy / 2 : 0);
        const corners = Array.from({ length: 6 }, (_, i) => `${cx + r * Math.cos(i * Math.PI / 3)},${cy + r * Math.sin(i * Math.PI / 3)}`);
        lines.push("M" + corners.join("L") + "Z");
      }
  }
  const cards = page.paper === "flashcards" ? 4 : page.paper === "weekly" ? 8 : 0;
  const labels = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "ملاحظات"];
  return <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true"
    className="pointer-events-none absolute inset-0 z-0 size-full" style={{ overflow: "hidden" }}>
    <path d={lines.join(" ")} fill="none" stroke="#7292b5" opacity={preview ? .5 : .24} strokeWidth={preview ? 4 : 1}/>
    <path d={vertical.join(" ")} fill="none" stroke="#b27d91" opacity=".45" strokeWidth={preview ? 5 : 1}/>
    {modern && page.paper === "dots" && ys.flatMap((y, row) => {
      const points = [];
      for (let x = gap; x < w; x += gap) points.push(<circle key={row + ":" + x} cx={x} cy={y} r={preview ? 3 : 1} fill="#7292b5" opacity=".4"/>);
      return points;
    })}
    {Array.from({ length: cards }, (_, i) => {
      const rows = cards / 2, x = w * (.06 + (1 - i % 2) * .45), y = h * (.09 + Math.floor(i / 2) * .82 / rows);
      const height = h * .82 / rows - 12;
      return <g key={i}>
        <rect x={x} y={y} width={w * .43} height={height} rx={8} fill="none" stroke="#7292b5" opacity=".4" strokeWidth={preview ? 4 : 1}/>
        <path d={path(x, y + 30, x + w * .43, y + 30)} fill="none" stroke="#7292b5" opacity=".3"/>
        <text x={x + w * .41} y={y + 21} textAnchor="end" fill="#56718f" fontSize={13} fontFamily="IBM Plex Sans Arabic">
          {page.paper === "weekly" ? labels[i] : "بطاقة " + (i + 1)}
        </text>
      </g>;
    })}
  </svg>;
});
