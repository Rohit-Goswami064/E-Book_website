import Link from "next/link"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/roles"
import { Download, ChevronRight, FileText, ShieldAlert } from "lucide-react"
import { DownloadAction } from "./download-action"

export const dynamic = "force-dynamic"

export default async function DownloadsPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login?redirect=/account/downloads")
  }

  const isAdmin = await isCurrentUserAdmin()
  const supabase = await createClient()

  // Fetch entitled books with their files
  const { data: entitlements } = await supabase
    .from("book_entitlements")
    .select(
      `
      id, granted_at,
      books (
        id, title, slug, format,
        authors (name),
        book_files (id, file_type, file_size_bytes, is_downloadable)
      )
    `
    )
    .eq("user_id", user.id)
    .eq("is_revoked", false)

  const items = (entitlements || [])
    .map((e: any) => ({
      entitlementId: e.id,
      grantedAt: e.granted_at,
      book: e.books,
      file: (e.books?.book_files as any[])?.find((f) => f.file_type === "pdf" && f.is_downloadable),
    }))
    .filter((item) => item.book)

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="border-b border-neutral-200/80 pb-3.5">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
          Digital Downloads
        </h1>
        <p className="text-xs text-neutral-500 mt-0.5">
          Offline PDF editions for books entitled to your personal library account.
        </p>
      </div>

      {/* Content Protection Advisory */}
      <div className="rounded-xl bg-white border border-neutral-200/80 p-3.5 sm:p-4 text-xs text-neutral-600 flex items-start gap-3 shadow-2xs">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold text-neutral-900 block text-xs">Personal Reading License</span>
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            Downloaded PDF files are intended strictly for your personal offline reading. While digital files can be viewed offline on your e-readers and devices, redistribution or public sharing is prohibited.
          </p>
        </div>
      </div>

      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map(({ book, file }) => (
            <div
              key={book.id}
              className="rounded-xl bg-white border border-neutral-200/80 p-3.5 sm:p-4 shadow-2xs flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-neutral-100 border border-neutral-200/60 flex items-center justify-center text-neutral-800 shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-bold text-xs sm:text-sm text-neutral-900">{book.title}</h2>
                  <p className="text-[11px] text-neutral-500">
                    {book.authors?.name || "HiddenBooks Edition"} • {book.format || "PDF"}
                  </p>
                </div>
              </div>

              <DownloadAction bookId={book.id} isDownloadable={!!file} />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-neutral-200/80 p-10 text-center max-w-md mx-auto shadow-2xs">
          <Download className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-neutral-800">
            No Downloadable Books Yet
          </h3>
          <p className="text-xs text-neutral-500 mt-1">
            Titles you purchase or claim that permit offline downloads will be accessible here.
          </p>
          <Link href="/books" className="inline-block mt-4">
            <Button size="sm" className="rounded-lg text-xs font-semibold h-8 px-3.5 bg-neutral-900 text-white hover:bg-neutral-800">
              Browse Bookstore
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
