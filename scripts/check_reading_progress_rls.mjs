import pg from "pg"
const { Pool } = pg

const connectionString = "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
})

async function check() {
  const client = await pool.connect()
  try {
    console.log("=== CHECKING reading_progress POLICIES ===")
    const res = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE tablename = 'reading_progress';
    `)
    console.log(JSON.stringify(res.rows, null, 2))

    console.log("\n=== CHECKING reading_progress CONSTRAINTS ===")
    const cRes = await client.query(`
      SELECT conname, contype, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'reading_progress';
    `)
    console.log(JSON.stringify(cRes.rows, null, 2))

    console.log("\n=== CHECKING EXISTING reading_progress ROWS ===")
    const rRes = await client.query(`
      SELECT * FROM public.reading_progress LIMIT 5;
    `)
    console.log(JSON.stringify(rRes.rows, null, 2))

  } finally {
    client.release()
    await pool.end()
  }
}

check().catch(console.error)
