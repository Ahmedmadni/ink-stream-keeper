package com.ahmedmadni.memoflow;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class MemoFlowAuthPluginTest {
    @Test
    public void acceptsOnlyTheMemoFlowOAuthEndpoint() {
        assertTrue(MemoFlowAuthPlugin.isAllowedOAuthUrl(
                "https://ink-stream-keeper.lovable.app/~oauth/initiate?provider=google&state=abc"));
        assertFalse(MemoFlowAuthPlugin.isAllowedOAuthUrl(
                "https://evil.example/~oauth/initiate?provider=google&state=abc"));
        assertFalse(MemoFlowAuthPlugin.isAllowedOAuthUrl(
                "http://ink-stream-keeper.lovable.app/~oauth/initiate?provider=google&state=abc"));
        assertFalse(MemoFlowAuthPlugin.isAllowedOAuthUrl(
                "https://ink-stream-keeper.lovable.app/other?provider=google&state=abc"));
    }

    @Test
    public void acceptsOnlyTheExactMemoFlowCallback() {
        assertTrue(MemoFlowAuthPlugin.isAuthCallback(
                "lovable://oauth-callback?state=abc"));
        assertTrue(MemoFlowAuthPlugin.isAuthCallback(
                "app.lovable.c357f296dbad4d33991e76d86c92e6d0://auth/callback?state=abc"));
        assertTrue(MemoFlowAuthPlugin.isAuthCallback(
                "app.lovable.c357f296dbad4d33991e76d86c92e6d0://auth/recovery#type=recovery"));
        assertFalse(MemoFlowAuthPlugin.isAuthCallback(
                "app.lovable.c357f296dbad4d33991e76d86c92e6d0://evil/callback?state=abc"));
        assertFalse(MemoFlowAuthPlugin.isAuthCallback(
                "lovable://other?state=abc"));
        assertFalse(MemoFlowAuthPlugin.isAuthCallback(
                "https://auth/callback?state=abc"));
    }
}
