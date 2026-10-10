/**
 * Money and percentage formatting for the UI. Mirrors the server's
 * lib/format.ts so share images, emails and pages show the same strings.
 * A null currency means "unknown" and is shown as USD (the historical
 * default for analyses published before currencies were tracked).
 */
const SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', JPY: '¥' };
const SUFFIX_CURRENCIES = new Set(['NOK', 'SEK', 'DKK', 'ISK']);

export function formatMoney(value: number | null | undefined, currency?: string | null, decimals = 2): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const code = (currency || 'USD').toUpperCase();
  const abs = Math.abs(value);
  const digits = abs >= 1000 ? 0 : decimals;
  const num = abs.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const sign = value < 0 ? '-' : '';
  if (SYMBOLS[code]) return `${sign}${SYMBOLS[code]}${num}`;
  if (SUFFIX_CURRENCIES.has(code)) return `${sign}${num} kr`;
  return `${sign}${num} ${code}`;
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

/** Tailwind text colour for a margin of safety (same bands as the cards). */
export function mosClass(value: number | null | undefined): string {
  if (value == null) return 'text-muted-foreground';
  if (value > 15) return 'text-accent';
  if (value < 0) return 'text-destructive';
  return 'text-primary';
}
