"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Star, Send, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface ReviewFormProps {
  bookId: string
  isAuthenticated: boolean
}

export function ReviewForm({ bookId, isAuthenticated }: ReviewFormProps) {
  const router = useRouter()
  const [rating, setRating] = React.useState(5)
  const [hoverRating, setHoverRating] = React.useState<number | null>(null)
  const [title, setTitle] = React.useState("")
  const [reviewText, setReviewText] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAuthenticated) {
      toast.info("Please sign in to share your reader review.")
      const returnUrl = typeof window !== "undefined" ? window.location.pathname : `/books/${bookId}`
      window.location.href = `/login?redirect=${encodeURIComponent(returnUrl)}`
      return
    }

    if (!reviewText.trim()) {
      toast.error("Please provide review text.")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/books/${bookId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          title: title.trim() || null,
          review_text: reviewText.trim(),
        }),
      })

      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "Thank you! Your review has been recorded.")
        setTitle("")
        setReviewText("")
        router.refresh()
      } else {
        toast.error(data.error || "Failed to submit review.")
      }
    } catch {
      toast.error("An error occurred. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[20px] sm:rounded-[24px] bg-white border border-black/[0.06] p-4 sm:p-6 space-y-4 shadow-sm">
      <h3 className="font-serif text-base sm:text-lg font-bold text-neutral-900">
        Share Your Reader Review
      </h3>

      {/* Star Selector */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-semibold text-neutral-500 mr-1 sm:mr-2">Your Rating:</span>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              type="button"
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(null)}
              className="p-1 text-neutral-300 hover:scale-110 transition-transform active:scale-95"
            >
              <Star
                className={cn(
                  "w-5 h-5 transition-colors",
                  (hoverRating !== null ? hoverRating >= star : rating >= star)
                    ? "fill-amber-400 text-amber-400"
                    : "text-neutral-300"
                )}
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Review headline (optional, e.g. Profound and practical)"
          className="h-11 text-sm sm:text-xs bg-[#FAFAFA] rounded-xl"
        />
      </div>

      <div>
        <Textarea
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          placeholder="What resonated with you in this edition? Share your insights with fellow readers..."
          className="min-h-[100px] text-sm sm:text-xs bg-[#FAFAFA] rounded-xl"
          required
        />
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        size="sm"
        className="w-full sm:w-auto rounded-full bg-[#111111] font-bold text-xs sm:text-sm h-11 px-6 shadow-sm"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Publish Review
          </>
        )}
      </Button>
    </form>
  )
}
