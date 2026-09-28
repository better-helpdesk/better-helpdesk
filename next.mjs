/** Lets Next compile the package's TypeScript and JSX. */
export function withHelpdesk(nextConfig = {}) {
  return {
    ...nextConfig,
    transpilePackages: [
      ...new Set([...(nextConfig.transpilePackages ?? []), 'better-helpdesk']),
    ],
  };
}
