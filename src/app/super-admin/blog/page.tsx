"use client"

import * as React from "react"
import Link from "next/link"
import { Plus, Search, Edit2, Trash2, Eye, Calendar, User, FileText, CheckCircle2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"
import { toast } from "sonner"

interface BlogPost {
  id: string
  title: string
  slug: string
  status: "draft" | "published" | "scheduled"
  excerpt: string | null
  created_at: string
  published_at: string | null
  authors?: {
    id: string
    name: string
  } | null
}

export default function AdminBlogPage() {
  const [posts, setPosts] = React.useState<BlogPost[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("all")

  const fetchPosts = React.useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.set("status", statusFilter)

      const res = await fetch(`/api/admin/blog?${params.toString()}`)
      const data = await res.json()
      if (res.ok) {
        setPosts(data.posts || [])
      } else {
        toast.error(data.error || "Failed to load articles")
      }
    } catch {
      toast.error("Network error loading blog posts")
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  React.useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const handleDelete = async (post: BlogPost) => {
    if (!confirm(`Are you sure you want to delete "${post.title}"?`)) return

    try {
      const res = await fetch(`/api/admin/blog?id=${post.id}`, { method: "DELETE" })
      const data = await res.json()
      if (res.ok) {
        toast.success("Post deleted")
        fetchPosts()
      } else {
        toast.error(data.error || "Failed to delete post")
      }
    } catch {
      toast.error("Delete request failed")
    }
  }

  const filteredPosts = posts.filter((p) =>
    search.trim() ? p.title.toLowerCase().includes(search.toLowerCase()) : true
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return <Badge variant="success" className="gap-1 font-mono text-[10px]"><CheckCircle2 className="h-3 w-3" /> Published</Badge>
      case "scheduled":
        return <Badge variant="outline" className="gap-1 font-mono text-[10px] text-blue-700 bg-blue-50 border-blue-200"><Calendar className="h-3 w-3" /> Scheduled</Badge>
      default:
        return <Badge variant="outline" className="gap-1 font-mono text-[10px] text-neutral-600 bg-neutral-100 border-neutral-200"><Clock className="h-3 w-3" /> Draft</Badge>
    }
  }

  return (
    <div className="h-full flex flex-col p-6 space-y-4">
      {/* Header - Compact for 80/20 data table ratio */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 font-serif">Editorial Articles</h1>
          <p className="text-xs text-neutral-500">Manage literary essays, reading guides, and publication schedules.</p>
        </div>
        <Link href="/super-admin/blog/new">
          <Button size="sm" className="h-8 text-xs gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Write Article
          </Button>
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-2.5 rounded-lg border border-neutral-200 shadow-xs">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
          <Input
            placeholder="Search article titles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-neutral-50/50"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {["all", "published", "draft", "scheduled"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors capitalize ${
                statusFilter === st
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table Container - flex-1 for max screen visibility */}
      <div className="flex-1 bg-white rounded-lg border border-neutral-200 shadow-xs overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-neutral-50/80 sticky top-0 z-10 border-b border-neutral-200 text-neutral-600 font-mono uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Title</th>
                <th className="py-2.5 px-4 font-semibold">Author</th>
                <th className="py-2.5 px-4 font-semibold">Status</th>
                <th className="py-2.5 px-4 font-semibold">Date</th>
                <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-neutral-400">
                    Loading editorial articles...
                  </td>
                </tr>
              ) : filteredPosts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-neutral-500">
                    <p className="font-medium text-sm text-neutral-700">No articles found</p>
                    <p className="text-xs text-neutral-400 mt-1">Write your first post to engage readers.</p>
                  </td>
                </tr>
              ) : (
                filteredPosts.map((post) => (
                  <tr key={post.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-neutral-900 font-serif text-sm">{post.title}</div>
                      <div className="text-[11px] text-neutral-400 font-mono">/blog/{post.slug}</div>
                    </td>
                    <td className="py-3 px-4 text-neutral-700 font-medium">
                      {post.authors?.name || "Editorial Staff"}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(post.status)}</td>
                    <td className="py-3 px-4 text-neutral-500 font-mono text-[11px]">
                      {post.published_at ? formatDate(post.published_at) : formatDate(post.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {post.status === "published" && (
                          <Link href={`/blog/${post.slug}`} target="_blank">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="View Public Post">
                              <Eye className="h-3.5 w-3.5 text-neutral-600" />
                            </Button>
                          </Link>
                        )}
                        <Link href={`/super-admin/blog/${post.id}/edit`}>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Edit Post">
                            <Edit2 className="h-3.5 w-3.5 text-neutral-600" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(post)}
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
          Total: {filteredPosts.length} posts
        </div>
      </div>
    </div>
  )
}
