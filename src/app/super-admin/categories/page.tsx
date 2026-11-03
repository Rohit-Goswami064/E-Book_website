"use client"

import * as React from "react"
import { Plus, Edit2, Trash2, Tag, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  color_code: string
  display_order: number
  book_count?: number
}

const PALETTE_COLORS = [
  "#E8E0D6", // Sand
  "#DDE8E2", // Sage
  "#E2DFEB", // Lavender
  "#FDE9D9", // Peach
  "#DBE7FD", // Sky
  "#E8F5E9", // Mint / Free
  "#F2ECE4", // Warm Grey
]

export default function AdminCategoriesPage() {
  const [categories, setCategories] = React.useState<Category[]>([])
  const [loading, setLoading] = React.useState(true)
  const [modalOpen, setModalOpen] = React.useState(false)
  const [editingCategory, setEditingCategory] = React.useState<Category | null>(null)
  const [name, setName] = React.useState("")
  const [slug, setSlug] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [colorCode, setColorCode] = React.useState("#E8E0D6")
  const [displayOrder, setDisplayOrder] = React.useState(0)
  const [saving, setSaving] = React.useState(false)

  const fetchCategories = React.useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/categories")
      const data = await res.json()
      if (res.ok) {
        setCategories(data.categories || [])
      } else {
        toast.error(data.error || "Failed to load categories")
      }
    } catch {
      toast.error("Network error loading categories")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const openCreate = () => {
    setEditingCategory(null)
    setName("")
    setSlug("")
    setDescription("")
    setColorCode("#E8E0D6")
    setDisplayOrder(categories.length)
    setModalOpen(true)
  }

  const openEdit = (cat: Category) => {
    setEditingCategory(cat)
    setName(cat.name)
    setSlug(cat.slug)
    setDescription(cat.description || "")
    setColorCode(cat.color_code || "#E8E0D6")
    setDisplayOrder(cat.display_order)
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Category name is required")
      return
    }

    try {
      setSaving(true)
      const method = editingCategory ? "PUT" : "POST"
      const res = await fetch("/api/admin/categories", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingCategory?.id,
          name,
          slug,
          description,
          color_code: colorCode,
          display_order: Number(displayOrder),
        }),
      })

      const data = await res.json()
      if (res.ok) {
        toast.success(editingCategory ? "Category updated" : "Category created")
        setModalOpen(false)
        fetchCategories()
      } else {
        toast.error(data.error || "Failed to save category")
      }
    } catch {
      toast.error("Save request failed")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (cat: Category) => {
    if (!confirm(`Are you sure you want to delete category "${cat.name}"?`)) return

    try {
      const res = await fetch(`/api/admin/categories?id=${cat.id}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("Category deleted")
        fetchCategories()
      } else {
        toast.error(data.error || "Cannot delete category")
      }
    } catch {
      toast.error("Delete request failed")
    }
  }

  return (
    <div className="h-full flex flex-col p-6 space-y-4">
      {/* Header - Compact for 80/20 data table ratio */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 font-serif">Categories</h1>
          <p className="text-xs text-neutral-500">Curate store categories, color tags, and catalogue hierarchy.</p>
        </div>
        <Button size="sm" onClick={openCreate} className="h-8 text-xs gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Category
        </Button>
      </div>

      {/* Categories Table - flex-1 for max screen visibility */}
      <div className="flex-1 bg-white rounded-lg border border-neutral-200 shadow-xs overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-neutral-50/80 sticky top-0 z-10 border-b border-neutral-200 text-neutral-600 font-mono uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-4 font-semibold w-12">Tag</th>
                <th className="py-2.5 px-4 font-semibold">Name</th>
                <th className="py-2.5 px-4 font-semibold">Slug</th>
                <th className="py-2.5 px-4 font-semibold">Description</th>
                <th className="py-2.5 px-4 font-semibold text-center">Books</th>
                <th className="py-2.5 px-4 font-semibold text-center">Order</th>
                <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400">
                    Loading categories...
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500">
                    <p className="font-medium text-sm text-neutral-700">No categories found</p>
                    <p className="text-xs text-neutral-400 mt-1">Create categories to organize your books.</p>
                  </td>
                </tr>
              ) : (
                categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div
                        className="h-5 w-5 rounded-md border border-neutral-300"
                        style={{ backgroundColor: cat.color_code }}
                        title={cat.color_code}
                      />
                    </td>
                    <td className="py-3 px-4 font-medium text-neutral-900">{cat.name}</td>
                    <td className="py-3 px-4 font-mono text-neutral-500 text-[11px]">{cat.slug}</td>
                    <td className="py-3 px-4 text-neutral-600 max-w-sm truncate">{cat.description || "—"}</td>
                    <td className="py-3 px-4 text-center font-mono text-neutral-700">
                      <span className="inline-flex items-center gap-1 bg-neutral-100 px-2 py-0.5 rounded text-[11px]">
                        <BookOpen className="h-3 w-3" />
                        {cat.book_count || 0}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-neutral-500">{cat.display_order}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => openEdit(cat)}
                          title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5 text-neutral-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(cat)}
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
          Total: {categories.length} categories
        </div>
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-serif font-bold">
                {editingCategory ? "Edit Category" : "New Category"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-700 font-medium mb-1">Name</label>
                <Input
                  required
                  placeholder="e.g. Psychology & Mind"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="block text-neutral-700 font-medium mb-1">Slug (URL identifier)</label>
                <Input
                  placeholder="e.g. psychology-and-mind"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-neutral-700 font-medium mb-1">Description</label>
                <Textarea
                  placeholder="Short editorial summary of books in this category..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="text-xs min-h-[60px]"
                />
              </div>

              <div>
                <label className="block text-neutral-700 font-medium mb-1">Brand Accent Color</label>
                <div className="flex items-center gap-2 mb-2">
                  {PALETTE_COLORS.map((col) => (
                    <button
                      type="button"
                      key={col}
                      onClick={() => setColorCode(col)}
                      className={`h-6 w-6 rounded-full border transition-transform ${
                        colorCode === col ? "scale-110 ring-2 ring-neutral-900 border-white" : "border-neutral-300"
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                  <Input
                    value={colorCode}
                    onChange={(e) => setColorCode(e.target.value)}
                    className="h-7 w-24 text-[11px] font-mono ml-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-700 font-medium mb-1">Display Order</label>
                <Input
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(Number(e.target.value))}
                  className="h-8 text-xs font-mono w-24"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? "Saving..." : editingCategory ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
