"use client"

import * as React from "react"
import { Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PdfCanvasReaderProps {
  streamUrl: string
  bookTitle: string
  currentPage: number
  scale: number
  fitMode: "custom" | "width" | "page"
  theme: "sepia" | "light" | "dark"
  onPageChange: (page: number) => void
  onTotalPagesDetected: (total: number) => void
  onError?: (error: string) => void
}

// Shared DRM salt matching server-side XOR key derivation
const DRM_SALT = "HB_DRM_V2_2026_XOR_SALT"

export function PdfCanvasReader({
  streamUrl,
  bookTitle,
  currentPage,
  scale,
  fitMode,
  theme,
  onPageChange,
  onTotalPagesDetected,
  onError,
}: PdfCanvasReaderProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const renderTaskRef = React.useRef<any>(null)

  const [pdfDoc, setPdfDoc] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [pageRendering, setPageRendering] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [computedScale, setComputedScale] = React.useState<number>(scale)

  // 1. UI Hardening: Intercept and block shortcut keys (Ctrl/Cmd + S, P, U, C)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.ctrlKey || e.metaKey
      if (isModifier) {
        const key = e.key.toLowerCase()
        if (key === "s" || key === "p" || key === "u" || key === "c") {
          e.preventDefault()
          e.stopPropagation()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true })
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true })
    }
  }, [])

  // 2. Fetch, de-obfuscate strictly in-memory, and load PDF Document via pdfjs-dist
  React.useEffect(() => {
    let isCancelled = false

    async function loadPdf() {
      try {
        setLoading(true)
        setErrorMessage(null)

        // Step A: Request the obfuscated binary stream with required reader headers
        const res = await fetch(streamUrl, {
          method: "GET",
          headers: {
            "X-Reader-Request": "1",
          },
          credentials: "include",
          cache: "no-store",
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || `Failed to fetch stream (HTTP ${res.status})`)
        }

        // Step B: Extract dynamic session XOR key from response header
        const keyHex = res.headers.get("x-stream-key")
        if (!keyHex) {
          throw new Error("DRM handshake failed: Missing dynamic stream decryption key.")
        }

        // Parse keyHex to Uint8Array
        const hexMatches = keyHex.match(/.{1,2}/g)
        if (!hexMatches || hexMatches.length !== 16) {
          throw new Error("DRM handshake failed: Invalid decryption key format.")
        }
        const dynamicBytes = new Uint8Array(hexMatches.map((byte) => parseInt(byte, 16)))

        // Derive effective 16-byte XOR key using shared salt
        const salt = new TextEncoder().encode(DRM_SALT)
        const xorKey = new Uint8Array(16)
        for (let i = 0; i < 16; i++) {
          xorKey[i] = dynamicBytes[i] ^ (salt[i % salt.length] || 0x5a)
        }

        // Step C: Read raw obfuscated ArrayBuffer
        const rawArrayBuffer = await res.arrayBuffer()
        const obfuscatedBytes = new Uint8Array(rawArrayBuffer)

        // Step D: High-speed in-memory de-obfuscation (never written to disk or DOM)
        const decryptedData = new Uint8Array(obfuscatedBytes.length)
        for (let i = 0; i < obfuscatedBytes.length; i++) {
          decryptedData[i] = obfuscatedBytes[i] ^ xorKey[i % 16]
        }

        // Step E: Verify PDF magic bytes ('%PDF-' = 0x25, 0x50, 0x44, 0x46, 0x2D)
        if (
          decryptedData.length < 5 ||
          decryptedData[0] !== 0x25 ||
          decryptedData[1] !== 0x50 ||
          decryptedData[2] !== 0x44 ||
          decryptedData[3] !== 0x46 ||
          decryptedData[4] !== 0x2d
        ) {
          throw new Error("DRM verification failed: Decrypted document integrity check failed.")
        }

        if (isCancelled) return

        // Step F: Dynamic import of pdfjs-dist on client
        const pdfjsLib = await import("pdfjs-dist/build/pdf.mjs")

        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
        }

        // Feed decrypted Uint8Array directly into pdfjs.getDocument ({ data: decryptedData })
        // The raw PDF is never exposed to the Network tab or DOM
        const loadingTask = pdfjsLib.getDocument({
          data: decryptedData,
          cMapUrl: "https://unpkg.com/pdfjs-dist@4.10.38/cmaps/",
          cMapPacked: true,
        })

        const doc = await loadingTask.promise
        if (isCancelled) return

        setPdfDoc(doc)
        onTotalPagesDetected(doc.numPages)
        setLoading(false)
      } catch (err: any) {
        if (isCancelled) return
        console.error("[PDF.js In-Memory Stream Error]:", err)
        const msg = err?.message || "Failed to load protected PDF document from secure stream."
        setErrorMessage(msg)
        setLoading(false)
        if (onError) onError(msg)
      }
    }

    loadPdf()

    return () => {
      isCancelled = true
    }
  }, [streamUrl])

  // 3. Render target page to Canvas whenever doc, currentPage, scale, or fitMode changes
  React.useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return

    let isCancelled = false

    async function renderPage() {
      try {
        setPageRendering(true)

        // Cancel any active render task safely
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel()
          } catch {
            // Task cancellation safe ignore
          }
        }

        const targetPageNum = Math.max(1, Math.min(currentPage, pdfDoc.numPages))
        const page = await pdfDoc.getPage(targetPageNum)
        if (isCancelled) return

        const canvas = canvasRef.current!
        const container = containerRef.current!
        const context = canvas.getContext("2d", { alpha: false })!

        // Compute effective scale based on fitMode
        const unscaledViewport = page.getViewport({ scale: 1.0 })
        let finalScale = scale

        if (fitMode === "width") {
          const containerWidth = container.clientWidth - 48
          if (containerWidth > 0) {
            finalScale = containerWidth / unscaledViewport.width
          }
        } else if (fitMode === "page") {
          const containerWidth = container.clientWidth - 48
          const containerHeight = (window.innerHeight || 800) - 180
          if (containerWidth > 0 && containerHeight > 0) {
            const scaleX = containerWidth / unscaledViewport.width
            const scaleY = containerHeight / unscaledViewport.height
            finalScale = Math.min(scaleX, scaleY)
          }
        }

        setComputedScale(finalScale)

        // High-DPI support for crisp vector glyphs
        const pixelRatio = window.devicePixelRatio || 1
        const viewport = page.getViewport({ scale: finalScale })

        canvas.width = Math.floor(viewport.width * pixelRatio)
        canvas.height = Math.floor(viewport.height * pixelRatio)

        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`

        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

        // Render page onto canvas
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          intent: "display",
        }

        const task = page.render(renderContext)
        renderTaskRef.current = task

        await task.promise
        if (!isCancelled) {
          setPageRendering(false)
        }
      } catch (err: any) {
        if (err?.name === "RenderingCancelledException") {
          return // Normal cancellation when flipping quickly
        }
        if (!isCancelled) {
          console.error("[PDF.js Page Render Error]:", err)
          setPageRendering(false)
        }
      }
    }

    renderPage()

    return () => {
      isCancelled = true
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel()
        } catch {
          // ignore
        }
      }
    }
  }, [pdfDoc, currentPage, scale, fitMode])

  // Handle window resize for fit-to-width/page
  React.useEffect(() => {
    if (fitMode === "custom") return
    const handleResize = () => {
      setComputedScale((s) => s + 0.0001)
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [fitMode])

  if (errorMessage) {
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[500px]">
        <div className="max-w-md w-full bg-white rounded-2xl p-6 border border-red-200 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-neutral-900">Protected Document Unavailable</h3>
            <p className="text-xs text-neutral-600 mt-1">{errorMessage}</p>
          </div>
          <Button
            size="sm"
            onClick={() => window.location.reload()}
            className="rounded-full text-xs font-bold gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Reading
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-full flex-1 flex flex-col items-center justify-start min-h-[600px] overflow-x-auto py-2 relative select-none"
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Loading overlay when initializing and de-obfuscating PDF */}
      {loading && (
        <div className="flex flex-col items-center justify-center min-h-[500px] space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-800" />
          <p className="text-xs font-serif text-neutral-600 animate-pulse">
            Decrypting and loading protected publication...
          </p>
        </div>
      )}

      {/* Page rendering indicator */}
      {pageRendering && !loading && (
        <div className="absolute top-4 right-4 z-20 bg-neutral-900/80 backdrop-blur-xs text-white text-[11px] font-mono px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm select-none">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Rendering page {currentPage}...</span>
        </div>
      )}

      {/* Hardened Canvas Wrapper with Selection & Pointer Shields */}
      <div
        className={`transition-opacity duration-200 ${
          loading ? "opacity-0" : "opacity-100"
        } rounded-xl shadow-md overflow-hidden border border-black/10 bg-white relative select-none`}
        style={{ userSelect: "none", WebkitUserSelect: "none" }}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      >
        <canvas
          ref={canvasRef}
          className="block mx-auto select-none pointer-events-auto"
          style={{ userSelect: "none", WebkitUserSelect: "none" }}
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
          aria-label={`${bookTitle} - Page ${currentPage}`}
        />

        {/* Transparent DRM overlay shield preventing context clicks and image scrapers */}
        <div
          className="absolute inset-0 z-10 bg-transparent select-none pointer-events-none"
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
        />
      </div>
    </div>
  )
}
