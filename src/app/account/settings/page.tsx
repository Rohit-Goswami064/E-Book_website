import Link from "next/link"
import { redirect } from "next/navigation"
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
    <div className="space-y-4 sm:space-y-5 max-w-2xl">
      <div className="border-b border-neutral-200/80 pb-3.5">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
          Account Settings
        </h1>
        <p className="text-xs text-neutral-500 mt-0.5">
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
    </div>
  )
}
