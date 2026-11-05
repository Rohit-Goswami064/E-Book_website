"use client"

import * as React from "react"
import {
  FileText,
  BookOpen,
  Headphones,
  Music,
  Video,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCcw,
  Trash2,
  Archive,
  ExternalLink,
  Shield,
  Loader2,
  Download,
  Eye,
  FileCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { ASSET_RULES, type PublicationAssetType } from "@/lib/storage/validation"

interface AssetRecord {
  id: string
  publication_id: string
  asset_type: PublicationAssetType
  storage_provider: string
  bucket_name: string
  object_key: string
  original_filename: string
  mime_type: string
  file_size: number
  upload_status: "pending" | "completed" | "failed" | "archived"
  is_downloadable: boolean
  metadata: Record<string, any>
  created_at: string
  previewUrl?: string | null
}

interface UploadTask {
  id: string
  file: File
  assetType: PublicationAssetType
  progress: number
  loadedBytes: number
  totalBytes: number
  status: "staged" | "validating" | "uploading" | "verifying" | "completed" | "error" | "cancelled"
  errorMessage?: string
  chapterTitle?: string
  xhr?: XMLHttpRequest
}

export interface PublicationAssetManagerRef {
  hasPendingFiles: () => boolean
  uploadPendingFiles: (pubId: string) => Promise<boolean>
}

interface PublicationAssetManagerProps {
  publicationId?: string
  isDraft?: boolean
  onPublicationSaveRequired?: () => void
}

function formatBytes(bytes: number, decimals = 1) {
  if (!+bytes) return "0 Bytes"
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

export const PublicationAssetManager = React.forwardRef<
  PublicationAssetManagerRef,
  PublicationAssetManagerProps
>(function PublicationAssetManager(
  { publicationId, isDraft = false, onPublicationSaveRequired }: PublicationAssetManagerProps,
  ref
) {
  const [assets, setAssets] = React.useState<AssetRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<PublicationAssetType>("pdf")
  const [uploadQueue, setUploadQueue] = React.useState<UploadTask[]>([])
  const [isDragging, setIsDragging] = React.useState(false)
  const [chapterTitle, setChapterTitle] = React.useState("")
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  // Fetch assets for publication
  const fetchAssets = React.useCallback(async () => {
    if (!publicationId) return
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/publications/${publicationId}/assets`)
      const data = await res.json()
      if (res.ok) {
        setAssets(data.assets || [])
      } else {
        toast.error(data.error || "Failed to load publication assets.")
      }
    } catch {
      toast.error("Network error retrieving publication assets.")
    } finally {
      setLoading(false)
    }
  }, [publicationId])

  React.useEffect(() => {
    if (publicationId) {
      fetchAssets()
    }
  }, [publicationId, fetchAssets])

  // Execute Real Upload via XMLHttpRequest for true progress tracking and cancelability
  const executeUpload = React.useCallback(
    (task: UploadTask, overridePubId?: string, onComplete?: (success: boolean) => void) => {
      const targetPubId = overridePubId || publicationId
      if (!targetPubId) {
        toast.error("Please save the publication draft first before uploading files.")
        onComplete?.(false)
        return
      }

      const rule = ASSET_RULES[task.assetType]
      const ext = "." + task.file.name.split(".").pop()?.toLowerCase()
      if (!rule.allowedExtensions.includes(ext)) {
        setUploadQueue((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  status: "error",
                  errorMessage: `Invalid extension '${ext}'. Allowed: ${rule.allowedExtensions.join(", ")}`,
                }
              : t
          )
        )
        onComplete?.(false)
        return
      }

      if (task.file.size > rule.maxSizeBytes) {
        const maxMb = Math.round(rule.maxSizeBytes / (1024 * 1024))
        setUploadQueue((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  status: "error",
                  errorMessage: `File exceeds maximum allowed size of ${maxMb} MB.`,
                }
              : t
          )
        )
        onComplete?.(false)
        return
      }

      const formData = new FormData()
      formData.append("file", task.file)
      formData.append("asset_type", task.assetType)
      formData.append("is_downloadable", "true")
      if (task.chapterTitle) {
        formData.append("metadata", JSON.stringify({ title: task.chapterTitle }))
      }

      const xhr = new XMLHttpRequest()

      // Track true upload progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100)
          setUploadQueue((prev) =>
            prev.map((t) =>
              t.id === task.id
                ? {
                    ...t,
                    status: percent === 100 ? "verifying" : "uploading",
                    progress: percent,
                    loadedBytes: event.loaded,
                    totalBytes: event.total,
                  }
                : t
            )
          )
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            setUploadQueue((prev) =>
              prev.map((t) =>
                t.id === task.id
                  ? { ...t, status: "completed", progress: 100 }
                  : t
              )
            )
            toast.success(`Uploaded ${task.file.name} to Cloudflare R2!`)
            fetchAssets()
            onComplete?.(true)
          } catch {
            setUploadQueue((prev) =>
              prev.map((t) =>
                t.id === task.id
                  ? { ...t, status: "error", errorMessage: "Failed to parse server response." }
                  : t
              )
            )
            onComplete?.(false)
          }
        } else {
          let errorMsg = `Server returned status ${xhr.status}`
          try {
            const errJson = JSON.parse(xhr.responseText)
            if (errJson.error) errorMsg = errJson.error
          } catch {
            // keep default
          }
          setUploadQueue((prev) =>
            prev.map((t) =>
              t.id === task.id
                ? { ...t, status: "error", errorMessage: errorMsg }
                : t
            )
          )
          toast.error(errorMsg)
          onComplete?.(false)
        }
      }

      xhr.onerror = () => {
        setUploadQueue((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, status: "error", errorMessage: "Network transport error during R2 upload." }
              : t
          )
        )
        toast.error("Upload failed due to network error.")
        onComplete?.(false)
      }

      xhr.onabort = () => {
        setUploadQueue((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, status: "cancelled", errorMessage: "Upload cancelled by user." }
              : t
          )
        )
        onComplete?.(false)
      }

      xhr.open("POST", `/api/admin/publications/${targetPubId}/assets`, true)
      xhr.send(formData)

      // Store xhr instance for cancellation
      setUploadQueue((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, xhr, status: "uploading" } : t))
      )
    },
    [publicationId, fetchAssets]
  )

  // Imperative handle for parent form to upload any pending staged files on publish
  React.useImperativeHandle(ref, () => ({
    hasPendingFiles: () => uploadQueue.some((t) => t.status === "staged"),
    uploadPendingFiles: async (targetPubId: string) => {
      const stagedTasks = uploadQueue.filter((t) => t.status === "staged")
      if (stagedTasks.length === 0) return true

      let allSucceeded = true
      for (const task of stagedTasks) {
        const ok = await new Promise<boolean>((resolve) => {
          executeUpload(task, targetPubId, (success) => resolve(success))
        })
        if (!ok) allSucceeded = false
      }
      return allSucceeded
    },
  }))

  const handleFilesAdded = (files: FileList | File[]) => {
    const fileList = Array.from(files)
    if (fileList.length === 0) return

    const rule = ASSET_RULES[activeTab]

    // Pre-publish mode: If publicationId is not generated yet, validate and stage the files
    if (!publicationId) {
      const stagedTasks: UploadTask[] = []
      for (const file of fileList) {
        const ext = "." + file.name.split(".").pop()?.toLowerCase()
        if (!rule.allowedExtensions.includes(ext)) {
          toast.error(`Invalid extension '${ext}' for ${rule.label}. Allowed: ${rule.allowedExtensions.join(", ")}`)
          continue
        }
        if (file.size > rule.maxSizeBytes) {
          const maxMb = Math.round(rule.maxSizeBytes / (1024 * 1024))
          toast.error(`File "${file.name}" exceeds maximum allowed size of ${maxMb} MB.`)
          continue
        }
        stagedTasks.push({
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          file,
          assetType: activeTab,
          progress: 0,
          loadedBytes: 0,
          totalBytes: file.size,
          status: "staged",
          chapterTitle: activeTab === "audio_chapter" ? chapterTitle || file.name : undefined,
        })
      }

      if (stagedTasks.length > 0) {
        setUploadQueue((prev) => [...prev, ...stagedTasks])
        setChapterTitle("")
        toast.success(
          `${stagedTasks.length} file(s) attached. Click "Publish Book" to save book & upload to Cloudflare R2 automatically!`
        )
      }
      return
    }

    // Normal upload if publicationId already exists
    const newTasks: UploadTask[] = fileList.map((file) => ({
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      file,
      assetType: activeTab,
      progress: 0,
      loadedBytes: 0,
      totalBytes: file.size,
      status: "validating",
      chapterTitle: activeTab === "audio_chapter" ? chapterTitle || file.name : undefined,
    }))

    setUploadQueue((prev) => [...prev, ...newTasks])
    setChapterTitle("")

    // Kick off uploads
    newTasks.forEach((t) => executeUpload(t))
  }

  const cancelUpload = (taskId: string) => {
    const task = uploadQueue.find((t) => t.id === taskId)
    if (task?.xhr) {
      task.xhr.abort()
    }
  }

  const retryUpload = (taskId: string) => {
    const task = uploadQueue.find((t) => t.id === taskId)
    if (task) {
      setUploadQueue((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: "validating", progress: 0, loadedBytes: 0, errorMessage: undefined }
            : t
        )
      )
      executeUpload(task)
    }
  }

  const removeTaskFromQueue = (taskId: string) => {
    cancelUpload(taskId)
    setUploadQueue((prev) => prev.filter((t) => t.id !== taskId))
  }

  // Toggle archive status
  const handleToggleArchive = async (asset: AssetRecord) => {
    const nextStatus = asset.upload_status === "archived" ? "completed" : "archived"
    try {
      const res = await fetch(
        `/api/admin/publications/${publicationId}/assets/${asset.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ upload_status: nextStatus }),
        }
      )
      const data = await res.json()
      if (res.ok) {
        toast.success(
          nextStatus === "archived"
            ? `Asset archived.`
            : `Asset restored to active.`
        )
        fetchAssets()
      } else {
        toast.error(data.error || "Failed to update asset status.")
      }
    } catch {
      toast.error("Network error updating status.")
    }
  }

  // Toggle downloadability
  const handleToggleDownloadable = async (asset: AssetRecord) => {
    try {
      const res = await fetch(
        `/api/admin/publications/${publicationId}/assets/${asset.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_downloadable: !asset.is_downloadable }),
        }
      )
      const data = await res.json()
      if (res.ok) {
        toast.success(
          !asset.is_downloadable
            ? "File is now downloadable by entitled users."
            : "File restricted to in-browser viewing only."
        )
        fetchAssets()
      } else {
        toast.error(data.error || "Failed to update asset.")
      }
    } catch {
      toast.error("Network error updating asset.")
    }
  }

  // Delete asset
  const handleDeleteAsset = async (asset: AssetRecord) => {
    if (!confirm(`Are you sure you want to permanently delete "${asset.original_filename}" from Cloudflare R2 and database?`)) {
      return
    }
    try {
      setDeletingId(asset.id)
      const res = await fetch(
        `/api/admin/publications/${publicationId}/assets/${asset.id}`,
        { method: "DELETE" }
      )
      const data = await res.json()
      if (res.ok) {
        toast.success(`Deleted ${asset.original_filename} from Cloudflare R2.`)
        fetchAssets()
      } else {
        toast.error(data.error || "Failed to delete asset.")
      }
    } catch {
      toast.error("Network error deleting asset.")
    } finally {
      setDeletingId(null)
    }
  }

  const tabs: { type: PublicationAssetType; label: string; icon: any }[] = [
    { type: "pdf", label: "PDF eBook", icon: FileText },
    { type: "epub", label: "EPUB Reader", icon: BookOpen },
    { type: "audiobook", label: "Audiobook", icon: Headphones },
    { type: "audio_chapter", label: "Audio Chapters", icon: Music },
    { type: "video", label: "Private Video", icon: Video },
  ]

  const currentRule = ASSET_RULES[activeTab]
  const currentTabAssets = assets.filter((a) => a.asset_type === activeTab)

  return (
    <div className="rounded-xl bg-white border border-neutral-200/80 p-5 space-y-4 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-neutral-900 flex items-center gap-2">
              Cloudflare R2 Digital Assets
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                Private Bucket
              </Badge>
            </h3>
            <p className="text-[11px] text-neutral-500">
              Files are stored strictly in private bucket <code>hiddenbooks-private</code> and delivered via short-lived signed URLs.
            </p>
          </div>
        </div>

        {publicationId && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={fetchAssets}
            disabled={loading}
            className="text-xs h-7 px-2.5 rounded-md text-neutral-600 hover:text-neutral-900"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <RotateCcw className="w-3.5 h-3.5 mr-1" />}
            Refresh
          </Button>
        )}
      </div>

      {!publicationId && (
        <div className="p-3.5 rounded-lg bg-emerald-50/70 border border-emerald-200/80 text-xs flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <UploadCloud className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-emerald-950 block">Pre-Publish File Upload Enabled</span>
            <span className="text-[11px] text-emerald-800 leading-relaxed block">
              You can select and attach your eBook / Audiobook files right now. When you click <strong>&quot;Publish Book&quot;</strong>, they will be automatically uploaded and secured in Cloudflare R2!
            </span>
          </div>
        </div>
      )}

      {/* Format Tabs */}
      <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-neutral-100 border border-neutral-200/60">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const count = assets.filter((a) => a.asset_type === tab.type).length
          const isActive = activeTab === tab.type
          return (
            <button
              key={tab.type}
              type="button"
              onClick={() => setActiveTab(tab.type)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                isActive
                  ? "bg-white text-neutral-900 shadow-xs font-semibold"
                  : "text-neutral-600 hover:text-neutral-900 hover:bg-white/60"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? "bg-black text-white" : "bg-neutral-200 text-neutral-700"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Upload Zone */}
      <div className="space-y-3">
        {activeTab === "audio_chapter" && (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Optional Chapter Title (e.g. Chapter 1: The Beginning)"
              value={chapterTitle}
              onChange={(e) => setChapterTitle(e.target.value)}
              className="flex-1 h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 transition-colors"
            />
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            setIsDragging(false)
          }}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragging(false)
            if (e.dataTransfer.files?.length) {
              handleFilesAdded(e.dataTransfer.files)
            }
          }}
          className={`border-2 border-dashed rounded-lg p-5 text-center transition-all ${
            isDragging
              ? "border-neutral-900 bg-neutral-50 scale-[0.99]"
              : "border-neutral-200 bg-neutral-50/50 hover:border-neutral-400 hover:bg-white"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple={activeTab === "audio_chapter"}
            accept={currentRule.allowedExtensions.join(",")}
            onChange={(e) => {
              if (e.target.files?.length) {
                handleFilesAdded(e.target.files)
              }
            }}
            className="hidden"
          />

          <div className="space-y-2">
            <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center mx-auto text-neutral-700">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-800">
                Drag and drop {currentRule.label} here, or{" "}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-neutral-900 underline font-bold hover:text-neutral-600"
                >
                  Browse Files
                </button>
              </p>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Allowed: {currentRule.allowedExtensions.join(", ")} &bull; Max Size:{" "}
                {Math.round(currentRule.maxSizeBytes / (1024 * 1024))} MB
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Upload Tasks Queue */}
      {uploadQueue.length > 0 && (
        <div className="space-y-2 pt-2">
          <span className="text-xs font-semibold text-neutral-700 block">
            Active Upload Queue ({uploadQueue.length})
          </span>
          <div className="space-y-2">
            {uploadQueue.map((task) => (
              <div
                key={task.id}
                className="p-3 rounded-lg bg-neutral-50/80 border border-neutral-200/60 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <FileCheck className="w-4 h-4 text-neutral-600 shrink-0" />
                    <span className="font-semibold text-neutral-900 truncate">
                      {task.file.name}
                    </span>
                    <span className="text-neutral-500 text-[11px] font-mono shrink-0">
                      ({formatBytes(task.file.size)})
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {task.status === "staged" && (
                      <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-300 font-medium">
                        Ready • Saves on Publish
                      </Badge>
                    )}
                    {task.status === "uploading" && (
                      <span className="text-[11px] font-mono font-bold text-neutral-700">
                        {task.progress}% ({formatBytes(task.loadedBytes)} /{" "}
                        {formatBytes(task.totalBytes)})
                      </span>
                    )}
                    {task.status === "verifying" && (
                      <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Verifying in R2...
                      </span>
                    )}
                    {task.status === "completed" && (
                      <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Uploaded
                      </span>
                    )}
                    {task.status === "error" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => retryUpload(task.id)}
                        className="h-6 text-[10px] px-2 text-red-700 border-red-200 hover:bg-red-50 rounded-md"
                      >
                        <RotateCcw className="w-2.5 h-2.5 mr-1" /> Retry
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeTaskFromQueue(task.id)}
                      className="p-1 rounded-md text-neutral-400 hover:text-black hover:bg-neutral-200 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                {(task.status === "uploading" || task.status === "verifying") && (
                  <div className="w-full h-1.5 rounded-full bg-neutral-200 overflow-hidden">
                    <div
                      className="h-full bg-black transition-all duration-150"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                )}

                {task.errorMessage && (
                  <p className="text-[11px] text-red-600 font-medium">
                    {task.errorMessage}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing Uploaded Assets Table */}
      {publicationId && (
        <div className="space-y-3 pt-2">
          <span className="text-xs font-semibold text-neutral-700 block">
            Configured {currentRule.label} Files ({currentTabAssets.length})
          </span>

          {currentTabAssets.length === 0 ? (
            <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200/60 text-center text-xs text-neutral-500">
              No {currentRule.label} file attached yet. Upload above to store in private Cloudflare R2.
            </div>
          ) : (
            <div className="space-y-2">
              {currentTabAssets.map((asset) => {
                const isArchived = asset.upload_status === "archived"
                return (
                  <div
                    key={asset.id}
                    className={`p-3.5 rounded-lg border transition-all ${
                      isArchived
                        ? "bg-neutral-50/50 border-neutral-200 opacity-60"
                        : "bg-white border-neutral-200/80 shadow-xs"
                    }`}
                  >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-neutral-900">
                                {asset.metadata?.title || asset.original_filename}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-mono ${
                                  isArchived
                                    ? "bg-neutral-100 text-neutral-500"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                }`}
                              >
                                {asset.upload_status.toUpperCase()}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] font-mono bg-blue-50 text-blue-700 border-blue-200">
                                R2
                              </Badge>
                              {asset.is_downloadable ? (
                                <Badge variant="outline" className="text-[10px] text-neutral-600">
                                  Downloadable
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-amber-700 bg-amber-50 border-amber-200">
                                  View/Stream Only
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-neutral-500 font-mono flex items-center gap-3">
                              <span>Size: {formatBytes(asset.file_size)}</span>
                              <span>&bull;</span>
                              <span className="truncate max-w-[200px]" title={asset.object_key}>
                                Key: {asset.object_key}
                              </span>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {asset.previewUrl && (
                              <a
                                href={asset.previewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex"
                              >
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[11px] px-2.5 gap-1 text-neutral-700 hover:text-black"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Preview</span>
                                  <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                                </Button>
                              </a>
                            )}

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleDownloadable(asset)}
                              className="h-7 text-[11px] px-2 text-neutral-600 hover:text-black"
                              title={asset.is_downloadable ? "Switch to View-Only" : "Allow Download"}
                            >
                              <Download className="w-3 h-3 mr-1" />
                              {asset.is_downloadable ? "Lock" : "Unlock"}
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleArchive(asset)}
                              className="h-7 text-[11px] px-2 text-neutral-600 hover:text-black"
                              title={isArchived ? "Unarchive Asset" : "Archive Asset"}
                            >
                              <Archive className="w-3 h-3 mr-1" />
                              {isArchived ? "Unarchive" : "Archive"}
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={deletingId === asset.id}
                              onClick={() => handleDeleteAsset(asset)}
                              className="h-7 text-[11px] px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete Permanently from R2"
                            >
                              {deletingId === asset.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
    </div>
  )
})
