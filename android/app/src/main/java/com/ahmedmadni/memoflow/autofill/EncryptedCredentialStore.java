package com.ahmedmadni.memoflow.autofill;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

final class EncryptedCredentialStore {
    private static final String PREFS = "memoflow_autofill_secure";
    private static final String PAYLOAD = "encrypted_credentials_v1";
    private static final String KEY_ALIAS = "memoflow_autofill_aes_v1";
    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private static final String CIPHER = "AES/GCM/NoPadding";
    private static final int MAX_CREDENTIALS = 500;

    private final SharedPreferences preferences;

    EncryptedCredentialStore(Context context) {
        preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    synchronized List<MemoFlowCredential> all() throws GeneralSecurityException, JSONException {
        String encoded = preferences.getString(PAYLOAD, "");
        if (encoded == null || encoded.isEmpty()) return new ArrayList<>();
        JSONObject envelope = new JSONObject(encoded);
        byte[] iv = Base64.decode(envelope.getString("iv"), Base64.NO_WRAP);
        byte[] ciphertext = Base64.decode(envelope.getString("ciphertext"), Base64.NO_WRAP);

        Cipher cipher = Cipher.getInstance(CIPHER);
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, iv));
        byte[] plaintext = cipher.doFinal(ciphertext);
        JSONArray values = new JSONArray(new String(plaintext, StandardCharsets.UTF_8));
        List<MemoFlowCredential> result = new ArrayList<>();
        for (int i = 0; i < values.length() && result.size() < MAX_CREDENTIALS; i++) {
            MemoFlowCredential credential = MemoFlowCredential.fromJson(values.getJSONObject(i));
            if (!credential.id.isEmpty() && !credential.password.isEmpty()) result.add(credential);
        }
        return result;
    }

    synchronized List<MemoFlowCredential> matches(String packageName, String webDomain)
            throws GeneralSecurityException, JSONException {
        List<MemoFlowCredential> result = new ArrayList<>();
        for (MemoFlowCredential credential : all()) {
            if (credential.matches(packageName, webDomain)) result.add(credential);
        }
        return result;
    }

    synchronized List<MemoFlowCredential> pendingImports()
            throws GeneralSecurityException, JSONException {
        List<MemoFlowCredential> result = new ArrayList<>();
        for (MemoFlowCredential credential : all()) {
            if (credential.pendingImport) result.add(credential);
        }
        return result;
    }

    synchronized void replaceSynced(List<MemoFlowCredential> synced)
            throws GeneralSecurityException, JSONException {
        List<MemoFlowCredential> merged = new ArrayList<>();
        for (MemoFlowCredential existing : all()) {
            if (existing.pendingImport) merged.add(existing);
        }
        for (MemoFlowCredential incoming : synced) {
            if (incoming.id.isEmpty() || incoming.password.isEmpty()) continue;
            boolean shadowedByPending = false;
            for (MemoFlowCredential existing : merged) {
                if (existing.pendingImport && existing.sameAccount(incoming)) {
                    shadowedByPending = true;
                    break;
                }
            }
            if (!shadowedByPending) merged.add(incoming);
            if (merged.size() >= MAX_CREDENTIALS) break;
        }
        save(merged);
    }

    synchronized void saveCaptured(
            String label,
            String username,
            String password,
            String packageName,
            String webDomain)
            throws GeneralSecurityException, JSONException {
        MemoFlowCredential captured = new MemoFlowCredential(
                UUID.randomUUID().toString(),
                label,
                username,
                password,
                webDomain.isEmpty() ? "" : "https://" + webDomain,
                webDomain,
                packageName,
                true,
                System.currentTimeMillis());
        List<MemoFlowCredential> values = all();
        for (int i = 0; i < values.size(); i++) {
            MemoFlowCredential existing = values.get(i);
            if (existing.sameAccount(captured)) {
                captured = new MemoFlowCredential(
                        existing.id,
                        existing.label.isEmpty() ? captured.label : existing.label,
                        captured.username,
                        captured.password,
                        captured.url,
                        captured.webDomain,
                        captured.packageName,
                        true,
                        System.currentTimeMillis());
                values.remove(i);
                break;
            }
        }
        values.add(0, captured);
        if (values.size() > MAX_CREDENTIALS) values = values.subList(0, MAX_CREDENTIALS);
        save(values);
    }

    synchronized void removePending(Set<String> ids)
            throws GeneralSecurityException, JSONException {
        List<MemoFlowCredential> remaining = new ArrayList<>();
        for (MemoFlowCredential credential : all()) {
            if (credential.pendingImport && ids.contains(credential.id)) {
                remaining.add(new MemoFlowCredential(
                        credential.id,
                        credential.label,
                        credential.username,
                        credential.password,
                        credential.url,
                        credential.webDomain,
                        credential.packageName,
                        false,
                        credential.updatedAt));
            } else {
                remaining.add(credential);
            }
        }
        save(remaining);
    }

    synchronized int count() throws GeneralSecurityException, JSONException {
        return all().size();
    }

    synchronized int pendingCount() throws GeneralSecurityException, JSONException {
        return pendingImports().size();
    }

    private void save(List<MemoFlowCredential> values)
            throws GeneralSecurityException, JSONException {
        JSONArray array = new JSONArray();
        for (MemoFlowCredential credential : values) array.put(credential.toJson());

        Cipher cipher = Cipher.getInstance(CIPHER);
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
        byte[] ciphertext = cipher.doFinal(array.toString().getBytes(StandardCharsets.UTF_8));
        JSONObject envelope = new JSONObject();
        envelope.put("version", 1);
        envelope.put("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP));
        envelope.put("ciphertext", Base64.encodeToString(ciphertext, Base64.NO_WRAP));
        if (!preferences.edit().putString(PAYLOAD, envelope.toString()).commit()) {
            throw new GeneralSecurityException("Could not persist encrypted credentials");
        }
    }

    private SecretKey getOrCreateKey() throws GeneralSecurityException {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        try {
            keyStore.load(null);
        } catch (java.io.IOException error) {
            throw new GeneralSecurityException(error);
        }
        KeyStore.Entry entry = keyStore.getEntry(KEY_ALIAS, null);
        if (entry instanceof KeyStore.SecretKeyEntry) {
            return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
        }

        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE);
        generator.init(new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build());
        return generator.generateKey();
    }

    static Set<String> idSet(JSONArray values) throws JSONException {
        Set<String> ids = new HashSet<>();
        for (int i = 0; i < values.length(); i++) {
            String id = values.optString(i, "").trim();
            if (!id.isEmpty()) ids.add(id);
        }
        return ids;
    }
}
