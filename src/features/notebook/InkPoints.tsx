import { memo, useEffect, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight, Check, RotateCcw } from "lucide-react";
import type { InkStroke } from "./model";
import { inkWorldPoint } from "./ink-segments";
import type { Point } from "./ink";

const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-3 text-xs font-semibold disabled:opacity-40";
export function InkPointPanel({ stroke, indices, active, onSelect, onPosition, onReset, onDone }: {
  stroke: InkStroke; indices: number[]; active: number; onSelect: (index: number) => void;
  onPosition: (point: Point) => boolean; onReset: () => void; onDone: () => void;
}) {
  const [x, y] = inkWorldPoint(stroke, active), position = Math.max(0, indices.indexOf(active));
  const [draftX, setX] = useState(""), [draftY, setY] = useState(""), [dirty, setDirty] = useState(false), [error, setError] = useState("");
  useEffect(() => { setX((x / 10).toFixed(2)); setY((y / 10).toFixed(2)); setDirty(false); setError(""); }, [stroke.id, active, x, y]);
  const apply = () => {
    if (!dirty) return;
    const a = Number(draftX), b = Number(draftY);
    if (!draftX.trim() || !draftY.trim() || !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 1000 || Math.abs(b) > 1000) {
      setError("أدخل إحداثيات رقمية بين ‎-1000% و1000%."); return;
    }
    if (onPosition([a * 10, b * 10])) { setDirty(false); setError(""); }
  };
  return <div className="space-y-3 rounded-xl border border-primary/30 bg-secondary/40 p-3" aria-label="إعدادات نقاط المسار">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <strong className="text-sm">نقطة التحكم {active + 1} من {stroke.points.length}</strong>
      <button type="button" className={button} onClick={onDone}><Check className="size-4"/>إنهاء تحرير النقاط</button>
    </div>
    <div className="flex items-center gap-2" dir="ltr">
      <button type="button" aria-label="نقطة التحكم السابقة" className={button} disabled={position === 0} onClick={() => onSelect(indices[position - 1])}><ChevronLeft className="size-4"/></button>
      <input type="range" min={0} max={indices.length - 1} step={1} value={position} aria-label="اختيار نقطة تحكم"
        aria-valuetext={`نقطة ${active + 1} من ${stroke.points.length}`} className="min-h-11 min-w-0 flex-1"
        onChange={(e) => onSelect(indices[Number(e.target.value)])}/>
      <button type="button" aria-label="نقطة التحكم التالية" className={button} disabled={position === indices.length - 1} onClick={() => onSelect(indices[position + 1])}><ChevronRight className="size-4"/></button>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <label className="text-xs">أفقي %<input type="number" aria-label="إحداثي نقطة المسار الأفقي" step={.01} min={-1000} max={1000} value={draftX} dir="ltr"
        onChange={(e) => { setX(e.target.value); setDirty(true); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } }}
        className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-2 text-sm"/></label>
      <label className="text-xs">رأسي %<input type="number" aria-label="إحداثي نقطة المسار الرأسي" step={.01} min={-1000} max={1000} value={draftY} dir="ltr"
        onChange={(e) => { setY(e.target.value); setDirty(true); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } }}
        className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-2 text-sm"/></label>
      <button type="button" disabled={!dirty} className={button + " self-end"} onClick={apply}>تطبيق الإحداثيات</button>
    </div>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    {(x < 0 || y < 0 || x > 1000 || y > 1000) && <p className="text-xs leading-6 text-muted-foreground">نقطة التحكم خارج الورقة؛ يمكنك ضبطها من حقول الإحداثيات. يظل الجزء الظاهر داخل الورقة.</p>}
    <p className="text-xs leading-6 text-muted-foreground">اسحب المقبض الأزرق أو حركه بالأسهم، ومع Shift تكون الخطوة أكبر. اضغط على الخط لاختيار نقطة قريبة. يعرض المحرر نقاط التحكم المؤثرة في الجزء المحدد.</p>
    <button type="button" className={button} disabled={!stroke.controlPoints && !stroke.offset} onClick={onReset}><RotateCcw className="size-4"/>استعادة النقاط والموضع الأصليين</button>
  </div>;
}

export const InkPointOverlay = memo(function InkPointOverlay({ stroke, indices, active, aspect, unitsPerPixel, onStart, onKey }: {
  stroke: InkStroke; indices: number[]; active: number; aspect: number; unitsPerPixel: number;
  onStart: (event: PointerEvent<SVGCircleElement>) => void; onKey: (event: KeyboardEvent<SVGCircleElement>) => void;
}) {
  const position = Math.max(0, indices.indexOf(active)), start = Math.max(0, Math.min(indices.length - 41, position - 20));
  const context = indices.slice(start, start + 41), [x, y] = inkWorldPoint(stroke, active);
  return <g>
    <polyline points={context.map((i) => { const p = inkWorldPoint(stroke, i); return p[0] + "," + p[1] * aspect; }).join(" ")}
      fill="none" stroke="#3275ba" strokeWidth={unitsPerPixel} strokeDasharray={`${unitsPerPixel * 3} ${unitsPerPixel * 4}`} opacity={.5} pointerEvents="none"/>
    {context.filter((i) => i !== active).map((i) => {
      const p = inkWorldPoint(stroke, i);
      return <circle key={i} cx={p[0]} cy={p[1] * aspect} r={2.5 * unitsPerPixel} fill="#ffffff" stroke="#3275ba" strokeWidth={unitsPerPixel} pointerEvents="none"/>;
    })}
    {x >= 0 && x <= 1000 && y >= 0 && y <= 1000 && <g>
      <circle cx={x} cy={y * aspect} r={20 * unitsPerPixel} fill="transparent" role="button" tabIndex={0}
        aria-label={`تحريك نقطة التحكم ${active + 1}`} data-active-ink-node={active} style={{ pointerEvents: "all", touchAction: "none", cursor: "move" }}
        className="focus-visible:outline-none focus-visible:stroke-[#0b4fa3]" strokeWidth={2 * unitsPerPixel}
        onPointerDown={onStart} onKeyDown={onKey}/>
      <circle cx={x} cy={y * aspect} r={6 * unitsPerPixel} fill="#3275ba" stroke="#ffffff" strokeWidth={2 * unitsPerPixel} pointerEvents="none"/>
    </g>}
  </g>;
});
