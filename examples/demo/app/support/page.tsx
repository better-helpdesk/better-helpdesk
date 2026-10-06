import { HelpdeskConversations } from 'better-helpdesk/widget';

import { Bar, Foot } from '../chrome';

/** Harbor's own Support page: the customer's conversations, in the page. */
export default function Support() {
  return (
    <>
      <Bar here="support" />
      <main id="main" className="shell band">
        <h1>Support</h1>
        <p>
          Your conversations with the Harbor team, and your company's shared
          ones, the same as in the widget.
        </p>
        <HelpdeskConversations inbox="support" locale="en" />
      </main>
      <Foot />
    </>
  );
}
