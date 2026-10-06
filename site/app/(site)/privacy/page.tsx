import type { Metadata } from 'next';

import { SiteFooter, SiteHeader } from '../components/site-chrome';

export const metadata: Metadata = {
  title: 'Privacy',
  description:
    'What this site collects when you write to us, why, where it is kept and how to have it deleted.',
};

const SECTIONS: { title: string; text: string[] }[] = [
  {
    title: 'Who is responsible',
    text: [
      'This site and the data it collects are run by the Better Helpdesk project. To ask about your data, or to have it changed or deleted, write to us through "Ask a question" in the corner of any page.',
    ],
  },
  {
    title: 'What we collect',
    text: [
      'Only what you send us. When you ask a question, tell us your story or join the continuity list, we store your name, your email address, your message, any company or website you enter and, for supporter stories, whether we may list your company.',
      'A question about a bug or a feature also carries the page you were on, its title, your browser, your window size and language, and the last error on the page. The form shows all of it before you send, and you can untick it. Other messages carry the first page of your visit, the site that sent you there and any campaign tags in its link.',
      'To stop abuse, we count anonymous messages per IP address for an hour. The address is not stored with your message.',
    ],
  },
  {
    title: 'Why',
    text: [
      'To answer you, to follow up on what you asked, and to contact you about the managed standby if you joined that list. We do not send newsletters and we do not sell or share your data.',
    ],
  },
  {
    title: 'Analytics and cookies',
    text: [
      'We count visits and clicks with PostHog, hosted in the EU, in its cookieless mode: it stores nothing in your browser, drops your IP address, and tells visitors apart only by a hash that changes every day. We do not record sessions, show ads or follow you to other sites. After you write, the widget keeps a token in your browser’s local storage so you can find your conversation again, and it remembers the first page of your visit until you close the tab. The live demo sets a cookie with the role you pick there and nothing else. Our team’s sign-in uses a session cookie that visitors never receive, and nothing from the team’s pages goes to PostHog.',
    ],
  },
  {
    title: 'Where it is kept',
    text: [
      'In this site’s own Postgres database, hosted with Divio. Replies go out by email through our mail provider, and visit counts go to PostHog in the EU. Beyond those three, nobody receives your data.',
    ],
  },
  {
    title: 'How long',
    text: [
      'Until the conversation is no longer needed, or until you ask us to delete it. What you write in the live demo is deleted within fifteen minutes, when the demo starts over. Ask through the widget and we delete your conversations and contact record.',
    ],
  },
  {
    title: 'Your rights',
    text: [
      'You can ask what we hold about you, have it corrected or deleted, and object to its use. If you think we handle your data wrongly, you can complain to the Swiss Federal Data Protection and Information Commissioner (FDPIC) or to the authority in your country.',
    ],
  },
];

export default function Privacy() {
  return (
    <>
      <SiteHeader />
      <main className="qs" id="top">
        <section className="qs-hero">
          <span className="eyebrow">Privacy</span>
          <h1>What happens to what you send us.</h1>
          <p className="sub">
            This covers the Better Helpdesk website. The npm package itself
            collects nothing and calls no one; what it stores in your app is
            yours.
          </p>
        </section>
        <div className="legal">
          {SECTIONS.map(section => (
            <section key={section.title} className="qs-body">
              <h2>{section.title}</h2>
              {section.text.map(p => (
                <p key={p}>{p}</p>
              ))}
            </section>
          ))}
          <p className="caveat">Last updated 5 October 2026.</p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
