import { notFound } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
import { BookForm } from "@/components/admin/book-form"

interface EditBookPageProps {
  params: Promise<{ id: string }>
}

export const dynamic = "force-dynamic"

export default async function EditBookPage({ params }: EditBookPageProps) {
  const { id } = await params
  const admin = createAdminClient()

  // Fetch book
  const { data: book } = await admin
    .from("books")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (!book) {
    notFound()
  }

  // Fetch authors
  const { data: authors } = await admin
    .from("authors")
    .select("id, name")
    .order("name", { ascending: true })

  // Fetch categories
  const { data: categories } = await admin
    .from("categories")
    .select("id, name")
    .order("display_order", { ascending: true })

  // Fetch selected category IDs
  const { data: bookCategories } = await admin
    .from("book_categories")
    .select("category_id")
    .eq("book_id", id)

  const selectedCategoryIds = ((bookCategories as any[]) || []).map((bc) => bc.category_id)

  return (
    <BookForm
      initialData={book as any}
      authors={(authors as any[]) || []}
      categories={(categories as any[]) || []}
      selectedCategoryIds={selectedCategoryIds}
    />
  )
}
