import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { UserRole } from "@/types/database"

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function getUserRole(userId: string): Promise<UserRole> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle()

  return ((data as any)?.role as UserRole) || "customer"
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
  const supabase = await createClient()
  const { data } = await supabase
    .from("book_entitlements")
    .select("id")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .eq("is_revoked", false)
    .maybeSingle()

  return !!data
}
