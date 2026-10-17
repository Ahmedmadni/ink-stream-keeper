package app.lovable.c357f296dbad4d33991e76d86c92e6d0;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
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

    private boolean granted() {
        return Settings.canDrawOverlays(getContext());
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", granted());
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

        Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getContext().getPackageName()));
        startActivityForResult(call, i, "overlayPermissionResult");
    }

    @ActivityCallback
    private void overlayPermissionResult(PluginCall call, ActivityResult ignored) {
        JSObject r = new JSObject();
        r.put("granted", granted());
        call.resolve(r);
    }

    @PluginMethod
    public void show(PluginCall call) {
        if (!granted()) { call.reject("overlay_permission_denied"); return; }
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
        getContext().startService(i);
        call.resolve();
    }

    @PluginMethod
    public void hide(PluginCall call) {
        getContext().stopService(new Intent(getContext(), FloatingCardService.class));
        call.resolve();
    }
}
