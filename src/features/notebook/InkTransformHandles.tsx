import { useCallback, useEffect, useMemo, useRef, type PointerEvent, type KeyboardEvent } from "react";
import { RotateCw } from "lucide-react";
import type { InkStroke } from "./model";
import type { InkBounds, Point } from "./ink";
import { inkTransformFrame, type InkTransformOptions } from "./ink-transform";
import { draftTransformOptions, validTransformOptions, transformDraft, transformFromHandle, transformHandleLayout, nudgeTransformHandle,
  type TransformHandleKind, type InkTransformDraft } from "./transform-handles";

type Drag = { pointerId: number; target: SVGCircleElement; kind: TransformHandleKind; frame: InkBounds;
  from: Point; aspect: number; width: number; draft: InkTransformDraft; options: InkTransformOptions };
const release = (active: Drag) => { if (active.target.hasPointerCapture(active.pointerId)) active.target.releasePointerCapture(active.pointerId); };
export function InkTransformHandles({ source, ids, aspect, unitsPerPixel, draft, error, onChange, onGesture, allowPointer }: {
  source: InkStroke[]; ids: Set<string>; aspect: number; unitsPerPixel: number; draft: InkTransformDraft; error: boolean;
  onChange: (draft: InkTransformDraft) => void; onGesture: (cancel: (() => void) | null) => void;
  allowPointer: (event: PointerEvent<SVGElement>) => boolean;
}) {
  const svg = useRef<SVGSVGElement | null>(null), drag = useRef<Drag | null>(null);
  const options = draftTransformOptions(draft);
  const { scale, rotation } = options;
  const frame = useMemo(() => inkTransformFrame(source, ids, aspect), [source, ids, aspect]);
  const layout = useMemo(() => {
    const value = { scale, rotation };
    if (!frame || !validTransformOptions(value)) return null;
    try { return transformHandleLayout(frame, value, aspect, unitsPerPixel); } catch { return null; }
  }, [frame, scale, rotation, aspect, unitsPerPixel]);
  const point = (event: PointerEvent<SVGElement>): Point | null => {
    const rect = svg.current?.getBoundingClientRect();
    return rect && rect.width > 0 && rect.height > 0 ? [(event.clientX - rect.left) * 1000 / rect.width,
      (event.clientY - rect.top) * 1000 / rect.height] : null;
  };
  const cancel = useCallback(() => {
    const active = drag.current;
    if (!active) return;
    drag.current = null; onChange(active.draft); onGesture(null); release(active);
  }, [onChange, onGesture]);
  useEffect(() => {
    const hide = () => { if (document.hidden) cancel(); };
    const resize = () => { if (drag.current && Math.abs((svg.current?.getBoundingClientRect().width ?? 0) - drag.current.width) > .5) cancel(); };
    window.addEventListener("blur", cancel); window.addEventListener("resize", resize); document.addEventListener("visibilitychange", hide);
    return () => { window.removeEventListener("blur", cancel); window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", hide); drag.current = null; };
  }, [cancel]);
  useEffect(() => {
    if (drag.current && Math.abs((svg.current?.getBoundingClientRect().width ?? 0) - drag.current.width) > .5) cancel();
  }, [unitsPerPixel, aspect, cancel]);
  const start = (event: PointerEvent<SVGCircleElement>, kind: TransformHandleKind) => {
    if (!event.isPrimary || event.button !== 0 || drag.current || !frame || !layout || !validTransformOptions(options) || !allowPointer(event)) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.focus({ preventScroll: true });
    const from = point(event); if (!from) return;
    drag.current = { pointerId: event.pointerId, target: event.currentTarget, kind, frame, from, aspect,
      width: svg.current!.getBoundingClientRect().width, draft, options };
    event.currentTarget.setPointerCapture(event.pointerId); onGesture(cancel);
  };
  const move = (event: PointerEvent<SVGSVGElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (event.pointerType === "pen") allowPointer(event);
    event.preventDefault(); event.stopPropagation();
    const to = point(event); if (!to) { cancel(); return; }
    try {
      const next = transformFromHandle(active.options, active.frame, active.from, to, active.kind, active.aspect, event.shiftKey);
      onChange(next === active.options ? active.draft : transformDraft(next));
    } catch { cancel(); }
  };
  const finish = (event: PointerEvent<SVGSVGElement>) => {
    const active = drag.current; if (!active || active.pointerId !== event.pointerId) return;
    move(event); if (drag.current !== active) return;
    drag.current = null; onGesture(null); release(active);
  };
  const key = (event: KeyboardEvent<SVGCircleElement>, kind: TransformHandleKind) => {
    if (event.key === "Escape" && drag.current) { event.preventDefault(); event.stopPropagation(); cancel(); return; }
    if (event.ctrlKey || event.metaKey) return;
    const next = nudgeTransformHandle(options, kind, event.key, event.shiftKey);
    if (!next) return;
    event.preventDefault(); event.stopPropagation();
    if (!drag.current) onChange(transformDraft(next));
  };
  if (!layout) return null;
  const u = unitsPerPixel, color = error ? "#d94b65" : "#3275ba";
  const handle = (p: Point, kind: TransformHandleKind, index: number) => <g key={kind + index}>
    <circle cx={p[0]} cy={p[1]} r={22 * u} fill="transparent" strokeWidth={2 * u} role="slider" tabIndex={0}
      aria-label={kind === "scale" ? `مقبض تغيير حجم الرسم ${index + 1}` : "مقبض تدوير الرسم"}
      aria-valuemin={kind === "scale" ? 25 : -180} aria-valuemax={kind === "scale" ? 400 : 180}
      aria-valuenow={kind === "scale" ? options.scale * 100 : options.rotation}
      aria-valuetext={kind === "scale" ? `حجم ${Math.round(options.scale * 1000) / 10}%` : `زاوية ${options.rotation}°`}
      data-transform-handle={kind} data-transform-corner={kind === "scale" ? index : undefined}
      style={{ pointerEvents: "all", touchAction: "none", cursor: kind === "scale" ? "nwse-resize" : "grab" }}
      className="focus-visible:outline-none focus-visible:stroke-[#0b4fa3]"
      onPointerDown={(event) => start(event, kind)} onKeyDown={(event) => key(event, kind)}/>
    {kind === "scale" ? <rect x={p[0] - 6 * u} y={p[1] - 6 * u} width={12 * u} height={12 * u} rx={2 * u}
      fill={color} stroke="#fff" strokeWidth={2 * u} pointerEvents="none"/>
      : <g pointerEvents="none"><circle cx={p[0]} cy={p[1]} r={10 * u} fill={color} stroke="#fff" strokeWidth={2 * u}/>
        <RotateCw x={p[0] - 7 * u} y={p[1] - 7 * u} width={14 * u} height={14 * u} color="#fff" strokeWidth={2}/></g>}
  </g>;
  return <svg ref={svg} viewBox={`0 0 1000 ${1000 * aspect}`} preserveAspectRatio="none" data-ink-editor="transform"
    role="group" aria-label="مقابض التحويل المباشر" className="pointer-events-none absolute inset-0 z-[35] size-full"
    onPointerMove={move} onPointerUp={finish} onPointerCancel={(event) => { if (drag.current?.pointerId === event.pointerId) cancel(); }}
    onLostPointerCapture={(event) => { if (drag.current?.pointerId === event.pointerId) cancel(); }}>
    <polygon points={layout.outline.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth={u} strokeDasharray={`${5 * u} ${4 * u}`}/>
    <line x1={layout.anchor[0]} y1={layout.anchor[1]} x2={layout.rotation[0]} y2={layout.rotation[1]} stroke={color} strokeWidth={u}/>
    <circle data-transform-center="" cx={layout.center[0]} cy={layout.center[1]} r={2 * u} fill={color} opacity={.5}/>
    {layout.corners.map((p, index) => handle(p, "scale", index))}{handle(layout.rotation, "rotate", 0)}
  </svg>;
}
