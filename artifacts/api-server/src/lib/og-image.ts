import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { formatMoney, formatPercent } from "./format";

/**
 * Dynamic share images (Open Graph / Twitter cards), 1200x630 PNG.
 * Built as SVG and rasterised with resvg using the bundled JetBrains Mono
 * font (assets/fonts, SIL Open Font License), so the output looks the same
 * on every machine and doesn't depend on system fonts.
 */

const require = createRequire(import.meta.url);
type ResvgCtor = new (svg: string, opts: unknown) => { render(): { asPng(): Buffer } };
let Resvg: ResvgCtor | null = null;
function getResvg(): ResvgCtor {
  if (!Resvg) Resvg = (require("@resvg/resvg-js") as { Resvg: ResvgCtor }).Resvg;
  return Resvg;
}

function findFontDir(): string {
  const candidates = [
    path.resolve(typeof __dirname !== "undefined" ? __dirname : process.cwd(), "..", "assets", "fonts"),
    path.resolve(process.cwd(), "assets", "fonts"),
    path.resolve(process.cwd(), "artifacts", "api-server", "assets", "fonts"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "JetBrainsMonoNL-Regular.ttf"))) return dir;
  }
  throw new Error("Share-image fonts not found (expected artifacts/api-server/assets/fonts)");
}

let fontFiles: string[] | null = null;
function getFontFiles(): string[] {
  if (!fontFiles) {
    const dir = findFontDir();
    fontFiles = ["JetBrainsMonoNL-Regular.ttf", "JetBrainsMonoNL-Bold.ttf"].map((f) => path.join(dir, f));
  }
  return fontFiles;
}

const C = {
  bg: "#0b0f19",
  card: "#1e293b",
  border: "#334155",
  gold: "#f59e0b",
  emerald: "#10b981",
  rose: "#f43f5e",
  text: "#f8fafc",
  muted: "#94a3b8",
};

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Truncate to fit `maxWidth` px at `size` (monospace: ~0.6em per char). */
function fit(text: string, size: number, maxWidth: number): string {
  const maxChars = Math.floor(maxWidth / (size * 0.6));
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(1, maxChars - 1))}…`;
}

function mosColor(mos: number | null | undefined): string {
  if (mos == null) return C.muted;
  if (mos > 15) return C.emerald;
  if (mos < 0) return C.rose;
  return C.gold;
}

function frame(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="${C.bg}"/>
<rect x="0" y="0" width="1200" height="6" fill="${C.gold}"/>
<text x="64" y="84" font-size="34" font-weight="700" fill="${C.gold}">Sievoo</text>
<text x="1136" y="84" font-size="24" fill="${C.muted}" text-anchor="end">sievoo.com</text>
${inner}
<text x="64" y="590" font-size="22" fill="${C.muted}">No narratives, only math · Not investment advice</text>
</svg>`;
}

function statBox(x: number, w: number, label: string, value: string, color: string): string {
  return `<rect x="${x}" y="330" width="${w}" height="130" rx="16" fill="${C.card}" stroke="${C.border}" stroke-width="2"/>
<text x="${x + 28}" y="376" font-size="22" fill="${C.muted}">${esc(label)}</text>
<text x="${x + 28}" y="432" font-size="44" font-weight="700" fill="${color}">${esc(fit(value, 44, w - 56))}</text>`;
}

function pill(x: number, y: number, label: string, color: string): string {
  const w = Math.round(label.length * 26 * 0.6 + 48);
  return `<rect x="${x}" y="${y}" width="${w}" height="54" rx="27" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="2"/>
<text x="${x + w / 2}" y="${y + 36}" font-size="26" font-weight="700" fill="${color}" text-anchor="middle">${esc(label)}</text>`;
}

function render(svg: string): Buffer {
  const R = getResvg();
  const resvg = new R(svg, {
    font: { fontFiles: getFontFiles(), loadSystemFonts: false, defaultFontFamily: "JetBrains Mono NL" },
    fitTo: { mode: "width", value: 1200 },
  });
  return resvg.render().asPng();
}

