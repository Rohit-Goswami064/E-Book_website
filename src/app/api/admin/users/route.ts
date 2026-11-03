import { NextResponse } from "next/server"
import { isCurrentUserAdmin, isCurrentUserSuperAdmin, getCurrentUser } from "@/lib/auth/roles"
import { getAdminUsersList } from "@/lib/db/admin-queries"
import { dbQuery } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const isAdmin = await isCurrentUserAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const roleFilter = searchParams.get("role")
    const search = searchParams.get("search")
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)))
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10))

    const { users, total } = await getAdminUsersList({
      role: roleFilter,
      search,
      limit,
      offset,
    })

    return NextResponse.json({
      users,
      total,
      limit,
      offset,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    console.error("[Admin Users API Error]:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const isSuperAdmin = await isCurrentUserSuperAdmin()
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: "Only Super Administrators can modify user roles" },
        { status: 403 }
      )
    }

    const currentUser = await getCurrentUser()
    const body = await request.json()
    const { userId, role } = body

    if (!userId || !["customer", "admin", "super_admin"].includes(role)) {
      return NextResponse.json({ error: "Invalid role or userId" }, { status: 400 })
    }

    // Upsert role in PostgreSQL
    await dbQuery(
      `
      INSERT INTO public.user_roles (user_id, role, assigned_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, role)
      DO UPDATE SET assigned_by = $3;
      `,
      [userId, role, currentUser?.id || null]
    )

    // Remove other roles for this user to ensure single clean role
    await dbQuery(
      `DELETE FROM public.user_roles WHERE user_id = $1 AND role <> $2;`,
      [userId, role]
    )

    // Record in audit log
    await dbQuery(
      `
      INSERT INTO public.audit_logs (admin_user_id, action, resource_type, resource_id, details)
      VALUES ($1, 'UPDATE_USER_ROLE', 'user_roles', $2, $3);
      `,
      [
        currentUser?.id || null,
        userId,
        JSON.stringify({ new_role: role, target_user: userId, updated_at: new Date().toISOString() }),
      ]
    )

    return NextResponse.json({ success: true, message: `Role updated to ${role}` })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    console.error("[Admin Users PATCH Error]:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
