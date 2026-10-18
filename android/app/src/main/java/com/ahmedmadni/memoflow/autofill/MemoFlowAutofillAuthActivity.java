package com.ahmedmadni.memoflow.autofill;

import android.app.Activity;
import android.app.KeyguardManager;
import android.app.assist.AssistStructure;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.WindowManager;
import android.view.autofill.AutofillManager;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.annotation.RequiresApi;

import java.util.List;

@RequiresApi(26)
public final class MemoFlowAutofillAuthActivity extends Activity {
    private static final int REQUEST_DEVICE_UNLOCK = 8102;
    private AssistStructure structure;

    @Override
    protected void onCreate(@Nullable Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        structure = getIntent().getParcelableExtra(AutofillManager.EXTRA_ASSIST_STRUCTURE);
        if (structure == null) {
            cancel();
            return;
        }
        KeyguardManager keyguard = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
        if (keyguard == null || !keyguard.isDeviceSecure()) {
            Toast.makeText(this, "فعّل قفل الشاشة أولًا لحماية كلمات المرور", Toast.LENGTH_LONG).show();
            cancel();
            return;
        }
        Intent unlock = keyguard.createConfirmDeviceCredentialIntent(
                "فتح MemoFlow",
                "استخدم بصمة الجهاز أو رمز قفل الشاشة للملء التلقائي");
        if (unlock == null) {
            cancel();
            return;
        }
        startActivityForResult(unlock, REQUEST_DEVICE_UNLOCK);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQUEST_DEVICE_UNLOCK || resultCode != RESULT_OK || structure == null) {
            cancel();
            return;
        }
        try {
            AutofillFormParser.ParsedForm form = new AutofillFormParser().parse(structure);
            List<MemoFlowCredential> credentials = new EncryptedCredentialStore(this)
                    .matches(form.packageName, form.webDomain);
            if (credentials.isEmpty() || form.passwordId == null) {
                cancel();
                return;
            }
            Intent reply = new Intent();
            reply.putExtra(
                    AutofillManager.EXTRA_AUTHENTICATION_RESULT,
                    MemoFlowAutofillService.authenticatedResponse(this, form, credentials));
            setResult(RESULT_OK, reply);
            finish();
        } catch (Exception error) {
            Toast.makeText(this, "تعذر فك بيانات MemoFlow", Toast.LENGTH_SHORT).show();
            cancel();
        }
    }

    private void cancel() {
        setResult(RESULT_CANCELED);
        finish();
    }
}
