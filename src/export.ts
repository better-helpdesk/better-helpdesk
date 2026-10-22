import { z } from 'zod';

import type { HelpdeskStore } from './db/store';
import { formatReference } from './domain';
import type { ImportReport } from './import';

/**
 * One conversation as the export writes it and the import reads it: one
 * JSON object per line. People are named by email, agents by email, so the
 * file moves between installs and from another tool's export.
 */
export type ExportedConversation = {
  reference: string;
  inbox: string;
  type: string;
  kind: 'chat' | 'ticket';
  channel: string;
  status: string;
  priority: string;
  tier: string | null;
  subject: string | null;
  title: string | null;
  tags: string[];
  context: Record<string, unknown>;
  createdAt: string;
  resolvedAt: string | null;
  rating: 'good' | 'bad' | null;
  ratingScore: number | null;
  ratingComment: string | null;
  contact: { name: string | null; email: string | null };
  company: { name: string; domain: string | null } | null;
  participants: { name: string | null; email: string | null }[];
  messages: {
    author: 'contact' | 'agent' | 'system';
    name: string | null;
    email: string | null;
    body: string;
    internal: boolean;
    createdAt: string;
    emailMessageId: string | null;
  }[];
  attachments: {
    filename: string;
    contentType: string;
    size: number;
    key: string;
    messageIndex: number | null;
  }[];
  events: { kind: string; data: Record<string, unknown>; createdAt: string }[];
};

const iso = (d: Date | null) => d?.toISOString() ?? null;

/** Every conversation, oldest id first, a page at a time; `since` keeps the ones opened from then on. */
export async function* exportConversations(
  store: HelpdeskStore,
  { since, prefix }: { since?: Date; prefix: string }
): AsyncGenerator<ExportedConversation> {
  let after: string | undefined;
  for (;;) {
    const page = await store.pageConversations({ after, since });
    if (page.length === 0) return;
    for (const c of page) {
      const [contact, company, participants, messages, attachments, events] =
        await Promise.all([
          store.getContact(c.contactId),
          c.companyId ? store.getCompany(c.companyId) : null,
          store.listParticipants(c.id),
          store.listMessages(c.id, { includeInternal: true }),
          store.listAttachments(c.id),
          store.listEvents(c.id),
        ]);
      const agents = new Map<string, string | null>();
      for (const m of messages) {
        if (m.message.agentId && !agents.has(m.message.agentId)) {
          const agent = await store.getAgent(m.message.agentId);
          agents.set(m.message.agentId, agent?.email ?? null);
        }
      }
      const contacts = new Map<string, string | null>();
      for (const m of messages) {
        if (m.message.contactId && !contacts.has(m.message.contactId)) {
          const author = await store.getContact(m.message.contactId);
          contacts.set(m.message.contactId, author?.email ?? null);
        }
      }
      yield {
        reference: formatReference(prefix, c.number),
        inbox: c.inbox,
        type: c.type,
        kind: c.kind,
        channel: c.channel,
        status: c.status,
        priority: c.priority,
        tier: c.tier,
        subject: c.subject,
        title: c.title,
        tags: c.tags,
        context: c.context,
        createdAt: c.createdAt.toISOString(),
        resolvedAt: iso(c.resolvedAt),
        rating: c.rating,
        ratingScore: c.ratingScore,
        ratingComment: c.ratingComment,
        contact: { name: contact?.name ?? null, email: contact?.email ?? null },
        company: company
          ? { name: company.name, domain: company.domain }
          : null,
        participants: participants.map(p => ({
          name: p.contact.name,
          email: p.contact.email,
        })),
        messages: messages.map(m => ({
          author: m.message.authorType,
          name: m.agentName ?? m.contactName,
          email:
            (m.message.agentId && agents.get(m.message.agentId)) ||
            (m.message.contactId && contacts.get(m.message.contactId)) ||
            null,
          body: m.message.body,
          internal: m.message.internal,
          createdAt: m.message.createdAt.toISOString(),
          emailMessageId: m.message.emailMessageId,
        })),
        attachments: attachments.map(a => ({
          filename: a.filename,
          contentType: a.contentType,
          size: a.size,
          key: a.key,
          messageIndex: a.messageId
            ? messages.findIndex(m => m.message.id === a.messageId)
            : null,
        })),
        events: events.map(e => ({
          kind: e.kind,
          data: e.data,
          createdAt: e.createdAt.toISOString(),
        })),
      };
      after = c.id;
    }
  }
}

