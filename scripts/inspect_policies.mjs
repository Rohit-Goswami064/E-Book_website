import pg from "pg"
const { Client } = pg

const client = new Client({
  connectionString: "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
})

async function run() {
  await client.connect()
  const res = await client.query(`
    SELECT polname, polcmd 
    FROM pg_policy 
    JOIN pg_class ON pg_policy.polrelid = pg_class.oid 
    WHERE pg_class.relname = 'user_roles';
  `)
  console.log("Policies on user_roles:", res.rows)
  await client.end()
}

run().catch(console.error)
