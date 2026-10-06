import { useEffect, useRef } from 'react';

import { useResource } from '../ui/api';
import { HELPDESK_CHANGED, useAdmin } from './context';
import { paths, Svg, setTitleCountOn, useTitleCountOn } from './ui';

type Notification = {
  kind: 'assigned' | 'mentioned' | 'reply';
  conversationId: string;
  reference: string;
  subject: string | null;
  who: string | null;
  at: string;
};

const TITLE_PREFIX = /^\(\d+\) /;

/** Assignments, mentions and customer replies for this agent, with the new ones counted. */
export function NotificationBell() {
  const { api, t, navigate } = useAdmin();
  const feed = useResource(
    () =>
      api<{ unread: number; notifications: Notification[] }>(
        'agent/notifications'
      ),
    'notifications',
    30_000,
    // The count in the tab title is for when this tab is in the background.
    { whenHidden: true }
  );
  useEffect(() => {
    const refresh = () => void feed.refresh();
    window.addEventListener(HELPDESK_CHANGED, refresh);
    return () => window.removeEventListener(HELPDESK_CHANGED, refresh);
  }, [feed.refresh]);
  const unread = feed.data?.unread ?? 0;
  const titleOn = useTitleCountOn();

  // The host owns the title; only a "(3) " in front of it is ours.
  useEffect(() => {
    const plain = document.title.replace(TITLE_PREFIX, '');
    document.title = titleOn && unread > 0 ? `(${unread}) ${plain}` : plain;
    return () => {
      document.title = document.title.replace(TITLE_PREFIX, '');
    };
  }, [unread, titleOn]);

  const menu = useRef<HTMLDetailsElement>(null);
  const list = feed.data?.notifications ?? [];
  return (
    <details
      className="sa-menu sa-bell"
      ref={menu}
      onToggle={e => {
        if (!e.currentTarget.open || unread === 0) return;
        void api('agent/notifications/seen', { body: {} }).then(feed.refresh);
      }}>
      <summary
        className="sa-btn sa-ghost"
        aria-label={
          unread > 0
            ? t('admin.notificationsUnread', { count: String(unread) })
            : t('admin.notifications')
        }>
        <Svg d={paths.bell} />
        {unread > 0 && (
          <span className="sa-bell-count num" aria-hidden="true">
            {unread}
          </span>
        )}
      </summary>
      <div className="sa-menu-pop sa-bell-pop">
        {list.length === 0 ? (
          <p className="sa-muted">{t('admin.notificationsNone')}</p>
        ) : (
          list.map(n => (
            <button
              key={`${n.kind}-${n.conversationId}-${n.at}`}
              type="button"
              className="sa-btn sa-ghost sa-bell-item"
              onClick={() => {
                if (menu.current) menu.current.open = false;
                navigate({ conversation: n.conversationId });
              }}>
              <span>
                {t(`admin.notify.${n.kind}`, {
                  who: n.who ?? t('admin.someone'),
                  reference: n.reference,
                })}
              </span>
              {n.subject && <span className="sa-muted">{n.subject}</span>}
            </button>
          ))
        )}
        <label className="sa-toggle">
          <input
            type="checkbox"
            checked={titleOn}
            onChange={e => setTitleCountOn(e.target.checked)}
          />
          {t('admin.titleCount')}
        </label>
      </div>
    </details>
  );
}
