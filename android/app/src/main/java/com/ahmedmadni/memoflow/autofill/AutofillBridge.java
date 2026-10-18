package com.ahmedmadni.memoflow.autofill;

import android.content.Context;

import com.getcapacitor.JSArray;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.security.GeneralSecurityException;
import java.util.ArrayList;
import java.util.List;

public final class AutofillBridge {
    private AutofillBridge() {}

    public static void replaceSynced(Context context, JSONArray values)
            throws JSONException, GeneralSecurityException {
        List<MemoFlowCredential> credentials = new ArrayList<>();
        for (int i = 0; i < values.length(); i++) {
            JSONObject value = values.getJSONObject(i);
            credentials.add(new MemoFlowCredential(
                    value.optString("id"),
                    value.optString("label"),
                    value.optString("username"),
                    value.optString("password"),
                    value.optString("url"),
                    "",
                    "",
                    false,
                    System.currentTimeMillis()));
        }
        new EncryptedCredentialStore(context).replaceSynced(credentials);
    }

    public static JSArray pending(Context context)
            throws JSONException, GeneralSecurityException {
        JSArray result = new JSArray();
        for (MemoFlowCredential credential : new EncryptedCredentialStore(context).pendingImports()) {
            JSONObject value = new JSONObject();
            value.put("id", credential.id);
            value.put("label", credential.label);
            value.put("username", credential.username);
            value.put("password", credential.password);
            value.put("url", credential.url);
            value.put("webDomain", credential.webDomain);
            value.put("packageName", credential.packageName);
            result.put(value);
        }
        return result;
    }

    public static void removePending(Context context, JSONArray ids)
            throws JSONException, GeneralSecurityException {
        new EncryptedCredentialStore(context).removePending(EncryptedCredentialStore.idSet(ids));
    }

    public static int count(Context context) throws JSONException, GeneralSecurityException {
        return new EncryptedCredentialStore(context).count();
    }

    public static int pendingCount(Context context) throws JSONException, GeneralSecurityException {
        return new EncryptedCredentialStore(context).pendingCount();
    }
}
