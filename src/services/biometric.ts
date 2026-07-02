/**
 * Biometric service — stub. Real Web impl via WebAuthn; Capacitor uses
 * @capacitor-community/biometric-auth.
 */
export interface BiometricService {
  isAvailable(): Promise<boolean>;
  authenticate(reason?: string): Promise<boolean>;
}

export const biometric: BiometricService = {
  async isAvailable() {
    if (typeof window === "undefined") return false;
    const pk = (window as unknown as { PublicKeyCredential?: unknown }).PublicKeyCredential;
    return typeof pk !== "undefined";
  },
  async authenticate() {
    return false;
  },
};