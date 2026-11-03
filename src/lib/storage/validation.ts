export type PublicationAssetType = "pdf" | "epub" | "audiobook" | "audio_chapter" | "video"

export interface AssetTypeRule {
  allowedExtensions: string[]
  allowedMimeTypes: string[]
  maxSizeBytes: number
  label: string
}

export const ASSET_RULES: Record<PublicationAssetType, AssetTypeRule> = {
  pdf: {
    allowedExtensions: [".pdf"],
    allowedMimeTypes: ["application/pdf", "application/x-pdf"],
    maxSizeBytes: 200 * 1024 * 1024, // 200 MB
    label: "PDF eBook",
  },
  epub: {
    allowedExtensions: [".epub"],
    allowedMimeTypes: ["application/epub+zip", "application/zip", "application/octet-stream"],
    maxSizeBytes: 200 * 1024 * 1024, // 200 MB
    label: "EPUB Reader File",
  },
  audiobook: {
    allowedExtensions: [".mp3", ".m4a", ".aac", ".ogg", ".flac", ".zip"],
    allowedMimeTypes: [
      "audio/mpeg",
      "audio/mp3",
      "audio/mp4",
      "audio/x-m4a",
      "audio/aac",
      "audio/ogg",
      "audio/flac",
      "application/zip",
      "application/octet-stream",
    ],
    maxSizeBytes: 1024 * 1024 * 1024, // 1 GB
    label: "Complete Audiobook Master",
  },
  audio_chapter: {
    allowedExtensions: [".mp3", ".m4a", ".aac", ".ogg"],
    allowedMimeTypes: [
      "audio/mpeg",
      "audio/mp3",
      "audio/mp4",
      "audio/x-m4a",
      "audio/aac",
      "audio/ogg",
    ],
    maxSizeBytes: 250 * 1024 * 1024, // 250 MB
    label: "Audio Chapter",
  },
  video: {
    allowedExtensions: [".mp4", ".webm", ".mov", ".mkv"],
    allowedMimeTypes: [
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/x-matroska",
    ],
    maxSizeBytes: 2 * 1024 * 1024 * 1024, // 2 GB
    label: "Private Video Master",
  },
}

export function validateAssetFile(options: {
  filename: string
  mimeType: string
  sizeBytes: number
  assetType: PublicationAssetType
}): { valid: boolean; error?: string } {
  const rule = ASSET_RULES[options.assetType]
  if (!rule) {
    return { valid: false, error: `Unsupported asset type: ${options.assetType}` }
  }

  // 1. Validate file extension
  const ext = "." + options.filename.split(".").pop()?.toLowerCase()
  if (!rule.allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `Invalid file extension '${ext}' for ${rule.label}. Allowed extensions: ${rule.allowedExtensions.join(
        ", "
      )}`,
    }
  }

  // 2. Validate MIME type (if supplied)
  const normMime = options.mimeType.toLowerCase().split(";")[0].trim()
  if (normMime && normMime !== "application/octet-stream") {
    const isAllowed = rule.allowedMimeTypes.some(
      (m) => m === normMime || normMime.startsWith(m.split("/")[0] + "/")
    )
    if (!isAllowed && !rule.allowedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `Invalid MIME type '${options.mimeType}' for ${rule.label}. Expected ${rule.allowedMimeTypes.join(
          ", "
        )}`,
      }
    }
  }

  // 3. Validate size
  if (options.sizeBytes <= 0) {
    return { valid: false, error: "File is empty (0 bytes)." }
  }

  if (options.sizeBytes > rule.maxSizeBytes) {
    const maxMb = Math.round(rule.maxSizeBytes / (1024 * 1024))
    const curMb = (options.sizeBytes / (1024 * 1024)).toFixed(1)
    return {
      valid: false,
      error: `File size (${curMb} MB) exceeds maximum allowed limit of ${maxMb} MB for ${rule.label}.`,
    }
  }

  return { valid: true }
}
