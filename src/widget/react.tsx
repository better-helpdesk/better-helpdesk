'use client';

import { createElement, useEffect, useRef } from 'react';

import { defineHelpdeskWidget } from './element';

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
export function HelpdeskWidget({
  context,
  types,
  orgId,
  identityToken,
  appVersion,
  ...rest
}: Props) {
  const ref = useRef<HTMLElement & { context: Record<string, string> }>(null);

  useEffect(() => defineHelpdeskWidget(), []);

  useEffect(() => {
    if (ref.current) ref.current.context = context ?? {};
  }, [context]);

  return createElement('helpdesk-widget', {
    ref,
    ...rest,
    types: types?.join(','),
    org: orgId,
    'identity-token': identityToken,
    'app-version': appVersion,
  });
}
