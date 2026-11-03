"use client"

import * as React from "react"
import { Code2, Wand2, CheckCircle2, AlertTriangle, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

interface SourceEditorProps {
  content: string
  onChange: (html: string) => void
}

function formatHTML(html: string): string {
  let formatted = ""
  const reg = /(>)(<)(\/*)/g
  const xml = html.replace(reg, "$1\r\n$2$3")
  let pad = 0
  xml.split("\r\n").forEach((node) => {
    let indent = 0
    if (node.match(/.+<\/\w[^>]*>$/)) {
      indent = 0
    } else if (node.match(/^<\/\w/)) {
      if (pad !== 0) {
        pad -= 1
      }
    } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
      indent = 1
    } else {
      indent = 0
    }

    let padding = ""
    for (let i = 0; i < pad; i++) {
      padding += "  "
    }

    formatted += padding + node + "\r\n"
    pad += indent
  })
  return formatted.trim()
}

function validateHTML(html: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!html.trim()) return { isValid: true, errors: [] }

  // Simple stack-based tag balance validator for standard block and inline elements
  const voidTags = new Set([
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
    "meta", "param", "source", "track", "wbr"
  ])

  const tagRegex = /<\/?([a-zA-Z0-9]+)(?:\s+[^>]*)?>/g
  const stack: string[] = []
  let match: RegExpExecArray | null

  while ((match = tagRegex.exec(html)) !== null) {
    const fullTag = match[0]
    const tagName = match[1].toLowerCase()

    if (voidTags.has(tagName) || fullTag.endsWith("/>")) {
      continue
    }

    const isClosing = fullTag.startsWith("</")
    if (!isClosing) {
      stack.push(tagName)
    } else {
      if (stack.length === 0) {
        errors.push(`Unexpected closing tag </${tagName}> without matching opening tag`)
      } else {
        const last = stack.pop()
        if (last !== tagName) {
          errors.push(`Mismatched tags: expected </${last}>, found </${tagName}>`)
        }
      }
    }
  }

  if (stack.length > 0) {
    errors.push(`Unclosed tag(s): ${stack.map((t) => `<${t}>`).join(", ")}`)
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

export function SourceEditor({ content, onChange }: SourceEditorProps) {
  const [localHtml, setLocalHtml] = React.useState(content || "")
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    setLocalHtml(content || "")
  }, [content])

  const validation = React.useMemo(() => validateHTML(localHtml), [localHtml])
  const lines = localHtml.split("\n")

  const handleBeautify = () => {
    try {
      const formatted = formatHTML(localHtml)
      setLocalHtml(formatted)
      onChange(formatted)
      toast.success("HTML formatted cleanly")
    } catch {
      toast.error("Could not format HTML")
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(localHtml)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success("HTML copied to clipboard")
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setLocalHtml(val)
    onChange(val)
  }

  return (
    <div className="border border-neutral-200 rounded-xl bg-white shadow-xs overflow-hidden flex flex-col font-mono">
      {/* HTML Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-900 p-2 text-white">
        <div className="flex items-center gap-2 text-xs">
          <Code2 className="h-4 w-4 text-emerald-400" />
          <span className="font-semibold text-neutral-200">HTML Source Inspector</span>
          <span className="text-neutral-500">•</span>
          {validation.isValid ? (
            <Badge variant="outline" className="h-5 gap-1 border-emerald-500/40 bg-emerald-950/40 text-emerald-300 text-[10px] font-mono">
              <CheckCircle2 className="h-3 w-3" /> Valid HTML
            </Badge>
          ) : (
            <Badge variant="outline" className="h-5 gap-1 border-amber-500/40 bg-amber-950/40 text-amber-300 text-[10px] font-mono">
              <AlertTriangle className="h-3 w-3" /> Syntax Warning ({validation.errors.length})
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 gap-1"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleBeautify}
            className="h-7 text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 gap-1"
          >
            <Wand2 className="h-3 w-3 text-emerald-400" /> Format
          </Button>
        </div>
      </div>

      {/* Validation Warnings Alert */}
      {!validation.isValid && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold">HTML Tag Imbalance Detected</p>
            <p className="text-[11px] text-amber-800 font-sans">
              {validation.errors.slice(0, 3).join("; ")}
            </p>
          </div>
        </div>
      )}

      {/* Code Editor Area with Line Numbers */}
      <div className="flex bg-neutral-950 text-neutral-200 min-h-[500px] overflow-hidden text-xs leading-relaxed">
        {/* Line Numbers */}
        <div className="py-4 px-3 select-none text-right text-neutral-600 bg-neutral-900/60 border-r border-neutral-800 font-mono text-[11px]">
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          value={localHtml}
          onChange={handleChange}
          spellCheck={false}
          className="flex-1 p-4 bg-transparent text-emerald-200/90 font-mono text-xs leading-relaxed resize-none outline-none focus:ring-0 min-h-[500px]"
          placeholder="<p>Write raw HTML markup...</p>"
        />
      </div>

      {/* Footer bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-neutral-200 bg-neutral-100 text-[11px] text-neutral-600 font-mono">
        <div>
          <span>{lines.length} lines</span>
          <span className="mx-2">•</span>
          <span>{localHtml.length.toLocaleString()} characters</span>
        </div>
        <div className="text-neutral-500 text-[10px]">
          UTF-8 HTML Mode
        </div>
      </div>
    </div>
  )
}
