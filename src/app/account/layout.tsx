import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser, isCurrentUserAdmin, getUserRole } from "@/lib/auth/roles"
import { UserLayoutShell } from "@/components/account/user-layout-shell"

export const dynamic = "force-dynamic"

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login?redirect=/account")
  }

  const isAdmin = await isCurrentUserAdmin()
  const role = await getUserRole(user.id)

  // Security Policy: Super Admin & Admin are strictly redirected to /super-admin and cannot open reader user dashboard
  if (isAdmin || role === "super_admin" || role === "admin") {
    redirect("/super-admin")
  }

  const supabase = await createClient()

  // 1. Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle()

  // 2. Fetch count of user's active library books
  const { count: libraryCount } = await supabase
    .from("book_entitlements")
    .select("id", { count: "exact" })
    .eq("user_id", user.id)
    .eq("is_revoked", false)

  // 3. Fetch count of orders
  const { count: orderCount } = await supabase
    .from("orders")
    .select("id", { count: "exact" })
    .eq("user_id", user.id)

  const displayName = profile?.full_name || user.user_metadata?.full_name || "Reader"

  return (
    <UserLayoutShell
      user={{
        id: user.id,
        email: user.email,
        name: displayName,
        avatar_url: profile?.avatar_url,
      }}
      libraryCount={libraryCount || 0}
      orderCount={orderCount || 0}
    >
      {children}
    </UserLayoutShell>
  )
}

