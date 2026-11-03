import http from "http"

async function run() {
  console.log("=== TESTING /api/books/[id]/pdf-stream ===")
  const bookId = "8c0456eb-4456-4a01-acc3-c66127b08267"

  // 1. Unauthenticated test (should return 401 or 403)
  console.log("\n[1] Testing unauthenticated request to /api/books/" + bookId + "/pdf-stream...")
  const resUnauth = await new Promise((resolve, reject) => {
    http.get(`http://localhost:3000/api/books/${bookId}/pdf-stream`, (res) => {
      let body = ""
      res.on("data", c => body += c)
      res.on("end", () => resolve({ status: res.statusCode, body }))
    }).on("error", reject)
  })

  console.log("Unauthenticated response status:", resUnauth.status)
  console.log("Body:", resUnauth.body)
  if (resUnauth.status !== 401 && resUnauth.status !== 403) {
    throw new Error("Expected 401 or 403 for unauthenticated request!")
  }
  console.log("PASS: Unauthenticated access is properly blocked!")
}

run().catch(console.error)
