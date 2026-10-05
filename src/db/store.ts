import {
  and,
  arrayContains,
  asc,
  desc,
  eq,
  getTableColumns,
  gt,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';

import { PRIORITIES } from '../config';
import type { ConversationContext } from './schema';
import * as schema from './schema';

const {
  activities,
  agents,
  attachments,
  cannedReplies,
  companies,
  contacts,
  conversationEvents,
  conversations,
  deals,
  identities,
  jobs,
  messages,
  participants,
  rateLimits,
  settings,
} = schema;

export type Db = NodePgDatabase<typeof schema>;
export type Contact = typeof contacts.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type Deal = typeof deals.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type IdentityInput = {
  channel: schema.IdentityChannel;
  externalId: string;
  verified: boolean;
};

export type InboxFilter = {
  inbox?: string;
  status?: string;
  assigneeId?: string | null;
  contactId?: string;
  companyId?: string;
  tag?: string;
  query?: string;
  /** Longest waiting first by default; `priority` puts urgent and high on top. */
  sort?: 'waiting' | 'priority';
  limit?: number;
};

const MAX_ATTEMPTS = 5;

/** The Postgres adapter. It shares the host's pool and never opens its own. */
export function postgresAdapter({ pool }: { pool: Pool }) {
  return createStore(drizzle(pool, { schema }));
}

export type HelpdeskStore = ReturnType<typeof createStore>;

export function createStore(db: Db) {
  const store = {
    db,

    async findContactByIdentity(
      channel: schema.IdentityChannel,
      externalId: string,
      { verifiedOnly }: { verifiedOnly: boolean }
    ): Promise<Contact | null> {
      const [row] = await db
        .select({ contact: contacts })
        .from(identities)
        .innerJoin(contacts, eq(contacts.id, identities.contactId))
        .where(
          and(
            eq(identities.channel, channel),
            eq(identities.externalId, externalId),
            verifiedOnly ? eq(identities.verified, true) : undefined
          )
        )
        .orderBy(desc(identities.verified))
        .limit(1);
      return row?.contact ?? null;
    },

    /**
     * The contact behind a visitor token, if the token was used recently;
     * each use keeps it alive for another `idleDays`.
     */
    async findVisitor(tokenHash: string, idleDays: number) {
      const [row] = await db
        .select({ identity: identities, contact: contacts })
        .from(identities)
        .innerJoin(contacts, eq(contacts.id, identities.contactId))
        .where(
          and(
            eq(identities.channel, 'visitor'),
            eq(identities.externalId, tokenHash),
            gt(
              identities.lastUsedAt,
              sql`now() - make_interval(days => ${idleDays})`
            )
          )
        )
        .limit(1);
      if (!row) return null;
      // The widget polls; one write an hour is enough to measure idleness.
      await db
        .update(identities)
        .set({ lastUsedAt: sql`now()` })
        .where(
          and(
            eq(identities.id, row.identity.id),
            lt(identities.lastUsedAt, sql`now() - interval '1 hour'`)
          )
        );
      return row.contact;
    },

    async createContact(
      values: typeof contacts.$inferInsert,
      identity?: IdentityInput
    ): Promise<Contact> {
      return db.transaction(async tx => {
        const contact = first(
          await tx.insert(contacts).values(values).returning()
        );
        if (identity) {
          await tx
            .insert(identities)
            .values({ ...identity, contactId: contact.id });
        }
        return contact;
      });
    },

    async addIdentity(contactId: string, identity: IdentityInput) {
      const insert = db.insert(identities).values({ ...identity, contactId });
      // Proving an address the contact already holds unverified upgrades it.
      await (identity.verified
        ? insert.onConflictDoUpdate({
            target: [
              identities.channel,
              identities.externalId,
              identities.contactId,
            ],
            set: { verified: true },
          })
        : insert.onConflictDoNothing());
    },

    async listIdentities(contactId: string) {
      return db
        .select()
        .from(identities)
        .where(eq(identities.contactId, contactId));
    },

    async getContact(id: string) {
      const [row] = await db.select().from(contacts).where(eq(contacts.id, id));
      return row ?? null;
    },

    async updateContact(
      id: string,
      patch: Partial<typeof contacts.$inferInsert>
    ) {
      const [row] = await db
        .update(contacts)
        .set(patch)
        .where(eq(contacts.id, id))
        .returning();
      return row ?? null;
    },

    async listContacts(filter: {
      query?: string;
      leadStage?: string;
      companyId?: string;
      limit?: number;
    }) {
      const q = filter.query?.trim();
      return db
        .select({
          ...getTableColumns(contacts),
          conversationCount: sql<number>`(SELECT count(*)::int FROM helpdesk.conversation c WHERE c.contact_id = "contact"."id")`,
          lastMessageAt: sql<
            string | null
          >`(SELECT max(c.last_message_at) FROM helpdesk.conversation c WHERE c.contact_id = "contact"."id")`,
          isTeam: sql<boolean>`EXISTS (SELECT 1 FROM helpdesk.agent a WHERE lower(a.email) = lower("contact"."email"))`,
          firstContext: sql<ConversationContext | null>`(SELECT c.context FROM helpdesk.conversation c WHERE c.contact_id = "contact"."id" ORDER BY c.created_at LIMIT 1)`,
        })
        .from(contacts)
        .where(
          and(
            q
              ? or(
                  ilike(contacts.name, `%${escapeLike(q)}%`),
                  ilike(contacts.email, `%${escapeLike(q)}%`)
                )
              : undefined,
            filter.leadStage
              ? eq(contacts.leadStage, filter.leadStage)
              : undefined,
            filter.companyId
              ? eq(contacts.companyId, filter.companyId)
              : undefined
          )
        )
        .orderBy(
          sql`(SELECT max(c.last_message_at) FROM helpdesk.conversation c WHERE c.contact_id = "contact"."id") DESC NULLS LAST`,
          desc(contacts.createdAt)
        )
        .limit(filter.limit ?? 100);
    },

    async removeIdentities(contactId: string, channel: schema.IdentityChannel) {
      await db
        .delete(identities)
        .where(
          and(
            eq(identities.contactId, contactId),
            eq(identities.channel, channel)
          )
        );
    },

    /** Moves everything `sourceId` owns onto `targetId`, then deletes the source. */
    async mergeContacts(targetId: string, sourceId: string) {
      if (targetId === sourceId) return;
      await db.transaction(async tx => {
        await tx
          .update(conversations)
          .set({ contactId: targetId })
          .where(eq(conversations.contactId, sourceId));
        await tx
          .update(messages)
          .set({ contactId: targetId })
          .where(eq(messages.contactId, sourceId));
        await tx
          .update(activities)
          .set({ contactId: targetId })
          .where(eq(activities.contactId, sourceId));
        await tx
          .update(deals)
          .set({ contactId: targetId })
          .where(eq(deals.contactId, sourceId));
        await tx.execute(sql`
          INSERT INTO helpdesk.participant (conversation_id, contact_id)
          SELECT conversation_id, ${targetId}::uuid FROM helpdesk.participant
          WHERE contact_id = ${sourceId}::uuid
          ON CONFLICT DO NOTHING`);
        await tx.execute(sql`
          UPDATE helpdesk.conversation_event
          SET data = jsonb_set(data, '{contactId}', to_jsonb(${targetId}::text))
          WHERE kind = 'participant.added' AND data->>'contactId' = ${sourceId}`);
        // Identities move rather than copy: a copied verified row would collide
        // with its own original and be skipped. No visitor token survives a
        // merge on either side: it proves nothing about the merged person.
        await tx.execute(sql`
          DELETE FROM helpdesk.identity
          WHERE contact_id IN (${sourceId}::uuid, ${targetId}::uuid)
            AND channel = 'visitor'`);
        const shared = await tx.execute<{
          channel: string;
          external_id: string;
        }>(sql`
          DELETE FROM helpdesk.identity s
          WHERE s.contact_id = ${sourceId}::uuid AND EXISTS (
            SELECT 1 FROM helpdesk.identity t
            WHERE t.contact_id = ${targetId}::uuid
              AND t.channel = s.channel AND t.external_id = s.external_id)
          RETURNING channel, external_id, verified`);
        for (const row of shared.rows as {
          channel: string;
          external_id: string;
          verified: boolean;
        }[]) {
          if (!row.verified) continue;
          await tx.execute(sql`
            UPDATE helpdesk.identity SET verified = true
            WHERE contact_id = ${targetId}::uuid
              AND channel = ${row.channel} AND external_id = ${row.external_id}`);
        }
        await tx.execute(sql`
          UPDATE helpdesk.identity SET contact_id = ${targetId}::uuid
          WHERE contact_id = ${sourceId}::uuid`);
        const [source] = await tx
          .select()
          .from(contacts)
          .where(eq(contacts.id, sourceId));
        await tx.delete(contacts).where(eq(contacts.id, sourceId));
        if (source) {
          await tx
            .update(contacts)
            .set({
              email: sql`coalesce(${contacts.email}, ${source.email})`,
              name: sql`coalesce(${contacts.name}, ${source.name})`,
              companyId: sql`coalesce(${contacts.companyId}, ${source.companyId}::uuid)`,
            })
            .where(eq(contacts.id, targetId));
        }
      });
    },

    /** Without a resolved name, a new company is named by its id and a known one keeps its name. */
    async upsertCompany(
      externalOrgId: string,
      name: string | null
    ): Promise<Company> {
      return first(
        await db
          .insert(companies)
          .values({ externalOrgId, name: name ?? externalOrgId })
          .onConflictDoUpdate({
            target: companies.externalOrgId,
            set: { name: name ?? sql`${companies.name}` },
          })
          .returning()
      );
    },

    async createCompany(values: typeof companies.$inferInsert) {
      return first(await db.insert(companies).values(values).returning());
    },

    async companiesByExternalOrgIds(ids: string[]): Promise<Company[]> {
      if (ids.length === 0) return [];
      return db
        .select()
        .from(companies)
        .where(inArray(companies.externalOrgId, ids));
    },

    async getCompany(id: string) {
      const [row] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, id));
      return row ?? null;
    },

    async findCompanyByDomain(domain: string) {
      const [row] = await db
        .select()
        .from(companies)
        .where(eq(companies.domain, domain))
        .limit(1);
      return row ?? null;
    },

    async updateCompany(
      id: string,
      patch: Partial<typeof companies.$inferInsert>
    ) {
      const [row] = await db
        .update(companies)
        .set(patch)
        .where(eq(companies.id, id))
        .returning();
      return row ?? null;
    },

    async listCompanies(filter: {
      query?: string;
      leadStage?: string;
      limit?: number;
    }) {
      const q = filter.query?.trim();
      return db
        .select()
        .from(companies)
        .where(
          and(
            q
              ? or(
                  ilike(companies.name, `%${escapeLike(q)}%`),
                  ilike(companies.domain, `%${escapeLike(q)}%`)
                )
              : undefined,
            filter.leadStage
              ? eq(companies.leadStage, filter.leadStage)
              : undefined
          )
        )
        .orderBy(asc(companies.name))
        .limit(filter.limit ?? 100);
    },

    async touchAgent(user: {
      externalUserId: string;
      name?: string | null;
      email?: string | null;
      avatarUrl?: string | null;
    }): Promise<Agent> {
      const row = first(
        await db
          .insert(agents)
          .values({
            externalUserId: user.externalUserId,
            name: user.name ?? null,
            email: user.email ?? null,
            avatarUrl: user.avatarUrl ?? null,
          })
          .onConflictDoUpdate({
            target: agents.externalUserId,
            set: {
              name: user.name ?? null,
              email: user.email ?? null,
              avatarUrl: user.avatarUrl ?? null,
              lastSeenAt: sql`now()`,
              deactivatedAt: null,
            },
          })
          .returning()
      );
      return row;
    },

    async listAgents() {
      return db
        .select()
        .from(agents)
        .where(isNull(agents.deactivatedAt))
        .orderBy(asc(agents.name));
    },

    /** Agents still mailed: not removed, and in the agent UI within `idleDays`. */
    async mailableAgents(idleDays: number) {
      return db
        .select()
        .from(agents)
        .where(
          and(
            isNull(agents.deactivatedAt),
            gt(
              agents.lastSeenAt,
              sql`now() - make_interval(days => ${idleDays})`
            )
          )
        )
        .orderBy(asc(agents.name));
    },

    /** Deactivates the agent and hands their conversations back to the team. */
    async deactivateAgent(externalUserId: string) {
      await db.transaction(async tx => {
        const removed = await tx
          .update(agents)
          .set({ deactivatedAt: sql`now()` })
          .where(
            and(
              eq(agents.externalUserId, externalUserId),
              isNull(agents.deactivatedAt)
            )
          )
          .returning({ id: agents.id });
        const [agent] = removed;
        if (!agent) return;
        const unassigned = await tx
          .update(conversations)
          .set({ assigneeId: null })
          .where(eq(conversations.assigneeId, agent.id))
          .returning({ id: conversations.id });
        if (unassigned.length === 0) return;
        await tx.insert(conversationEvents).values(
          unassigned.map(c => ({
            conversationId: c.id,
            kind: 'assigneeId',
            data: { from: agent.id, to: null },
          }))
        );
      });
    },

    async getSetting<T>(key: string): Promise<T | null> {
      const [row] = await db
        .select({ value: settings.value })
        .from(settings)
        .where(eq(settings.key, key));
      return (row?.value as T | undefined) ?? null;
    },

    async setSetting(key: string, value: unknown) {
      await db
        .insert(settings)
        .values({ key, value })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value, updatedAt: sql`now()` },
        });
    },

    async setAgentAway(id: string, awayUntil: Date | null) {
      await db.update(agents).set({ awayUntil }).where(eq(agents.id, id));
    },

    async getAgent(id: string) {
      const [row] = await db.select().from(agents).where(eq(agents.id, id));
      return row ?? null;
    },

    async getActiveAgent(id: string) {
      const [row] = await db
        .select()
        .from(agents)
        .where(and(eq(agents.id, id), isNull(agents.deactivatedAt)));
      return row ?? null;
    },

    async createConversation(
      values: Omit<typeof conversations.$inferInsert, 'number'>,
      firstMessage: {
        body: string;
        contactId: string;
        verified: boolean;
        emailMessageId?: string;
      }
    ): Promise<{ conversation: Conversation; message: Message }> {
      return db.transaction(async tx => {
        const conversation = first(
          await tx
            .insert(conversations)
            .values({ ...values, waitingSince: sql`now()` })
            .returning()
        );
        const message = first(
          await tx
            .insert(messages)
            .values({
              conversationId: conversation.id,
              authorType: 'contact',
              contactId: firstMessage.contactId,
              body: firstMessage.body,
              verified: firstMessage.verified,
              emailMessageId: firstMessage.emailMessageId ?? null,
            })
            .returning()
        );
        return { conversation, message };
      });
    },

    async getConversation(id: string) {
      const [row] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, id));
      return row ?? null;
    },

    async getConversationByNumber(number: number) {
      const [row] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.number, number));
      return row ?? null;
    },

    async isParticipant(conversationId: string, contactId: string) {
      const [row] = await db
        .select()
        .from(participants)
        .where(
          and(
            eq(participants.conversationId, conversationId),
            eq(participants.contactId, contactId)
          )
        );
      return Boolean(row);
    },

    /** True when the contact was not a participant before. */
    async addParticipant(conversationId: string, contactId: string) {
      const added = await db
        .insert(participants)
        .values({ conversationId, contactId })
        .onConflictDoNothing()
        .returning({ contactId: participants.contactId });
      return added.length > 0;
    },

    async recordEvents(values: (typeof conversationEvents.$inferInsert)[]) {
      if (values.length === 0) return;
      await db.insert(conversationEvents).values(values);
    },

    async listEvents(conversationId: string) {
      return db
        .select({
          id: conversationEvents.id,
          kind: conversationEvents.kind,
          data: conversationEvents.data,
          agentId: conversationEvents.agentId,
          agentName: agents.name,
          createdAt: conversationEvents.createdAt,
        })
        .from(conversationEvents)
        .leftJoin(agents, eq(agents.id, conversationEvents.agentId))
        .where(eq(conversationEvents.conversationId, conversationId))
        .orderBy(
          asc(conversationEvents.createdAt),
          asc(conversationEvents.kind)
        );
    },

    async listParticipants(conversationId: string) {
      return db
        .select({ contact: contacts })
        .from(participants)
        .innerJoin(contacts, eq(contacts.id, participants.contactId))
        .where(eq(participants.conversationId, conversationId));
    },

    /** Conversations a customer may see: their own, ones they were added to, ones shared with their companies. */
    async listCustomerConversations(
      contactId: string | null,
      companyIds: string[]
    ) {
      if (!contactId && companyIds.length === 0) return [];
      const shared =
        companyIds.length > 0
          ? and(
              eq(conversations.sharedWithCompany, true),
              inArray(conversations.companyId, companyIds)
            )
          : undefined;
      return db
        .select()
        .from(conversations)
        .where(
          or(
            contactId ? eq(conversations.contactId, contactId) : undefined,
            contactId
              ? sql`${conversations.id} IN (SELECT conversation_id FROM helpdesk.participant WHERE contact_id = ${contactId}::uuid)`
              : undefined,
            shared
          )
        )
        .orderBy(desc(conversations.lastMessageAt))
        .limit(100);
    },

    async listInbox(filter: InboxFilter) {
      const q = filter.query?.trim();
      const conditions: (SQL | undefined)[] = [
        filter.inbox ? eq(conversations.inbox, filter.inbox) : undefined,
        filter.status === 'snoozed'
          ? and(
              eq(conversations.status, 'pending'),
              isNotNull(conversations.snoozedUntil)
            )
          : filter.status
            ? eq(conversations.status, filter.status)
            : undefined,
        filter.assigneeId === null
          ? isNull(conversations.assigneeId)
          : filter.assigneeId
            ? eq(conversations.assigneeId, filter.assigneeId)
            : undefined,
        filter.contactId
          ? eq(conversations.contactId, filter.contactId)
          : undefined,
        filter.companyId
          ? eq(conversations.companyId, filter.companyId)
          : undefined,
        filter.tag
          ? arrayContains(conversations.tags, [filter.tag])
          : undefined,
      ];
      if (q) {
        const number = Number(q.replace(/^\D+-/, ''));
        conditions.push(
          or(
            sql`${conversations.search} @@ websearch_to_tsquery('simple', ${q})`,
            sql`${conversations.id} IN (SELECT conversation_id FROM helpdesk.message WHERE search @@ websearch_to_tsquery('simple', ${q}))`,
            // `number` is an int4; a longer digit run is text, not a reference.
            Number.isSafeInteger(number) && number <= 2_147_483_647
              ? eq(conversations.number, number)
              : undefined
          )
        );
      }
      return db
        .select({ conversation: conversations, contact: contacts })
        .from(conversations)
        .innerJoin(contacts, eq(contacts.id, conversations.contactId))
        .where(and(...conditions))
        .orderBy(
          ...(filter.sort === 'priority'
            ? [
                sql`array_position(ARRAY[${sql.join(
                  [...PRIORITIES].reverse().map(p => sql`${p}`),
                  sql`, `
                )}]::text[], ${conversations.priority})`,
              ]
            : []),
          sql`${conversations.waitingSince} ASC NULLS LAST`,
          desc(conversations.lastMessageAt)
        )
        .limit(filter.limit ?? 200);
    },

    /** The newest public message of each conversation, for list previews. */
    async lastMessages(conversationIds: string[]) {
      if (conversationIds.length === 0) return new Map<string, Message>();
      const rows = await db
        .selectDistinctOn([messages.conversationId])
        .from(messages)
        .where(
          and(
            inArray(messages.conversationId, conversationIds),
            eq(messages.internal, false)
          )
        )
        .orderBy(messages.conversationId, desc(messages.createdAt));
      return new Map(rows.map(r => [r.conversationId, r]));
    },

    async markViewing(agentId: string, conversationId: string) {
      await db
        .update(agents)
        .set({ viewingId: conversationId, viewingAt: sql`now()` })
        .where(eq(agents.id, agentId));
    },

    /** Other agents with each conversation open, keyed by conversation id. */
    async viewers(conversationIds: string[], exceptAgentId: string) {
      const byConversation = new Map<string, { id: string; name: string }[]>();
      if (conversationIds.length === 0) return byConversation;
      const rows = await db
        .select({
          id: agents.id,
          name: sql<string>`coalesce(${agents.name}, ${agents.email})`,
          viewingId: agents.viewingId,
        })
        .from(agents)
        .where(
          and(
            inArray(agents.viewingId, conversationIds),
            // Sized against the conversation view's 5-second poll; change the two together.
            gt(agents.viewingAt, sql`now() - interval '15 seconds'`),
            ne(agents.id, exceptAgentId),
            isNull(agents.deactivatedAt)
          )
        )
        .orderBy(sql`coalesce(${agents.name}, ${agents.email})`);
      for (const { viewingId, ...agent } of rows) {
        if (!viewingId) continue;
        byConversation.set(viewingId, [
          ...(byConversation.get(viewingId) ?? []),
          agent,
        ]);
      }
      return byConversation;
    },

    async recentAgents(limit: number) {
      return db
        .select({
          name: agents.name,
          email: agents.email,
          avatarUrl: agents.avatarUrl,
          awayUntil: agents.awayUntil,
        })
        .from(agents)
        .where(
          and(
            gt(agents.lastSeenAt, sql`now() - interval '30 days'`),
            isNull(agents.deactivatedAt)
          )
        )
        .orderBy(desc(agents.lastSeenAt))
        .limit(limit);
    },

    // Counts over every conversation; window it on last_message_at if that slows the inbox.
    async topTags() {
      const result = await db.execute<{ tag: string }>(
        sql`SELECT tag FROM ${conversations}, unnest(${conversations.tags}) AS tag GROUP BY tag ORDER BY count(*) DESC, tag LIMIT 15`
      );
      return result.rows.map(r => r.tag);
    },

    // Copies `last_message_at`, not `now()`: `now()` is the transaction start, so a
    // customer message committing concurrently could predate it and never read as unread.
    async markAgentSeen(id: string) {
      await db
        .update(conversations)
        .set({ agentSeenAt: sql`${conversations.lastMessageAt}` })
        .where(
          and(
            eq(conversations.id, id),
            or(
              isNull(conversations.agentSeenAt),
              lt(conversations.agentSeenAt, conversations.lastMessageAt)
            )
          )
        );
    },

    async countOpen(agentId: string) {
      const [row] = await db
        .select({
          all: sql<number>`count(*)::int`,
          mine: sql<number>`(count(*) FILTER (WHERE ${conversations.assigneeId} = ${agentId}))::int`,
          unassigned: sql<number>`(count(*) FILTER (WHERE ${conversations.assigneeId} IS NULL))::int`,
        })
        .from(conversations)
        .where(eq(conversations.status, 'open'));
      return row ?? { all: 0, mine: 0, unassigned: 0 };
    },

    async countWaiting() {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(conversations)
        .where(
          and(
            isNotNull(conversations.waitingSince),
            ne(conversations.status, 'resolved'),
            isNull(conversations.snoozedUntil)
          )
        );
      return row?.count ?? 0;
    },

    /** With `unlessResolved`, a thread already resolved is left alone and the result is null. */
    async updateConversation(
      id: string,
      patch: Partial<typeof conversations.$inferInsert>,
      { unlessResolved = false } = {}
    ) {
      const [row] = await db
        .update(conversations)
        .set(patch)
        .where(
          and(
            eq(conversations.id, id),
            unlessResolved ? ne(conversations.status, 'resolved') : undefined
          )
        )
        .returning();
      return row ?? null;
    },

    /**
     * Updates each conversation with the patch `plan` makes from it, locked and
     * in one transaction: all of them, or none when an id is missing or `plan` throws.
     * `plan` is synchronous so it cannot wait on the pool while holding a connection.
     */
    async updateConversations(
      ids: string[],
      plan: (
        conversation: Conversation
      ) => Partial<typeof conversations.$inferInsert>
    ) {
      return db.transaction(async tx => {
        // Locked in id order, so overlapping batches cannot deadlock each other.
        const rows = await tx
          .select()
          .from(conversations)
          .where(inArray(conversations.id, ids))
          .orderBy(conversations.id)
          .for('update');
        const missing = ids.filter(id => !rows.some(r => r.id === id));
        if (missing.length > 0) return { missing, changes: [] };
        const changes = [];
        for (const before of rows) {
          const patch = plan(before);
          const [updated] = await tx
            .update(conversations)
            .set(patch)
            .where(eq(conversations.id, before.id))
            .returning();
          changes.push({ before, patch, updated: updated ?? null });
        }
        return { missing, changes };
      });
    },

    /** Changes sharing only while the thread is still with `companyId`. */
    async setSharing(id: string, companyId: string, shared: boolean) {
      const [row] = await db
        .update(conversations)
        .set({ sharedWithCompany: shared })
        .where(
          and(eq(conversations.id, id), eq(conversations.companyId, companyId))
        )
        .returning({ id: conversations.id });
      return Boolean(row);
    },

    /**
     * A customer message reopens a resolved thread and starts the waiting
     * clock; a public agent reply stops it.
     */
    async appendMessage(
      values: typeof messages.$inferInsert
    ): Promise<Message> {
      return db.transaction(async tx => {
        const message = first(
          await tx.insert(messages).values(values).returning()
        );
        // A note is not a message to the customer: it must not mark their
        // thread unread or lift it in their list.
        const patch: Partial<typeof conversations.$inferInsert> =
          values.internal
            ? {}
            : { lastMessageAt: sql`now()` as unknown as Date };
        if (values.authorType === 'contact') {
          patch.waitingSince =
            sql`coalesce(${conversations.waitingSince}, now())` as unknown as Date;
          patch.status = 'open';
          patch.snoozedUntil = null;
          patch.resolvedAt =
            sql`CASE WHEN ${conversations.status} = 'resolved' THEN NULL ELSE ${conversations.resolvedAt} END` as unknown as Date;
        } else if (values.authorType === 'agent' && !values.internal) {
          patch.waitingSince = null;
          patch.remindedAt = null;
          patch.status =
            sql`CASE WHEN ${conversations.status} = 'resolved' THEN 'resolved' ELSE 'pending' END` as unknown as string;
        }
        if (Object.keys(patch).length > 0) {
          await tx
            .update(conversations)
            .set(patch)
            .where(eq(conversations.id, values.conversationId));
        }
        return message;
      });
    },

    async getMessage(id: string) {
      const [row] = await db.select().from(messages).where(eq(messages.id, id));
      return row ?? null;
    },

    async findMessageByEmailId(emailMessageIds: string[]) {
      if (emailMessageIds.length === 0) return null;
      const [row] = await db
        .select()
        .from(messages)
        .where(inArray(messages.emailMessageId, emailMessageIds))
        .limit(1);
      return row ?? null;
    },

    async listMessages(
      conversationId: string,
      { includeInternal }: { includeInternal: boolean }
    ) {
      return db
        .select({
          message: messages,
          agentName: agents.name,
          contactName: contacts.name,
        })
        .from(messages)
        .leftJoin(agents, eq(agents.id, messages.agentId))
        .leftJoin(contacts, eq(contacts.id, messages.contactId))
        .where(
          and(
            eq(messages.conversationId, conversationId),
            includeInternal ? undefined : eq(messages.internal, false)
          )
        )
        .orderBy(asc(messages.createdAt));
    },

    async createAttachment(values: typeof attachments.$inferInsert) {
      return first(await db.insert(attachments).values(values).returning());
    },

    async countAttachments(conversationId: string) {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(attachments)
        .where(eq(attachments.conversationId, conversationId));
      return row?.count ?? 0;
    },

    async getAttachment(id: string) {
      const [row] = await db
        .select()
        .from(attachments)
        .where(eq(attachments.id, id));
      return row ?? null;
    },

    async updateAttachment(
      id: string,
      patch: Partial<typeof attachments.$inferInsert>
    ) {
      const [row] = await db
        .update(attachments)
        .set(patch)
        .where(eq(attachments.id, id))
        .returning();
      return row ?? null;
    },

    async listAttachments(conversationId: string) {
      return db
        .select()
        .from(attachments)
        .where(
          and(
            eq(attachments.conversationId, conversationId),
            eq(attachments.uploaded, true)
          )
        )
        .orderBy(asc(attachments.createdAt));
    },

    async listCannedReplies() {
      return db.select().from(cannedReplies).orderBy(asc(cannedReplies.title));
    },

    async createCannedReply(values: {
      title: string;
      body: string;
      locale?: string | null;
    }) {
      return first(await db.insert(cannedReplies).values(values).returning());
    },

    async deleteCannedReply(id: string) {
      await db.delete(cannedReplies).where(eq(cannedReplies.id, id));
    },

    async listDeals(filter: { companyId?: string; contactId?: string }) {
      return db
        .select({
          deal: deals,
          companyName: companies.name,
          contactName: sql<
            string | null
          >`coalesce(${contacts.name}, ${contacts.email})`,
        })
        .from(deals)
        .leftJoin(companies, eq(companies.id, deals.companyId))
        .leftJoin(contacts, eq(contacts.id, deals.contactId))
        .where(
          and(
            filter.companyId
              ? eq(deals.companyId, filter.companyId)
              : undefined,
            filter.contactId ? eq(deals.contactId, filter.contactId) : undefined
          )
        )
        .orderBy(desc(deals.createdAt))
        .limit(500);
    },

    async createDeal(values: typeof deals.$inferInsert) {
      return first(await db.insert(deals).values(values).returning());
    },

    async updateDeal(id: string, patch: Partial<typeof deals.$inferInsert>) {
      const [row] = await db
        .update(deals)
        .set(patch)
        .where(eq(deals.id, id))
        .returning();
      return row ?? null;
    },

    async getDeal(id: string) {
      const [row] = await db.select().from(deals).where(eq(deals.id, id));
      return row ?? null;
    },

    async deleteDeal(id: string) {
      await db.delete(deals).where(eq(deals.id, id));
    },

    async createActivity(values: typeof activities.$inferInsert) {
      return first(await db.insert(activities).values(values).returning());
    },

    async listActivities(filter: {
      contactId?: string;
      companyId?: string;
      dealId?: string;
    }) {
      return db
        .select({ activity: activities, agentName: agents.name })
        .from(activities)
        .leftJoin(agents, eq(agents.id, activities.agentId))
        .where(
          or(
            filter.contactId
              ? eq(activities.contactId, filter.contactId)
              : undefined,
            filter.companyId
              ? eq(activities.companyId, filter.companyId)
              : undefined,
            filter.dealId ? eq(activities.dealId, filter.dealId) : undefined
          )
        )
        .orderBy(desc(activities.occurredAt))
        .limit(200);
    },

    async enqueueJob(
      kind: string,
      payload: Record<string, unknown>,
      opts: { runAt?: Date } = {}
    ) {
      await db.insert(jobs).values({
        kind,
        payload,
        // The database clock decides what is due; the app's may run ahead.
        runAt: opts.runAt ?? (sql`now()` as unknown as Date),
      });
    },

    /** Claims due jobs; a claim expires, so a crashed run's jobs come back. */
    async claimJobs(limit: number): Promise<Job[]> {
      const result = await db.execute<Record<string, unknown>>(sql`
        UPDATE helpdesk.job SET locked_until = now() + interval '2 minutes', attempts = attempts + 1
        WHERE id IN (
          SELECT id FROM helpdesk.job
          WHERE run_at <= now() AND (locked_until IS NULL OR locked_until < now())
          ORDER BY run_at
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, kind, payload, attempts`);
      return result.rows.map(r => ({
        id: r.id as string,
        kind: r.kind as string,
        payload: r.payload as Record<string, unknown>,
        attempts: r.attempts as number,
      })) as Job[];
    },

    async completeJob(id: string) {
      await db.delete(jobs).where(eq(jobs.id, id));
    },

    async failJob(job: Pick<Job, 'id' | 'attempts'>, error: string) {
      const dead = job.attempts >= MAX_ATTEMPTS;
      await db
        .update(jobs)
        .set({
          lockedUntil: null,
          lastError: error.slice(0, 2000),
          runAt: dead
            ? sql`'infinity'::timestamptz`
            : sql`now() + make_interval(mins => ${2 ** job.attempts})`,
        })
        .where(eq(jobs.id, job.id));
    },

    /** Counts one hit; returns the total in the current hour for `key`. */
    async hitRateLimit(key: string): Promise<number> {
      const result = await db.execute<{ count: number }>(sql`
        INSERT INTO helpdesk.rate_limit (key, window_start, count)
        VALUES (${key}, date_trunc('hour', now()), 1)
        ON CONFLICT (key, window_start) DO UPDATE SET count = helpdesk.rate_limit.count + 1
        RETURNING count`);
      await db
        .delete(rateLimits)
        .where(lt(rateLimits.windowStart, sql`now() - interval '1 day'`));
      return Number(result.rows[0]?.count ?? 0);
    },

    /**
     * Reopens due snoozes and returns them with their values before; a stale
     * time on any other status is only cleared. Concurrent runs never wake a row twice.
     */
    async wakeSnoozed() {
      const result = await db.execute<{
        id: string;
        was_until: Date | string;
      }>(sql`
        WITH due AS (
          SELECT id, status, snoozed_until FROM helpdesk.conversation
          WHERE snoozed_until <= now()
          FOR UPDATE SKIP LOCKED
        ), cleared AS (
          UPDATE helpdesk.conversation c
          SET snoozed_until = NULL,
            status = CASE WHEN due.status = 'pending' THEN 'open' ELSE c.status END
          FROM due WHERE c.id = due.id
          RETURNING c.id, due.status AS was_status, due.snoozed_until AS was_until
        )
        SELECT id, was_until FROM cleared WHERE was_status = 'pending'`);
      if (result.rows.length === 0) return [];
      const until = new Map(
        result.rows.map(r => [r.id, new Date(r.was_until)])
      );
      const rows = await db
        .select()
        .from(conversations)
        .where(inArray(conversations.id, [...until.keys()]));
      return rows.map(row => ({
        row,
        before: { status: 'pending', snoozedUntil: until.get(row.id) ?? null },
      }));
    },

    /**
     * Marks due reminders as sent and returns them; concurrent runs never double-send.
     * With `cutoff`, due means waiting since then or earlier instead of `afterHours` ago.
     */
    async claimReminders(inbox: string, afterHours: number, cutoff?: Date) {
      const result = await db.execute<{ id: string }>(sql`
        UPDATE helpdesk.conversation SET reminded_at = now()
        WHERE inbox = ${inbox}
          AND status <> 'resolved'
          AND snoozed_until IS NULL
          AND waiting_since IS NOT NULL
          AND ${
            cutoff
              ? sql`waiting_since <= ${cutoff.toISOString()}`
              : sql`waiting_since < now() - make_interval(hours => ${afterHours})`
          }
          AND (reminded_at IS NULL OR reminded_at < waiting_since)
        RETURNING id`);
      const ids = result.rows.map(r => r.id);
      if (ids.length === 0) return [];
      return db
        .select()
        .from(conversations)
        .where(inArray(conversations.id, ids));
    },

    /** Storage keys of everything the given conversations hold. */
    async attachmentKeys(conversationIds: string[]) {
      if (conversationIds.length === 0) return [];
      const rows = await db
        .select({ key: attachments.key })
        .from(attachments)
        .where(inArray(attachments.conversationId, conversationIds));
      return rows.map(r => r.key);
    },

    async conversationIdsWhere(where: SQL | undefined) {
      const rows = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(where);
      return rows.map(r => r.id);
    },

    async deleteConversations(ids: string[]) {
      if (ids.length === 0) return;
      await db.delete(conversations).where(inArray(conversations.id, ids));
    },

    async deleteContactsWhere(where: SQL | undefined) {
      await db.delete(contacts).where(where);
    },

    /** Contacts of the company that `deleteCompany` will drop: those without a conversation of their own. */
    async contactsLeftWithNothing(companyId: string) {
      const rows = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(
          and(
            eq(contacts.companyId, companyId),
            sql`NOT EXISTS (SELECT 1 FROM helpdesk.conversation c WHERE c.contact_id = ${contacts.id})`
          )
        );
      return rows.map(r => r.id);
    },

    /** Drops a company, the given contacts, and the link from the rest. */
    async deleteCompany(id: string, contactIds: string[]) {
      await db.transaction(async tx => {
        if (contactIds.length > 0) {
          // One may have opened a conversation since; that one stays.
          await tx
            .delete(contacts)
            .where(
              and(
                inArray(contacts.id, contactIds),
                sql`NOT EXISTS (SELECT 1 FROM helpdesk.conversation c WHERE c.contact_id = ${contacts.id})`
              )
            );
        }
        await tx
          .update(contacts)
          .set({ companyId: null })
          .where(eq(contacts.companyId, id));
        await tx.delete(companies).where(eq(companies.id, id));
      });
    },

    async attachmentKeysBy(contactId: string) {
      const rows = await db
        .select({ key: attachments.key })
        .from(attachments)
        .where(
          inArray(
            attachments.messageId,
            db
              .select({ id: messages.id })
              .from(messages)
              .where(eq(messages.contactId, contactId))
          )
        );
      return rows.map(r => r.key);
    },

    /** Whether the contact wrote anything nobody proved was theirs. */
    async hasUnverifiedMessages(contactId: string) {
      const [row] = await db
        .select({ id: messages.id })
        .from(messages)
        .where(
          and(
            eq(messages.contactId, contactId),
            // Written before this was recorded: proven if the contact is.
            sql`(${messages.verified} IS FALSE OR (${messages.verified} IS NULL AND NOT EXISTS (SELECT 1 FROM helpdesk.identity i WHERE i.contact_id = ${contactId}::uuid AND i.verified)))`
          )
        )
        .limit(1);
      return Boolean(row);
    },

    async deleteMessagesBy(contactId: string) {
      await db.delete(messages).where(eq(messages.contactId, contactId));
    },

    async findDuplicateCandidates(conversation: Conversation, text: string) {
      const words = [
        ...new Set(
          text
            .toLowerCase()
            .split(/[^\p{L}\p{N}]+/u)
            .filter(w => w.length > 3)
        ),
      ].slice(0, 12);
      if (words.length === 0) return [];
      const orQuery = words.join(' | ');
      const result = await db.execute<{
        id: string;
        number: number;
        subject: string | null;
        title: string | null;
        rank: number;
      }>(sql`
        SELECT c.id, c.number, c.subject, c.title,
          max(ts_rank(m.search, q)) AS rank
        FROM helpdesk.conversation c
        JOIN helpdesk.message m ON m.conversation_id = c.id AND NOT m.internal,
          to_tsquery('simple', ${orQuery}) q
        WHERE c.id <> ${conversation.id}::uuid
          AND (m.search @@ q OR c.search @@ q)
        GROUP BY c.id
        ORDER BY rank DESC
        LIMIT 5`);
      return result.rows;
    },
  };
  return store;
}

function first<T>(rows: T[]): T {
  const row = rows[0];
  if (row === undefined) throw new Error('Expected a returned row');
  return row;
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, m => `\\${m}`);
}

export { schema };
