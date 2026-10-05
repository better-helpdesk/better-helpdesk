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

/** The instant a wall-clock time (as if UTC) shows in the zone; a time skipped by DST lands after the gap. */
function instant(wall: number, timeZone: string) {
  const guess = wall - (wallClock(wall, timeZone) - wall);
  return wall - (wallClock(guess, timeZone) - guess);
}

const minutes = (hhmm: string) =>
  Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

/** Open intervals of the days that touch [from, to], merged and in order. */
function intervals(from: number, to: number, hours: BusinessHours) {
  const first = Math.floor(wallClock(from, hours.timeZone) / DAY) - 1;
  const last = Math.floor(wallClock(to, hours.timeZone) / DAY);
  const spans: [number, number][] = [];
  for (let day = first; day <= last; day++) {
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

/** `at` itself while open, else when the schedule next opens; null for a schedule with no span. */
export function nextOpening(at: Date, hours: BusinessHours) {
  const now = at.getTime();
  const span = intervals(now, now + 8 * DAY, hours).find(
    ([, end]) => end > now
  );
  return span ? new Date(Math.max(span[0], now)) : null;
}
