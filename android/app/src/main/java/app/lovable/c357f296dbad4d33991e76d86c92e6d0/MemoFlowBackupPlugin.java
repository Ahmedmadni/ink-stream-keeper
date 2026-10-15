package app.lovable.c357f296dbad4d33991e76d86c92e6d0;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Stores the automatic-backup password in Android Keystore and writes rolling local/SAF copies. */
@CapacitorPlugin(name = "MemoFlowBackup")
public final class MemoFlowBackupPlugin extends Plugin {
    private static final String PREFS = "memoflow_backup_native_v1";
    private static final String SECRET = "encrypted_password";
    private static final String ACCOUNT_ID = "account_id";
    private static final String ENABLED = "enabled";
    private static final String TREE_URI = "tree_uri";
    private static final String TREE_NAME = "tree_name";
    private static final String LAST_BACKUP_AT = "last_backup_at";
    private static final String LAST_DRIVE_AT = "last_drive_at";
    private static final String KEY_ALIAS = "memoflow_backup_password_aes_v1";
    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private static final String CIPHER = "AES/GCM/NoPadding";
    private static final int MAX_BACKUP_BYTES = 75 * 1024 * 1024;
    private static final int MAX_ROLLING_FILES = 7;

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private boolean configured() {
        String secret = preferences().getString(SECRET, "");
        return secret != null && !secret.isEmpty();
    }

    private boolean configuredFor(String accountId) {
        return configured()
                && accountId != null
                && accountId.equals(preferences().getString(ACCOUNT_ID, ""));
    }

    private boolean requireUnlocked(PluginCall call) {
        if (MemoFlowAppLockPlugin.isSessionUnlocked()) return true;
        call.reject("افتح قفل MemoFlow أولًا", "APP_LOCKED");
        return false;
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        SharedPreferences preferences = preferences();
        String accountId = call.getString("accountId", "");
        boolean configured = configuredFor(accountId);
        JSObject result = new JSObject();
        result.put("configured", configured);
        result.put("enabled", configured && preferences.getBoolean(ENABLED, true));
        String treeUri = configured ? preferences.getString(TREE_URI, "") : "";
        result.put("driveFolderSelected", treeUri != null && !treeUri.isEmpty());
        result.put("driveFolderName", configured ? preferences.getString(TREE_NAME, "") : "");
        result.put("lastBackupAt", configured ? preferences.getLong(LAST_BACKUP_AT, 0) : 0);
        result.put("lastDriveAt", configured ? preferences.getLong(LAST_DRIVE_AT, 0) : 0);
        call.resolve(result);
    }

    @PluginMethod
    public void configure(PluginCall call) {
        if (!requireUnlocked(call)) return;
        String password = call.getString("password", "");
        String accountId = call.getString("accountId", "");
        if (accountId.isEmpty()) {
            call.reject("تعذر ربط النسخة بالحساب الحالي");
            return;
        }
        if (password.length() < 12 || password.length() > 256) {
            call.reject("كلمة مرور النسخة يجب أن تكون بين 12 و256 حرفًا");
            return;
        }
        try {
            String previousAccount = preferences().getString(ACCOUNT_ID, "");
            if (previousAccount != null && !previousAccount.isEmpty() && !previousAccount.equals(accountId)) {
                clearConfigurationInternal();
            }
            String encrypted = encrypt(password);
            boolean saved = preferences()
                    .edit()
                    .putString(SECRET, encrypted)
                    .putString(ACCOUNT_ID, accountId)
                    .putBoolean(ENABLED, true)
                    .commit();
            if (!saved) throw new GeneralSecurityException("Could not persist backup configuration");
            call.resolve();
        } catch (Exception error) {
            call.reject("تعذر حفظ إعداد النسخ التلقائي بأمان", error);
        }
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        if (!requireUnlocked(call)) return;
        Boolean enabled = call.getBoolean("enabled");
        String accountId = call.getString("accountId", "");
        if (enabled == null || !configuredFor(accountId)) {
            call.reject("أكمل إعداد كلمة مرور النسخة أولًا");
            return;
        }
        preferences().edit().putBoolean(ENABLED, enabled).apply();
        call.resolve();
    }

