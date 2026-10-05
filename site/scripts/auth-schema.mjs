// The options the auth tables depend on. lib/auth.ts adds only nextCookies,
// which has no tables; a plugin that brings its own must be added here too.
export const authSchema = pool => ({
  database: pool,
  emailAndPassword: { enabled: true },
});
