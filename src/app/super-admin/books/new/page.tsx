import { createAdminClient } from "@/lib/supabase/admin"
import { BookForm } from "@/components/admin/book-form"

export const dynamic = "force-dynamic"

export default async function NewBookPage() {
  const admin = createAdminClient()

  const { data: authors } = await admin
    .from("authors")
    .select("id, name")
    .order("name", { ascending: true })

  const { data: categories } = await admin
    .from("categories")
    .select("id, name")
    .order("display_order", { ascending: true })

  return (
    <BookForm
      authors={authors || []}
      categories={categories || []}
    />
  )
}
