import { demo } from '../../../../../lib/demo';

const handle = (request: Request) => demo.handler(request);

export {
  handle as GET,
  handle as POST,
  handle as PATCH,
  handle as DELETE,
  handle as OPTIONS,
};
