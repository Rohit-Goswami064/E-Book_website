"use client"

import * as React from "react"
import { Plus, Edit2, Trash2, User, BookOpen, Globe, AtSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"
import { CloudinaryUpload } from "@/components/admin/cloudinary-upload"

interface Author {
  id: string
  name: string
  slug: string
  bio: string | null
  avatar_url: string | null
  website_url: string | null
  twitter_handle: string | null
  book_count?: number
}

export default function AdminAuthorsPage() {
  const [authors, setAuthors] = React.useState<Author[]>([])
  const [loading, setLoading] = React.useState(true)
  const [modalOpen, setModalOpen] = React.useState(false)
  const [editingAuthor, setEditingAuthor] = React.useState<Author | null>(null)
  const [name, setName] = React.useState("")
  const [slug, setSlug] = React.useState("")
  const [bio, setBio] = React.useState("")
  const [avatarUrl, setAvatarUrl] = React.useState("")
  const [websiteUrl, setWebsiteUrl] = React.useState("")
  const [twitterHandle, setTwitterHandle] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  const fetchAuthors = React.useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/authors")
      const data = await res.json()
      if (res.ok) {
        setAuthors(data.authors || [])
      } else {
        toast.error(data.error || "Failed to load authors")
      }
    } catch {
      toast.error("Network error loading authors")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchAuthors()
  }, [fetchAuthors])

  const openCreate = () => {
    setEditingAuthor(null)
    setName("")
    setSlug("")
    setBio("")
    setAvatarUrl("")
    setWebsiteUrl("")
    setTwitterHandle("")
    setModalOpen(true)
  }

  const openEdit = (author: Author) => {
    setEditingAuthor(author)
    setName(author.name)
    setSlug(author.slug)
    setBio(author.bio || "")
    setAvatarUrl(author.avatar_url || "")
    setWebsiteUrl(author.website_url || "")
    setTwitterHandle(author.twitter_handle || "")
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Author name is required")
      return
    }

    try {
      setSaving(true)
      const method = editingAuthor ? "PUT" : "POST"
      const res = await fetch("/api/admin/authors", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingAuthor?.id,
          name,
          slug,
          bio,
          avatar_url: avatarUrl,
          website_url: websiteUrl,
          twitter_handle: twitterHandle,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        toast.success(editingAuthor ? "Author updated" : "Author created")
        setModalOpen(false)
        fetchAuthors()
      } else {
        toast.error(data.error || "Failed to save author")
      }
    } catch {
      toast.error("Save request failed")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (author: Author) => {
    if (!confirm(`Are you sure you want to delete author "${author.name}"?`)) return

    try {
      const res = await fetch(`/api/admin/authors?id=${author.id}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("Author deleted")
        fetchAuthors()
      } else {
        toast.error(data.error || "Cannot delete author")
      }
    } catch {
      toast.error("Delete request failed")
    }
  }

  return (
    <div className="h-full flex flex-col p-6 space-y-4">
      {/* Header - Compact */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 font-serif">Authors</h1>
          <p className="text-xs text-neutral-500">Manage writers, bios, external credentials, and book links.</p>
        </div>
        <Button size="sm" onClick={openCreate} className="h-8 text-xs gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Author
        </Button>
      </div>

      {/* Authors Table */}
      <div className="flex-1 bg-white rounded-lg border border-neutral-200 shadow-xs overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-neutral-50/80 sticky top-0 z-10 border-b border-neutral-200 text-neutral-600 font-mono uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Author</th>
                <th className="py-2.5 px-4 font-semibold">Slug</th>
                <th className="py-2.5 px-4 font-semibold">Bio</th>
                <th className="py-2.5 px-4 font-semibold">Social / Web</th>
                <th className="py-2.5 px-4 font-semibold text-center">Published Books</th>
                <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-400">
                    Loading authors...
                  </td>
                </tr>
              ) : authors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-500">
                    <p className="font-medium text-sm text-neutral-700">No authors found</p>
                    <p className="text-xs text-neutral-400 mt-1">Create authors to link them with published books.</p>
                  </td>
                </tr>
              ) : (
                authors.map((a) => (
                  <tr key={a.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center font-bold text-xs uppercase overflow-hidden">
                          {a.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.avatar_url} alt={a.name} className="h-full w-full object-cover" />
                          ) : (
                            <User className="h-3.5 w-3.5 text-neutral-500" />
                          )}
                        </div>
                        <span className="font-medium text-neutral-900">{a.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-500 text-[11px]">{a.slug}</td>
                    <td className="py-3 px-4 text-neutral-600 max-w-sm truncate">{a.bio || "—"}</td>
                    <td className="py-3 px-4 text-neutral-500">
                      <div className="flex items-center gap-2">
                        {a.website_url && (
                          <a href={a.website_url} target="_blank" rel="noreferrer" title="Website" className="text-neutral-500 hover:text-neutral-900">
                            <Globe className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {a.twitter_handle && (
                          <span className="font-mono text-[11px] text-neutral-600">@{a.twitter_handle}</span>
                        )}
                        {!a.website_url && !a.twitter_handle && "—"}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-neutral-700">
                      <span className="inline-flex items-center gap-1 bg-neutral-100 px-2 py-0.5 rounded text-[11px]">
                        <BookOpen className="h-3 w-3" />
                        {a.book_count || 0}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => openEdit(a)}
                          title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5 text-neutral-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(a)}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-2 border-t border-neutral-100 bg-neutral-50/50 text-right text-[11px] text-neutral-500 font-mono px-4">
          Total: {authors.length} authors
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-serif font-bold">
                {editingAuthor ? "Edit Author" : "New Author"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-700 font-medium mb-1">Name</label>
                <Input
                  required
                  placeholder="e.g. Marcus Aurelius"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="block text-neutral-700 font-medium mb-1">Slug</label>
                <Input
                  placeholder="e.g. marcus-aurelius"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-neutral-700 font-medium mb-1">Bio</label>
                <Textarea
                  placeholder="Author biography, philosophical background, credentials..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="text-xs min-h-[60px]"
                />
              </div>

              <div className="pt-2 border-t border-neutral-100">
                <CloudinaryUpload
                  value={avatarUrl}
                  onChange={(url) => setAvatarUrl(url)}
                  onRemove={() => setAvatarUrl("")}
                  assetType="author_avatar"
                  label="Author Profile Photo"
                  description="Upload circular avatar photo to Cloudinary CDN"
                  aspectRatio="avatar"
                  entityId={{ author_id: editingAuthor?.id }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-neutral-700 font-medium mb-1">Website URL</label>
                  <Input
                    placeholder="https://..."
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-neutral-700 font-medium mb-1">Twitter Handle</label>
                  <Input
                    placeholder="handle (without @)"
                    value={twitterHandle}
                    onChange={(e) => setTwitterHandle(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? "Saving..." : editingAuthor ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
