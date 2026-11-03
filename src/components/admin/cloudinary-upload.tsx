"use client"

import React, { useState, useRef, useEffect } from "react"
import {
  UploadCloud,
  Image as ImageIcon,
  Film,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  FolderOpen,
  X,
  Play,
  RotateCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import type { CloudinaryAssetType, CloudinaryResourceType, MediaAsset, SignedUploadParams } from "@/types/media"

export interface CloudinaryUploadProps {
  value?: string | null
  onChange: (url: string, asset?: MediaAsset) => void
  onRemove?: () => void
  assetType: CloudinaryAssetType
  label?: string
  description?: string
  aspectRatio?: "cover" | "banner" | "avatar" | "video" | "square" | "auto"
  entityId?: {
    publication_id?: string
    blog_post_id?: string
    author_id?: string
    homepage_section_id?: string
  }
  className?: string
  compact?: boolean
  allowMediaPicker?: boolean
}

export function CloudinaryUpload({
  value,
  onChange,
  onRemove,
  assetType,
  label,
  description,
  aspectRatio = "cover",
  entityId,
  className = "",
  compact = false,
  allowMediaPicker = true,
}: CloudinaryUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [lastFailedFile, setLastFailedFile] = useState<File | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualUrl, setManualUrl] = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeXhrRef = useRef<XMLHttpRequest | null>(null)

  const isVideo = assetType === "promo_video"

  const getAspectClass = () => {
    switch (aspectRatio) {
      case "cover":
        return "aspect-[2/3] max-w-[200px]" // Standard Book/eBook cover portrait
      case "banner":
        return "aspect-[21/9] w-full"
      case "avatar":
        return "aspect-square w-28 h-28 rounded-full overflow-hidden"
      case "video":
        return "aspect-video w-full"
      case "square":
        return "aspect-square w-40"
      default:
        return "aspect-auto max-h-[300px]"
    }
  }

  const handleCopyUrl = () => {
    if (!value) return
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const executeUpload = async (file: File) => {
    setUploadError(null)
    setLastFailedFile(null)
    setIsUploading(true)
    setUploadProgress(5)

    try {
      // 1. Request signature from Super Admin endpoint
      const signRes = await fetch("/api/admin/cloudinary/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetType }),
      })

      if (!signRes.ok) {
        const errorData = await signRes.json().catch(() => ({}))
        throw new Error(errorData.error || `Server signature failed (${signRes.status})`)
      }

      const { params }: { params: SignedUploadParams } = await signRes.json()

      // Validate file size against server policy
      if (file.size > params.maxSizeBytes) {
        const maxMb = (params.maxSizeBytes / (1024 * 1024)).toFixed(0)
        throw new Error(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of ${maxMb}MB.`)
      }

      // 2. Perform direct signed upload to Cloudinary via XHR for progress tracking
      const formData = new FormData()
      formData.append("file", file)
      formData.append("api_key", params.apiKey)
      formData.append("timestamp", String(params.timestamp))
      formData.append("signature", params.signature)
      formData.append("folder", params.folder)

      const uploadUrl = `https://api.cloudinary.com/v1_1/${params.cloudName}/${params.resourceType}/upload`

      const uploadResult = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        activeXhrRef.current = xhr

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.min(Math.round((event.loaded / event.total) * 90), 90)
            setUploadProgress(percent)
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText)
              resolve(res)
            } catch (e) {
              reject(new Error("Invalid response format from Cloudinary"))
            }
          } else {
            let errorMsg = `Upload failed with status ${xhr.status}`
            try {
              const errObj = JSON.parse(xhr.responseText)
              if (errObj.error?.message) errorMsg = errObj.error.message
            } catch (_) {}
            reject(new Error(errorMsg))
          }
        }

        xhr.onerror = () => reject(new Error("Network connection error during media upload"))
        xhr.ontimeout = () => reject(new Error("Upload request timed out"))

        xhr.open("POST", uploadUrl)
        xhr.send(formData)
      })

      setUploadProgress(95)

      // 3. Register asset in Supabase public.media_assets
      const registerRes = await fetch("/api/admin/cloudinary/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public_id: uploadResult.public_id,
          secure_url: uploadResult.secure_url,
          url: uploadResult.url,
          resource_type: uploadResult.resource_type || params.resourceType,
          format: uploadResult.format,
          width: uploadResult.width,
          height: uploadResult.height,
          bytes: uploadResult.bytes,
          duration: uploadResult.duration,
          folder: params.folder,
          asset_type: assetType,
          publication_id: entityId?.publication_id,
          blog_post_id: entityId?.blog_post_id,
          author_id: entityId?.author_id,
          homepage_section_id: entityId?.homepage_section_id,
        }),
      })

      const registerData = await registerRes.json().catch(() => ({}))

      setUploadProgress(100)
      onChange(uploadResult.secure_url, registerData.asset)
      setIsUploading(false)
      setUploadProgress(0)
    } catch (err: any) {
      console.error("Cloudinary upload workflow error:", err)
      setUploadError(err.message || "Failed to complete upload")
      setLastFailedFile(file)
      setIsUploading(false)
    } finally {
      activeXhrRef.current = null
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) executeUpload(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) executeUpload(file)
  }

  const handleRetry = () => {
    if (lastFailedFile) {
      executeUpload(lastFailedFile)
    } else if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleManualSubmit = () => {
    if (manualUrl.trim()) {
      onChange(manualUrl.trim())
      setShowManualInput(false)
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Hidden native input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={isVideo ? "video/mp4,video/webm,video/quicktime" : "image/jpeg,image/png,image/webp,image/avif,image/gif"}
        className="hidden"
        onChange={handleFileSelect}
        disabled={isUploading}
      />

      <div className="flex items-center justify-between">
        {label && (
          <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            {isVideo ? <Film className="w-4 h-4 text-emerald-600" /> : <ImageIcon className="w-4 h-4 text-emerald-600" />}
            {label}
          </label>
        )}
        <div className="flex items-center gap-2">
          {allowMediaPicker && !isUploading && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsPickerOpen(true)}
              className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Media Library
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowManualInput(!showManualInput)}
            className="text-xs h-7 text-muted-foreground hover:text-foreground"
          >
            {showManualInput ? "Upload File" : "Paste URL"}
          </Button>
        </div>
      </div>

      {description && <p className="text-xs text-muted-foreground">{description}</p>}

      {/* Manual URL input drawer */}
      {showManualInput && (
        <div className="flex items-center gap-2 p-2 bg-muted/40 rounded-lg border border-border">
          <input
            type="url"
            placeholder="https://res.cloudinary.com/... or https://..."
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            className="flex-1 bg-background text-xs px-3 py-1.5 rounded border border-border focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <Button type="button" size="sm" onClick={handleManualSubmit} className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
            Apply
          </Button>
        </div>
      )}

      {/* Uploading progress bar state */}
      {isUploading && (
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
              Uploading directly to Cloudinary...
            </span>
            <span className="font-mono text-emerald-700 dark:text-emerald-400">{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2 bg-emerald-100 dark:bg-emerald-900" />
          <p className="text-[11px] text-muted-foreground">Generating cryptographic signature and streaming to Cloudinary servers.</p>
        </div>
      )}

      {/* Upload Error Alert */}
      {uploadError && !isUploading && (
        <div className="p-3 rounded-lg border border-red-500/30 bg-red-50/60 dark:bg-red-950/30 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <p className="font-semibold text-red-800 dark:text-red-400">Media Upload Error</p>
            <p className="text-red-700 dark:text-red-300 mt-0.5">{uploadError}</p>
            <div className="flex items-center gap-2 mt-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleRetry}
                className="h-6 text-[11px] px-2 text-red-700 border-red-300 hover:bg-red-100 dark:text-red-300"
              >
                <RefreshCw className="w-3 h-3 mr-1" /> Retry Upload
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setUploadError(null)}
                className="h-6 text-[11px] px-2 text-muted-foreground"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Existing asset preview */}
      {value && !isUploading ? (
        <div className="relative group border border-border rounded-xl p-2 bg-card/60 shadow-sm transition hover:shadow-md">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Visual media preview container */}
            <div className={`relative bg-neutral-900 rounded-lg overflow-hidden flex items-center justify-center shrink-0 ${getAspectClass()}`}>
              {isVideo ? (
                <video src={value} controls className="w-full h-full object-cover rounded-lg" preload="metadata" />
              ) : (
                <img src={value} alt="Media preview" className="w-full h-full object-cover rounded-lg" />
              )}
            </div>

            {/* Asset details & quick actions */}
            <div className="flex-1 min-w-0 space-y-2 py-1 w-full sm:w-auto">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/20 font-mono">
                  CLOUDINARY ACTIVE
                </Badge>
                {isVideo ? (
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    VIDEO
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    IMAGE
                  </Badge>
                )}
              </div>

              <p className="text-xs font-mono text-muted-foreground truncate max-w-full select-all">{value}</p>

              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 text-xs gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  Replace
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyUrl}
                  className="h-8 text-xs gap-1.5"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied" : "Copy URL"}
                </Button>
                <a
                  href={value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground h-8 px-2"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onChange("")
                    if (onRemove) onRemove()
                  }}
                  className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 ml-auto"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Remove
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Drag & Drop Upload Zone (shown when empty and not uploading) */}
      {!value && !isUploading && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer border-2 border-dashed rounded-xl p-6 text-center transition flex flex-col items-center justify-center gap-2.5 ${
            isDragging
              ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 scale-[0.99]"
              : "border-border hover:border-emerald-500/60 hover:bg-muted/40"
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Click to upload or drag & drop {isVideo ? "video" : "image"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isVideo
                ? "MP4, WebM, QuickTime up to 100MB"
                : "WebP, JPG, PNG, AVIF or GIF up to 15MB"}
            </p>
          </div>
          <Badge variant="outline" className="text-[11px] text-muted-foreground font-mono">
            Signed Direct Cloudinary Stream
          </Badge>
        </div>
      )}

      {/* Media Library Selector Dialog */}
      <MediaPickerModal
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        assetType={assetType}
        onSelect={(selected) => {
          onChange(selected.secure_url, selected)
          setIsPickerOpen(false)
        }}
      />
    </div>
  )
}

