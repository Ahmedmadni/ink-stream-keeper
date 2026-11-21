import { memo, useId, type ReactNode } from "react";
import { inkShape } from "./ink";
import type { InkStroke } from "./model";

export const InkMark = memo(function InkMark({ stroke, aspect = 1, selected = false, opacity }: {
  stroke: InkStroke; aspect?: number; selected?: boolean; opacity?: number;
}) {
  const shape = inkShape(stroke, aspect);
  const patternId = "pencil-" + useId().replace(/:/g, "");
  const paint = stroke.brush === "pencil" ? `url(#${patternId})` : stroke.color;
  return <>{stroke.brush === "pencil" && <defs>
    {/* Original procedural graphite grain, fixed to paper coordinates. No
      filter, random seed, remote bitmap, mask or change to hit/erase geometry.
      Shared by editor, vault, thumbnails and PDF; fragments keep the same phase. */}
    <pattern id={patternId} data-pencil-grain="1" patternUnits="userSpaceOnUse" width="8" height="8">
      <rect width="8" height="8" fill={stroke.color} opacity=".28"/>
      <g fill={stroke.color}>
        <rect x=".2" y=".5" width="1.4" height=".9" opacity=".68"/>
        <rect x="3.5" y=".1" width=".7" height="1.7" opacity=".48"/>
        <rect x="6" y="1.8" width="1.3" height=".6" opacity=".7"/>
        <rect x="1.8" y="3" width="1" height="1.4" opacity=".55"/>
        <rect x="4.6" y="4" width="1.8" height=".8" opacity=".7"/>
        <rect x=".3" y="6" width=".8" height="1.2" opacity=".45"/>
        <rect x="3.1" y="6.5" width="1.1" height=".7" opacity=".62"/>
        <rect x="6.8" y="6.2" width=".9" height="1.4" opacity=".52"/>
      </g>
    </pattern>
  </defs>}<path data-stroke-id={stroke.id} data-ink-brush={stroke.brush} d={shape.d}
    fill={shape.fill ? paint : "none"} stroke={shape.fill ? "none" : paint}
    strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round"
    opacity={opacity ?? (stroke.tool === "highlighter" ? .34 : 1)}
    style={{ pointerEvents: "none", filter: selected ? "drop-shadow(0 0 3px #4c96ff)" : undefined }} /></>;
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
