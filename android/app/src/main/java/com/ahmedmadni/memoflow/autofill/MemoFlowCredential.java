package com.ahmedmadni.memoflow.autofill;

import org.json.JSONException;
import org.json.JSONObject;

import java.net.URI;
import java.util.Locale;

final class MemoFlowCredential {
    final String id;
    final String label;
    final String username;
    final String password;
    final String url;
    final String webDomain;
    final String packageName;
    final boolean pendingImport;
    final long updatedAt;

    MemoFlowCredential(
            String id,
            String label,
            String username,
            String password,
            String url,
            String webDomain,
            String packageName,
            boolean pendingImport,
            long updatedAt) {
        this.id = clean(id, 160);
        this.label = clean(label, 160);
        this.username = clean(username, 512);
        this.password = clean(password, 4096);
        this.url = clean(url, 2048);
        this.webDomain = normalizeDomain(webDomain.isEmpty() ? url : webDomain);
        this.packageName = clean(packageName, 300).toLowerCase(Locale.ROOT);
        this.pendingImport = pendingImport;
        this.updatedAt = updatedAt;
    }

    static MemoFlowCredential fromJson(JSONObject value) throws JSONException {
        return new MemoFlowCredential(
                value.optString("id"),
                value.optString("label"),
                value.optString("username"),
                value.optString("password"),
                value.optString("url"),
                value.optString("webDomain"),
                value.optString("packageName"),
                value.optBoolean("pendingImport", false),
                value.optLong("updatedAt", 0L));
    }

    JSONObject toJson() throws JSONException {
        JSONObject value = new JSONObject();
        value.put("id", id);
        value.put("label", label);
        value.put("username", username);
        value.put("password", password);
        value.put("url", url);
        value.put("webDomain", webDomain);
        value.put("packageName", packageName);
        value.put("pendingImport", pendingImport);
        value.put("updatedAt", updatedAt);
        return value;
    }

    boolean matches(String targetPackage, String targetDomain) {
        String domain = normalizeDomain(targetDomain);
        if (!domain.isEmpty()) return domain.equals(webDomain);
        String packageValue = clean(targetPackage, 300).toLowerCase(Locale.ROOT);
        return !packageValue.isEmpty() && packageValue.equals(packageName);
    }

    boolean sameAccount(MemoFlowCredential other) {
        if (!username.equalsIgnoreCase(other.username)) return false;
        if (!webDomain.isEmpty() || !other.webDomain.isEmpty()) {
            return !webDomain.isEmpty() && webDomain.equals(other.webDomain);
        }
        return !packageName.isEmpty() && packageName.equals(other.packageName);
    }

    String presentationLabel() {
        if (!label.isEmpty() && !username.isEmpty()) return label + " • " + username;
        if (!label.isEmpty()) return label;
        if (!username.isEmpty()) return username;
        if (!webDomain.isEmpty()) return webDomain;
        return packageName;
    }

    private static String clean(String value, int maxLength) {
        if (value == null) return "";
        String cleaned = value.trim();
        return cleaned.length() <= maxLength ? cleaned : cleaned.substring(0, maxLength);
    }

    static String normalizeDomain(String value) {
        String input = clean(value, 2048).toLowerCase(Locale.ROOT);
        if (input.isEmpty()) return "";
        try {
            URI uri = URI.create(input.contains("://") ? input : "https://" + input);
            String host = uri.getHost();
            if (host == null) return "";
            host = host.toLowerCase(Locale.ROOT);
            return host.startsWith("www.") ? host.substring(4) : host;
        } catch (RuntimeException ignored) {
            return "";
        }
    }
}
