"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Save,
  Send,
  Eye,
  FileText,
  Code2,
  Palette,
  Globe,
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  SlidersHorizontal,
  RefreshCw,
  Tag,
  FolderOpen,
  Calendar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { NativeSelect } from "@/components/ui/select"
import { slugify, formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { CloudinaryUpload } from "@/components/admin/cloudinary-upload"
import { TipTapEditor } from "./editor/tiptap-editor"
import { SourceEditor } from "./editor/source-editor"
import { CssEditor } from "./editor/css-editor"
import { ArticlePreview } from "./editor/article-preview"
import { SeoPanel } from "./editor/seo-panel"

interface Author {
  id: string
  name: string
  avatar_url?: string | null
}

interface Category {
  id: string
  name: string
  slug: string
}

interface TagItem {
  id: string
  name: string
  slug: string
}

interface BlogFormProps {
  initialData?: {
    id: string
    title: string
    slug: string
    excerpt: string | null
    content: string
    featured_image?: string | null
    cover_image_url?: string | null
    custom_css?: string | null
    og_image_url?: string | null
    focus_keyword?: string | null
    canonical_url?: string | null
    author_id?: string | null
    status: "draft" | "published" | "scheduled"
    seo_title?: string | null
    seo_description?: string | null
    published_at?: string | null
    reading_time_minutes?: number | null
    category_ids?: string[]
    tag_ids?: string[]
  }
}

type SaveStatus = "saved" | "saving" | "unsaved" | "error"

export function BlogForm({ initialData }: BlogFormProps) {
  const router = useRouter()
  const isEditing = !!initialData?.id
  const [postId, setPostId] = React.useState<string | undefined>(initialData?.id)

  // Primary Content States
  const [title, setTitle] = React.useState(initialData?.title || "")
  const [slug, setSlug] = React.useState(initialData?.slug || "")
  const [isSlugLocked, setIsSlugLocked] = React.useState(!!initialData?.slug)
  const [excerpt, setExcerpt] = React.useState(initialData?.excerpt || "")
  const [content, setContent] = React.useState(initialData?.content || "")
  const [featuredImage, setFeaturedImage] = React.useState(
    initialData?.featured_image || initialData?.cover_image_url || ""
  )
  const [customCss, setCustomCss] = React.useState(initialData?.custom_css || "")

  // Meta & Classification
  const [authorId, setAuthorId] = React.useState(initialData?.author_id || "")
  const [status, setStatus] = React.useState<"draft" | "published" | "scheduled">(
    initialData?.status || "draft"
  )
  const [publishedAt, setPublishedAt] = React.useState(initialData?.published_at || "")
  const [selectedCategoryIds, setSelectedCategoryIds] = React.useState<string[]>(
    initialData?.category_ids || []
  )
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>(
    initialData?.tag_ids || []
  )

  // SEO Fields
  const [seoTitle, setSeoTitle] = React.useState(initialData?.seo_title || "")
  const [seoDescription, setSeoDescription] = React.useState(initialData?.seo_description || "")
  const [canonicalUrl, setCanonicalUrl] = React.useState(initialData?.canonical_url || "")
  const [ogImageUrl, setOgImageUrl] = React.useState(initialData?.og_image_url || "")
  const [focusKeyword, setFocusKeyword] = React.useState(initialData?.focus_keyword || "")

  // Lookups & Options
  const [authors, setAuthors] = React.useState<Author[]>([])
  const [categories, setCategories] = React.useState<Category[]>([])
  const [tags, setTags] = React.useState<TagItem[]>([])

  // Editor UI States
  const [activeTab, setActiveTab] = React.useState<string>("visual")
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>("saved")
  const [lastSavedTime, setLastSavedTime] = React.useState<string | null>(null)
  const [isPublishDialogOpen, setIsPublishDialogOpen] = React.useState(false)
  const [isSavingManual, setIsSavingManual] = React.useState(false)
  const [mobileSettingsOpen, setMobileSettingsOpen] = React.useState(false)
  const [wordCount, setWordCount] = React.useState(0)

  // Unsaved changes tracking ref
  const hasUnsavedChanges = React.useRef(false)
  const lastSavedPayload = React.useRef<string>("")

  // Fetch Authors & Categories
  React.useEffect(() => {
    async function fetchMetadata() {
      try {
        const [authorsRes, catsRes] = await Promise.all([
          fetch("/api/admin/authors"),
          fetch("/api/admin/blog/categories"),
        ])

        if (authorsRes.ok) {
          const aData = await authorsRes.json()
          setAuthors(aData.authors || [])
        }

        if (catsRes.ok) {
          const cData = await catsRes.json()
          setCategories(cData.categories || [])
          setTags(cData.tags || [])
        }
      } catch {
        // Fallback gracefully
      }
    }
    fetchMetadata()
  }, [])

  // Local storage draft crash recovery check
  React.useEffect(() => {
    const storageKey = `hb_editorial_draft_${postId || "new"}`
    try {
      const cached = localStorage.getItem(storageKey)
      if (cached && !initialData?.content) {
        const parsed = JSON.parse(cached)
        if (parsed.content && parsed.content !== content) {
          toast.info("Unsaved draft recovered from local session", {
            action: {
              label: "Restore",
              onClick: () => {
                setTitle(parsed.title || title)
                setContent(parsed.content)
                setExcerpt(parsed.excerpt || excerpt)
                toast.success("Local draft restored!")
              },
            },
          })
        }
      }
    } catch {
      // LocalStorage access safe ignore
    }
  }, [postId])

  // Handle Title input & automatic slug generator
  const handleTitleChange = (val: string) => {
    setTitle(val)
    hasUnsavedChanges.current = true
    setSaveStatus("unsaved")

    if (!isSlugLocked) {
      setSlug(slugify(val))
    }
    if (!seoTitle) {
      setSeoTitle(val)
    }
  }

  // Handle Content update from any editor mode
  const handleContentChange = (newHtml: string) => {
    setContent(newHtml)
    hasUnsavedChanges.current = true
    setSaveStatus("unsaved")

    // Update local storage backup
    try {
      const storageKey = `hb_editorial_draft_${postId || "new"}`
      localStorage.setItem(
        storageKey,
        JSON.stringify({ title, slug, excerpt, content: newHtml, timestamp: Date.now() })
      )
    } catch {
      // Ignore
    }
  }

  // Warn user before navigating away if unsaved changes exist
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges.current) {
        e.preventDefault()
        e.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [])

  // Core Save Routine (used by Manual Save, Publish, and Autosave)
  const savePost = async (
    targetStatus?: "draft" | "published" | "scheduled",
    isAutosave = false
  ): Promise<boolean> => {
    if (!title.trim()) {
      if (!isAutosave) toast.error("Article title is required")
      return false
    }

    const payloadStatus = targetStatus || status
    const currentPayload = JSON.stringify({
      id: postId,
      title: title.trim(),
      slug: slug.trim() || slugify(title),
      excerpt: excerpt.trim(),
      content,
      featured_image: featuredImage.trim() || null,
      cover_image_url: featuredImage.trim() || null,
      custom_css: customCss.trim() || null,
      og_image_url: ogImageUrl.trim() || featuredImage.trim() || null,
      focus_keyword: focusKeyword.trim() || null,
      canonical_url: canonicalUrl.trim() || null,
      author_id: authorId || null,
      status: payloadStatus,
      seo_title: seoTitle.trim() || title.trim(),
      seo_description: seoDescription.trim() || excerpt.trim() || null,
      published_at: payloadStatus === "published" ? publishedAt || new Date().toISOString() : null,
      category_ids: selectedCategoryIds,
      tag_ids: selectedTagIds,
    })

    // Avoid duplicate requests if nothing changed
    if (isAutosave && currentPayload === lastSavedPayload.current) {
      return true
    }

    try {
      setSaveStatus("saving")
      if (!isAutosave) setIsSavingManual(true)

      const url = "/api/admin/blog"
      const method = postId ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: currentPayload,
      })

      const data = await res.json()

      if (res.ok) {
        lastSavedPayload.current = currentPayload
        hasUnsavedChanges.current = false
        setSaveStatus("saved")
        setLastSavedTime(
          new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        )

        // If newly created post, set postId and smoothly update browser URL
        if (!postId && data.post?.id) {
          setPostId(data.post.id)
          window.history.replaceState(null, "", `/super-admin/blog/${data.post.id}/edit`)
        }

        if (targetStatus) {
          setStatus(targetStatus)
        }

        if (!isAutosave) {
          toast.success(
            payloadStatus === "published"
              ? "Article published successfully to HiddenBooks!"
              : "Draft saved successfully"
          )
        }
        return true
      } else {
        setSaveStatus("error")
        if (!isAutosave) {
          if (res.status === 401) {
            toast.error("Your administrative session has expired. Please refresh the page or sign in again.")
          } else if (res.status === 403) {
            toast.error(data.error || "Permission denied: Insufficient editorial privileges to perform this action.")
          } else if (res.status === 400) {
            toast.error(data.error || "Validation error: Please verify article fields.")
          } else if (res.status === 409) {
            toast.error(data.error || "Duplicate slug: An article with this URL already exists.")
          } else {
            toast.error(data.error || "Failed to save article. Your editorial content remains safely preserved.")
          }
        }
        return false
      }
    } catch {
      setSaveStatus("error")
      if (!isAutosave) {
        toast.error("Network communication error while saving article. Content is preserved.")
      }
      return false
    } finally {
      if (!isAutosave) setIsSavingManual(false)
    }
  }

  // Debounced Autosave (Every 3.5 seconds of idle time)
  React.useEffect(() => {
    if (!title.trim()) return

    const timer = setTimeout(() => {
      if (hasUnsavedChanges.current) {
        savePost(undefined, true)
      }
    }, 3500)

    return () => clearTimeout(timer)
  }, [
    title,
    slug,
    excerpt,
    content,
    featuredImage,
    customCss,
    authorId,
    status,
    seoTitle,
    seoDescription,
    canonicalUrl,
    ogImageUrl,
    focusKeyword,
    selectedCategoryIds,
    selectedTagIds,
  ])

  // Handle Publish with modal confirmation
  const handleConfirmPublish = async () => {
    setIsPublishDialogOpen(false)
    const success = await savePost("published", false)
    if (success) {
      router.push("/super-admin/blog")
      router.refresh()
    }
  }

  // Selected Author Object for preview
  const currentAuthor = authors.find((a) => a.id === authorId)

  // Toggle Category selection
  const handleToggleCategory = (catId: string) => {
    hasUnsavedChanges.current = true
    setSaveStatus("unsaved")
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    )
  }

  // Toggle Tag selection
  const handleToggleTag = (tagId: string) => {
    hasUnsavedChanges.current = true
    setSaveStatus("unsaved")
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  // Sidebar Settings Content (Used both in desktop sidebar and mobile sheet)
  const SettingsPanelContent = (
    <div className="space-y-4">
      {/* 1. Status & Publishing Card */}
      <div className="border border-neutral-200/90 rounded-xl bg-white p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
            <Send className="h-3.5 w-3.5 text-neutral-600" /> Publication State
          </span>
          <Badge
            variant="outline"
            className={
              status === "published"
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-mono text-[10px]"
                : status === "scheduled"
                ? "bg-blue-50 text-blue-800 border-blue-300 font-mono text-[10px]"
                : "bg-neutral-100 text-neutral-700 border-neutral-300 font-mono text-[10px]"
            }
          >
            {status.toUpperCase()}
          </Badge>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">
            Status
          </label>
          <NativeSelect
            value={status}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              setStatus(e.target.value as "draft" | "published" | "scheduled")
              hasUnsavedChanges.current = true
              setSaveStatus("unsaved")
            }}
            className="w-full h-8 text-xs font-sans"
          >
            <option value="draft">Draft (Private editorial)</option>
            <option value="published">Published (Public live on HiddenBooks)</option>
            <option value="scheduled">Scheduled</option>
          </NativeSelect>
        </div>

        {status === "published" && (
          <div>
            <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">
              Publication Timestamp
            </label>
            <Input
              type="datetime-local"
              value={publishedAt ? publishedAt.slice(0, 16) : ""}
              onChange={(e) => {
                setPublishedAt(e.target.value ? new Date(e.target.value).toISOString() : "")
                hasUnsavedChanges.current = true
                setSaveStatus("unsaved")
              }}
              className="h-8 text-xs font-mono"
            />
          </div>
        )}
      </div>

      {/* 2. Featured Cover Image Card (Cloudinary) */}
      <div className="border border-neutral-200/90 rounded-xl bg-white p-4 shadow-xs space-y-3">
        <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider block">
          Featured Header Image
        </span>
        <CloudinaryUpload
          value={featuredImage}
          onChange={(url) => {
            setFeaturedImage(url)
            hasUnsavedChanges.current = true
            setSaveStatus("unsaved")
          }}
          onRemove={() => {
            setFeaturedImage("")
            hasUnsavedChanges.current = true
            setSaveStatus("unsaved")
          }}
          assetType="blog_cover"
          label="Featured Article Cover"
          description="High-resolution banner displayed on the article header and social cards"
          aspectRatio="banner"
          entityId={{ blog_post_id: postId }}
        />
      </div>

      {/* 3. Author & Byline Card */}
      <div className="border border-neutral-200/90 rounded-xl bg-white p-4 shadow-xs space-y-3">
        <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider block">
          Author & Byline
        </span>
        <NativeSelect
          value={authorId}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            setAuthorId(e.target.value)
            hasUnsavedChanges.current = true
            setSaveStatus("unsaved")
          }}
          className="w-full h-8 text-xs font-sans"
        >
          <option value="">HiddenBooks Editorial Staff</option>
          {authors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </NativeSelect>
        <p className="text-[11px] text-neutral-500">
          The selected author's avatar, byline, and bio appear at the top and bottom of the article.
        </p>
      </div>

      {/* 4. Categories & Topics */}
      <div className="border border-neutral-200/90 rounded-xl bg-white p-4 shadow-xs space-y-3">
        <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
          <FolderOpen className="h-3.5 w-3.5 text-neutral-600" /> Categories
        </span>
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {categories.map((cat) => {
            const isSelected = selectedCategoryIds.includes(cat.id)
            return (
              <label
                key={cat.id}
                className="flex items-center gap-2 text-xs text-neutral-800 cursor-pointer hover:bg-neutral-50 p-1 rounded"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggleCategory(cat.id)}
                  className="rounded border-neutral-300 text-neutral-900 focus:ring-black h-3.5 w-3.5"
                />
                <span>{cat.name}</span>
              </label>
            )
          })}
        </div>
      </div>

      {/* 5. Editorial Tags */}
      <div className="border border-neutral-200/90 rounded-xl bg-white p-4 shadow-xs space-y-3">
        <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5 text-neutral-600" /> Tags
        </span>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => {
            const isSelected = selectedTagIds.includes(t.id)
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleToggleTag(t.id)}
                className={`text-[11px] px-2.5 py-1 rounded-full font-mono transition-colors ${
                  isSelected
                    ? "bg-neutral-900 text-white font-medium shadow-2xs"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70"
                }`}
              >
                #{t.name}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 pb-20">
      {/* ========================================================================= */}
      {/* STICKY TOP TOOLBAR                                                       */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-[#F6F5F2]/95 backdrop-blur-md border-b border-neutral-200/90 flex flex-wrap items-center justify-between gap-3 shadow-2xs transition-all">
        {/* Left: Navigation and Title / Status */}
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/super-admin/blog">
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="h-8 gap-1.5 text-xs bg-white border-neutral-300 text-neutral-800 hover:bg-neutral-100 shadow-2xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Blog
            </Button>
          </Link>

          <div className="h-4 w-px bg-neutral-300 hidden sm:block" />

          <div className="min-w-0 flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-tight text-neutral-900 font-serif truncate max-w-[200px] sm:max-w-xs md:max-w-md">
              {title || <span className="text-neutral-400 italic">Untitled Editorial</span>}
            </h1>

            {/* Autosave & Sync indicator badge */}
            <div className="flex items-center gap-1.5 text-[11px] font-mono">
              {saveStatus === "saving" && (
                <Badge variant="outline" className="h-5 gap-1 border-neutral-300 bg-neutral-100 text-neutral-600">
                  <RefreshCw className="h-3 w-3 animate-spin text-neutral-500" />
                  <span>Saving...</span>
                </Badge>
              )}
              {saveStatus === "saved" && (
                <Badge variant="outline" className="h-5 gap-1 border-emerald-300 bg-emerald-50/80 text-emerald-800">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  <span>Saved {lastSavedTime ? `at ${lastSavedTime}` : ""}</span>
                </Badge>
              )}
              {saveStatus === "unsaved" && (
                <Badge variant="outline" className="h-5 gap-1 border-amber-300 bg-amber-50/80 text-amber-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>Unsaved changes</span>
                </Badge>
              )}
              {saveStatus === "error" && (
                <Badge variant="outline" className="h-5 gap-1 border-red-300 bg-red-50/80 text-red-800">
                  <AlertCircle className="h-3 w-3 text-red-600" />
                  <span>Save error</span>
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions (Preview, Settings Drawer on mobile, Save Draft, Publish) */}
        <div className="flex items-center gap-2">
          {/* Mobile Settings Drawer Button */}
          <div className="lg:hidden">
            <Sheet open={mobileSettingsOpen} onOpenChange={setMobileSettingsOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs bg-white">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Settings</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[340px] sm:w-[420px] overflow-y-auto">
                <SheetHeader className="mb-4">
                  <SheetTitle className="font-serif text-lg">Article Settings</SheetTitle>
                </SheetHeader>
                {SettingsPanelContent}
              </SheetContent>
            </Sheet>
          </div>

          {/* Quick Preview Toggle Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setActiveTab(activeTab === "preview" ? "visual" : "preview")}
            className="h-8 gap-1.5 text-xs bg-white border-neutral-300 shadow-2xs hover:bg-neutral-100"
          >
            <Eye className="h-3.5 w-3.5 text-neutral-600" />
            <span>{activeTab === "preview" ? "Edit Mode" : "Reader Preview"}</span>
          </Button>

          {/* Save Draft Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSavingManual}
            onClick={() => savePost("draft", false)}
            className="h-8 gap-1.5 text-xs bg-white border-neutral-300 text-neutral-900 shadow-2xs hover:bg-neutral-100"
          >
            <Save className="h-3.5 w-3.5 text-neutral-600" />
            <span>{isSavingManual && status === "draft" ? "Saving..." : "Save Draft"}</span>
          </Button>

          {/* Publish Article Button */}
          <Button
            type="button"
            size="sm"
            disabled={isSavingManual}
            onClick={() => setIsPublishDialogOpen(true)}
            className="h-8 gap-1.5 text-xs bg-neutral-900 text-white hover:bg-black shadow-xs font-semibold px-3"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{status === "published" ? "Update Published" : "Publish Article"}</span>
          </Button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MAIN TWO-COLUMN WORKSPACE                                                */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Center: Main Editorial Column (8 or 9 cols) */}
        <div className="lg:col-span-8 xl:col-span-8 space-y-6">
          {/* Article Title, Slug, & Lead Excerpt */}
          <div className="border border-neutral-200/90 rounded-2xl bg-white p-5 sm:p-7 shadow-xs space-y-5">
            {/* Title */}
            <div>
              <Input
                required
                placeholder="The Architecture of Focus: Why Deep Reading Still Matters..."
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="font-serif text-xl sm:text-2xl md:text-3xl font-bold tracking-tight border-none px-0 shadow-none focus-visible:ring-0 placeholder:text-neutral-300 text-neutral-900"
              />
            </div>

            {/* URL Slug Control with Lock / Unlock */}
            <div className="flex items-center gap-2 pt-1 border-t border-neutral-100">
              <span className="text-[11px] font-mono text-neutral-400 select-none">
                hiddenbooks.com/blog/
              </span>
              <Input
                value={slug}
                readOnly={isSlugLocked}
                onChange={(e) => {
                  setSlug(slugify(e.target.value))
                  hasUnsavedChanges.current = true
                  setSaveStatus("unsaved")
                }}
                placeholder="article-slug"
                className={`font-mono text-xs h-7 px-2 border-neutral-200 ${
                  isSlugLocked ? "bg-neutral-50 text-neutral-600 cursor-not-allowed" : "bg-white text-neutral-900"
                }`}
              />
              <Button
                type="button"
                variant="ghost"
                size="iconXs"
                onClick={() => setIsSlugLocked(!isSlugLocked)}
                className="h-7 w-7 text-neutral-500 hover:text-neutral-800"
                title={isSlugLocked ? "Unlock to manually customize slug" : "Lock slug"}
              >
                {isSlugLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5 text-amber-600" />}
              </Button>
            </div>

            {/* Excerpt / Lead Paragraph */}
            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                Article Lead Excerpt (Summary)
              </label>
              <Textarea
                placeholder="A compelling 1-2 sentence lead paragraph shown on editorial index cards, RSS, and social previews..."
                value={excerpt}
                onChange={(e) => {
                  setExcerpt(e.target.value)
                  hasUnsavedChanges.current = true
                  setSaveStatus("unsaved")
                }}
                rows={2}
                className="text-xs font-serif leading-relaxed text-neutral-800"
              />
            </div>
          </div>

          {/* Editor Workspace Tabs: Visual, HTML Source, Custom CSS, Live Preview, SEO */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-3">
            <div className="flex items-center justify-between">
              <TabsList className="bg-neutral-200/70 p-1 rounded-xl">
                <TabsTrigger value="visual" className="text-xs gap-1.5 px-3 py-1.5 font-medium data-[state=active]:bg-white data-[state=active]:shadow-2xs">
                  <FileText className="h-3.5 w-3.5 text-neutral-600" />
                  <span>Visual Editor</span>
                </TabsTrigger>
                <TabsTrigger value="source" className="text-xs gap-1.5 px-3 py-1.5 font-medium data-[state=active]:bg-white data-[state=active]:shadow-2xs">
                  <Code2 className="h-3.5 w-3.5 text-neutral-600" />
                  <span>HTML Source</span>
                </TabsTrigger>
                <TabsTrigger value="css" className="text-xs gap-1.5 px-3 py-1.5 font-medium data-[state=active]:bg-white data-[state=active]:shadow-2xs">
                  <Palette className="h-3.5 w-3.5 text-purple-600" />
                  <span>Scoped CSS</span>
                </TabsTrigger>
                <TabsTrigger value="preview" className="text-xs gap-1.5 px-3 py-1.5 font-medium data-[state=active]:bg-white data-[state=active]:shadow-2xs">
                  <Eye className="h-3.5 w-3.5 text-neutral-600" />
                  <span>Live Preview</span>
                </TabsTrigger>
                <TabsTrigger value="seo" className="text-xs gap-1.5 px-3 py-1.5 font-medium data-[state=active]:bg-white data-[state=active]:shadow-2xs">
                  <Globe className="h-3.5 w-3.5 text-emerald-600" />
                  <span>SEO Suite</span>
                </TabsTrigger>
              </TabsList>

              <div className="text-[11px] text-neutral-500 font-mono hidden sm:block">
                {wordCount.toLocaleString()} words
              </div>
            </div>

            {/* Visual Editor */}
            <TabsContent value="visual" className="mt-0 outline-none">
              <TipTapEditor
                content={content}
                onChange={handleContentChange}
                onWordCountChange={setWordCount}
              />
            </TabsContent>

            {/* HTML Source Inspector */}
            <TabsContent value="source" className="mt-0 outline-none">
              <SourceEditor
                content={content}
                onChange={handleContentChange}
              />
            </TabsContent>

            {/* Scoped CSS Editor */}
            <TabsContent value="css" className="mt-0 outline-none">
              <CssEditor
                customCss={customCss}
                onChange={(val) => {
                  setCustomCss(val)
                  hasUnsavedChanges.current = true
                  setSaveStatus("unsaved")
                }}
              />
            </TabsContent>

            {/* Live Preview Mode */}
            <TabsContent value="preview" className="mt-0 outline-none">
              <ArticlePreview
                title={title}
                content={content}
                excerpt={excerpt}
                featuredImage={featuredImage}
                customCss={customCss}
                authorName={currentAuthor?.name || "HiddenBooks Editorial"}
                authorAvatar={currentAuthor?.avatar_url || undefined}
                publishedAt={publishedAt}
                readingTimeMinutes={Math.max(1, Math.ceil(wordCount / 200))}
              />
            </TabsContent>

            {/* Advanced SEO Panel */}
            <TabsContent value="seo" className="mt-0 outline-none">
              <SeoPanel
                articleTitle={title}
                articleExcerpt={excerpt}
                articleContent={content}
                slug={slug}
                featuredImage={featuredImage}
                seoTitle={seoTitle}
                setSeoTitle={(v) => {
                  setSeoTitle(v)
                  hasUnsavedChanges.current = true
                  setSaveStatus("unsaved")
                }}
                seoDescription={seoDescription}
                setSeoDescription={(v) => {
                  setSeoDescription(v)
                  hasUnsavedChanges.current = true
                  setSaveStatus("unsaved")
                }}
                canonicalUrl={canonicalUrl}
                setCanonicalUrl={(v) => {
                  setCanonicalUrl(v)
                  hasUnsavedChanges.current = true
                  setSaveStatus("unsaved")
                }}
                ogImageUrl={ogImageUrl}
                setOgImageUrl={(v) => {
                  setOgImageUrl(v)
                  hasUnsavedChanges.current = true
                  setSaveStatus("unsaved")
                }}
                focusKeyword={focusKeyword}
                setFocusKeyword={(v) => {
                  setFocusKeyword(v)
                  hasUnsavedChanges.current = true
                  setSaveStatus("unsaved")
                }}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Desktop Contextual Settings Column (4 cols) */}
        <div className="hidden lg:block lg:col-span-4 xl:col-span-4 space-y-4">
          {SettingsPanelContent}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PUBLISH CONFIRMATION DIALOG                                              */}
      {/* ========================================================================= */}
      <Dialog open={isPublishDialogOpen} onOpenChange={setIsPublishDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">
              {status === "published" ? "Update Published Article?" : "Ready to Publish Article?"}
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-600 leading-relaxed pt-2">
              This will make your editorial article publicly accessible to all HiddenBooks readers at{" "}
              <span className="font-mono font-medium text-neutral-900">
                hiddenbooks.com/blog/{slug || slugify(title)}
              </span>
              . SEO metadata and Cloudinary images will be published immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-neutral-50 rounded-xl p-3.5 border border-neutral-200/80 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-neutral-500">Title:</span>
              <span className="font-semibold text-neutral-900 truncate max-w-xs">{title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Featured Image:</span>
              <span className="text-neutral-900">{featuredImage ? "Attached" : "None"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Word Count:</span>
              <span className="font-mono text-neutral-900">{wordCount} words</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPublishDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmPublish}
              className="bg-neutral-900 hover:bg-black text-white font-semibold"
            >
              Confirm & Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
