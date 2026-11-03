import { v2 as cloudinary } from "cloudinary"

const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "HiddenBooks"
const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || "228644729657845"
const apiSecret = process.env.CLOUDINARY_API_SECRET || "rUU56GqqG1wZbmqE4MHkN9sqLvM"

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
})

console.log("Testing Cloudinary connection with:")
console.log(`- Cloud Name: ${cloudName}`)
console.log(`- API Key: ${apiKey}`)
console.log(`- API Secret length: ${apiSecret.length}`)

async function testConnection() {
  try {
    const res = await cloudinary.api.ping()
    console.log("PASS [Cloudinary Ping]:", res)
  } catch (err) {
    console.error("FAIL [Cloudinary Ping]:", err)
    process.exit(1)
  }
}

testConnection()
