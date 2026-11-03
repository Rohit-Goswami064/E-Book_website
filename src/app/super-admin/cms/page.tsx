"use client"

import * as React from "react"
import { Eye, EyeOff, Save, LayoutTemplate, Settings, FileText, ArrowUp, ArrowDown, Film, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { toast } from "sonner"
import { CloudinaryUpload } from "@/components/admin/cloudinary-upload"

interface Section {
  id: string
  section_key: string
  title: string
  subtitle: string | null
  is_active: boolean
  display_order: number
}

interface SiteSetting {
  id: string
  key: string
  value: string
}

interface CMSPage {
  id: string
  slug: string
  title: string
  content: string
  seo_title: string | null
  seo_description: string | null
  is_published: boolean
}

export default function AdminCMSPage() {
  const [sections, setSections] = React.useState<Section[]>([])
  const [settings, setSettings] = React.useState<SiteSetting[]>([])
  const [pages, setPages] = React.useState<CMSPage[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedPage, setSelectedPage] = React.useState<CMSPage | null>(null)
  const [saving, setSaving] = React.useState(false)

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/cms")
      const data = await res.json()
      if (res.ok) {
        setSections(data.sections || [])
        setSettings(data.settings || [])
        setPages(data.pages || [])
        if (data.pages?.length > 0 && !selectedPage) {
          setSelectedPage(data.pages[0])
        }
      } else {
        toast.error(data.error || "Failed to load CMS data")
      }
    } catch {
      toast.error("Network error loading CMS")
    } finally {
      setLoading(false)
    }
  }, [selectedPage])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleSectionActive = async (sec: Section) => {
    try {
      const res = await fetch("/api/admin/cms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "section",
          payload: {
            ...sec,
            is_active: !sec.is_active,
          },
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Section "${sec.title}" visibility updated`)
        fetchData()
      } else {
        toast.error(data.error || "Failed to update section")
      }
    } catch {
      toast.error("Update request failed")
    }
  }

  const handleSaveSetting = async (key: string, value: string) => {
    try {
      setSaving(true)
      const res = await fetch("/api/admin/cms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "setting",
          payload: { key, value },
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Setting updated`)
        fetchData()
      } else {
        toast.error(data.error || "Failed to save setting")
      }
    } catch {
      toast.error("Save failed")
    } finally {
      setSaving(false)
    }
  }

  const handleSavePage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPage) return

    try {
      setSaving(true)
      const res = await fetch("/api/admin/cms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "page",
          payload: selectedPage,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Page "${selectedPage.title}" updated`)
        fetchData()
      } else {
        toast.error(data.error || "Failed to save page")
      }
    } catch {
      toast.error("Save failed")
    } finally {
      setSaving(false)
    }
  }

  const getSettingVal = (key: string) => settings.find((s) => s.key === key)?.value || ""

  return (
    <div className="h-full flex flex-col p-6 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 font-serif">
          CMS & Homepage Content
        </h1>
        <p className="text-xs text-neutral-500">
          Control homepage section visibility, site-wide announcements, and legal policy pages.
        </p>
      </div>

      <Tabs defaultValue="sections" className="flex-1 flex flex-col">
        <TabsList className="w-full sm:w-auto self-start mb-4">
          <TabsTrigger value="sections" className="text-xs gap-1.5">
            <LayoutTemplate className="h-3.5 w-3.5" /> Homepage Sections
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Site Settings & Banner
          </TabsTrigger>
          <TabsTrigger value="pages" className="text-xs gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Legal & Policy Pages
          </TabsTrigger>
          <TabsTrigger value="media" className="text-xs gap-1.5">
            <Film className="h-3.5 w-3.5" /> Promotional Media & Banners
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Homepage Sections */}
        <TabsContent value="sections" className="flex-1 overflow-auto">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-xs divide-y divide-neutral-100">
            {loading ? (
              <div className="p-8 text-center text-xs text-neutral-400">Loading homepage modules...</div>
            ) : (
              sections.map((sec) => (
                <div
                  key={sec.id}
                  className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-neutral-50/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] bg-neutral-100 px-2 py-0.5 rounded text-neutral-600">
                        #{sec.display_order} {sec.section_key}
                      </span>
                      <h4 className="font-serif font-bold text-neutral-900 text-sm">{sec.title}</h4>
                    </div>
                    {sec.subtitle && <p className="text-xs text-neutral-500">{sec.subtitle}</p>}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant={sec.is_active ? "outline" : "secondary"}
                      size="sm"
                      onClick={() => toggleSectionActive(sec)}
                      className={`h-8 text-xs gap-1.5 ${
                        sec.is_active ? "text-emerald-700 border-emerald-200 bg-emerald-50" : "text-neutral-500"
                      }`}
                    >
                      {sec.is_active ? (
                        <>
                          <Eye className="h-3.5 w-3.5" /> Visible on Homepage
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3.5 w-3.5" /> Hidden
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* Tab 2: Site Settings */}
        <TabsContent value="settings" className="flex-1 overflow-auto">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-xs p-5 max-w-2xl space-y-4">
            <h3 className="font-serif font-bold text-sm text-neutral-900">Brand & Support Configuration</h3>

            <div>
              <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
                Announcement Top Bar Text
              </label>
              <div className="flex gap-2">
                <Input
                  defaultValue={getSettingVal("announcement_text")}
                  id="setting_announcement"
                  className="h-8 text-xs"
                  placeholder="e.g. Free pan-India delivery on physical prints. Instant digital delivery."
                />
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    const el = document.getElementById("setting_announcement") as HTMLInputElement
                    handleSaveSetting("announcement_text", el?.value || "")
                  }}
                >
                  Save
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
                Support WhatsApp Number
              </label>
              <div className="flex gap-2">
                <Input
                  defaultValue={getSettingVal("support_whatsapp")}
                  id="setting_whatsapp"
                  className="h-8 text-xs font-mono"
                  placeholder="919876543210"
                />
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    const el = document.getElementById("setting_whatsapp") as HTMLInputElement
                    handleSaveSetting("support_whatsapp", el?.value || "")
                  }}
                >
                  Save
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
                Customer Support Email
              </label>
              <div className="flex gap-2">
                <Input
                  defaultValue={getSettingVal("support_email")}
                  id="setting_email"
                  className="h-8 text-xs font-mono"
                  placeholder="support@hiddenbooks.com"
                />
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    const el = document.getElementById("setting_email") as HTMLInputElement
                    handleSaveSetting("support_email", el?.value || "")
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab: Promotional Media & Banners */}
        <TabsContent value="media" className="flex-1 overflow-auto">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-xs p-6 max-w-3xl space-y-6">
            <div>
              <h3 className="font-serif font-bold text-base text-neutral-900">Cloudinary Promotional Media Management</h3>
              <p className="text-xs text-neutral-500 mt-1">
                Upload and configure homepage promotional banners and showcase video trailers hosted on Cloudinary CDN.
              </p>
            </div>

            {/* Homepage Banner Section */}
            <div className="p-4 rounded-xl border border-neutral-100 bg-neutral-50/50 space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-neutral-900">Homepage Hero / Promotional Banner</h4>
                <p className="text-xs text-neutral-500">Wide promotional campaign banner displayed on the homepage showcase.</p>
              </div>
              <CloudinaryUpload
                value={getSettingVal("homepage_banner_url")}
                onChange={(url) => handleSaveSetting("homepage_banner_url", url)}
                onRemove={() => handleSaveSetting("homepage_banner_url", "")}
                assetType="homepage_banner"
                label="Promotional Hero Banner"
                description="Recommended size: 1920x600px, 21:9 or 16:5 aspect ratio"
                aspectRatio="banner"
              />
            </div>

            {/* Promotional Video Section */}
            <div className="p-4 rounded-xl border border-neutral-100 bg-neutral-50/50 space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-neutral-900">Public Promotional Video Trailer</h4>
                <p className="text-xs text-neutral-500">Video book trailer or author interview displayed in the public showcase section.</p>
              </div>
              <CloudinaryUpload
                value={getSettingVal("promo_video_url")}
                onChange={(url) => handleSaveSetting("promo_video_url", url)}
                onRemove={() => handleSaveSetting("promo_video_url", "")}
                assetType="promo_video"
                label="Promotional Video Trailer"
                description="Upload MP4 or WebM up to 100MB with direct Cloudinary video streaming"
                aspectRatio="video"
              />
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Policy & Legal Pages */}
        <TabsContent value="pages" className="flex-1 overflow-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Page selection column */}
            <div className="bg-white rounded-lg border border-neutral-200 shadow-xs p-3 space-y-1">
              <h4 className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 mb-2 px-2">
                Select Page to Edit
              </h4>
              {pages.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPage(p)}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    selectedPage?.id === p.id
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-700 hover:bg-neutral-100"
                  }`}
                >
                  {p.title}
                  <span className="block text-[10px] font-mono opacity-70">/{p.slug}</span>
                </button>
              ))}
            </div>

            {/* Page editor */}
            {selectedPage && (
              <form onSubmit={handleSavePage} className="md:col-span-3 bg-white rounded-lg border border-neutral-200 shadow-xs p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                  <div>
                    <h3 className="font-serif font-bold text-base text-neutral-900">
                      Editing: {selectedPage.title}
                    </h3>
                    <span className="font-mono text-[11px] text-neutral-400">/{selectedPage.slug}</span>
                  </div>
                  <Button type="submit" size="sm" disabled={saving} className="h-8 text-xs gap-1.5">
                    <Save className="h-3.5 w-3.5" />
                    {saving ? "Saving..." : "Save Policy Page"}
                  </Button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
                    Page Title
                  </label>
                  <Input
                    value={selectedPage.title}
                    onChange={(e) => setSelectedPage({ ...selectedPage, title: e.target.value })}
                    className="h-8 text-xs font-serif"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
                    Page Content (HTML / Markdown)
                  </label>
                  <Textarea
                    value={selectedPage.content}
                    onChange={(e) => setSelectedPage({ ...selectedPage, content: e.target.value })}
                    rows={14}
                    className="font-mono text-xs leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">SEO Title</label>
                    <Input
                      value={selectedPage.seo_title || ""}
                      onChange={(e) => setSelectedPage({ ...selectedPage, seo_title: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">SEO Description</label>
                    <Input
                      value={selectedPage.seo_description || ""}
                      onChange={(e) => setSelectedPage({ ...selectedPage, seo_description: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </form>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
