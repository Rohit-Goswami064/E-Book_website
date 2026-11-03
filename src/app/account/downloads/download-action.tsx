"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function DownloadAction({
  bookId,
  isDownloadable,
}: {
  bookId: string
  isDownloadable: boolean
}) {
  const [downloading, setDownloading] = React.useState(false)

  const handleDownload = async () => {
    if (!isDownloadable) {
      toast.info("This title is available for in-browser reading only.")
      return
    }

    setDownloading(true)
    try {
      const res = await fetch(`/api/books/${bookId}/download`)
      const data = await res.json()

      if (res.ok && data.downloadUrl) {
        toast.success("Download started securely.")
        window.open(data.downloadUrl, "_blank")
      } else {
        toast.error(data.error || "Failed to generate download link.")
      }
    } catch {
      toast.error("An unexpected error occurred while requesting download.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Button
      onClick={handleDownload}
      disabled={downloading}
      size="sm"
      variant={isDownloadable ? "default" : "secondary"}
      className="rounded-full text-xs font-bold gap-1.5 shrink-0"
    >
      {downloading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Authorizing...</span>
        </>
      ) : (
        <>
          <Download className="w-3.5 h-3.5" />
          <span>{isDownloadable ? "Download PDF" : "Online Only"}</span>
        </>
      )}
    </Button>
  )
}
