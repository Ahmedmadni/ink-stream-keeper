import { useEffect, useState } from "react";
import { toast } from "sonner";

export function useOnlineStatus() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const goOnline = () => {
      setOnline(true);
      toast.success("عاد الاتصال بالإنترنت");
    };
    const goOffline = () => {
      setOnline(false);
      toast.warning("لا يوجد اتصال — سيعمل التطبيق بوضع محدود");
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}