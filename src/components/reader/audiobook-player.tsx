"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  ListMusic,
  ArrowLeft,
  Headphones,
  Sparkles,
  Loader2,
  CheckCircle2,
  Clock,
  Bookmark,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { toast } from "sonner"

interface Chapter {
  id: string
  chapterNumber: number
  title: string
  duration?: number | null
  streamEndpoint: string
}

interface AudiobookPlayerProps {
  book: {
    id: string
    title: string
    subtitle?: string | null
    author: string
    coverUrl?: string | null
    duration?: string | null
    tableOfContents?: string[]
  }
  initialProgress?: number
  initialChapterIndex?: number
}

function formatTime(seconds: number) {
  if (isNaN(seconds) || seconds < 0) return "00:00"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60

  if (hours > 0) {
    return `${hours}:${remMins < 10 ? "0" : ""}${remMins}:${secs < 10 ? "0" : ""}${secs}`
  }
  return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`
}

export function AudiobookPlayer({
  book,
  initialProgress = 0,
  initialChapterIndex = 0,
}: AudiobookPlayerProps) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const [chapters, setChapters] = React.useState<Chapter[]>([])
  const [currentChapterIdx, setCurrentChapterIdx] = React.useState(initialChapterIndex)
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [currentTime, setCurrentTime] = React.useState(0)
  const [duration, setDuration] = React.useState(0)
  const [playbackSpeed, setPlaybackSpeed] = React.useState(1.0)
  const [volume, setVolume] = React.useState(1)
  const [isMuted, setIsMuted] = React.useState(false)
  const [isLoadingChapters, setIsLoadingChapters] = React.useState(true)
  const [isBuffering, setIsBuffering] = React.useState(false)
  const [showChaptersDrawer, setShowChaptersDrawer] = React.useState(false)

  // 1. Fetch available chapters from API
  React.useEffect(() => {
    async function loadChapters() {
      try {
        setIsLoadingChapters(true)
        const res = await fetch(`/api/books/${book.id}/audio-stream?mode=chapters`)
        const data = await res.json()
        if (res.ok && data.chapters && data.chapters.length > 0) {
          setChapters(data.chapters)
        } else {
          // Fallback single stream
          setChapters([
            {
              id: "primary",
              chapterNumber: 1,
              title: book.title,
              streamEndpoint: `/api/books/${book.id}/audio-stream`,
            },
          ])
        }
      } catch {
        setChapters([
          {
            id: "primary",
            chapterNumber: 1,
            title: book.title,
            streamEndpoint: `/api/books/${book.id}/audio-stream`,
          },
        ])
      } finally {
        setIsLoadingChapters(false)
      }
    }
    loadChapters()
  }, [book.id, book.title])

  const activeChapter = chapters[currentChapterIdx] || chapters[0]

  // 2. Sync audio progress
  const handleTimeUpdate = () => {
    if (!audioRef.current) return
    setCurrentTime(audioRef.current.currentTime)
    if (!isNaN(audioRef.current.duration) && audioRef.current.duration > 0) {
      setDuration(audioRef.current.duration)
    }
  }

  // 3. Play / Pause Toggle
  const togglePlayPause = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.error("Playback error:", err)
          toast.error("Could not start audio playback.")
        })
    }
  }

  // 4. Seek Skip (+30s / -10s)
  const skip = (seconds: number) => {
    if (!audioRef.current) return
    const target = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds))
    audioRef.current.currentTime = target
    setCurrentTime(target)
  }

  // 5. Seek bar scrub
  const handleSeek = (val: number[]) => {
    if (!audioRef.current || !val.length) return
    audioRef.current.currentTime = val[0]
    setCurrentTime(val[0])
  }

  // 6. Playback speed cycling
  const cyclePlaybackSpeed = () => {
    const speeds = [1.0, 1.25, 1.5, 1.75, 2.0, 0.75]
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length
    const nextSpeed = speeds[nextIdx]
    setPlaybackSpeed(nextSpeed)
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed
    }
  }

  // 7. Volume toggle
  const toggleMute = () => {
    if (!audioRef.current) return
    if (isMuted) {
      audioRef.current.muted = false
      setIsMuted(false)
    } else {
      audioRef.current.muted = true
      setIsMuted(true)
    }
  }

  // 8. Progress saving back to server every 15 seconds
  React.useEffect(() => {
    if (!isPlaying || currentTime <= 0 || duration <= 0) return

    const timer = setInterval(() => {
      const percentage = Math.round((currentTime / duration) * 100)
      fetch(`/api/books/${book.id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_page: Math.floor(currentTime),
          total_pages: Math.floor(duration),
          progress_percentage: percentage,
          last_chapter: activeChapter?.title || null,
        }),
      }).catch(() => {})
    }, 15000)

    return () => clearInterval(timer)
  }, [isPlaying, currentTime, duration, book.id, activeChapter])

  return (
    <div className="min-h-screen bg-[#F6F5F2] text-neutral-900 flex flex-col justify-between selection:bg-neutral-900 selection:text-white">
      {/* Hidden Native Audio Element */}
      {activeChapter && (
        <audio
          ref={audioRef}
          src={activeChapter.streamEndpoint}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleTimeUpdate}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => {
            setIsBuffering(false)
            setIsPlaying(true)
          }}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false)
            if (currentChapterIdx < chapters.length - 1) {
              setCurrentChapterIdx((prev) => prev + 1)
              toast.info(`Starting Next: Chapter ${currentChapterIdx + 2}`)
            }
          }}
        />
      )}

      {/* Top Header */}
      <header className="h-16 px-4 sm:px-8 border-b border-black/[0.08] bg-[#FBFBFA]/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
        <Link
          href="/account/library"
          className="flex items-center gap-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>My Library</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-900 text-white text-[11px] font-bold">
            <Headphones className="w-3.5 h-3.5 text-amber-400" />
            <span>Audiobook Edition</span>
          </span>
        </div>

        <button
          onClick={() => setShowChaptersDrawer(!showChaptersDrawer)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/10 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 shadow-xs transition cursor-pointer"
        >
          <ListMusic className="w-4 h-4" />
          <span className="hidden sm:inline">Chapters</span>
          {chapters.length > 1 && (
            <span className="w-4 h-4 rounded-full bg-neutral-200 text-neutral-700 text-[10px] flex items-center justify-center font-bold">
              {chapters.length}
            </span>
          )}
        </button>
      </header>

      {/* Main Player Centerpiece */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8 sm:py-12 flex flex-col items-center justify-center space-y-6 sm:space-y-8">
        {/* Cover Art Artwork */}
        <div className="relative group">
          <div className="w-56 h-72 sm:w-64 sm:h-80 rounded-2xl overflow-hidden shadow-2xl bg-white border border-black/10 relative">
            {book.coverUrl ? (
              <Image
                src={book.coverUrl}
                alt={book.title}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 224px, 256px"
                priority
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-100 p-6 text-center">
                <Headphones className="w-12 h-12 text-neutral-400 mb-3" />
                <span className="text-xs font-bold text-neutral-700">{book.title}</span>
              </div>
            )}
          </div>

          {/* Buffering Indicator */}
          {isBuffering && (
            <div className="absolute inset-0 rounded-2xl bg-black/40 backdrop-blur-xs flex items-center justify-center text-white text-xs font-semibold gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Buffering Audio...</span>
            </div>
          )}
        </div>

        {/* Title & Author Info */}
        <div className="text-center space-y-1 max-w-md">
          <h1 className="font-serif text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight line-clamp-2">
            {book.title}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 font-medium">
            By <span className="text-neutral-900 font-semibold">{book.author}</span>
          </p>
          {activeChapter && chapters.length > 1 && (
            <div className="pt-1">
              <span className="inline-block text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                Chapter {activeChapter.chapterNumber}: {activeChapter.title}
              </span>
            </div>
          )}
        </div>

        {/* Timeline Slider & Time Labels */}
        <div className="w-full space-y-2 pt-2">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={1}
            onValueChange={handleSeek}
            className="cursor-pointer"
          />

          <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 font-medium">
            <span>{formatTime(currentTime)}</span>
            <span>{duration > 0 ? formatTime(duration) : book.duration || "--:--"}</span>
          </div>
        </div>

        {/* Playback Controls (Play/Pause, Skips, Speed, Volume) */}
        <div className="w-full flex items-center justify-between pt-2">
          {/* Speed Button */}
          <button
            onClick={cyclePlaybackSpeed}
            className="px-2.5 py-1.5 rounded-lg border border-black/10 bg-white text-xs font-bold text-neutral-700 hover:bg-neutral-50 shadow-2xs transition font-mono min-w-[50px] cursor-pointer"
            title="Adjust Playback Speed"
          >
            {playbackSpeed}x
          </button>

          {/* Center Playback Buttons */}
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Rewind 10s */}
            <button
              onClick={() => skip(-10)}
              className="p-2.5 rounded-full text-neutral-700 hover:text-neutral-950 hover:bg-neutral-200/60 transition cursor-pointer relative"
              title="Rewind 10 Seconds"
            >
              <RotateCcw className="w-5 h-5" />
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold pt-0.5">
                10
              </span>
            </button>

            {/* Play / Pause Primary Button */}
            <button
              onClick={togglePlayPause}
              disabled={isLoadingChapters}
              className="w-14 h-14 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 fill-white" />
              ) : (
                <Play className="w-6 h-6 fill-white ml-0.5" />
              )}
            </button>

            {/* Fast Forward 30s */}
            <button
              onClick={() => skip(30)}
              className="p-2.5 rounded-full text-neutral-700 hover:text-neutral-950 hover:bg-neutral-200/60 transition cursor-pointer relative"
              title="Fast Forward 30 Seconds"
            >
              <RotateCw className="w-5 h-5" />
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold pt-0.5">
                30
              </span>
            </button>
          </div>

          {/* Volume / Mute Toggle */}
          <button
            onClick={toggleMute}
            className="p-2.5 rounded-lg border border-black/10 bg-white text-neutral-700 hover:bg-neutral-50 shadow-2xs transition cursor-pointer"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </main>

      {/* Chapters Drawer / Modal */}
      {showChaptersDrawer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white rounded-t-[28px] sm:rounded-2xl border border-black/10 p-5 sm:p-6 shadow-2xl space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-neutral-700" />
                <h3 className="font-bold text-sm text-neutral-900">Chapters & Audio Tracks</h3>
              </div>
              <button
                onClick={() => setShowChaptersDrawer(false)}
                className="text-xs font-semibold text-neutral-400 hover:text-neutral-800"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {chapters.map((ch, idx) => {
                const isActive = idx === currentChapterIdx
                return (
                  <button
                    key={ch.id}
                    onClick={() => {
                      setCurrentChapterIdx(idx)
                      setShowChaptersDrawer(false)
                      setIsPlaying(true)
                      setTimeout(() => {
                        if (audioRef.current) audioRef.current.play()
                      }, 100)
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                      isActive
                        ? "bg-neutral-900 text-white border-neutral-900"
                        : "bg-neutral-50 hover:bg-neutral-100 border-neutral-200/70 text-neutral-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-bold font-mono ${
                          isActive ? "text-neutral-400" : "text-neutral-400"
                        }`}
                      >
                        {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                      </span>
                      <span className="text-xs font-semibold truncate max-w-[240px]">
                        {ch.title}
                      </span>
                    </div>

                    {isActive && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
                        Playing
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <footer className="py-4 border-t border-black/[0.06] text-center text-[11px] text-neutral-500">
        <span>HiddenBooks Secure DRM Streaming • Personal Reading License</span>
      </footer>
    </div>
  )
}

