import pg from "pg"
const { Client } = pg

const client = new Client({
  connectionString: "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
})

const superAdminId = "4a21b6af-c6e6-4bb0-bc0a-a2bf2f8b5f94"
const customerId = "00000000-0000-0000-0000-000000000002"

async function runTests() {
  await client.connect()
  console.log("==================================================================")
  console.log("     PUBLICATION WORKFLOW & BOOKS RLS VERIFICATION SUITE")
  console.log("==================================================================")

  let createdBookId = null
  let draftBookId = null

  try {
    // -------------------------------------------------------------
    // Test 1 & 2: Authorized Super Admin can publish a new book
    // -------------------------------------------------------------
    console.log("\n[TEST 1 & 2] Authorized Super Admin Publishing...")
    await client.query("BEGIN;")
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [superAdminId])
    await client.query(`SELECT set_config('role', 'authenticated', true);`)

    const testSlug = `godaan-edition-${Date.now()}`
    const insertRes = await client.query(`
      INSERT INTO public.books (
        title, slug, subtitle, price_cents, is_free, is_published, format, language
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `, [
      "गोदान (Godaan) Curated Edition",
      testSlug,
      "A Timeless Examination of Indian Agrarian Life",
      19900,
      false,
      true,
      "PDF",
      "Hindi"
    ])

    const publishedBook = insertRes.rows[0]
    createdBookId = publishedBook.id
    console.log(`PASS [Test 1 & 2]: Super Admin successfully created publication!`)
    console.log({
      id: publishedBook.id,
      title: publishedBook.title,
      slug: publishedBook.slug,
      price_cents: publishedBook.price_cents,
      is_published: publishedBook.is_published,
      created_at: publishedBook.created_at
    })
    await client.query("COMMIT;")

    // -------------------------------------------------------------
    // Test 3: Ordinary authenticated user CANNOT publish a book
    // -------------------------------------------------------------
    console.log("\n[TEST 3] Ordinary Authenticated User (Customer) Attempt...")
    let customerBlocked = false
    try {
      await client.query("BEGIN;")
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [customerId])
      await client.query(`SELECT set_config('role', 'authenticated', true);`)
      await client.query(`
        INSERT INTO public.books (title, slug, price_cents)
        VALUES ('Unauthorized Customer Book', $1, 9900);
      `, [`unauth-customer-${Date.now()}`])
      await client.query("COMMIT;")
    } catch (err) {
      customerBlocked = true
      console.log(`PASS [Test 3]: Ordinary user blocked by RLS as expected (${err.message}).`)
      await client.query("ROLLBACK;")
    }
    if (!customerBlocked) {
      throw new Error("FAIL [Test 3]: Ordinary user was unexpectedly allowed to insert a book!")
    }

    // -------------------------------------------------------------
    // Test 4: Unauthenticated visitor CANNOT publish a book
    // -------------------------------------------------------------
    console.log("\n[TEST 4] Unauthenticated (Anon) Visitor Attempt...")
    let anonBlocked = false
    try {
      await client.query("BEGIN;")
      await client.query(`SELECT set_config('role', 'anon', true);`)
      await client.query(`SELECT set_config('request.jwt.claim.sub', '', true);`)
      await client.query(`
        INSERT INTO public.books (title, slug, price_cents)
        VALUES ('Unauthorized Anon Book', $1, 9900);
      `, [`unauth-anon-${Date.now()}`])
      await client.query("COMMIT;")
    } catch (err) {
      anonBlocked = true
      console.log(`PASS [Test 4]: Unauthenticated visitor blocked by RLS as expected (${err.message}).`)
      await client.query("ROLLBACK;")
    }
    if (!anonBlocked) {
      throw new Error("FAIL [Test 4]: Unauthenticated visitor was unexpectedly allowed to insert a book!")
    }

    // -------------------------------------------------------------
    // Test 5: Existing books visibility rules
    // -------------------------------------------------------------
    console.log("\n[TEST 5] Visibility Rules (Published vs Draft)...")
    // Super admin creates an unpublished draft
    await client.query("BEGIN;")
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [superAdminId])
    await client.query(`SELECT set_config('role', 'authenticated', true);`)
    const draftRes = await client.query(`
      INSERT INTO public.books (title, slug, price_cents, is_published)
      VALUES ('Secret Unpublished Manuscript', $1, 9900, false)
      RETURNING id, title, is_published;
    `, [`draft-${Date.now()}`])
    draftBookId = draftRes.rows[0].id
    await client.query("COMMIT;")

    // Check visibility for Public / Anon
    await client.query("BEGIN;")
    await client.query(`SELECT set_config('role', 'anon', true);`)
    await client.query(`SELECT set_config('request.jwt.claim.sub', '', true);`)
    const pubCheck = await client.query(`SELECT id, title FROM public.books WHERE id IN ($1, $2);`, [createdBookId, draftBookId])
    await client.query("COMMIT;")

    const visibleToPublicIds = pubCheck.rows.map(r => r.id)
    if (!visibleToPublicIds.includes(createdBookId)) {
      throw new Error("FAIL [Test 5]: Published book should be visible to public!")
    }
    if (visibleToPublicIds.includes(draftBookId)) {
      throw new Error("FAIL [Test 5]: Unpublished draft book should NOT be visible to public!")
    }
    console.log("PASS [Test 5]: Public can view published book, but CANNOT view draft book.")

    // Check that Super Admin CAN view both
    await client.query("BEGIN;")
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [superAdminId])
    await client.query(`SELECT set_config('role', 'authenticated', true);`)
    const adminCheck = await client.query(`SELECT id, title FROM public.books WHERE id IN ($1, $2);`, [createdBookId, draftBookId])
    await client.query("COMMIT;")

    if (adminCheck.rows.length !== 2) {
      throw new Error("FAIL [Test 5]: Super Admin should see both published and draft books!")
    }
    console.log("PASS [Test 5]: Super Admin can view all books (both published and drafts).")

    // -------------------------------------------------------------
    // Test 6: Existing edit and update operations continue to work
    // -------------------------------------------------------------
    console.log("\n[TEST 6] Edit & Update Operations...")
    await client.query("BEGIN;")
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [superAdminId])
    await client.query(`SELECT set_config('role', 'authenticated', true);`)
    const updateRes = await client.query(`
      UPDATE public.books
      SET subtitle = 'Updated Subtitle by Super Admin', price_cents = 24900
      WHERE id = $1
      RETURNING id, subtitle, price_cents;
    `, [createdBookId])
    await client.query("COMMIT;")

    if (updateRes.rows[0].price_cents !== 24900) {
      throw new Error("FAIL [Test 6]: Book update failed to persist.")
    }
    console.log(`PASS [Test 6]: Book update succeeded (New price: ${updateRes.rows[0].price_cents} cents, Subtitle: "${updateRes.rows[0].subtitle}").`)

    // -------------------------------------------------------------
    // Test 7: Clean up test publications
    // -------------------------------------------------------------
    console.log("\n[TEST 7] Cleaning Up Test Records...")
    await client.query("BEGIN;")
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [superAdminId])
    await client.query(`SELECT set_config('role', 'authenticated', true);`)
    await client.query(`DELETE FROM public.books WHERE id IN ($1, $2);`, [createdBookId, draftBookId])
    await client.query("COMMIT;")
    console.log("PASS [Test 7]: Cleaned up test records from database.")

    console.log("\n==================================================================")
    console.log("   ALL 7 PUBLICATION WORKFLOW VERIFICATION TESTS PASSED!")
    console.log("==================================================================")
  } catch (err) {
    console.error("TEST FAILED:", err)
    process.exit(1)
  } finally {
    await client.end()
  }
}

runTests()
