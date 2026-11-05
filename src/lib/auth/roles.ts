import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { dbQuery } from "@/lib/db"
import type { UserRole } from "@/types/database"

export async function getCurrentUser() {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null
    return user
  } catch {
    return null
  }
}

export async function getUserRole(userId: string): Promise<UserRole> {
  // 1. Authoritative direct DB check (resilient to missing request cookies)
  try {
    const roleRes = await dbQuery<{ role: UserRole }>(
      `SELECT role FROM public.user_roles WHERE user_id = $1 LIMIT 1;`,
      [userId]
    )
    if (roleRes.rows.length > 0) {
      return roleRes.rows[0].role
    }
  } catch {}

  // 2. Supabase server client fallback
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle()

    if (data) {
      return ((data as any)?.role as UserRole) || "customer"
    }
  } catch {}

  return "customer"
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false
  const role = await getUserRole(user.id)
  return role === "admin" || role === "super_admin"
}

export async function isCurrentUserSuperAdmin(): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false
  const role = await getUserRole(user.id)
  return role === "super_admin"
}

export async function checkBookEntitlement(userId: string, bookId: string): Promise<boolean> {
  // 1. Authoritative direct DB check
  try {
    const entRes = await dbQuery(
      `SELECT id FROM public.book_entitlements 
       WHERE user_id = $1 AND book_id = $2 AND is_revoked = false 
       LIMIT 1;`,
      [userId, bookId]
    )
    if (entRes.rows.length > 0) return true
  } catch {}

  // 2. Supabase server client fallback
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from("book_entitlements")
      .select("id")
      .eq("user_id", userId)
      .eq("book_id", bookId)
      .eq("is_revoked", false)
      .maybeSingle()

    return !!data
  } catch {}

  return false
}