const dateString = z.iso.datetime({ offset: true });
const person = z.object({
  name: z.string().max(200).nullable().optional(),
  email: z.email().max(254).nullable().optional(),
});
const line = z.object({
  reference: z.string().max(100).optional(),
  inbox: z.string().min(1).max(255),
  type: z.string().min(1).max(255),
  kind: z.enum(['chat', 'ticket']).optional(),
  channel: z.enum(['widget', 'email', 'agent', 'api']).optional(),
  status: z.enum(['open', 'pending', 'resolved']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  tier: z.string().max(100).nullable().optional(),
  subject: z.string().max(200).nullable().optional(),
  title: z.string().max(200).nullable().optional(),
  tags: z.array(z.string().min(1).max(50)).max(50).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  createdAt: dateString,
  resolvedAt: dateString.nullable().optional(),
  rating: z.enum(['good', 'bad']).nullable().optional(),
  ratingScore: z.number().int().min(1).max(5).nullable().optional(),
  ratingComment: z.string().max(2000).nullable().optional(),
  contact: person,
  company: z
    .object({
      name: z.string().min(1).max(200),
      domain: z.string().max(200).nullable().optional(),
    })
    .nullable()
    .optional(),
  participants: z.array(person).max(50).optional(),
  messages: z
    .array(
      z.object({
        author: z.enum(['contact', 'agent', 'system']),
        name: z.string().max(200).nullable().optional(),
        email: z.email().max(254).nullable().optional(),
        body: z.string().min(1).max(20_000),
        internal: z.boolean().optional(),
        createdAt: dateString,
        emailMessageId: z.string().max(255).nullable().optional(),
      })
    )
    .min(1),
});

/**
 * Reads the export format back, or another tool's history written in it.
 * Each line opens a new conversation with a new reference; the old one is
 * kept as `imported.reference` in the context, so agents can still quote it.
 * Contacts are matched by email, agents by email; a message from an agent
 * nobody here has is kept as an agent message without a name. Attachments
 * and events are not imported. A line that fails is skipped with a note.
 */
export async function importConversations(
  store: HelpdeskStore,
  lines: string[],
  {
    inboxes,
    types,
    source,
  }: { inboxes?: string[]; types?: string[]; source?: string } = {}
): Promise<ImportReport> {
  const report: ImportReport = {
    created: 0,
    updated: 0,
    skipped: 0,
    notes: [],
  };
  const agents = await store.listAgents();
  const agentByEmail = new Map(
    agents.flatMap(a => (a.email ? [[a.email.toLowerCase(), a.id]] : []))
  );
  const contactFor = async (p: {
    name?: string | null;
    email?: string | null;
  }) => {
    const email = p.email?.toLowerCase();
    if (email) {
      const known =
        (await store.findContactByIdentity('email', email, {
          verifiedOnly: false,
        })) ?? (await store.findContactByEmail(email));
      if (known) return known;
      return store.createContact(
        { name: p.name ?? null, email },
        { channel: 'email', externalId: email, verified: false }
      );
    }
    return store.createContact({ name: p.name ?? null, email: null });
  };
  for (const [index, text] of lines.entries()) {
    const at = `line ${index + 1}`;
    if (!text.trim()) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      report.skipped++;
      report.notes.push(`${at}: not JSON, skipped`);
      continue;
    }
    const parsed = line.safeParse(raw);
    if (!parsed.success) {
      report.skipped++;
      report.notes.push(
        `${at}: ${parsed.error.issues.map(i => i.path.join('.') || 'line').join(', ')} invalid, skipped`
      );
      continue;
    }
    const c = parsed.data;
    if (inboxes && !inboxes.includes(c.inbox)) {
      report.skipped++;
      report.notes.push(
        `${at}: inbox "${c.inbox}" is not one of ${inboxes.join(', ')}, skipped`
      );
      continue;
    }
    if (types && !types.includes(c.type)) {
      report.skipped++;
      report.notes.push(
        `${at}: type "${c.type}" is not one of ${types.join(', ')}, skipped`
      );
      continue;
    }
    const contact = await contactFor(c.contact);
    let companyId = contact.companyId;
    if (c.company) {
      const company =
        (c.company.domain
          ? await store.findCompanyByDomain(c.company.domain.toLowerCase())
          : null) ??
        (await store.findCompanyByName(c.company.name)) ??
        (await store.createCompany({
          name: c.company.name,
          domain: c.company.domain?.toLowerCase() ?? null,
        }));
      companyId = company.id;
      if (!contact.companyId) {
        await store.updateContact(contact.id, { companyId });
      }
    }
    const [first, ...rest] = c.messages;
    if (!first) continue;
    const createdAt = new Date(c.createdAt);
    const lastMessageAt = new Date(
      Math.max(
        ...c.messages
          .filter(m => !m.internal)
          .map(m => Date.parse(m.createdAt)),
        createdAt.getTime()
      )
    );
    const status = c.status ?? (c.resolvedAt ? 'resolved' : 'open');
    const lastPublic = [...c.messages].reverse().find(m => !m.internal);
    const firstAgent = c.messages.find(
      m => m.author === 'agent' && !m.internal
    );
    const firstAgentId =
      first.author === 'agent'
        ? agentByEmail.get(first.email?.toLowerCase() ?? '')
        : undefined;
    const { conversation } = await store.createConversation(
      {
        inbox: c.inbox,
        type: c.type,
        kind: c.kind ?? (c.subject ? 'ticket' : 'chat'),
        channel: c.channel ?? 'api',
        status,
        priority: c.priority ?? 'normal',
        tier: c.tier ?? null,
        subject: c.subject ?? null,
        title: c.title ?? null,
        contactId: contact.id,
        companyId,
        context: {
          ...c.context,
          imported: {
            ...(c.reference && { reference: c.reference }),
            ...(source && { source }),
          },
        },
        tags: c.tags,
        createdAt,
        lastMessageAt,
        resolvedAt: c.resolvedAt ? new Date(c.resolvedAt) : null,
        waitingSince:
          status !== 'resolved' && lastPublic?.author === 'contact'
            ? new Date(lastPublic.createdAt)
            : null,
        firstRespondedAt: firstAgent ? new Date(firstAgent.createdAt) : null,
        rating: c.rating ?? null,
        ratingScore: c.ratingScore ?? null,
        ratingComment: c.ratingComment ?? null,
        ratedAt: c.rating
          ? c.resolvedAt
            ? new Date(c.resolvedAt)
            : createdAt
          : null,
      },
      first.author === 'agent'
        ? { body: first.body, agentId: firstAgentId ?? undefined }
        : { body: first.body, contactId: contact.id, verified: false },
      { sla: false }
    );
    // An opening agent message nobody here wrote still needs its author kind.
    if (first.author !== 'contact' && !firstAgentId) {
      await store.adapter.updateMany(
        'message',
        { field: 'conversationId', value: conversation.id },
        {
          authorType: first.author,
          agentId: null,
          contactId: null,
          internal: first.internal ?? false,
        }
      );
    }
    for (const m of rest) {
      const email = m.email?.toLowerCase();
      const author =
        m.author === 'contact'
          ? email && email !== contact.email
            ? await contactFor(m)
            : contact
          : null;
      if (author && author.id !== contact.id) {
        await store.addParticipant(conversation.id, author.id);
      }
      await store.createMessage({
        conversationId: conversation.id,
        authorType: m.author,
        contactId: author?.id ?? null,
        agentId:
          m.author === 'agent' ? (agentByEmail.get(email ?? '') ?? null) : null,
        body: m.body,
        internal: m.internal ?? false,
        verified: m.author === 'contact' ? false : null,
        emailMessageId: m.emailMessageId ?? null,
        createdAt: new Date(m.createdAt),
      });
    }
    for (const p of c.participants ?? []) {
      const participant = await contactFor(p);
      if (participant.id !== contact.id) {
        await store.addParticipant(conversation.id, participant.id);
      }
    }
    report.created++;
  }
  return report;
}
