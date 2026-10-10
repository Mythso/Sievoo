import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "./logger";

/**
 * Outgoing email (ticker alerts + weekly digest). Configured entirely from
 * environment variables, so it stays off until a mailbox is set up:
 *
 *   SMTP_URL   e.g. smtps://alerts%40example.com:app-password@smtp.gmail.com:465
 *   MAIL_FROM  e.g. "Sievoo <alerts@example.com>" (defaults to the SMTP user)
 *
 * When SMTP_URL is missing, sending is skipped with a log line - alerts
 * still show up on the user's Account page.
 */
let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const url = process.env.SMTP_URL;
  transporter = url ? nodemailer.createTransport(url) : null;
  return transporter;
}

export function isMailConfigured(): boolean {
  return !!process.env.SMTP_URL;
}

export function siteUrl(): string {
  return (process.env.SITE_URL || "https://sievoo.com").replace(/\/+$/, "");
}

function defaultFrom(): string {
  if (process.env.MAIL_FROM) return process.env.MAIL_FROM;
  try {
    const user = decodeURIComponent(new URL(process.env.SMTP_URL ?? "").username);
    if (user) return `Sievoo <${user}>`;
  } catch {
    // fall through
  }
  return "Sievoo <no-reply@sievoo.com>";
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  listUnsubscribe?: string;
}): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    logger.info({ to: opts.to, subject: opts.subject }, "SMTP_URL not set - email skipped");
    return false;
  }
  try {
    await t.sendMail({
      from: defaultFrom(),
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      headers: opts.listUnsubscribe
        ? { "List-Unsubscribe": `<${opts.listUnsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
        : undefined,
    });
    return true;
  } catch (err) {
    logger.error({ err, to: opts.to }, "Failed to send email");
    return false;
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Minimal dark, brand-coloured email shell that renders in every client. */
export function emailShell(title: string, bodyHtml: string, footerHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#0b0f19;font-family:Arial,Helvetica,sans-serif;color:#e5e7eb">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0f19;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1e293b;border-radius:12px;overflow:hidden">
<tr><td style="padding:20px 28px;border-bottom:1px solid #334155"><span style="font-family:'Courier New',monospace;font-weight:bold;font-size:20px;color:#f59e0b">Sievoo</span></td></tr>
<tr><td style="padding:24px 28px"><h1 style="margin:0 0 16px;font-size:20px;color:#f8fafc">${escapeHtml(title)}</h1>${bodyHtml}</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #334155;font-size:12px;color:#94a3b8">${footerHtml}<br><br>Educational tool, not investment advice.</td></tr>
</table></td></tr></table></body></html>`;
}
