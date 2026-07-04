import type { BlockRendererProps } from "@/lib/engine/blocks";
import { emit } from "@/lib/engine/block-events";

export type ProgressBlockProps = {
  value: number;
  label?: string;
  hint?: string;
  onChange?: (v: number) => void;
};

export function ProgressBlock({ block }: BlockRendererProps<ProgressBlockProps>) {
  const { value, label = "نسبة الإنجاز", hint, onChange } = block.props;
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs font-bold text-muted-foreground">
        <span>{label}</span>
        <span className="text-primary">{pct}%</span>
      </div>
      {onChange ? (
        <input
          type="range" min={0} max={100} step={5} value={pct}
          onChange={(e) => { const v = Number(e.target.value); onChange(v); emit("field:save", { name: "progress", value: v }); }}
          className="w-full accent-primary"
          aria-label={label}
        />
      ) : (
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-gradient-to-l from-primary to-primary/70 transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
      {hint ? <p className="mt-1.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}