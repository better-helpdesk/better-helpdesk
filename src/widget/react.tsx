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
  return createElement(HostElement, {
    tag: 'helpdesk-widget',
    define: defineHelpdeskWidget,
    ...props,
  });
}

/** React wrapper around `<helpdesk-conversations>`, for an in-app Support page. */
export function HelpdeskConversations(props: Omit<Props, 'label'>) {
  return createElement(HostElement, {
    tag: 'helpdesk-conversations',
    define: defineHelpdeskConversations,
    ...props,
  });
}

function HostElement({
  tag,
  define,
  context,
  types,
  orgId,
  identityToken,
  appVersion,
  ...rest
}: Props & { tag: string; define: () => void }) {
  const ref = useRef<HTMLElement & { context: Record<string, string> }>(null);

  // Before the context effect: set on an element not yet defined, `context`
  // would become a plain property that hides the element's own setter.
  useEffect(() => define(), [define]);

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
