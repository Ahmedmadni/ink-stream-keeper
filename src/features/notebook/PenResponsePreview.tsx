import { InkMark } from "./InkMark";
import type { InkStroke } from "./model";

export function PenResponsePreview({ response, width, color, enabled }: {
  response: number; width: number; color: string; enabled: boolean;
}) {
  const stroke: InkStroke = {
    id: "dd32f56d-3561-4bb2-86e9-b7f6fd5c003a", tool: "pen", color, width: width * 3,
    points: Array.from({ length: 41 }, (_, i) => [35 + i * 23, 55 + Math.sin(i / 6) * 18]),
    ...(enabled ? { pressures: Array.from({ length: 41 }, (_, i) => Math.sin(i / 40 * Math.PI) ** 2), pressureResponse: response } : {}),
  };
  return <div className="rounded-xl border border-border bg-background px-3 py-2">
    <svg role="img" aria-label="معاينة توضيحية لاستجابة الضغط" viewBox="0 0 1000 110" className="h-12 w-full">
      <InkMark stroke={stroke} aspect={1}/>
    </svg>
    <p className="text-xs leading-5 text-muted-foreground">معاينة توضيحية · الضغط الخفيف إلى القوي. تستجيب المسارات الجديدة لقراءة قلم يدعم الضغط؛ الماوس واللمس بسمك ثابت. تبقى قراءات الضغط الأصلية محفوظة.</p>
  </div>;
}
