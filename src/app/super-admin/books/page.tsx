import Link from "next/link"
import { createAdminClient } from "@/lib/supabase/admin"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Edit3, Eye, Search, BookOpen } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function AdminBooksListPage() {
  const admin = createAdminClient()

  // Fetch all books with authors
  const { data: books } = await admin
    .from("books")
    .select("id, title, slug, price_cents, is_free, is_published, is_featured, is_bestseller, format, sales_count, view_count, created_at, authors(name)")
    .order("created_at", { ascending: false })

  return (
    <div className="p-4 md:p-6 h-full flex flex-col space-y-3 overflow-hidden">
      {/* Compact Header (20% space budget pattern) */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 leading-tight">
            Book Catalogue
          </h1>
          <p className="text-xs text-neutral-500">
            {books?.length || 0} publications registered in database
          </p>
        </div>

        <Link href="/super-admin/books/new">
          <button className="h-9 px-4 rounded-lg bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition flex items-center gap-1.5 shadow-xs">
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Book</span>
          </button>
        </Link>
      </div>

      {/* Main Table Area (80% space budget pattern) */}
      <div className="rounded-xl border border-neutral-200/80 bg-white flex-1 overflow-auto shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Title & Author</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Format</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Performance</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {books && (books as any[]).length > 0 ? (
              (books as any[]).map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <div className="font-bold text-xs text-neutral-900 leading-snug line-clamp-1">
                      {b.title}
                    </div>
                    <div className="text-[11px] text-neutral-500 line-clamp-1">
                      {(b.authors as any)?.name || "Unassigned"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {b.is_free ? (
                      <span className="text-[10px] font-bold text-[#1B5E20] bg-[#E8F5E9] px-2 py-0.5 rounded-md border border-[#C8E6C9]">
                        Free
                      </span>
                    ) : (
                      <span className="font-bold text-xs">
                        {formatCurrency(b.price_cents)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-medium text-neutral-600">{b.format}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {b.is_published ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-neutral-300" />
                      )}
                      <span className="text-xs font-medium">
                        {b.is_published ? "Published" : "Draft"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-neutral-700">
                      <strong>{b.sales_count || 0}</strong> sales
                    </div>
                    <div className="text-[10px] text-neutral-400">
                      {b.view_count || 0} views
                    </div>
                  </TableCell>
                  <TableCell className="text-neutral-500 text-[11px]">
                    {formatDate(b.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        href={`/books/${b.slug}`}
                        target="_blank"
                        className="p-1.5 rounded-lg border border-black/10 hover:bg-neutral-100 text-neutral-600"
                        title="View Live"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Link>
                      <Link
                        href={`/super-admin/books/${b.id}/edit`}
                        className="p-1.5 rounded-lg border border-black/10 hover:bg-neutral-100 text-neutral-900 font-bold"
                        title="Edit Book"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-neutral-500">
                  <BookOpen className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                  <p className="text-xs">No books in database. Click &quot;Add New Book&quot; to create your first title.</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
