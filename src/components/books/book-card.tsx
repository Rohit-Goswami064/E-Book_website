"use client"

import * as React from "react"
import Link from "next/link"
import { Star, Headphones, BookOpen, Heart, ArrowUpRight } from "lucide-react"
import { formatCurrency, cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

export interface BookCardData {
  id: string
  title: string
  slug: string
  subtitle?: string | null
  authorName?: string | null
  priceCents: number
  originalPriceCents?: number | null
  currency?: string
  isFree: boolean
  format?: string
  rating?: number | null
  reviewCount?: number
  coverImageUrl?: string | null
  audioDuration?: string | null
  categoryName?: string | null
  colorCode?: string | null
}

interface BookCardProps {
  book: BookCardData
  initialWishlisted?: boolean
  className?: string
  featured?: boolean
}

// Background colors from reference palette when book has no image
const PALETTE_COLORS = ["#E8E0D6", "#DDE8E2", "#E2DFEB", "#FDE9D9", "#DBE7FD", "#F5F5F5"]

export function BookCard({
  book,
  initialWishlisted = false,
  className,
  featured = false,
}: BookCardProps) {
  const [isWishlisted, setIsWishlisted] = React.useState(initialWishlisted)
  const [isTogglingWishlist, setIsTogglingWishlist] = React.useState(false)

  // Stable color based on book title length
  const bgColor =
    book.colorCode ||
    PALETTE_COLORS[book.title.charCodeAt(0) % PALETTE_COLORS.length]

  const handleWishlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsTogglingWishlist(true)
    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: book.id }),
      })
      if (res.status === 401) {
        toast.error("Please sign in to save books to your wishlist.")
        return
      }
      const data = await res.json()
      setIsWishlisted(data.inWishlist)
      toast.success(data.message)
    } catch {
      toast.error("Could not update wishlist.")
    } finally {
      setIsTogglingWishlist(false)
    }
  }

  const isAudio = book.format?.toLowerCase().includes("audio") || !!book.audioDuration

  return (
    <div
      className={cn(
        "group relative rounded-[20px] sm:rounded-[24px] bg-white border border-black/[0.06] p-2.5 sm:p-3 flex flex-col transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.06)] hover:border-black/15",
        featured ? "p-3 sm:p-4" : "p-2.5 sm:p-3",
        className
      )}
    >
      {/* Book Cover Area */}
      <Link
        href={`/books/${book.slug}`}
        className="relative block w-full rounded-[14px] sm:rounded-[18px] overflow-hidden transition-transform duration-300 group-hover:scale-[1.01]"
        style={{
          backgroundColor: bgColor,
          aspectRatio: "3 / 4",
        }}
      >
        {book.coverImageUrl ? (
          <img
            src={book.coverImageUrl}
            alt={book.title}
            className="w-full h-full object-cover rounded-[14px] sm:rounded-[18px]"
          />
        ) : (
          /* Editorial Styled Minimalist Spine & Typographic Cover */
          <div className="w-full h-full p-3 sm:p-4 flex flex-col justify-between select-none relative overflow-hidden">
            <div className="flex justify-between items-start z-10">
              <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-black/10 bg-white/60 backdrop-blur-sm flex items-center justify-center text-[8px] sm:text-[9px] font-bold">
                HB
              </span>
              {isAudio ? (
                <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-black text-white text-[9px] sm:text-[10px] font-bold flex items-center gap-1 shadow-sm">
                  <Headphones className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Audio
                </span>
              ) : book.isFree ? (
                <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#1B5E20] border border-[#C8E6C9] text-[9px] sm:text-[10px] font-bold">
                  FREE
                </span>
              ) : (
                <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.14em] font-bold opacity-60">
                  {book.format || "PDF"}
                </span>
              )}
            </div>

            <div className="z-10 my-auto">
              <h3 className="font-serif text-sm sm:text-lg md:text-xl font-bold tracking-tight text-neutral-900 leading-[1.15] line-clamp-2 sm:line-clamp-3">
                {book.title}
              </h3>
              <div className="mt-1.5 sm:mt-2 w-6 sm:w-8 h-[2px] bg-black/20 rounded-full" />
              <p className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs font-medium text-neutral-700 truncate">
                {book.authorName || "HiddenBooks Editorial"}
              </p>
            </div>

            <div className="flex justify-between items-end z-10 text-[8px] sm:text-[9px] uppercase tracking-[0.14em] opacity-60 font-semibold">
              <span>Verified Edition</span>
              {book.audioDuration && <span>{book.audioDuration}</span>}
            </div>

            {/* Subtle decorative background watermarks */}
            <div className="absolute -right-8 -bottom-8 w-24 sm:w-28 h-24 sm:h-28 rounded-full border border-black/10 opacity-40 pointer-events-none" />
          </div>
        )}

        {/* Wishlist Heart Button */}
        <button
          onClick={handleWishlistToggle}
          disabled={isTogglingWishlist}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/90 backdrop-blur-sm border border-black/10 flex items-center justify-center text-neutral-700 hover:text-black transition shadow-sm hover:scale-110 active:scale-95"
        >
          <Heart
            className={cn(
              "w-3.5 h-3.5 sm:w-4 sm:h-4 transition-colors",
              isWishlisted ? "fill-red-500 text-red-500" : "text-neutral-600"
            )}
          />
        </button>
      </Link>

      {/* Book Metadata & Title */}
      <div className="pt-2 sm:pt-3 pb-0.5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-1 text-[10px] sm:text-[11px] text-neutral-500">
            <span className="truncate font-medium">{book.categoryName || "eBook"}</span>
            <div className="flex items-center gap-0.5 sm:gap-1 font-semibold text-neutral-800 shrink-0">
              <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-amber-400 text-amber-400" />
              <span>{book.rating ? Number(book.rating).toFixed(1) : "4.8"}</span>
            </div>
          </div>

          <Link href={`/books/${book.slug}`} className="block mt-1 group-hover:underline">
            <h4 className="font-semibold text-xs sm:text-sm text-neutral-900 leading-snug line-clamp-2">
              {book.title}
            </h4>
          </Link>

          <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5 truncate">
            {book.authorName || "HiddenBooks Publishing"}
          </p>
        </div>

        {/* Price & Action */}
        <div className="pt-2 sm:pt-3 mt-1.5 sm:mt-2 border-t border-black/[0.04] flex items-center justify-between">
          <div className="flex items-baseline gap-1 sm:gap-1.5">
            {book.isFree || book.priceCents === 0 ? (
              <span className="text-[11px] sm:text-xs font-bold text-[#1B5E20] bg-[#E8F5E9] px-1.5 sm:px-2 py-0.5 rounded-full border border-[#C8E6C9]">
                Free
              </span>
            ) : (
              <>
                <span className="text-xs sm:text-sm font-bold text-neutral-900">
                  {formatCurrency(book.priceCents, book.currency)}
                </span>
                {book.originalPriceCents && book.originalPriceCents > book.priceCents && (
                  <span className="text-[10px] sm:text-[11px] line-through text-neutral-400 font-medium">
                    {formatCurrency(book.originalPriceCents, book.currency)}
                  </span>
                )}
              </>
            )}
          </div>

          <Link
            href={`/books/${book.slug}`}
            className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#111111] text-white flex items-center justify-center hover:bg-neutral-800 transition active:scale-95 shrink-0"
            aria-label={`View ${book.title}`}
          >
            <ArrowUpRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}
