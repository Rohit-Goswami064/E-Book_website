import { S3Client, ListBucketsCommand, ListObjectsV2Command, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"

const accountId = process.env.R2_ACCOUNT_ID
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const bucketName = process.env.R2_BUCKET_NAME || "hiddenbooks-private"
const endpoint = process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`

console.log("Testing Cloudflare R2 Connection...")
console.log("Bucket:", bucketName)
console.log("Endpoint:", endpoint)
console.log("AccessKeyId prefix:", accessKeyId?.slice(0, 6) + "...")

const client = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId: accessKeyId || "",
    secretAccessKey: secretAccessKey || "",
  },
})

async function test() {
  try {
    // 1. List objects or test bucket access
    console.log(`Checking bucket '${bucketName}'...`)
    const listRes = await client.send(new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 5,
    }))
    console.log("Bucket access OK! Existing objects count in bucket:", listRes.KeyCount || 0)
    if (listRes.Contents) {
      console.log("Objects:", listRes.Contents.map(c => ({ key: c.Key, size: c.Size })))
    }

    // 2. Test uploading a small test file
    const testKey = `_test/connectivity_check_${Date.now()}.txt`
    console.log(`Writing test object: ${testKey}...`)
    await client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: testKey,
      Body: "HiddenBooks Cloudflare R2 verification payload",
      ContentType: "text/plain",
    }))
    console.log("PutObject successful!")

    // 3. Test reading the test file back
    console.log("Reading test object back...")
    const getRes = await client.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: testKey,
    }))
    const bodyStr = await getRes.Body.transformToString()
    console.log("Read payload match:", bodyStr === "HiddenBooks Cloudflare R2 verification payload")

    // 4. Clean up test object
    console.log("Deleting test object...")
    await client.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: testKey,
    }))
    console.log("Test object deleted. Cloudflare R2 verified successfully!")
  } catch (err) {
    console.error("R2 Error:", err)
  }
}

test()
