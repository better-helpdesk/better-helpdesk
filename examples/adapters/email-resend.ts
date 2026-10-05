import type { HelpdeskEmail } from 'better-helpdesk';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const from = 'Acme Support <support@example.com>';

function render(m: HelpdeskEmail) {
  switch (m.kind) {
    case 'customer-reply':
      return {
        subject: `Re: ${m.subject ?? m.reference}`,
        text: `${m.body}\n\n${m.agentName}`,
        replyTo: m.replyTo,
        headers: m.inReplyTo ? { 'In-Reply-To': m.inReplyTo } : undefined,
      };
    case 'customer-receipt':
      return {
        subject: `We got your message (${m.reference})`,
        text: [
          `Thanks for writing. ${m.responderName ?? 'We'} will answer here.`,
          m.backOn && `We are back on ${new Date(m.backOn).toDateString()}.`,
          m.bookingUrl && `Or book a call: ${m.bookingUrl}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
        replyTo: m.replyTo,
      };
    case 'agent-new':
    case 'agent-reminder':
      return {
        subject: m.reopened ? `Reopened: ${m.subject}` : m.subject,
        text: `${m.body}\n\n${m.url}`,
      };
    case 'agent-mention':
      return {
        subject: `${m.authorName} mentioned you: ${m.subject}`,
        text: `${m.body}\n\n${m.url}`,
      };
  }
}

export const email = {
  async send(message: HelpdeskEmail) {
    const { error } = await resend.emails.send({
      from,
      to: message.to,
      ...render(message),
    });
    if (error) throw new Error(error.message);
  },
};
