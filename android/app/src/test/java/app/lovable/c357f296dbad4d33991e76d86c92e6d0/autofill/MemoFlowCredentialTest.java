package app.lovable.c357f296dbad4d33991e76d86c92e6d0.autofill;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class MemoFlowCredentialTest {
    private MemoFlowCredential credential(
            String id, String username, String url, String domain, String packageName) {
        return new MemoFlowCredential(
                id,
                "حساب العمل",
                username,
                "secret",
                url,
                domain,
                packageName,
                false,
                1L);
    }

    @Test
    public void normalizesUrlHostWithoutExpandingToOtherSubdomains() {
        MemoFlowCredential value = credential(
                "1", "name@example.com", "https://www.example.com/login", "", "");

        assertEquals("example.com", value.webDomain);
        assertTrue(value.matches("com.android.chrome", "example.com"));
        assertFalse(value.matches("com.android.chrome", "evil.example.com"));
        assertFalse(value.matches("com.android.chrome", "example.net"));
    }

    @Test
    public void matchesNativeApplicationsOnlyByExactPackage() {
        MemoFlowCredential value = credential("1", "ahmed", "", "", "com.example.bank");

        assertTrue(value.matches("com.example.bank", ""));
        assertFalse(value.matches("com.example.bank.preview", ""));
    }

    @Test
    public void identifiesTheSameAccountCaseInsensitively() {
        MemoFlowCredential first = credential(
                "1", "Name@Example.com", "https://example.com", "", "");
        MemoFlowCredential second = credential(
                "2", "name@example.com", "", "example.com", "com.android.chrome");

        assertTrue(first.sameAccount(second));
    }
}
