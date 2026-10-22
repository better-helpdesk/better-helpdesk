import { type ReactNode, useState } from 'react';

import { useResource } from '../ui/api';
import { formatMinutes } from '../ui/i18n';
import { type Route, useAdmin } from './context';
import { Empty, Select, Skeleton } from './ui';

type Met = { met: number; breached: number };

type Numbers = {
  new: number;
  resolved: number;
  reopened: number;
  firstResponse: number | null;
  firstResponseP90: number | null;
  resolution: number | null;
  resolutionP90: number | null;
  response: Met;
  resolutionTarget: Met;
};

type Breach = {
  conversationId: string;
  reference: string;
  target: 'response' | 'resolution';
  tier: string | null;
  priority: string;
  contactName: string | null;
  due: string;
  late: number | null;
};

type Overview = {
  openHours: boolean;
  sla: boolean;
  ratingScale: 2 | 5;
  ratings: { good: number; bad: number; average: number | null } | null;
  total: Numbers;
  inboxes: (Numbers & { inbox: string })[];
  agents: (Numbers & { agentId: string | null; name: string | null })[];
  tiers: (Numbers & { tier: string | null })[];
  priorities: (Numbers & { priority: string })[];
  channels: (Numbers & { channel: string })[];
  breaches: Breach[];
  tags: { tag: string; count: number }[];
};

const PERIODS = ['7', '30', '90'];

/** Volume, reply and resolution times and SLA attainment over the last 7, 30 or 90 days. */
export function OverviewPage() {
  const { api, t, locale, me, inboxName, priorityName, href, navigate } =
    useAdmin();
  const [days, setDays] = useState('30');
  const data = useResource(
    () => api<Overview>(`agent/overview?days=${days}`),
    `overview:${days}`
  );
  const hours = (value: number | null) =>
    value === null ? '—' : formatMinutes(Math.round(value * 60), locale);
  // "met / targeted": a share only once there was a target to meet.
  const attainment = (m: Met) =>
    m.met + m.breached === 0
      ? '—'
      : `${Math.round((100 * m.met) / (m.met + m.breached))}%`;
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
  const sla = data.data?.sla ?? false;
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
              <th>{t('admin.firstResponseP90')}</th>
              <th>{t('admin.resolutionTime')}</th>
              <th>{t('admin.resolutionP90')}</th>
              {sla && <th>{t('admin.responseTarget')}</th>}
              {sla && <th>{t('admin.resolutionTarget')}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td>{r.new}</td>
                <td>{r.resolved}</td>
                <td>{hours(r.firstResponse)}</td>
                <td>{hours(r.firstResponseP90)}</td>
                <td>{hours(r.resolution)}</td>
                <td>{hours(r.resolutionP90)}</td>
                {sla && <td>{attainment(r.response)}</td>}
                {sla && <td>{attainment(r.resolutionTarget)}</td>}
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
                    'admin.reopenedCount',
                    String(data.data.total.reopened),
                    null,
                  ],
                  [
                    'admin.firstResponse',
                    hours(data.data.total.firstResponse),
                    null,
                  ],
                  [
                    'admin.firstResponseP90',
                    hours(data.data.total.firstResponseP90),
                    null,
                  ],
                  [
                    'admin.resolutionTime',
                    hours(data.data.total.resolution),
                    null,
                  ],
                  [
                    'admin.resolutionP90',
                    hours(data.data.total.resolutionP90),
                    null,
                  ],
                  ...(sla
                    ? ([
                        [
                          'admin.responseTarget',
                          attainment(data.data.total.response),
                          null,
                        ],
                        [
                          'admin.resolutionTarget',
                          attainment(data.data.total.resolutionTarget),
                          null,
                        ],
                      ] as const)
                    : []),
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
                        ...(typeof data.data.ratings.average === 'number'
                          ? ([
                              [
                                'admin.averageRating',
                                t('admin.outOfFive', {
                                  score: data.data.ratings.average.toFixed(1),
                                }),
                                null,
                              ],
                            ] as const)
                          : []),
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
            {me.tiers.length > 0 &&
              table(
                t('admin.byTier'),
                t('admin.tier'),
                data.data.tiers.map(r => ({
                  ...r,
                  key: r.tier ?? '',
                  label: r.tier
                    ? link({ tier: r.tier, status: 'any' }, r.tier)
                    : t('admin.noTier'),
                }))
              )}
            {table(
              t('admin.byPriority'),
              t('admin.priority'),
              data.data.priorities.map(r => ({
                ...r,
                key: r.priority,
                label: priorityName(r.priority),
              }))
            )}
            {table(
              t('admin.byChannel'),
              t('admin.channel'),
              data.data.channels.map(r => ({
                ...r,
                key: r.channel,
                label: link(
                  { channel: r.channel, status: 'any' },
                  t(`channel.${r.channel}`)
                ),
              }))
            )}
            {sla && data.data.breaches.length > 0 && (
              <div className="sa-card">
                <h3>{t('admin.breaches')}</h3>
                <p className="sa-muted">{t('admin.breachesHint')}</p>
                <div className="sa-table-wrap">
                  <table className="sa-table sa-report">
                    <thead>
                      <tr>
                        <th>{t('admin.subjectCol')}</th>
                        <th>{t('admin.contact')}</th>
                        <th>{t('admin.tier')}</th>
                        <th>{t('admin.priority')}</th>
                        <th>{t('admin.target.response')}</th>
                        <th>{t('admin.late')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.data.breaches.map(b => (
                        <tr key={`${b.conversationId}:${b.target}`}>
                          <td>
                            {link(
                              { conversation: b.conversationId },
                              b.reference,
                              b.conversationId
                            )}
                          </td>
                          <td>{b.contactName ?? '—'}</td>
                          <td>{b.tier ?? t('admin.noTier')}</td>
                          <td>{priorityName(b.priority)}</td>
                          <td>{t(`admin.target.${b.target}`)}</td>
                          <td>{b.late === null ? '—' : hours(b.late)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
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
