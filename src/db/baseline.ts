import { type Kysely, type SqlBool, sql } from 'kysely';

import type { Family } from './kysely';
import type { FieldKind, ModelName } from './model';

// biome-ignore lint/suspicious/noExplicitAny: DDL works on tables, not typed rows
type Db = Kysely<any>;

/** Column types per database; `key` is text that is indexed or compared exactly. */
const TYPES: Partial<Record<Family, Record<FieldKind | 'key', string>>> = {
  sqlite: {
    uuid: 'text',
    key: 'text',
    string: 'text',
    text: 'text',
    integer: 'integer',
    boolean: 'integer',
    date: 'text',
    json: 'text',
    decimal: 'text',
  },
  mysql: {
    uuid: 'char(36)',
    key: 'varchar(255)',
    string: 'varchar(255)',
    text: 'mediumtext',
    integer: 'int',
    boolean: 'boolean',
    date: 'datetime(3)',
    json: 'json',
    decimal: 'decimal(14,2)',
  },
};

type Column = [
  name: string,
  kind: FieldKind | 'key',
  options?: {
    null?: boolean;
    references?: [ModelName, 'cascade' | 'set null'];
  },
];

/**
 * The tables as they stood when databases besides Postgres arrived, for a
 * database that starts empty. Later changes are migrations of their own, so
 * this never changes with the model.
 */
