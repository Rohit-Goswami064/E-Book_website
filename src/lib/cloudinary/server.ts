import { v2 as cloudinary, type UploadApiResponse } from "cloudinary"
import type { CloudinaryAssetType, CloudinaryResourceType, FolderConfig, SignedUploadParams } from "@/types/media"

// Server-only guard: prevent accidental bundling of API secret into client components
if (typeof window !== "undefined") {
  throw new Error("CRITICAL SECURITY VIOLATION: Cloudinary Server Service cannot be loaded on the client.")
}

/**
 * Strict whitelist mapping asset types to isolated folders, resource types,
 * allowed file extensions, and maximum file size boundaries.
 */
export const CLOUDINARY_FOLDER_MAP: Record<CloudinaryAssetType, FolderConfig> = {
  book_cover: {
    folder: "hiddenbooks/covers",
    resourceType: "image",
    allowedFormats: ["jpg", "jpeg", "png", "webp", "avif"],
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    description: "Public eBook cover images",
  },
  blog_cover: {
    folder: "hiddenbooks/blog",
    resourceType: "image",
    allowedFormats: ["jpg", "jpeg", "png", "webp", "avif", "gif"],
    maxSizeBytes: 15 * 1024 * 1024, // 15MB
    description: "Editorial blog cover images",
  },
  blog_inline: {
    folder: "hiddenbooks/blog/inline",
    resourceType: "image",
    allowedFormats: ["jpg", "jpeg", "png", "webp", "avif", "gif"],
    maxSizeBytes: 15 * 1024 * 1024, // 15MB
    description: "Editorial blog inline article images",
  },
  author_avatar: {
    folder: "hiddenbooks/authors",
    resourceType: "image",
    allowedFormats: ["jpg", "jpeg", "png", "webp", "avif"],
    maxSizeBytes: 8 * 1024 * 1024, // 8MB
    description: "Author profile photos",
  },
  homepage_banner: {
    folder: "hiddenbooks/banners",
    resourceType: "image",
    allowedFormats: ["jpg", "jpeg", "png", "webp", "avif", "gif"],
    maxSizeBytes: 20 * 1024 * 1024, // 20MB
    description: "Homepage promotional and hero banners",
  },
  promo_video: {
    folder: "hiddenbooks/promo_videos",
    resourceType: "video",
    allowedFormats: ["mp4", "webm", "mov", "mkv"],
    maxSizeBytes: 100 * 1024 * 1024, // 100MB
    description: "Public promotional trailers and showcases",
  },
  other: {
    folder: "hiddenbooks/misc",
    resourceType: "image",
    allowedFormats: ["jpg", "jpeg", "png", "webp"],
    maxSizeBytes: 10 * 1024 * 1024,
    description: "Miscellaneous public assets",
  },
}

export interface CloudinaryConfig {
  cloudName: string
  apiKey: string
  apiSecret: string
  uploadPreset?: string
}

export function getCloudinaryConfig(): CloudinaryConfig {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || "hiddenbooks-media"

  const missing: string[] = []
  if (!cloudName) missing.push("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME")
  if (!apiKey) missing.push("NEXT_PUBLIC_CLOUDINARY_API_KEY")
  if (!apiSecret) missing.push("CLOUDINARY_API_SECRET")

  if (missing.length > 0) {
    throw new Error(
      `Cloudinary Configuration Error: Missing required environment variable(s): ${missing.join(", ")}`
    )
  }

  // Ensure cloudinary instance is configured
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  })

  return {
    cloudName: cloudName!,
    apiKey: apiKey!,
    apiSecret: apiSecret!,
    uploadPreset,
  }
}

/**
 * Generates secure signed upload parameters for authorized Super Admins.
 * Enforces folder whitelisting and resource type constraints.
 */
export function generateSignedUploadParams(
  assetType: CloudinaryAssetType,
  options?: { tags?: string[] }
): SignedUploadParams {
  const config = getCloudinaryConfig()
  const folderConfig = CLOUDINARY_FOLDER_MAP[assetType] || CLOUDINARY_FOLDER_MAP.other
  const timestamp = Math.floor(Date.now() / 1000)

  // Cloudinary signs parameters in alphabetical order
  const paramsToSign: Record<string, any> = {
    folder: folderConfig.folder,
    timestamp,
  }

  if (options?.tags && options.tags.length > 0) {
    paramsToSign.tags = options.tags.join(",")
  }

  // Generate signature using API Secret strictly on server
  const signature = cloudinary.utils.api_sign_request(paramsToSign, config.apiSecret)

  return {
    signature,
    timestamp,
    apiKey: config.apiKey,
    cloudName: config.cloudName,
    folder: folderConfig.folder,
    resourceType: folderConfig.resourceType,
    uploadPreset: config.uploadPreset,
    maxSizeBytes: folderConfig.maxSizeBytes,
    allowedFormats: folderConfig.allowedFormats,
  }
}

/**
 * Validates with Cloudinary API that an asset genuinely exists and retrieves its
 * verified dimensions, bytes, duration, and format.
 */
export async function verifyCloudinaryAsset(
  publicId: string,
  resourceType: CloudinaryResourceType = "image"
): Promise<{
  public_id: string
  secure_url: string
  url: string
  format: string
  width: number
  height: number
  bytes: number
  duration: number | null
  resource_type: string
  created_at: string
}> {
  getCloudinaryConfig()

  try {
    const res = await cloudinary.api.resource(publicId, {
      resource_type: resourceType,
    })

    return {
      public_id: res.public_id,
      secure_url: res.secure_url,
      url: res.url,
      format: res.format,
      width: res.width,
      height: res.height,
      bytes: res.bytes,
      duration: res.duration || null,
      resource_type: res.resource_type,
      created_at: res.created_at,
    }
  } catch (err: any) {
    throw new Error(`Failed to verify asset with Cloudinary: ${err.message || err.error?.message || err}`)
  }
}

/**
 * Safely destroys an asset in Cloudinary.
 */
export async function deleteCloudinaryAsset(
  publicId: string,
  resourceType: CloudinaryResourceType = "image"
): Promise<{ result: string }> {
  getCloudinaryConfig()

  try {
    const res = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    })
    return res
  } catch (err: any) {
    throw new Error(`Failed to delete Cloudinary asset: ${err.message || err.error?.message || err}`)
  }
}

/**
 * Direct server-side upload helper (for server routines, seed scripts, etc.)
 */
export async function uploadBufferToCloudinary(
  buffer: Buffer,
  assetType: CloudinaryAssetType,
  customPublicId?: string
): Promise<UploadApiResponse> {
  const folderConfig = CLOUDINARY_FOLDER_MAP[assetType] || CLOUDINARY_FOLDER_MAP.other
  getCloudinaryConfig()

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folderConfig.folder,
        resource_type: folderConfig.resourceType,
        public_id: customPublicId,
        overwrite: true,
      },
      (error, result) => {
        if (error) return reject(error)
        if (!result) return reject(new Error("Cloudinary returned empty result"))
        resolve(result)
      }
    )
    uploadStream.end(buffer)
  })
}
