package com.ahmedmadni.memoflow;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import android.os.Handler;
import android.os.Looper;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.ActivityCallback;
import java.util.ArrayList;

/** Shows note/task reminder cards above other apps (requires "Display over other apps"). */
@CapacitorPlugin(name = "MemoFlowFloating")
public class MemoFlowFloatingPlugin extends Plugin {
    private PluginCall pendingCall;
    private boolean showAfterPermission;
    private boolean leftForSettings;

    private boolean granted() {
        return Settings.canDrawOverlays(getContext());
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", granted());
        r.put("running", FloatingCardService.isRunning());
        call.resolve(r);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (granted()) {
            JSObject r = new JSObject();
            r.put("granted", true);
            call.resolve(r);
            return;
        }

        openPermission(call, false);
    }

    private void openPermission(PluginCall call, boolean showWhenGranted) {
        if (pendingCall != null) {
            call.reject("طلب الإذن مفتوح بالفعل؛ ارجع إلى إعدادات الهاتف لإكماله.");
            return;
        }
        pendingCall = call;
        showAfterPermission = showWhenGranted;
        leftForSettings = false;
        try {
            Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getContext().getPackageName()));
            startActivityForResult(call, intent, "overlayPermissionResult");
        } catch (Exception firstError) {
            try {
                startActivityForResult(call, new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION), "overlayPermissionResult");
            } catch (Exception error) {
                pendingCall = null;
                call.reject("هذا الهاتف لا يتيح نافذة إذن البطاقات. افتح إعدادات الهاتف ثم وصول خاص ثم الظهور فوق التطبيقات.", error);
            }
        }
    }

    @Override
    protected void handleOnPause() {
        if (pendingCall != null) leftForSettings = true;
    }

    @Override
    protected void handleOnResume() {
        if (pendingCall != null && leftForSettings) {
            new Handler(Looper.getMainLooper()).postDelayed(this::finishPermission, 350);
        }
    }

    @ActivityCallback
    private void overlayPermissionResult(PluginCall call, ActivityResult ignored) {
        finishPermission();
    }

    private void finishPermission() {
        PluginCall call = pendingCall;
        if (call == null) return;
        pendingCall = null;
        if (showAfterPermission && granted()) {
            showCard(call);
            return;
        }
        if (showAfterPermission) {
            call.reject("لم يُمنح إذن الظهور فوق التطبيقات. اختر MemoFlow في قائمة الهاتف وفعّل السماح.", "OVERLAY_PERMISSION_DENIED");
            return;
        }
        JSObject r = new JSObject();
        r.put("granted", granted());
        call.resolve(r);
    }

    @PluginMethod
    public void show(PluginCall call) {
        if (!granted()) {
            openPermission(call, true);
            return;
        }
        showCard(call);
    }

    private void showCard(PluginCall call) {
        ArrayList<String> lines = new ArrayList<>();
        try {
            JSArray items = call.getArray("items", new JSArray());
            for (int k = 0; k < Math.min(items.length(), 6); k++) {
                org.json.JSONObject o = items.getJSONObject(k);
                lines.add(("task".equals(o.optString("kind")) ? "☐ " : "📝 ") + o.optString("title"));
            }
        } catch (Exception ignored) { }
        Intent i = new Intent(getContext(), FloatingCardService.class);
        i.putStringArrayListExtra("lines", lines);
        try {
            getContext().startService(i);
            call.resolve();
        } catch (Exception error) {
            call.reject("تعذر تشغيل البطاقة العائمة على هذا الهاتف.", error);
        }
    }

    @PluginMethod
    public void hide(PluginCall call) {
        getContext().stopService(new Intent(getContext(), FloatingCardService.class));
        call.resolve();
    }
}
