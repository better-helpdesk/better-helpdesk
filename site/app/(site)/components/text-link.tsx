import type { MouseEventHandler, ReactNode } from 'react';

/** The site's dotted text link: an anchor with `href`, a button without. */
export function TextLink({
  href,
  onClick,
  disabled,
  children,
}: {
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  children: ReactNode;
}) {
  if (href) {
    return (
      <a className="tlink" href={href}>
        {children}
      </a>
    );
  }
  return (
    <button
      className="tlink"
      type="button"
      onClick={onClick}
      disabled={disabled}>
      {children}
    </button>
  );
}
