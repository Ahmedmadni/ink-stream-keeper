package app.lovable.c357f296dbad4d33991e76d86c92e6d0;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.view.autofill.AutofillManager;

import app.lovable.c357f296dbad4d33991e76d86c92e6d0.autofill.AutofillBridge;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MemoFlowAutofill")
public final class MemoFlowAutofillPlugin extends Plugin {
    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        boolean supported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O;
        result.put("supported", supported);
        result.put("enabled", supported && isEnabled());
        try {
            result.put("credentialCount", AutofillBridge.count(getContext()));
            result.put("pendingCount", AutofillBridge.pendingCount(getContext()));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("تعذر قراءة مخزن الملء التلقائي المشفر");
        }
    }

    @PluginMethod
    public void requestEnable(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.reject("الملء التلقائي يحتاج Android 8 أو أحدث");
            return;
        }
        Intent intent = new Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE);
        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            intent = new Intent(Settings.ACTION_SETTINGS);
        }
        getActivity().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void syncCredentials(PluginCall call) {
        JSArray credentials = call.getArray("credentials");
        if (credentials == null) {
            call.reject("قائمة الحسابات مطلوبة");
            return;
        }
        try {
            AutofillBridge.replaceSynced(getContext(), credentials);
            JSObject result = new JSObject();
            result.put("credentialCount", AutofillBridge.count(getContext()));
            result.put("pendingCount", AutofillBridge.pendingCount(getContext()));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("تعذر تشفير حسابات الملء التلقائي");
        }
    }

    @PluginMethod
    public void getPendingCredentials(PluginCall call) {
        try {
            JSObject result = new JSObject();
            result.put("credentials", AutofillBridge.pending(getContext()));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("تعذر فتح الحسابات المحفوظة من أندرويد");
        }
    }

    @PluginMethod
    public void markImported(PluginCall call) {
        JSArray ids = call.getArray("ids");
        if (ids == null) {
            call.reject("معرّفات الحسابات مطلوبة");
            return;
        }
        try {
            AutofillBridge.removePending(getContext(), ids);
            call.resolve();
        } catch (Exception error) {
            call.reject("تعذر إكمال استيراد الحسابات");
        }
    }

    private boolean isEnabled() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false;
        AutofillManager manager = getContext().getSystemService(AutofillManager.class);
        return manager != null && manager.hasEnabledAutofillServices();
    }
}
