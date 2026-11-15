import { inkShape } from "./ink";
import type { InkStroke } from "./model";

export function InkMark({ stroke, aspect = 1, selected = false }: {
  stroke: InkStroke; aspect?: number; selected?: boolean;
}) {
  const shape = inkShape(stroke, aspect);
  return <path data-stroke-id={stroke.id} d={shape.d}
    fill={shape.fill ? stroke.color : "none"} stroke={shape.fill ? "none" : stroke.color}
    strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round"
    opacity={stroke.tool === "highlighter" ? .34 : 1}
    style={{ pointerEvents: "none", filter: selected ? "drop-shadow(0 0 3px #4c96ff)" : undefined }} />;
}
