// The browser POSTs uploads straight to the bucket, so its CORS rules must
// allow POST from the origins that run the widget and the agent UI.
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageAdapter } from 'better-helpdesk';

const s3 = new S3Client({});
const Bucket = process.env.HELPDESK_BUCKET!;

export const storage: StorageAdapter = {
  presignUpload: (Key, { contentType, maxBytes }) =>
    createPresignedPost(s3, {
      Bucket,
      Key,
      Fields: { 'Content-Type': contentType },
      Conditions: [['content-length-range', 0, maxBytes]],
      Expires: 300,
    }),
  presignDownload: (Key, filename) =>
    getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket,
        Key,
        ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      }),
      { expiresIn: 300 }
    ),
  async put(Key, Body, ContentType) {
    await s3.send(new PutObjectCommand({ Bucket, Key, Body, ContentType }));
  },
  exists: Key =>
    s3.send(new HeadObjectCommand({ Bucket, Key })).then(
      () => true,
      error => {
        if (error.name === 'NotFound') return false;
        throw error;
      }
    ),
  async delete(Key) {
    await s3.send(new DeleteObjectCommand({ Bucket, Key }));
  },
};
