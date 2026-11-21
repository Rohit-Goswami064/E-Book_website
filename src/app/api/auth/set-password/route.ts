import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/roles"
import { dbQuery } from "@/lib/db"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

export const dynamic = "force-dynamic"

const setPasswordSchema = z.object({
  password: z
    .string()
    .min(6, "Password must be at least 6 characters"),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: "Please log in to set or update your password." },
        { status: 401 }
      )
    }

    const body = await request.json()
    const parsed = setPasswordSchema.safeParse(body)
    if (!parsed.success) {
      const errorMsg = parsed.error.issues?.[0]?.message || "Invalid password"
      return NextResponse.json({ error: errorMsg }, { status: 400 })
    }

    const { password } = parsed.data

    // 1. Update GoTrue user using Admin Client
    try {
      const admin = createAdminClient()
      await admin.auth.admin.updateUserById(user.id, {
        password,
        user_metadata: {
          ...(user.user_metadata || {}),
          is_temp_password: false,
        },
      })
    } catch (adminErr: any) {
      console.warn("[Admin updateUserById notice]:", adminErr?.message)
    }

    // 2. Direct PostgreSQL update with bcrypt blowfish hash for complete consistency
    await dbQuery(
      `
      UPDATE auth.users 
      SET 
        encrypted_password = extensions.crypt($1::text, extensions.gen_salt('bf', 10)),
        raw_user_meta_data = jsonb_set(
          COALESCE(raw_user_meta_data, '{}'::jsonb),
          '{is_temp_password}',
          'false'::jsonb
        ),
        updated_at = now()
      WHERE id = $2::uuid;
      `,
      [password, user.id]
    )

    return NextResponse.json({
      success: true,
      message: "Your password has been set successfully.",
    })
  } catch (error: any) {
    console.error("[Set Password Error]:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to update password. Please try again." },
      { status: 500 }
    )
  }
}

