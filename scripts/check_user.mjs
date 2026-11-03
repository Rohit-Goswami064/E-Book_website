import pg from "pg"
const { Client } = pg

const client = new Client({
  connectionString: "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
})

async function check() {
  await client.connect()
  const uid = "4a21b6af-c6e6-4bb0-bc0a-a2bf2f8b5f94"
  const roles = await client.query("SELECT * FROM public.user_roles WHERE user_id = $1", [uid])
  console.log("Current user_roles:", roles.rows)
  const profiles = await client.query("SELECT * FROM public.profiles WHERE id = $1", [uid])
  console.log("Current profile:", profiles.rows)
  await client.end()
}

check().catch(console.error)
