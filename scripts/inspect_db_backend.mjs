import pg from "pg"
const { Client } = pg

const client = new Client({
  connectionString: "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
})

async function main() {
  await client.connect()
  const jwtSecret = await client.query(`
    SELECT current_setting('app.settings.jwt_secret', true) as jwt_secret
  `)
  console.log("app.settings.jwt_secret:", jwtSecret.rows[0])

  const vault = await client.query(`
    SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'vault'
  `)
  console.log("Vault tables:", vault.rows)

  if (vault.rows.length > 0) {
    try {
      const secrets = await client.query(`SELECT * FROM vault.decrypted_secrets`)
      console.log("Vault secrets:", secrets.rows.map(r => ({ name: r.name, key_id: r.key_id })))
    } catch (e) {
      console.log("Vault error:", e.message)
    }
  }

  // Count real orders and payments directly in PostgreSQL
  const ordersCount = await client.query(`SELECT count(*) FROM public.orders`)
  console.log("REAL Orders count in DB:", ordersCount.rows[0].count)

  const paymentsCount = await client.query(`SELECT count(*) FROM public.payments`)
  console.log("REAL Payments count in DB:", paymentsCount.rows[0].count)

  const capturedPayments = await client.query(`SELECT count(*), sum(amount_cents) FROM public.payments WHERE status = 'captured'`)
  console.log("REAL Captured payments:", capturedPayments.rows[0])

  await client.end()
}
main()
