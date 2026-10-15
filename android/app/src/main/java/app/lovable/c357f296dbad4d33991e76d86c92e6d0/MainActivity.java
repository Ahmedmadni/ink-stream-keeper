package app.lovable.c357f296dbad4d33991e76d86c92e6d0;

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
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        // Keep CSS sizing deterministic; the responsive scale is controlled by the bundled UI.
        getBridge().getWebView().getSettings().setTextZoom(100);
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (!isChangingConfigurations()) MemoFlowAppLockPlugin.lockSession();
    }
}
