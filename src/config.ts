import type { DNSResolver } from 'mailauth';
import type { z } from 'zod';

import type { HelpdeskStore } from './db/store';

export type Locale = 'en' | 'de';

export type HelpdeskUser = {
  id: string;
  email?: string | null;
  emailVerified?: boolean;
  name?: string | null;
  locale?: string | null;
  /** Shown to customers when this user answers as an agent. */
  image?: string | null;
};

export type HelpdeskOrg = { id: string; name?: string };

/** Who is calling. `orgs` must list only organizations the user is an active member of. */
export type Identity = {
  user: HelpdeskUser;
  orgs: HelpdeskOrg[];
  isAgent: boolean;
};

export type InboxConfig = {
  /** What agents see instead of the key, per locale. */
  name?: Partial<Record<Locale, string>>;
  /** Anonymous visitors may open conversations here. */
  public?: boolean;
  /** Origins allowed to call the widget API cross-origin. */
  allowedOrigins?: string[];
  /** Email agents when a customer has waited this long. */
  reminderAfterHours?: number;
  /** Priority new conversations start with, e.g. `high` for sales. */
  defaultPriority?: (typeof PRIORITIES)[number];
  /** Widget header for this inbox, per locale. */
  title?: Partial<Record<Locale, string>>;
  /** What the widget promises about replies, per locale. */
  replyPromise?: Partial<Record<Locale, string>>;
  /** One qualifying question asked before the first message is sent. */
  qualify?: {
    label: Record<Locale, string>;
    options: {
      value: string;
      label: Record<Locale, string>;
      /** Short form for badges; `label` shows as its tooltip. */
      badge?: Record<Locale, string>;
    }[];
  };
  /** Linked under the first-message form, per locale. */
  privacyUrl?: Partial<Record<Locale, string>>;
  /** Send a receipt when someone writes in; for inboxes whose people are not signed in. */
  receipt?: boolean;
  /** Offered once someone has written, in the widget and the receipt; e.g. a meeting calendar. */
  bookingUrl?: string;
  /** The booking link in emails, e.g. through a redirect that counts clicks; `bookingUrl` when unset. */
  bookingLink?(reference: string): string;
};

export type HelpdeskEmail =
  | {
      kind: 'customer-reply';
      to: string;
      locale: Locale;
      reference: string;
      /** What the customer called it; absent while their address is unproven. */
      subject?: string;
      body: string;
      agentName: string;
      replyTo?: string;
      inReplyTo?: string;
    }
  | {
      kind: 'customer-receipt';
      to: string;
      locale: Locale;
      reference: string;
      /** The one agent who answers, when there is only one; the receipt is signed by them. */
      responderName?: string;
      responderTitle?: string;
      responderAvatarUrl?: string;
      /** Everyone who answers is away until then, back on `backOn`; ISO timestamps. */
      awayUntil?: string;
      backOn?: string;
      bookingUrl?: string;
      replyTo?: string;
    }
  | {
      kind: 'agent-new' | 'agent-reminder';
      to: string;
      locale: Locale;
      reference: string;
      subject: string;
      body: string;
      url: string;
    };

export type StorageAdapter = {
  presignUpload(
    key: string,
    opts: { contentType: string; maxBytes: number }
  ): Promise<{ url: string; fields: Record<string, string> }>;
  presignDownload(key: string, filename: string): Promise<string>;
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
};

export type HelpResult = { title: string; url: string; excerpt?: string };

export type AiAdapter = {
  generate<T>(input: {
    system: string;
    prompt: string;
    schema: z.ZodType<T>;
  }): Promise<T>;
};

export type InboundMessage = {
  messageId: string;
  from: { address: string; name?: string };
  to: string[];
  subject: string;
  text: string;
  inReplyTo?: string;
  references: string[];
  /** The From domain signed the message (aligned DKIM), and From is a single address. */
  verified: boolean;
  /** An out-of-office, a bounce or other mail no person wrote. */
  automated: boolean;
  attachments: { filename: string; contentType: string; content: Uint8Array }[];
};

