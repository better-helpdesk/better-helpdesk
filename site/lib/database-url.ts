/** The same server and database as the site's own inbox would be wiped with it. */
export function sameDatabase(a: string, b: string) {
  const key = (url: string) => {
    const u = new URL(url);
    return `${u.hostname.toLowerCase()}:${u.port || '5432'}${u.pathname}`;
  };
  return key(a) === key(b);
}
