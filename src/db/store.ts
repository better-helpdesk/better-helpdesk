import { createHash } from 'node:crypto';

import { PRIORITIES } from '../config';
import { clock, type DatabaseAdapter, type Where } from './adapter';
import {
  type ConversationContext,
  helpdeskModel,
  type IdentityChannel,
  type Insert,
  type ModelName,
  type Row,
} from './model';

export type Contact = Row<'contact'> & { tags: string[] };
export type Company = Row<'company'> & { tags: string[] };
export type Conversation = Row<'conversation'> & { tags: string[] };
export type Agent = Row<'agent'>;
export type Message = Row<'message'>;
export type Attachment = Row<'attachment'>;
export type Deal = Row<'deal'>;
export type Activity = Row<'activity'>;
export type Job = Row<'job'>;
export type ConversationEvent = Row<'conversation_event'>;
export type IdentityInput = {
  channel: IdentityChannel;
  externalId: string;
  verified: boolean;
};
type Tagged<M extends 'contact' | 'company' | 'conversation'> = Insert<M> & {
  tags?: string[];
};

export type InboxFilter = {
  inbox?: string;
  status?: string;
  assigneeId?: string | null;
  contactId?: string;
  companyId?: string;
  tag?: string;
  query?: string;
  /** `high` keeps high and urgent conversations only. */
  priority?: 'high';
  /** Longest waiting first by default; `priority` puts urgent and high on top. */
  sort?: 'waiting' | 'priority';
  limit?: number;
};

const MAX_ATTEMPTS = 5;
/** When a job that failed for good would run: never. */
const NEVER = new Date('9999-12-31T00:00:00Z');
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms);
/** Long `in` lists go in pieces; SQL Server takes about 2000 parameters per query. */
const CHUNK = 500;

const eq = (field: string, value: unknown): Where => ({ field, value });
const ne = (field: string, value: unknown): Where => ({
  field,
  op: 'ne',
  value,
});
const lt = (field: string, value: unknown): Where => ({
  field,
  op: 'lt',
  value,
});
const lte = (field: string, value: unknown): Where => ({
  field,
  op: 'lte',
  value,
});
const gt = (field: string, value: unknown): Where => ({
  field,
  op: 'gt',
  value,
});
const gte = (field: string, value: unknown): Where => ({
  field,
  op: 'gte',
  value,
});
const oneOf = (field: string, value: unknown[]): Where => ({
  field,
  op: 'in',
  value,
});
const contains = (field: string, value: string): Where => ({
  field,
  op: 'contains',
  value,
  insensitive: true,
});
const and = (...parts: (Where | false | undefined | null | '')[]): Where => ({
  and: parts.filter((p): p is Where => Boolean(p)),
});
const or = (...parts: (Where | false | undefined | null | '')[]): Where => ({
  or: parts.filter((p): p is Where => Boolean(p)),
});
const inSelect = (
  field: string,
  model: ModelName,
  selectField: string,
  where?: Where
): Where => ({
  field,
  op: 'in',
  select: { model, field: selectField, where },
});
const notInSelect = (
  field: string,
  model: ModelName,
  selectField: string,
  where?: Where
): Where => ({
  field,
  op: 'notIn',
  select: { model, field: selectField, where },
});
/**
 * The same instant as a time read back from the row. A database may keep
 * microseconds that a `Date` drops, so equality is a one-millisecond range.
 */
const at = (field: string, value: Date | null): Where =>
  value === null
    ? eq(field, null)
    : and(gte(field, value), lt(field, new Date(value.getTime() + 1)));

const notBlocked = notInSelect(
  'contactId',
  'contact',
  'id',
  eq('blocked', true)
);

const TAGS = {
  conversation: ['conversation_tag', 'conversationId'],
  contact: ['contact_tag', 'contactId'],
  company: ['company_tag', 'companyId'],
} as const;
type TaggedModel = keyof typeof TAGS;

function chunks<T>(items: T[]) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) {
    out.push(items.slice(i, i + CHUNK));
  }
  return out;
}

/** For each model, the fields elsewhere that point at it, and what a delete does to them. */
const REFERENCES = new Map<
  ModelName,
  { model: ModelName; field: string; onDelete: 'cascade' | 'set null' }[]
>();
for (const [model, table] of Object.entries(helpdeskModel)) {
  for (const [field, spec] of Object.entries(
    table.fields as Record<
      string,
      { references?: { model: string; onDelete: 'cascade' | 'set null' } }
    >
  )) {
    if (!spec.references) continue;
    const target = spec.references.model as ModelName;
    REFERENCES.set(target, [
      ...(REFERENCES.get(target) ?? []),
      { model: model as ModelName, field, onDelete: spec.references.onDelete },
    ]);
  }
}

function latest<T extends Date | null>(a: T, b: Date | null): T {
  return (b && (!a || b > a) ? b : a) as T;
}

export type HelpdeskStore = ReturnType<typeof createStore>;

