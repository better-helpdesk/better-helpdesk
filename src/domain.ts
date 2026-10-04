export function formatReference(prefix: string, sequence: number): string {
  return `${prefix}-${sequence}`;
}

export function parseReference(
  prefix: string,
  value: string
): number | undefined {
  const match = new RegExp(`^${prefix}-(\\d{1,10})$`, 'i').exec(value.trim());
  const number = Number(match?.[1]);
  // The column is an int4; anything larger can never match and would throw.
  return match && number <= 2_147_483_647 ? number : undefined;
}
