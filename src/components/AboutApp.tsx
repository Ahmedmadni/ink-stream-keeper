import { Code2, ExternalLink } from "lucide-react";
import { APP_VERSION, DEVELOPER_NAME, DEVELOPER_URL } from "@/lib/app-info";

export function AboutApp() {
  return (
    <div className="p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
          <Code2 className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">مطور النظام</p>
          <p className="mt-1 text-base font-semibold">{DEVELOPER_NAME}</p>
        </div>
        <span dir="ltr" className="rounded-lg bg-secondary px-2 py-1 text-xs text-muted-foreground">
          v{APP_VERSION}
        </span>
      </div>
      <a
        href={DEVELOPER_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex min-h-11 items-center justify-between gap-2 rounded-xl bg-secondary px-3 text-sm font-medium"
      >
        موقع المطوّر <ExternalLink className="size-4" />
      </a>
      <details className="mt-4 text-xs leading-6 text-muted-foreground">
        <summary className="cursor-pointer">التعرف على الخط وتراخيص الرسومات</summary>
        <p>تجربة التعرف العربي في أندرويد تستخدم Google ML Kit محليًا بعد تنزيل نموذج اللغة. لا يرسل المحرك الحبر أو النص الناتج إلى Google؛ قد يرسل مقاييس أداء واستخدام ويتصل لتحديث النماذج.</p>
        <a className="underline" href="https://developers.google.com/ml-kit/terms" target="_blank" rel="noopener noreferrer">شروط ML Kit والخصوصية</a>
        <p>الرسومات العلمية: SciSVG — Saveena Solanki، CC BY 4.0. الملصقات الخطية: Lucide، ISC/MIT. خط عارف رقعة: SIL Open Font License 1.1.</p>
        <a className="underline" href="https://github.com/SaveenaSolanki/SciSVG" target="_blank" rel="noopener noreferrer">مصدر الرسومات العلمية</a>
      </details>
    </div>
  );
}
