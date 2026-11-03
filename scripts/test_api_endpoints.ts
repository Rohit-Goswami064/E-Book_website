import http from "http"

async function testApi() {
  console.log("Testing POST http://localhost:3000/api/admin/cloudinary/sign without auth:")
  
  const unauthRes = await fetch("http://localhost:3000/api/admin/cloudinary/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assetType: "book_cover" }),
  })
  
  console.log(`Status: ${unauthRes.status} (Expected: 403 Forbidden)`)
  const unauthBody = await unauthRes.json()
  console.log("Response:", unauthBody)

  if (unauthRes.status === 403) {
    console.log("PASS: Unauthorized request properly denied with 403!")
  } else {
    console.error("FAIL: Expected 403 but got", unauthRes.status)
  }
}

testApi().catch(console.error)