    @PluginMethod
    public void getPassword(PluginCall call) {
        if (!requireUnlocked(call)) return;
        String accountId = call.getString("accountId", "");
        if (!configuredFor(accountId)) {
            call.reject("النسخ التلقائي غير مضبوط");
            return;
        }
        try {
            JSObject result = new JSObject();
            result.put("password", decrypt(preferences().getString(SECRET, "")));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("تعذر فتح إعداد النسخ التلقائي", error);
        }
    }

    @PluginMethod
    public void chooseDriveFolder(PluginCall call) {
        if (!requireUnlocked(call)) return;
        if (!configuredFor(call.getString("accountId", ""))) {
            call.reject("أكمل إعداد النسخ التلقائي لهذا الحساب أولًا");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, intent, "driveFolderResult");
    }

    @ActivityCallback
    private void driveFolderResult(PluginCall call, ActivityResult activityResult) {
        Intent data = activityResult.getData();
        if (activityResult.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.reject("لم يتم اختيار مجلد", "PICKER_CANCELLED");
            return;
        }
        Uri uri = data.getData();
        int flags = data.getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        try {
            getContext().getContentResolver().takePersistableUriPermission(uri, flags);
            String name = documentName(uri);
            preferences().edit().putString(TREE_URI, uri.toString()).putString(TREE_NAME, name).apply();
            JSObject result = new JSObject();
            result.put("name", name);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("تعذر الاحتفاظ بصلاحية مجلد Google Drive", error);
        }
    }

