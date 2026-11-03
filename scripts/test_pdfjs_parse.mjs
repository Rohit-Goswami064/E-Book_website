import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs"
import { headR2Object, createPresignedDownloadUrl } from "../src/lib/storage/r2.ts"

async function run() {
  const objectKey = "publications/8c0456eb-4456-4a01-acc3-c66127b08267/pdf/1793184936219_shant_dimage-bok.pdf"
  const url = await createPresignedDownloadUrl({
    objectKey,
    filename: "shant dimagE-Bok.pdf",
    inline: true,
    expiresInSeconds: 300,
  })

  console.log("Loading document with pdfjsLib...")
  const loadingTask = pdfjsLib.getDocument({ url, disableRange: false })
  const pdfDoc = await loadingTask.promise
  console.log("PDF loaded successfully!")
  console.log("Total Pages in 'shant dimagE-Bok.pdf':", pdfDoc.numPages)

  const page1 = await pdfDoc.getPage(1)
  console.log("Page 1 dimensions:", page1.getViewport({ scale: 1.0 }))
  const textContent = await page1.getTextContent()
  console.log("Page 1 text items count:", textContent.items.length)
  if (textContent.items.length > 0) {
    console.log("Sample text from Page 1:", textContent.items.slice(0, 5).map(item => item.str).join(" "))
  }

  // Get outline / TOC if present in PDF
  const outline = await pdfDoc.getOutline()
  console.log("PDF Outline / Bookmarks in PDF:", outline ? outline.length : "None")
}

run().catch(console.error)
