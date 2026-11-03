import pg from "pg"
const { Pool } = pg

const pool = new Pool({
  connectionString: "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
})

async function run() {
  const client = await pool.connect()
  try {
    const userId = "1bbc668f-2f43-4aa9-902c-2c3815b42bdc"
    const bookId = "8c0456eb-4456-4a01-acc3-c66127b08267"

    await client.query("BEGIN")
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claims" = '{"sub": "${userId}", "role": "authenticated"}';`)

    console.log("=== SIMULATING SUPABASE RLS QUERY AS USER ===")
    const res = await client.query(`
      SELECT id, object_key, original_filename, is_downloadable, storage_provider, asset_type
      FROM public.publication_assets
      WHERE publication_id = $1 AND upload_status = 'completed';
    `, [bookId])

    console.log("Assets returned under RLS:", res.rows)

    console.log("\n=== SIMULATING AS ANON (WHAT createAdminClient WAS DOING) ===")
    await client.query(`SET LOCAL ROLE anon;`)
    await client.query(`SET LOCAL "request.jwt.claims" = '{"role": "anon"}';`)
    const anonRes = await client.query(`
      SELECT id, object_key, original_filename
      FROM public.publication_assets
      WHERE publication_id = $1 AND upload_status = 'completed';
    `, [bookId])
    console.log("Assets returned under anon:", anonRes.rows)

    await client.query("ROLLBACK")
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(console.error)
