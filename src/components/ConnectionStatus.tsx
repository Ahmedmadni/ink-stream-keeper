import { useEffect, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { CloudCheck, CloudUpload, Loader2, WifiOff } from "lucide-react";

/** Reports transport activity only; never claims that cached edits have synced. */
export function ConnectionStatus() {
  const [online, setOnline] = useState(true);
  const saving = useIsMutating() > 0;
  const fetching = useIsFetching() > 0;
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const Icon = !online ? WifiOff : saving ? CloudUpload : fetching ? Loader2 : CloudCheck;
  const label = !online ? "دون اتصال · استخدام محدود" : saving ? "جارٍ الحفظ" : fetching ? "جارٍ التحديث" : "متصل";
  return (
    <span role="status" aria-live="polite" className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      <Icon aria-hidden="true" className={`size-4 shrink-0 ${online && fetching && !saving ? "animate-spin" : ""}`} />
      <span className="break-words">{label}</span>
    </span>
  );
}