import type { HelpdeskEmail } from 'better-helpdesk';
import nodemailer from 'nodemailer';

/**
 * Plain-text mail through whatever SMTP server SMTP_URL names, for example
 * smtps://user:pass@smtp.example.com:465. Without it, nothing is sent and the
 * log says so: replies to design partners then only exist in the inbox.
 */
const url = process.env.SMTP_URL;
const from =
  process.env.MAIL_FROM ?? 'Better Helpdesk <hello@better-helpdesk.test>';
const transport = url ? nodemailer.createTransport(url) : null;

function render(message: HelpdeskEmail) {
  switch (message.kind) {
    case 'customer-reply':
      return {
        subject: `Re: ${message.subject ?? message.reference}`,
        text: `${message.body}\n\n${message.agentName}\n${message.reference}`,
        replyTo: message.replyTo,
        inReplyTo: message.inReplyTo,
      };
    case 'customer-receipt':
      return {
        subject: `We got your message (${message.reference})`,
        text: `Thanks for writing. We read every message and reply to this address.\n\nReference: ${message.reference}`,
        replyTo: message.replyTo,
      };
    case 'agent-new':
    case 'agent-reminder':
      return {
        subject: message.subject,
        text: `${message.body}\n\n${message.url}`,
      };
  }
}

export async function sendMail(message: HelpdeskEmail) {
  if (!transport) {
    console.log(`[helpdesk email] ${message.kind} not sent: SMTP_URL is unset`);
    return;
  }
  await transport.sendMail({ from, to: message.to, ...render(message) });
}
