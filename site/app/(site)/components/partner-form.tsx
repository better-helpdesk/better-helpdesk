'use client';

import posthog from 'posthog-js';
import { type FormEvent, useState } from 'react';

import { isEmail, sendToInbox } from '../../../lib/submit';
import { ButtonIcon } from './icons';

type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'error'; message: string };

/**
 * Supporter stories go through the package's own widget API into the
 * "partners" inbox, so this form is Better Helpdesk dogfooding itself.
 */
export function PartnerForm({ api }: { api: string }) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [invalid, setInvalid] = useState<string[]>([]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? '').trim();
    const missing = ['name', 'email', 'story'].filter(key => !value(key));
    if (!isEmail(value('email')) && !missing.includes('email'))
      missing.push('email');
    setInvalid(missing);
    if (missing.length) {
      setState({
        kind: 'error',
        message: 'Add your name, a work email and your story.',
      });
      return;
    }
    const listed = form.get('listed') === 'on';
    setState({ kind: 'sending' });
    try {
      await sendToInbox(api, {
        inbox: 'partners',
        name: value('name'),
        email: value('email'),
        subject: `Supporter story: ${value('company') || value('name')}`,
        body: [
          value('story'),
          '',
          `Company: ${value('company') || 'not given'}`,
          `Website: ${value('site') || 'not given'}`,
          `May list as a supporter: ${listed ? 'yes' : 'no'}`,
        ].join('\n'),
        host: { listed: listed ? 'yes' : 'no' },
        // The handler's spam trap: people never see this field.
        website: value('website'),
      });
      posthog.capture('story_submitted', { listed });
      setState({ kind: 'sent' });
    } catch (error) {
      setState({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Try again.',
      });
    }
  }

  if (state.kind === 'sent') {
    return (
      <div className="partner" role="status">
        <h3>Thanks, your story reached us.</h3>
        <p>
          If you ticked the box, we'll check with you before your name goes on
          the site.
        </p>
      </div>
    );
  }

  const bad = (key: string) => (invalid.includes(key) ? true : undefined);
  return (
    <form className="partner" onSubmit={submit} noValidate>
      <h3>Tell us your story</h3>
      <p>
        How are you using Better Helpdesk, or what are you planning to build
        with it? If you agree, we'll list you as a supporter.
      </p>
      <div className="f2">
        <label htmlFor="p-name">
          Name
          <input
            id="p-name"
            name="name"
            autoComplete="name"
            aria-invalid={bad('name')}
            placeholder="Jane Doe"
          />
        </label>
        <label htmlFor="p-mail">
          Work email
          <input
            id="p-mail"
            name="email"
            type="email"
            autoComplete="email"
            aria-invalid={bad('email')}
            placeholder="jane@company.com"
          />
        </label>
      </div>
      <div className="f2">
        <label htmlFor="p-company">
          Company
          <input
            id="p-company"
            name="company"
            autoComplete="organization"
            placeholder="Company name"
          />
        </label>
        <label htmlFor="p-site">
          <span>
            Website <span className="opt">(optional)</span>
          </span>
          <input
            id="p-site"
            name="site"
            type="url"
            autoComplete="url"
            placeholder="https://"
          />
        </label>
      </div>
      <label htmlFor="p-story">
        Your story
        <textarea
          id="p-story"
          name="story"
          rows={4}
          aria-invalid={bad('story')}
          placeholder="What you're building, why you looked at support tooling, what's missing"
        />
      </label>
      <label className="trap" htmlFor="p-trap" aria-hidden="true">
        Website
        <input id="p-trap" name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="chk" htmlFor="p-listed">
        <input id="p-listed" name="listed" type="checkbox" /> You may list our
        company name and logo on this site. We'll confirm with you first.
      </label>
      {state.kind === 'error' && (
        <p className="f-msg err" role="alert">
          {state.message}
        </p>
      )}
      <button
        className="btn btn-p"
        type="submit"
        disabled={state.kind === 'sending'}>
        {state.kind === 'sending' ? 'Sending…' : 'Send your story'}
        <ButtonIcon />
      </button>
    </form>
  );
}
