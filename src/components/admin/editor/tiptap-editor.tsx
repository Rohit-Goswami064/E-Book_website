"use client"

import * as React from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import Image from "@tiptap/extension-image"
import { Table } from "@tiptap/extension-table"
import TableRow from "@tiptap/extension-table-row"
import TableHeader from "@tiptap/extension-table-header"
import TableCell from "@tiptap/extension-table-cell"
import TextAlign from "@tiptap/extension-text-align"
import Highlight from "@tiptap/extension-highlight"
import Placeholder from "@tiptap/extension-placeholder"
import { TipTapToolbar } from "./tiptap-toolbar"
import "./editor.css"

interface TipTapEditorProps {
  content: string
  onChange: (html: string) => void
  onWordCountChange?: (words: number) => void
}

export function TipTapEditor({ content, onChange, onWordCountChange }: TipTapEditorProps) {
  const [words, setWords] = React.useState(0)
  const [chars, setChars] = React.useState(0)

  const countWords = (text: string) => {
    const trimmed = text.trim()
    return trimmed ? trimmed.split(/\s+/).length : 0
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3, 4, 5, 6],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-neutral-900 underline font-medium hover:text-black",
          rel: "noopener noreferrer",
        },
      }),
      Image.configure({
        inline: true,
        HTMLAttributes: {
          class: "rounded-xl max-w-full h-auto my-4 shadow-xs",
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: "border-collapse border border-neutral-300 my-4 w-full text-sm",
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Placeholder.configure({
        placeholder: "Write in-depth literary essays, philosophical reviews, or publishing commentary...",
      }),
    ],
    content: content || "",
    editorProps: {
      attributes: {
        class: "focus:outline-none min-h-[460px] cursor-text",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      const text = editor.getText()
      const wordCount = countWords(text)
      setWords(wordCount)
      setChars(text.length)
      if (onWordCountChange) onWordCountChange(wordCount)
      onChange(html)
    },
  })

  // Synchronize when external content updates (e.g. from HTML mode or loading draft)
  React.useEffect(() => {
    if (!editor) return
    const currentHtml = editor.getHTML()
    if (content !== currentHtml && !editor.isFocused) {
      editor.commands.setContent(content || "", { emitUpdate: false })
      const text = editor.getText()
      const wc = countWords(text)
      setWords(wc)
      setChars(text.length)
      if (onWordCountChange) onWordCountChange(wc)
    }
  }, [content, editor, onWordCountChange])

  // Initial count
  React.useEffect(() => {
    if (editor) {
      const text = editor.getText()
      const wc = countWords(text)
      setWords(wc)
      setChars(text.length)
      if (onWordCountChange) onWordCountChange(wc)
    }
  }, [editor, onWordCountChange])

  const readingTimeEstimate = Math.max(1, Math.ceil(words / 200))

  return (
    <div className="border border-neutral-200 rounded-xl bg-white shadow-xs overflow-hidden flex flex-col">
      <TipTapToolbar editor={editor} />
      <div
        className="editorial-prose flex-1 bg-white cursor-text min-h-[500px]"
        onClick={() => {
          if (editor && !editor.isFocused) {
            editor.commands.focus("end")
          }
        }}
      >
        <EditorContent editor={editor} />
      </div>
      {/* Editor Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-neutral-100 bg-neutral-50/70 text-[11px] text-neutral-500 font-mono select-none">
        <div className="flex items-center gap-3">
          <span>{words.toLocaleString()} words</span>
          <span>•</span>
          <span>{chars.toLocaleString()} characters</span>
          <span>•</span>
          <span>~{readingTimeEstimate} min read</span>
        </div>
        <div className="text-neutral-400">
          Visual Editorial Mode
        </div>
      </div>
    </div>
  )
}
