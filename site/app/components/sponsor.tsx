import { PiArrowUpRightBold, PiHeartBold, PiStarBold } from 'react-icons/pi';

import { TextLink } from './text-link';

const REPO = 'https://github.com/better-helpdesk/better-helpdesk';

/** SITE_SPONSOR_URL turns on the sponsor link; without it only the star shows. */
export function Sponsor() {
  const url = process.env.SITE_SPONSOR_URL;
  return (
    <div className="sponsor">
      <h3>Help fund Better Helpdesk</h3>
      <p>
        Better Helpdesk is MIT and has no paid features. Sponsorship pays for
        the hours that go into fixes, tests and documentation.
      </p>
      <div className="row-cta">
        {url && (
          <a className="btn btn-p btn-sm" href={url}>
            <PiHeartBold aria-hidden="true" />
            Sponsor on GitHub
          </a>
        )}
        <TextLink href={REPO}>
          <PiStarBold className="ti ti-l" aria-hidden="true" />
          Star the repository
          <PiArrowUpRightBold className="ti" aria-hidden="true" />
        </TextLink>
      </div>
    </div>
  );
}
