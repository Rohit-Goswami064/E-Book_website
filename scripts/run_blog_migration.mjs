import fs from "fs"
import path from "path"
import pg from "pg"

const connectionString = "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

async function run() {
  const sqlPath = path.resolve("supabase/migrations/20261028000005_blog_editor_enhancements.sql")
  const sql = fs.readFileSync(sqlPath, "utf-8")
  
  const client = new pg.Client({ connectionString })
  await client.connect()
  console.log("Connected to PostgreSQL. Running blog_posts migration...")
  await client.query(sql)
  console.log("Migration executed successfully!")
  
  const check = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'blog_posts' ORDER BY ordinal_position;")
  console.log("Columns now in blog_posts:", check.rows.map(r => `${r.column_name} (${r.data_type})`))
  await client.end()
}

run().catch(err => {
  console.error("Migration failed:", err)
  process.exit(1)
})
