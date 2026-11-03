import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

const bootstrapSchema = z.object({
  email: z.string().email(),
  secretToken: z.string().min(8),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = bootstrapSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { email, secretToken } = result.data
    const serverSecret = process.env.ADMIN_BOOTSTRAP_SECRET

    if (!serverSecret || secretToken !== serverSecret) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid bootstrap secret token" },
        { status: 401 }
      )
    }

    const admin = createAdminClient()

    // Find user profile by email
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, email, full_name")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "User account not found. Please register this email first via the sign-up page." },
        { status: 404 }
      )
    }

    // Upsert role to super_admin
    const { error: roleError } = await admin
      .from("user_roles")
      .upsert(
        {
          user_id: profile.id,
          role: "super_admin",
          assigned_by: profile.id,
        },
        { onConflict: "user_id,role" }
      )

    if (roleError) {
      return NextResponse.json(
        { error: "Failed to assign super_admin role", details: roleError.message },
        { status: 500 }
      )
    }

    // Record in audit log
    await admin.from("audit_logs").insert({
      admin_user_id: profile.id,
      action: "BOOTSTRAP_SUPER_ADMIN",
      resource_type: "user_roles",
      resource_id: profile.id,
      details: { email: profile.email, timestamp: new Date().toISOString() },
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
    })

    return NextResponse.json({
      success: true,
      message: `Super Admin role successfully assigned to ${profile.email}`,
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.full_name,
        role: "super_admin",
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error during bootstrap" },
      { status: 500 }
    )
  }
}
