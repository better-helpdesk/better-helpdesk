import helpdeskPackage from 'better-helpdesk/package.json';
import {
  PiArrowRightBold,
  PiArrowUpRightBold,
  PiPlusBold,
} from 'react-icons/pi';

import { API } from '../lib/helpdesk';
import { ContinuityForm } from './components/continuity-form';
import { Install } from './components/copy';
import { Cost } from './components/cost';
import { FaqAside } from './components/faq-aside';
import { ButtonIcon } from './components/icons';
import { LiveMark } from './components/live-mark';
import { Face } from './components/mark';
import { MiniInbox } from './components/mini-inbox';
import { PartnerForm } from './components/partner-form';
import { Pieces } from './components/pieces';
import { Showcase } from './components/showcase';
import { SiteFooter, SiteHeader } from './components/site-chrome';
import { Sponsor } from './components/sponsor';
import { TextLink } from './components/text-link';
import { Wall } from './components/wall';
import { WidgetDemo } from './components/widget-demo';

const REPO = 'https://github.com/better-helpdesk/better-helpdesk';

export default function Home() {
  return (
    <>
      <a className="skip" href="#product">
        Skip to the product
      </a>
      <SiteHeader home />

      <main id="top">
        <section className="hero" aria-labelledby="hero-h">
          <div className="hero-l">
            <span className="eyebrow">Open source · MIT · npm</span>
            <h1 id="hero-h">
              Your helpdesk, <em>inside</em> your app.
            </h1>
            <p className="sub">
              An open-source support inbox, ticketing and lightweight CRM you
              install from npm. It runs in your Next.js app, on your Postgres,
              behind your login.
            </p>
            <div className="hero-cta">
              <a className="btn btn-p" href="/quickstart/">
                Read the quickstart
                <ButtonIcon />
              </a>
              <Install />
            </div>
          </div>
          <Wall />
        </section>

        <section className="facts" aria-label="At a glance">
          <div>
            <b>MIT</b>
            <span>no paid features in the package</span>
          </div>
          <div>
            <b>4</b>
            <span>runtime dependencies</span>
          </div>
          <div>
            <b>Postgres 14+</b>
            <span>
              a <code>helpdesk</code> schema in yours
            </span>
          </div>
          <div>
            <b>Next.js 15+</b>
            <span>React 19, Node 20</span>
          </div>
        </section>

        <section className="sec showcase" id="product" aria-labelledby="sc-h">
          <div className="sh rv">
            <h2 id="sc-h">
              One inbox for every conversation your product starts.
            </h2>
            <p className="sub">
              Widget, email and CRM, inside the app your team already signs in
              to.
            </p>
          </div>
          <Showcase />
        </section>

        <section className="sec pieces" id="pieces" aria-labelledby="pc-h">
          <div className="sh split rv">
            <h2 id="pc-h">It mounts. It doesn't deploy.</h2>
            <p className="sub">
              One route handler, one React component, one widget. Your session
              decides who is a customer and who is on the team.
            </p>
          </div>
          <Pieces />
        </section>

        <section className="sec wsec" id="widget" aria-labelledby="w-h">
          <div className="sh rv">
            <h2 id="w-h">A widget your customers already understand.</h2>
            <p className="sub">
              One web component, themed with your CSS variables. It shows the
              customer the page, browser and last error it will attach, and they
              can untick any of it. The real one is in the corner of this page.
            </p>
          </div>
          <WidgetDemo />
        </section>

        <section className="sec box" id="box" aria-labelledby="b-h">
          <div className="sh split rv">
            <h2 id="b-h">Everything a small support team needs.</h2>
            <p className="sub">
              Sized for one to ten people answering customers. Every colleague
              can be an agent at no extra cost.
            </p>
          </div>
          <div className="bento">
            <article className="rv cell c-inbox">
              <h3>Shared inboxes</h3>
              <p>
                Support and sales side by side, priorities, tags, canned
                replies, snooze, keyboard navigation and a reminder email before
                anyone waits too long.
              </p>
              <MiniInbox />
            </article>
            <article className="rv cell c-email">
              <h3>Email, both ways</h3>
              <p>
                Out through your sender. In by webhook from any relay, verified
                against DKIM and threaded by reference.
              </p>
              <dl className="kv">
                <dt>Reply-To</dt>
                <dd>support+ACME-1042@harbor.test</dd>
                <dt>DKIM</dt>
                <dd className="ok">verified</dd>
              </dl>
            </article>
            <article className="rv cell c-ai">
              <h3>AI that drafts</h3>
              <p>
                Your model, through one adapter, suggests type, priority and a
                reply. A person reads it and sends it.
              </p>
              <div className="ai-demo">
                <span className="a-btn">Draft with AI</span>
                <PiArrowRightBold className="arrow" aria-hidden="true" />
                <span className="cp-ai">Suggested</span>
              </div>
            </article>
            <article className="rv cell c-crm">
              <h3>A lightweight CRM</h3>
              <p>
                Contacts and companies from your app's own users, lead and deal
                stages you define, custom fields.
              </p>
              <div className="stages">
                <span>lead</span>
                <span>qualified</span>
                <span className="on">customer</span>
                <span>churned</span>
              </div>
            </article>
            <article className="rv cell c-ad">
              <h3>Adapters for the rest</h3>
              <p>Leave one out and that feature stays off.</p>
              <ul className="adl">
                <li>
                  storage <b>S3 bucket</b>
                </li>
                <li>
                  email <b>your sender</b>
                </li>
                <li>
                  inbound <b>Cloudflare relay</b>
                </li>
                <li>
                  ai <b>off</b>
                </li>
                <li>
                  help <b>your docs search</b>
                </li>
                <li>
                  jobs <b>cron, every 5 min</b>
                </li>
              </ul>
            </article>
          </div>
        </section>

        <section className="sec how" id="how" aria-labelledby="h-h">
          <div className="sh split rv">
            <h2 id="h-h">Four routes, one schema, your Postgres.</h2>
            <p className="sub">
              Visitors, your team, your mail relay and your scheduler each get
              one route group under your <code>basePath</code>.
            </p>
          </div>
          <div className="routes">
            <div className="route rv">
              <code>widget/*</code>
              <h3>Visitors and customers</h3>
              <p>
                The widget, as a React component or <code>widget.js</code> on
                any site you own.
              </p>
            </div>
            <div className="route rv">
              <code>agent/*</code>
              <h3>Your support team</h3>
              <p>
                Open only when your <code>identify</code> says{' '}
                <code>isAgent</code>.
              </p>
            </div>
            <div className="route rv">
              <code>inbound</code>
              <h3>Your mail relay</h3>
              <p>Posts each raw email with a bearer secret.</p>
            </div>
            <div className="route rv">
              <code>jobs</code>
              <h3>Your scheduler</h3>
              <p>
                Reminders, retention and queued work, in process or over HTTP.
              </p>
            </div>
          </div>
          <p className="sec-line">
            Stores no passwords and no sessions. Mutations are refused from any
            origin you haven't allowed. Inbound mail is checked against DKIM and
            marked verified or not. Identity tokens are signed and expire. Four
            runtime dependencies: <code>drizzle-orm</code>, <code>zod</code>,{' '}
            <code>mailparser</code>, <code>mailauth</code>.
          </p>
        </section>

        <section className="sec cost" id="cost" aria-labelledby="c-h">
          <div className="sh split rv">
            <h2 id="c-h">No seats. The next agent costs nothing.</h2>
            <p className="sub">
              The engineer who reads one thread a week and the founder who
              checks in on Mondays are agents too. Move the slider for a year at
              list price.
            </p>
          </div>
          <Cost />
          <p className="caveat">
            List prices per agent per month on monthly billing, not annual, as
            published by each vendor in October 2026. Excludes add-ons,
            usage-based AI fees and discounts. Better Helpdesk costs nothing to
            license; you pay for hosting you already run and the engineering
            time to integrate and maintain it.
          </p>
          <div className="row-cta">
            <Install />
            <TextLink href="#status">
              Using it, or planning to? Tell us your story
              <PiArrowRightBold className="ti" aria-hidden="true" />
            </TextLink>
          </div>
        </section>

        <section className="sec compare" id="compare" aria-labelledby="cm-h">
          <div className="sh split rv">
            <h2 id="cm-h">A library, not another app.</h2>
            <p className="sub">
              Hosted helpdesks keep your data and charge per seat. Self-hosted
              ones are a second app to run. This one is neither.
            </p>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="vh">Aspect</span>
                  </th>
                  <th scope="col" className="us">
                    Better Helpdesk
                  </th>
                  <th scope="col">Intercom, Zendesk</th>
                  <th scope="col">Chatwoot, Libredesk</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    [
                      'Runs',
                      'inside your Next.js app',
                      "on the vendor's servers",
                      'as a separate app you operate',
                    ],
                    [
                      'Customer data',
                      'your Postgres',
                      "the vendor's database",
                      'its own database',
                    ],
                    [
                      'Sign-in',
                      'your existing session',
                      'separate agent accounts',
                      'separate agent accounts',
                    ],
                    [
                      'Look and feel',
                      'your CSS custom properties',
                      'vendor theming',
                      'vendor theming',
                    ],
                    [
                      'Cost',
                      'MIT, free',
                      'per seat, per month',
                      'free, plus the hosting',
                    ],
                  ] as const
                ).map(([aspect, us, hosted, own]) => (
                  <tr key={aspect}>
                    <th scope="row">{aspect}</th>
                    <td className="us">{us}</td>
                    <td>{hosted}</td>
                    <td>{own}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="nots">
            <h3>What we won't do</h3>
            <ul>
              <li>No hosted mode and no second login.</li>
              <li>No AI that answers customers for you.</li>
              <li>No phone, no social channels, no help-centre CMS.</li>
              <li>No seats and no paid features in the package.</li>
            </ul>
          </div>
        </section>

        <section className="sec status" id="status" aria-labelledby="st-h">
          <div className="st-l">
            <h2 id="st-h">Young code, grown-up CI.</h2>
            <p className="sub">
              v{helpdeskPackage.version}, first published on 28 September 2026.
              Nothing merges until it passes every check below, and the design
              partners about to run it in production decide what ships next.
            </p>
            <ul className="checks" aria-label="Every pull request passes">
              <li>
                Biome and <code>tsc --noEmit</code>
              </li>
              <li>Unit tests</li>
              <li>Integration tests on real Postgres</li>
              <li>Packed tarball installed and imported</li>
              <li>Demo app built on two Next.js majors</li>
            </ul>
            <p className="caveat">Releases publish to npm with provenance.</p>
            <TextLink href={`${REPO}/releases`}>
              Read the changelog
              <PiArrowUpRightBold className="ti" aria-hidden="true" />
            </TextLink>
            <Sponsor />
          </div>
          <div className="st-r">
            <PartnerForm api={API} />
            <p className="f-note">
              This form runs on Better Helpdesk: your story goes straight into
              our inbox. <a href="/privacy/">How we handle it</a>.
            </p>
          </div>
        </section>

        <section className="cont" aria-labelledby="ct-h">
          <span className="mk mk-72 cont-face">
            <Face mood="sleep" fg="var(--fg)" bg="var(--bg)" />
          </span>
          <div className="cont-copy">
            <span className="eyebrow">Not public yet</span>
            <h2 id="ct-h">Support that stays up when your app doesn't.</h2>
            <p>
              We're quietly exploring a managed standby that keeps your widget
              and inbox reachable while your app is down, then hands everything
              back to your Postgres. Join the private list to hear about it
              first and help decide what it becomes.
            </p>
          </div>
          <ContinuityForm api={API} />
          <p className="f-note cont-note">
            Not built yet. The open-source package will never depend on it. No
            newsletter, only news about this. <a href="/privacy/">Privacy</a>.
          </p>
        </section>

        <section className="sec faq" id="faq" aria-labelledby="fq-h">
          <div className="sh rv">
            <h2 id="fq-h">Before you depend on it.</h2>
          </div>
          <div className="faq-grid">
            <div className="qa">
              <details className="rv">
                <summary>
                  <span>What if the project stops?</span>
                  <span className="qa-i" aria-hidden="true">
                    <PiPlusBold />
                  </span>
                </summary>
                <p>
                  It's MIT and lives in your repository and your Postgres, so
                  your helpdesk keeps running and you can fork it. The schema is
                  plain SQL in <code>migrations/</code>, and nothing calls home.
                </p>
              </details>
              <details className="rv">
                <summary>
                  <span>Can we move over from Intercom or Zendesk?</span>
                  <span className="qa-i" aria-hidden="true">
                    <PiPlusBold />
                  </span>
                </summary>
                <p>
                  There is no importer yet. Today it fits teams starting fresh
                  or willing to open a new inbox.
                </p>
              </details>
              <details className="rv">
                <summary>
                  <span>Does it work outside Next.js?</span>
                  <span className="qa-i" aria-hidden="true">
                    <PiPlusBold />
                  </span>
                </summary>
                <p>
                  The handler is a plain function from <code>Request</code> to{' '}
                  <code>Response</code>, so any server with that shape can mount
                  it. Next.js is the one the examples and CI cover.
                </p>
              </details>
              <details className="rv">
                <summary>
                  <span>Is the AI an agent?</span>
                  <span className="qa-i" aria-hidden="true">
                    <PiPlusBold />
                  </span>
                </summary>
                <p>
                  No. Here an agent is a person on your support team. AI only
                  suggests a triage or drafts a reply, and a person decides what
                  is sent.
                </p>
              </details>
              <details className="rv">
                <summary>
                  <span>What does the licence allow?</span>
                  <span className="qa-i" aria-hidden="true">
                    <PiPlusBold />
                  </span>
                </summary>
                <p>
                  MIT. Use it commercially, change it, ship it inside your
                  product. There are no paid features in the package.
                </p>
              </details>
              <details className="rv">
                <summary>
                  <span>Is this site running it?</span>
                  <span className="qa-i" aria-hidden="true">
                    <PiPlusBold />
                  </span>
                </summary>
                <p>
                  Yes. The launcher in the corner and the supporter form both
                  write into this site's own <code>helpdesk</code> schema, and
                  we answer from <code>&lt;HelpdeskAdmin /&gt;</code>.
                </p>
              </details>
            </div>
            <FaqAside />
          </div>
        </section>

        <section className="closer" aria-labelledby="cl-h">
          <span className="mk mk-96 closer-face">
            <LiveMark fg="var(--bg)" bg="var(--mint)" />
          </span>
          <h2 id="cl-h">Answer your first customer from your own app.</h2>
          <div className="row-cta center">
            <Install />
            <a className="btn btn-p" href="/quickstart/">
              Quickstart
              <ButtonIcon />
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
