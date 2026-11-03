import pg from "pg"

const connectionString = "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

async function run() {
  const client = new pg.Client({ connectionString })
  await client.connect()
  const cats = await client.query("SELECT * FROM public.blog_categories")
  const tags = await client.query("SELECT * FROM public.blog_tags")
  const authors = await client.query("SELECT id, name, slug FROM public.authors")
  console.log("Categories:", cats.rows)
  console.log("Tags:", tags.rows)
  console.log("Authors:", authors.rows)
  await client.end()
}

run().catch(console.error)
