import type { Metadata } from 'next';
import { PiArrowUpRightBold } from 'react-icons/pi';

import { highlight } from '../components/highlight';
import { ButtonIcon } from '../components/icons';
import { SiteFooter, SiteHeader } from '../components/site-chrome';
import { TextLink } from '../components/text-link';

export const metadata: Metadata = {
  title: 'Quickstart',
  description:
    'Install Better Helpdesk in an existing Next.js app: one package, one schema, one route handler, the agent UI and the widget.',
};

const REPO = 'https://github.com/better-helpdesk/better-helpdesk';

// The README's quickstart, step for step; the README stays the reference.
const STEPS: { title: string; text: string; file: string; code: string }[] = [
  {
    title: 'Install the package',
    text: 'react and react-dom are peer dependencies that a Next.js app already has.',
    file: 'terminal',
    code: 'npm install better-helpdesk pg',
  },
  {
    title: 'Create the schema',
    text: 'The CLI opens one connection, creates the helpdesk schema and its tables, and exits, so it fits into a release step next to your own migrations.',
    file: 'terminal',
    code: 'HELPDESK_DATABASE_URL=postgres://… npx better-helpdesk-migrate',
  },
  {
    title: 'Let Next.js compile the package',
    text: 'Both UIs request paths with a trailing slash. Without it, every call pays a redirect first, and a widget on another origin fails its CORS preflight.',
    file: 'next.config.mjs',
    code: `import { withHelpdesk } from 'better-helpdesk/next';

export default withHelpdesk({ trailingSlash: true });`,
  },
  {
    title: 'Build the helpdesk and mount the handler',
    text: 'identify runs on every request. Return null for an anonymous visitor. adminUrl must be the URL your team opens: the handler refuses mutations from any other origin.',
    file: 'lib/helpdesk.ts',
    code: `import { buildHelpdesk, postgresAdapter } from 'better-helpdesk';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.HELPDESK_DATABASE_URL });

export const helpdesk = buildHelpdesk({
  db: postgresAdapter({ pool }),
  referencePrefix: 'ACME',
  adminUrl: 'https://app.example.com/helpdesk/',
  inboxes: { support: { receipt: true } },
  identify: async request => {
    const session = await getSession(request); // however your app does it
    if (!session) return null; // an anonymous visitor
    return {
      user: { id: session.user.id, email: session.user.email, emailVerified: true, name: session.user.name },
      orgs: session.orgs.map(org => ({ id: org.id, name: org.name })),
      isAgent: session.user.role === 'support',
    };
  },
});`,
  },
  {
    title: 'Mount the route handler',
    text: 'One handler serves the widget, the agent UI, inbound mail and jobs under your basePath.',
    file: 'app/api/helpdesk/[...slug]/route.ts',
    code: `import { helpdesk } from '@/lib/helpdesk';

const handle = (request: Request) => helpdesk.handler(request);
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE, handle as OPTIONS };`,
  },
  {
    title: 'Render the agent UI',
    text: 'Put the page behind your own agent check as well. The API refuses anyone who is not an agent either way.',
    file: 'app/helpdesk/[[...slug]]/page.tsx',
    code: `import { HelpdeskAdmin } from 'better-helpdesk/admin';

export default function Page() {
  return <HelpdeskAdmin api="/api/helpdesk" basePath="/helpdesk" locale="en" />;
}`,
  },
  {
    title: 'Add the widget',
    text: 'Send a message from the widget, open /helpdesk as an agent and answer it. That is the whole loop.',
    file: 'app/layout.tsx',
    code: `import { HelpdeskWidget } from 'better-helpdesk/widget';

export function Layout({ children }) {
  return (
    <>
      {children}
      <HelpdeskWidget inbox="support" locale="en" />
    </>
  );
}`,
  },
];

export default function Quickstart() {
  return (
    <>
      <SiteHeader />
      <main className="qs" id="top">
        <section className="qs-hero">
          <span className="eyebrow">Quickstart</span>
          <h1>From install to your first answer.</h1>
          <p className="sub">
            Seven steps in an existing Next.js app. You need Node 22.19,
            PostgreSQL 14, React 19 and Next.js 15 or newer.
          </p>
        </section>
        <ol className="qs-steps">
          {STEPS.map((step, i) => (
            <li key={step.title} className="qs-step">
              <span className="qs-n" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="qs-body">
                <h2>{step.title}</h2>
                <p>{step.text}</p>
                <div className="code">
                  <div className="code-tabs">
                    <span className="qs-file">{step.file}</span>
                  </div>
                  <pre>
                    <code>{highlight(step.code)}</code>
                  </pre>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <section className="qs-next">
          <h2>Next: the guides.</h2>
          <p className="sub">
            Email in and out, jobs and retention, storage, AI, theming and
            signed-in users on another origin are in the README.
          </p>
          <div className="row-cta">
            <a className="btn btn-p" href={`${REPO}#guides`}>
              Read the guides
              <ButtonIcon />
            </a>
            <TextLink href={`${REPO}/tree/main/examples/demo`}>
              Run the demo app
              <PiArrowUpRightBold className="ti" aria-hidden="true" />
            </TextLink>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
