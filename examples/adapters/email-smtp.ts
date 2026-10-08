// Plain text over SMTP with Nodemailer. The transport is created on the first
// send, not when the module loads, so `next build` does not need SMTP_URL.
import type { HelpdeskEmail } from 'better-helpdesk';
import nodemailer, { type Transporter } from 'nodemailer';

let transport: Transporter | undefined;
const from = 'Acme Support <support@example.com>';

function render(message: HelpdeskEmail) {
  switch (message.kind) {
    case 'customer-reply':
      return {
        subject: `Re: ${message.subject ?? message.reference}`,
        text: [
          message.body,
          message.agentName,
          message.ratingLinks &&
            `Solved? ${message.ratingLinks.good}\nNot solved? ${message.ratingLinks.bad}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
        replyTo: message.replyTo,
        inReplyTo: message.inReplyTo,
        references: message.inReplyTo,
      };
    case 'customer-receipt':
      return {
        subject: `We got your message (${message.reference})`,
        text: [
          `Thanks for writing. ${message.responderName ?? 'We'} will answer here.`,
          message.backOn &&
            `We are back on ${new Date(message.backOn).toDateString()}.`,
          message.bookingUrl && `Or book a call: ${message.bookingUrl}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
        replyTo: message.replyTo,
      };
    case 'agent-new':
    case 'agent-reminder':
      return {
        subject: message.reopened
          ? `Reopened: ${message.subject}`
          : message.subject,
        text: `${message.body}\n\n${message.url}`,
      };
    case 'agent-mention':
      return {
        subject: `${message.authorName} mentioned you in ${message.reference}`,
        text: `${message.body}\n\n${message.url}`,
      };
  }
}

export const email = {
  async send(message: HelpdeskEmail) {
    transport ??= nodemailer.createTransport(process.env.SMTP_URL);
    await transport.sendMail({ from, to: message.to, ...render(message) });
  },
};
