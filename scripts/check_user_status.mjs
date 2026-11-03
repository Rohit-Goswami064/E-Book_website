import pg from "pg"
const { Pool } = pg

const pool = new Pool({
  connectionString: "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
})

async function run() {
  const client = await pool.connect()
  try {
    const userId = "1bbc668f-2f43-4aa9-902c-2c3815b42bdc"
    const bookId = "8c0456eb-4456-4a01-acc3-c66127b08267"

    console.log("=== USER ROLE ===")
    const roleRes = await client.query(`SELECT * FROM public.user_roles WHERE user_id = $1`, [userId])
    console.log("Role:", roleRes.rows)

    console.log("=== ENTITLEMENTS ===")
    const entRes = await client.query(`SELECT * FROM public.book_entitlements WHERE user_id = $1 AND book_id = $2`, [userId, bookId])
    console.log("Entitlements:", entRes.rows)

    console.log("=== ALL USERS ===")
    const usersRes = await client.query(`SELECT id, email, confirmed_at, email_confirmed_at, last_sign_in_at FROM auth.users`)
    console.log("Users:", usersRes.rows)

    console.log("=== ALL ROLES ===")
    const allRoles = await client.query(`SELECT * FROM public.user_roles`)
    console.log("Roles:", allRoles.rows)

  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(console.error)
