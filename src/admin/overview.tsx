import { useState } from 'react';

import { useResource } from '../ui/api';
import { formatMinutes } from '../ui/i18n';
import { useAdmin } from './context';
import { Empty, Select, Skeleton } from './ui';

type Numbers = {
  new: number;
  resolved: number;
  firstResponse: number | null;
  resolution: number | null;
};

type Overview = {
  openHours: boolean;
  total: Numbers;
  inboxes: (Numbers & { inbox: string })[];
  agents: (Numbers & { agentId: string | null; name: string | null })[];
  tags: { tag: string; count: number }[];
};

const PERIODS = ['7', '30', '90'];

/** Volume and median reply and resolution times over the last 7, 30 or 90 days. */
export function OverviewPage() {
  const { api, t, locale, inboxName } = useAdmin();
  const [days, setDays] = useState('30');
  const data = useResource(
    () => api<Overview>(`agent/overview?days=${days}`),
    `overview:${days}`
  );
  const hours = (value: number | null) =>
    value === null ? '—' : formatMinutes(Math.round(value * 60), locale);
  const table = (
    title: string,
    column: string,
    rows: (Numbers & { key: string; label: string })[]
  ) => (
    <div className="sa-card">
      <h3>{title}</h3>
      <div className="sa-table-wrap">
        <table className="sa-table sa-report">
          <thead>
            <tr>
              <th>{column}</th>
              <th>{t('admin.newCount')}</th>
              <th>{t('admin.resolvedCount')}</th>
              <th>{t('admin.firstResponse')}</th>
              <th>{t('admin.resolutionTime')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td>{r.new}</td>
                <td>{r.resolved}</td>
                <td>{hours(r.firstResponse)}</td>
                <td>{hours(r.resolution)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="sa">
      <div className="sa-page-head">
        <h2 className="sa-grow">{t('admin.overview')}</h2>
        <Select
          label={t('admin.period')}
          value={days}
          options={PERIODS}
          render={count => t('admin.lastDays', { count })}
          onChange={setDays}
        />
      </div>
      {data.error && <p className="sa-error">{t('admin.error')}</p>}
      {!data.data && !data.error && (
        <Skeleton kind="cards" label={t('admin.loading')} />
      )}
      {data.data &&
        (data.data.inboxes.length === 0 ? (
          <Empty text={t('admin.emptyOverview')} />
        ) : (
          <>
            {data.data.openHours && (
              <p className="sa-muted">{t('admin.overviewOpenHours')}</p>
            )}
            <dl className="sa-grid sa-stats">
              {(
                [
                  ['admin.newCount', String(data.data.total.new)],
                  ['admin.resolvedCount', String(data.data.total.resolved)],
                  ['admin.firstResponse', hours(data.data.total.firstResponse)],
                  ['admin.resolutionTime', hours(data.data.total.resolution)],
                ] as const
              ).map(([key, value]) => (
                <div key={key} className="sa-card">
                  <dt className="sa-muted">{t(key)}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {table(
              t('admin.byInbox'),
              t('admin.inbox'),
              data.data.inboxes.map(r => ({
                ...r,
                key: r.inbox,
                label: inboxName(r.inbox),
              }))
            )}
            {table(
              t('admin.byAgent'),
              t('admin.assignee'),
              data.data.agents.map(r => ({
                ...r,
                key: r.agentId ?? '',
                label: r.agentId ? (r.name ?? '—') : t('admin.unassigned'),
              }))
            )}
            {data.data.tags.length > 0 && (
              <div className="sa-card">
                <h3>{t('admin.topTags')}</h3>
                <div className="sa-toolbar">
                  {data.data.tags.map(({ tag, count }) => (
                    <span key={tag} className="sa-pill">
                      {tag} · {count}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ))}
    </div>
  );
}
