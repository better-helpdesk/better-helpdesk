import { afterAll } from 'vitest';

import { runAdapterTests } from '../src/testing';
import { emptyTables, testAdapter, testFamily } from './database';

const { adapter, close } = testAdapter();
afterAll(close);

// The contract every adapter is held to, on the adapter this run uses.
runAdapterTests({
  name: testFamily,
  adapter: () => adapter,
  reset: () => emptyTables(adapter),
});