    @PluginMethod
    public void saveBackup(PluginCall call) {
        if (!requireUnlocked(call)) return;
        if (!configuredFor(call.getString("accountId", ""))) {
            call.reject("إعداد النسخ لا يخص الحساب الحالي");
            return;
        }
        String contents = call.getString("contents");
        String filename = safeBackupName(call.getString("filename", "MemoFlow-auto.memoflow"));
        if (contents == null) {
            call.reject("ملف النسخة مفقود");
            return;
        }
        byte[] bytes = contents.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_BACKUP_BYTES) {
            call.reject("حجم النسخة يتجاوز الحد المدعوم");
            return;
        }
        getBridge().execute(() -> {
            try {
                Uri localUri = writeLocal(filename, bytes);
                String driveUri = "";
                String driveError = "";
                try {
                    driveUri = writeDrive(filename, bytes);
                } catch (Exception error) {
                    driveError = "تعذر الحفظ في مجلد Drive؛ حُفظت النسخة المحلية.";
                }
                long now = System.currentTimeMillis();
                SharedPreferences.Editor editor = preferences().edit().putLong(LAST_BACKUP_AT, now);
                if (!driveUri.isEmpty()) editor.putLong(LAST_DRIVE_AT, now);
                editor.apply();
                JSObject result = new JSObject();
                result.put("localUri", localUri.toString());
                result.put("driveSaved", !driveUri.isEmpty());
                result.put("driveUri", driveUri);
                result.put("driveError", driveError);
                result.put("savedAt", now);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("تعذر حفظ النسخة على الهاتف", error);
            } finally {
                java.util.Arrays.fill(bytes, (byte) 0);
            }
        });
    }

    @PluginMethod
    public void clearConfiguration(PluginCall call) {
        clearConfigurationInternal();
        call.resolve();
    }

    private void clearConfigurationInternal() {
        String rawUri = preferences().getString(TREE_URI, "");
        if (rawUri != null && !rawUri.isEmpty()) {
            try {
                getContext().getContentResolver().releasePersistableUriPermission(
                        Uri.parse(rawUri),
                        Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            } catch (Exception ignored) {
                // The provider may already have revoked the grant.
            }
        }
        preferences().edit().clear().apply();
    }

    static String safeBackupName(String value) {
        String leaf = value == null ? "" : value.replace('\\', '/');
        int slash = leaf.lastIndexOf('/');
        if (slash >= 0) leaf = leaf.substring(slash + 1);
        leaf = leaf.replaceAll("[\\p{Cntrl}<>:\"|?*]", "-")
                .replaceAll("^\\.+", "")
                .trim();
        if (leaf.length() > 160) leaf = leaf.substring(0, 160);
        if (leaf.isEmpty()) leaf = "MemoFlow-auto.memoflow";
        if (!leaf.endsWith(".memoflow")) leaf += ".memoflow";
        return leaf;
    }

    private String documentName(Uri uri) {
        try (Cursor cursor = getContext().getContentResolver().query(
                uri,
                new String[] { DocumentsContract.Document.COLUMN_DISPLAY_NAME },
                null,
                null,
                null)) {
            if (cursor != null && cursor.moveToFirst()) {
                String name = cursor.getString(0);
                if (name != null && !name.isEmpty()) return name;
            }
        }
        return "Google Drive";
    }

    private Uri writeLocal(String filename, byte[] bytes) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentResolver resolver = getContext().getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
            values.put(MediaStore.MediaColumns.MIME_TYPE, "application/octet-stream");
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOCUMENTS + "/MemoFlow");
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);
            Uri collection = MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
            Uri item = resolver.insert(collection, values);
            if (item == null) throw new java.io.IOException("Could not create local backup");
            try (OutputStream stream = resolver.openOutputStream(item, "w")) {
                if (stream == null) throw new java.io.IOException("Could not open local backup");
                stream.write(bytes);
            } catch (Exception error) {
                resolver.delete(item, null, null);
                throw error;
            }
            ContentValues complete = new ContentValues();
            complete.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(item, complete, null, null);
            pruneMediaStore(collection);
            return item;
        }

        File root = getContext().getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS);
        if (root == null) throw new java.io.IOException("Documents directory unavailable");
        File folder = new File(root, "MemoFlow");
        if (!folder.exists() && !folder.mkdirs()) throw new java.io.IOException("Could not create backup folder");
        File target = new File(folder, filename);
        try (FileOutputStream stream = new FileOutputStream(target)) {
            stream.write(bytes);
        }
        pruneFiles(folder);
        return Uri.fromFile(target);
    }

    private void pruneMediaStore(Uri collection) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return;
        List<StoredDocument> files = new ArrayList<>();
        String selection = MediaStore.MediaColumns.RELATIVE_PATH + "=? AND "
                + MediaStore.MediaColumns.DISPLAY_NAME + " LIKE ?";
        String[] args = { Environment.DIRECTORY_DOCUMENTS + "/MemoFlow/", "MemoFlow-auto-%" };
        try (Cursor cursor = getContext().getContentResolver().query(
                collection,
                new String[] {
                        MediaStore.MediaColumns._ID,
                        MediaStore.MediaColumns.DATE_MODIFIED,
                        MediaStore.MediaColumns.DISPLAY_NAME },
                selection,
                args,
                MediaStore.MediaColumns.DATE_MODIFIED + " DESC")) {
            if (cursor == null) return;
            int idColumn = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID);
            int modifiedColumn = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_MODIFIED);
            int nameColumn = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME);
            while (cursor.moveToNext()) {
                String name = cursor.getString(nameColumn);
                if (name != null && name.endsWith(".memoflow")) {
                    files.add(new StoredDocument(
                            Uri.withAppendedPath(collection, String.valueOf(cursor.getLong(idColumn))),
                            cursor.getLong(modifiedColumn)));
                }
            }
        } catch (Exception ignored) {
            return;
        }
        files.sort(Comparator.comparingLong((StoredDocument document) -> document.modified).reversed());
        for (int index = MAX_ROLLING_FILES; index < files.size(); index++) {
            try {
                getContext().getContentResolver().delete(files.get(index).uri, null, null);
            } catch (Exception ignored) {
                // Retention cleanup must never invalidate the newly written copy.
            }
        }
    }

    private void pruneFiles(File folder) {
        File[] values = folder.listFiles((dir, name) -> name.startsWith("MemoFlow-auto-") && name.endsWith(".memoflow"));
        if (values == null || values.length <= MAX_ROLLING_FILES) return;
        java.util.Arrays.sort(values, Comparator.comparingLong(File::lastModified).reversed());
        for (int index = MAX_ROLLING_FILES; index < values.length; index++) values[index].delete();
    }

    private String writeDrive(String filename, byte[] bytes) throws Exception {
        String rawTree = preferences().getString(TREE_URI, "");
        if (rawTree == null || rawTree.isEmpty()) return "";
        Uri tree = Uri.parse(rawTree);
        ContentResolver resolver = getContext().getContentResolver();
        Uri parent = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
        Uri target = DocumentsContract.createDocument(resolver, parent, "application/octet-stream", filename);
        if (target == null) throw new java.io.IOException("Could not create Drive backup");
        try (OutputStream stream = resolver.openOutputStream(target, "w")) {
            if (stream == null) throw new java.io.IOException("Could not open Drive backup");
            stream.write(bytes);
        } catch (Exception error) {
            try {
                DocumentsContract.deleteDocument(resolver, target);
            } catch (Exception ignored) {}
            throw error;
        }
        pruneDrive(tree, target);
        return target.toString();
    }

    private void pruneDrive(Uri tree, Uri keep) {
        ContentResolver resolver = getContext().getContentResolver();
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
        List<StoredDocument> files = new ArrayList<>();
        try (Cursor cursor = resolver.query(
                children,
                new String[] {
                        DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                        DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                        DocumentsContract.Document.COLUMN_LAST_MODIFIED },
                null,
                null,
                null)) {
            if (cursor == null) return;
            while (cursor.moveToNext()) {
                String id = cursor.getString(0);
                String name = cursor.getString(1);
                long modified = cursor.isNull(2) ? 0 : cursor.getLong(2);
                if (name != null && name.startsWith("MemoFlow-auto-") && name.endsWith(".memoflow")) {
                    Uri documentUri = DocumentsContract.buildDocumentUriUsingTree(tree, id);
                    files.add(new StoredDocument(documentUri, documentUri.equals(keep) ? Long.MAX_VALUE : modified));
                }
            }
        } catch (Exception ignored) {
            return;
        }
        files.sort(Comparator.comparingLong((StoredDocument document) -> document.modified).reversed());
        int retained = 0;
        for (StoredDocument document : files) {
            if (document.uri.equals(keep) || retained < MAX_ROLLING_FILES) {
                retained++;
                continue;
            }
            try {
                DocumentsContract.deleteDocument(resolver, document.uri);
            } catch (Exception ignored) {}
        }
    }

    private String encrypt(String password) throws Exception {
        Cipher cipher = Cipher.getInstance(CIPHER);
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
        byte[] ciphertext = cipher.doFinal(password.getBytes(StandardCharsets.UTF_8));
        JSONObject envelope = new JSONObject();
        envelope.put("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP));
        envelope.put("ciphertext", Base64.encodeToString(ciphertext, Base64.NO_WRAP));
        return envelope.toString();
    }

    private String decrypt(String encoded) throws Exception {
        JSONObject envelope = new JSONObject(encoded);
        byte[] iv = Base64.decode(envelope.getString("iv"), Base64.NO_WRAP);
        byte[] ciphertext = Base64.decode(envelope.getString("ciphertext"), Base64.NO_WRAP);
        Cipher cipher = Cipher.getInstance(CIPHER);
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, iv));
        byte[] plaintext = cipher.doFinal(ciphertext);
        try {
            return new String(plaintext, StandardCharsets.UTF_8);
        } finally {
            java.util.Arrays.fill(plaintext, (byte) 0);
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

    private static final class StoredDocument {
        final Uri uri;
        final long modified;

        StoredDocument(Uri uri, long modified) {
            this.uri = uri;
            this.modified = modified;
        }
    }
}
