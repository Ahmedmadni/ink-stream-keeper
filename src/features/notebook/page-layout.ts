import type { CSSProperties } from "react";
import { dimensionsMm, type NotebookPage } from "./model";

export const TINT_COLORS = {
  white: "#ffffff", ivory: "#fffdf4", mint: "#f4fff9", blue: "#f4faff", rose: "#fff6fa",
};
/** Fixed logical sheet, scaled as one unit in the UI. Responsive reflow must
 * never move the text independently from saved ink/stickers. */
export function pageLayout(page: NotebookPage) {
  const [widthMm, heightMm] = dimensionsMm(page.size, page.orientation);
  return { width: widthMm * 780 / 210, height: heightMm * 780 / 210,
    widthMm, heightMm, aspect: heightMm / widthMm };
}
export function paperStyle(page: NotebookPage): CSSProperties {
  const color = "rgba(80,119,177,.17)";
  const style: CSSProperties = { backgroundColor: TINT_COLORS[page.tint] };
  if (page.paper === "lined" || page.paper === "cornell") {
    style.backgroundImage = `repeating-linear-gradient(to bottom,transparent 0px,transparent 29px,${color} 30px,transparent 31px)`;
  } else if (page.paper === "grid" || page.paper === "ledger") {
    style.backgroundImage = `linear-gradient(to right,${color} 1px,transparent 1px),linear-gradient(to bottom,${color} 1px,transparent 1px)`;
    style.backgroundSize = page.paper === "ledger" ? "84px 31px" : "30px 30px";
  } else if (page.paper === "dots") {
    style.backgroundImage = "radial-gradient(circle,rgba(66,112,166,.30) 1px,transparent 1.6px)";
    style.backgroundSize = "24px 24px";
  }
  return style;
}
