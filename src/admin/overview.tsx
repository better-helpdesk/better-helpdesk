import { type ReactNode, useState } from 'react';

import { useResource } from '../ui/api';
import { formatMinutes } from '../ui/i18n';
import { type Route, useAdmin } from './context';
import { Empty, Select, Skeleton } from './ui';

type Numbers = {
  new: number;
  resolved: number;
  firstResponse: number | null;
  resolution: number | null;
};

type Overview = {
  openHours: boolean;
  ratings: { good: number; bad: number } | null;
  total: Numbers;
  inboxes: (Numbers & { inbox: string })[];
  agents: (Numbers & { agentId: string | null; name: string | null })[];
  tags: { tag: string; count: number }[];
};

const PERIODS = ['7', '30', '90'];

/** Volume and median reply and resolution times over the last 7, 30 or 90 days. */
export function OverviewPage() {
  const { api, t, locale, me, inboxName, href, navigate } = useAdmin();
  const [days, setDays] = useState('30');
  const data = useResource(
    () => api<Overview>(`agent/overview?days=${days}`),
    `overview:${days}`
  );
  const hours = (value: number | null) =>
    value === null ? '—' : formatMinutes(Math.round(value * 60), locale);
  // A figure opens the inbox on the conversations it counts, over the same period.
  const link = (filter: Route, label: ReactNode, key?: string) => {
    const to = { ...filter, days };
    return (
      <a
        key={key}
        href={href(to)}
        onClick={e => {
          e.preventDefault();
          navigate(to);
        }}>
        {label}
      </a>
    );
  };
  const table = (
    title: string,
    column: string,
    rows: (Numbers & { key: string; label: ReactNode })[]
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
                  ['admin.newCount', String(data.data.total.new), null],
                  [
                    'admin.resolvedCount',
                    String(data.data.total.resolved),
                    { status: 'resolved' },
                  ],
                  [
                    'admin.firstResponse',
                    hours(data.data.total.firstResponse),
                    null,
                  ],
                  [
                    'admin.resolutionTime',
                    hours(data.data.total.resolution),
                    null,
                  ],
                  ...(data.data.ratings
                    ? ([
                        [
                          'admin.rated.good',
                          String(data.data.ratings.good),
                          { status: 'rated-good' },
                        ],
                        [
                          'admin.rated.bad',
                          String(data.data.ratings.bad),
                          { status: 'rated-bad' },
                        ],
                      ] as const)
                    : []),
                ] as const
              ).map(([key, value, to]) => (
                <div key={key} className="sa-card">
                  <dt className="sa-muted">{t(key)}</dt>
                  <dd>{to ? link(to, value) : value}</dd>
                </div>
              ))}
            </dl>
            {table(
              t('admin.byInbox'),
              t('admin.inbox'),
              data.data.inboxes.map(r => ({
                ...r,
                key: r.inbox,
                label: link(
                  { inbox: r.inbox, status: 'any' },
                  inboxName(r.inbox)
                ),
              }))
            )}
            {table(
              t('admin.byAgent'),
              t('admin.assignee'),
              data.data.agents.map(r => ({
                ...r,
                key: r.agentId ?? '',
                label: link(
                  {
                    assignee:
                      r.agentId === null
                        ? 'none'
                        : r.agentId === me.agent.id
                          ? 'me'
                          : r.agentId,
                    status: 'any',
                  },
                  r.agentId ? (r.name ?? '—') : t('admin.unassigned')
                ),
              }))
            )}
            {data.data.tags.length > 0 && (
              <div className="sa-card">
                <h3>{t('admin.topTags')}</h3>
                <div className="sa-toolbar">
                  {data.data.tags.map(({ tag, count }) =>
                    link(
                      { tag, status: 'any' },
                      <span className="sa-pill">
                        {tag} · {count}
                      </span>,
                      tag
                    )
                  )}
                </div>
              </div>
            )}
          </>
        ))}
    </div>
  );
}
