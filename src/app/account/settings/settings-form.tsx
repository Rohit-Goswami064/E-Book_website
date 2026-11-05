"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Loader2, Save, User, Phone, Mail, Shield } from "lucide-react"

export function SettingsForm({
  initialName,
  initialPhone,
  initialBio,
  email,
  role,
}: {
  initialName: string
  initialPhone: string
  initialBio: string
  email: string
  role: string
}) {
  const router = useRouter()
  const [fullName, setFullName] = React.useState(initialName)
  const [phone, setPhone] = React.useState(initialPhone)
  const [bio, setBio] = React.useState(initialBio)
  const [saving, setSaving] = React.useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error("Not authenticated")
        return
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          bio: bio.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      if (error) {
        toast.error(error.message || "Failed to update profile.")
        return
      }

      toast.success("Profile updated successfully.")
      router.refresh()
    } catch {
      toast.error("An unexpected error occurred.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="rounded-xl bg-white border border-neutral-200/80 p-4 sm:p-5 space-y-4 shadow-2xs">
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
          Email Address
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
          <Input
            value={email}
            disabled
            className="pl-9 h-9 text-xs bg-neutral-100 cursor-not-allowed text-neutral-500 border-neutral-200"
          />
        </div>
        <p className="text-[10px] text-neutral-400 mt-1">Managed via authentication provider</p>
      </div>

      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
          Full Name
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
            className="pl-9 h-9 text-xs bg-white border-neutral-200"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
          Phone Number
        </label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            className="pl-9 h-9 text-xs bg-white border-neutral-200"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
          Short Reader Bio
        </label>
        <Textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="A brief note about your literary interests, favorite genres, or background..."
          className="min-h-[80px] text-xs bg-white border-neutral-200"
        />
      </div>

      <div className="pt-2 flex items-center justify-between border-t border-neutral-100">
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <Shield className="w-3.5 h-3.5 text-neutral-400" />
          <span>Role: <strong className="text-neutral-800">{role.toUpperCase()}</strong></span>
        </div>

        <Button
          type="submit"
          disabled={saving}
          size="sm"
          className="rounded-lg bg-neutral-900 text-white text-xs font-semibold h-8 px-4 hover:bg-neutral-800"
        >
          {saving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
