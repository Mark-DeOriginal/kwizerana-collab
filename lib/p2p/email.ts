import { Resend } from "resend";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function getFromAddress(): string {
  return process.env.EMAIL_FROM ?? "Kwizerana Collab <onboarding@resend.dev>";
}

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmail(input: SendEmailInput) {
  if (!isEmailConfigured()) {
    console.warn(`[email] RESEND_API_KEY not configured. Skipping email to ${input.to} (subject: ${input.subject})`);
    return { skipped: true };
  }

  const resend = new Resend(process.env.RESEND_API_KEY!);
  const { data, error } = await resend.emails.send({
    from: getFromAddress(),
    to: [input.to],
    subject: input.subject,
    html: input.html,
    text: input.text
  });

  if (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }

  return data;
}

export function renderAntiPhishingNotice(antiPhishingCode?: string | null): string {
  if (!antiPhishingCode) return "";
  return `
    <p style="margin-top:24px;padding:12px 16px;background:#f7f8f5;border:1px solid #dfe4dc;color:#182026;font-size:13px;">
      Your anti-phishing code is: <strong>${antiPhishingCode}</strong>.
      Official Kwizerana emails always include this code. If it is missing or different, do not trust this message.
    </p>`;
}
