import Link from "next/link"
import { redirect } from "next/navigation"
import { getCurrentUser, isCurrentUserAdmin, getUserRole } from "@/lib/auth/roles"
import {
  LayoutDashboard,
  BookOpen,
  ShoppingBag,
  Users,
  FileText,
  Tags,
  Percent,
  Sliders,
  BarChart3,
  ShieldAlert,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react"

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
      <div className="min-h-screen bg-[#F6F5F2] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-[32px] bg-white border border-black/10 p-8 text-center shadow-lg space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-neutral-900">
            Administrative Access Denied
          </h1>
          <p className="text-xs text-neutral-600 leading-relaxed">
            Your account ({user.email}) does not possess Super Admin privileges. Administrative routes require explicit server-side role assignment.
          </p>
          <div className="pt-2">
            <Link href="/">
              <button className="px-6 py-2.5 rounded-full bg-[#111111] text-white text-xs font-bold">
                Return to Public Store
              </button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const role = await getUserRole(user.id)

  const adminNav = [
    { name: "Overview", href: "/super-admin", icon: LayoutDashboard },
    { name: "Books", href: "/super-admin/books", icon: BookOpen },
    { name: "Orders & Payments", href: "/super-admin/orders", icon: ShoppingBag },
    { name: "Users & Roles", href: "/super-admin/users", icon: Users },
    { name: "Editorial Blog", href: "/super-admin/blog", icon: FileText },
    { name: "Categories", href: "/super-admin/categories", icon: Tags },
    { name: "Authors", href: "/super-admin/authors", icon: Users },
    { name: "Coupons", href: "/super-admin/coupons", icon: Percent },
    { name: "Homepage CMS", href: "/super-admin/cms", icon: Sliders },
    { name: "Analytics", href: "/super-admin/analytics", icon: BarChart3 },
  ]

  return (
    <div className="min-h-screen bg-[#F6F5F2] flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-black/[0.08] p-5 flex flex-col justify-between shrink-0">
        <div className="space-y-6">
          {/* Logo & Store link */}
          <div className="flex items-center justify-between pb-4 border-b border-black/[0.06]">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#111111] text-white flex items-center justify-center font-serif text-sm font-bold">
                H
              </div>
              <div>
                <span className="font-serif text-lg font-bold tracking-tight text-[#111111] block leading-none">
                  HiddenBooks
                </span>
                <span className="text-[9px] font-bold tracking-wider uppercase text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-full mt-0.5 inline-block">
                  Admin Control
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {adminNav.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-700 hover:text-black hover:bg-neutral-100 transition"
                >
                  <Icon className="w-4 h-4 text-neutral-500" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Footer Admin User Byline */}
        <div className="pt-4 border-t border-black/[0.06] space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#111111] text-white flex items-center justify-center text-xs font-bold font-serif">
              {user.email?.charAt(0).toUpperCase()}
            </div>
            <div className="truncate">
              <div className="text-xs font-bold text-neutral-900 truncate">{user.email}</div>
              <div className="text-[10px] text-neutral-500 font-mono uppercase">{role}</div>
            </div>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-black pt-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Storefront</span>
          </Link>
        </div>
      </aside>

      {/* Main Admin Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
