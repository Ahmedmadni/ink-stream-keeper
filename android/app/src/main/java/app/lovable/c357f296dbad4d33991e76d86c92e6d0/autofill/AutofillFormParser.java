package app.lovable.c357f296dbad4d33991e76d86c92e6d0.autofill;

import android.app.assist.AssistStructure;
import android.text.InputType;
import android.view.View;
import android.view.ViewStructure;
import android.view.autofill.AutofillId;
import android.view.autofill.AutofillValue;

import androidx.annotation.RequiresApi;

import java.util.List;
import java.util.Locale;

@RequiresApi(26)
final class AutofillFormParser {
    static final class ParsedForm {
        final String packageName;
        String webDomain = "";
        AutofillId usernameId;
        AutofillId passwordId;
        String usernameValue = "";
        String passwordValue = "";

        ParsedForm(String packageName) {
            this.packageName = packageName == null ? "" : packageName;
        }

        AutofillId[] ids() {
            if (usernameId != null && passwordId != null) {
                return new AutofillId[]{usernameId, passwordId};
            }
            if (passwordId != null) return new AutofillId[]{passwordId};
            if (usernameId != null) return new AutofillId[]{usernameId};
            return new AutofillId[0];
        }
    }

    ParsedForm parse(AssistStructure structure) {
        String packageName = structure.getActivityComponent() == null
                ? ""
                : structure.getActivityComponent().getPackageName();
        ParsedForm form = new ParsedForm(packageName);
        for (int i = 0; i < structure.getWindowNodeCount(); i++) {
            traverse(structure.getWindowNodeAt(i).getRootViewNode(), form);
        }
        return form;
    }

    private void traverse(AssistStructure.ViewNode node, ParsedForm form) {
        if (node == null) return;
        if (form.webDomain.isEmpty() && node.getWebDomain() != null) {
            form.webDomain = MemoFlowCredential.normalizeDomain(node.getWebDomain());
        }

        if (node.getAutofillId() != null
                && node.getAutofillType() == View.AUTOFILL_TYPE_TEXT
                && node.getVisibility() == View.VISIBLE) {
            FieldType type = classify(node);
            if (type == FieldType.PASSWORD && form.passwordId == null) {
                form.passwordId = node.getAutofillId();
                form.passwordValue = value(node);
            } else if (type == FieldType.USERNAME && form.usernameId == null) {
                form.usernameId = node.getAutofillId();
                form.usernameValue = value(node);
            }
        }

        for (int i = 0; i < node.getChildCount(); i++) traverse(node.getChildAt(i), form);
    }

    private FieldType classify(AssistStructure.ViewNode node) {
        StringBuilder clues = new StringBuilder();
        append(clues, node.getHint());
        append(clues, node.getIdEntry());
        append(clues, node.getClassName());
        String[] autofillHints = node.getAutofillHints();
        if (autofillHints != null) for (String hint : autofillHints) append(clues, hint);
        ViewStructure.HtmlInfo html = node.getHtmlInfo();
        if (html != null) {
            List<android.util.Pair<String, String>> attributes = html.getAttributes();
            if (attributes != null) {
                for (android.util.Pair<String, String> attribute : attributes) {
                    append(clues, attribute.first);
                    append(clues, attribute.second);
                }
            }
        }

        String text = clues.toString().toLowerCase(Locale.ROOT);
        int variation = node.getInputType() & InputType.TYPE_MASK_VARIATION;
        boolean passwordVariation = variation == InputType.TYPE_TEXT_VARIATION_PASSWORD
                || variation == InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
                || variation == InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD;
        if (passwordVariation
                || containsAny(text, "password", "passwd", "passcode", "new-password", "كلمة المرور")) {
            return FieldType.PASSWORD;
        }
        if (containsAny(text, "username", "user-name", "email", "e-mail", "login", "account", "اسم المستخدم", "البريد")) {
            return FieldType.USERNAME;
        }
        int inputClass = node.getInputType() & InputType.TYPE_MASK_CLASS;
        if (inputClass == InputType.TYPE_CLASS_TEXT) {
            int textVariation = node.getInputType() & InputType.TYPE_MASK_VARIATION;
            if (textVariation == InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
                    || textVariation == InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS) {
                return FieldType.USERNAME;
            }
        }
        return FieldType.UNKNOWN;
    }

    private static String value(AssistStructure.ViewNode node) {
        AutofillValue autofillValue = node.getAutofillValue();
        if (autofillValue != null && autofillValue.isText() && autofillValue.getTextValue() != null) {
            return autofillValue.getTextValue().toString().trim();
        }
        return node.getText() == null ? "" : node.getText().toString().trim();
    }

    private static void append(StringBuilder output, CharSequence value) {
        if (value != null) output.append(' ').append(value);
    }

    private static boolean containsAny(String value, String... needles) {
        for (String needle : needles) if (value.contains(needle)) return true;
        return false;
    }

    private enum FieldType { USERNAME, PASSWORD, UNKNOWN }
}
