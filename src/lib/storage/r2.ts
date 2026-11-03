import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  type CompletedPart,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

// Server-only guard: prevent accidental bundling into client components
if (typeof window !== "undefined") {
  throw new Error("CRITICAL SECURITY VIOLATION: R2 Storage Service cannot be loaded on the client.")
}

export interface R2Config {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
  endpoint: string
}

function getR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucketName = process.env.R2_BUCKET_NAME || "hiddenbooks-private"
  const endpoint =
    process.env.R2_ENDPOINT ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined)

  const missing: string[] = []
  if (!accountId) missing.push("R2_ACCOUNT_ID")
  if (!accessKeyId) missing.push("R2_ACCESS_KEY_ID")
  if (!secretAccessKey) missing.push("R2_SECRET_ACCESS_KEY")
  if (!bucketName) missing.push("R2_BUCKET_NAME")
  if (!endpoint) missing.push("R2_ENDPOINT")

  if (missing.length > 0) {
    throw new Error(
      `Cloudflare R2 Configuration Error: Missing required environment variable(s): ${missing.join(
        ", "
      )}. Please verify server configuration.`
    )
  }

  return {
    accountId: accountId!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    bucketName,
    endpoint: endpoint!,
  }
}

let cachedClient: S3Client | null = null

export function getR2Client(): S3Client {
  if (cachedClient) return cachedClient

  const config = getR2Config()
  cachedClient = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })

  return cachedClient
}

export function getR2BucketName(): string {
  return getR2Config().bucketName
}

/**
 * Generate a short-lived presigned PUT URL for direct browser-to-R2 upload
 */
export async function createPresignedUploadUrl(options: {
  objectKey: string
  contentType: string
  contentLength?: number
  expiresInSeconds?: number
}): Promise<{ uploadUrl: string; objectKey: string; bucketName: string }> {
  const client = getR2Client()
  const bucket = getR2BucketName()
  const expiresIn = options.expiresInSeconds || 3600 // 1 hour default

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: options.objectKey,
    ContentType: options.contentType,
    ...(options.contentLength ? { ContentLength: options.contentLength } : {}),
  })

  const uploadUrl = await getSignedUrl(client, command, { expiresIn })

  return {
    uploadUrl,
    objectKey: options.objectKey,
    bucketName: bucket,
  }
}

/**
 * Generate a short-lived presigned GET URL for authorized asset viewing/streaming or download
 */
export async function createPresignedDownloadUrl(options: {
  objectKey: string
  expiresInSeconds?: number
  filename?: string
  inline?: boolean
}): Promise<string> {
  const client = getR2Client()
  const bucket = getR2BucketName()
  const expiresIn = options.expiresInSeconds || 300 // 5 minutes default

  const disposition = options.filename
    ? `${options.inline ? "inline" : "attachment"}; filename="${encodeURIComponent(options.filename)}"`
    : options.inline
    ? "inline"
    : "attachment"

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: options.objectKey,
    ResponseContentDisposition: disposition,
  })

  return await getSignedUrl(client, command, { expiresIn })
}

/**
 * Upload a file Buffer directly to R2 (for server-side streaming uploads)
 */
export async function uploadBufferToR2(options: {
  objectKey: string
  buffer: Buffer
  contentType: string
  metadata?: Record<string, string>
}): Promise<{ objectKey: string; bucketName: string; size: number }> {
  const client = getR2Client()
  const bucket = getR2BucketName()

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: options.objectKey,
      Body: options.buffer,
      ContentType: options.contentType,
      ContentLength: options.buffer.length,
      Metadata: options.metadata,
    })
  )

  return {
    objectKey: options.objectKey,
    bucketName: bucket,
    size: options.buffer.length,
  }
}

/**
 * Head an object in R2 to verify existence, size, and metadata
 */
export async function headR2Object(objectKey: string) {
  const client = getR2Client()
  const bucket = getR2BucketName()

  try {
    const res = await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      })
    )
    return {
      exists: true,
      contentLength: res.ContentLength || 0,
      contentType: res.ContentType,
      eTag: res.ETag,
      lastModified: res.LastModified,
      metadata: res.Metadata,
    }
  } catch (err: any) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      return { exists: false, contentLength: 0 }
    }
    throw err
  }
}

/**
 * Delete an object from R2
 */
export async function deleteR2Object(objectKey: string): Promise<boolean> {
  const client = getR2Client()
  const bucket = getR2BucketName()

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    })
  )

  return true
}

/**
 * Multipart upload lifecycle handlers for large files (audiobooks, high-res videos)
 */
export async function initiateMultipartUpload(options: {
  objectKey: string
  contentType: string
}): Promise<{ uploadId: string; objectKey: string; bucketName: string }> {
  const client = getR2Client()
  const bucket = getR2BucketName()

  const res = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: options.objectKey,
      ContentType: options.contentType,
    })
  )

  if (!res.UploadId) {
    throw new Error("Failed to initialize multipart upload with Cloudflare R2")
  }

  return {
    uploadId: res.UploadId,
    objectKey: options.objectKey,
    bucketName: bucket,
  }
}

export async function createPresignedUploadPartUrl(options: {
  objectKey: string
  uploadId: string
  partNumber: number
  expiresInSeconds?: number
}): Promise<string> {
  const client = getR2Client()
  const bucket = getR2BucketName()

  const command = new UploadPartCommand({
    Bucket: bucket,
    Key: options.objectKey,
    UploadId: options.uploadId,
    PartNumber: options.partNumber,
  })

  return await getSignedUrl(client, command, {
    expiresIn: options.expiresInSeconds || 3600,
  })
}

export async function finishMultipartUpload(options: {
  objectKey: string
  uploadId: string
  parts: CompletedPart[]
}): Promise<{ objectKey: string; bucketName: string }> {
  const client = getR2Client()
  const bucket = getR2BucketName()

  // S3 requires parts to be sorted by PartNumber ascending
  const sortedParts = [...options.parts].sort((a, b) => (a.PartNumber || 0) - (b.PartNumber || 0))

  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: options.objectKey,
      UploadId: options.uploadId,
      MultipartUpload: {
        Parts: sortedParts,
      },
    })
  )

  return {
    objectKey: options.objectKey,
    bucketName: bucket,
  }
}

export async function cancelMultipartUpload(options: {
  objectKey: string
  uploadId: string
}): Promise<boolean> {
  const client = getR2Client()
  const bucket = getR2BucketName()

  await client.send(
    new AbortMultipartUploadCommand({
      Bucket: bucket,
      Key: options.objectKey,
      UploadId: options.uploadId,
    })
  )

  return true
}

/**
 * Standard deterministic object key generator:
 * publications/{publicationId}/{assetType}/{timestamp}_{sanitizedFilename}
 */
export function generateR2ObjectKey(options: {
  publicationId: string
  assetType: string
  originalFilename: string
}): string {
  const sanitizedFilename = options.originalFilename
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_")
    .replace(/_+/g, "_")

  const timestamp = Date.now()
  return `publications/${options.publicationId}/${options.assetType}/${timestamp}_${sanitizedFilename}`
}
