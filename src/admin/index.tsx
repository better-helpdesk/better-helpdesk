'use client';

import { useEffect, useMemo, useState } from 'react';

import type { Locale } from '../config';
import { type Api, ApiError, createApi, useResource } from '../ui/api';
import { translator } from '../ui/i18n';
import { CannedReplies } from './canned';
import {
  AdminProvider,
  HELPDESK_CHANGED,
  hrefForRoute,
  type Me,
  useAdminRoute,
} from './context';
import { ConversationView } from './conversation';
import { CompanyList, CompanyView, ContactList, ContactView } from './crm';
import { DealsBoard } from './deals';
import { Inbox } from './inbox';
import { Settings } from './settings';
import { adminCss } from './styles';

/** The agent UI's sections, for a host that renders its own tabs. */
export { HELPDESK_CHANGED };

export const HELPDESK_SECTIONS = [
  'inbox',
  'contacts',
  'companies',
  'deals',
  'canned',
  'settings',
] as const;
const VIEWS = HELPDESK_SECTIONS;

/** The agent UI. Mount it in any React page; it routes through the query string. */
export function HelpdeskAdmin({
  api: apiBase = '/api/helpdesk',
  basePath,
  locale,
  messages,
  location,
  onNavigate,
  nav = true,
}: {
  api?: string;
  /** Where the agent UI is mounted, e.g. `/support`. */
  basePath: string;
  locale: Locale;
  /** Overrides for the package's own strings, keyed like `admin.inbox`. */
  messages?: Record<string, string>;
  /** Host router state; the History API is used when absent. */
  location?: { pathname: string; search: string };
  onNavigate?: (href: string) => void;
  /** Off when the host renders its own section tabs (see `HELPDESK_SECTIONS`). */
  nav?: boolean;
}) {
  const api = useMemo<Api>(() => {
    const call = createApi(apiBase);
    return async (path, init) => {
      const result = await call(path, init);
      if (
        (init?.method ?? (init?.body === undefined ? 'GET' : 'POST')) !== 'GET'
      ) {
        window.dispatchEvent(new Event(HELPDESK_CHANGED));
      }
      return result as never;
    };
  }, [apiBase]);
  const t = useMemo(() => translator(locale, messages), [locale, messages]);
  const root = basePath.replace(/\/$/, '');
  const [route, navigate] = useAdminRoute({
    basePath: root,
    location,
    onNavigate,
  });
  const me = useResource(() => api<Me>('agent/me'), 'me');

  // An action whose failure no handler caught would otherwise fail silently.
  const [unhandled, setUnhandled] = useState(false);
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      if (!(event.reason instanceof ApiError)) return;
      event.preventDefault();
      setUnhandled(true);
    };
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new page clears the last page's failure.
  useEffect(() => setUnhandled(false), [route]);

  const view = route.conversation
    ? 'conversation'
    : route.contact
      ? 'contact'
      : route.company
        ? 'company'
        : (route.view ?? 'inbox');
  const section =
    view === 'conversation'
      ? 'inbox'
      : view === 'contact'
        ? 'contacts'
        : view === 'company'
          ? 'companies'
          : view;

  return (
    <>
      <style href="support-admin" precedence="default">
        {adminCss}
      </style>
      {(me.error || unhandled) && (
        <p className="sa-error" role="alert">
          {t('admin.error')}
        </p>
      )}
      {me.data && (
        <AdminProvider
          value={{
            api,
            apiBase: apiBase.replace(/\/$/, ''),
            t,
            locale,
            me: me.data,
            refreshMe: me.refresh,
            route,
            navigate,
            href: next => hrefForRoute(root, next),
            inboxName: key =>
              me.data?.inboxNames?.[key]?.[locale] ??
              key.charAt(0).toUpperCase() + key.slice(1),
          }}>
          <div className="sa">
            {nav && (
              <nav className="sa-nav">
                {VIEWS.map(v => (
                  <button
                    key={v}
                    type="button"
                    aria-current={section === v ? 'page' : undefined}
                    onClick={() => navigate(v === 'inbox' ? {} : { view: v })}>
                    {t(`admin.${v}`)}
                  </button>
                ))}
              </nav>
            )}
            {view === 'inbox' && <Inbox />}
            {view === 'conversation' && route.conversation && (
              <ConversationView
                key={route.conversation}
                id={route.conversation}
              />
            )}
            {view === 'contacts' && <ContactList />}
            {view === 'contact' && route.contact && (
              <ContactView key={route.contact} id={route.contact} />
            )}
            {view === 'companies' && <CompanyList />}
            {view === 'company' && route.company && (
              <CompanyView key={route.company} id={route.company} />
            )}
            {view === 'deals' && <DealsBoard />}
            {view === 'canned' && <CannedReplies />}
            {view === 'settings' && <Settings />}
          </div>
        </AdminProvider>
      )}
    </>
  );
}
