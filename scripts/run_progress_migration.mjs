import fs from "fs"
import path from "path"
import pg from "pg"

const connectionString = "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

async function run() {
  const sqlPath = path.resolve("supabase/migrations/20261028000007_fix_reading_progress_and_bookmarks_rls.sql")
  const sql = fs.readFileSync(sqlPath, "utf-8")
  
  const client = new pg.Client({ connectionString })
  await client.connect()
  console.log("Connected to PostgreSQL. Running reading_progress RLS migration...")
  await client.query(sql)
  console.log("Migration executed successfully!")
  await client.end()
}

run().catch(err => {
  console.error("Migration failed:", err)
  process.exit(1)
})