export async function createBaseline(db: Db, family: Family) {
  const types = TYPES[family];
  if (!types) throw new Error(`helpdesk: no baseline for ${family}`);
  const table = (model: ModelName) => `helpdesk_${model}`;
  const created = new Set<ModelName>();
  // Foreign keys to a table not created yet: SQLite takes them anyway, MySQL needs them added after.
  const later: (() => Promise<void>)[] = [];

  async function create(
    model: ModelName,
    columns: Column[],
    primaryKey: string[] = ['id']
  ) {
    let builder = db.schema.createTable(table(model));
    for (const [name, kind, options = {}] of columns) {
      builder = builder.addColumn(name, sql.raw(types?.[kind] ?? 'text'), c =>
        options.null ? c : c.notNull()
      );
    }
    builder = builder.addPrimaryKeyConstraint(
      `helpdesk_${model}_pkey`,
      primaryKey as never
    );
    for (const [name, , options = {}] of columns) {
      if (!options.references) continue;
      const [target, onDelete] = options.references;
      const key = `helpdesk_${model}_${name}_fkey`;
      if (family === 'sqlite' || target === model || created.has(target)) {
        builder = builder.addForeignKeyConstraint(
          key,
          [name] as never,
          table(target),
          ['id'],
          fk => fk.onDelete(onDelete)
        );
      } else {
        later.push(() =>
          db.schema
            .alterTable(table(model))
            .addForeignKeyConstraint(key, [name], table(target), ['id'], fk =>
              fk.onDelete(onDelete)
            )
            .execute()
        );
      }
    }
    if (family === 'mysql') {
      // Binary collation: identifiers compare exactly, as on Postgres.
      builder = builder.modifyEnd(
        sql`engine = InnoDB default charset = utf8mb4 collate = utf8mb4_bin`
      );
    }
    await builder.execute();
    created.add(model);
  }

  async function index(
    model: ModelName,
    name: string,
    columns: string[],
    { unique = false, where }: { unique?: boolean; where?: string } = {}
  ) {
    // Index names share one namespace with the host's own in a SQLite database.
    let builder = db.schema
      .createIndex(`helpdesk_${name}`)
      .on(table(model))
      .columns(columns);
    if (unique) builder = builder.unique();
    if (where) builder = builder.where(sql.raw<SqlBool>(where));
    await builder.execute();
  }

  const id: Column = ['id', 'uuid'];
  const createdAt: Column = ['created_at', 'date'];
  const date = (name: string): Column => [name, 'date', { null: true }];

  await create('company', [
    id,
    ['name', 'text'],
    ['external_org_id', 'key', { null: true }],
    ['domain', 'key', { null: true }],
    ['lead_stage', 'string', { null: true }],
    ['custom', 'json'],
    createdAt,
  ]);
  await index('company', 'company_external_org_id_key', ['external_org_id'], {
    unique: true,
  });
  await index('company', 'company_domain_idx', ['domain']);

  await create('contact', [
    id,
    ['name', 'text', { null: true }],
    ['email', 'key', { null: true }],
    ['company_id', 'uuid', { null: true, references: ['company', 'set null'] }],
    ['lead_stage', 'string', { null: true }],
    ['custom', 'json'],
    ['locale', 'string', { null: true }],
    ['blocked', 'boolean'],
    createdAt,
    date('last_seen_at'),
  ]);
  await index('contact', 'contact_company_idx', ['company_id']);
  await index('contact', 'contact_email_idx', ['email']);
  await index('contact', 'contact_blocked_idx', ['blocked']);

  await create('identity', [
    id,
    ['contact_id', 'uuid', { references: ['contact', 'cascade'] }],
    ['channel', 'key'],
    ['external_id', 'key'],
    ['verified', 'boolean'],
    createdAt,
    ['last_used_at', 'date'],
  ]);
  if (family === 'mysql') {
    // MySQL has no partial index; a key on expressions that are NULL unless verified does the same.
    await sql`create unique index helpdesk_identity_verified_key on ${sql.table(table('identity'))}
      ((if(verified, channel, null)), (if(verified, external_id, null)))`.execute(
      db
    );
  } else {
    await index(
      'identity',
      'identity_verified_key',
      ['channel', 'external_id'],
      { unique: true, where: 'verified = 1' }
    );
  }
  await index(
    'identity',
    'identity_contact_key',
    ['channel', 'external_id', 'contact_id'],
    { unique: true }
  );
  await index('identity', 'identity_contact_idx', ['contact_id']);

  await create('agent', [
    id,
    ['external_user_id', 'key'],
    ['name', 'text', { null: true }],
    ['email', 'key', { null: true }],
    ['avatar_url', 'text', { null: true }],
    date('away_until'),
    ['last_seen_at', 'date'],
    date('deactivated_at'),
    [
      'viewing_id',
      'uuid',
      { null: true, references: ['conversation', 'set null'] },
    ],
    date('viewing_at'),
  ]);
  await index('agent', 'agent_external_user_id_key', ['external_user_id'], {
    unique: true,
  });

  await create('conversation', [
    id,
    ['number', 'integer'],
    ['inbox', 'key'],
    ['type', 'key'],
    ['status', 'key'],
    ['priority', 'key'],
    ['subject', 'text', { null: true }],
    ['title', 'text', { null: true }],
    ['contact_id', 'uuid', { references: ['contact', 'cascade'] }],
    ['company_id', 'uuid', { null: true, references: ['company', 'cascade'] }],
    ['shared_with_company', 'boolean'],
    ['assignee_id', 'uuid', { null: true, references: ['agent', 'set null'] }],
    ['context', 'json'],
    ['ai_suggestion', 'json', { null: true }],
    date('waiting_since'),
    date('reminded_at'),
    date('snoozed_until'),
    date('customer_seen_at'),
    date('agent_seen_at'),
    ['last_message_at', 'date'],
    date('resolved_at'),
    [
      'merged_into_id',
      'uuid',
      { null: true, references: ['conversation', 'set null'] },
    ],
    ['rating', 'key', { null: true }],
    ['rating_comment', 'text', { null: true }],
    date('rated_at'),
    createdAt,
  ]);
  await index('conversation', 'conversation_number_key', ['number'], {
    unique: true,
  });
  await index('conversation', 'conversation_inbox_status_idx', [
    'inbox',
    'status',
  ]);
  await index('conversation', 'conversation_contact_idx', [
    'contact_id',
    'created_at',
  ]);
  await index('conversation', 'conversation_company_idx', ['company_id']);
  await index('conversation', 'conversation_waiting_idx', ['waiting_since']);
  await index('conversation', 'conversation_snoozed_idx', ['snoozed_until']);

  for (const [model, owner] of [
    ['conversation', 'conversation_id'],
    ['contact', 'contact_id'],
    ['company', 'company_id'],
  ] as const) {
    await create(
      `${model}_tag`,
      [
        [owner, 'uuid', { references: [model, 'cascade'] }],
        ['tag', 'key'],
        ['position', 'integer'],
      ],
      [owner, 'tag']
    );
    await index(`${model}_tag`, `${model}_tag_tag_idx`, ['tag']);
  }

  await create(
    'participant',
    [
      ['conversation_id', 'uuid', { references: ['conversation', 'cascade'] }],
      ['contact_id', 'uuid', { references: ['contact', 'cascade'] }],
    ],
    ['conversation_id', 'contact_id']
  );
  await index('participant', 'participant_contact_idx', ['contact_id']);

  await create('message', [
    id,
    ['conversation_id', 'uuid', { references: ['conversation', 'cascade'] }],
    ['author_type', 'key'],
    ['contact_id', 'uuid', { null: true, references: ['contact', 'set null'] }],
    ['agent_id', 'uuid', { null: true, references: ['agent', 'set null'] }],
    ['body', 'text'],
    ['internal', 'boolean'],
    ['verified', 'boolean', { null: true }],
    ['email_message_id', 'key', { null: true }],
    createdAt,
  ]);
  await index('message', 'message_conversation_idx', [
    'conversation_id',
    'created_at',
  ]);
  await index('message', 'message_contact_idx', ['contact_id']);
  await index('message', 'message_email_message_id_key', ['email_message_id'], {
    unique: true,
  });

  await create('conversation_event', [
    id,
    ['conversation_id', 'uuid', { references: ['conversation', 'cascade'] }],
    ['agent_id', 'uuid', { null: true, references: ['agent', 'set null'] }],
    ['kind', 'key'],
    ['data', 'json'],
    createdAt,
  ]);
  await index('conversation_event', 'conversation_event_conversation_idx', [
    'conversation_id',
    'created_at',
  ]);

  await create('attachment', [
    id,
    ['conversation_id', 'uuid', { references: ['conversation', 'cascade'] }],
    ['message_id', 'uuid', { null: true, references: ['message', 'cascade'] }],
    ['key', 'text'],
    ['filename', 'text'],
    ['content_type', 'string'],
    ['size', 'integer'],
    ['uploaded', 'boolean'],
    createdAt,
  ]);
  await index('attachment', 'attachment_conversation_idx', ['conversation_id']);

  await create('canned_reply', [
    id,
    ['title', 'text'],
    ['body', 'text'],
    ['locale', 'string', { null: true }],
    createdAt,
  ]);

  await create(
    'setting',
    [
      ['key', 'key'],
      ['value', 'json'],
      ['updated_at', 'date'],
    ],
    ['key']
  );

  await create('deal', [
    id,
    ['title', 'text'],
    ['company_id', 'uuid', { null: true, references: ['company', 'cascade'] }],
    ['contact_id', 'uuid', { null: true, references: ['contact', 'set null'] }],
    ['stage', 'key'],
    ['stage_changed_at', 'date'],
    ['value', 'decimal', { null: true }],
    ['currency', 'string'],
    date('expected_close_at'),
    ['owner_id', 'uuid', { null: true, references: ['agent', 'set null'] }],
    ['custom', 'json'],
    createdAt,
  ]);
  await index('deal', 'deal_stage_idx', ['stage']);
  await index('deal', 'deal_company_idx', ['company_id']);
  await index('deal', 'deal_contact_idx', ['contact_id']);

  await create('activity', [
    id,
    ['kind', 'key'],
    ['contact_id', 'uuid', { null: true, references: ['contact', 'cascade'] }],
    ['company_id', 'uuid', { null: true, references: ['company', 'cascade'] }],
    ['deal_id', 'uuid', { null: true, references: ['deal', 'cascade'] }],
    ['agent_id', 'uuid', { null: true, references: ['agent', 'set null'] }],
    ['body', 'text', { null: true }],
    ['event', 'string', { null: true }],
    ['props', 'json', { null: true }],
    ['occurred_at', 'date'],
  ]);
  await index('activity', 'activity_contact_idx', [
    'contact_id',
    'occurred_at',
  ]);
  await index('activity', 'activity_company_idx', [
    'company_id',
    'occurred_at',
  ]);
  await index('activity', 'activity_deal_idx', ['deal_id', 'occurred_at']);

  await create('job', [
    id,
    ['kind', 'key'],
    ['payload', 'json'],
    ['run_at', 'date'],
    ['attempts', 'integer'],
    date('locked_until'),
    ['last_error', 'text', { null: true }],
    createdAt,
  ]);
  await index('job', 'job_run_at_idx', ['run_at']);

  await create(
    'rate_limit',
    [
      ['key', 'key'],
      ['window_start', 'date'],
      ['count', 'integer'],
    ],
    ['key', 'window_start']
  );

  await create(
    'counter',
    [
      ['name', 'key'],
      ['value', 'integer'],
    ],
    ['name']
  );
  for (const add of later) await add();
  await db
    .insertInto(table('counter'))
    .values({ name: 'reference', value: 1000 })
    .execute();
}
