import { createAdminClient } from "../src/lib/supabase/admin.ts"
import { checkBookEntitlement } from "../src/lib/auth/roles.ts"
import { createPresignedDownloadUrl } from "../src/lib/storage/r2.ts"

async function run() {
  const userId = "1bbc668f-2f43-4aa9-902c-2c3815b42bdc"
  const bookId = "8c0456eb-4456-4a01-acc3-c66127b08267"

  console.log("Checking entitlement for user:", userId, "book:", bookId)
  const isEntitled = await checkBookEntitlement(userId, bookId)
  console.log("isEntitled:", isEntitled)

  const admin = createAdminClient()
  const { data: book } = await admin
    .from("books")
    .select("id, title, subtitle, slug, format, pages, language, table_of_contents, authors(name)")
    .eq("id", bookId)
    .maybeSingle()
  console.log("Book:", book)

  const { data: assets, error: assetErr } = await admin
    .from("publication_assets")
    .select("object_key, original_filename, is_downloadable, storage_provider")
    .eq("publication_id", bookId)
    .eq("upload_status", "completed")
    .in("asset_type", ["pdf", "epub"])
    .order("created_at", { ascending: false })
    .limit(1)

  console.log("Assets query result:", assets, "error:", assetErr)

  if (assets && assets[0]) {
    const url = await createPresignedDownloadUrl({
      objectKey: assets[0].object_key,
      expiresInSeconds: 7200,
      filename: assets[0].original_filename,
      inline: true,
    })
    console.log("Signed URL generated:", url)
  }
}

run().catch(console.error)