export type CustomFieldDef = {
  key: string;
  label: Record<Locale, string>;
  type: 'text' | 'number' | 'date' | 'select';
  options?: string[];
};

export type HelpdeskConfig = {
  db: HelpdeskStore;
  /** Prefix of human-readable references, e.g. `DG` gives `DG-1042`. */
  referencePrefix: string;
  /** Who answers when more than one person does, e.g. "The Acme team"; the widget names the one person otherwise. */
  teamName?: Partial<Record<Locale, string>>;
  /** Role shown under an agent's name where they sign an email, by agent email. */
  agentTitles?: Record<string, Partial<Record<Locale, string>>>;
  /** Mount path of the route handler. */
  basePath?: string;
  /** Absolute URL of the agent UI, used in agent emails. */
  adminUrl: string;
  types?: string[];
  inboxes: Record<string, InboxConfig>;
  identify(request: Request): Promise<Identity | null>;
  /**
   * Signs `x-helpdesk-identity` tokens (HS256 JWT) that a host on another origin
   * mints for its signed-in users; consulted only when `identify` returns null.
   */
  identityTokenSecret?: string;
  resolveContext?(externalOrgId: string): Promise<Record<string, string>>;
  /** Names for orgs `identify` returned without one; asked only when shown or stored. */
  orgNames?(externalOrgIds: string[]): Promise<Record<string, string>>;
  storage?: StorageAdapter;
  email?: { send(message: HelpdeskEmail): Promise<void> };
  /** Reply-To address that threads a customer's email reply into a conversation. */
  replyToAddress?(reference: string): string;
  /**
   * Accept raw emails POSTed to `{basePath}/inbound/` with this bearer secret,
   * from any relay that can forward a message to a URL.
   */
  inboundWebhookSecret?: string;
  /** DNS lookups for DKIM keys; the system resolver when unset. */
  dnsResolver?: DNSResolver;
  /** Inbox that inbound email lands in. */
  inboundInbox?: string;
  help?: { search(query: string, locale: Locale): Promise<HelpResult[]> };
  ai?: AiAdapter;
  /** Bearer secret for `POST {basePath}/jobs`. */
  jobsSecret?: string;
  /** The caller's address as your proxy reports it; the default takes the last X-Forwarded-For hop. */
  clientIp?(request: Request): string | null;
  leadStages?: string[];
  dealStages?: string[];
  customFields?: Partial<
    Record<'contact' | 'company' | 'deal', CustomFieldDef[]>
  >;
  /** Delete resolved conversations this many days after resolution. */
  retentionDays?: number;
  maxAttachmentBytes?: number;
  /** Anonymous posts allowed per IP per hour. */
  anonymousRateLimit?: number;
  /** Conversations, messages and uploads a signed-in customer may start per hour. */
  customerRateLimit?: number;
};

export const DEFAULT_TYPES = ['question', 'bug', 'feature', 'lead'];
export const STATUSES = ['open', 'pending', 'resolved'] as const;
export const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export const DEFAULT_LEAD_STAGES = ['lead', 'qualified', 'customer', 'churned'];
export const DEFAULT_DEAL_STAGES = [
  'new',
  'qualified',
  'proposal',
  'won',
  'lost',
];

export type ResolvedConfig = HelpdeskConfig & {
  basePath: string;
  types: string[];
  leadStages: string[];
  dealStages: string[];
  maxAttachmentBytes: number;
  anonymousRateLimit: number;
  customerRateLimit: number;
};

export function resolveConfig(config: HelpdeskConfig): ResolvedConfig {
  return {
    ...config,
    basePath: (config.basePath ?? '/api/helpdesk').replace(/\/$/, ''),
    types: config.types ?? DEFAULT_TYPES,
    leadStages: config.leadStages ?? DEFAULT_LEAD_STAGES,
    dealStages: config.dealStages ?? DEFAULT_DEAL_STAGES,
    maxAttachmentBytes: config.maxAttachmentBytes ?? 10 * 1024 * 1024,
    anonymousRateLimit: config.anonymousRateLimit ?? 20,
    customerRateLimit: config.customerRateLimit ?? 60,
  };
}
