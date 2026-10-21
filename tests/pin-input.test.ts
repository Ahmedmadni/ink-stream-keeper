import { expect, test } from "bun:test";
import { normalizePinInput } from "../src/lib/pin-input";

test("accepts keyboard and pasted Arabic, Persian and Latin PIN digits", () => {
  expect(normalizePinInput("١٢٣٤٥٦")).toBe("123456");
  expect(normalizePinInput("۶۵۴۳۲۱")).toBe("654321");
  expect(normalizePinInput(" 12-٣ ۴a56\n789")).toBe("123456");
  expect(normalizePinInput("12")).toBe("12");
  expect(normalizePinInput("abc")).toBe("");
});
