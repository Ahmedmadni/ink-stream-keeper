package com.ahmedmadni.memoflow;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Base64;
import android.webkit.CookieManager;
import android.webkit.WebStorage;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

/** Device-local application PIN gate. The raw PIN is never persisted. */
@CapacitorPlugin(name = "MemoFlowAppLock")
public final class MemoFlowAppLockPlugin extends Plugin {
    private static final String PREFS = "memoflow_app_lock_v1";
    private static final String SALT = "salt";
    private static final String VERIFIER = "verifier";
    private static final String KDF = "kdf";
    private static final String FAILURES = "failures";
    private static final String BLOCKED_UNTIL = "blocked_until";
    private static final int ITERATIONS = 240_000;
    private static final int KEY_BITS = 256;
    private static final SecureRandom RANDOM = new SecureRandom();
    private static volatile boolean sessionUnlocked = false;

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static boolean isSessionUnlocked() {
        return sessionUnlocked;
    }

    public static void lockSession() {
        sessionUnlocked = false;
    }

    static boolean isValidPin(String pin) {
        return pin != null && pin.matches("[0-9]{6}");
    }

    private boolean configured() {
        SharedPreferences preferences = preferences();
        return preferences.contains(SALT) && preferences.contains(VERIFIER);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        SharedPreferences preferences = preferences();
        JSObject result = new JSObject();
        result.put("configured", configured());
        result.put("unlocked", configured() && sessionUnlocked);
        result.put("blockedUntil", preferences.getLong(BLOCKED_UNTIL, 0));
        call.resolve(result);
    }

    @PluginMethod
    public void configure(PluginCall call) {
        String pin = call.getString("pin");
        if (!isValidPin(pin)) {
            call.reject("يجب أن يتكون رمز التطبيق من 6 أرقام");
            return;
        }
        if (configured()) {
            call.reject("رمز التطبيق مضبوط بالفعل");
            return;
        }
        try {
            writeVerifier(pin);
            sessionUnlocked = true;
            call.resolve();
        } catch (GeneralSecurityException error) {
            call.reject("تعذر حفظ رمز التطبيق بأمان", error);
        }
    }

    @PluginMethod
    public void unlock(PluginCall call) {
        String pin = call.getString("pin");
        if (!configured()) {
            call.reject("رمز التطبيق غير مضبوط");
            return;
        }
        long now = System.currentTimeMillis();
        long blockedUntil = preferences().getLong(BLOCKED_UNTIL, 0);
        if (blockedUntil > now) {
            JSObject details = new JSObject();
            details.put("blockedUntil", blockedUntil);
            call.reject("محاولات كثيرة؛ انتظر قليلًا", "APP_LOCK_THROTTLED", null, details);
            return;
        }
        try {
            if (!isValidPin(pin) || !matches(pin)) {
                long nextBlock = recordFailure();
                JSObject details = new JSObject();
                details.put("blockedUntil", nextBlock);
                call.reject("رمز التطبيق غير صحيح", "APP_LOCK_INVALID", null, details);
                return;
            }
            preferences().edit().putInt(FAILURES, 0).remove(BLOCKED_UNTIL).apply();
            sessionUnlocked = true;
            call.resolve();
        } catch (GeneralSecurityException error) {
            call.reject("تعذر التحقق من رمز التطبيق", error);
        }
    }

    @PluginMethod
    public void lock(PluginCall call) {
        lockSession();
        call.resolve();
    }

    @PluginMethod
    public void changePin(PluginCall call) {
        String currentPin = call.getString("currentPin");
        String newPin = call.getString("newPin");
        if (!isValidPin(newPin)) {
            call.reject("يجب أن يتكون الرمز الجديد من 6 أرقام");
            return;
        }
        try {
            if (!configured() || !isValidPin(currentPin) || !matches(currentPin)) {
                call.reject("رمز التطبيق الحالي غير صحيح");
                return;
            }
            writeVerifier(newPin);
            sessionUnlocked = true;
            call.resolve();
        } catch (GeneralSecurityException error) {
            call.reject("تعذر تغيير رمز التطبيق", error);
        }
    }

    /** Recovery clears native lock state only after native code clears persisted web sessions. */
    @PluginMethod
    public void resetAfterSignOut(PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            // Native clearing prevents this recovery method from becoming an app-lock bypass:
            // even a direct plugin call removes the persisted web session before the gate resets.
            WebStorage.getInstance().deleteAllData();
            CookieManager cookies = CookieManager.getInstance();
            cookies.removeAllCookies(null);
            cookies.flush();
            preferences().edit().clear().apply();
            lockSession();
            call.resolve();
        });
    }

    private void writeVerifier(String pin) throws GeneralSecurityException {
        byte[] salt = new byte[16];
        RANDOM.nextBytes(salt);
        String kdf = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? "PBKDF2WithHmacSHA256"
                : "PBKDF2WithHmacSHA1";
        byte[] verifier = derive(pin, salt, kdf);
        boolean stored = preferences()
                .edit()
                .putString(SALT, Base64.encodeToString(salt, Base64.NO_WRAP))
                .putString(VERIFIER, Base64.encodeToString(verifier, Base64.NO_WRAP))
                .putString(KDF, kdf)
                .putInt(FAILURES, 0)
                .remove(BLOCKED_UNTIL)
                .commit();
        if (!stored) throw new GeneralSecurityException("Could not persist app lock");
    }

    private boolean matches(String pin) throws GeneralSecurityException {
        SharedPreferences preferences = preferences();
        String salt = preferences.getString(SALT, "");
        String verifier = preferences.getString(VERIFIER, "");
        String kdf = preferences.getString(KDF, "PBKDF2WithHmacSHA256");
        if (salt == null || verifier == null || salt.isEmpty() || verifier.isEmpty()) return false;
        byte[] expected = Base64.decode(verifier, Base64.NO_WRAP);
        byte[] actual = derive(pin, Base64.decode(salt, Base64.NO_WRAP), kdf);
        return MessageDigest.isEqual(expected, actual);
    }

    private byte[] derive(String pin, byte[] salt, String kdf) throws GeneralSecurityException {
        PBEKeySpec spec = new PBEKeySpec(pin.toCharArray(), salt, ITERATIONS, KEY_BITS);
        try {
            return SecretKeyFactory.getInstance(kdf).generateSecret(spec).getEncoded();
        } finally {
            spec.clearPassword();
        }
    }

    private long recordFailure() {
        SharedPreferences preferences = preferences();
        int failures = preferences.getInt(FAILURES, 0) + 1;
        long blockedUntil = 0;
        if (failures >= 5) {
            int exponent = Math.min(failures - 5, 4);
            long delay = Math.min(5 * 60_000L, 30_000L * (1L << exponent));
            blockedUntil = System.currentTimeMillis() + delay;
        }
        SharedPreferences.Editor editor = preferences.edit().putInt(FAILURES, failures);
        if (blockedUntil > 0) editor.putLong(BLOCKED_UNTIL, blockedUntil);
        editor.apply();
        return blockedUntil;
    }
}
