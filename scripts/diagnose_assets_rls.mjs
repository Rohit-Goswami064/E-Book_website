import pg from "pg"
const { Client } = pg

const client = new Client({
  connectionString: "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
})

async function run() {
  await client.connect()

  const policies = await client.query(`
    SELECT pol.polname, pol.polcmd, pol.polpermissive,
           pg_get_expr(pol.polqual, pol.polrelid) AS using_expression,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expression
    FROM pg_policy pol
    JOIN pg_class pc ON pol.polrelid = pc.oid
    WHERE pc.relname = 'publication_assets';
  `)
  console.log("=== POLICIES ON publication_assets ===")
  console.log(policies.rows)

  // Columns on publication_assets
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'publication_assets'
    ORDER BY ordinal_position;
  `)
  console.log("=== COLUMNS ON publication_assets ===")
  console.log(cols.rows)

  await client.end()
}

run().catch(console.error)
