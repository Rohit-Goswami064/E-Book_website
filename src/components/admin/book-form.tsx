"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { slugify } from "@/lib/utils"
import { toast } from "sonner"
import { Loader2, Save, ArrowLeft } from "lucide-react"
import Link from "next/link"
import {
  PublicationAssetManager,
  type PublicationAssetManagerRef,
} from "@/components/admin/publication-asset-manager"
import { CloudinaryUpload } from "@/components/admin/cloudinary-upload"

interface BookFormProps {
  initialData?: any
  authors: { id: string; name: string }[]
  categories: { id: string; name: string }[]
  selectedCategoryIds?: string[]
}

export function BookForm({
  initialData,
  authors,
  categories,
  selectedCategoryIds = [],
}: BookFormProps) {
  const router = useRouter()
  const assetManagerRef = React.useRef<PublicationAssetManagerRef>(null)
  const isEditing = !!initialData?.id

  const [title, setTitle] = React.useState(initialData?.title || "")
  const [slug, setSlug] = React.useState(initialData?.slug || "")
  const [subtitle, setSubtitle] = React.useState(initialData?.subtitle || "")
  const [authorId, setAuthorId] = React.useState(initialData?.author_id || "")
  const [categoryIds, setCategoryIds] = React.useState<string[]>(selectedCategoryIds)
  const [priceInr, setPriceInr] = React.useState<number>(
    initialData?.price_cents ? initialData.price_cents / 100 : 199
  )
  const [originalPriceInr, setOriginalPriceInr] = React.useState<number | null>(
    initialData?.original_price_cents ? initialData.original_price_cents / 100 : 299
  )
  const [isFree, setIsFree] = React.useState(initialData?.is_free || false)
  const [isPublished, setIsPublished] = React.useState(initialData?.is_published ?? true)
  const [isFeatured, setIsFeatured] = React.useState(initialData?.is_featured || false)
  const [isBestseller, setIsBestseller] = React.useState(initialData?.is_bestseller || false)
  const [coverImageUrl, setCoverImageUrl] = React.useState(initialData?.cover_image_url || "")
  const [format, setFormat] = React.useState(initialData?.format || "PDF")
  const [language, setLanguage] = React.useState(initialData?.language || "Hindi")
  const [pages, setPages] = React.useState<number | "">(initialData?.pages || 240)
  const [isbn, setIsbn] = React.useState(initialData?.isbn || "")
  const [publisher, setPublisher] = React.useState(initialData?.publisher || "HiddenBooks Publishing")
  const [publicationDate, setPublicationDate] = React.useState(initialData?.publication_date || "")
  const [audioDuration, setAudioDuration] = React.useState(initialData?.audio_duration || "")
  const [shortDescription, setShortDescription] = React.useState(initialData?.short_description || "")
  const [description, setDescription] = React.useState(initialData?.description || "")
  const [tocText, setTocText] = React.useState(
    Array.isArray(initialData?.table_of_contents)
      ? initialData.table_of_contents.map((c: any) => c.title || c).join("\n")
      : ""
  )
  const [seoTitle, setSeoTitle] = React.useState(initialData?.seo_title || "")
  const [seoDescription, setSeoDescription] = React.useState(initialData?.seo_description || "")

  const [saving, setSaving] = React.useState(false)

  // Auto-slugify on title change if slug was empty or matching previous title
  const handleTitleChange = (val: string) => {
    setTitle(val)
    if (!isEditing || !slug) {
      setSlug(slugify(val))
    }
  }

  const toggleCategory = (catId: string) => {
    setCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    )
  }

  const [savedPublicationId, setSavedPublicationId] = React.useState<string | undefined>(initialData?.id)
  const effectivePublicationId = initialData?.id || savedPublicationId

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    // Parse TOC lines into JSON structure
    const tocItems = tocText
      .split("\n")
      .map((line: string) => line.trim())
      .filter(Boolean)
      .map((title: string, i: number) => ({ title, page: (i + 1) * 15 }))

    const payload = {
      id: effectivePublicationId,
      title: title.trim(),
      slug: slugify(slug || title),
      subtitle: subtitle.trim() || null,
      author_id: authorId || null,
      category_ids: categoryIds,
      price_inr: isFree ? 0 : Number(priceInr),
      original_price_inr: isFree || !originalPriceInr ? null : Number(originalPriceInr),
      is_free: isFree,
      is_published: isPublished,
      is_featured: isFeatured,
      is_bestseller: isBestseller,
      cover_image_url: coverImageUrl.trim() || null,
      short_description: shortDescription.trim() || null,
      description: description.trim() || null,
      format,
      language,
      pages: pages ? Number(pages) : null,
      isbn: isbn.trim() || null,
      publisher: publisher.trim() || null,
      publication_date: publicationDate || null,
      audio_duration: audioDuration.trim() || null,
      table_of_contents: tocItems,
      seo_title: seoTitle.trim() || null,
      seo_description: seoDescription.trim() || null,
    }

    try {
      const res = await fetch("/api/admin/books", {
        method: effectivePublicationId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (res.ok) {
        const bookId = effectivePublicationId || data.book?.id

        if (!effectivePublicationId && data.book?.id) {
          setSavedPublicationId(data.book.id)
          window.history.replaceState(null, "", `/super-admin/books/${data.book.id}/edit`)
        }

        // If there are files staged in the asset manager before publish, upload them now
        let uploadFailed = false
        if (assetManagerRef.current?.hasPendingFiles() && bookId) {
          toast.loading("Uploading attached book assets to Cloudflare R2...", { id: "asset-upload" })
          try {
            const uploadSuccess = await assetManagerRef.current.uploadPendingFiles(bookId)
            if (uploadSuccess) {
              toast.success("Book and digital assets published successfully!", { id: "asset-upload" })
            } else {
              uploadFailed = true
              toast.error("Book saved, but some assets failed to upload. Check assets below.", { id: "asset-upload" })
            }
          } catch {
            uploadFailed = true
            toast.error("Error during asset upload. Check assets below.", { id: "asset-upload" })
          }
        } else {
          toast.success(effectivePublicationId ? "Book updated successfully." : "Book created successfully.")
        }

        if (!uploadFailed) {
          router.push("/super-admin/books")
          router.refresh()
        }
      } else {
        toast.error(data.error || "Failed to save book.")
      }
    } catch {
      toast.error("An unexpected network error occurred.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6 w-full max-w-[1400px]">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-neutral-200/80 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/super-admin/books"
            className="w-8 h-8 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 flex items-center justify-center text-neutral-600 hover:text-neutral-900 shadow-xs transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
              {isEditing ? `Edit: ${initialData.title}` : "Create New Publication"}
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Configure publication details, pricing, categories, and SEO fields.
            </p>
          </div>
        </div>

        <Button
          type="submit"
          disabled={saving}
          className="h-9 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold px-4 shadow-xs gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{isEditing ? "Update Book" : "Publish Book"}</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Primary Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl bg-white border border-neutral-200/80 p-5 space-y-4 shadow-xs">
            <h3 className="font-semibold text-sm text-neutral-900 pb-3 border-b border-neutral-100">
              Basic Information
            </h3>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                Book Title *
              </label>
              <input
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                required
                placeholder="e.g. गोदान (Godaan) or The Mindset"
                className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  URL Slug *
                </label>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                  placeholder="godaan-edition"
                  className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-mono text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Author
                </label>
                <select
                  value={authorId}
                  onChange={(e) => setAuthorId(e.target.value)}
                  className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 transition-colors"
                >
                  <option value="">Select Author...</option>
                  {authors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                Subtitle
              </label>
              <input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="e.g. A Timeless Examination of Indian Agrarian Life"
                className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                Short Description / Excerpt
              </label>
              <textarea
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="1-2 sentences summarizing the book for catalogue cards..."
                rows={2}
                className="w-full min-h-[60px] rounded-lg border border-neutral-200 bg-white p-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                Full Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Complete editorial book overview, key themes, and background..."
                rows={4}
                className="w-full min-h-[120px] rounded-lg border border-neutral-200 bg-white p-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 transition-colors"
              />
            </div>
          </div>

          {/* Pricing & Commercial Model */}
          <div className="rounded-xl bg-white border border-neutral-200/80 p-5 space-y-4 shadow-xs">
            <h3 className="font-semibold text-sm text-neutral-900 pb-3 border-b border-neutral-100">
              Pricing & Access Entitlement
            </h3>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50 border border-neutral-200/60">
              <input
                type="checkbox"
                id="isFree"
                checked={isFree}
                onChange={(e) => setIsFree(e.target.checked)}
                className="w-4 h-4 rounded text-neutral-900 border-neutral-300 focus:ring-neutral-900 cursor-pointer"
              />
              <label htmlFor="isFree" className="text-xs font-semibold text-neutral-800 cursor-pointer">
                100% Free Book (No payment required, instant claim)
              </label>
            </div>

            {!isFree && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                    Price (INR ₹) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={priceInr}
                    onChange={(e) => setPriceInr(Number(e.target.value))}
                    required
                    className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-mono text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                    Original Price (INR ₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={originalPriceInr || ""}
                    onChange={(e) => setOriginalPriceInr(e.target.value ? Number(e.target.value) : null)}
                    placeholder="e.g. 299 (shows strike-through)"
                    className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-mono text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 transition-colors"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Cloudflare R2 Protected Digital Assets */}
          <PublicationAssetManager
            ref={assetManagerRef}
            publicationId={effectivePublicationId}
            isDraft={!effectivePublicationId}
            onPublicationSaveRequired={() => {
              toast.info("Please fill in the title and click 'Publish Book' (or Save) to create the publication record first.")
            }}
          />

          {/* Table of Contents */}
          <div className="rounded-xl bg-white border border-neutral-200/80 p-5 space-y-3 shadow-xs">
            <h3 className="font-semibold text-sm text-neutral-900 pb-3 border-b border-neutral-100">
              Table of Contents (Chapters)
            </h3>
            <p className="text-[11px] text-neutral-500">
              Enter one chapter per line. These will be parsed into the interactive reader index.
            </p>
            <textarea
              value={tocText}
              onChange={(e) => setTocText(e.target.value)}
              placeholder={"अध्याय 1: शुरुआत\nअध्याय 2: मन की शांति\nअध्याय 3: सफलता के सूत्र"}
              rows={4}
              className="w-full min-h-[100px] rounded-lg border border-neutral-200 bg-white p-3 font-mono text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 transition-colors"
            />
          </div>

          {/* SEO Metadata */}
          <div className="rounded-xl bg-white border border-neutral-200/80 p-5 space-y-4 shadow-xs">
            <h3 className="font-semibold text-sm text-neutral-900 pb-3 border-b border-neutral-100">
              Search Engine Optimization (SEO)
            </h3>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                Custom SEO Title
              </label>
              <input
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="Leave blank to use default template: [Title] — by [Author]"
                className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                Meta Description
              </label>
              <textarea
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                placeholder="Concise 150-160 character summary for Google search snippets..."
                rows={2}
                className="w-full min-h-[60px] rounded-lg border border-neutral-200 bg-white p-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 transition-colors"
              />
            </div>

            {/* Live Search Preview */}
            <div className="p-3.5 rounded-lg bg-neutral-50 border border-neutral-200/60 space-y-1">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block mb-1">
                Google Search Result Preview
              </span>
              <div className="text-[#1a0dab] text-sm font-medium hover:underline truncate">
                {seoTitle || `${title || "Book Title"} | HiddenBooks`}
              </div>
              <div className="text-[#006621] text-xs">
                https://hiddenbooks.com/books/{slug || "book-slug"}
              </div>
              <div className="text-xs text-neutral-600 line-clamp-2">
                {seoDescription || shortDescription || "Discover and read curated editions on HiddenBooks."}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Settings & Metadata */}
        <div className="space-y-6">
          {/* Status & Visibility */}
          <div className="rounded-xl bg-white border border-neutral-200/80 p-5 space-y-3 shadow-xs">
            <h3 className="font-semibold text-sm text-neutral-900 pb-3 border-b border-neutral-100">
              Visibility & Badges
            </h3>

            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="w-4 h-4 rounded text-neutral-900 border-neutral-300 focus:ring-neutral-900"
                />
                <span className="font-semibold text-neutral-800">Publicly Published</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="w-4 h-4 rounded text-neutral-900 border-neutral-300 focus:ring-neutral-900"
                />
                <span className="text-neutral-700">Homepage Featured Showcase</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBestseller}
                  onChange={(e) => setIsBestseller(e.target.checked)}
                  className="w-4 h-4 rounded text-neutral-900 border-neutral-300 focus:ring-neutral-900"
                />
                <span className="text-neutral-700">Bestseller Badge</span>
              </label>
            </div>
          </div>

          {/* Categories Assignment */}
          <div className="rounded-xl bg-white border border-neutral-200/80 p-5 space-y-3 shadow-xs">
            <h3 className="font-semibold text-sm text-neutral-900 pb-3 border-b border-neutral-100">
              Categories
            </h3>
            <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200/60 space-y-2 max-h-48 overflow-y-auto">
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={categoryIds.includes(c.id)}
                    onChange={() => toggleCategory(c.id)}
                    className="w-3.5 h-3.5 rounded text-neutral-900 border-neutral-300 focus:ring-neutral-900"
                  />
                  <span className="text-neutral-700 font-medium">{c.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Format & Specs */}
          <div className="rounded-xl bg-white border border-neutral-200/80 p-5 space-y-4 shadow-xs">
            <h3 className="font-semibold text-sm text-neutral-900 pb-3 border-b border-neutral-100">
              Specifications
            </h3>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 transition-colors"
              >
                <option value="PDF">PDF eBook</option>
                <option value="Audiobook">Audiobook Edition</option>
                <option value="EPUB">EPUB Reader</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">Language</label>
              <input
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">Pages</label>
              <input
                type="number"
                value={pages}
                onChange={(e) => setPages(e.target.value ? Number(e.target.value) : "")}
                className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-mono text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">Audio Duration</label>
              <input
                value={audioDuration}
                onChange={(e) => setAudioDuration(e.target.value)}
                placeholder="e.g. 4h 15m"
                className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 transition-colors"
              />
            </div>

            <div className="pt-2 border-t border-neutral-100">
              <CloudinaryUpload
                value={coverImageUrl}
                onChange={(url) => setCoverImageUrl(url)}
                onRemove={() => setCoverImageUrl("")}
                assetType="book_cover"
                label="eBook Cover Image"
                description="Upload high-res portrait cover directly to Cloudinary CDN"
                aspectRatio="cover"
                entityId={{ publication_id: initialData?.id }}
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
