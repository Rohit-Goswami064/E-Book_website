import pg from "pg"
const { Client } = pg

const client = new Client({
  connectionString: "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
})

async function run() {
  await client.connect()

  // 1. Update RLS policies on books
  console.log("Applying refined RLS policies on books...")
  await client.query(`
    -- Ensure RLS enabled
    ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

    -- Drop old policies
    DROP POLICY IF EXISTS "Admins can manage books" ON public.books;
    DROP POLICY IF EXISTS "Super admins can insert books" ON public.books;
    DROP POLICY IF EXISTS "Admins can update books" ON public.books;
    DROP POLICY IF EXISTS "Admins can delete books" ON public.books;
    DROP POLICY IF EXISTS "Public can view published books" ON public.books;

    -- Granular explicit policies:
    -- 1. INSERT: Only authenticated Super Admin / Admin users
    CREATE POLICY "Super admins can insert books" ON public.books
      FOR INSERT TO authenticated
      WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_admin(auth.uid()));

    -- 2. UPDATE: Only authenticated Super Admin / Admin users
    CREATE POLICY "Admins can update books" ON public.books
      FOR UPDATE TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));

    -- 3. DELETE: Only authenticated Super Admin / Admin users
    CREATE POLICY "Admins can delete books" ON public.books
      FOR DELETE TO authenticated
      USING (public.is_admin(auth.uid()));

    -- 4. SELECT: Public can view published books, Admins can view all books
    CREATE POLICY "Public can view published books" ON public.books
      FOR SELECT
      USING ((is_published = true) OR public.is_admin(auth.uid()));
  `)
  console.log("RLS policies on books updated successfully!")

  const superAdminId = "4a21b6af-c6e6-4bb0-bc0a-a2bf2f8b5f94"
  const customerId = "00000000-0000-0000-0000-000000000002"

  // Test Case A: Super Admin insert
  console.log("\n--- TEST CASE A: Super Admin Insert ---")
  try {
    await client.query("BEGIN;")
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [superAdminId])
    await client.query(`SELECT set_config('role', 'authenticated', true);`)
    const res = await client.query(`
      INSERT INTO public.books (title, slug, price_cents)
      VALUES ('Super Admin Book', 'super-admin-book-test', 299)
      RETURNING id, title;
    `)
    console.log("SUCCESS: Super Admin insert succeeded:", res.rows[0])
    await client.query("ROLLBACK;")
  } catch (err) {
    console.error("FAILED Super Admin insert:", err.message)
    await client.query("ROLLBACK;")
  }

  // Test Case B: Customer (non-admin) insert
  console.log("\n--- TEST CASE B: Customer (Non-Admin) Insert ---")
  try {
    await client.query("BEGIN;")
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [customerId])
    await client.query(`SELECT set_config('role', 'authenticated', true);`)
    await client.query(`
      INSERT INTO public.books (title, slug, price_cents)
      VALUES ('Customer Book', 'customer-book-test', 299)
      RETURNING id, title;
    `)
    console.error("FAILED: Customer insert should NOT have succeeded!")
    await client.query("ROLLBACK;")
  } catch (err) {
    console.log("SUCCESS: Customer insert correctly blocked by RLS:", err.message)
    await client.query("ROLLBACK;")
  }

  // Test Case C: Unauthenticated (anon) insert
  console.log("\n--- TEST CASE C: Unauthenticated (Anon) Insert ---")
  try {
    await client.query("BEGIN;")
    await client.query(`SELECT set_config('role', 'anon', true);`)
    await client.query(`SELECT set_config('request.jwt.claim.sub', '', true);`)
    await client.query(`
      INSERT INTO public.books (title, slug, price_cents)
      VALUES ('Anon Book', 'anon-book-test', 299)
      RETURNING id, title;
    `)
    console.error("FAILED: Anon insert should NOT have succeeded!")
    await client.query("ROLLBACK;")
  } catch (err) {
    console.log("SUCCESS: Anon insert correctly blocked by RLS:", err.message)
    await client.query("ROLLBACK;")
  }

  await client.end()
}

run().catch(console.error)
