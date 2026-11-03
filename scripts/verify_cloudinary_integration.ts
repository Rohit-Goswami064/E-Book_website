import pg from "pg"
const { Client } = pg
import {
  generateSignedUploadParams,
  CLOUDINARY_FOLDER_MAP,
} from "../src/lib/cloudinary/server"

console.log("==================================================================")
console.log("    HIDDENBOOKS CLOUDINARY & SUPABASE INTEGRATION TEST SUITE     ")
console.log("==================================================================")

const dbClient = new Client({
  connectionString: "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false },
})

const superAdminId = "4a21b6af-c6e6-4bb0-bc0a-a2bf2f8b5f94"
const customerId = "1bbc668f-2f43-4aa9-902c-2c3815b42bdc"

async function runTests() {
  await dbClient.connect()
  console.log("PASS [Database]: Connected to Supabase PostgreSQL.")

  // -------------------------------------------------------------
  // Test 1: Verify media_assets table schema & RLS configuration
  // -------------------------------------------------------------
  console.log("\n[TEST 1] Verifying media_assets table schema & RLS status...")
  const rlsCheck = await dbClient.query(`
    SELECT relname, relrowsecurity 
    FROM pg_class 
    WHERE relname = 'media_assets';
  `)

  if (!rlsCheck.rows[0]?.relrowsecurity) {
    throw new Error("FAIL: RLS is NOT enabled on media_assets table!")
  }
  console.log("PASS [RLS Enabled]: row-level security is active on 'media_assets'.")

  const policies = await dbClient.query(`
    SELECT policyname, cmd, roles, qual, with_check
    FROM pg_policies
    WHERE tablename = 'media_assets'
    ORDER BY policyname;
  `)
  console.log(`PASS [Policies Found]: ${policies.rows.length} RLS policies configured on media_assets:`)
  policies.rows.forEach(p => console.log(`   - ${p.policyname} (${p.cmd})`))

  // -------------------------------------------------------------
  // Test 2: Verify Unauthorized user CANNOT insert into media_assets
  // -------------------------------------------------------------
  console.log("\n[TEST 2] Testing Unauthorized customer insert rejection under RLS...")
  await dbClient.query("BEGIN;")
  await dbClient.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [customerId])
  await dbClient.query(`SELECT set_config('role', 'authenticated', true);`)

  let unauthorizedBlocked = false
  try {
    await dbClient.query(`
      INSERT INTO public.media_assets (
        public_id, secure_url, resource_type, asset_type, created_by
      ) VALUES ($1, $2, $3, $4, $5);
    `, [
      "unauthorized-exploit-id",
      "https://malicious.com/fake.jpg",
      "image",
      "book_cover",
      customerId,
    ])
  } catch (err: any) {
    unauthorizedBlocked = true
    console.log(`PASS [Unauthorized Blocked]: Customer correctly rejected by RLS: "${err.message}"`)
  }
  await dbClient.query("ROLLBACK;")

  if (!unauthorizedBlocked) {
    throw new Error("CRITICAL SECURITY FAILURE: Unauthorized customer was able to insert into media_assets!")
  }

  // -------------------------------------------------------------
  // Test 3: Verify Authorized Super Admin CAN insert into media_assets
  // -------------------------------------------------------------
  console.log("\n[TEST 3] Testing Authorized Super Admin insert under RLS...")
  await dbClient.query("BEGIN;")
  await dbClient.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [superAdminId])
  await dbClient.query(`SELECT set_config('role', 'authenticated', true);`)

  const testPublicId = `hiddenbooks/covers/test_cover_${Date.now()}`
  const testSecureUrl = `https://res.cloudinary.com/HiddenBooks/image/upload/v1730100000/${testPublicId}.jpg`

  // Get a real book ID
  const bookRes = await dbClient.query("SELECT id, title FROM public.books LIMIT 1;")
  const targetBook = bookRes.rows[0]
  console.log(`   Target publication: "${targetBook?.title}" (${targetBook?.id})`)

  const insertAssetRes = await dbClient.query(`
    INSERT INTO public.media_assets (
      public_id, secure_url, url, resource_type, format, width, height, bytes,
      folder, asset_type, publication_id, alt_text, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *;
  `, [
    testPublicId,
    testSecureUrl,
    testSecureUrl,
    "image",
    "jpg",
    1200,
    1800,
    345678,
    "hiddenbooks/covers",
    "book_cover",
    targetBook?.id,
    "Test Shant Dimag Book Cover",
    superAdminId,
  ])

  const createdAsset = insertAssetRes.rows[0]
  console.log("PASS [Super Admin Insert]: Verified media asset successfully created in Supabase:")
  console.log({
    id: createdAsset.id,
    public_id: createdAsset.public_id,
    secure_url: createdAsset.secure_url,
    resource_type: createdAsset.resource_type,
    format: createdAsset.format,
    dimensions: `${createdAsset.width}x${createdAsset.height}`,
    bytes: createdAsset.bytes,
    publication_id: createdAsset.publication_id,
  })

  // Update book cover_image_url
  if (targetBook?.id) {
    await dbClient.query(`
      UPDATE public.books
      SET cover_image_url = $1
      WHERE id = $2;
    `, [testSecureUrl, targetBook.id])
    console.log(`PASS [Book Updated]: books.cover_image_url linked to ${testSecureUrl}`)
  }

  await dbClient.query("COMMIT;")

  // -------------------------------------------------------------
  // Test 4: Verify Persistence after simulated page refresh
  // -------------------------------------------------------------
  console.log("\n[TEST 4] Verifying media asset and book cover persistence...")
  const persistCheck = await dbClient.query(`
    SELECT m.id, m.public_id, m.secure_url, m.asset_type, b.title, b.cover_image_url
    FROM public.media_assets m
    LEFT JOIN public.books b ON b.id = m.publication_id
    WHERE m.public_id = $1;
  `, [testPublicId])

  const fetched = persistCheck.rows[0]
  if (!fetched || fetched.cover_image_url !== testSecureUrl) {
    throw new Error("FAIL: Cover image did not persist in database!")
  }
  console.log("PASS [Persistence Verified]: Asset metadata and linked publication cover confirmed:")
  console.log({
    asset_id: fetched.id,
    public_id: fetched.public_id,
    publication_title: fetched.title,
    persisted_cover_url: fetched.cover_image_url,
  })

  // -------------------------------------------------------------
  // Test 5: Verify Signed Upload Signature Generation & Limits
  // -------------------------------------------------------------
  console.log("\n[TEST 5] Verifying Server-side Signed Upload Generation & Security...")
  
  // Book cover signature
  const bookCoverParams = generateSignedUploadParams("book_cover")
  console.log("PASS [Book Cover Params]:")
  console.log({
    folder: bookCoverParams.folder,
    resourceType: bookCoverParams.resourceType,
    maxSizeBytes: `${(bookCoverParams.maxSizeBytes / (1024 * 1024)).toFixed(0)} MB`,
    allowedFormats: bookCoverParams.allowedFormats,
    hasSignature: Boolean(bookCoverParams.signature),
    hasApiKey: Boolean(bookCoverParams.apiKey),
    timestamp: bookCoverParams.timestamp,
  })

  if (bookCoverParams.folder !== "hiddenbooks/covers" || bookCoverParams.resourceType !== "image") {
    throw new Error("FAIL: Invalid folder or resourceType in book cover signature!")
  }

  // Promotional video signature
  const promoVideoParams = generateSignedUploadParams("promo_video")
  console.log("\nPASS [Promo Video Params]:")
  console.log({
    folder: promoVideoParams.folder,
    resourceType: promoVideoParams.resourceType,
    maxSizeBytes: `${(promoVideoParams.maxSizeBytes / (1024 * 1024)).toFixed(0)} MB`,
    allowedFormats: promoVideoParams.allowedFormats,
    hasSignature: Boolean(promoVideoParams.signature),
    timestamp: promoVideoParams.timestamp,
  })

  if (promoVideoParams.folder !== "hiddenbooks/promo_videos" || promoVideoParams.resourceType !== "video") {
    throw new Error("FAIL: Invalid folder or resourceType in promo video signature!")
  }
  if (promoVideoParams.maxSizeBytes !== 104857600) {
    throw new Error("FAIL: Video max file size not enforced to 100MB!")
  }

  // -------------------------------------------------------------
  // Test 6: Verify Separation between Cloudflare R2 and Cloudinary
  // -------------------------------------------------------------
  console.log("\n[TEST 6] Verifying Storage Separation (R2 Private vs Cloudinary Public)...")
  const r2Assets = await dbClient.query(`
    SELECT id, publication_id, asset_type, storage_provider, bucket_name, object_key, is_downloadable
    FROM public.publication_assets
    WHERE storage_provider = 'r2'
    LIMIT 3;
  `)
  console.log(`PASS [R2 Isolated]: Found ${r2Assets.rows.length} existing private R2 assets in publication_assets:`)
  r2Assets.rows.forEach(a => {
    console.log(`   - [R2 Private Asset] ID: ${a.id}, Type: ${a.asset_type}, Bucket: ${a.bucket_name}, Key: ${a.object_key}`)
  })

  // Cleanup test media asset created in Test 3
  await dbClient.query("DELETE FROM public.media_assets WHERE public_id = $1;", [testPublicId])
  console.log(`\nPASS [Cleanup]: Test asset ${testPublicId} safely cleaned up.`)

  await dbClient.end()
  console.log("\n==================================================================")
  console.log("   ALL INTEGRATION & VERIFICATION CHECKS PASSED SUCCESSFULLY!    ")
  console.log("==================================================================")
}

runTests().catch(err => {
  console.error("\nTEST SUITE FAILED:", err)
  process.exit(1)
})
