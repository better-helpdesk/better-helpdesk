// Postmark's HTTP API over fetch, so no SDK is needed. The server token is
// read on each send, so `next build` can load the module without it.
import type { HelpdeskEmail } from 'better-helpdesk';

const from = 'Acme Support <support@example.com>';

function render(m: HelpdeskEmail) {
  switch (m.kind) {
    case 'customer-reply':
      return {
        Subject: `Re: ${m.subject ?? m.reference}`,
        TextBody: `${m.body}\n\n${m.agentName}${
          m.ratingLinks
            ? `\n\nSolved? ${m.ratingLinks.good}\nNot solved? ${m.ratingLinks.bad}`
            : ''
        }`,
        ReplyTo: m.replyTo,
        Headers: m.inReplyTo
          ? [{ Name: 'In-Reply-To', Value: m.inReplyTo }]
          : undefined,
      };
    case 'customer-receipt':
      return {
        Subject: `We got your message (${m.reference})`,
        TextBody: [
          `Thanks for writing. ${m.responderName ?? 'We'} will answer here.`,
          m.backOn && `We are back on ${new Date(m.backOn).toDateString()}.`,
          m.bookingUrl && `Or book a call: ${m.bookingUrl}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
        ReplyTo: m.replyTo,
      };
    case 'agent-new':
    case 'agent-reminder':
      return {
        Subject: m.reopened ? `Reopened: ${m.subject}` : m.subject,
        TextBody: `${m.body}\n\n${m.url}`,
      };
    case 'agent-mention':
      return {
        Subject: `${m.authorName} mentioned you: ${m.subject}`,
        TextBody: `${m.body}\n\n${m.url}`,
      };
  }
}

export const email = {
  async send(message: HelpdeskEmail) {
    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': process.env.POSTMARK_SERVER_TOKEN ?? '',
      },
      body: JSON.stringify({
        From: from,
        To: message.to,
        MessageStream: 'outbound',
        ...render(message),
      }),
    });
    if (!response.ok) {
      const error: { ErrorCode?: number; Message?: string } = await response
        .json()
        .catch(() => ({}));
      throw new Error(
        `Postmark ${error.ErrorCode ?? response.status}: ${error.Message ?? response.statusText}`
      );
    }
  },
};