/**
 * Modal to pick from already-uploaded Cloudinary assets
 */
interface MediaPickerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assetType: CloudinaryAssetType
  onSelect: (asset: MediaAsset) => void
}

function MediaPickerModal({ open, onOpenChange, assetType, onSelect }: MediaPickerModalProps) {
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [filterType, setFilterType] = useState<string>("all")

  useEffect(() => {
    if (open) {
      fetchAssets()
    }
  }, [open, filterType])

  const fetchAssets = async () => {
    setIsLoading(true)
    try {
      const url = new URL("/api/admin/cloudinary/assets", window.location.origin)
      if (filterType !== "all") {
        url.searchParams.set("asset_type", filterType)
      }
      const res = await fetch(url.toString())
      const data = await res.json()
      if (data.success && Array.isArray(data.assets)) {
        setAssets(data.assets)
      }
    } catch (err) {
      console.error("Failed to load existing media assets:", err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-emerald-600" />
            Select from Cloudinary Media Library
          </DialogTitle>
          <DialogDescription>
            Pick an existing verified media asset from your Cloudinary storage or filter by category.
          </DialogDescription>
        </DialogHeader>

        {/* Filter buttons */}
        <div className="flex items-center gap-2 py-2 overflow-x-auto border-b border-border">
          {["all", "book_cover", "blog_cover", "author_avatar", "homepage_banner", "promo_video"].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${
                filterType === type
                  ? "bg-emerald-600 text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {type.replace("_", " ")}
            </button>
          ))}
        </div>

        {/* Assets Grid */}
        <div className="flex-1 overflow-y-auto py-4 min-h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              <RotateCw className="w-5 h-5 animate-spin mr-2 text-emerald-600" />
              Loading assets...
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm space-y-2">
              <ImageIcon className="w-8 h-8 opacity-40" />
              <p>No media assets found in this category.</p>
              <p className="text-xs">Upload new images using the upload area.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {assets.map((asset) => {
                const isVid = asset.resource_type === "video"
                return (
                  <div
                    key={asset.id}
                    onClick={() => onSelect(asset)}
                    className="group relative border border-border rounded-lg overflow-hidden bg-muted/30 cursor-pointer hover:border-emerald-500 hover:shadow-md transition"
                  >
                    <div className="aspect-[3/4] relative bg-neutral-900 flex items-center justify-center overflow-hidden">
                      {isVid ? (
                        <div className="flex flex-col items-center justify-center text-white/80">
                          <Play className="w-8 h-8 mb-1" />
                          <span className="text-[10px] font-mono">VIDEO</span>
                        </div>
                      ) : (
                        <img
                          src={asset.secure_url}
                          alt={asset.alt_text || "Asset thumbnail"}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          loading="lazy"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <span className="text-xs text-white font-medium bg-emerald-600 px-2 py-1 rounded shadow">
                          Select
                        </span>
                      </div>
                    </div>
                    <div className="p-2 text-[11px] truncate">
                      <p className="font-medium truncate">{asset.public_id.split("/").pop()}</p>
                      <p className="text-muted-foreground text-[10px] capitalize">{asset.asset_type.replace("_", " ")}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
