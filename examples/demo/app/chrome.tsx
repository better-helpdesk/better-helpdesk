import { type DemoRole, ROLES } from '../lib/role';

const REPO = 'https://github.com/better-helpdesk/better-helpdesk';

/** The host product's own chrome, so the widget has something to sit in. */
export function Bar({ here }: { here: 'site' | 'support' | 'helpdesk' }) {
  return (
    <header className="bar">
      <a className="brand" href="/">
        <span className="brand-mark" aria-hidden="true">
          H
        </span>
        Harbor
      </a>
      <span className="bar-spacer" />
      <nav>
        <a href="/" aria-current={here === 'site' ? 'page' : undefined}>
          Overview
        </a>
        <a
          href="/support/"
          aria-current={here === 'support' ? 'page' : undefined}>
          Support
        </a>
        <a
          href="/helpdesk/"
          aria-current={here === 'helpdesk' ? 'page' : undefined}>
          Agent inbox
        </a>
      </nav>
      <label className="theme">
        <input id="theme" type="checkbox" />
        <span className="theme-track" />
        <span>Dark</span>
      </label>
    </header>
  );
}

/**
 * A plain form POST, so the whole page reloads: the widget has already read
 * its session, and a soft navigation would leave it showing the old identity.
 */
export function RoleSwitcher({ role }: { role: DemoRole }) {
  return (
    <form className="roles" method="post" action="/role/">
      {ROLES.map(option => (
        <button
          key={option.id}
          type="submit"
          name="role"
          value={option.id}
          className="role"
          aria-pressed={role === option.id}>
          <span className="role-name">{option.label}</span>
          <span className="role-note">{option.note}</span>
        </button>
      ))}
    </form>
  );
}

export function Foot() {
  return (
    <footer>
      <div className="foot">
        <span>Harbor is make-believe. The helpdesk is not.</span>
        <span className="foot-spacer" />
        <a href={REPO}>Source</a>
        <a href={`${REPO}#readme`}>Setup</a>
        <a href="https://www.npmjs.com/package/better-helpdesk">npm</a>
        <a href={`${REPO}/blob/main/LICENSE`}>MIT</a>
      </div>
    </footer>
  );
}
