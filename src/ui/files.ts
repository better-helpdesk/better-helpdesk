/**
 * Files grouped by the message they belong to. A file uploaded from the
 * widget carries no message id: it came with the opening message.
 */
export function filesByMessage<T extends { messageId: string | null }>(
  messages: { id: string }[],
  files: T[]
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const file of files) {
    const key = file.messageId ?? messages[0]?.id ?? '';
    grouped.set(key, [...(grouped.get(key) ?? []), file]);
  }
  return grouped;
}
