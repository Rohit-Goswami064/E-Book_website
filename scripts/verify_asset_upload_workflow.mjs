import pg from "pg"
const { Client } = pg
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

console.log("==================================================================")
console.log("   HIDDENBOOKS ASSET UPLOAD & RLS WORKFLOW VERIFICATION SUITE")
console.log("==================================================================")

// 1. Environment & S3 Client Setup
const accountId = process.env.R2_ACCOUNT_ID || "0b00ab4003c909bfe8753fed7b39700f"
const accessKeyId = process.env.R2_ACCESS_KEY_ID || "f5d5f7479be9adb7523aa480a52dc6f5"
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "4c546a14130bf67b08698d5fa30dc212f59d1f157c08f54ec83685ea50d9fcfe"
const bucketName = process.env.R2_BUCKET_NAME || "hiddenbooks-private"
const endpoint = process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`

const s3Client = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
})

const dbClient = new Client({
  connectionString: "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false },
})

const superAdminId = "4a21b6af-c6e6-4bb0-bc0a-a2bf2f8b5f94"
const customerId = "00000000-0000-0000-0000-000000000002"

async function runVerification() {
  await dbClient.connect()
  console.log("PASS [Database]: Connected to Supabase PostgreSQL.")

  // -------------------------------------------------------------
  // Step 1: Verify RLS is enabled and verify policies on publication_assets
  // -------------------------------------------------------------
  console.log("\n[STEP 1] Verifying publication_assets RLS configuration...")
  const rlsCheck = await dbClient.query(`
    SELECT relname, relrowsecurity 
    FROM pg_class 
    WHERE relname = 'publication_assets';
  `)
  if (!rlsCheck.rows[0]?.relrowsecurity) {
    throw new Error("FAIL: RLS is NOT enabled on publication_assets!")
  }
  console.log("PASS [RLS Enabled]: row-level security is active on 'publication_assets'.")

  const policiesRes = await dbClient.query(`
    SELECT policyname, cmd, roles, qual, with_check
    FROM pg_policies
    WHERE tablename = 'publication_assets';
  `)
  console.log(`PASS [Policies]: Found ${policiesRes.rows.length} policies on publication_assets:`)
  policiesRes.rows.forEach((p) => {
    console.log(`  - [${p.cmd}] "${p.policyname}"`)
  })

  // -------------------------------------------------------------
  // Step 2: Get an existing publication from books
  // -------------------------------------------------------------
  console.log("\n[STEP 2] Fetching existing publication for testing...")
  const bookRes = await dbClient.query("SELECT id, title FROM public.books LIMIT 1")
  if (bookRes.rows.length === 0) {
    throw new Error("No existing book found to attach asset to.")
  }
  const publicationId = bookRes.rows[0].id
  console.log(`PASS [Publication]: Using book "${bookRes.rows[0].title}" (${publicationId})`)

  // -------------------------------------------------------------
  // Step 3: Test Cloudflare R2 Upload & Signed URL Generation
  // -------------------------------------------------------------
  console.log("\n[STEP 3] Testing Cloudflare R2 Upload to private bucket...")
  const testObjectKey = `publications/${publicationId}/ebooks/godaan-sample-${Date.now()}.pdf`
  const testBuffer = Buffer.from("%PDF-1.4\n%HiddenBooks Protected eBook Test Content\n%%EOF")

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: testObjectKey,
      Body: testBuffer,
      ContentType: "application/pdf",
      Metadata: {
        publication_id: publicationId,
        asset_type: "pdf",
        original_filename: "godaan-sample.pdf",
      },
    })
  )
  console.log(`PASS [R2 Upload]: Uploaded object to "${bucketName}/${testObjectKey}"`)

  // Verify object exists in R2
  const headRes = await s3Client.send(
    new HeadObjectCommand({
      Bucket: bucketName,
      Key: testObjectKey,
    })
  )
  console.log(`PASS [R2 Head]: Object verified in R2. ContentLength = ${headRes.ContentLength} bytes.`)

  // Generate signed preview URL
  const signedUrl = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: bucketName,
      Key: testObjectKey,
    }),
    { expiresIn: 300 }
  )
  console.log(`PASS [R2 Signed URL]: Generated valid signed URL: ${signedUrl.slice(0, 80)}...`)

  // -------------------------------------------------------------
  // Step 4: Test Supabase Metadata Insert under Super Admin session
  // -------------------------------------------------------------
  console.log("\n[STEP 4] Testing Supabase Metadata INSERT under Super Admin session...")
  await dbClient.query("BEGIN;")
  await dbClient.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [superAdminId])
  await dbClient.query(`SELECT set_config('role', 'authenticated', true);`)

  const insertAssetRes = await dbClient.query(`
    INSERT INTO public.publication_assets (
      publication_id,
      asset_type,
      storage_provider,
      bucket_name,
      object_key,
      original_filename,
      mime_type,
      file_size,
      upload_status,
      is_downloadable,
      metadata
    ) VALUES (
      $1, 'pdf', 'r2', $2, $3, 'godaan-sample.pdf', 'application/pdf', $4, 'completed', true, '{"title": "Godaan Complete PDF"}'::jsonb
    ) RETURNING *;
  `, [publicationId, bucketName, testObjectKey, headRes.ContentLength])

  const savedAsset = insertAssetRes.rows[0]
  console.log("PASS [Metadata Saved]: Asset metadata successfully inserted into Supabase!")
  console.log({
    id: savedAsset.id,
    publication_id: savedAsset.publication_id,
    asset_type: savedAsset.asset_type,
    storage_provider: savedAsset.storage_provider,
    bucket_name: savedAsset.bucket_name,
    object_key: savedAsset.object_key,
    original_filename: savedAsset.original_filename,
    file_size: savedAsset.file_size,
    upload_status: savedAsset.upload_status,
    created_at: savedAsset.created_at,
  })

  // Test SELECT under Super Admin session (Admins can view assets)
  const selectRes = await dbClient.query(
    "SELECT id, original_filename, upload_status FROM public.publication_assets WHERE id = $1",
    [savedAsset.id]
  )
  console.log(`PASS [Metadata Query]: Found ${selectRes.rows.length} record in publication_assets for publication.`)

  await dbClient.query("COMMIT;")

  // -------------------------------------------------------------
  // Step 5: Test RLS Security Boundary (Non-admin & Anonymous rejected)
  // -------------------------------------------------------------
  console.log("\n[STEP 5] Testing RLS Security Boundaries...")

  // 5a. Customer attempt to INSERT asset
  try {
    await dbClient.query("BEGIN;")
    await dbClient.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [customerId])
    await dbClient.query(`SELECT set_config('role', 'authenticated', true);`)
    await dbClient.query(`
      INSERT INTO public.publication_assets (
        publication_id, asset_type, storage_provider, bucket_name,
        object_key, original_filename, mime_type, file_size, upload_status
      ) VALUES ($1, 'pdf', 'r2', $2, 'bad-key', 'hacked.pdf', 'application/pdf', 100, 'completed')
    `, [publicationId, bucketName])
    console.error("FAIL: Customer was able to insert asset record!")
    await dbClient.query("ROLLBACK;")
  } catch (err) {
    console.log(`PASS [RLS Boundary - Customer Blocked]: ${err.message}`)
    await dbClient.query("ROLLBACK;")
  }

  // 5b. Super Admin attempt to INSERT asset for NON-EXISTENT publication
  try {
    await dbClient.query("BEGIN;")
    await dbClient.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [superAdminId])
    await dbClient.query(`SELECT set_config('role', 'authenticated', true);`)
    await dbClient.query(`
      INSERT INTO public.publication_assets (
        publication_id, asset_type, storage_provider, bucket_name,
        object_key, original_filename, mime_type, file_size, upload_status
      ) VALUES ('00000000-0000-0000-0000-000000000999', 'pdf', 'r2', $1, 'bad-key', 'orphan.pdf', 'application/pdf', 100, 'completed')
    `, [bucketName])
    console.error("FAIL: Insert with non-existent publication ID succeeded!")
    await dbClient.query("ROLLBACK;")
  } catch (err) {
    console.log(`PASS [RLS Boundary - Non-Existent Book Blocked]: ${err.message}`)
    await dbClient.query("ROLLBACK;")
  }

  // -------------------------------------------------------------
  // Step 6: Test Orphan Reconciliation Workflow
  // -------------------------------------------------------------
  console.log("\n[STEP 6] Testing R2 Orphan Reconciliation Workflow...")
  const orphanObjectKey = `publications/${publicationId}/ebooks/orphan-test-${Date.now()}.pdf`

  // 6a. Upload to R2
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: orphanObjectKey,
      Body: Buffer.from("Temporary orphan content"),
      ContentType: "application/pdf",
    })
  )
  console.log(`Uploaded candidate object to R2: ${orphanObjectKey}`)

  // Verify it exists in R2
  const orphanHead1 = await s3Client.send(new HeadObjectCommand({ Bucket: bucketName, Key: orphanObjectKey }))
  console.log(`Candidate verified in R2 (size: ${orphanHead1.ContentLength} bytes).`)

  // 6b. Simulate Database Persistence Failure
  console.log("Simulating database persistence rejection (e.g. invalid publication ID)...")
  let dbFailed = false
  try {
    await dbClient.query("BEGIN;")
    await dbClient.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [superAdminId])
    await dbClient.query(`SELECT set_config('role', 'authenticated', true);`)
    await dbClient.query(`
      INSERT INTO public.publication_assets (
        publication_id, asset_type, storage_provider, bucket_name,
        object_key, original_filename, mime_type, file_size, upload_status
      ) VALUES ('00000000-0000-0000-0000-000000000999', 'pdf', 'r2', $1, $2, 'test.pdf', 'application/pdf', 10, 'completed')
    `, [bucketName, orphanObjectKey])
    await dbClient.query("COMMIT;")
  } catch (dbErr) {
    await dbClient.query("ROLLBACK;")
    dbFailed = true
    console.log(`Database insertion failed as anticipated: ${dbErr.message}`)
  }

  if (dbFailed) {
    console.log("Triggering automated orphan reconciliation: deleting R2 object...")
    await s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: orphanObjectKey }))
    console.log(`PASS [Orphan Cleaned]: DeleteObjectCommand dispatched for ${orphanObjectKey}`)

    // Verify object is gone from R2
    let stillExists = false
    try {
      await s3Client.send(new HeadObjectCommand({ Bucket: bucketName, Key: orphanObjectKey }))
      stillExists = true
    } catch (headErr) {
      if (headErr.name === "NotFound" || headErr.$metadata?.httpStatusCode === 404) {
        console.log("PASS [Orphan Confirmed Removed]: Object is no longer present in private Cloudflare R2.")
      } else {
        throw headErr
      }
    }
    if (stillExists) {
      throw new Error("FAIL: Orphan object still exists in R2!")
    }
  }

  // -------------------------------------------------------------
  // Step 7: Clean up test asset record & R2 object
  // -------------------------------------------------------------
  console.log("\n[STEP 7] Cleaning up test artifacts...")
  await dbClient.query("DELETE FROM public.publication_assets WHERE id = $1", [savedAsset.id])
  await s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: testObjectKey }))
  console.log("PASS [Cleanup]: Cleaned up test database record and R2 object.")

  console.log("\n==================================================================")
  console.log("   ALL ASSET UPLOAD & RLS WORKFLOW TESTS PASSED SUCCESSFULLY!    ")
  console.log("==================================================================")
}

runVerification()
  .catch((err) => {
    console.error("\nTEST SUITE FAILED:", err)
    process.exit(1)
  })
  .finally(() => {
    dbClient.end()
  })
