/**
 * The scheduler a real host has: every 20 seconds, emails go out, snoozes
 * wake, and the SLA warnings and breaches are sent. What a run did is printed
 * when it did anything.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { helpdesk } = await import('./lib/helpdesk');
  setInterval(() => {
    helpdesk
      .runJobs({ budgetMs: 10_000 })
      .then(report => {
        const { errors, ...counts } = report;
        if (Object.values(counts).some(Boolean) || errors.length) {
          console.log('[helpdesk jobs]', report);
        }
      })
      .catch(error => console.error('[helpdesk] jobs run failed', error));
  }, 20_000).unref();
}
