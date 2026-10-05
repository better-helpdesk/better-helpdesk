// Demo data for the product showcase. Invented people on .test domains, as
// AGENTS.md asks; the labels are the agent UI's own strings.

export type Row = {
  ref: string;
  subject: string;
  who: string;
  company: string;
  inbox: string;
  priority: 'normal' | 'high' | 'urgent';
  waiting: string;
  level: '' | 'warn' | 'late';
  hue: number;
  active?: boolean;
  fresh?: boolean;
};

export const ROWS: Row[] = [
  {
    ref: 'ACME-1036',
    subject: 'Rechnung als PDF auf Deutsch?',
    who: 'Kofi Mensah',
    company: 'Kestrel',
    inbox: 'support',
    priority: 'normal',
    waiting: '26h',
    level: 'late',
    hue: 95,
  },
  {
    ref: 'ACME-1039',
    subject: 'Can we get SSO on the Team plan?',
    who: 'Ana Ruiz',
    company: 'Pine Labs',
    inbox: 'sales',
    priority: 'urgent',
    waiting: '7h',
    level: 'warn',
    hue: 340,
  },
  {
    ref: 'ACME-1041',
    subject: 'Export to CSV times out on large ranges',
    who: 'Theo Brandt',
    company: 'Kestrel',
    inbox: 'support',
    priority: 'high',
    waiting: '1h 12m',
    level: '',
    hue: 190,
  },
  {
    ref: 'ACME-1042',
    subject: 'Invoice shows the old VAT number',
    who: 'Mira Okafor',
    company: 'Northwind',
    inbox: 'support',
    priority: 'normal',
    waiting: '4m',
    level: '',
    hue: 24,
    active: true,
  },
];

/** Arrives in the demo inbox a moment after it scrolls into view. */
export const ARRIVING: Row = {
  ref: 'ACME-1043',
  subject: 'Can I export the audit log as CSV?',
  who: 'Lena Fischer',
  company: 'Pine Labs',
  inbox: 'support',
  priority: 'normal',
  waiting: '0m',
  level: '',
  hue: 300,
  fresh: true,
};

export const initials = (name: string) =>
  name
    .split(' ')
    .map(part => part[0])
    .join('');

export const BOARD: [string, [string, string, number, string][]][] = [
  [
    'new',
    [
      ['Pine Labs', 'Team plan', 2880, '2 days'],
      ['Elm & Co', 'Starter', 960, '5 days'],
    ],
  ],
  ['qualified', [['Kestrel', 'Pro upgrade', 6000, '6 days']]],
  ['proposal', [['Northwind', 'Team annual', 4800, '3 days']]],
  ['won', [['Alder Studio', 'Team', 2400, '1 week']]],
];

export const usd = (value: number) => `$${value.toLocaleString('en-US')}`;

// Per agent per month, billed monthly.
export const PLANS: [string, number][] = [
  ['Intercom Essential', 29],
  ['Zendesk Support Team', 25],
  ['Freshdesk Growth', 20],
  ['HubSpot', 20],
];

export const WALL = [
  'Kofi Mensah',
  'Yuki Sato',
  'Tomás Silva',
  'Priya Nair',
  'Elif Kaya',
  'Sam Becker',
  'Noor Haddad',
  'Ivo Petrov',
  'Lea Roth',
  'Omar Aziz',
  'Mira Okafor',
  'Mei Lin',
  'Felix Graf',
  'Sara Costa',
  'Ben Adler',
  'Ines Moreau',
  'Ravi Shah',
  'Hana Novak',
  'Luca Bianchi',
  'Zoe Park',
  'Arjun Rao',
  'Nina Berg',
  'Oskar Lind',
  'Maya Cohen',
  'Theo Brandt',
  'Ana Ruiz',
  'Lena Fischer',
  'Jonas Weber',
];
export const WALL_ME = 10;

