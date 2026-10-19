import { KeyRound } from "lucide-react";
import { appLock } from "@/services/app-lock";
import { PinChangeForm } from "@/components/PinChangeForm";

export function AppLockSettings() {
  if (!appLock.supported()) return null;
  return (
    <div className="p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
          <KeyRound className="size-6" />
        </span>
        <h3 className="text-base font-semibold">رمز فتح MemoFlow</h3>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        رمز من 6 أرقام لفتح التطبيق على هذا الهاتف. تغييره لا يغيّر رمز الخزنة.
      </p>
      <PinChangeForm
        subject="التطبيق"
        onSave={(current, next) => appLock.changePin(current, next)}
      />
    </div>
  );
}
