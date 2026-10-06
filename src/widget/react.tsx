'use client';

import { createElement, useEffect, useRef } from 'react';

import { defineHelpdeskConversations, defineHelpdeskWidget } from './element';

type Props = {
  api?: string;
  inbox?: string;
  locale?: string;
  types?: string[];
  orgId?: string;
  identityToken?: string;
  appVersion?: string;
  context?: Record<string, string>;
  label?: string;
};

/** React wrapper around `<helpdesk-widget>`. */
export function HelpdeskWidget(props: Props) {
  useEffect(() => defineHelpdeskWidget(), []);
  return createElement(HostElement, { tag: 'helpdesk-widget', ...props });
}

/** React wrapper around `<helpdesk-conversations>`, for an in-app Support page. */
export function HelpdeskConversations(props: Omit<Props, 'label'>) {
  useEffect(() => defineHelpdeskConversations(), []);
  return createElement(HostElement, {
    tag: 'helpdesk-conversations',
    ...props,
  });
}

function HostElement({
  tag,
  context,
  types,
  orgId,
  identityToken,
  appVersion,
  ...rest
}: Props & { tag: string }) {
  const ref = useRef<HTMLElement & { context: Record<string, string> }>(null);

  useEffect(() => {
    if (ref.current) ref.current.context = context ?? {};
  }, [context]);

  return createElement(tag, {
    ref,
    ...rest,
    types: types?.join(','),
    org: orgId,
    'identity-token': identityToken,
    'app-version': appVersion,
  });
}
