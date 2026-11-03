import { headR2Object, createPresignedDownloadUrl } from "../src/lib/storage/r2.ts"

async function run() {
  const objectKey = "publications/8c0456eb-4456-4a01-acc3-c66127b08267/pdf/1793184936219_shant_dimage-bok.pdf"
  console.log("Checking R2 object:", objectKey)
  try {
    const head = await headR2Object(objectKey)
    console.log("Head result:", head)

    const url = await createPresignedDownloadUrl({
      objectKey,
      filename: "shant dimagE-Bok.pdf",
      inline: true,
      expiresInSeconds: 300
    })
    console.log("Presigned URL generated:", url)

    // Try fetching the first 1KB of the URL
    const fetchRes = await fetch(url, { headers: { Range: "bytes=0-1024" } })
    console.log("Fetch status:", fetchRes.status, fetchRes.statusText)
    console.log("Content-Type:", fetchRes.headers.get("content-type"))
    console.log("Content-Disposition:", fetchRes.headers.get("content-disposition"))
    const text = await fetchRes.text()
    console.log("First 100 bytes:", text.slice(0, 100))
  } catch (err) {
    console.error("R2 Error:", err)
  }
}

run()
