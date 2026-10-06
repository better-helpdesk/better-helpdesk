'use client';

import { type FormEvent, useState } from 'react';

import { ButtonIcon } from './icons';

export function LoginForm() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    const response = await fetch('/api/auth/sign-in/email/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: String(form.get('email') ?? '').trim(),
        password: String(form.get('password') ?? ''),
      }),
    }).catch(() => null);
    if (response?.ok) {
      location.assign('/helpdesk/');
      return;
    }
    setBusy(false);
    setError(
      response?.status === 429
        ? 'Too many attempts. Wait a minute, then try again.'
        : response
          ? 'That email and password do not match an account.'
          : 'That did not go through. Check your connection and try again.'
    );
  }

  return (
    <form className="partner login-form" onSubmit={submit}>
      <label htmlFor="l-mail">
        Email
        <input
          id="l-mail"
          name="email"
          type="email"
          autoComplete="username"
          required
          aria-invalid={error ? true : undefined}
        />
      </label>
      <label htmlFor="l-pass">
        Password
        <input
          id="l-pass"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={error ? true : undefined}
        />
      </label>
      {error && (
        <p className="f-msg err" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-p" type="submit" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
        <ButtonIcon />
      </button>
    </form>
  );
}
