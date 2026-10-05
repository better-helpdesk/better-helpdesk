import { signIdentityToken } from 'better-helpdesk';

import { helpdesk } from './helpdesk';

// The README's "Calling it from your own code" recipes, kept here so the demo
// build type-checks them. No route calls them.

type BillingUser = { id: string; email: string; name: string };

export async function openFailedPaymentConversation(
  webhookUrl: string,
  user: BillingUser,
  invoice: { number: string }
) {
  const token = signIdentityToken(
    { sub: user.id, email: user.email, email_verified: true, name: user.name },
    process.env.HELPDESK_IDENTITY_SECRET!,
    { expiresInSeconds: 60 }
  );
  const { conversation } = await helpdesk.createConversation(
    new Request(webhookUrl, { headers: { 'x-helpdesk-identity': token } }),
    {
      inbox: 'billing',
      type: 'question',
      subject: `Payment failed for invoice ${invoice.number}`,
      body: `The card on file was declined for invoice ${invoice.number}.`,
    }
  );
  return conversation && helpdesk.reference(conversation);
}

export async function trackPlanUpgrade(
  user: BillingUser,
  plan: { from: string; to: string }
) {
  return helpdesk.track({
    externalUserId: user.id,
    event: 'plan.upgraded',
    props: plan,
  });
}
