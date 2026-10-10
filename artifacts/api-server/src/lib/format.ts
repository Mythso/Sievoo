/**
 * Money formatting shared by server-rendered text (auto-published analysis
 * notes, SEO pages, share images, alert emails). Kept deliberately simple
 * and locale-independent so output is identical everywhere.
 */
const SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
};

const SUFFIX_CURRENCIES = new Set(["NOK", "SEK", "DKK", "ISK"]);

export function formatMoney(value: number | null | undefined, currency?: string | null, decimals = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const code = (currency || "USD").toUpperCase();
  const abs = Math.abs(value);
  const digits = abs >= 1000 ? 0 : decimals;
  const num = abs.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const sign = value < 0 ? "-" : "";
  if (SYMBOLS[code]) return `${sign}${SYMBOLS[code]}${num}`;
  if (SUFFIX_CURRENCIES.has(code)) return `${sign}${num} kr`;
  return `${sign}${num} ${code}`;
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}
