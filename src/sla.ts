import type { BusinessHours, ResolvedConfig, SlaPolicy } from './config';
import type { Conversation } from './db/store';
import { openDeadline, openHoursBetween } from './ui/hours';

/** The clock a conversation runs on: its targets in hours, counted in `hours` or round the clock. */
export type SlaClock = {
  hours: BusinessHours | null;
  respond: number | null;
  resolve: number | null;
};

export type SlaClockFor = (
  conversation: Pick<Conversation, 'inbox' | 'tier' | 'priority'>
) => SlaClock | null;

export type SlaTargetName = 'response' | 'resolution';

const HOUR = 3_600_000;

export function hoursBetween(
  from: Date,
  to: Date,
  hours: BusinessHours | null
) {
  return hours
    ? openHoursBetween(from, to, hours)
    : Math.max(0, to.getTime() - from.getTime()) / HOUR;
}

export function deadline(
  from: Date,
  afterHours: number,
  hours: BusinessHours | null
) {
  return hours
    ? openDeadline(from, afterHours, hours)
    : new Date(from.getTime() + afterHours * HOUR);
}

/** The policy a conversation falls under: its tier's, else the default; then the target for its priority. */
export function slaClockFor(
  config: Pick<ResolvedConfig, 'sla' | 'inboxes'>
): SlaClockFor {
  return conversation => {
    const sla = config.sla;
    if (!sla) return null;
    const policy: SlaPolicy | undefined =
      (conversation.tier ? sla.tiers?.[conversation.tier] : undefined) ??
      sla.default;
    const target = policy?.targets[conversation.priority];
    if (!target) return null;
    const hours =
      target.hours ??
      policy?.hours ??
      config.inboxes[conversation.inbox]?.hours ??
      'always';
    return {
      hours: hours === 'always' ? null : hours,
      respond: target.respond ?? null,
      resolve: target.resolve ?? null,
    };
  };
}

type ClockState = Pick<
  Conversation,
  | 'status'
  | 'createdAt'
  | 'firstRespondedAt'
  | 'respondBy'
  | 'resolveBy'
  | 'slaPausedAt'
  | 'slaPausedSeconds'
  | 'respondNotice'
  | 'resolveNotice'
>;

/** The deadlines a conversation starts with. The clock pauses at once unless it opens with the customer waiting. */
export function slaStart(
  clock: SlaClock | null,
  now: Date,
  { status, awaitingResponse }: { status: string; awaitingResponse: boolean }
): Partial<Conversation> {
  const respondBy =
    clock?.respond != null && awaitingResponse
      ? deadline(now, clock.respond, clock.hours)
      : null;
  const resolveBy =
    clock?.resolve != null ? deadline(now, clock.resolve, clock.hours) : null;
  const running = status === 'open';
  return {
    respondBy,
    resolveBy,
    slaPausedAt: running ? null : now,
    slaDueAt: running ? dueAt(respondBy, resolveBy, null) : null,
  };
}

function dueAt(
  respondBy: Date | null,
  resolveBy: Date | null,
  firstRespondedAt: Date | null
) {
  const pending = [
    ...(respondBy && !firstRespondedAt ? [respondBy] : []),
    ...(resolveBy ? [resolveBy] : []),
  ];
  return pending.length
    ? new Date(Math.min(...pending.map(d => d.getTime())))
    : null;
}

/**
 * The SLA fields after a change. The clock runs while the status is `open`
 * and pauses otherwise; on resume the resolution deadline moves by the time
 * paused, and on a new tier or priority both deadlines are set afresh from
 * the policy. A notice already sent stands unless its target moved into the
 * future, so a fresh warning and breach cycle runs on the new target.
 */
export function slaPatch(
  clock: SlaClock | null,
  before: ClockState,
  next: { status: string; retarget?: boolean; firstRespondedAt?: Date },
  now: Date
): Partial<Conversation> {
  const patch: Partial<Conversation> = {};
  const wasRunning = before.status === 'open';
  const runs = next.status === 'open';
  let pausedSeconds = before.slaPausedSeconds;
  if (wasRunning && !runs) {
    patch.slaPausedAt = now;
  } else if (!wasRunning && runs) {
    if (before.slaPausedAt) {
      pausedSeconds += Math.round(
        hoursBetween(before.slaPausedAt, now, clock?.hours ?? null) * 3600
      );
    }
    patch.slaPausedAt = null;
    patch.slaPausedSeconds = pausedSeconds;
  }
  let { respondBy, resolveBy } = before;
  if (next.retarget) {
    respondBy =
      clock?.respond != null && !before.firstRespondedAt
        ? deadline(before.createdAt, clock.respond, clock.hours)
        : before.firstRespondedAt
          ? before.respondBy
          : null;
    patch.respondBy = respondBy;
    if (respondBy && respondBy > now) patch.respondNotice = null;
  }
  if (next.retarget || (!wasRunning && runs)) {
    resolveBy =
      clock?.resolve != null
        ? deadline(
            before.createdAt,
            clock.resolve + pausedSeconds / 3600,
            clock.hours
          )
        : null;
    patch.resolveBy = resolveBy;
    if (next.retarget && resolveBy && resolveBy > now) {
      patch.resolveNotice = null;
    }
  }
  const firstRespondedAt = next.firstRespondedAt ?? before.firstRespondedAt;
  patch.slaDueAt = runs ? dueAt(respondBy, resolveBy, firstRespondedAt) : null;
  return patch;
}
