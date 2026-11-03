"use client"

import * as React from "react"
import { type Editor } from "@tiptap/react"
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Quote,
  Minus,
  Table as TableIcon,
  Link as LinkIcon,
  Unlink,
  Image as ImageIcon,
  Undo2,
  Redo2,
  RemoveFormatting,
  Heading2,
  Heading3,
  Heading4,
  Pilcrow,
  Plus,
  Trash2,
  UploadCloud,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { CloudinaryUpload } from "@/components/admin/cloudinary-upload"
import { cn } from "@/lib/utils"

interface TipTapToolbarProps {
  editor: Editor | null
}

export function TipTapToolbar({ editor }: TipTapToolbarProps) {
  const [linkUrl, setLinkUrl] = React.useState("")
  const [linkOpen, setLinkOpen] = React.useState(false)
  const [imageOpen, setImageOpen] = React.useState(false)
  const [imageUrl, setImageUrl] = React.useState("")
  const [imageAlt, setImageAlt] = React.useState("")

  if (!editor) return null

  const handleSetLink = () => {
    if (!linkUrl.trim()) {
      editor.chain().focus().unsetLink().run()
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: linkUrl.trim(), target: "_blank" })
        .run()
    }
    setLinkOpen(false)
    setLinkUrl("")
  }

  const handleOpenLinkPopover = () => {
    const previousUrl = editor.getAttributes("link").href
    setLinkUrl(previousUrl || "")
    setLinkOpen(true)
  }

  const handleInsertImageByUrl = () => {
    if (imageUrl.trim()) {
      editor
        .chain()
        .focus()
        .setImage({ src: imageUrl.trim(), alt: imageAlt.trim() || "Article inline illustration" })
        .run()
    }
    setImageOpen(false)
    setImageUrl("")
    setImageAlt("")
  }

  const handleInsertCloudinaryImage = (url: string) => {
    editor
      .chain()
      .focus()
      .setImage({ src: url, alt: imageAlt.trim() || "Article editorial graphic" })
      .run()
    setImageOpen(false)
  }

  const currentHeading = () => {
    if (editor.isActive("heading", { level: 2 })) return "H2 Heading"
    if (editor.isActive("heading", { level: 3 })) return "H3 Subhead"
    if (editor.isActive("heading", { level: 4 })) return "H4 Section"
    return "Paragraph"
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-neutral-200 bg-neutral-50/90 p-1.5 text-neutral-700 backdrop-blur-xs select-none">
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="iconXs"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                className="h-7 w-7 text-neutral-600 hover:text-neutral-900"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="iconXs"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                className="h-7 w-7 text-neutral-600 hover:text-neutral-900"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="mx-1 h-4" />

        {/* Heading Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs font-medium text-neutral-800 hover:bg-neutral-200/60"
            >
              <span>{currentHeading()}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40 text-xs">
            <DropdownMenuItem
              onClick={() => editor.chain().focus().setParagraph().run()}
              className={cn("gap-2", editor.isActive("paragraph") && "bg-neutral-100 font-semibold")}
            >
              <Pilcrow className="h-3.5 w-3.5 text-neutral-500" /> Paragraph
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={cn("gap-2", editor.isActive("heading", { level: 2 }) && "bg-neutral-100 font-semibold")}
            >
              <Heading2 className="h-3.5 w-3.5 text-neutral-500" /> Heading 2 (Major)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={cn("gap-2", editor.isActive("heading", { level: 3 }) && "bg-neutral-100 font-semibold")}
            >
              <Heading3 className="h-3.5 w-3.5 text-neutral-500" /> Heading 3 (Subhead)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
              className={cn("gap-2", editor.isActive("heading", { level: 4 }) && "bg-neutral-100 font-semibold")}
            >
              <Heading4 className="h-3.5 w-3.5 text-neutral-500" /> Heading 4 (Section)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="mx-1 h-4" />

        {/* Bold, Italic, Underline, Strikethrough, Code, Highlight */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={editor.isActive("bold") ? "secondary" : "ghost"}
                size="iconXs"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={cn("h-7 w-7", editor.isActive("bold") && "bg-neutral-200 font-bold text-black")}
              >
                <Bold className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bold (Ctrl+B)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={editor.isActive("italic") ? "secondary" : "ghost"}
                size="iconXs"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={cn("h-7 w-7", editor.isActive("italic") && "bg-neutral-200 text-black")}
              >
                <Italic className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Italic (Ctrl+I)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={editor.isActive("underline") ? "secondary" : "ghost"}
                size="iconXs"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={cn("h-7 w-7", editor.isActive("underline") && "bg-neutral-200 text-black")}
              >
                <Underline className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Underline (Ctrl+U)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={editor.isActive("strike") ? "secondary" : "ghost"}
                size="iconXs"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={cn("h-7 w-7", editor.isActive("strike") && "bg-neutral-200 text-black")}
              >
                <Strikethrough className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Strikethrough</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={editor.isActive("code") ? "secondary" : "ghost"}
                size="iconXs"
                onClick={() => editor.chain().focus().toggleCode().run()}
                className={cn("h-7 w-7", editor.isActive("code") && "bg-neutral-200 text-black")}
              >
                <Code className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Inline Code</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={editor.isActive("highlight") ? "secondary" : "ghost"}
                size="iconXs"
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                className={cn("h-7 w-7", editor.isActive("highlight") && "bg-yellow-200 text-black")}
              >
                <Highlighter className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Highlight Text</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="mx-1 h-4" />

        {/* Text Alignment */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={editor.isActive({ textAlign: "left" }) ? "secondary" : "ghost"}
                size="iconXs"
                onClick={() => editor.chain().focus().setTextAlign("left").run()}
                className="h-7 w-7"
              >
                <AlignLeft className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Align Left</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={editor.isActive({ textAlign: "center" }) ? "secondary" : "ghost"}
                size="iconXs"
                onClick={() => editor.chain().focus().setTextAlign("center").run()}
                className="h-7 w-7"
              >
                <AlignCenter className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Align Center</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={editor.isActive({ textAlign: "right" }) ? "secondary" : "ghost"}
                size="iconXs"
                onClick={() => editor.chain().focus().setTextAlign("right").run()}
                className="h-7 w-7"
              >
                <AlignRight className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Align Right</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={editor.isActive({ textAlign: "justify" }) ? "secondary" : "ghost"}
                size="iconXs"
                onClick={() => editor.chain().focus().setTextAlign("justify").run()}
                className="h-7 w-7"
              >
                <AlignJustify className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Justify Text</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="mx-1 h-4" />

        {/* Lists & Block Elements */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={editor.isActive("bulletList") ? "secondary" : "ghost"}
                size="iconXs"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className="h-7 w-7"
              >
                <List className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bullet List</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={editor.isActive("orderedList") ? "secondary" : "ghost"}
                size="iconXs"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className="h-7 w-7"
              >
                <ListOrdered className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Numbered List</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={editor.isActive("blockquote") ? "secondary" : "ghost"}
                size="iconXs"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className="h-7 w-7"
              >
                <Quote className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Blockquote</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="iconXs"
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                className="h-7 w-7"
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Horizontal Divider</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="mx-1 h-4" />

        {/* Hyperlink */}
        <Popover open={linkOpen} onOpenChange={setLinkOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant={editor.isActive("link") ? "secondary" : "ghost"}
                  size="iconXs"
                  onClick={handleOpenLinkPopover}
                  className="h-7 w-7"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>Insert / Edit Link</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-80 p-3 space-y-2 text-xs" align="start">
            <p className="font-semibold text-neutral-800">Add Link</p>
            <Input
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="h-7 text-xs"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleSetLink()
                }
              }}
            />
            <div className="flex justify-between items-center pt-1">
              {editor.isActive("link") && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-red-600 text-[11px] px-2 gap-1"
                  onClick={() => {
                    editor.chain().focus().unsetLink().run()
                    setLinkOpen(false)
                  }}
                >
                  <Unlink className="h-3 w-3" /> Remove
                </Button>
              )}
              <div className="flex gap-1 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 text-[11px] px-2"
                  onClick={() => setLinkOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-6 text-[11px] px-2.5"
                  onClick={handleSetLink}
                >
                  Apply
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Insert Inline Image (Cloudinary or URL) */}
        <Popover open={imageOpen} onOpenChange={setImageOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="iconXs"
                  className="h-7 w-7 text-neutral-700"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>Insert Inline Image</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-88 p-3.5 space-y-3 text-xs" align="start">
            <div>
              <p className="font-semibold text-neutral-900">Insert Inline Image</p>
              <p className="text-[11px] text-neutral-500">
                Upload to Cloudinary or specify an existing image URL
              </p>
            </div>

            <div className="border border-dashed border-neutral-200 rounded-lg p-2.5 bg-neutral-50/50">
              <CloudinaryUpload
                compact
                assetType="blog_inline"
                label="Upload via Cloudinary"
                description=""
                onChange={(url) => handleInsertCloudinaryImage(url)}
              />
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-neutral-200"></div>
              <span className="flex-shrink mx-2 text-[10px] text-neutral-400 uppercase tracking-widest font-mono">
                or image URL
              </span>
              <div className="flex-grow border-t border-neutral-200"></div>
            </div>

            <div className="space-y-1.5">
              <Input
                placeholder="https://images.unsplash.com/..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="h-7 text-xs"
              />
              <Input
                placeholder="Alt description for accessibility"
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
                className="h-7 text-xs"
              />
              <div className="flex justify-end gap-1 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 text-[11px] px-2"
                  onClick={() => setImageOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!imageUrl.trim()}
                  className="h-6 text-[11px] px-2.5"
                  onClick={handleInsertImageByUrl}
                >
                  Insert Image
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Table Management */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant={editor.isActive("table") ? "secondary" : "ghost"}
                  size="iconXs"
                  className="h-7 w-7"
                >
                  <TableIcon className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Tables</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" className="w-48 text-xs">
            {!editor.isActive("table") ? (
              <DropdownMenuItem
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                    .run()
                }
                className="gap-2"
              >
                <Plus className="h-3.5 w-3.5" /> Insert 3×3 Table
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().addRowAfter().run()}
                  className="gap-2"
                >
                  Add Row Below
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().addColumnAfter().run()}
                  className="gap-2"
                >
                  Add Column Right
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().deleteRow().run()}
                  className="gap-2 text-red-600"
                >
                  Delete Row
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().deleteColumn().run()}
                  className="gap-2 text-red-600"
                >
                  Delete Column
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().deleteTable().run()}
                  className="gap-2 text-red-600 font-medium"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete Entire Table
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="mx-1 h-4" />

        {/* Clear formatting */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="iconXs"
              onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
              className="h-7 w-7 text-neutral-500 hover:text-neutral-800"
            >
              <RemoveFormatting className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear Formatting</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
