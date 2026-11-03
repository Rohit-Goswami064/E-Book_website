export type CloudinaryAssetType =
  | "book_cover"
  | "blog_cover"
  | "blog_inline"
  | "author_avatar"
  | "homepage_banner"
  | "promo_video"
  | "other"

export type CloudinaryResourceType = "image" | "video" | "raw"

export interface FolderConfig {
  folder: string
  resourceType: CloudinaryResourceType
  allowedFormats: string[]
  maxSizeBytes: number
  description: string
}

export interface SignedUploadParams {
  signature: string
  timestamp: number
  apiKey: string
  cloudName: string
  folder: string
  resourceType: CloudinaryResourceType
  uploadPreset?: string
  maxSizeBytes: number
  allowedFormats: string[]
}

export interface MediaAsset {
  id: string
  public_id: string
  secure_url: string
  url: string | null
  resource_type: CloudinaryResourceType
  format: string | null
  width: number | null
  height: number | null
  bytes: number | null
  duration: number | null
  folder: string | null
  asset_type: CloudinaryAssetType
  publication_id: string | null
  blog_post_id: string | null
  author_id: string | null
  homepage_section_id: string | null
  alt_text: string | null
  caption: string | null
  tags: string[]
  metadata: Record<string, any>
  created_by: string | null
  created_at: string
  updated_at: string
}
