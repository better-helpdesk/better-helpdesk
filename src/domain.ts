export function formatReference(prefix: string, sequence: number): string {
  return `${prefix}-${sequence}`;
}

export function parseReference(
  prefix: string,
  value: string
): number | undefined {
  const match = new RegExp(`^${prefix}-(\\d+)$`, 'i').exec(value.trim());
  return match ? Number(match[1]) : undefined;
}
