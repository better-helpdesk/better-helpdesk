// The Swiss public holidays most cantons keep, as `closed` days for
// `BusinessHours`. Only 1 August is national by federal law; Good Friday,
// Easter Monday, Whit Monday and 26 December are off in most cantons but not
// all, and cantons add their own. Adjust the list to where your team works,
// or add a canton's extra days in the agent UI's settings.

/** Easter Sunday in the Gregorian calendar (the anonymous algorithm). */
function easter(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(year, month - 1, day);
}

const DAY = 86_400_000;
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);

export function swissHolidays(year: number): string[] {
  const sunday = easter(year);
  return [
    `${year}-01-01`, // New Year's Day
    iso(sunday - 2 * DAY), // Good Friday
    iso(sunday + DAY), // Easter Monday
    iso(sunday + 39 * DAY), // Ascension Day
    iso(sunday + 50 * DAY), // Whit Monday
    `${year}-08-01`, // Swiss National Day
    `${year}-12-25`, // Christmas Day
    `${year}-12-26`, // St Stephen's Day
  ].sort();
}
