import Link from "next/link"
import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser, isCurrentUserAdmin, getUserRole } from "@/lib/auth/roles"
import { SettingsForm } from "./settings-form"
import { ChevronRight } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function AccountSettingsPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login?redirect=/account/settings")
  }

  const isAdmin = await isCurrentUserAdmin()
  const role = await getUserRole(user.id)
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle()

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F5F2]">
      <Header
        user={{ id: user.id, email: user.email, name: profile?.full_name || user.user_metadata?.full_name }}
        isAdmin={isAdmin}
      />

      <main className="flex-1 max-w-[680px] w-full mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-6">
        <nav className="flex items-center gap-2 text-xs text-neutral-500 mb-2">
          <Link href="/account" className="hover:text-black">Account</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-neutral-900 font-semibold">Settings</span>
        </nav>

        <div className="border-b border-black/[0.06] pb-4">
          <h1 className="font-serif text-3xl font-bold text-neutral-900">
            Account Settings
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Manage your personal profile details and contact information.
          </p>
        </div>

        <SettingsForm
          initialName={profile?.full_name || user.user_metadata?.full_name || ""}
          initialPhone={profile?.phone || ""}
          initialBio={profile?.bio || ""}
          email={user.email || ""}
          role={role}
        />
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  )
}
