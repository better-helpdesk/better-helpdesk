import { describe, expect, it } from 'vitest';

import {
  dateLocale,
  nextWorkday,
  toLocale,
  translated,
  translator,
} from './i18n';

describe('nextWorkday', () => {
  it('skips the weekend', () => {
    // 2026-10-02 is a Friday.
    expect(nextWorkday(new Date('2026-10-02T12:00:00')).getDay()).toBe(1);
    expect(nextWorkday(new Date('2026-10-05T12:00:00')).getDate()).toBe(6);
  });
});

describe('toLocale', () => {
  it('picks German and French from any variant and English otherwise', () => {
    expect(toLocale('de-CH')).toBe('de');
    expect(toLocale('fr')).toBe('fr');
    expect(toLocale('FR-ch')).toBe('fr');
    expect(toLocale('it-CH')).toBe('en');
    expect(toLocale(null)).toBe('en');
  });
});

describe('translator', () => {
  it('speaks French with the placeholders filled in', () => {
    const t = translator('fr');
    expect(t('widget.title')).toBe('Aide et support');
    expect(t('admin.queuePosition', { index: '2', count: '5' })).toBe(
      '2 sur 5'
    );
  });

  it('formats dates in the Swiss variant for French', () => {
    const date = new Date('2026-10-05T09:00:00Z');
    expect(
      new Intl.DateTimeFormat(dateLocale('fr'), {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(date)
    ).toBe('lundi 5 octobre');
  });
});

describe('translated', () => {
  it('shows the English text for a language the host left out', () => {
    expect(translated({ en: 'Seats', de: 'Plätze' }, 'de')).toBe('Plätze');
    expect(translated({ en: 'Seats', de: 'Plätze' }, 'fr')).toBe('Seats');
    expect(translated(undefined, 'fr')).toBeUndefined();
  });
});
