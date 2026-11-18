import { memo, type ReactNode } from "react";
import { inkShape } from "./ink";
import type { InkStroke } from "./model";

export const InkMark = memo(function InkMark({ stroke, aspect = 1, selected = false, opacity }: {
  stroke: InkStroke; aspect?: number; selected?: boolean; opacity?: number;
}) {
  const shape = inkShape(stroke, aspect);
  return <path data-stroke-id={stroke.id} d={shape.d}
    fill={shape.fill ? stroke.color : "none"} stroke={shape.fill ? "none" : stroke.color}
    strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round"
    opacity={opacity ?? (stroke.tool === "highlighter" ? .34 : 1)}
    style={{ pointerEvents: "none", filter: selected ? "drop-shadow(0 0 3px #4c96ff)" : undefined }} />;
});

/** Keep split highlighter fragments in one compositing group, without tying
 * their selection or movement together. Adjacent groups retain layer order. */
export function InkLayer({ strokes, aspect = 1, selected }: { strokes: InkStroke[]; aspect?: number; selected?: Set<string> }) {
  const result: ReactNode[] = [];
  for (let i = 0; i < strokes.length;) {
    const stroke = strokes[i];
    if (stroke.tool === "highlighter" && stroke.paintGroup) {
      const children: ReactNode[] = [];
      while (i < strokes.length && strokes[i].tool === "highlighter" && strokes[i].paintGroup === stroke.paintGroup) {
        const part = strokes[i++];
        children.push(<InkMark key={part.id} stroke={part} aspect={aspect} selected={selected?.has(part.id)} opacity={1}/>);
      }
      result.push(<g key={stroke.id} opacity={.34} data-ink-paint-group={stroke.paintGroup}>{children}</g>);
    } else {
      result.push(<InkMark key={stroke.id} stroke={stroke} aspect={aspect} selected={selected?.has(stroke.id)}/>); i++;
    }
  }
  return <>{result}</>;
}
