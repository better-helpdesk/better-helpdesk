import { type DragEvent, useState } from 'react';

import { type Api, uploadToStorage } from './api';

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

/** The image types a browser shows in an `<img>`; animated GIF and WebP play there on their own. */
export const isInlineImage = (file: { contentType?: string }) =>
  /^image\/(png|jpeg|gif|webp)$/.test(file.contentType ?? '');

/** What a file picker offers; the server's `ATTACHMENT_TYPES` decides what is taken. */
export const ATTACHABLE =
  'image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain';

export const isAttachable = (file: { type: string }) =>
  ATTACHABLE.split(',').includes(file.type);

/** The files of a paste without text: a copied screenshot. A paste with text is the editor's. */
export const pastedFiles = (clipboard: DataTransfer) =>
  clipboard.files.length > 0 && !clipboard.getData('text/plain')
    ? [...clipboard.files]
    : [];

/** A file picked for the next message; `id` is set once it is in storage. */
export type StagedFile = {
  key: string;
  name: string;
  url?: string;
  id?: string;
};

/**
 * The files of a message not sent yet. Each uploads as it is added, through
 * the presigned form `path` answers, and goes out with the message by its `id`.
 */
export function useStagedFiles(api: Api, path: string) {
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [failed, setFailed] = useState(false);
  const unstage = (files: StagedFile[]) => {
    const keys = new Set(files.map(f => f.key));
    for (const file of files) if (file.url) URL.revokeObjectURL(file.url);
    setStaged(list => list.filter(f => !keys.has(f.key)));
    setFailed(false);
  };
  const attach = (files: Iterable<File>) => {
    setFailed(false);
    for (const file of files) {
      const added: StagedFile = {
        key: crypto.randomUUID(),
        name: file.name || 'pasted.png',
        url: file.type.startsWith('image/')
          ? URL.createObjectURL(file)
          : undefined,
      };
      setStaged(list => [...list, added]);
      void (async () => {
        try {
          const started = await api<{
            id: string;
            upload: { url: string; fields: Record<string, string> };
          }>(path, {
            body: {
              filename: added.name,
              contentType: file.type || 'application/octet-stream',
              size: file.size,
            },
          });
          await uploadToStorage(started.upload, file);
          setStaged(list =>
            list.map(f => (f.key === added.key ? { ...f, id: started.id } : f))
          );
        } catch {
          unstage([added]);
          setFailed(true);
        }
      })();
    }
  };
  return {
    staged,
    uploading: staged.some(f => !f.id),
    failed,
    attach,
    unstage,
  };
}

/** Takes files dropped on the elements given `zone`; `dropping` while some are dragged over one. */
export function useFileDrop(
  enabled: boolean,
  onFiles: (files: File[]) => void
) {
  const [dropping, setDropping] = useState(false);
  return {
    dropping,
    zone: {
      onDragOver(event: DragEvent<HTMLElement>) {
        if (!enabled || !event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setDropping(true);
      },
      onDragLeave(event: DragEvent<HTMLElement>) {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setDropping(false);
      },
      onDrop(event: DragEvent<HTMLElement>) {
        if (!enabled || event.dataTransfer.files.length === 0) return;
        event.preventDefault();
        setDropping(false);
        onFiles([...event.dataTransfer.files]);
      },
    },
  };
}
