import { brandVars } from "@/config/brand";
import { describeDevice } from "@/domain/device";
import { emailPayloads, type EmailPayload, type EmailTemplate } from "@/domain/email-outbox";
import type { Locale } from "@/i18n/locales";
import { colorTokens } from "@/design/tokens";
import { interpolateBrand } from "@/i18n/brand-messages";
import type en from "../../../messages/en.json";

type EmailMessages = typeof en.Email;

/** Loaded like the app's own messages, so adding a locale needs only its message file (ADR 0006). */
async function loadEmailMessages(locale: Locale): Promise<EmailMessages> {
  const raw = (await import(`../../../messages/${locale}.json`)) as {
    default: { Email: EmailMessages };
  };
  return raw.default.Email;
}

export type RenderedEmail = { subject: string; html: string; text: string };

const esc = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/** Keeps an address (always left-to-right) from being reordered inside an Arabic sentence: Unicode LTR isolates. */
const ltr = (value: string): string => `\u2066${value}\u2069`;

const fill = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) => String(values[key] ?? whole));

// Email clients support neither CSS variables nor dark-mode tokens, so the light palette is inlined from the tokens.
const C = colorTokens.light;
const HEADER_BG = colorTokens.dark.background;
const BRAND_ORANGE = colorTokens.dark.primary;
const FONT =
  "-apple-system,'Segoe UI',Roboto,'Noto Sans Arabic','Noto Naskh Arabic',Tahoma,Arial,sans-serif";

type Block = { html: string; text: string };

function layout(
  locale: Locale,
  brand: string,
  title: string,
  blocks: Block[],
  footer: string,
): RenderedEmail["html"] {
  const dir = locale === "ar" ? "rtl" : "ltr";
  const align = locale === "ar" ? "right" : "left";
  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.muted};">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.muted};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:${C.background};border-radius:12px;overflow:hidden;font-family:${FONT};color:${C.foreground};">
<tr><td style="background:${HEADER_BG};padding:20px 28px;text-align:${align};font-size:20px;font-weight:700;letter-spacing:0.5px;color:${colorTokens.dark.foreground};">${esc(brand)}</td></tr>
<tr><td style="padding:28px;text-align:${align};font-size:16px;line-height:1.6;">
${blocks.map((b) => b.html).join("\n")}
</td></tr>
<tr><td style="padding:16px 28px 24px;text-align:${align};font-size:13px;line-height:1.5;color:${C["muted-foreground"]};border-top:1px solid ${C.border};">${esc(footer)}</td></tr>
</table></td></tr></table>
</body></html>`;
}

const heading = (text: string): Block => ({
  html: `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${C.foreground};">${esc(text)}</h1>`,
  text: `${text}\n`,
});
const paragraph = (text: string): Block => ({
  html: `<p style="margin:0 0 16px;">${esc(text)}</p>`,
  text,
});
const muted = (text: string): Block => ({
  html: `<p style="margin:0 0 8px;font-size:14px;color:${C["muted-foreground"]};">${esc(text)}</p>`,
  text,
});
const codeBlock = (code: string): Block => ({
  html: `<p dir="ltr" style="margin:0 0 16px;text-align:center;"><span style="display:inline-block;padding:12px 20px;background:${C.muted};border:1px solid ${C.border};border-radius:8px;font:700 30px/1.2 'SFMono-Regular',Consolas,'Liberation Mono',monospace;letter-spacing:8px;color:${C.foreground};">${esc(code)}</span></p>`,
  text: `\n    ${code}\n`,
});
const button = (label: string, url: string): Block => ({
  html: `<p style="margin:0 0 16px;"><a href="${esc(url)}" style="display:inline-block;padding:14px 24px;background:${BRAND_ORANGE};color:${HEADER_BG};font-weight:700;text-decoration:none;border-radius:8px;min-width:44px;">${esc(label)}</a></p>`,
  text: `${label}: ${url}`,
});
const linkLine = (url: string): Block => ({
  html: `<p dir="ltr" style="margin:0 0 16px;font-size:13px;word-break:break-all;"><a href="${esc(url)}" style="color:${C.link};">${esc(url)}</a></p>`,
  text: url,
});

/**
 * Renders a template to subject, HTML and plain text, in one language. Pure: no I/O. The payload is validated, all
 * text comes from the `Email` messages (brand name interpolated from the brand config) and every value is escaped.
 */