export function renderStockImage(s: {
  ticker: string;
  companyName: string | null;
  currency: string | null;
  price: number | null;
  baseDcf: number | null;
  grahamNumber: number | null;
  marginOfSafety: number | null;
  computedAt: string | null;
}): Buffer {
  const inner = `
<text x="64" y="200" font-size="96" font-weight="700" fill="${C.text}">${esc(fit(s.ticker, 96, 1072))}</text>
<text x="64" y="256" font-size="30" fill="${C.muted}">${esc(fit(s.companyName ?? "Intrinsic value estimate", 30, 1072))}</text>
${statBox(64, 340, "Price", formatMoney(s.price, s.currency), C.text)}
${statBox(430, 340, "DCF value (base)", formatMoney(s.baseDcf, s.currency), C.emerald)}
${statBox(796, 340, "Graham Number", formatMoney(s.grahamNumber, s.currency), C.gold)}
${pill(64, 488, `Margin of safety ${formatPercent(s.marginOfSafety)}`, mosColor(s.marginOfSafety))}
${s.computedAt ? `<text x="1136" y="524" font-size="22" fill="${C.muted}" text-anchor="end">Updated ${esc(s.computedAt.slice(0, 10))}</text>` : ""}`;
  return render(frame(inner));
}

export function renderAnalysisImage(a: {
  ticker: string;
  title: string;
  author: string;
  currency: string | null;
  price: number;
  bear: number;
  base: number;
  bull: number;
  marginOfSafety: number;
}): Buffer {
  const inner = `
<text x="64" y="186" font-size="80" font-weight="700" fill="${C.text}">${esc(fit(a.ticker, 80, 520))}</text>
<text x="1136" y="186" font-size="40" font-weight="700" fill="${C.text}" text-anchor="end">${esc(formatMoney(a.price, a.currency))}</text>
<text x="64" y="244" font-size="30" fill="${C.text}">${esc(fit(a.title, 30, 1072))}</text>
<text x="64" y="290" font-size="24" fill="${C.muted}">${esc(fit(`by ${a.author}`, 24, 1072))}</text>
${statBox(64, 340, "Bear", formatMoney(a.bear, a.currency), C.rose)}
${statBox(430, 340, "Base", formatMoney(a.base, a.currency), C.text)}
${statBox(796, 340, "Bull", formatMoney(a.bull, a.currency), C.emerald)}
${pill(64, 488, `Margin of safety ${formatPercent(a.marginOfSafety)}`, mosColor(a.marginOfSafety))}`;
  return render(frame(inner));
}

export function renderProfileImage(p: {
  name: string;
  analyses: number;
  hitRate: number | null;
  evaluated: number;
  rank: number | null;
}): Buffer {
  const inner = `
<text x="64" y="200" font-size="72" font-weight="700" fill="${C.text}">${esc(fit(p.name, 72, 1072))}</text>
<text x="64" y="256" font-size="30" fill="${C.muted}">Value investor on Sievoo</text>
${statBox(64, 340, "Published analyses", String(p.analyses), C.text)}
${statBox(430, 340, "Hit rate", p.hitRate != null && p.evaluated > 0 ? `${p.hitRate.toFixed(0)}%` : "—", C.emerald)}
${statBox(796, 340, "Leaderboard", p.rank != null ? `#${p.rank}` : "—", C.gold)}
<text x="64" y="530" font-size="24" fill="${C.muted}">${esc(`${p.evaluated} scored call${p.evaluated === 1 ? "" : "s"} · price-checked 30+ days later`)}</text>`;
  return render(frame(inner));
}

export function renderGenericImage(title: string, subtitle: string): Buffer {
  const inner = `
<text x="64" y="260" font-size="64" font-weight="700" fill="${C.text}">${esc(fit(title, 64, 1072))}</text>
<text x="64" y="330" font-size="30" fill="${C.muted}">${esc(fit(subtitle, 30, 1072))}</text>`;
  return render(frame(inner));
}
