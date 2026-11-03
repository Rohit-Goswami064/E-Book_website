import pg from "pg"
const { Client } = pg

const client = new Client({
  connectionString: "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
})

async function main() {
  await client.connect()
  const roles = await client.query(`
    SELECT ur.*, p.email, p.full_name
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
  `)
  console.log("User roles in database:", roles.rows)
  await client.end()
}
main()
