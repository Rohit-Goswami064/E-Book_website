import pg from "pg"
const { Pool } = pg

const pool = new Pool({
  connectionString: "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
})

async function run() {
  const client = await pool.connect()
  try {
    const bookId = "8c0456eb-4456-4a01-acc3-c66127b08267"
    console.log("=== CHECKING publication_assets in DB ===")
    const res = await client.query(`
      SELECT id, publication_id, asset_type, upload_status, object_key, original_filename
      FROM public.publication_assets
      WHERE publication_id = $1;
    `, [bookId])
    console.log("publication_assets rows:", res.rows)

    console.log("\n=== CHECKING book_files in DB ===")
    const bfRes = await client.query(`
      SELECT * FROM public.book_files WHERE book_id = $1;
    `, [bookId])
    console.log("book_files rows:", bfRes.rows)

    console.log("\n=== CHECKING publication_assets POLICIES ===")
    const pRes = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE tablename = 'publication_assets';
    `)
    console.log(JSON.stringify(pRes.rows, null, 2))

  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(console.error)
