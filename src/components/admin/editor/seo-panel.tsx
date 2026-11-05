"use client"

import * as React from "react"
import Image from "next/image"
import {
  Globe,
  Share2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Search,
  Sparkles,
  ExternalLink,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface SeoPanelProps {
  articleTitle: string
  articleExcerpt: string
  articleContent: string
  slug: string
  featuredImage?: string
  seoTitle: string
  setSeoTitle: (val: string) => void
  seoDescription: string
  setSeoDescription: (val: string) => void
  canonicalUrl: string
  setCanonicalUrl: (val: string) => void
  ogImageUrl: string
  setOgImageUrl: (val: string) => void
  focusKeyword: string
  setFocusKeyword: (val: string) => void
}

export function SeoPanel({
  articleTitle,
  articleExcerpt,
  articleContent,
  slug,
  featuredImage,
  seoTitle,
  setSeoTitle,
  seoDescription,
  setSeoDescription,
  canonicalUrl,
  setCanonicalUrl,
  ogImageUrl,
  setOgImageUrl,
  focusKeyword,
  setFocusKeyword,
}: SeoPanelProps) {
  const [previewTab, setPreviewTab] = React.useState<"google" | "social">("google")

  // Fallback defaults
  const effectiveTitle = seoTitle?.trim() || articleTitle?.trim() || "Article Headline — HiddenBooks Editorial"
  const cleanTitle = effectiveTitle.replace(/\*\*/g, "").replace(/#/g, "").trim()
  const effectiveDescription =
    seoDescription?.trim() ||
    articleExcerpt?.trim() ||
    "Read in-depth literary essays, book summaries, and intellectual guides from HiddenBooks editors."
  const cleanDescription = effectiveDescription.replace(/\*\*/g, "").replace(/#/g, "").trim()
  const effectiveSlug = slug?.trim() || "article-slug"
  const effectiveSocialImage = ogImageUrl?.trim() || featuredImage?.trim() || ""

  // Title length analysis (Google truncates around 60 chars)
  const titleLen = cleanTitle.length
  const titleScore = titleLen >= 40 && titleLen <= 60 ? "optimal" : titleLen < 40 ? "short" : "long"

  // Description length analysis (Google shows ~155-160 chars)
  const descLen = cleanDescription.length
  const descScore = descLen >= 120 && descLen <= 160 ? "optimal" : descLen < 120 ? "short" : "long"

  // Keyword analysis
  const keywordAnalysis = React.useMemo(() => {
    if (!focusKeyword.trim()) return null
    const kw = focusKeyword.trim().toLowerCase()
    const inTitle = cleanTitle.toLowerCase().includes(kw)
    const inSlug = effectiveSlug.toLowerCase().includes(kw.replace(/\s+/g, "-"))
    const inDesc = cleanDescription.toLowerCase().includes(kw)
    const inBody = (articleContent || "").toLowerCase().includes(kw)

    return {
      inTitle,
      inSlug,
      inDesc,
      inBody,
      score: [inTitle, inSlug, inDesc, inBody].filter(Boolean).length,
    }
  }, [focusKeyword, cleanTitle, effectiveSlug, cleanDescription, articleContent])

  return (
    <div className="space-y-5">
      {/* Search & Social Preview Tabs */}
      <div className="border border-neutral-200 rounded-xl bg-white p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-neutral-600" /> Live Search & Social Snippet
          </span>
          <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-lg border border-neutral-200">
            <button
              type="button"
              onClick={() => setPreviewTab("google")}
              className={cn(
                "px-2 py-0.5 text-[11px] rounded font-medium transition-colors",
                previewTab === "google" ? "bg-white text-neutral-900 shadow-xs" : "text-neutral-500 hover:text-neutral-900"
              )}
            >
              Google SERP
            </button>
            <button
              type="button"
              onClick={() => setPreviewTab("social")}
              className={cn(
                "px-2 py-0.5 text-[11px] rounded font-medium transition-colors",
                previewTab === "social" ? "bg-white text-neutral-900 shadow-xs" : "text-neutral-500 hover:text-neutral-900"
              )}
            >
              Open Graph Card
            </button>
          </div>
        </div>

        {previewTab === "google" ? (
          /* Google SERP Snippet Box */
          <div className="p-4 bg-white rounded-lg border border-neutral-200/90 font-sans shadow-xs space-y-1.5">
            <div className="text-[12px] text-[#202124] flex items-center gap-1.5 font-sans">
              <div className="w-5 h-5 rounded-full overflow-hidden relative bg-white border border-neutral-200 shrink-0">
                <Image
                  src="/hiddenbook_logo.png"
                  alt="HiddenBooks"
                  width={20}
                  height={20}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-medium leading-none text-neutral-800">HiddenBooks Publishing</span>
                <span className="text-[11px] text-neutral-500 leading-none mt-0.5">
                  https://hiddenbooks.com/blog/{effectiveSlug}
                </span>
              </div>
            </div>
            <h4 className="text-[#1a0dab] hover:underline cursor-pointer text-base font-normal leading-snug line-clamp-1 pt-0.5">
              {cleanTitle}
            </h4>
            <p className="text-[13px] text-[#4d5156] line-clamp-2 leading-relaxed">
              {cleanDescription}
            </p>
          </div>
        ) : (
          /* Open Graph Social Card */
          <div className="rounded-xl border border-neutral-200 overflow-hidden bg-white shadow-xs font-sans">
            {effectiveSocialImage ? (
              <div className="w-full h-36 bg-neutral-100 overflow-hidden">
                <img
                  src={effectiveSocialImage}
                  alt={cleanTitle}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-full h-24 bg-neutral-100 flex items-center justify-center text-xs text-neutral-400 font-mono">
                No Social Card Image Specified
              </div>
            )}
            <div className="p-3 bg-neutral-50 border-t border-neutral-200/80 space-y-1">
              <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-mono">
                hiddenbooks.com
              </span>
              <p className="text-xs font-bold text-neutral-900 line-clamp-1 leading-snug">
                {cleanTitle}
              </p>
              <p className="text-[11px] text-neutral-600 line-clamp-2 leading-tight">
                {cleanDescription}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Focus Keyword & On-Page SEO Checklist */}
      <div className="border border-neutral-200 rounded-xl bg-white p-4 shadow-xs space-y-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
            Focus Keyword / Topic
          </label>
          <Input
            value={focusKeyword}
            onChange={(e) => setFocusKeyword(e.target.value)}
            placeholder="e.g. deep reading habit"
            className="h-8 text-xs font-mono"
          />
        </div>

        {keywordAnalysis && (
          <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200/80 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-800">Keyword Placement Check</span>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px]",
                  keywordAnalysis.score >= 3
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                    : "bg-amber-50 text-amber-800 border-amber-300"
                )}
              >
                {keywordAnalysis.score}/4 placements
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <span className={cn("flex items-center gap-1", keywordAnalysis.inTitle ? "text-emerald-700" : "text-neutral-400")}>
                {keywordAnalysis.inTitle ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <AlertCircle className="h-3 w-3" />}
                In SEO Title
              </span>
              <span className={cn("flex items-center gap-1", keywordAnalysis.inSlug ? "text-emerald-700" : "text-neutral-400")}>
                {keywordAnalysis.inSlug ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <AlertCircle className="h-3 w-3" />}
                In URL Slug
              </span>
              <span className={cn("flex items-center gap-1", keywordAnalysis.inDesc ? "text-emerald-700" : "text-neutral-400")}>
                {keywordAnalysis.inDesc ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <AlertCircle className="h-3 w-3" />}
                In Meta Description
              </span>
              <span className={cn("flex items-center gap-1", keywordAnalysis.inBody ? "text-emerald-700" : "text-neutral-400")}>
                {keywordAnalysis.inBody ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <AlertCircle className="h-3 w-3" />}
                In Article Content
              </span>
            </div>
          </div>
        )}
      </div>

      {/* SEO Title Field */}
      <div className="border border-neutral-200 rounded-xl bg-white p-4 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider">
            Custom SEO Title
          </label>
          <span
            className={cn(
              "text-[11px] font-mono",
              titleScore === "optimal"
                ? "text-emerald-600 font-semibold"
                : titleScore === "long"
                ? "text-amber-600"
                : "text-neutral-400"
            )}
          >
            {titleLen}/60 chars ({titleScore})
          </span>
        </div>
        <Input
          value={seoTitle}
          onChange={(e) => setSeoTitle(e.target.value)}
          placeholder={articleTitle || "Leave blank to use Article Headline"}
          className="text-xs"
        />
        <p className="text-[11px] text-neutral-500">
          Optimal length is between 40 and 60 characters for maximum search engine click-through rate.
        </p>
      </div>

      {/* Meta Description Field */}
      <div className="border border-neutral-200 rounded-xl bg-white p-4 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider">
            Meta Description
          </label>
          <span
            className={cn(
              "text-[11px] font-mono",
              descScore === "optimal"
                ? "text-emerald-600 font-semibold"
                : descScore === "long"
                ? "text-amber-600"
                : "text-neutral-400"
            )}
          >
            {descLen}/160 chars ({descScore})
          </span>
        </div>
        <Textarea
          value={seoDescription}
          onChange={(e) => setSeoDescription(e.target.value)}
          placeholder={articleExcerpt || "1-2 sentence lead summarizing article value..."}
          rows={3}
          className="text-xs"
        />
        <p className="text-[11px] text-neutral-500">
          Search engines present up to 160 characters in Google results.
        </p>
      </div>

      {/* Canonical URL & Social Sharing Image */}
      <div className="border border-neutral-200 rounded-xl bg-white p-4 shadow-xs space-y-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
            Canonical URL (Optional)
          </label>
          <Input
            value={canonicalUrl}
            onChange={(e) => setCanonicalUrl(e.target.value)}
            placeholder="https://hiddenbooks.com/blog/the-original-essay"
            className="h-8 text-xs font-mono"
          />
          <p className="text-[10px] text-neutral-500 mt-1">
            Use when republishing an article originally published on another literary journal or medium.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
            Social Share Image URL (Open Graph)
          </label>
          <Input
            value={ogImageUrl}
            onChange={(e) => setOgImageUrl(e.target.value)}
            placeholder={featuredImage || "Defaults to featured cover image"}
            className="h-8 text-xs font-mono"
          />
        </div>
      </div>
    </div>
  )
}
