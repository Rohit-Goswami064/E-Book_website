import Link from "next/link"
import { redirect } from "next/navigation"
import { getCurrentUser, isCurrentUserAdmin, getUserRole } from "@/lib/auth/roles"
import { ShieldAlert } from "lucide-react"
import { AdminLayoutShell } from "@/components/admin/admin-layout-shell"

export const dynamic = "force-dynamic"

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login?redirect=/super-admin")
  }

  const isAdmin = await isCurrentUserAdmin()
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl bg-white border border-neutral-200 p-8 text-center shadow-md space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-neutral-900">
            Administrative Access Denied
          </h1>
          <p className="text-xs text-neutral-500 leading-relaxed">
            Your account ({user.email}) does not possess Super Admin privileges. Administrative routes require explicit server-side role assignment.
          </p>
          <div className="pt-2">
            <Link href="/">
              <button className="px-5 py-2.5 rounded-lg bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition">
                Return to Public Store
              </button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const role = await getUserRole(user.id)
  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Admin"

  return (
    <AdminLayoutShell
      user={{
        id: user.id,
        email: user.email,
        role: role,
        name: displayName,
      }}
    >
      {children}
    </AdminLayoutShell>
  )
}
