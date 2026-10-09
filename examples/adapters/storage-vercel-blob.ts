// A private Vercel Blob store. The widget POSTs each upload as a multipart
// form and Blob takes a PUT, so `handleUpload` relays the file from a route
// in your app to a presigned PUT URL, which Blob checks for path, type, size
// and expiry. Mount it and point HELPDESK_UPLOAD_URL at it. A Vercel
// Function takes a request body of at most 4.5 MB, so set
// `maxAttachmentBytes` to 4 MiB or less; the form adds a little on top.
import {
  BlobNotFoundError,
  del,
  getDownloadUrl,
  head,
  issueSignedToken,
  presignUrl,
  put,
} from '@vercel/blob';
import type { StorageAdapter } from 'better-helpdesk';

const access = 'private';
const fiveMinutes = 5 * 60 * 1000;
// Presigned PUT URLs go to Blob's control API, which the SDK lets an env
// variable override; the relay forwards only there, so it is no open proxy.
const blobApi = new URL(
  `${
    process.env.VERCEL_BLOB_API_URL ??
    process.env.NEXT_PUBLIC_VERCEL_BLOB_API_URL ??
    'https://vercel.com/api/blob'
  }/`
).href;

export const storage: StorageAdapter = {
  async presignUpload(pathname, { contentType, maxBytes }) {
    const validUntil = Date.now() + fiveMinutes;
    const token = await issueSignedToken({
      pathname,
      operations: ['put'],
      allowedContentTypes: [contentType],
      maximumSizeInBytes: maxBytes,
      validUntil,
    });
    const { presignedUrl } = await presignUrl(token, {
      operation: 'put',
      pathname,
      access,
      allowedContentTypes: [contentType],
      maximumSizeInBytes: maxBytes,
      addRandomSuffix: false,
      allowOverwrite: true,
      validUntil,
    });
    return {
      url: process.env.HELPDESK_UPLOAD_URL!,
      fields: { url: presignedUrl },
    };
  },
  async presignDownload(pathname) {
    const validUntil = Date.now() + fiveMinutes;
    const token = await issueSignedToken({
      pathname,
      operations: ['get'],
      validUntil,
    });
    const { presignedUrl } = await presignUrl(token, {
      operation: 'get',
      pathname,
      access,
      validUntil,
    });
    return getDownloadUrl(presignedUrl);
  },
  async put(pathname, body, contentType) {
    await put(pathname, Buffer.from(body), {
      access,
      contentType,
      allowOverwrite: true,
    });
  },
  exists: pathname =>
    head(pathname).then(
      () => true,
      error => {
        if (error instanceof BlobNotFoundError) return false;
        throw error;
      }
    ),
  async delete(pathname) {
    await del(pathname);
  },
};

/**
 * The route the widget uploads to; `export { handleUpload as POST }` from
 * `app/api/helpdesk-upload/route.ts`. The presigned URL is the credential,
 * so any origin may post to it.
 */
export async function handleUpload(request: Request) {
  const form = await request.formData().catch(() => null);
  const url = form?.get('url');
  const file = form?.get('file');
  // Compared after parsing, so dot segments cannot steer it off the API path.
  const target =
    typeof url === 'string' && URL.canParse(url) ? new URL(url) : null;
  if (!target || !(file instanceof Blob) || !target.href.startsWith(blobApi)) {
    return new Response(null, { status: 400 });
  }
  const response = await fetch(target, {
    method: 'PUT',
    headers: { 'content-type': file.type },
    body: file,
  });
  return new Response(null, {
    status: response.ok ? 204 : response.status,
    headers: { 'access-control-allow-origin': '*' },
  });
}
