// The package queues its emails (receipts, agent alerts, replies) as jobs.
// The site runs them in its own server process every minute; jobs are claimed
// with SKIP LOCKED, so several containers can do this at once.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.DATABASE_URL) {
    const { helpdesk } = await import('./lib/helpdesk');
    setInterval(() => {
      helpdesk.runJobs({ budgetMs: 20_000 }).catch(error => {
        console.error('[helpdesk] jobs run failed', error);
      });
    }, 60_000).unref();
  }
  if (process.env.DEMO_DATABASE_URL) {
    const { RESET_MINUTES, resetDemo } = await import('./lib/demo');
    const reset = () =>
      resetDemo().catch(error => {
        console.error('[demo] reset failed', error);
      });
    // On the wall clock's quarter hours, so every container and the countdown
    // on /demo agree on when it happens.
    const period = RESET_MINUTES * 60_000;
    await reset();
    setTimeout(
      () => {
        reset();
        setInterval(reset, period).unref();
      },
      period - (Date.now() % period)
    ).unref();
  }
}
