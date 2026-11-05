"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  Bookmark as BookmarkIcon,
  Sun,
  Moon,
  Coffee,
  List,
  ArrowLeft,
  Maximize2,
  Minimize2,
  HelpCircle,
  ZoomIn,
  ZoomOut,
  Expand,
  FileQuestion,
  Volume2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Loader2,
} from "lucide-react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const PdfCanvasReader = dynamic(
  () => import("./pdf-canvas-reader").then((mod) => mod.PdfCanvasReader),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-800" />
        <p className="text-xs font-serif text-neutral-600 animate-pulse">
          Loading reader...
        </p>
      </div>
    ),
  }
)

interface ReaderProps {
  book: {
    id: string
    title: string
    subtitle?: string | null
    slug: string
    author: string
    pages: number
    format: string
    isFree?: boolean
    tableOfContents: any[]
  }
  pdfStreamUrl: string | null
  isDownloadable: boolean
  initialPage: number
  initialProgress: number
  initialBookmarks: any[]
}

type ReaderTheme = "sepia" | "light" | "dark"
type FitMode = "custom" | "width" | "page"

export function EBookReader({
  book,
  pdfStreamUrl,
  isDownloadable,
  initialPage = 1,
  initialProgress = 0,
  initialBookmarks = [],
}: ReaderProps) {
  const router = useRouter()
  const [currentPage, setCurrentPage] = React.useState(initialPage)
  const [totalPages, setTotalPages] = React.useState(book.pages || 1)
  const [theme, setTheme] = React.useState<ReaderTheme>("sepia")
  const [scale, setScale] = React.useState<number>(1.15)
  const [fitMode, setFitMode] = React.useState<FitMode>("width")
  const [bookmarks, setBookmarks] = React.useState(initialBookmarks)
  const [isTocOpen, setIsTocOpen] = React.useState(false)
  const [isBookmarksOpen, setIsBookmarksOpen] = React.useState(false)
  const [isAddBookmarkOpen, setIsAddBookmarkOpen] = React.useState(false)
  const [bookmarkNote, setBookmarkNote] = React.useState("")
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const [isProtectionNoticeOpen, setIsProtectionNoticeOpen] = React.useState(false)
  const [pageInputVal, setPageInputVal] = React.useState(String(initialPage))

  // Audiobook player state (for audio publications)
  const isAudiobook = book.format?.toLowerCase().includes("audio")
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [audioSpeed, setAudioSpeed] = React.useState("1x")
  const [audioProgress, setAudioProgress] = React.useState(25)

  // Keep page input in sync
  React.useEffect(() => {
    setPageInputVal(String(currentPage))
  }, [currentPage])

  // Auto-save progress debounced (every 1.5s after page turn)
  React.useEffect(() => {
    if (totalPages < 1) return
    const timer = setTimeout(async () => {
      const percentage = Math.min(100, Math.max(0, Math.round((currentPage / totalPages) * 100)))
      try {
        await fetch(`/api/books/${book.id}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            current_page: currentPage,
            total_pages: totalPages,
            progress_percentage: percentage,
          }),
        })
      } catch (err) {
        console.error("Failed to sync progress:", err)
      }
    }, 1500)
    return () => clearTimeout(timer)
  }, [currentPage, totalPages, book.id])

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        nextPage()
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        prevPage()
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen()
      } else if (e.key === "+" || e.key === "=") {
        handleZoomIn()
      } else if (e.key === "-") {
        handleZoomOut()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentPage, totalPages, scale])

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((p) => p + 1)
    }
  }

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((p) => p - 1)
    }
  }

  const handleJumpToPage = (e: React.FormEvent) => {
    e.preventDefault()
    const target = parseInt(pageInputVal, 10)
    if (!isNaN(target) && target >= 1 && target <= totalPages) {
      setCurrentPage(target)
    } else {
      setPageInputVal(String(currentPage))
    }
  }

  const handleZoomIn = () => {
    setFitMode("custom")
    setScale((prev) => Math.min(2.5, Math.round((prev + 0.15) * 100) / 100))
  }

  const handleZoomOut = () => {
    setFitMode("custom")
    setScale((prev) => Math.max(0.6, Math.round((prev - 0.15) * 100) / 100))
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
        setIsFullscreen(false)
      }
    }
  }

  const handleAddBookmark = async () => {
    try {
      const res = await fetch(`/api/books/${book.id}/bookmarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_number: currentPage,
          note: bookmarkNote.trim() || `Bookmark on Page ${currentPage}`,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setBookmarks((prev) => [...prev, data])
        setIsAddBookmarkOpen(false)
        setBookmarkNote("")
        toast.success(`Bookmarked page ${currentPage}`)
      } else {
        toast.error(data.error || "Failed to add bookmark")
      }
    } catch {
      toast.error("Error saving bookmark")
    }
  }

  const themeClasses = {
    sepia: "bg-[#F6F5F2] text-[#111111]",
    light: "bg-[#F0F0F0] text-[#111111]",
    dark: "bg-[#141414] text-[#E0E0E0]",
  }[theme]

  return (
    <div className={cn("min-h-screen flex flex-col transition-colors duration-200 select-none", themeClasses)}>
      {/* ========================================================================= */}
      {/* TOP READER TOOLBAR                                                        */}
      {/* ========================================================================= */}
      <header
        className={cn(
          "h-14 px-3 sm:px-6 flex items-center justify-between border-b backdrop-blur-md sticky top-0 z-40 transition-colors shadow-2xs",
          theme === "dark"
            ? "bg-[#181818]/95 border-white/10 text-white"
            : "bg-white/95 border-black/10 text-black"
        )}
      >
        {/* Left: Back & Title */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <Link
            href="/account/library"
            className="w-8 h-8 rounded-full border border-black/10 flex items-center justify-center hover:opacity-75 transition shrink-0"
            title="Back to My Library"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-bold text-xs sm:text-sm line-clamp-1 max-w-[180px] sm:max-w-xs md:max-w-md">
              {book.title}
            </h1>
            <p className="text-[10px] text-neutral-500 line-clamp-1">{book.author}</p>
          </div>
        </div>

        {/* Center: Interactive Page Jump & Progress */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <form onSubmit={handleJumpToPage} className="flex items-center">
            <input
              type="text"
              value={pageInputVal}
              onChange={(e) => setPageInputVal(e.target.value)}
              onBlur={handleJumpToPage}
              className={cn(
                "w-10 h-6 text-center text-xs font-mono font-bold rounded border px-1 outline-none transition-colors",
                theme === "dark"
                  ? "bg-neutral-800 border-neutral-700 text-white focus:border-white"
                  : "bg-neutral-50 border-neutral-300 text-neutral-900 focus:border-black"
              )}
              title="Type page number and press Enter to jump"
            />
          </form>
          <span className="opacity-40">/</span>
          <span className="font-semibold">{totalPages}</span>
          <span className="text-[10px] text-neutral-500 font-sans hidden md:inline ml-1">
            ({totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0}%)
          </span>
        </div>

        {/* Right: Controls (Zoom, Fit, TOC, Theme, Bookmarks, Fullscreen) */}
        <div className="flex items-center gap-0.5 sm:gap-1.5">
          {/* Zoom Out */}
          <Button
            variant="ghost"
            size="iconSm"
            onClick={handleZoomOut}
            className="h-8 w-8 text-neutral-600 hover:text-neutral-900"
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>

          {/* Current Zoom & Fit to Width */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFitMode(fitMode === "width" ? "page" : "width")}
            className="h-7 px-2 text-[11px] font-mono font-medium hidden sm:inline-flex"
            title={fitMode === "width" ? "Switch to Fit Page" : "Switch to Fit Width"}
          >
            {fitMode === "width" ? "Fit Width" : fitMode === "page" ? "Fit Page" : `${Math.round(scale * 100)}%`}
          </Button>

          {/* Zoom In */}
          <Button
            variant="ghost"
            size="iconSm"
            onClick={handleZoomIn}
            className="h-8 w-8 text-neutral-600 hover:text-neutral-900"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>

          <div className="h-4 w-px bg-neutral-300 mx-0.5 hidden sm:block" />

          {/* Table of Contents Sheet */}
          <Sheet open={isTocOpen} onOpenChange={setIsTocOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="iconSm" aria-label="Table of contents" title="Index / Outline">
                <List className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-6 rounded-r-[28px]">
              <SheetHeader>
                <SheetTitle className="font-serif text-lg font-bold">Chapters & Index</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-2 max-h-[75vh] overflow-y-auto pr-1">
                {book.tableOfContents && book.tableOfContents.length > 0 ? (
                  book.tableOfContents.map((chap: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => {
                        if (chap.page) setCurrentPage(Number(chap.page))
                        setIsTocOpen(false)
                      }}
                      className="w-full text-left p-3 rounded-xl hover:bg-neutral-100 transition text-xs font-medium flex items-center justify-between"
                    >
                      <span className="truncate">{chap.title || chap}</span>
                      {chap.page && <span className="font-mono text-[10px] text-neutral-400">p.{chap.page}</span>}
                    </button>
                  ))
                ) : (
                  <div className="text-xs text-neutral-500 p-4 text-center">
                    Original document pages 1 to {totalPages}. Use the page navigator to move between sections.
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>

          {/* Bookmarks Sheet */}
          <Sheet open={isBookmarksOpen} onOpenChange={setIsBookmarksOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="iconSm" aria-label="View bookmarks" title="My Bookmarks">
                <BookmarkIcon className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 p-6 rounded-l-[28px]">
              <SheetHeader>
                <SheetTitle className="font-serif text-lg font-bold">My Bookmarks</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-2 max-h-[70vh] overflow-y-auto">
                {bookmarks.length > 0 ? (
                  bookmarks.map((b: any) => (
                    <div
                      key={b.id}
                      onClick={() => {
                        setCurrentPage(b.page_number)
                        setIsBookmarksOpen(false)
                      }}
                      className="p-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 cursor-pointer transition border border-black/5"
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span>Page {b.page_number}</span>
                      </div>
                      {b.note && <p className="text-[11px] text-neutral-600 mt-1">{b.note}</p>}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-neutral-500 text-center py-6">
                    No bookmarks saved yet. Click the bookmark button below to mark key pages.
                  </p>
                )}
              </div>
              <div className="pt-4 mt-auto">
                <Button
                  onClick={() => {
                    setIsBookmarksOpen(false)
                    setIsAddBookmarkOpen(true)
                  }}
                  className="w-full rounded-full text-xs font-bold"
                >
                  Bookmark Current Page {currentPage}
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          {/* Theme Selector */}
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => {
              if (theme === "sepia") setTheme("light")
              else if (theme === "light") setTheme("dark")
              else setTheme("sepia")
            }}
            aria-label="Change reader background"
            title="Reading Background"
          >
            {theme === "sepia" && <Coffee className="w-4 h-4" />}
            {theme === "light" && <Sun className="w-4 h-4" />}
            {theme === "dark" && <Moon className="w-4 h-4" />}
          </Button>

          {/* Fullscreen */}
          <Button
            variant="ghost"
            size="iconSm"
            onClick={toggleFullscreen}
            className="hidden sm:inline-flex"
            aria-label="Toggle Fullscreen"
            title="Fullscreen (F)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>

          {/* Protection Advisory Modal */}
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => setIsProtectionNoticeOpen(true)}
            aria-label="Content advisory"
            title="Digital Rights"
          >
            <HelpCircle className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MAIN READING CANVAS (ACTUAL UPLOADED PDF VIA PDF.JS CANVAS)                */}
      {/* ========================================================================= */}
      <main className="flex-1 max-w-[1200px] w-full mx-auto px-2 sm:px-6 py-4 sm:py-8 flex flex-col justify-start items-center">
        {pdfStreamUrl ? (
          <PdfCanvasReader
            streamUrl={pdfStreamUrl}
            bookTitle={book.title}
            currentPage={currentPage}
            scale={scale}
            fitMode={fitMode}
            theme={theme}
            onPageChange={setCurrentPage}
            onTotalPagesDetected={(detectedTotal) => setTotalPages(detectedTotal)}
          />
        ) : (
          /* Missing Asset Graceful Notice (NEVER renders fake dummy chapter text) */
          <div className="w-full max-w-lg mx-auto my-auto p-8 rounded-3xl bg-white border border-neutral-200 shadow-sm text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-neutral-500">
              <FileQuestion className="w-7 h-7" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold text-neutral-900">Document Processing</h2>
              <p className="text-xs text-neutral-600 mt-2 leading-relaxed">
                The original digital edition for <strong className="text-neutral-900">&quot;{book.title}&quot;</strong> is currently being prepared in private secure storage.
              </p>
            </div>
            <div className="pt-2">
              <Button
                size="sm"
                onClick={() => window.location.reload()}
                className="rounded-full text-xs font-bold"
              >
                Refresh Document
              </Button>
            </div>
          </div>
        )}

        {/* Audiobook player UI if audio edition is available */}
        {isAudiobook && (
          <div className="w-full max-w-[720px] mt-6 rounded-[24px] bg-[#111111] text-white p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">
                  Audio Edition Playing
                </span>
                <div className="font-bold text-sm mt-0.5">{book.title}</div>
              </div>
              <span className="text-xs text-neutral-400 font-mono">Chapter {currentPage}</span>
            </div>

            <div className="space-y-1">
              <div className="h-1.5 bg-white/20 rounded-full relative overflow-hidden">
                <div className="h-full bg-white rounded-full" style={{ width: `${audioProgress}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
                <span>12:40</span>
                <span>-24:18</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setAudioSpeed((s) => (s === "1x" ? "1.25x" : s === "1.25x" ? "1.5x" : "1x"))}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center justify-center transition"
              >
                {audioSpeed}
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAudioProgress((p) => Math.max(0, p - 5))}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                  aria-label="Skip back 15 seconds"
                >
                  <SkipBack className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition shadow-lg"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-black" /> : <Play className="w-5 h-5 fill-black ml-0.5" />}
                </button>

                <button
                  onClick={() => setAudioProgress((p) => Math.min(100, p + 5))}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                  aria-label="Skip forward 15 seconds"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>

              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                <Volume2 className="w-4 h-4" />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* BOTTOM READER FOOTER CONTROLS                                             */}
      {/* ========================================================================= */}
      <footer
        className={cn(
          "h-16 px-4 sm:px-8 border-t backdrop-blur-md sticky bottom-0 z-40 flex items-center justify-between transition-colors shadow-xs",
          theme === "dark"
            ? "bg-[#181818]/95 border-white/10"
            : "bg-white/95 border-black/10"
        )}
      >
        <Button
          onClick={prevPage}
          disabled={currentPage <= 1}
          variant="outline"
          size="sm"
          className="rounded-full text-xs font-bold gap-1 bg-white border-neutral-300"
          title="Previous Page (Left Arrow)"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Previous</span>
        </Button>

        {/* Page Scrubber Slider */}
        <div className="flex items-center gap-3 w-48 sm:w-80 md:w-96">
          <Slider
            value={[currentPage]}
            min={1}
            max={Math.max(1, totalPages)}
            step={1}
            onValueChange={([val]) => setCurrentPage(val)}
            className="flex-1"
          />
          <span className="text-[11px] font-mono text-neutral-500 whitespace-nowrap hidden sm:inline">
            Page {currentPage} of {totalPages}
          </span>
        </div>

        <Button
          onClick={nextPage}
          disabled={currentPage >= totalPages}
          variant="default"
          size="sm"
          className="rounded-full text-xs font-bold gap-1 bg-[#111111] hover:bg-black text-white"
          title="Next Page (Right Arrow)"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </footer>

      {/* Add Bookmark Modal */}
      <Dialog open={isAddBookmarkOpen} onOpenChange={setIsAddBookmarkOpen}>
        <DialogContent className="max-w-sm rounded-[24px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Bookmark Page {currentPage}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              value={bookmarkNote}
              onChange={(e) => setBookmarkNote(e.target.value)}
              placeholder="Add a private reading note (optional)..."
              className="text-xs h-10"
            />
            <Button onClick={handleAddBookmark} className="w-full rounded-full text-xs font-bold">
              Save Bookmark
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Protection Advisory Modal */}
      <Dialog open={isProtectionNoticeOpen} onOpenChange={setIsProtectionNoticeOpen}>
        <DialogContent className="max-w-md rounded-[28px] p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg font-bold">Content Rights & Protection</DialogTitle>
          </DialogHeader>
          <div className="text-xs text-neutral-600 leading-relaxed space-y-3 pt-2">
            <p>
              This digital publication is licensed to your personal reader account on HiddenBooks.
            </p>
            <p>
              <strong>Notice regarding copy protection:</strong> While HiddenBooks implements authorized server streams and access verification, please note that browser-based content cannot physically prevent screen captures, photographs, or hardware-level recording.
            </p>
            <p className="text-[11px] text-neutral-400">
              We trust our readers to honor the authors&apos; creative labor and intellectual property.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