/** Every query Better Helpdesk makes, written once over the adapter contract. */
export function createStore(adapter: DatabaseAdapter) {
  const caps = adapter.capabilities;

  async function withTags<R extends { id: string }>(
    model: TaggedModel,
    rows: R[],
    db = adapter
  ): Promise<(R & { tags: string[] })[]> {
    if (rows.length === 0) return [];
    const [tagModel, owner] = TAGS[model];
    const byOwner = new Map<string, string[]>();
    for (const ids of chunks(rows.map(r => r.id))) {
      const tags = await db.findMany<Record<string, string>>(tagModel, {
        where: oneOf(owner, ids),
        orderBy: [{ field: 'position' }],
      });
      for (const t of tags) {
        const id = t[owner] as string;
        byOwner.set(id, [...(byOwner.get(id) ?? []), t.tag as string]);
      }
    }
    return rows.map(r => ({ ...r, tags: byOwner.get(r.id) ?? [] }));
  }

  async function oneWithTags<R extends { id: string }>(
    model: TaggedModel,
    row: R | null,
    db = adapter
  ) {
    if (!row) return null;
    const [tagged] = await withTags(model, [row], db);
    return tagged ?? null;
  }

  async function setTags(
    model: TaggedModel,
    id: string,
    tags: string[],
    db = adapter
  ) {
    const [tagModel, owner] = TAGS[model];
    await db.deleteMany(tagModel, eq(owner, id));
    for (const [position, tag] of [...new Set(tags)].entries()) {
      await db.create(tagModel, { [owner]: id, tag, position });
    }
  }

  async function get<M extends TaggedModel>(
    model: M,
    id: string,
    db = adapter
  ): Promise<(Row<M> & { tags: string[] }) | null> {
    const row = await db.findOne<Row<M> & { id: string }>(model, {
      where: eq('id', id),
    });
    return oneWithTags(model, row, db);
  }

  /** Writes a patch that may carry tags; true when the row matched. */
  async function patchTagged(
    model: TaggedModel,
    where: Where,
    id: string,
    patch: Record<string, unknown>,
    db = adapter
  ) {
    const { tags, ...rest } = patch;
    const columns = Object.values(rest).some(v => v !== undefined);
    if (!tags) {
      return columns
        ? (await db.updateMany(model, where, rest)) > 0
        : (await db.count(model, where)) > 0;
    }
    // The owner's row is locked so two tag writes take turns: the last one wins whole.
    return db.transaction(async tx => {
      const owner = await tx.findOne(model, { where, forUpdate: true });
      if (!owner) return false;
      if (columns) await tx.updateMany(model, eq('id', id), rest);
      await setTags(model, id, tags as string[], tx);
      return true;
    });
  }

  /** Writes `set` to the row `key` names, or creates it. Outside a transaction: a lost race retries. */
  async function upsert(
    model: ModelName,
    key: Where,
    set: Record<string, unknown>,
    create: Record<string, unknown>
  ) {
    if (Object.keys(set).length > 0) {
      if ((await adapter.updateMany(model, key, set)) > 0) return;
    } else if ((await adapter.count(model, key)) > 0) return;
    try {
      await adapter.create(model, create);
    } catch (error) {
      if ((await adapter.count(model, key)) === 0) throw error;
      if (Object.keys(set).length > 0) {
        await adapter.updateMany(model, key, set);
      }
    }
  }

  async function nextReference(db: DatabaseAdapter) {
    const counter = await db.findOne<Row<'counter'>>('counter', {
      where: eq('name', 'reference'),
      forUpdate: true,
    });
    // The built-in migrations seed it; an adapter of your own may start without.
    if (!counter) {
      await db.create('counter', { name: 'reference', value: 1001 });
      return 1000;
    }
    await db.updateMany('counter', eq('name', 'reference'), {
      value: { increment: 1 },
    });
    return counter.value;
  }

  async function namesOf(model: 'agent' | 'contact', ids: (string | null)[]) {
    const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    const names = new Map<
      string,
      { name: string | null; email: string | null }
    >();
    for (const part of chunks(wanted)) {
      for (const row of await adapter.findMany<{
        id: string;
        name: string | null;
        email: string | null;
      }>(model, {
        where: oneOf('id', part),
        select: ['id', 'name', 'email'],
      })) {
        names.set(row.id, row);
      }
    }
    return names;
  }

  function search(query: string): Where {
    if (caps.searchConversations) return caps.searchConversations(query);
    // ponytail: a LIKE scan per word; native full-text search when an inbox gets slow.
    return and(
      ...query
        .split(/\s+/)
        .filter(Boolean)
        .map(word =>
          or(
            contains('title', word),
            contains('subject', word),
            inSelect('id', 'message', 'conversationId', contains('body', word))
          )
        )
    );
  }

  /** The filters of the agent inbox, shared by its list and its counts. */
  function inboxWhere(filter: InboxFilter): Where {
    const q = filter.query?.trim();
    const number = q ? Number(q.replace(/^\D+-/, '')) : Number.NaN;
    return and(
      filter.inbox && eq('inbox', filter.inbox),
      filter.status === 'snoozed'
        ? and(eq('status', 'pending'), ne('snoozedUntil', null))
        : filter.status === 'rated-bad'
          ? eq('rating', 'bad')
          : filter.status && eq('status', filter.status),
      filter.assigneeId === null
        ? eq('assigneeId', null)
        : filter.assigneeId && eq('assigneeId', filter.assigneeId),
      filter.contactId && eq('contactId', filter.contactId),
      filter.companyId && eq('companyId', filter.companyId),
      filter.tag &&
        inSelect(
          'id',
          'conversation_tag',
          'conversationId',
          eq('tag', filter.tag)
        ),
      filter.priority === 'high' && oneOf('priority', ['high', 'urgent']),
      // A blocked sender's conversations stay on their contact page only.
      !filter.contactId && notBlocked,
      q &&
        or(
          search(q),
          // `number` is an int4; a longer digit run is text, not a reference.
          Number.isSafeInteger(number) &&
            number <= 2_147_483_647 &&
            eq('number', number)
        )
    );
  }

  const inboxOrder = [
    { field: 'waitingSince', direction: 'asc', nulls: 'last' },
    { field: 'lastMessageAt', direction: 'desc' },
  ] as const;

  /**
   * Deletes rows and what hangs off them, children first, as the foreign
   * keys say. The store never leans on the database's cascades: SQL Server
   * refuses some of them and SQLite runs without them unless asked.
   */
  async function purge(model: ModelName, ids: string[], db: DatabaseAdapter) {
    for (const part of chunks(ids)) {
      for (const ref of REFERENCES.get(model) ?? []) {
        const pointing = oneOf(ref.field, part);
        if (ref.onDelete === 'set null') {
          await db.updateMany(ref.model, pointing, { [ref.field]: null });
        } else if ('id' in helpdeskModel[ref.model].fields) {
          const children = await db.findMany<{ id: string }>(ref.model, {
            where: pointing,
            select: ['id'],
          });
          await purge(
            ref.model,
            children.map(c => c.id),
            db
          );
        } else {
          await db.deleteMany(ref.model, pointing);
        }
      }
      await db.deleteMany(model, oneOf('id', part));
    }
  }

  async function idsOf(model: ModelName, where: Where, db = adapter) {
    const rows = await db.findMany<{ id: string }>(model, {
      where,
      select: ['id'],
    });
    return rows.map(r => r.id);
  }

  async function conversationIdsWhere(where: Where) {
    const rows = await adapter.findMany<{ id: string }>('conversation', {
      where,
      select: ['id'],
    });
    return rows.map(r => r.id);
  }

  const store = {
    adapter,

    async findContactByIdentity(
      channel: IdentityChannel,
      externalId: string,
      { verifiedOnly }: { verifiedOnly: boolean }
    ): Promise<Contact | null> {
      const identity = await adapter.findOne<Row<'identity'>>('identity', {
        where: and(
          eq('channel', channel),
          eq('externalId', externalId),
          verifiedOnly && eq('verified', true)
        ),
        orderBy: [{ field: 'verified', direction: 'desc' }],
      });
      return identity ? get('contact', identity.contactId) : null;
    },

    /**
     * The contact behind a visitor token, if the token was used recently;
     * each use keeps it alive for another `idleDays`.
     */
    async findVisitor(tokenHash: string, idleDays: number) {
      const identity = await adapter.findOne<Row<'identity'>>('identity', {
        where: and(
          eq('channel', 'visitor'),
          eq('externalId', tokenHash),
          gt('lastUsedAt', ago(idleDays * DAY))
        ),
      });
      if (!identity) return null;
      // The widget polls; one write an hour is enough to measure idleness.
      await adapter.updateMany(
        'identity',
        and(eq('id', identity.id), lt('lastUsedAt', ago(HOUR))),
        { lastUsedAt: clock() }
      );
      return get('contact', identity.contactId);
    },

    /** The widget polls; one write every few minutes is enough for "last seen". */
    async markContactSeen(id: string) {
      await adapter.updateMany(
        'contact',
        and(
          eq('id', id),
          or(eq('lastSeenAt', null), lt('lastSeenAt', ago(5 * MINUTE)))
        ),
        { lastSeenAt: clock() }
      );
    },

    async createContact(
      values: Tagged<'contact'>,
      identity?: IdentityInput
    ): Promise<Contact> {
      return adapter.transaction(async tx => {
        const { tags = [], ...rest } = values;
        const contact = await tx.create<Row<'contact'>>('contact', rest);
        if (tags.length > 0) await setTags('contact', contact.id, tags, tx);
        if (identity) {
          await tx.create('identity', { ...identity, contactId: contact.id });
        }
        return { ...contact, tags: [...new Set(tags)] };
      });
    },

    /** Whether a blocked contact holds this address, as its email or as one merged into it. */
    async isEmailBlocked(email: string) {
      return (
        (await adapter.count(
          'contact',
          and(
            eq('blocked', true),
            or(
              eq('email', email),
              inSelect(
                'id',
                'identity',
                'contactId',
                and(eq('channel', 'email'), eq('externalId', email))
              )
            )
          )
        )) > 0
      );
    },

    /** The oldest contact with this address, however it was proven. */
    async findContactByEmail(email: string) {
      const row = await adapter.findOne<Row<'contact'>>('contact', {
        where: eq('email', email),
        orderBy: [{ field: 'createdAt' }],
      });
      return oneWithTags('contact', row);
    },

    async addIdentity(contactId: string, identity: IdentityInput) {
      // Proving an address the contact already holds unverified upgrades it.
      await upsert(
        'identity',
        and(
          eq('channel', identity.channel),
          eq('externalId', identity.externalId),
          eq('contactId', contactId)
        ),
        identity.verified ? { verified: true } : {},
        { ...identity, contactId }
      );
    },

    async listIdentities(contactId: string) {
      return adapter.findMany<Row<'identity'>>('identity', {
        where: eq('contactId', contactId),
      });
    },

    async getContact(id: string) {
      return get('contact', id);
    },

    async updateContact(id: string, patch: Partial<Contact>) {
      const found = await patchTagged('contact', eq('id', id), id, patch);
      return found ? get('contact', id) : null;
    },

    async listContacts(filter: {
      query?: string;
      leadStage?: string;
      companyId?: string;
      limit?: number;
    }) {
      const q = filter.query?.trim();
      const where = and(
        q && or(contains('name', q), contains('email', q)),
        filter.leadStage && eq('leadStage', filter.leadStage),
        filter.companyId && eq('companyId', filter.companyId)
      );
      const limit = filter.limit ?? 100;
      const ids = caps.contactIdsByActivity
        ? await caps.contactIdsByActivity(where, limit)
        : // ponytail: newest first without the capability, not most recently active.
          (
            await adapter.findMany<{ id: string }>('contact', {
              where,
              orderBy: [{ field: 'createdAt', direction: 'desc' }],
              limit,
              select: ['id'],
            })
          ).map(r => r.id);
      if (ids.length === 0) return [];
      const contacts = new Map(
        (
          await withTags(
            'contact',
            await adapter.findMany<Row<'contact'>>('contact', {
              where: oneOf('id', ids),
            })
          )
        ).map(c => [c.id, c])
      );
      const conversations = await adapter.findMany<{
        contactId: string;
        lastMessageAt: Date;
        createdAt: Date;
        context: ConversationContext;
      }>('conversation', {
        where: oneOf('contactId', ids),
        select: ['contactId', 'lastMessageAt', 'createdAt', 'context'],
        orderBy: [{ field: 'createdAt' }],
      });
      const team = new Set(
        (
          await adapter.findMany<{ email: string | null }>('agent', {
            select: ['email'],
          })
        ).flatMap(a => (a.email ? [a.email.toLowerCase()] : []))
      );
      return ids.flatMap(id => {
        const contact = contacts.get(id);
        if (!contact) return [];
        const own = conversations.filter(c => c.contactId === id);
        return [
          {
            ...contact,
            conversationCount: own.length,
            lastMessageAt: own.reduce<Date | null>(
              (max, c) => latest(max, c.lastMessageAt),
              null
            ),
            isTeam: Boolean(
              contact.email && team.has(contact.email.toLowerCase())
            ),
            firstContext: own[0]?.context ?? null,
          },
        ];
      });
    },

    async removeIdentities(contactId: string, channel: IdentityChannel) {
      await adapter.deleteMany(
        'identity',
        and(eq('contactId', contactId), eq('channel', channel))
      );
    },

    /**
     * Moves everything `sourceId` owns onto `targetId`, then deletes the source.
     * The target keeps its own fields and takes the source's where it has none.
     */
    async mergeContacts(targetId: string, sourceId: string) {
      if (targetId === sourceId) return;
      await adapter.transaction(async tx => {
        const locked = await tx.findMany<Row<'contact'>>('contact', {
          where: oneOf('id', [sourceId, targetId]),
          orderBy: [{ field: 'id' }],
          forUpdate: true,
        });
        const source = locked.find(r => r.id === sourceId);
        const target = locked.find(r => r.id === targetId);
        for (const model of [
          'conversation',
          'message',
          'activity',
          'deal',
        ] as const) {
          await tx.updateMany(model, eq('contactId', sourceId), {
            contactId: targetId,
          });
        }
        const sourceIn = await tx.findMany<Row<'participant'>>('participant', {
          where: eq('contactId', sourceId),
        });
        for (const { conversationId } of sourceIn) {
          const already = await tx.count(
            'participant',
            and(eq('conversationId', conversationId), eq('contactId', targetId))
          );
          if (!already) {
            await tx.create('participant', {
              conversationId,
              contactId: targetId,
            });
          }
        }
        for (const part of chunks(sourceIn.map(p => p.conversationId))) {
          const events = await tx.findMany<ConversationEvent>(
            'conversation_event',
            {
              where: and(
                eq('kind', 'participant.added'),
                oneOf('conversationId', part)
              ),
            }
          );
          for (const event of events) {
            if (event.data.contactId !== sourceId) continue;
            await tx.updateMany('conversation_event', eq('id', event.id), {
              data: { ...event.data, contactId: targetId },
            });
          }
        }
        // Identities move rather than copy: a copied verified row would collide
        // with its own original and be skipped. No visitor token survives a
        // merge on either side: it proves nothing about the merged person.
        await tx.deleteMany(
          'identity',
          and(
            oneOf('contactId', [sourceId, targetId]),
            eq('channel', 'visitor')
          )
        );
        const held = await tx.findMany<Row<'identity'>>('identity', {
          where: eq('contactId', targetId),
        });
        for (const identity of await tx.findMany<Row<'identity'>>('identity', {
          where: eq('contactId', sourceId),
        })) {
          const twin = held.find(
            t =>
              t.channel === identity.channel &&
              t.externalId === identity.externalId
          );
          if (!twin) continue;
          await tx.deleteMany('identity', eq('id', identity.id));
          if (identity.verified && !twin.verified) {
            await tx.updateMany('identity', eq('id', twin.id), {
              verified: true,
            });
          }
        }
        await tx.updateMany('identity', eq('contactId', sourceId), {
          contactId: targetId,
        });
        // Read before the purge, which takes the source's tags with it.
        const tagged = await withTags('contact', locked, tx);
        await purge('contact', [sourceId], tx);
        if (source && target) {
          await tx.updateMany('contact', eq('id', targetId), {
            email: target.email ?? source.email,
            name: target.name ?? source.name,
            companyId: target.companyId ?? source.companyId,
            leadStage: target.leadStage ?? source.leadStage,
            locale: target.locale ?? source.locale,
            custom: { ...source.custom, ...target.custom },
            // A block on either side holds for the merged person.
            blocked: target.blocked || source.blocked,
            lastSeenAt: latest(target.lastSeenAt, source.lastSeenAt),
          });
          const tagsOf = (id: string) =>
            tagged.find(r => r.id === id)?.tags ?? [];
          if (tagsOf(sourceId).length > 0) {
            await setTags(
              'contact',
              targetId,
              [...tagsOf(targetId), ...tagsOf(sourceId)],
              tx
            );
          }
        }
      });
    },

    /** Without a resolved name, a new company is named by its id and a known one keeps its name. */
    async upsertCompany(
      externalOrgId: string,
      name: string | null
    ): Promise<Company> {
      await upsert(
        'company',
        eq('externalOrgId', externalOrgId),
        name ? { name } : {},
        { externalOrgId, name: name ?? externalOrgId }
      );
      const row = await adapter.findOne<Row<'company'>>('company', {
        where: eq('externalOrgId', externalOrgId),
      });
      const company = await oneWithTags('company', row);
      if (!company) throw new Error('Expected the company');
      return company;
    },

    async createCompany(values: Tagged<'company'>): Promise<Company> {
      const { tags = [], ...rest } = values;
      const company = await adapter.create<Row<'company'>>('company', rest);
      if (tags.length > 0) await setTags('company', company.id, tags);
      return { ...company, tags: [...new Set(tags)] };
    },

    async companiesByExternalOrgIds(ids: string[]): Promise<Company[]> {
      const rows: Row<'company'>[] = [];
      for (const part of chunks(ids)) {
        rows.push(
          ...(await adapter.findMany<Row<'company'>>('company', {
            where: oneOf('externalOrgId', part),
          }))
        );
      }
      return withTags('company', rows);
    },

    async getCompany(id: string) {
      return get('company', id);
    },

    /** The oldest company with this name, ignoring case. */
    async findCompanyByName(name: string) {
      const row = await adapter.findOne<Row<'company'>>('company', {
        where: { field: 'name', value: name, insensitive: true },
        orderBy: [{ field: 'createdAt' }],
      });
      return oneWithTags('company', row);
    },

    async findCompanyByDomain(domain: string) {
      const row = await adapter.findOne<Row<'company'>>('company', {
        where: eq('domain', domain),
      });
      return oneWithTags('company', row);
    },

    async updateCompany(id: string, patch: Partial<Company>) {
      const found = await patchTagged('company', eq('id', id), id, patch);
      return found ? get('company', id) : null;
    },

    async listCompanies(filter: {
      query?: string;
      leadStage?: string;
      limit?: number;
    }) {
      const q = filter.query?.trim();
      return withTags(
        'company',
        await adapter.findMany<Row<'company'>>('company', {
          where: and(
            q && or(contains('name', q), contains('domain', q)),
            filter.leadStage && eq('leadStage', filter.leadStage)
          ),
          orderBy: [{ field: 'name' }],
          limit: filter.limit ?? 100,
        })
      );
    },

    async touchAgent(user: {
      externalUserId: string;
      name?: string | null;
      email?: string | null;
      avatarUrl?: string | null;
    }): Promise<Agent> {
      const profile = {
        name: user.name ?? null,
        email: user.email ?? null,
        avatarUrl: user.avatarUrl ?? null,
      };
      await upsert(
        'agent',
        eq('externalUserId', user.externalUserId),
        { ...profile, lastSeenAt: clock(), deactivatedAt: null },
        { externalUserId: user.externalUserId, ...profile }
      );
      const agent = await adapter.findOne<Agent>('agent', {
        where: eq('externalUserId', user.externalUserId),
      });
      if (!agent) throw new Error('Expected the agent');
      return agent;
    },

    async listAgents() {
      return adapter.findMany<Agent>('agent', {
        where: eq('deactivatedAt', null),
        orderBy: [{ field: 'name', nulls: 'last' }],
      });
    },

    /** Agents still mailed: not removed, and in the agent UI within `idleDays`. */
    async mailableAgents(idleDays: number) {
      return adapter.findMany<Agent>('agent', {
        where: and(
          eq('deactivatedAt', null),
          gt('lastSeenAt', ago(idleDays * DAY))
        ),
        orderBy: [{ field: 'name', nulls: 'last' }],
      });
    },

    /** Deactivates the agent and hands their conversations back to the team. */
    async deactivateAgent(externalUserId: string) {
      await adapter.transaction(async tx => {
        const agent = await tx.findOne<Agent>('agent', {
          where: and(
            eq('externalUserId', externalUserId),
            eq('deactivatedAt', null)
          ),
          forUpdate: true,
        });
        if (!agent) return;
        await tx.updateMany('agent', eq('id', agent.id), {
          deactivatedAt: clock(),
        });
        const assigned = await tx.findMany<{ id: string }>('conversation', {
          where: eq('assigneeId', agent.id),
          select: ['id'],
          forUpdate: true,
        });
        for (const { id } of assigned) {
          await tx.updateMany('conversation', eq('id', id), {
            assigneeId: null,
          });
          await tx.create('conversation_event', {
            conversationId: id,
            kind: 'assigneeId',
            data: { from: agent.id, to: null },
          });
        }
      });
    },

    async getSetting<T>(key: string): Promise<T | null> {
      const row = await adapter.findOne<Row<'setting'>>('setting', {
        where: eq('key', key),
      });
      return (row?.value as T | undefined) ?? null;
    },

    /** Stores the value unless the key already has one. */
    async addSetting(key: string, value: unknown) {
      await upsert('setting', eq('key', key), {}, { key, value });
    },

    async setSetting(key: string, value: unknown) {
      await upsert(
        'setting',
        eq('key', key),
        { value, updatedAt: clock() },
        { key, value }
      );
    },

    async setAgentAway(id: string, awayUntil: Date | null) {
      await adapter.updateMany('agent', eq('id', id), { awayUntil });
    },

    async getAgent(id: string) {
      return adapter.findOne<Agent>('agent', { where: eq('id', id) });
    },

    async getActiveAgent(id: string) {
      return adapter.findOne<Agent>('agent', {
        where: and(eq('id', id), eq('deactivatedAt', null)),
      });
    },

    async createConversation(
      values: Omit<Tagged<'conversation'>, 'number'>,
      firstMessage: {
        body: string;
        contactId: string;
        verified: boolean;
        emailMessageId?: string;
      }
    ): Promise<{ conversation: Conversation; message: Message }> {
      return adapter.transaction(async tx => {
        const { tags = [], ...rest } = values;
        // The conversation, its first message and its wait start together.
        const now = clock();
        const conversation = await tx.create<Row<'conversation'>>(
          'conversation',
          {
            ...rest,
            number: await nextReference(tx),
            createdAt: now,
            lastMessageAt: now,
            waitingSince: now,
          }
        );
        if (tags.length > 0) {
          await setTags('conversation', conversation.id, tags, tx);
        }
        const message = await tx.create<Message>('message', {
          conversationId: conversation.id,
          authorType: 'contact',
          contactId: firstMessage.contactId,
          body: firstMessage.body,
          verified: firstMessage.verified,
          emailMessageId: firstMessage.emailMessageId ?? null,
          createdAt: conversation.createdAt,
        });
        return {
          conversation: { ...conversation, tags: [...new Set(tags)] },
          message,
        };
      });
    },

    async getConversation(id: string) {
      return get('conversation', id);
    },

    async getConversationByNumber(number: number) {
      const row = await adapter.findOne<Row<'conversation'>>('conversation', {
        where: eq('number', number),
      });
      return oneWithTags('conversation', row);
    },

    /**
     * Moves the source's messages and attachments onto the target, makes its
     * customer and participants participants of the target, and resolves the
     * source as merged. False when either side was merged first.
     */
    async mergeConversation(
      sourceId: string,
      targetId: string,
      agentId: string,
      references: { source: string; target: string }
    ) {
      return adapter.transaction(async tx => {
        const rows = await tx.findMany<Row<'conversation'>>('conversation', {
          where: oneOf('id', [sourceId, targetId]),
          orderBy: [{ field: 'id' }],
          forUpdate: true,
        });
        const source = rows.find(r => r.id === sourceId);
        const target = rows.find(r => r.id === targetId);
        if (!source || !target || source.mergedIntoId || target.mergedIntoId) {
          return false;
        }
        await tx.updateMany('message', eq('conversationId', sourceId), {
          conversationId: targetId,
        });
        await tx.updateMany('attachment', eq('conversationId', sourceId), {
          conversationId: targetId,
        });
        const joining = new Set([
          source.contactId,
          ...(
            await tx.findMany<Row<'participant'>>('participant', {
              where: eq('conversationId', sourceId),
            })
          ).map(p => p.contactId),
        ]);
        joining.delete(target.contactId);
        for (const contactId of joining) {
          const already = await tx.count(
            'participant',
            and(eq('conversationId', targetId), eq('contactId', contactId))
          );
          if (!already) {
            await tx.create('participant', {
              conversationId: targetId,
              contactId,
            });
          }
        }
        await tx.updateMany('conversation', eq('id', sourceId), {
          mergedIntoId: targetId,
          status: 'resolved',
          resolvedAt: source.resolvedAt ?? clock(),
          waitingSince: null,
          snoozedUntil: null,
        });
        // An unanswered customer message moves with the source, so the target
        // takes over its wait, reopening if it was resolved.
        const waiting =
          source.waitingSince &&
          (!target.waitingSince || source.waitingSince < target.waitingSince)
            ? source.waitingSince
            : target.waitingSince;
        const reopen =
          source.status !== 'resolved' && target.status === 'resolved';
        await tx.updateMany('conversation', eq('id', targetId), {
          lastMessageAt: latest(target.lastMessageAt, source.lastMessageAt),
          waitingSince: waiting,
          ...(reopen ? { status: source.status, resolvedAt: null } : {}),
        });
        const now = clock();
        await tx.create('conversation_event', {
          conversationId: sourceId,
          agentId,
          kind: 'merged.into',
          data: { conversationId: targetId, reference: references.target },
          createdAt: now,
        });
        await tx.create('conversation_event', {
          conversationId: targetId,
          agentId,
          kind: 'merged.from',
          data: { conversationId: sourceId, reference: references.source },
          createdAt: now,
        });
        return true;
      });
    },

    async isParticipant(conversationId: string, contactId: string) {
      return (
        (await adapter.count(
          'participant',
          and(eq('conversationId', conversationId), eq('contactId', contactId))
        )) > 0
      );
    },

    /** True when the contact was not a participant before. */
    async addParticipant(conversationId: string, contactId: string) {
      if (await store.isParticipant(conversationId, contactId)) return false;
      try {
        await adapter.create('participant', { conversationId, contactId });
        return true;
      } catch (error) {
        if (await store.isParticipant(conversationId, contactId)) return false;
        throw error;
      }
    },

    async recordEvents(values: Insert<'conversation_event'>[]) {
      // One time for the batch, so their order stays the order of `kind`.
      const now = clock();
      for (const value of values) {
        await adapter.create('conversation_event', {
          createdAt: now,
          ...value,
        });
      }
    },

    async listEvents(conversationId: string) {
      const events = await adapter.findMany<ConversationEvent>(
        'conversation_event',
        {
          where: eq('conversationId', conversationId),
          orderBy: [{ field: 'createdAt' }, { field: 'kind' }],
        }
      );
      const agents = await namesOf(
        'agent',
        events.map(e => e.agentId)
      );
      return events.map(e => ({
        id: e.id,
        kind: e.kind,
        data: e.data,
        agentId: e.agentId,
        agentName: (e.agentId && agents.get(e.agentId)?.name) ?? null,
        createdAt: e.createdAt,
      }));
    },

    async listParticipants(conversationId: string) {
      const rows = await adapter.findMany<Row<'participant'>>('participant', {
        where: eq('conversationId', conversationId),
      });
      if (rows.length === 0) return [];
      const contacts = await withTags(
        'contact',
        await adapter.findMany<Row<'contact'>>('contact', {
          where: oneOf(
            'id',
            rows.map(r => r.contactId)
          ),
        })
      );
      return contacts.map(contact => ({ contact }));
    },

    /** Conversations a customer may see: their own, ones they were added to, ones shared with their companies. */
    async listCustomerConversations(
      contactId: string | null,
      companyIds: string[]
    ) {
      if (!contactId && companyIds.length === 0) return [];
      return withTags(
        'conversation',
        await adapter.findMany<Row<'conversation'>>('conversation', {
          where: or(
            contactId && eq('contactId', contactId),
            contactId &&
              inSelect(
                'id',
                'participant',
                'conversationId',
                eq('contactId', contactId)
              ),
            companyIds.length > 0 &&
              and(eq('sharedWithCompany', true), oneOf('companyId', companyIds))
          ),
          orderBy: [{ field: 'lastMessageAt', direction: 'desc' }],
          limit: 100,
        })
      );
    },

    async listInbox(filter: InboxFilter) {
      const where = inboxWhere(filter);
      const limit = filter.limit ?? 200;
      let rows: Row<'conversation'>[] = [];
      if (filter.sort === 'priority') {
        // One query per priority, most urgent first, until the page is full.
        const ranked = [...PRIORITIES].reverse();
        const buckets: Where[] = [
          ...ranked.map(p => eq('priority', p)),
          { field: 'priority', op: 'notIn', value: ranked },
        ];
        for (const bucket of buckets) {
          if (rows.length >= limit) break;
          rows = rows.concat(
            await adapter.findMany<Row<'conversation'>>('conversation', {
              where: and(where, bucket),
              orderBy: [...inboxOrder],
              limit: limit - rows.length,
            })
          );
        }
      } else {
        rows = await adapter.findMany<Row<'conversation'>>('conversation', {
          where,
          orderBy: [...inboxOrder],
          limit,
        });
      }
      if (rows.length === 0) return [];
      const conversations = await withTags('conversation', rows);
      const contacts = new Map(
        (
          await withTags(
            'contact',
            await adapter.findMany<Row<'contact'>>('contact', {
              where: oneOf('id', [...new Set(rows.map(r => r.contactId))]),
            })
          )
        ).map(c => [c.id, c])
      );
      return conversations.flatMap(conversation => {
        const contact = contacts.get(conversation.contactId);
        return contact ? [{ conversation, contact }] : [];
      });
    },

    async countInbox(filter: InboxFilter) {
      return adapter.count('conversation', inboxWhere(filter));
    },

    /** The newest public message of each conversation, for list previews. */
    async lastMessages(conversationIds: string[]) {
      const byConversation = new Map<string, Message>();
      if (conversationIds.length === 0) return byConversation;
      const rows = caps.lastMessages
        ? ((await caps.lastMessages(conversationIds)) as Message[])
        : (
            await Promise.all(
              conversationIds.map(id =>
                adapter.findOne<Message>('message', {
                  where: and(eq('conversationId', id), eq('internal', false)),
                  orderBy: [{ field: 'createdAt', direction: 'desc' }],
                })
              )
            )
          ).filter((m): m is Message => m !== null);
      for (const row of rows) byConversation.set(row.conversationId, row);
      return byConversation;
    },

    async markViewing(agentId: string, conversationId: string) {
      await adapter.updateMany('agent', eq('id', agentId), {
        viewingId: conversationId,
        viewingAt: clock(),
      });
    },

    /** Other agents with each conversation open, keyed by conversation id. */
    async viewers(conversationIds: string[], exceptAgentId: string) {
      const byConversation = new Map<string, { id: string; name: string }[]>();
      if (conversationIds.length === 0) return byConversation;
      const rows = await adapter.findMany<Agent>('agent', {
        where: and(
          oneOf('viewingId', conversationIds),
          // Sized against the conversation view's 5-second poll; change the two together.
          gt('viewingAt', ago(15_000)),
          ne('id', exceptAgentId),
          eq('deactivatedAt', null)
        ),
      });
      const named = rows
        .map(a => ({
          id: a.id,
          name: (a.name ?? a.email ?? '') as string,
          viewingId: a.viewingId,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      for (const { viewingId, ...agent } of named) {
        if (!viewingId) continue;
        byConversation.set(viewingId, [
          ...(byConversation.get(viewingId) ?? []),
          agent,
        ]);
      }
      return byConversation;
    },

    async recentAgents(limit: number) {
      const rows = await adapter.findMany<Agent>('agent', {
        where: and(gt('lastSeenAt', ago(30 * DAY)), eq('deactivatedAt', null)),
        orderBy: [{ field: 'lastSeenAt', direction: 'desc' }],
        limit,
      });
      return rows.map(a => ({
        name: a.name,
        email: a.email,
        avatarUrl: a.avatarUrl,
        awayUntil: a.awayUntil,
      }));
    },

    async topTags() {
      if (caps.topTags) return caps.topTags(15);
      // ponytail: counts the tags of the last 90 days in memory.
      const rows = await adapter.findMany<{ tag: string }>('conversation_tag', {
        where: inSelect(
          'conversationId',
          'conversation',
          'id',
          gt('lastMessageAt', ago(90 * DAY))
        ),
        select: ['tag'],
      });
      const uses = new Map<string, number>();
      for (const { tag } of rows) uses.set(tag, (uses.get(tag) ?? 0) + 1);
      return [...uses]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 15)
        .map(([tag]) => tag);
    },

    /** Conversations opened, resolved or rated in the last `sinceDays`, with their first public agent reply; merged-away ones are left out. */
    async overview(sinceDays: number) {
      const since = ago(sinceDays * DAY);
      const inWindow = and(
        eq('mergedIntoId', null),
        or(
          gte('createdAt', since),
          gte('resolvedAt', since),
          gte('ratedAt', since)
        )
      );
      const conversations = await withTags(
        'conversation',
        await adapter.findMany<Row<'conversation'>>('conversation', {
          where: inWindow,
        })
      );
      const firstReply = new Map<string, Date>();
      for (const m of await adapter.findMany<{
        conversationId: string;
        createdAt: Date;
      }>('message', {
        where: and(
          inSelect('conversationId', 'conversation', 'id', inWindow),
          eq('authorType', 'agent'),
          eq('internal', false)
        ),
        select: ['conversationId', 'createdAt'],
      })) {
        const known = firstReply.get(m.conversationId);
        if (!known || m.createdAt < known) {
          firstReply.set(m.conversationId, m.createdAt);
        }
      }
      const agents = await namesOf(
        'agent',
        conversations.map(c => c.assigneeId)
      );
      return conversations.map(c => {
        const agent = c.assigneeId ? agents.get(c.assigneeId) : undefined;
        return {
          inbox: c.inbox,
          assigneeId: c.assigneeId,
          agentName: agent ? (agent.name ?? agent.email) : null,
          tags: c.tags,
          rating: c.rating,
          ratedAt: c.ratedAt,
          createdAt: c.createdAt,
          firstReplyAt: firstReply.get(c.id) ?? null,
          resolvedAt: c.resolvedAt,
        };
      });
    },

    // Copies `last_message_at`, not the current time: a customer message committing
    // concurrently could carry an earlier time and never read as unread.
    async markAgentSeen(id: string) {
      const row = await adapter.findOne<Row<'conversation'>>('conversation', {
        where: eq('id', id),
      });
      if (!row || (row.agentSeenAt && row.agentSeenAt >= row.lastMessageAt)) {
        return;
      }
      await adapter.updateMany(
        'conversation',
        and(eq('id', id), at('lastMessageAt', row.lastMessageAt)),
        { agentSeenAt: row.lastMessageAt }
      );
    },

    /**
     * What happened for an agent lately: assignments and mentions by
     * colleagues, and customer replies on conversations assigned to them since
     * they got them. Derived from events and messages, newest first.
     */
    async notificationsFor(agentId: string, limit = 30) {
      const since = ago(30 * DAY);
      if (caps.notificationsFor) {
        return caps.notificationsFor(agentId, since, limit);
      }
      type Note = {
        kind: 'assigned' | 'mentioned' | 'reply';
        conversation_id: string;
        who: string | null;
        at: Date;
      };
      const notes: Note[] = [];
      // ponytail: the JSON payloads are filtered in memory over 30 days of events.
      const events = await adapter.findMany<ConversationEvent>(
        'conversation_event',
        {
          where: and(
            oneOf('kind', ['assigneeId', 'mentioned']),
            gt('createdAt', since)
          ),
        }
      );
      const agents = await namesOf(
        'agent',
        events.map(e => e.agentId)
      );
      for (const e of events) {
        const who = (e.agentId && agents.get(e.agentId)?.name) ?? null;
        const note = {
          conversation_id: e.conversationId,
          who,
          at: e.createdAt,
        };
        if (
          e.kind === 'assigneeId' &&
          e.data.to === agentId &&
          e.agentId !== agentId
        ) {
          notes.push({ kind: 'assigned', ...note });
        } else if (
          e.kind === 'mentioned' &&
          Array.isArray(e.data.agentIds) &&
          e.data.agentIds.includes(agentId)
        ) {
          notes.push({ kind: 'mentioned', ...note });
        }
      }
      const theirs = eq('assigneeId', agentId);
      const assignedSince = new Map<string, Date>();
      for (const c of await adapter.findMany<{ id: string; createdAt: Date }>(
        'conversation',
        { where: theirs, select: ['id', 'createdAt'] }
      )) {
        assignedSince.set(c.id, c.createdAt);
      }
      for (const e of await adapter.findMany<ConversationEvent>(
        'conversation_event',
        {
          where: and(
            eq('kind', 'assigneeId'),
            inSelect('conversationId', 'conversation', 'id', theirs)
          ),
        }
      )) {
        const known = assignedSince.get(e.conversationId);
        if (e.data.to === agentId && known && e.createdAt > known) {
          assignedSince.set(e.conversationId, e.createdAt);
        }
      }
      const replies = await adapter.findMany<Message>('message', {
        where: and(
          eq('authorType', 'contact'),
          eq('internal', false),
          gt('createdAt', since),
          inSelect('conversationId', 'conversation', 'id', theirs)
        ),
      });
      const contacts = await namesOf(
        'contact',
        replies.map(m => m.contactId)
      );
      for (const m of replies) {
        const from = assignedSince.get(m.conversationId);
        if (!from || m.createdAt <= from) continue;
        const contact = m.contactId ? contacts.get(m.contactId) : undefined;
        notes.push({
          kind: 'reply',
          conversation_id: m.conversationId,
          who: contact ? (contact.name ?? contact.email) : null,
          at: m.createdAt,
        });
      }
      notes.sort((a, b) => b.at.getTime() - a.at.getTime());
      const page = notes.slice(0, limit);
      if (page.length === 0) return [];
      const conversations = new Map(
        (
          await adapter.findMany<{
            id: string;
            number: number;
            title: string | null;
            subject: string | null;
          }>('conversation', {
            where: oneOf('id', [...new Set(page.map(n => n.conversation_id))]),
            select: ['id', 'number', 'title', 'subject'],
          })
        ).map(c => [c.id, c])
      );
      return page.flatMap(n => {
        const c = conversations.get(n.conversation_id);
        return c
          ? [
              {
                kind: n.kind,
                conversation_id: n.conversation_id,
                number: c.number,
                subject: c.title ?? c.subject,
                who: n.who,
                at: n.at.toISOString(),
              },
            ]
          : [];
      });
    },

    async notificationsSeenAt(agentId: string) {
      return store.getSetting<string>(`notifications-seen:${agentId}`);
    },

    async markNotificationsSeen(agentId: string) {
      await store.setSetting(
        `notifications-seen:${agentId}`,
        clock().toISOString()
      );
    },

    async countOpen(agentId: string) {
      const open = and(eq('status', 'open'), notBlocked);
      const [all, mine, unassigned] = await Promise.all([
        adapter.count('conversation', open),
        adapter.count('conversation', and(open, eq('assigneeId', agentId))),
        adapter.count('conversation', and(open, eq('assigneeId', null))),
      ]);
      return { all, mine, unassigned };
    },

    async countWaiting() {
      return adapter.count(
        'conversation',
        and(
          ne('waitingSince', null),
          ne('status', 'resolved'),
          eq('snoozedUntil', null),
          notBlocked
        )
      );
    },

    /** With `unlessResolved`, a thread already resolved is left alone and the result is null. */
    async updateConversation(
      id: string,
      patch: Partial<Conversation>,
      { unlessResolved = false } = {}
    ) {
      const found = await patchTagged(
        'conversation',
        and(eq('id', id), unlessResolved && ne('status', 'resolved')),
        id,
        patch
      );
      return found ? get('conversation', id) : null;
    },

    /** Rates a resolved conversation once; null when it is not resolved, merged away or already rated. */
    async rateConversation(id: string, patch: Partial<Conversation>) {
      const found = await patchTagged(
        'conversation',
        and(
          eq('id', id),
          eq('status', 'resolved'),
          eq('mergedIntoId', null),
          eq('rating', null)
        ),
        id,
        patch
      );
      return found ? get('conversation', id) : null;
    },

    /**
     * Updates each conversation with the patch `plan` makes from it, locked and
     * in one transaction: all of them, or none when an id is missing or `plan` throws.
     * `plan` is synchronous so it cannot wait on the pool while holding a connection.
     */
    async updateConversations(
      ids: string[],
      plan: (conversation: Conversation) => Partial<Conversation>
    ) {
      return adapter.transaction(async tx => {
        // Locked in id order, so overlapping batches cannot deadlock each other.
        const rows = await withTags(
          'conversation',
          await tx.findMany<Row<'conversation'>>('conversation', {
            where: oneOf('id', ids),
            orderBy: [{ field: 'id' }],
            forUpdate: true,
          }),
          tx
        );
        const missing = ids.filter(id => !rows.some(r => r.id === id));
        if (missing.length > 0) return { missing, changes: [] };
        const changes = [];
        for (const before of rows) {
          const patch = plan(before);
          await patchTagged(
            'conversation',
            eq('id', before.id),
            before.id,
            patch,
            tx
          );
          changes.push({
            before,
            patch,
            updated: await get('conversation', before.id, tx),
          });
        }
        return { missing, changes };
      });
    },

    /** Changes sharing only while the thread is still with `companyId`. */
    async setSharing(id: string, companyId: string, shared: boolean) {
      return patchTagged(
        'conversation',
        and(eq('id', id), eq('companyId', companyId)),
        id,
        { sharedWithCompany: shared }
      );
    },

    /**
     * A customer message reopens a resolved thread and starts the waiting
     * clock; a public agent reply stops it.
     */
    async appendMessage(values: Insert<'message'>): Promise<Message> {
      return adapter.transaction(async tx => {
        const conversation = await tx.findOne<Row<'conversation'>>(
          'conversation',
          { where: eq('id', values.conversationId), forUpdate: true }
        );
        const message = await tx.create<Message>('message', values);
        const now = message.createdAt;
        // A note is not a message to the customer: it must not mark their
        // thread unread or lift it in their list.
        const patch: Partial<Row<'conversation'>> = values.internal
          ? {}
          : { lastMessageAt: now };
        if (values.authorType === 'contact') {
          patch.waitingSince = conversation?.waitingSince ?? now;
          patch.status = 'open';
          patch.snoozedUntil = null;
          if (conversation?.status === 'resolved') patch.resolvedAt = null;
        } else if (values.authorType === 'agent' && !values.internal) {
          patch.waitingSince = null;
          patch.remindedAt = null;
          if (conversation?.status !== 'resolved') patch.status = 'pending';
        }
        if (Object.keys(patch).length > 0) {
          await tx.updateMany(
            'conversation',
            eq('id', values.conversationId),
            patch
          );
        }
        return message;
      });
    },

    async getMessage(id: string) {
      return adapter.findOne<Message>('message', { where: eq('id', id) });
    },

    async findMessageByEmailId(emailMessageIds: string[]) {
      // A mail's References can name thousands of ids.
      for (const part of chunks(emailMessageIds)) {
        const found = await adapter.findOne<Message>('message', {
          where: oneOf('emailMessageId', part),
        });
        if (found) return found;
      }
      return null;
    },

    async listMessages(
      conversationId: string,
      { includeInternal }: { includeInternal: boolean }
    ) {
      const messages = await adapter.findMany<Message>('message', {
        where: and(
          eq('conversationId', conversationId),
          !includeInternal && eq('internal', false)
        ),
        orderBy: [{ field: 'createdAt' }],
      });
      const [agents, contacts] = await Promise.all([
        namesOf(
          'agent',
          messages.map(m => m.agentId)
        ),
        namesOf(
          'contact',
          messages.map(m => m.contactId)
        ),
      ]);
      return messages.map(message => ({
        message,
        agentName:
          (message.agentId && agents.get(message.agentId)?.name) ?? null,
        contactName:
          (message.contactId && contacts.get(message.contactId)?.name) ?? null,
      }));
    },

    async createAttachment(values: Insert<'attachment'>) {
      return adapter.create<Attachment>('attachment', values);
    },

    async countAttachments(conversationId: string) {
      return adapter.count('attachment', eq('conversationId', conversationId));
    },

    async getAttachment(id: string) {
      return adapter.findOne<Attachment>('attachment', { where: eq('id', id) });
    },

    async updateAttachment(id: string, patch: Partial<Attachment>) {
      const n = await adapter.updateMany('attachment', eq('id', id), patch);
      return n > 0 ? store.getAttachment(id) : null;
    },

    async listAttachments(conversationId: string) {
      return adapter.findMany<Attachment>('attachment', {
        where: and(eq('conversationId', conversationId), eq('uploaded', true)),
        orderBy: [{ field: 'createdAt' }],
      });
    },

    async listCannedReplies() {
      return adapter.findMany<Row<'canned_reply'>>('canned_reply', {
        orderBy: [{ field: 'title' }],
      });
    },

    async createCannedReply(values: {
      title: string;
      body: string;
      locale?: string | null;
    }) {
      return adapter.create<Row<'canned_reply'>>('canned_reply', values);
    },

    /** False when no canned reply has that id. */
    async updateCannedReply(
      id: string,
      values: { title: string; body: string; locale?: string | null }
    ) {
      return (
        (await adapter.updateMany('canned_reply', eq('id', id), values)) > 0
      );
    },

    async deleteCannedReply(id: string) {
      await adapter.deleteMany('canned_reply', eq('id', id));
    },

    async listDeals(filter: { companyId?: string; contactId?: string }) {
      const deals = await adapter.findMany<Deal>('deal', {
        where: and(
          filter.companyId && eq('companyId', filter.companyId),
          filter.contactId && eq('contactId', filter.contactId)
        ),
        orderBy: [{ field: 'createdAt', direction: 'desc' }],
        limit: 500,
      });
      const companies = new Map<string, string>();
      const companyIds = [
        ...new Set(
          deals.map(d => d.companyId).filter((id): id is string => Boolean(id))
        ),
      ];
      for (const part of chunks(companyIds)) {
        for (const c of await adapter.findMany<{ id: string; name: string }>(
          'company',
          { where: oneOf('id', part), select: ['id', 'name'] }
        )) {
          companies.set(c.id, c.name);
        }
      }
      const contacts = await namesOf(
        'contact',
        deals.map(d => d.contactId)
      );
      return deals.map(deal => {
        const contact = deal.contactId
          ? contacts.get(deal.contactId)
          : undefined;
        return {
          deal,
          companyName:
            (deal.companyId && companies.get(deal.companyId)) ?? null,
          contactName: contact ? (contact.name ?? contact.email) : null,
        };
      });
    },

    async createDeal(values: Insert<'deal'>) {
      return adapter.create<Deal>('deal', values);
    },

    async updateDeal(id: string, patch: Partial<Deal>) {
      const n = await adapter.updateMany('deal', eq('id', id), patch);
      return n > 0 ? store.getDeal(id) : null;
    },

    async getDeal(id: string) {
      return adapter.findOne<Deal>('deal', { where: eq('id', id) });
    },

    async deleteDeal(id: string) {
      await adapter.transaction(tx => purge('deal', [id], tx));
    },

    async createActivity(values: Insert<'activity'>) {
      return adapter.create<Activity>('activity', values);
    },

    async listActivities(filter: {
      contactId?: string;
      companyId?: string;
      dealId?: string;
    }) {
      const conditions = [
        filter.contactId && eq('contactId', filter.contactId),
        filter.companyId && eq('companyId', filter.companyId),
        filter.dealId && eq('dealId', filter.dealId),
      ].filter((w): w is Where => Boolean(w));
      const activities = await adapter.findMany<Activity>('activity', {
        where: conditions.length > 0 ? or(...conditions) : undefined,
        orderBy: [{ field: 'occurredAt', direction: 'desc' }],
        limit: 200,
      });
      const agents = await namesOf(
        'agent',
        activities.map(a => a.agentId)
      );
      return activities.map(activity => ({
        activity,
        agentName:
          (activity.agentId && agents.get(activity.agentId)?.name) ?? null,
      }));
    },

    async enqueueJob(
      kind: string,
      payload: Record<string, unknown>,
      opts: { runAt?: Date } = {}
    ) {
      await adapter.create('job', {
        kind,
        payload,
        runAt: opts.runAt ?? clock(),
      });
    },

    /** Claims due jobs; a claim expires, so a crashed run's jobs come back. */
    async claimJobs(limit: number): Promise<Job[]> {
      const now = clock();
      const lockedUntil = new Date(now.getTime() + 2 * MINUTE);
      const claimed: Job[] = [];
      const lost: string[] = [];
      // A run that loses a job to another moves on to the next due one.
      while (claimed.length < limit) {
        const due = await adapter.findMany<Job>('job', {
          where: and(
            lte('runAt', now),
            or(eq('lockedUntil', null), lt('lockedUntil', now)),
            lost.length > 0 && { field: 'id', op: 'notIn', value: lost }
          ),
          orderBy: [{ field: 'runAt' }],
          limit: limit - claimed.length,
        });
        if (due.length === 0) break;
        for (const job of due) {
          const won = await adapter.updateMany(
            'job',
            and(
              eq('id', job.id),
              eq('attempts', job.attempts),
              at('lockedUntil', job.lockedUntil)
            ),
            { lockedUntil, attempts: { increment: 1 } }
          );
          if (won === 1) {
            claimed.push({ ...job, lockedUntil, attempts: job.attempts + 1 });
          } else {
            lost.push(job.id);
          }
        }
      }
      return claimed;
    },

    async completeJob(id: string) {
      await adapter.deleteMany('job', eq('id', id));
    },

    async failJob(job: Pick<Job, 'id' | 'attempts'>, error: string) {
      const dead = job.attempts >= MAX_ATTEMPTS;
      await adapter.updateMany('job', eq('id', job.id), {
        lockedUntil: null,
        lastError: error.slice(0, 2000),
        runAt: dead ? NEVER : new Date(Date.now() + 2 ** job.attempts * MINUTE),
      });
    },

    /** Counts one hit; returns the total in the current hour for `key`. */
    async hitRateLimit(name: string): Promise<number> {
      // Keys built from an address can outgrow the column; their hash cannot.
      const key =
        name.length <= 200
          ? name
          : `sha256:${createHash('sha256').update(name).digest('hex')}`;
      const windowStart = new Date(Math.floor(Date.now() / HOUR) * HOUR);
      const window = and(eq('key', key), eq('windowStart', windowStart));
      for (;;) {
        const counted = await adapter.updateMany('rate_limit', window, {
          count: { increment: 1 },
        });
        if (counted > 0) break;
        try {
          await adapter.create('rate_limit', { key, windowStart, count: 1 });
          break;
        } catch (error) {
          // Another hit created the window first; count on top of it.
          if ((await adapter.count('rate_limit', window)) === 0) throw error;
        }
      }
      await adapter.deleteMany('rate_limit', lt('windowStart', ago(DAY)));
      const row = await adapter.findOne<Row<'rate_limit'>>('rate_limit', {
        where: window,
      });
      return row?.count ?? 0;
    },

    /**
     * Reopens due snoozes and returns them with their values before; a stale
     * time on any other status is only cleared. Concurrent runs never wake a row twice.
     */
    async wakeSnoozed() {
      const due = await adapter.findMany<Row<'conversation'>>('conversation', {
        where: lte('snoozedUntil', clock()),
      });
      const woken: {
        row: Conversation;
        before: { status: string; snoozedUntil: Date | null };
      }[] = [];
      for (const row of due) {
        const pending = row.status === 'pending';
        const won = await adapter.updateMany(
          'conversation',
          and(
            eq('id', row.id),
            eq('status', row.status),
            at('snoozedUntil', row.snoozedUntil)
          ),
          { snoozedUntil: null, ...(pending ? { status: 'open' } : {}) }
        );
        if (won !== 1 || !pending) continue;
        const updated = await get('conversation', row.id);
        if (updated) {
          woken.push({
            row: updated,
            before: { status: 'pending', snoozedUntil: row.snoozedUntil },
          });
        }
      }
      return woken;
    },

    /**
     * Marks due reminders as sent and returns them; concurrent runs never double-send.
     * With `cutoff`, due means waiting since then or earlier instead of `afterHours` ago.
     */
    async claimReminders(inbox: string, afterHours: number, cutoff?: Date) {
      const candidates = await adapter.findMany<Row<'conversation'>>(
        'conversation',
        {
          where: and(
            eq('inbox', inbox),
            notBlocked,
            ne('status', 'resolved'),
            eq('snoozedUntil', null),
            ne('waitingSince', null),
            cutoff
              ? lte('waitingSince', cutoff)
              : lt('waitingSince', ago(afterHours * HOUR))
          ),
        }
      );
      const claimed: Conversation[] = [];
      for (const row of candidates) {
        const waitingSince = row.waitingSince as Date;
        if (row.remindedAt && row.remindedAt >= waitingSince) continue;
        const won = await adapter.updateMany(
          'conversation',
          and(
            eq('id', row.id),
            at('waitingSince', waitingSince),
            at('remindedAt', row.remindedAt),
            // Resolved or snoozed since it was read: no reminder.
            ne('status', 'resolved'),
            eq('snoozedUntil', null)
          ),
          { remindedAt: clock() }
        );
        if (won !== 1) continue;
        const updated = await get('conversation', row.id);
        if (updated) claimed.push(updated);
      }
      return claimed;
    },

    /** Storage keys of everything the given conversations hold. */
    async attachmentKeys(conversationIds: string[]) {
      const keys: string[] = [];
      for (const part of chunks(conversationIds)) {
        for (const a of await adapter.findMany<{ key: string }>('attachment', {
          where: oneOf('conversationId', part),
          select: ['key'],
        })) {
          keys.push(a.key);
        }
      }
      return keys;
    },

    async resolvedConversationIdsBefore(cutoff: Date) {
      return conversationIdsWhere(
        and(eq('status', 'resolved'), lt('resolvedAt', cutoff))
      );
    },

    async contactConversationIds(contactId: string) {
      return conversationIdsWhere(eq('contactId', contactId));
    },

    /** The company's conversations, and those of its contacts who wrote in for no other company. */
    async companyConversationIds(companyId: string) {
      return conversationIdsWhere(
        or(
          eq('companyId', companyId),
          inSelect(
            'contactId',
            'contact',
            'id',
            and(
              eq('companyId', companyId),
              notInSelect(
                'id',
                'conversation',
                'contactId',
                or(ne('companyId', companyId), eq('companyId', null))
              )
            )
          )
        )
      );
    },

    async deleteConversations(ids: string[]) {
      for (const part of chunks(ids)) {
        await adapter.transaction(tx => purge('conversation', part, tx));
      }
    },

    async deleteContact(id: string) {
      await adapter.transaction(tx => purge('contact', [id], tx));
    },

    /** Contacts of the company that `deleteCompany` will drop: those without a conversation of their own. */
    async contactsLeftWithNothing(companyId: string) {
      const rows = await adapter.findMany<{ id: string }>('contact', {
        where: and(
          eq('companyId', companyId),
          notInSelect('id', 'conversation', 'contactId')
        ),
        select: ['id'],
      });
      return rows.map(r => r.id);
    },

    /** Drops a company, the given contacts, and the link from the rest. */
    async deleteCompany(id: string, contactIds: string[]) {
      await adapter.transaction(async tx => {
        for (const part of chunks(contactIds)) {
          // One may have opened a conversation since; that one stays.
          await purge(
            'contact',
            await idsOf(
              'contact',
              and(
                oneOf('id', part),
                notInSelect('id', 'conversation', 'contactId')
              ),
              tx
            ),
            tx
          );
        }
        await purge('company', [id], tx);
      });
    },

    async attachmentKeysBy(contactId: string) {
      const rows = await adapter.findMany<{ key: string }>('attachment', {
        where: inSelect(
          'messageId',
          'message',
          'id',
          eq('contactId', contactId)
        ),
        select: ['key'],
      });
      return rows.map(r => r.key);
    },

    /** Whether the contact wrote anything nobody proved was theirs. */
    async hasUnverifiedMessages(contactId: string) {
      // Written before this was recorded: proven if the contact is.
      const proven =
        (await adapter.count(
          'identity',
          and(eq('contactId', contactId), eq('verified', true))
        )) > 0;
      return (
        (await adapter.count(
          'message',
          and(
            eq('contactId', contactId),
            or(eq('verified', false), !proven && eq('verified', null))
          )
        )) > 0
      );
    },

    async deleteMessagesBy(contactId: string) {
      await adapter.transaction(async tx =>
        purge(
          'message',
          await idsOf('message', eq('contactId', contactId), tx),
          tx
        )
      );
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
      if (caps.duplicateCandidates) {
        return caps.duplicateCandidates(conversation.id, words);
      }
      // ponytail: LIKE per word, ranked by the words in the title and subject.
      const rows = await adapter.findMany<Row<'conversation'>>('conversation', {
        where: and(
          ne('id', conversation.id),
          or(
            ...words.map(word =>
              or(
                contains('title', word),
                contains('subject', word),
                inSelect(
                  'id',
                  'message',
                  'conversationId',
                  and(contains('body', word), eq('internal', false))
                )
              )
            )
          )
        ),
        orderBy: [{ field: 'lastMessageAt', direction: 'desc' }],
        limit: 50,
      });
      const rank = (r: Row<'conversation'>) => {
        const known = `${r.title ?? ''} ${r.subject ?? ''}`.toLowerCase();
        return words.filter(w => known.includes(w)).length;
      };
      return rows
        .map(row => ({ row, rank: rank(row) }))
        .sort((a, b) => b.rank - a.rank)
        .slice(0, 5)
        .map(({ row }) => ({
          id: row.id,
          number: row.number,
          subject: row.subject,
          title: row.title,
        }));
    },
  };
  return store;
}
