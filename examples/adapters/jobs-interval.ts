// A long-running Node server: start this once next to it. The budget stays
// under the interval, so runs do not overlap.
import { helpdesk } from '@/lib/helpdesk';

setInterval(() => {
  helpdesk.runJobs({ budgetMs: 20_000 }).catch(error => {
    console.error('helpdesk jobs failed', error);
  });
}, 60_000);
