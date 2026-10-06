import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { currentSession } from '../../../lib/auth';
import { LiveMark } from '../components/live-mark';
import { LoginForm } from '../components/login-form';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

export default async function Page() {
  if (await currentSession()) redirect('/helpdesk/');
  return (
    <main className="login">
      <a className="login-mark mk mk-48" href="/" aria-label="Better Helpdesk">
        <LiveMark fg="#fff" bg="#000" />
      </a>
      <h1>Sign in to the inbox.</h1>
      <LoginForm />
    </main>
  );
}
