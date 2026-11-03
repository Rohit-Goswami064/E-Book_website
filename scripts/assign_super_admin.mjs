import pg from "pg"
const { Client } = pg

const client = new Client({
  connectionString: "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
})

async function assign() {
  await client.connect()
  const uid = "4a21b6af-c6e6-4bb0-bc0a-a2bf2f8b5f94"
  
  // Update or insert super_admin role
  const updateRes = await client.query(`
    UPDATE public.user_roles 
    SET role = 'super_admin', assigned_by = $1
    WHERE user_id = $1
    RETURNING *;
  `, [uid])

  if (updateRes.rows.length === 0) {
    const insertRes = await client.query(`
      INSERT INTO public.user_roles (user_id, role, assigned_by)
      VALUES ($1, 'super_admin', $1)
      RETURNING *;
    `, [uid])
    console.log("Inserted super_admin role:", insertRes.rows)
  } else {
    console.log("Updated to super_admin role:", updateRes.rows)
  }

  // Double check
  const check = await client.query("SELECT * FROM public.user_roles WHERE user_id = $1", [uid])
  console.log("Verified user_roles:", check.rows)

  await client.end()
}

assign().catch(console.error)
