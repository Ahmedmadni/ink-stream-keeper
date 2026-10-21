/** Normalize physical keyboards and pasted Arabic/Persian numerals without storing the PIN. */
export function normalizePinInput(value: string, max = 6): string {
  return value
    .replace(/[٠-٩۰-۹]/g, (digit) => String(digit.charCodeAt(0) - (digit >= "۰" ? 0x6f0 : 0x660)))
    .replace(/\D/g, "")
    .slice(0, max);
}
