import pg from "pg"

const connectionString = "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

async function run() {
  const client = new pg.Client({ connectionString })
  await client.connect()
  const tables = ['blog_posts', 'blog_categories', 'blog_tags', 'blog_post_categories', 'blog_post_tags', 'authors']
  for (const table of tables) {
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1 
      ORDER BY ordinal_position;
    `, [table]);
    console.log(`\nTable ${table}:`);
    console.log(cols.rows.map(c => `${c.column_name} (${c.data_type})`));
  }
  
  // Also check existing blog posts data
  const existing = await client.query("SELECT id, title, slug, cover_image_url, status FROM public.blog_posts LIMIT 5;")
  console.log("\nExisting Blog Posts:", existing.rows)
  await client.end()
}

run().catch(console.error)
