import { getAdminOverviewMetrics } from "@/lib/db/admin-queries"
import { getCurrentUser } from "@/lib/auth/roles"
import { EcommerceDashboardView } from "@/components/admin/dashboard/ecommerce-dashboard-view"

export const dynamic = "force-dynamic"

export default async function SuperAdminOverviewPage() {
  const [stats, user] = await Promise.all([
    getAdminOverviewMetrics(),
    getCurrentUser(),
  ])

  const adminName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Toby"

  return <EcommerceDashboardView stats={stats} adminName={adminName} />
}
