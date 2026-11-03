import Link from "next/link"
import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
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
    <div className="min-h-screen flex flex-col bg-[#F6F5F2]">
      <Header
        user={{ id: user.id, email: user.email, name: user.user_metadata?.full_name }}
        isAdmin={isAdmin}
      />

      <main className="flex-1 max-w-[880px] w-full mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-6">
        <nav className="flex items-center gap-2 text-xs text-neutral-500 mb-2">
          <Link href="/account" className="hover:text-black">Account</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-neutral-900 font-semibold">Authorized Downloads</span>
        </nav>

        <div className="border-b border-black/[0.06] pb-4">
          <h1 className="font-serif text-3xl font-bold text-neutral-900">
            Digital Downloads
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Offline PDF editions for books entitled to your personal library account.
          </p>
        </div>

        {/* Content Protection Advisory */}
        <div className="rounded-[20px] bg-white border border-black/[0.06] p-4 text-xs text-neutral-600 flex items-start gap-3 shadow-sm">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-neutral-900 block">Personal Reading License</span>
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
                className="rounded-[20px] bg-white border border-black/[0.06] p-4 sm:p-5 shadow-sm flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-[#FAFAFA] border border-black/5 flex items-center justify-center text-neutral-800 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-sm text-neutral-900">{book.title}</h2>
                    <p className="text-xs text-neutral-500">
                      {book.authors?.name || "HiddenBooks Edition"} • {book.format || "PDF"}
                    </p>
                  </div>
                </div>

                <DownloadAction bookId={book.id} isDownloadable={!!file} />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[28px] bg-white border border-black/10 p-12 text-center max-w-md mx-auto">
            <Download className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <h3 className="font-serif text-xl font-bold text-neutral-800">
              No Downloadable Books Yet
            </h3>
            <p className="text-xs text-neutral-500 mt-2">
              Titles you purchase or claim that permit offline downloads will be accessible here.
            </p>
            <Link href="/books" className="inline-block mt-4">
              <Button size="sm" className="rounded-full bg-[#111111]">
                Browse Books
              </Button>
            </Link>
          </div>
        )}
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  )
}
