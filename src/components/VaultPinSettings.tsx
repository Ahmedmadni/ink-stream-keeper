import { Link } from "@tanstack/react-router";
import { LockKeyhole, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { changeVaultPin, useVaultSettings } from "@/lib/vault";
import { PinChangeForm } from "@/components/PinChangeForm";
import { vaultSession } from "@/features/vault/session";

export function VaultPinSettings() {
  const query = useVaultSettings();
  const client = useQueryClient();
  return (
    <div className="p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
          <LockKeyhole className="size-6" />
        </span>
        <h3 className="text-base font-semibold">رمز الخزنة</h3>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        غيّر رمز الخزنة باستخدام الرمز الحالي. تبقى حساباتك محفوظة، وتُقفل الخزنة بعد نجاح التغيير.
      </p>
      {query.isLoading ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> جارٍ التحقق من إعداد الخزنة…
        </p>
      ) : query.isError ? (
        <div className="mt-3">
          <p role="alert" className="text-sm text-destructive">
            تعذر تحميل إعدادات الخزنة.
          </p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="mt-2 min-h-11 rounded-xl bg-secondary px-4 text-sm font-medium"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : query.data ? (
        <PinChangeForm
          subject="الخزنة"
          onSave={async (current, next) => {
            const settings = await changeVaultPin(current, next);
            if (!vaultSession.isCurrentUser(settings.user_id)) return;
            client.setQueryData(["vault", "settings"], settings);
            void client.invalidateQueries({ queryKey: ["vault", "settings"] });
          }}
        />
      ) : (
        <Link
          to="/vault"
          className="mt-3 flex min-h-12 items-center justify-center rounded-xl bg-secondary px-4 text-sm font-semibold"
        >
          إنشاء رمز الخزنة
        </Link>
      )}
    </div>
  );
}
