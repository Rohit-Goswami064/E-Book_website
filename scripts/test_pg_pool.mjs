import pg from "pg"
const { Pool } = pg

const pool = new Pool({
  connectionString: "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false },
  max: 10,
})

async function test() {
  const t0 = Date.now()
  const res = await pool.query("SELECT count(*) FROM public.orders")
  console.log("Pool query time:", Date.now() - t0, "ms, Orders count:", res.rows[0].count)
  await pool.end()
}
test()
