export type Dialect = "auto" | "sa" | "eg";
const KEY = "mf.speech.dialect";

export const DIALECTS: { value: Dialect; label: string }[] = [
  { value: "auto", label: "تلقائي (سعودي + مصري + فصحى)" },
  { value: "sa", label: "اللهجة السعودية" },
  { value: "eg", label: "اللهجة المصرية" },
];

export function getDialect(): Dialect {
  if (typeof localStorage === "undefined") return "auto";
  const v = localStorage.getItem(KEY);
  return v === "sa" || v === "eg" ? v : "auto";
}

export function setDialect(d: Dialect) {
  localStorage.setItem(KEY, d);
}
