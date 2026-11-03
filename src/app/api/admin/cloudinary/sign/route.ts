import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/roles"
import { generateSignedUploadParams, CLOUDINARY_FOLDER_MAP } from "@/lib/cloudinary/server"
import type { CloudinaryAssetType } from "@/types/media"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    // 1. Authorize: Only authenticated Super Admins or Admins can request signatures
    const user = await getCurrentUser()
    const isAdmin = await isCurrentUserAdmin()

    if (!user || !isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized: Super Admin or Administrator privileges required to upload media." },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const assetType = (body.assetType || "other") as CloudinaryAssetType

    if (!CLOUDINARY_FOLDER_MAP[assetType]) {
      return NextResponse.json(
        {
          error: `Invalid assetType '${assetType}'. Permitted types: ${Object.keys(CLOUDINARY_FOLDER_MAP).join(", ")}`,
        },
        { status: 400 }
      )
    }

    const tags = Array.isArray(body.tags) ? body.tags.filter((t: any) => typeof t === "string") : undefined

    // 2. Generate signed parameters
    const params = generateSignedUploadParams(assetType, { tags })

    return NextResponse.json({
      success: true,
      params,
    })
  } catch (error: any) {
    console.error("Error generating Cloudinary upload signature:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate upload signature" },
      { status: 500 }
    )
  }
}
