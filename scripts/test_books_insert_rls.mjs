import { createClient } from "@supabase/supabase-js"
import pg from "pg"
const { Client } = pg

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://atmzsbbrycxtducxrelo.supabase.co"
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable__v6OmiglRJXtsj0yvalm3A_5qXsR4Di"

const dbClient = new Client({
  connectionString: "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
})

async function test() {
  await dbClient.connect()
  console.log("Checking RLS on books...")

  // 1. Check if anon client (what createAdminClient currently is) can insert into books
  const anonClient = createClient(supabaseUrl, anonKey)
  const testSlug = `test-book-${Date.now()}`
  
  console.log("\nAttempting insert with unauthenticated client (simulating createAdminClient with publishable key)...")
  const { data: anonData, error: anonError } = await anonClient
    .from("books")
    .insert({
      title: "Test Book",
      slug: testSlug,
      price_cents: 100,
    })
    .select()

  console.log("Result with anon client:", { anonData, error: anonError?.message, code: anonError?.code })

  // 2. Now let's test in PostgreSQL directly what happens when auth.uid() is set to apexnucleus007's id
  const userId = "4a21b6af-c6e6-4bb0-bc0a-a2bf2f8b5f94"
  console.log(`\nTesting SQL evaluation with auth.uid() = '${userId}' in PostgreSQL:`)

  const testAuth = await dbClient.query(`
    SELECT public.is_admin($1::uuid) AS is_admin, public.is_super_admin($1::uuid) AS is_super_admin;
  `, [userId])
  console.log("Function results for user:", testAuth.rows[0])

  // 3. Let's test what policies exist for INSERT specifically on books
  const insertPolicies = await dbClient.query(`
    SELECT pol.polname, pol.polcmd,
           pg_get_expr(pol.polqual, pol.polrelid) AS using_expression,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expression
    FROM pg_policy pol
    JOIN pg_class pc ON pol.polrelid = pc.oid
    WHERE pc.relname = 'books' AND pol.polcmd IN ('*', 'a');
  `)
  console.log("\nPolicies covering INSERT on books (* = ALL, a = INSERT):", insertPolicies.rows)

  // 4. Test RLS transaction with set_config simulating PostgREST authenticated request:
  try {
    await dbClient.query("BEGIN;")
    // Simulate Supabase PostgREST session:
    await dbClient.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [userId])
    await dbClient.query(`SELECT set_config('role', 'authenticated', true);`)
    
    // Now try insert under RLS as authenticated user
    const insertTest = await dbClient.query(`
      INSERT INTO public.books (title, slug, price_cents, is_free, is_published)
      VALUES ('Simulated PostgREST Insert', $1, 100, false, false)
      RETURNING id, title;
    `, [`sim-${Date.now()}`])
    console.log("Simulated authenticated user insert:", insertTest.rows)
    await dbClient.query("ROLLBACK;")
  } catch (err) {
    console.error("Simulated authenticated user insert failed:", err.message)
    await dbClient.query("ROLLBACK;")
  }

  await dbClient.end()
}

test().catch(console.error)
