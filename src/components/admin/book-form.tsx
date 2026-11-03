"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { slugify } from "@/lib/utils"
import { toast } from "sonner"
import { Loader2, Save, ArrowLeft, Eye, Sparkles } from "lucide-react"
import Link from "next/link"
import { PublicationAssetManager } from "@/components/admin/publication-asset-manager"
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
        toast.success(effectivePublicationId ? "Book updated successfully." : "Book created successfully.")
        if (!effectivePublicationId && data.book?.id) {
          setSavedPublicationId(data.book.id)
          window.history.replaceState(null, "", `/super-admin/books/${data.book.id}/edit`)
          toast.success("Publication ID created. You can now upload Cloudflare R2 assets below!")
        } else {
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
    <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8 max-w-4xl mx-auto overflow-y-auto">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-black/[0.06] pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/super-admin/books"
            className="w-8 h-8 rounded-full border border-black/10 flex items-center justify-center hover:bg-neutral-100 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="font-serif text-2xl font-bold text-neutral-900">
              {isEditing ? `Edit: ${initialData.title}` : "Create New Publication"}
            </h1>
            <p className="text-xs text-neutral-500">
              Configure publication details, pricing, categories, and SEO fields.
            </p>
          </div>
        </div>

        <Button type="submit" disabled={saving} className="rounded-full bg-[#111111] text-xs font-bold px-6 gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{isEditing ? "Update Book" : "Publish Book"}</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Primary Details */}
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-[24px] bg-white border border-black/[0.06] p-6 space-y-4 shadow-sm">
            <h3 className="font-bold text-sm text-neutral-900 pb-2 border-b border-black/[0.04]">
              Basic Information
            </h3>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">
                Book Title *
              </label>
              <Input
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                required
                placeholder="e.g. गोदान (Godaan) or The Mindset"
                className="h-11 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">
                  URL Slug *
                </label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                  placeholder="godaan-edition"
                  className="h-11 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">
                  Author
                </label>
                <select
                  value={authorId}
                  onChange={(e) => setAuthorId(e.target.value)}
                  className="w-full h-11 rounded-full border border-black/10 bg-[#FAFAFA] px-4 text-xs font-medium focus:outline-none"
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
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">
                Subtitle
              </label>
              <Input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="e.g. A Timeless Examination of Indian Agrarian Life"
                className="h-11 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">
                Short Description / Excerpt
              </label>
              <Textarea
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="1-2 sentences summarizing the book for catalogue cards..."
                className="min-h-[70px] text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">
                Full Description
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Complete editorial book overview, key themes, and background..."
                className="min-h-[140px] text-xs"
              />
            </div>
          </div>

          {/* Pricing & Commercial Model */}
          <div className="rounded-[24px] bg-white border border-black/[0.06] p-6 space-y-4 shadow-sm">
            <h3 className="font-bold text-sm text-neutral-900 pb-2 border-b border-black/[0.04]">
              Pricing & Access Entitlement
            </h3>

            <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#FAFAFA] border border-black/5">
              <input
                type="checkbox"
                id="isFree"
                checked={isFree}
                onChange={(e) => setIsFree(e.target.checked)}
                className="w-4 h-4 rounded text-black focus:ring-0 cursor-pointer"
              />
              <label htmlFor="isFree" className="text-xs font-bold text-neutral-800 cursor-pointer">
                100% Free Book (No payment required, instant claim)
              </label>
            </div>

            {!isFree && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">
                    Price (INR ₹) *
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={priceInr}
                    onChange={(e) => setPriceInr(Number(e.target.value))}
                    required
                    className="h-11 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">
                    Original Price (INR ₹)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={originalPriceInr || ""}
                    onChange={(e) => setOriginalPriceInr(e.target.value ? Number(e.target.value) : null)}
                    placeholder="e.g. 299 (shows strike-through)"
                    className="h-11 text-xs font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Cloudflare R2 Protected Digital Assets */}
          <PublicationAssetManager
            publicationId={effectivePublicationId}
            isDraft={!effectivePublicationId}
            onPublicationSaveRequired={() => {
              toast.info("Please fill in the title and click 'Publish Book' (or Save) to create the publication record first.")
            }}
          />

          {/* Table of Contents */}
          <div className="rounded-[24px] bg-white border border-black/[0.06] p-6 space-y-3 shadow-sm">
            <h3 className="font-bold text-sm text-neutral-900 pb-2 border-b border-black/[0.04]">
              Table of Contents (Chapters)
            </h3>
            <p className="text-[11px] text-neutral-500">
              Enter one chapter per line. These will be parsed into the interactive reader index.
            </p>
            <Textarea
              value={tocText}
              onChange={(e) => setTocText(e.target.value)}
              placeholder={"अध्याय 1: शुरुआत\nअध्याय 2: मन की शांति\nअध्याय 3: सफलता के सूत्र"}
              className="min-h-[120px] font-mono text-xs"
            />
          </div>

          {/* SEO Metadata */}
          <div className="rounded-[24px] bg-white border border-black/[0.06] p-6 space-y-4 shadow-sm">
            <h3 className="font-bold text-sm text-neutral-900 pb-2 border-b border-black/[0.04]">
              Search Engine Optimization (SEO)
            </h3>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">
                Custom SEO Title
              </label>
              <Input
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="Leave blank to use default template: [Title] — by [Author]"
                className="h-11 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">
                Meta Description
              </label>
              <Textarea
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                placeholder="Concise 150-160 character summary for Google search snippets..."
                className="min-h-[70px] text-xs"
              />
            </div>

            {/* Live Search Preview */}
            <div className="p-4 rounded-2xl bg-[#FAFAFA] border border-black/5 space-y-1">
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
          <div className="rounded-[24px] bg-white border border-black/[0.06] p-6 space-y-3 shadow-sm">
            <h3 className="font-bold text-sm text-neutral-900 pb-2 border-b border-black/[0.04]">
              Visibility & Badges
            </h3>

            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="rounded text-black"
                />
                <span className="font-bold text-neutral-800">Publicly Published</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="rounded text-black"
                />
                <span className="text-neutral-700">Homepage Featured Showcase</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBestseller}
                  onChange={(e) => setIsBestseller(e.target.checked)}
                  className="rounded text-black"
                />
                <span className="text-neutral-700">Bestseller Badge</span>
              </label>
            </div>
          </div>

          {/* Categories Assignment */}
          <div className="rounded-[24px] bg-white border border-black/[0.06] p-6 space-y-3 shadow-sm">
            <h3 className="font-bold text-sm text-neutral-900 pb-2 border-b border-black/[0.04]">
              Categories
            </h3>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={categoryIds.includes(c.id)}
                    onChange={() => toggleCategory(c.id)}
                    className="rounded text-black"
                  />
                  <span>{c.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Format & Specs */}
          <div className="rounded-[24px] bg-white border border-black/[0.06] p-6 space-y-4 shadow-sm">
            <h3 className="font-bold text-sm text-neutral-900 pb-2 border-b border-black/[0.04]">
              Specifications
            </h3>

            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1">Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full h-10 rounded-full border border-black/10 bg-[#FAFAFA] px-3 text-xs"
              >
                <option value="PDF">PDF eBook</option>
                <option value="Audiobook">Audiobook Edition</option>
                <option value="EPUB">EPUB Reader</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1">Language</label>
              <Input
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="h-10 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1">Pages</label>
              <Input
                type="number"
                value={pages}
                onChange={(e) => setPages(e.target.value ? Number(e.target.value) : "")}
                className="h-10 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1">Audio Duration</label>
              <Input
                value={audioDuration}
                onChange={(e) => setAudioDuration(e.target.value)}
                placeholder="e.g. 4h 15m"
                className="h-10 text-xs"
              />
            </div>

            <div className="pt-2 border-t border-black/[0.04]">
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
