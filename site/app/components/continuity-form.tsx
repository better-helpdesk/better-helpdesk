'use client';

import posthog from 'posthog-js';
import { type FormEvent, useState } from 'react';

import { isEmail, sendToInbox } from '../../lib/submit';
import { ButtonIcon } from './icons';

type State = 'idle' | 'sending' | 'sent' | { error: string };

export function ContinuityForm({ api }: { api: string }) {
  const [state, setState] = useState<State>('idle');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    if (!isEmail(email)) {
      setState({ error: 'Enter an email address like you@company.com.' });
      return;
    }
    const pay = form.get('pay') === 'on';
    setState('sending');
    try {
      await sendToInbox(api, {
        inbox: 'continuity',
        email,
        subject: 'Continuity list',
        body: `Joined the private continuity list. Would pay: ${pay ? 'yes' : 'not said'}.`,
        host: { pay: pay ? 'yes' : 'no' },
        website: String(form.get('website') ?? ''),
      });
      posthog.capture('continuity_joined', { would_pay: pay });
      setState('sent');
    } catch (error) {
      setState({
        error: error instanceof Error ? error.message : 'Try again.',
      });
    }
  }

  if (state === 'sent') {
    return (
      <p className="cont-ok" role="status">
        You're on the list. We'll write when there's something to try.
      </p>
    );
  }
  return (
    <form className="cont-form" onSubmit={submit} noValidate>
      <label className="vh" htmlFor="c-mail">
        Email
      </label>
      <input
        id="c-mail"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@company.com"
        aria-invalid={typeof state === 'object' ? true : undefined}
      />
      <label className="trap" htmlFor="c-site" aria-hidden="true">
        Website
        <input id="c-site" name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <button
        className="btn btn-p btn-sm"
        type="submit"
        disabled={state === 'sending'}>
        {state === 'sending' ? 'Joining…' : 'Get on the list'}
        <ButtonIcon />
      </button>
      <label className="chk" htmlFor="c-pay">
        <input id="c-pay" name="pay" type="checkbox" /> I'd pay for this.
      </label>
      {typeof state === 'object' && (
        <p className="f-msg err" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
