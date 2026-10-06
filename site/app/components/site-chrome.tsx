import type { ReactNode } from 'react';
import { SiGithub, SiNpm } from 'react-icons/si';

import { ButtonIcon } from './icons';
import { LiveMark } from './live-mark';
import { NavLinks, NavMenu } from './nav-links';

const REPO = 'https://github.com/better-helpdesk/better-helpdesk';

/**
 * The one header every page shares. On subpages the links lead back to the
 * home page's sections; `end` replaces them, as on the inbox.
 */
export function SiteHeader({
  home = false,
  end,
}: {
  home?: boolean;
  end?: ReactNode;
}) {
  return (
    <header className="nav">
      <a className="brand" href={home ? '#top' : '/'}>
        <span className="mk mk-24">
          <LiveMark fg="#fff" bg="#000" />
        </span>
        <span>Better Helpdesk</span>
      </a>
      {end ? (
        <div className="nav-end">{end}</div>
      ) : (
        <>
          <NavLinks base={home ? '' : '/'} />
          <div className="nav-end">
            <a className="nav-gh" href={REPO}>
              <SiGithub aria-hidden="true" />
              <span>Source</span>
            </a>
            <a className="btn btn-p btn-sm nav-cta" href="/quickstart/">
              Quickstart
              <ButtonIcon />
            </a>
            <NavMenu base={home ? '' : '/'} repo={REPO} />
          </div>
        </>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="foot">
      <div className="f-brand">
        <span className="mk mk-48">
          <LiveMark fg="#fff" bg="#000" />
        </span>
        <div>
          <b>Better Helpdesk</b>
          <p>The open-source helpdesk that lives inside your Next.js app.</p>
        </div>
      </div>
      <ul>
        <li>
          <a className="f-ico" href={REPO}>
            <SiGithub aria-hidden="true" />
            GitHub
          </a>
        </li>
        <li>
          <a
            className="f-ico"
            href="https://www.npmjs.com/package/better-helpdesk">
            <SiNpm aria-hidden="true" />
            npm
          </a>
        </li>
        <li>
          <a href="/quickstart/">Quickstart</a>
        </li>
        <li>
          <a href={`${REPO}/releases`}>Changelog</a>
        </li>
        <li>
          <a href="/demo/">Live demo</a>
        </li>
      </ul>
      <ul>
        <li>
          <a href={`${REPO}/blob/main/LICENSE`}>MIT licence</a>
        </li>
        <li>
          <a href={`${REPO}/security/advisories/new`}>Report a vulnerability</a>
        </li>
        <li>
          <a href="/privacy/">Privacy</a>
        </li>
        <li>
          <a href="/styleguide/">Styleguide</a>
        </li>
        <li>
          <a href="#top">Back to top</a>
        </li>
      </ul>
    </footer>
  );
}
