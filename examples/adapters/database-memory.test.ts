import { runAdapterTests } from 'better-helpdesk/testing';

import { memoryAdapter } from './database-memory';

let adapter = memoryAdapter();

runAdapterTests({
  name: 'memory',
  adapter: () => adapter,
  reset: async () => {
    adapter = memoryAdapter();
  },
});
