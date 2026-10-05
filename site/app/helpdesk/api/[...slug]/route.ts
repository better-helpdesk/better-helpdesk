import { helpdesk } from '../../../../lib/helpdesk';

const handle = (request: Request) => helpdesk.handler(request);

export {
  handle as GET,
  handle as POST,
  handle as PATCH,
  handle as DELETE,
  handle as OPTIONS,
};
