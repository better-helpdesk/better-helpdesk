import type { BusinessHours } from '../config';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const DAY = 86_400_000;

type Weekday = keyof BusinessHours['weekly'];

const formats = new Map<string, Intl.DateTimeFormat>();

function wallClock(time: number, timeZone: string) {
  let format = formats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formats.set(timeZone, format);
  }
  const parts = format.formatToParts(time);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(p => p.type === type)?.value);
  return Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second')
  );
}

/** The instant a wall-clock time (as if UTC) shows in the zone; a time skipped by DST moves forward by the gap, a repeated one takes its later occurrence. */
function instant(wall: number, timeZone: string) {
  const offset = (t: number) => wallClock(t, timeZone) - t;
  const late = wall - offset(wall + DAY);
  return wallClock(late, timeZone) === wall ? late : wall - offset(wall - DAY);
}

const minutes = (hhmm: string) =>
  Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

const closedSets = new WeakMap<string[], Set<string>>();
function closedDays(hours: BusinessHours) {
  if (!hours.closed?.length) return null;
  let set = closedSets.get(hours.closed);
  if (!set) {
    set = new Set(hours.closed);
    closedSets.set(hours.closed, set);
  }
  return set;
}

/** Open intervals of the days that touch [from, to], merged and in order; a closed day opens no span, though one from the day before may run into it. */
function intervals(from: number, to: number, hours: BusinessHours) {
  const first = Math.floor(wallClock(from, hours.timeZone) / DAY) - 1;
  const last = Math.floor(wallClock(to, hours.timeZone) / DAY);
  const closed = closedDays(hours);
  const spans: [number, number][] = [];
  for (let day = first; day <= last; day++) {
    if (closed?.has(new Date(day * DAY).toISOString().slice(0, 10))) continue;
    const weekday = DAYS[new Date(day * DAY).getUTCDay()] as Weekday;
    for (const [start, end] of hours.weekly[weekday] ?? []) {
      const s = minutes(start);
      const e = minutes(end) <= s ? minutes(end) + 1440 : minutes(end);
      spans.push([
        instant(day * DAY + s * 60_000, hours.timeZone),
        instant(day * DAY + e * 60_000, hours.timeZone),
      ]);
    }
  }
  spans.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const span of spans) {
    const previous = merged.at(-1);
    if (previous && span[0] <= previous[1])
      previous[1] = Math.max(previous[1], span[1]);
    else merged.push(span);
  }
  return merged;
}

export function openHoursBetween(from: Date, to: Date, hours: BusinessHours) {
  const a = from.getTime();
  const b = to.getTime();
  if (b <= a) return 0;
  let open = 0;
  for (const [start, end] of intervals(a, b, hours))
    open += Math.max(0, Math.min(end, b) - Math.max(start, a));
  return open / 3_600_000;
}

/** The latest moment from which `openHours` of open time have passed by `now`. */
// ponytail: walks the schedule back, so its cost grows with openHours over the open share of the week; it runs once per inbox per job tick and once per inbox per inbox render.
export function openCutoff(now: Date, openHours: number, hours: BusinessHours) {
  const end = now.getTime();
  // A schedule has an open span every week, so widening the window always ends.
  for (let weeks = 1; ; weeks *= 2) {
    let left = openHours * 3_600_000;
    const spans = intervals(end - weeks * 7 * DAY, end, hours);
    for (const [start, stop] of spans.reverse()) {
      if (start >= end) continue;
      const open = Math.min(stop, end) - start;
      if (open >= left) return new Date(Math.min(stop, end) - left);
      left -= open;
    }
  }
}

/** The moment `openHours` of open time after `from` have passed. The counterpart of `openCutoff`. */
export function openDeadline(
  from: Date,
  openHours: number,
  hours: BusinessHours
) {
  const start = from.getTime();
  for (let weeks = 1; ; weeks *= 2) {
    let left = openHours * 3_600_000;
    for (const [begin, end] of intervals(
      start,
      start + weeks * 7 * DAY,
      hours
    )) {
      if (end <= start) continue;
      const opens = Math.max(begin, start);
      if (end - opens >= left) return new Date(opens + left);
      left -= end - opens;
    }
  }
}

/** `at` itself while open, else when the schedule next opens; null for a schedule with no span in the coming weeks. */
export function nextOpening(at: Date, hours: BusinessHours) {
  const now = at.getTime();
  // Closed days can stretch a gap past a week, as over Christmas and New Year.
  const span = intervals(
    now,
    now + 8 * DAY + (hours.closed?.length ?? 0) * DAY,
    hours
  ).find(([, end]) => end > now);
  return span ? new Date(Math.max(span[0], now)) : null;
}

/**
 * `days` open days after `from`, at the time of day of the next opening at or
 * after `from`: a message at 14:00 on Friday is due at 14:00 on the next open
 * day, one at 20:00 on Friday at the opening on Monday plus one open day. A
 * day counts when it has an open span and is not closed. When that time falls
 * outside the day's spans, the day's first opening or last closing stands.
 */
export function openDaysDeadline(
  from: Date,
  days: number,
  hours: BusinessHours
) {
  const start = nextOpening(from, hours) ?? from;
  const wall = wallClock(start.getTime(), hours.timeZone);
  const time = wall - Math.floor(wall / DAY) * DAY;
  const closed = closedDays(hours);
  let day = Math.floor(wall / DAY);
  // A schedule has an open day every week, and closed days are finite.
  for (let left = days; left > 0; ) {
    day += 1;
    const weekday = DAYS[new Date(day * DAY).getUTCDay()] as Weekday;
    const open =
      (hours.weekly[weekday]?.length ?? 0) > 0 &&
      !closed?.has(new Date(day * DAY).toISOString().slice(0, 10));
    if (open) left -= 1;
  }
  const spans = intervals(
    instant(day * DAY, hours.timeZone),
    instant(day * DAY + DAY - 1, hours.timeZone),
    hours
  ).filter(([begin]) => {
    const local = Math.floor(wallClock(begin, hours.timeZone) / DAY);
    return local === day;
  });
  const target = instant(day * DAY + time, hours.timeZone);
  const first = spans[0];
  const last = spans.at(-1);
  if (first && target < first[0]) return new Date(first[0]);
  if (last && target > last[1]) return new Date(last[1]);
  return new Date(target);
}
