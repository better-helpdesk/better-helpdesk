// The package queues its emails (receipts, agent alerts, replies) as jobs.
// The site runs them in its own server process every minute; jobs are claimed
// with SKIP LOCKED, so several containers can do this at once.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || !process.env.DATABASE_URL)
    return;
  const { helpdesk } = await import('./lib/helpdesk');
  setInterval(() => {
    helpdesk.runJobs({ budgetMs: 20_000 }).catch(error => {
      console.error('[helpdesk] jobs run failed', error);
    });
  }, 60_000).unref();
}
