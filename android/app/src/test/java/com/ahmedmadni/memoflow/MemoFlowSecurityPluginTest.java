package com.ahmedmadni.memoflow;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class MemoFlowSecurityPluginTest {
    @Test
    public void backgroundLockRejectsAnOlderPendingUnlock() {
        MemoFlowAppLockPlugin.lockSession();
        long pending = MemoFlowAppLockPlugin.captureSessionEpoch();
        MemoFlowAppLockPlugin.lockSession();
        assertFalse(MemoFlowAppLockPlugin.finishUnlock(pending));
        assertFalse(MemoFlowAppLockPlugin.isSessionUnlocked());
        assertTrue(MemoFlowAppLockPlugin.finishUnlock(MemoFlowAppLockPlugin.captureSessionEpoch()));
        assertTrue(MemoFlowAppLockPlugin.isSessionUnlocked());
        MemoFlowAppLockPlugin.lockSession();
    }
    @Test
    public void appPinRequiresExactlySixDigits() {
        assertTrue(MemoFlowAppLockPlugin.isValidPin("123456"));
        assertFalse(MemoFlowAppLockPlugin.isValidPin("12345"));
        assertFalse(MemoFlowAppLockPlugin.isValidPin("1234567"));
        assertFalse(MemoFlowAppLockPlugin.isValidPin("abcdef"));
    }

    @Test
    public void backupNamesCannotEscapeTheirFolder() {
        assertEquals("secret.memoflow", MemoFlowBackupPlugin.safeBackupName("../../secret.memoflow"));
        assertEquals("MemoFlow-auto.memoflow", MemoFlowBackupPlugin.safeBackupName("..."));
        assertEquals("backup.memoflow", MemoFlowBackupPlugin.safeBackupName("backup"));
    }
}
