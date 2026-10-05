import { useRef, useState } from 'react';

import type { Locale } from '../config';
import { useAdmin } from './context';
import { useKeysOn, useShortcuts } from './ui';

type Preset = 'laterToday' | 'tomorrow' | 'nextWeek';

const at = (from: Date, days: number, hour: number) => {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
};

/** In the agent's own time zone, which is the browser's. */
export function snoozePresets(now: Date): [Preset, Date][] {
  const presets: [Preset, Date][] = [
    ['laterToday', at(now, 0, 18)],
    ['tomorrow', at(now, 1, 9)],
    ['nextWeek', at(now, (8 - now.getDay()) % 7 || 7, 9)],
  ];
  return presets.filter(
    ([, date], i) =>
      date > now &&
      !presets.slice(0, i).some(([, d]) => d.getTime() === date.getTime())
  );
}

export function formatSnooze(date: string | Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'de' ? 'de-CH' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

const localInput = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

export function SnoozeControl({
  until,
  onSave,
}: {
  until: string | null;
  onSave: (snoozedUntil: string | null) => Promise<void>;
}) {
  const { t, locale } = useAdmin();
  const keysOn = useKeysOn();
  const select = useRef<HTMLSelectElement>(null);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState('');
  const [failed, setFailed] = useState(false);
  const presets = snoozePresets(new Date());

  useShortcuts({
    z: () => {
      select.current?.focus();
      try {
        select.current?.showPicker?.();
      } catch {}
    },
  });

  const save = async (value: string | null) => {
    setFailed(false);
    try {
      await onSave(value);
      setPicking(false);
    } catch {
      setFailed(true);
    }
  };

  return (
    <>
      <select
        ref={select}
        className="sa-select"
        aria-keyshortcuts={keysOn ? 'Z' : undefined}
        aria-label={
          until
            ? t('admin.snoozedUntil', { date: formatSnooze(until, locale) })
            : t('admin.snooze')
        }
        title={`${t('admin.snooze')} (z)`}
        value=""
        onChange={e => {
          const value = e.target.value;
          if (value === 'pick') {
            setPicked('');
            setPicking(true);
          } else if (value === 'off') void save(null);
          else {
            // The view may have stayed open past a preset's time.
            const date = snoozePresets(new Date()).find(
              ([key]) => key === value
            )?.[1];
            if (date) void save(date.toISOString());
            else setFailed(true);
          }
        }}>
        <option value="" disabled hidden>
          {until
            ? t('admin.snoozedUntil', { date: formatSnooze(until, locale) })
            : t('admin.snooze')}
        </option>
        {presets.map(([key, date]) => (
          <option key={key} value={key}>
            {t(`admin.snooze.${key}`)} · {formatSnooze(date, locale)}
          </option>
        ))}
        <option value="pick">{t('admin.snoozePick')}</option>
        {until && <option value="off">{t('admin.unsnooze')}</option>}
      </select>
      {picking && (
        <form
          className="sa-snooze-pick"
          onSubmit={e => {
            e.preventDefault();
            if (picked) void save(new Date(picked).toISOString());
          }}>
          <input
            type="datetime-local"
            className="sa-input"
            aria-label={t('admin.snoozeUntilLabel')}
            // biome-ignore lint/a11y/noAutofocus: opened by choosing to pick a time.
            autoFocus
            required
            min={localInput(new Date())}
            value={picked}
            onChange={e => setPicked(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') setPicking(false);
            }}
          />
          <button type="submit" className="sa-btn sa-primary">
            {t('admin.snooze')}
          </button>
          <button
            type="button"
            className="sa-btn sa-ghost"
            onClick={() => setPicking(false)}>
            {t('admin.cancel')}
          </button>
        </form>
      )}
      {failed && (
        <span className="sa-error" role="alert">
          {t('admin.snoozeFailed')}
        </span>
      )}
    </>
  );
}
