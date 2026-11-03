import pg from "pg"
import fs from "fs"
import path from "path"

const { Client } = pg

const client = new Client({
  host: "aws-0-ap-southeast-1.pooler.supabase.com",
  port: 5432,
  database: "postgres",
  user: "postgres.atmzsbbrycxtducxrelo",
  password: "Roshan$$8993",
  ssl: { rejectUnauthorized: false },
})

async function run() {
  await client.connect()
  console.log("Connected to Supabase PostgreSQL.")

  const migrationFiles = [
    "supabase/migrations/20261027000000_init_hiddenbooks_schema.sql",
    "supabase/migrations/20261027000001_storage_setup.sql",
    "supabase/migrations/20261028000000_cloudflare_r2_assets.sql",
    "supabase/migrations/20261028000001_books_rls_policies.sql",
    "supabase/migrations/20261028000002_publication_assets_rls.sql",
    "supabase/migrations/20261028000003_checkout_and_orders_rls.sql",
    "supabase/seed.sql",
  ]

  for (const relPath of migrationFiles) {
    const fullPath = path.resolve(process.cwd(), relPath)
    if (!fs.existsSync(fullPath)) {
      console.log(`Skipping missing file: ${relPath}`)
      continue
    }

    console.log(`\n========================================`)
    console.log(`Applying: ${relPath}`)
    console.log(`========================================`)

    const sql = fs.readFileSync(fullPath, "utf8")
    try {
      await client.query(sql)
      console.log(`Successfully applied ${relPath}!`)
    } catch (err) {
      console.error(`Error in ${relPath}:`, err.message)
    }
  }

  // Verify created tables
  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `)
  console.log(`\nPublic tables in database (${res.rows.length}):`)
  console.log(res.rows.map(r => r.table_name).join(", "))

  await client.end()
}

run()
