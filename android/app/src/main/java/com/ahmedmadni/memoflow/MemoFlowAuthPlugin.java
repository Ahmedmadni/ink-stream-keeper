package com.ahmedmadni.memoflow;

import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.net.URI;

@CapacitorPlugin(name = "MemoFlowAuth")
public final class MemoFlowAuthPlugin extends Plugin {
    private static final String APP_SCHEME = "app.lovable.c357f296dbad4d33991e76d86c92e6d0";
    private static final String APP_CALLBACK_HOST = "auth";
    private static final String APP_CALLBACK_PATH = "/callback";
    private static final String APP_RECOVERY_PATH = "/recovery";
    private static final String OAUTH_HOST = "ink-stream-keeper.lovable.app";
    private static final String OAUTH_PATH = "/~oauth/initiate";

    @PluginMethod
    public void openOAuth(PluginCall call) {
        String url = call.getString("url");
        if (!isAllowedOAuthUrl(url)) {
            call.reject("رابط تسجيل الدخول غير موثوق");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            call.reject("لا يوجد متصفح متاح لإكمال تسجيل الدخول");
            return;
        }
        getActivity().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void getLaunchUrl(PluginCall call) {
        Intent intent = getActivity().getIntent();
        Uri data = intent == null ? null : intent.getData();
        JSObject result = new JSObject();
        if (data != null && isAuthCallback(data.toString())) {
            result.put("url", data.toString());
            intent.setData(null);
        }
        call.resolve(result);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data == null || !isAuthCallback(data.toString())) return;
        JSObject result = new JSObject();
        result.put("url", data.toString());
        notifyListeners("authCallback", result, true);
    }

    static boolean isAllowedOAuthUrl(String rawUrl) {
        try {
            URI url = new URI(rawUrl);
            return "https".equals(url.getScheme())
                    && OAUTH_HOST.equals(url.getHost())
                    && OAUTH_PATH.equals(url.getPath())
                    && url.getRawQuery() != null;
        } catch (Exception ignored) {
            return false;
        }
    }

    static boolean isAuthCallback(String rawUrl) {
        try {
            URI url = new URI(rawUrl);
            return APP_SCHEME.equals(url.getScheme())
                    && APP_CALLBACK_HOST.equals(url.getHost())
                    && (APP_CALLBACK_PATH.equals(url.getPath()) || APP_RECOVERY_PATH.equals(url.getPath()));
        } catch (Exception ignored) {
            return false;
        }
    }
}
