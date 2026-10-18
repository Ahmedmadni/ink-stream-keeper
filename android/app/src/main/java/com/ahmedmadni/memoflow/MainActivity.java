package com.ahmedmadni.memoflow;

import com.getcapacitor.BridgeActivity;
import android.view.WindowManager;
import android.webkit.WebView;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        WebView.setWebContentsDebuggingEnabled(false);
        registerPlugin(MemoFlowAuthPlugin.class);
        registerPlugin(MemoFlowAppLockPlugin.class);
        registerPlugin(MemoFlowBackupPlugin.class);
        registerPlugin(MemoFlowAutofillPlugin.class);
        registerPlugin(MemoFlowFloatingPlugin.class);
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        // Keep CSS sizing deterministic; the responsive scale is controlled by the bundled UI.
        getBridge().getWebView().getSettings().setTextZoom(100);
    }

    @Override
    public void onStop() {
        super.onStop();
        if (!isChangingConfigurations()) MemoFlowAppLockPlugin.lockSession();
    }
}
