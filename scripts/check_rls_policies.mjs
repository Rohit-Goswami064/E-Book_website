import pg from "pg"

const connectionString = "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

async function run() {
  const client = new pg.Client({ connectionString })
  await client.connect()

  const tables = ["books", "publication_assets", "orders", "book_entitlements", "reading_progress"]

  for (const t of tables) {
    console.log(`\n=== RLS POLICIES FOR: ${t} ===`)
    const res = await client.query(`
      SELECT policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE tablename = $1
    `, [t])
    console.log(res.rows)
  }

  await client.end()
}

run().catch(console.error)