export async function renderEmail<T extends EmailTemplate>(
  template: T,
  locale: Locale,
  rawPayload: unknown,
): Promise<RenderedEmail> {
  const payload = emailPayloads[template].parse(rawPayload) as EmailPayload<T>;
  const vars = brandVars(locale);
  const m = interpolateBrand(await loadEmailMessages(locale), vars);
  let subject: string;
  let title: string;
  let blocks: Block[];

  switch (template) {
    case "verify-code": {
      const p = payload as EmailPayload<"verify-code">;
      subject = m.verifyCode.subject;
      title = m.verifyCode.heading;
      blocks = [
        heading(m.verifyCode.heading),
        paragraph(m.verifyCode.intro),
        codeBlock(p.code),
        muted(fill(m.verifyCode.expires, { minutes: p.expiresMinutes })),
        muted(m.verifyCode.ignore),
      ];
      break;
    }
    case "reset-password": {
      const p = payload as EmailPayload<"reset-password">;
      subject = m.resetPassword.subject;
      title = m.resetPassword.heading;
      blocks = [
        heading(m.resetPassword.heading),
        paragraph(m.resetPassword.intro),
        button(m.resetPassword.button, p.url),
        muted(m.resetPassword.fallback),
        linkLine(p.url),
        muted(fill(m.resetPassword.expires, { minutes: p.expiresMinutes })),
        muted(m.resetPassword.ignore),
      ];
      break;
    }
    case "account-exists": {
      subject = m.accountExists.subject;
      title = m.accountExists.heading;
      blocks = [
        heading(m.accountExists.heading),
        paragraph(m.accountExists.intro),
        paragraph(m.accountExists.action),
        muted(m.accountExists.ignore),
      ];
      break;
    }
    case "password-changed": {
      const p = payload as EmailPayload<"password-changed">;
      const viaReset = p.method === "reset";
      subject = m.passwordChanged.subject;
      title = m.passwordChanged.heading;
      blocks = [
        heading(m.passwordChanged.heading),
        paragraph(m.passwordChanged.intro),
        ...(p.device
          ? [
              paragraph(
                fill(m.passwordChanged.device, { device: describeDevice(p.device, m.devices) }),
              ),
            ]
          : []),
        // A reset by link signs EVERY device out (nobody is left signed in); a change from the account keeps this one.
        paragraph(viaReset ? m.passwordChanged.allSignedOut : m.passwordChanged.othersSignedOut),
        paragraph(viaReset ? m.passwordChanged.wasntYouReset : m.passwordChanged.wasntYou),
        button(m.passwordChanged.button, p.resetUrl),
        muted(m.passwordChanged.fallback),
        linkLine(p.resetUrl),
        muted(m.passwordChanged.itWasYou),
      ];
      break;
    }
    case "email-change-code": {
      const p = payload as EmailPayload<"email-change-code">;
      subject = m.emailChangeCode.subject;
      title = m.emailChangeCode.heading;
      blocks = [
        heading(m.emailChangeCode.heading),
        paragraph(m.emailChangeCode.intro),
        codeBlock(p.code),
        muted(fill(m.emailChangeCode.expires, { minutes: p.expiresMinutes })),
        muted(m.emailChangeCode.ignore),
      ];
      break;
    }
    case "email-change-notice": {
      const p = payload as EmailPayload<"email-change-notice">;
      subject = m.emailChangeNotice.subject;
      title = m.emailChangeNotice.heading;
      blocks = [
        heading(m.emailChangeNotice.heading),
        paragraph(fill(m.emailChangeNotice.intro, { address: ltr(p.newEmailMasked) })),
        ...(p.device
          ? [
              paragraph(
                fill(m.emailChangeNotice.device, { device: describeDevice(p.device, m.devices) }),
              ),
            ]
          : []),
        paragraph(m.emailChangeNotice.wasntYou),
        button(m.emailChangeNotice.button, p.cancelUrl),
        muted(m.emailChangeNotice.fallback),
        linkLine(p.cancelUrl),
        muted(fill(m.emailChangeNotice.expires, { minutes: p.expiresMinutes })),
        muted(m.emailChangeNotice.itWasYou),
      ];
      break;
    }
    case "email-changed": {
      const p = payload as EmailPayload<"email-changed">;
      subject = m.emailChanged.subject;
      title = m.emailChanged.heading;
      blocks = [
        heading(m.emailChanged.heading),
        paragraph(fill(m.emailChanged.intro, { address: ltr(p.newEmailMasked) })),
        paragraph(m.emailChanged.othersSignedOut),
        // With a revert link (ADR 0027) the undo comes first and support second; a row queued before the revert existed
        // has no link and keeps the original wording.
        ...(p.revertUrl
          ? [
              paragraph(fill(m.emailChanged.revert, { days: p.revertDays ?? 7 })),
              button(m.emailChanged.revertButton, p.revertUrl),
              muted(m.emailChanged.fallback),
              linkLine(p.revertUrl),
              paragraph(m.emailChanged.revertHelp),
              linkLine(p.contactUrl),
            ]
          : [
              paragraph(m.emailChanged.wasntYou),
              button(m.emailChanged.button, p.contactUrl),
              muted(m.emailChanged.fallback),
              linkLine(p.contactUrl),
            ]),
        muted(m.emailChanged.itWasYou),
      ];
      break;
    }
    case "email-reverted": {
      subject = m.emailReverted.subject;
      title = m.emailReverted.heading;
      blocks = [
        heading(m.emailReverted.heading),
        paragraph(m.emailReverted.intro),
        paragraph(m.emailReverted.allSignedOut),
        paragraph(m.emailReverted.resetNext),
        muted(m.emailReverted.wasntYou),
      ];
      break;
    }
    case "email-revert-released": {
      subject = m.emailRevertReleased.subject;
      title = m.emailRevertReleased.heading;
      blocks = [
        heading(m.emailRevertReleased.heading),
        paragraph(m.emailRevertReleased.intro),
        muted(m.emailRevertReleased.ignore),
      ];
      break;
    }
    case "email-change-taken": {
      subject = m.emailChangeTaken.subject;
      title = m.emailChangeTaken.heading;
      blocks = [
        heading(m.emailChangeTaken.heading),
        paragraph(m.emailChangeTaken.intro),
        paragraph(m.emailChangeTaken.action),
        muted(m.emailChangeTaken.ignore),
      ];
      break;
    }
    case "test": {
      subject = m.test.subject;
      title = m.test.heading;
      blocks = [heading(m.test.heading), paragraph(m.test.body)];
      break;
    }
    default:
      throw new Error(`Unknown email template: ${String(template)}`);
  }

  const footer = `${m.common.footer} ${m.common.automatic}`;
  return {
    subject,
    html: layout(locale, vars.brand, title, blocks, footer),
    text: [...blocks.map((b) => b.text), "", footer].join("\n"),
  };
}
