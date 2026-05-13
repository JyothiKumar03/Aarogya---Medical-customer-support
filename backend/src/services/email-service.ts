import { ENV } from "@/utils/env"
import { Resend } from "resend"
import { log } from "./logger-service"

const resend = new Resend(ENV.RESEND_API_KEY)
const FROM = ENV.RESEND_FROM_MAIL

const BRAND_NAME = "InsureCo"
const BRAND_TAGLINE = "Health insurance support, simplified."
const BRAND_PRIMARY = "#0F172A"
const BRAND_ACCENT = "#2563EB"
const BRAND_ACCENT_2 = "#7C3AED"
const BG_SOFT = "#F8FAFC"
const BORDER = "#E2E8F0"
const TEXT = "#0F172A"
const MUTED = "#64748B"

function escape_html(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function short_id(id: string): string {
  return id.slice(0, 8).toUpperCase()
}

function unpack_resolution(raw: string): string {
  if (!raw) return ""
  try {
    const parsed = JSON.parse(raw) as { content?: string; title?: string }
    if (parsed && typeof parsed.content === "string" && parsed.content.trim()) {
      return parsed.content
    }
  } catch {
    /* not JSON, treat as plain text */
  }
  return raw
}

type TLayoutOptions = {
  preheader: string
  eyebrow: string
  title: string
  body_html: string
  cta?: { label: string; href: string }
}

function shell(options: TLayoutOptions): string {
  const { preheader, eyebrow, title, body_html, cta } = options
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escape_html(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BG_SOFT};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TEXT};">
  <span style="display:none!important;opacity:0;visibility:hidden;mso-hide:all;height:0;width:0;font-size:1px;line-height:1px;color:${BG_SOFT};">
    ${escape_html(preheader)}
  </span>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG_SOFT};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${BORDER};box-shadow:0 1px 3px rgba(15,23,42,0.04),0 8px 24px rgba(15,23,42,0.04);">

          <!-- Gradient header -->
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND_ACCENT} 0%,${BRAND_ACCENT_2} 100%);padding:28px 32px;color:#ffffff;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;opacity:0.85;">
                    ${escape_html(BRAND_NAME)}
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:6px;font-size:13px;opacity:0.85;">
                    ${escape_html(BRAND_TAGLINE)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <div style="font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND_ACCENT};font-weight:600;margin-bottom:8px;">
                ${escape_html(eyebrow)}
              </div>
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;color:${BRAND_PRIMARY};">
                ${escape_html(title)}
              </h1>
              ${body_html}
              ${
                cta
                  ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
                <tr>
                  <td style="background:${BRAND_PRIMARY};border-radius:10px;">
                    <a href="${escape_html(cta.href)}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;">
                      ${escape_html(cta.label)} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              `
                  : ""
              }
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:${BG_SOFT};padding:20px 32px;border-top:1px solid ${BORDER};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:12px;color:${MUTED};line-height:1.6;">
                    Need anything else? Reply to this email and include your ticket ID we'll pick it up from there.
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:10px;font-size:11px;color:${MUTED};">
                    &copy; ${new Date().getFullYear()} ${escape_html(BRAND_NAME)} &middot; Sent to you because you opened a support ticket with us.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function detail_card(
  rows: { label: string; value: string; mono?: boolean; multiline?: boolean }[],
): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG_SOFT};border:1px solid ${BORDER};border-radius:12px;margin-top:8px;">
    <tr><td style="padding:16px 18px;">
      ${rows
        .map(
          (r, i) => `
        <div style="${i > 0 ? "margin-top:14px;padding-top:14px;border-top:1px dashed " + BORDER + ";" : ""}">
          <div style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:${MUTED};font-weight:600;">${escape_html(r.label)}</div>
          <div style="margin-top:4px;font-size:14px;color:${TEXT};line-height:1.55;${r.mono ? "font-family:'SFMono-Regular',ui-monospace,Menlo,Consolas,monospace;font-weight:600;letter-spacing:0.02em;" : ""}${r.multiline ? "white-space:pre-wrap;word-break:break-word;" : ""}">
            ${escape_html(r.value)}
          </div>
        </div>`,
        )
        .join("")}
    </td></tr>
  </table>`
}

function status_pill(label: string, tone: "info" | "success"): string {
  const bg = tone === "success" ? "#DCFCE7" : "#DBEAFE"
  const fg = tone === "success" ? "#15803D" : "#1D4ED8"
  const dot = tone === "success" ? "#22C55E" : "#3B82F6"
  return `
  <span style="display:inline-block;background:${bg};color:${fg};font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;line-height:1;">
    <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${dot};vertical-align:middle;margin-right:6px;"></span>
    ${escape_html(label)}
  </span>`
}

export async function send_ticket_confirmation(params: {
  to: string
  customer_name: string
  ticket_id: string
  query_summary: string
}): Promise<void> {
  log.info("emails", JSON.stringify(params) + FROM)

  const html = shell({
    preheader: `Ticket #${short_id(params.ticket_id)} received we'll respond within 24 hours.`,
    eyebrow: "Ticket received",
    title: `Hi ${params.customer_name}, we're on it.`,
    body_html: `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${TEXT};">
        Thanks for reaching out. Your request is in our queue and a teammate will get back to you within
        <strong>24 hours</strong>. Below is everything we logged for this ticket.
      </p>

      <div style="margin:18px 0 8px;">
        ${status_pill("Open", "info")}
      </div>

      ${detail_card([
        { label: "Ticket ID", value: `#${short_id(params.ticket_id)}`, mono: true },
        { label: "Your query", value: params.query_summary },
      ])}

      <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:${MUTED};">
        Have more details? Just reply to this email keep your ticket ID in the subject and it'll thread automatically.
      </p>
    `,
  })

  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `We've got your request #${short_id(params.ticket_id)}`,
    html,
  })
}

export async function send_ticket_resolution(params: {
  to: string
  customer_name: string
  ticket_id: string
  query_summary: string
  resolution_summary: string
}): Promise<void> {
  const resolution_text = unpack_resolution(params.resolution_summary)

  const html = shell({
    preheader: `Ticket #${short_id(params.ticket_id)} resolved take a look at the details inside.`,
    eyebrow: "Ticket resolved",
    title: `Hi ${params.customer_name}, your ticket is sorted.`,
    body_html: `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${TEXT};">
        Good news your support request has been resolved by our team. The summary below is what we updated against your ticket.
      </p>

      <div style="margin:18px 0 8px;">
        ${status_pill("Resolved", "success")}
      </div>

      ${detail_card([
        { label: "Ticket ID", value: `#${short_id(params.ticket_id)}`, mono: true },
        { label: "Your original query", value: params.query_summary },
        ...(resolution_text
          ? [{ label: "Resolution", value: resolution_text, multiline: true }]
          : []),
      ])}

      <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:${MUTED};">
        Not quite resolved? Reply to this email and we'll re-open the ticket and follow up.
      </p>
    `,
  })

  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `Resolved #${short_id(params.ticket_id)}`,
    html,
  })
}
