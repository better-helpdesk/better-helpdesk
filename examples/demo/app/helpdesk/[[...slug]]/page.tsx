import { HelpdeskAdmin } from 'better-helpdesk/admin';

import { currentRole } from '../../../lib/role';
import { Bar, Foot, RoleSwitcher } from '../../chrome';

export default async function Page() {
  const role = await currentRole();

  return (
    <>
      <Bar here="helpdesk" />
      <main id="main">
        {role === 'agent' ? (
          <div className="admin">
            <div className="admin-inner">
              <HelpdeskAdmin
                api="/api/helpdesk"
                basePath="/helpdesk"
                locale="en"
              />
            </div>
          </div>
        ) : (
          <div className="shell band">
            <div className="notice">
              <h1>Only agents get this far</h1>
              <p>
                The inbox refuses anyone whose identity is not an agent. Become
                Rowan and it opens.
              </p>
            </div>
            <RoleSwitcher role={role} />
          </div>
        )}
      </main>
      <Foot />
    </>
  );
}
