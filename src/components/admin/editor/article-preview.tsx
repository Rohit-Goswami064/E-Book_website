"use client"

import * as React from "react"
import { Clock, Calendar, User, Eye, Smartphone, Monitor, Maximize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"

interface ArticlePreviewProps {
  title: string
  content: string
  excerpt?: string
  featuredImage?: string
  customCss?: string
  authorName?: string
  authorAvatar?: string
  publishedAt?: string
  readingTimeMinutes?: number
}

type DeviceMode = "standard" | "wide" | "mobile"

export function ArticlePreview({
  title,
  content,
  excerpt,
  featuredImage,
  customCss,
  authorName = "Editorial Staff",
  authorAvatar,
  publishedAt,
  readingTimeMinutes = 5,
}: ArticlePreviewProps) {
  const [deviceMode, setDeviceMode] = React.useState<DeviceMode>("standard")

  // Sanitize and scope CSS: replace root or body with #editorial-preview-root
  const scopedCss = React.useMemo(() => {
    if (!customCss?.trim()) return ""
    return `
      #editorial-preview-root {
        ${customCss}
      }
    `
  }, [customCss])

  const containerWidthClass = {
    standard: "max-w-[720px]",
    wide: "max-w-[880px]",
    mobile: "max-w-[390px] shadow-xl border-neutral-300 rounded-[32px] overflow-hidden my-4",
  }[deviceMode]

  return (
    <div className="border border-neutral-200 rounded-xl bg-[#F6F5F2] overflow-hidden shadow-xs flex flex-col min-h-[600px]">
      {/* Top Preview Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-neutral-200 bg-white text-xs select-none">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-neutral-100 text-neutral-800 gap-1.5 font-sans">
            <Eye className="h-3.5 w-3.5 text-neutral-600" />
            Live HiddenBooks Reader View
          </Badge>
          <span className="text-neutral-400">•</span>
          <span className="text-neutral-500 font-mono text-[11px]">
            {deviceMode === "mobile" ? "Mobile Viewport (390px)" : deviceMode === "wide" ? "Editorial Wide (880px)" : "Standard Reading (720px)"}
          </span>
        </div>

        {/* Viewport switch */}
        <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-lg border border-neutral-200">
          <Button
            type="button"
            variant={deviceMode === "standard" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setDeviceMode("standard")}
            className="h-6 px-2 text-[11px] gap-1"
          >
            <Monitor className="h-3 w-3" /> Standard
          </Button>
          <Button
            type="button"
            variant={deviceMode === "wide" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setDeviceMode("wide")}
            className="h-6 px-2 text-[11px] gap-1"
          >
            <Maximize2 className="h-3 w-3" /> Wide
          </Button>
          <Button
            type="button"
            variant={deviceMode === "mobile" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setDeviceMode("mobile")}
            className="h-6 px-2 text-[11px] gap-1"
          >
            <Smartphone className="h-3 w-3" /> Mobile
          </Button>
        </div>
      </div>

      {/* Injected Scoped CSS */}
      {scopedCss && (
        <style dangerouslySetInnerHTML={{ __html: scopedCss }} />
      )}

      {/* Reader Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center bg-[#F6F5F2]">
        <div
          id="editorial-preview-root"
          className={`w-full transition-all duration-200 ${containerWidthClass} bg-[#F6F5F2]`}
        >
          <article className="space-y-7">
            {/* Metadata Byline */}
            <header className="space-y-4">
              <div className="flex items-center gap-3 text-xs text-neutral-500 font-medium">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {readingTimeMinutes} min read
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> {formatDate(publishedAt || new Date().toISOString())}
                </span>
              </div>

              {/* Title */}
              <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#111111] leading-[1.15]">
                {title || <span className="text-neutral-400 italic">Untitled Article</span>}
              </h1>

              {/* Excerpt */}
              {excerpt ? (
                <p className="font-serif text-base sm:text-lg text-neutral-600 leading-relaxed italic border-l-2 border-black/20 pl-4 py-1">
                  {excerpt}
                </p>
              ) : null}

              {/* Author Byline */}
              <div className="flex items-center gap-3 pt-3 border-t border-black/[0.06]">
                <div className="w-9 h-9 rounded-full bg-[#111111] text-white flex items-center justify-center font-serif font-bold text-xs shrink-0 overflow-hidden">
                  {authorAvatar ? (
                    <img src={authorAvatar} alt={authorName} className="w-full h-full object-cover" />
                  ) : (
                    authorName.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <p className="font-bold text-xs sm:text-sm text-neutral-900 leading-snug">
                    {authorName}
                  </p>
                  <p className="text-[11px] text-neutral-500">Author & Editorial Contributor</p>
                </div>
              </div>
            </header>

            {/* Featured Cover Image */}
            {featuredImage && (
              <div className="w-full rounded-[24px] overflow-hidden bg-[#E8E0D6] shadow-sm">
                <img
                  src={featuredImage}
                  alt={title}
                  className="w-full h-auto object-cover max-h-[460px]"
                />
              </div>
            )}

            {/* Main Article Content */}
            <div className="rounded-[24px] bg-white border border-black/[0.06] p-6 sm:p-10 shadow-sm text-neutral-800 leading-[1.8] text-base sm:text-lg">
              {content ? (
                <div
                  className="editorial-article-body prose prose-neutral max-w-none space-y-5"
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              ) : (
                <div className="py-12 text-center text-neutral-400 font-serif italic text-sm">
                  Start drafting article content to see live formatted rendering here...
                </div>
              )}
            </div>
          </article>
        </div>
      </div>
    </div>
  )
}
