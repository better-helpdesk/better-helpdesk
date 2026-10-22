/**
 * What a pager or an issue tracker does from host code: writes what it
 * learned onto the conversation, with events and timeline rows.
 *   pnpm --filter better-helpdesk-demo pager HRB-1000 "PagerDuty: acknowledged by Sam"
 *   pnpm --filter better-helpdesk-demo pager HRB-1000 --resolve "GitLab issue #42 closed"
 *   pnpm --filter better-helpdesk-demo pager --open ops@nordkai.test "Incident INC-7: we are looking into it"
 */
import { helpdesk, pool } from '../lib/helpdesk';

const args = process.argv.slice(2);
const resolve = args.includes('--resolve');
const open = args.includes('--open');
const [target, ...rest] = args.filter(a => !a.startsWith('--'));
const text = rest.join(' ');
if (!target || !text) {
  console.error(
    'Usage: pager <reference> [--resolve] <text>\n       pager --open <email> <text>'
  );
  process.exit(1);
}

try {
  if (open) {
    const { conversation } = await helpdesk.openConversation({
      agentUserId: 'demo-agent',
      inbox: 'support',
      type: 'bug',
      email: target,
      subject: text.split(':')[0] ?? text,
      body: text,
      priority: 'urgent',
    });
    console.log(`Opened ${helpdesk.reference(conversation)} to ${target}`);
  } else {
    const number = Number(target.replace(/^\D+-/, ''));
    const conversation = await helpdesk.store.getConversationByNumber(number);
    if (!conversation) throw new Error(`No conversation ${target}`);
    await helpdesk.addNote(conversation.id, text);
    console.log(`Noted on ${target}: ${text}`);
    if (resolve) {
      await helpdesk.changeConversation(conversation.id, {
        status: 'resolved',
        tags: [...conversation.tags, 'incident'],
      });
      console.log(`Resolved ${target}`);
    }
  }
} finally {
  await pool.end();
}
