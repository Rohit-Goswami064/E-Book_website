import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs"
import { createPresignedDownloadUrl } from "../src/lib/storage/r2.ts"

async function run() {
  const objectKey = "publications/8c0456eb-4456-4a01-acc3-c66127b08267/pdf/1793184936219_shant_dimage-bok.pdf"
  const url = await createPresignedDownloadUrl({
    objectKey,
    filename: "shant dimagE-Bok.pdf",
    inline: true,
    expiresInSeconds: 300,
  })

  const loadingTask = pdfjsLib.getDocument({ url })
  const pdfDoc = await loadingTask.promise
  console.log("Total Pages:", pdfDoc.numPages)

  for (let p = 1; p <= 5; p++) {
    const page = await pdfDoc.getPage(p)
    const textContent = await page.getTextContent()
    const text = textContent.items.map(i => i.str).join(" ")
    console.log(`Page ${p} text (${textContent.items.length} items):`, text.slice(0, 120))
  }
}

run().catch(console.error)
