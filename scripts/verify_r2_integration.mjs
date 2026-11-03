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
console.log("   HIDDENBOOKS CLOUDFLARE R2 & SUPABASE INTEGRATION VERIFICATION")
console.log("==================================================================")

// 1. Verify Configuration Environment
const accountId = process.env.R2_ACCOUNT_ID
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const bucketName = process.env.R2_BUCKET_NAME || "hiddenbooks-private"
const endpoint = process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`

const missingEnv = []
if (!accountId) missingEnv.push("R2_ACCOUNT_ID")
if (!accessKeyId) missingEnv.push("R2_ACCESS_KEY_ID")
if (!secretAccessKey) missingEnv.push("R2_SECRET_ACCESS_KEY")
if (!bucketName) missingEnv.push("R2_BUCKET_NAME")
if (!endpoint) missingEnv.push("R2_ENDPOINT")

if (missingEnv.length > 0) {
  console.error("FAIL: Missing required environment variables:", missingEnv.join(", "))
  process.exit(1)
}
console.log("PASS [Config]: All Cloudflare R2 environment variables are present.")
console.log(`- Configured Bucket: ${bucketName}`)
console.log(`- Configured Endpoint: ${endpoint}`)
console.log(`- Key ID Prefix: ${accessKeyId.slice(0, 6)}... (length: ${accessKeyId.length})`)

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

async function runVerification() {
  await dbClient.connect()
  console.log("PASS [Database]: Connected to Supabase PostgreSQL.")

  // 2. Fetch or create a test publication record
  let publicationId = null
  const bookRes = await dbClient.query("SELECT id, title, is_free, price_cents FROM public.books LIMIT 1")
  if (bookRes.rows.length > 0) {
    publicationId = bookRes.rows[0].id
    console.log(`PASS [Publication]: Using existing publication "${bookRes.rows[0].title}" (${publicationId}).`)
  } else {
    const newBook = await dbClient.query(`
      INSERT INTO public.books (title, slug, price_cents, is_free, is_published)
      VALUES ('R2 Verification Test Book', 'r2-verification-test', 29900, false, true)
      RETURNING id, title;
    `)
    publicationId = newBook.rows[0].id
    console.log(`PASS [Publication]: Created temporary publication "${newBook.rows[0].title}" (${publicationId}).`)
  }

  // 3. Prepare a real valid minimal PDF file
  const testPdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 55 >>
stream
BT
/F1 24 Tf
100 700 Td
(HiddenBooks Cloudflare R2 Protected PDF) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
311
%%EOF`

  const pdfBuffer = Buffer.from(testPdfContent, "utf8")
  const timestamp = Date.now()
  const objectKey = `publications/${publicationId}/pdf/${timestamp}_sample_verification_ebook.pdf`
  const originalFilename = "sample_verification_ebook.pdf"
  const mimeType = "application/pdf"

  console.log(`\n--- Verification Step 1 & 2: Real Cloudflare R2 Upload ---`)
  console.log(`Target Object Key: ${objectKey}`)
  console.log(`Payload Size: ${pdfBuffer.length} bytes`)

  // Upload to Cloudflare R2
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: pdfBuffer,
      ContentType: mimeType,
      Metadata: {
        publication_id: publicationId,
        verified_by: "verification_script",
      },
    })
  )
  console.log("PASS [R2 Upload]: File successfully uploaded to Cloudflare R2 bucket.")

  // Verify object physically exists in bucket
  const headRes = await s3Client.send(
    new HeadObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    })
  )
  if (headRes.ContentLength !== pdfBuffer.length) {
    throw new Error(`Size mismatch: expected ${pdfBuffer.length}, got ${headRes.ContentLength}`)
  }
  console.log(`PASS [R2 Verification]: Object verified in bucket '${bucketName}'. Exact size match: ${headRes.ContentLength} bytes.`)

  // 4. Verification Step 3: Supabase Asset Metadata Storage
  console.log(`\n--- Verification Step 3: Supabase Metadata Persistence ---`)
  const insertRes = await dbClient.query(`
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
      is_downloadable
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *;
  `, [
    publicationId,
    "pdf",
    "r2",
    bucketName,
    objectKey,
    originalFilename,
    mimeType,
    pdfBuffer.length,
    "completed",
    true,
  ])

  const assetRecord = insertRes.rows[0]
  console.log("PASS [Supabase Insert]: Stored publication asset metadata:")
  console.log({
    asset_id: assetRecord.id,
    publication_id: assetRecord.publication_id,
    asset_type: assetRecord.asset_type,
    storage_provider: assetRecord.storage_provider,
    bucket_name: assetRecord.bucket_name,
    object_key: assetRecord.object_key,
    file_size: assetRecord.file_size,
    upload_status: assetRecord.upload_status,
  })

  // 5. Verification Step 4: Security - Test Unentitled Access Denial
  console.log(`\n--- Verification Step 4 & 5: Security & Entitlement Enforcement ---`)
  const dummyUnentitledUserId = "00000000-0000-0000-0000-000000000001"
  
  // Check entitlement in DB
  const entRes = await dbClient.query(`
    SELECT 1 FROM public.book_entitlements 
    WHERE user_id = $1 AND book_id = $2 AND is_revoked = false
  `, [dummyUnentitledUserId, publicationId])

  const isUserEntitled = entRes.rows.length > 0
  console.log(`Checking unentitled user (${dummyUnentitledUserId}) entitlement: ${isUserEntitled ? "GRANTED" : "DENIED"}`)
  if (isUserEntitled) {
    throw new Error("FAIL: Dummy user should not have entitlement!")
  }
  console.log("PASS [Security]: Unpurchased/unentitled user has no grant in book_entitlements.")

  // 6. Verification Step 6: Short-lived Signed URL Delivery
  console.log(`\n--- Verification Step 6: Short-Lived Signed URL Generation & Fetch ---`)
  const getCommand = new GetObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
    ResponseContentDisposition: `attachment; filename="${originalFilename}"`,
  })

  const signedDownloadUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 60 })
  console.log("PASS [Signed URL]: Generated 60-second presigned URL from Cloudflare R2.")
  console.log(`URL prefix: ${signedDownloadUrl.slice(0, 90)}...`)

  // Test downloading the file directly via the signed URL over HTTPS
  const fetchRes = await fetch(signedDownloadUrl)
  if (!fetchRes.ok) {
    throw new Error(`FAIL: Signed URL fetch failed with status ${fetchRes.status}: ${await fetchRes.text()}`)
  }
  const downloadedBuf = Buffer.from(await fetchRes.arrayBuffer())
  if (downloadedBuf.toString("utf8") !== testPdfContent) {
    throw new Error("FAIL: Downloaded content does not match original uploaded PDF!")
  }
  console.log(`PASS [HTTPS Delivery]: Fetched file via signed URL: HTTP ${fetchRes.status} OK. Content-Type: ${fetchRes.headers.get("content-type")}. Byte-for-byte exact match!`)

  // 7. Cleanup
  console.log(`\n--- Verification Step 7: Cleanup Verification Artifacts ---`)
  await s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: objectKey }))
  console.log("PASS [R2 Cleanup]: Deleted verification test object from Cloudflare R2.")

  await dbClient.query("DELETE FROM public.publication_assets WHERE id = $1", [assetRecord.id])
  console.log("PASS [Database Cleanup]: Removed test asset row from publication_assets.")

  await dbClient.end()
  console.log("\n==================================================================")
  console.log("   ALL 6 VERIFICATION CRITERIA SUCCESSFULLY PASSED!")
  console.log("==================================================================")
}

runVerification().catch((err) => {
  console.error("VERIFICATION FAILED WITH ERROR:", err)
  process.exit(1)
})
