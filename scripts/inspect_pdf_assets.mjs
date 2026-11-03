import pg from "pg"

const connectionString = "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

async function run() {
  const client = new pg.Client({ connectionString })
  await client.connect()

  console.log("=== 1. ALL BOOKS ===")
  const books = await client.query("SELECT id, title, slug, format, price_cents, is_published FROM public.books ORDER BY created_at DESC")
  console.log(books.rows)

  console.log("\n=== 2. ALL PUBLICATION_ASSETS ===")
  const assets = await client.query("SELECT id, publication_id, asset_type, storage_provider, bucket_name, object_key, original_filename, mime_type, file_size, upload_status, is_downloadable FROM public.publication_assets ORDER BY created_at DESC")
  console.log(assets.rows)

  console.log("\n=== 3. ALL BOOK_FILES ===")
  const bookFiles = await client.query("SELECT id, book_id, file_type, storage_path, mime_type FROM public.book_files")
  console.log(bookFiles.rows)

  console.log("\n=== 4. ALL BOOK ENTITLEMENTS ===")
  const entitlements = await client.query("SELECT id, user_id, book_id, entitlement_type, is_revoked FROM public.book_entitlements")
  console.log(entitlements.rows)

  console.log("\n=== 5. ALL ORDERS & ORDER ITEMS ===")
  const orders = await client.query("SELECT id, order_number, user_id, status, total_cents FROM public.orders ORDER BY created_at DESC LIMIT 10")
  console.log("Orders:", orders.rows)
  const items = await client.query("SELECT id, order_id, book_id, book_title, price_cents FROM public.order_items ORDER BY created_at DESC LIMIT 10")
  console.log("Order items:", items.rows)

  await client.end()
}

run().catch(console.error)
