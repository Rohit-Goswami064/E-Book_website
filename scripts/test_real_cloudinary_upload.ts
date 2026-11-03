import fs from "fs"
import path from "path"
import pg from "pg"
const { Client } = pg
import {
  generateSignedUploadParams,
  verifyCloudinaryAsset,
  deleteCloudinaryAsset,
  uploadBufferToCloudinary,
} from "../src/lib/cloudinary/server"

async function runRealUploadTest() {
  console.log("==================================================================")
  console.log("    TESTING REAL CLOUDINARY UPLOAD & SUPABASE METADATA PERSIST   ")
  console.log("==================================================================")

  // 1. Read real cover image
  const sampleImagePath = path.resolve("public/preview.jpg")
  const imageBuffer = fs.readFileSync(sampleImagePath)
  console.log(`PASS [Image Ready]: Loaded ${sampleImagePath} (${(imageBuffer.length / 1024).toFixed(1)} KB)`)

  // 2. Upload real image to Cloudinary folder hiddenbooks/covers
  console.log("\n[STEP 1] Uploading real image to Cloudinary CDN...")
  const uploadRes = await uploadBufferToCloudinary(imageBuffer, "book_cover", `shant_dimag_cover_${Date.now()}`)
  
  console.log("PASS [Cloudinary Upload Succeeded]:")
  console.log({
    public_id: uploadRes.public_id,
    secure_url: uploadRes.secure_url,
    format: uploadRes.format,
    width: uploadRes.width,
    height: uploadRes.height,
    bytes: uploadRes.bytes,
    resource_type: uploadRes.resource_type,
    created_at: uploadRes.created_at,
  })

  // 3. Verify asset via Cloudinary Admin API
  console.log("\n[STEP 2] Verifying asset details via Cloudinary API...")
  const verified = await verifyCloudinaryAsset(uploadRes.public_id, "image")
  console.log("PASS [Cloudinary Verification]: Remote asset verified:")
  console.log({
    public_id: verified.public_id,
    secure_url: verified.secure_url,
    dimensions: `${verified.width}x${verified.height}`,
    format: verified.format,
    bytes: verified.bytes,
  })

  // 4. Save metadata to Supabase public.media_assets and update books.cover_image_url
  console.log("\n[STEP 3] Persisting verified metadata into Supabase PostgreSQL...")
  const dbClient = new Client({
    connectionString: "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
    ssl: { rejectUnauthorized: false },
  })
  await dbClient.connect()

  const superAdminId = "4a21b6af-c6e6-4bb0-bc0a-a2bf2f8b5f94"
  await dbClient.query("BEGIN;")
  await dbClient.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [superAdminId])
  await dbClient.query(`SELECT set_config('role', 'authenticated', true);`)

  // Find Shant Dimag book
  const bookRes = await dbClient.query("SELECT id, title, cover_image_url FROM public.books LIMIT 1;")
  const book = bookRes.rows[0]

  const mediaInsert = await dbClient.query(`
    INSERT INTO public.media_assets (
      public_id, secure_url, url, resource_type, format, width, height, bytes,
      folder, asset_type, publication_id, alt_text, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *;
  `, [
    verified.public_id,
    verified.secure_url,
    verified.url,
    verified.resource_type,
    verified.format,
    verified.width,
    verified.height,
    verified.bytes,
    "hiddenbooks/covers",
    "book_cover",
    book.id,
    "शांत दिमाग: अति सोच, चिंता और उलझन से मुक्ति",
    superAdminId,
  ])

  const savedMedia = mediaInsert.rows[0]
  console.log("PASS [Supabase Media Asset Saved]:", {
    id: savedMedia.id,
    public_id: savedMedia.public_id,
    secure_url: savedMedia.secure_url,
    dimensions: `${savedMedia.width}x${savedMedia.height}`,
    bytes: savedMedia.bytes,
    publication_id: savedMedia.publication_id,
  })

  // Update book cover
  await dbClient.query(`
    UPDATE public.books
    SET cover_image_url = $1
    WHERE id = $2;
  `, [verified.secure_url, book.id])

  await dbClient.query("COMMIT;")

  // 5. Verify query persistence after simulated page refresh
  console.log("\n[STEP 4] Verifying persistence on books table...")
  const bookCheck = await dbClient.query("SELECT id, title, cover_image_url FROM public.books WHERE id = $1;", [book.id])
  console.log("PASS [Book Query]:", bookCheck.rows[0])

  if (bookCheck.rows[0].cover_image_url !== verified.secure_url) {
    throw new Error("FAIL: Cover image URL does not match Cloudinary secure URL!")
  }

  await dbClient.end()
  console.log("\n==================================================================")
  console.log("   REAL CLOUDINARY UPLOAD & SUPABASE INTEGRATION TEST COMPLETED!  ")
  console.log("==================================================================")
}

runRealUploadTest().catch(err => {
  console.error("Test failed:", err)
  process.exit(1)
})
