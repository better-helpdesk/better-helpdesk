'use client';

import { createElement, type Ref, useCallback, useEffect, useRef } from 'react';

import {
  defineHelpdeskConversations,
  defineHelpdeskWidget,
  type HelpdeskWidgetElement,
} from './element';

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
  /** `auto` follows the operating system's dark mode. */
  theme?: 'auto';
  /** The element, for its `open({ type })` method. */
  ref?: Ref<HelpdeskWidgetElement>;
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
  ref: hostRef,
  ...rest
}: Props & { tag: string; define: () => void }) {
  const ref = useRef<HelpdeskWidgetElement>(null);
  // The host's ref and the wrapper's own both get the element.
  const setRef = useCallback(
    (element: HelpdeskWidgetElement | null) => {
      ref.current = element;
      if (typeof hostRef === 'function') hostRef(element);
      else if (hostRef) hostRef.current = element;
    },
    [hostRef]
  );

  // Before the context effect: set on an element not yet defined, `context`
  // would become a plain property that hides the element's own setter.
  useEffect(() => define(), [define]);

  useEffect(() => {
    if (ref.current) ref.current.context = context ?? {};
  }, [context]);

  return createElement(tag, {
    ref: setRef,
    ...rest,
    types: types?.join(','),
    org: orgId,
    'identity-token': identityToken,
    'app-version': appVersion,
  });
}
