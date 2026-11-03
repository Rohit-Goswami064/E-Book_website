import pg from "pg"

const connectionString = "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

async function run() {
  const client = new pg.Client({ connectionString })
  await client.connect()

  console.log("=== 1. COLUMNS OF reading_progress ===")
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = 'reading_progress'
    ORDER BY ordinal_position
  `)
  console.log(cols.rows)

  console.log("\n=== 2. CONSTRAINTS ON reading_progress ===")
  const constraints = await client.query(`
    SELECT conname, contype, pg_get_constraintdef(oid)
    FROM pg_constraint
    WHERE conrelid = 'public.reading_progress'::regclass
  `)
  console.log(constraints.rows)

  console.log("\n=== 3. RLS POLICIES ON reading_progress ===")
  const policies = await client.query(`
    SELECT policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE tablename = 'reading_progress'
  `)
  console.log(policies.rows)

  console.log("\n=== 4. TEST UPSERT ===")
  const testUserId = "1bbc668f-2f43-4aa9-902c-2c3815b42bdc"
  const testBookId = "8c0456eb-4456-4a01-acc3-c66127b08267"
  try {
    const upsertRes = await client.query(`
      INSERT INTO public.reading_progress (
        user_id, book_id, current_page, total_pages, progress_percentage, last_read_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (user_id, book_id) DO UPDATE SET
        current_page = EXCLUDED.current_page,
        total_pages = EXCLUDED.total_pages,
        progress_percentage = EXCLUDED.progress_percentage,
        last_read_at = EXCLUDED.last_read_at
      RETURNING *;
    `, [testUserId, testBookId, 1, 50, 2])
    console.log("Upsert succeeded in pg:", upsertRes.rows[0])
  } catch (err) {
    console.error("PG Upsert Error:", err)
  }

  await client.end()
}

run().catch(console.error)