// In the order a message travels: widget, handler, identify, agent UI.
export const FILES: [string, string][] = [
  [
    'layout.tsx',
    `// app/layout.tsx
import { HelpdeskWidget } from 'better-helpdesk/widget';

export default function Layout({ children }) {
  return <>{children}<HelpdeskWidget inbox="support" /></>;
}`,
  ],
  [
    'route.ts',
    `// app/api/helpdesk/[...slug]/route.ts
import { helpdesk } from '@/lib/helpdesk';

const handle = (request: Request) => helpdesk.handler(request);

export { handle as GET, handle as POST, handle as PATCH,
         handle as DELETE, handle as OPTIONS };`,
  ],
  [
    'helpdesk.ts',
    `// lib/helpdesk.ts
identify: async request => {
  const session = await getSession(request);
  if (!session) return null; // an anonymous visitor
  return {
    user: session.user,
    orgs: session.orgs,
    isAgent: session.user.role === 'support',
  };
},`,
  ],
  [
    'page.tsx',
    `// app/helpdesk/[[...slug]]/page.tsx
import { HelpdeskAdmin } from 'better-helpdesk/admin';

export default function Page() {
  return <HelpdeskAdmin api="/api/helpdesk" basePath="/helpdesk" />;
}`,
  ],
];

type Strings = {
  title: string;
  promise: string;
  types: [string, string, string, string][];
  message: string;
  context: (n: number) => string;
  contextHeading: string;
  contextHint: string;
  page: string;
  viewport: string;
  errors: string;
  screenshot: string;
  send: string;
  back: string;
  confirm: (reference: string) => string;
  book: string;
  waiting: (n: number) => string;
  openInbox: string;
};

// The widget's own strings from src/ui/i18n.ts, English and Swiss German;
// the promise is this site's own, so the demo and the real launcher agree.
export const WIDGET: Record<'en' | 'de', Strings> = {
  en: {
    title: 'Help & support',
    promise: 'We read every message and usually reply within two working days.',
    types: [
      [
        'Question',
        'How do I…?',
        'What would you like to know?',
        'Thank you for your question',
      ],
      [
        'Report a bug',
        'Something is not working',
        'What did you do, what did you expect, and what happened instead?',
        'Thank you for reporting this',
      ],
      [
        'Suggest a feature',
        'What would make your work easier?',
        'Which problem would it solve for you?',
        'Thank you for your suggestion',
      ],
      [
        'Talk to us',
        'Pricing, a demo or anything else',
        'What can we help you with?',
        'Thank you for your message',
      ],
    ],
    message: 'Message',
    context: n => `${n} details about this page`,
    contextHeading: 'Sent with your message',
    contextHint: 'Untick anything you do not want to share.',
    page: 'Page',
    viewport: 'Window size',
    errors: 'Recent errors',
    screenshot: 'Capture screenshot',
    send: 'Send message',
    back: 'Back',
    confirm: r =>
      `We'll get back to you as soon as possible. You'll be notified here, under ${r}.`,
    book: 'Book a 30-minute call',
    waiting: n => `${n} conversations are waiting in the support inbox`,
    openInbox: 'Open inbox',
  },
  de: {
    title: 'Hilfe & Support',
    promise:
      'Wir lesen jede Nachricht und antworten meist innerhalb von zwei Arbeitstagen.',
    types: [
      [
        'Frage',
        'Wie mache ich…?',
        'Was möchten Sie wissen?',
        'Vielen Dank für Ihre Frage',
      ],
      [
        'Fehler melden',
        'Etwas funktioniert nicht',
        'Was haben Sie gemacht, was haben Sie erwartet und was ist stattdessen passiert?',
        'Vielen Dank für Ihre Meldung',
      ],
      [
        'Funktion vorschlagen',
        'Was würde Ihnen die Arbeit erleichtern?',
        'Welches Problem würde es für Sie lösen?',
        'Vielen Dank für Ihren Vorschlag',
      ],
      [
        'Mit uns sprechen',
        'Preise, Demo oder etwas anderes',
        'Wobei können wir helfen?',
        'Vielen Dank für Ihre Nachricht',
      ],
    ],
    message: 'Nachricht',
    context: n => `${n} Angaben zu dieser Seite`,
    contextHeading: 'Wird mit Ihrer Nachricht gesendet',
    contextHint:
      'Entfernen Sie das Häkchen bei allem, was Sie nicht teilen möchten.',
    page: 'Seite',
    viewport: 'Fenstergrösse',
    errors: 'Letzte Fehler',
    screenshot: 'Bildschirmfoto aufnehmen',
    send: 'Nachricht senden',
    back: 'Zurück',
    confirm: r =>
      `Wir melden uns so bald wie möglich. Sie werden hier benachrichtigt (Referenz ${r}).`,
    book: 'Buchen Sie ein 30-Minuten-Gespräch',
    waiting: n => `${n} Unterhaltungen warten im Support-Posteingang`,
    openInbox: 'Posteingang öffnen',
  },
};
