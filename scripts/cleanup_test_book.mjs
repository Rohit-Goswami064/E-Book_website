import pg from "pg"
const { Client } = pg

const client = new Client({
  connectionString: "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
})

async function cleanup() {
  await client.connect()
  const res = await client.query("DELETE FROM public.books WHERE slug = 'r2-verification-test'")
  console.log(`Cleaned up temporary test book (${res.rowCount} row deleted).`)
  await client.end()
}

cleanup().catch(console.error)
