import pg from "pg"
const { Client } = pg

const client = new Client({
  connectionString: "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
})

const superAdminId = "4a21b6af-c6e6-4bb0-bc0a-a2bf2f8b5f94"
const customerId = "00000000-0000-0000-0000-000000000002"

async function run() {
  await client.connect()

  // 1. Apply refined RLS policies
  console.log("Applying refined RLS policies on publication_assets...")
  await client.query(`
    ALTER TABLE public.publication_assets ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Admins manage publication assets" ON public.publication_assets;
    DROP POLICY IF EXISTS "Super admins can insert publication assets" ON public.publication_assets;
    DROP POLICY IF EXISTS "Admins can update publication assets" ON public.publication_assets;
    DROP POLICY IF EXISTS "Admins can delete publication assets" ON public.publication_assets;
    DROP POLICY IF EXISTS "Entitled users access publication assets" ON public.publication_assets;

    CREATE POLICY "Super admins can insert publication assets" ON public.publication_assets
      FOR INSERT TO authenticated
      WITH CHECK (
        (public.is_super_admin(auth.uid()) OR public.is_admin(auth.uid()))
        AND EXISTS (
          SELECT 1 FROM public.books b
          WHERE b.id = publication_assets.publication_id
        )
      );

    CREATE POLICY "Admins can update publication assets" ON public.publication_assets
      FOR UPDATE TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));

    CREATE POLICY "Admins can delete publication assets" ON public.publication_assets
      FOR DELETE TO authenticated
      USING (public.is_admin(auth.uid()));

    CREATE POLICY "Entitled users access publication assets" ON public.publication_assets
      FOR SELECT
      USING (
        public.is_admin(auth.uid())
        OR (
          upload_status = 'completed'
          AND (
            EXISTS (
              SELECT 1 FROM public.book_entitlements be
              WHERE be.book_id = publication_assets.publication_id
                AND be.user_id = auth.uid()
                AND be.is_revoked = false
            )
            OR EXISTS (
              SELECT 1 FROM public.books b
              WHERE b.id = publication_assets.publication_id
                AND b.is_free = true
                AND b.is_published = true
            )
          )
        )
      );
  `)
  console.log("Refined RLS policies applied to publication_assets!")

  // Fetch an existing book id
  const bookRes = await client.query("SELECT id FROM public.books LIMIT 1")
  const publicationId = bookRes.rows[0].id

  // Test Case A: Super Admin insert on existing book
  console.log("\n--- TEST A: Super Admin Insert on Existing Book ---")
  try {
    await client.query("BEGIN;")
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [superAdminId])
    await client.query(`SELECT set_config('role', 'authenticated', true);`)
    const res = await client.query(`
      INSERT INTO public.publication_assets (
        publication_id, asset_type, storage_provider, bucket_name,
        object_key, original_filename, mime_type, file_size, upload_status
      ) VALUES ($1, 'pdf', 'r2', 'hiddenbooks-private', $2, 'test.pdf', 'application/pdf', 1024, 'completed')
      RETURNING id, original_filename;
    `, [publicationId, `test-key-${Date.now()}`])
    console.log("SUCCESS: Super Admin asset insert succeeded:", res.rows[0])
    await client.query("ROLLBACK;")
  } catch (err) {
    console.error("FAILED Super Admin insert:", err.message)
    await client.query("ROLLBACK;")
  }

  // Test Case B: Customer insert
  console.log("\n--- TEST B: Customer (Non-Admin) Insert ---")
  try {
    await client.query("BEGIN;")
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [customerId])
    await client.query(`SELECT set_config('role', 'authenticated', true);`)
    await client.query(`
      INSERT INTO public.publication_assets (
        publication_id, asset_type, storage_provider, bucket_name,
        object_key, original_filename, mime_type, file_size, upload_status
      ) VALUES ($1, 'pdf', 'r2', 'hiddenbooks-private', $2, 'test.pdf', 'application/pdf', 1024, 'completed')
      RETURNING id;
    `, [publicationId, `test-key-${Date.now()}`])
    console.error("FAILED: Customer insert should NOT succeed!")
    await client.query("ROLLBACK;")
  } catch (err) {
    console.log("SUCCESS: Customer insert blocked by RLS:", err.message)
    await client.query("ROLLBACK;")
  }

  // Test Case C: Super Admin insert with non-existent publication ID
  console.log("\n--- TEST C: Super Admin Insert with Non-Existent Book ID ---")
  try {
    await client.query("BEGIN;")
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [superAdminId])
    await client.query(`SELECT set_config('role', 'authenticated', true);`)
    await client.query(`
      INSERT INTO public.publication_assets (
        publication_id, asset_type, storage_provider, bucket_name,
        object_key, original_filename, mime_type, file_size, upload_status
      ) VALUES ('00000000-0000-0000-0000-000000000999', 'pdf', 'r2', 'hiddenbooks-private', $1, 'test.pdf', 'application/pdf', 1024, 'completed')
      RETURNING id;
    `, [`test-key-${Date.now()}`])
    console.error("FAILED: Insert with fake book ID should NOT succeed!")
    await client.query("ROLLBACK;")
  } catch (err) {
    console.log("SUCCESS: Non-existent publication ID blocked:", err.message)
    await client.query("ROLLBACK;")
  }

  await client.end()
}

run().catch(console.error)
