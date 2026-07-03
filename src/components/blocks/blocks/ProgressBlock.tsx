import type { BlockRendererProps } from "@/lib/engine/blocks";

export type ProgressBlockProps = {
  value: number;
  label?: string;
  hint?: string;
};

export function ProgressBlock({ block }: BlockRendererProps<ProgressBlockProps>) {
  const { value, label = "نسبة الإنجاز", hint } = block.props;
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs font-bold text-muted-foreground">
        <span>{label}</span>
        <span className="text-primary">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full bg-gradient-to-l from-primary to-primary/70 transition-all" style={{ width: `${pct}%` }} />
      </div>
      {hint ? <p className="mt-1.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}