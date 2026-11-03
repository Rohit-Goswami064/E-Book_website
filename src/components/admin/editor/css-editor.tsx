"use client"

import * as React from "react"
import { Palette, ShieldAlert, Sparkles, CheckCircle2, AlertTriangle, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

interface CssEditorProps {
  customCss: string
  onChange: (css: string) => void
}

const CSS_SNIPPETS = [
  {
    label: "Drop Cap (First Letter)",
    code: `/* Elegant drop-cap for opening paragraph */
.editorial-article-body > p:first-of-type::first-letter {
  font-size: 3.5rem;
  line-height: 0.85;
  float: left;
  margin-right: 0.5rem;
  font-family: var(--font-serif, Georgia, serif);
  font-weight: 700;
  color: #111111;
}`,
  },
  {
    label: "Pull Quote Callout",
    code: `/* Prominent literary pull quote */
.editorial-article-body .pull-quote {
  font-family: var(--font-serif, Georgia, serif);
  font-size: 1.5rem;
  font-style: italic;
  line-height: 1.5;
  text-align: center;
  margin: 2.5rem 0;
  padding: 1.5rem 2rem;
  background-color: #f7f6f2;
  border-top: 1px solid #111;
  border-bottom: 1px solid #111;
}`,
  },
  {
    label: "Warm Footnote Style",
    code: `/* Footnote / bibliographic notes */
.editorial-article-body .footnote {
  font-size: 0.8125rem;
  color: #666;
  border-top: 1px dashed #ccc;
  padding-top: 1rem;
  margin-top: 2rem;
}`,
  },
]

function validateCss(css: string): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = []
  if (!css.trim()) return { isValid: true, warnings: [] }

  // 1. Bracket balance check
  let depth = 0
  for (let i = 0; i < css.length; i++) {
    if (css[i] === "{") depth++
    else if (css[i] === "}") depth--
    if (depth < 0) {
      warnings.push("Unmatched closing brace '}' found in CSS")
      break
    }
  }
  if (depth > 0) {
    warnings.push(`${depth} unclosed CSS declaration block(s)`)
  }

  // 2. Dangerous selector check that would leak outside article container
  const dangerousGlobalKeywords = ["body", "html", ":root", "nav", "aside", "#admin", ".admin", "button"]
  dangerousGlobalKeywords.forEach((kw) => {
    // Regex looking for selector outside comment
    const regex = new RegExp(`(^|\\n|})\\s*(${kw})\\s*\\{`, "gi")
    if (regex.test(css)) {
      warnings.push(
        `Global selector '${kw}' detected. Scope styles to '.editorial-article-body' or '#editorial-preview' to avoid leaking into admin controls.`
      )
    }
  })

  return {
    isValid: warnings.length === 0,
    warnings,
  }
}

export function CssEditor({ customCss, onChange }: CssEditorProps) {
  const [localCss, setLocalCss] = React.useState(customCss || "")

  React.useEffect(() => {
    setLocalCss(customCss || "")
  }, [customCss])

  const validation = React.useMemo(() => validateCss(localCss), [localCss])
  const lines = localCss.split("\n")

  const handleInsertSnippet = (code: string) => {
    const updated = localCss.trim() ? `${localCss.trim()}\n\n${code}` : code
    setLocalCss(updated)
    onChange(updated)
    toast.success("CSS snippet appended")
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setLocalCss(val)
    onChange(val)
  }

  return (
    <div className="border border-neutral-200 rounded-xl bg-white shadow-xs overflow-hidden flex flex-col font-mono">
      {/* CSS Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-900 p-2 text-white">
        <div className="flex items-center gap-2 text-xs">
          <Palette className="h-4 w-4 text-purple-400" />
          <span className="font-semibold text-neutral-200">Article-Scoped Custom CSS</span>
          <span className="text-neutral-500">•</span>
          {validation.isValid ? (
            <Badge variant="outline" className="h-5 gap-1 border-purple-500/40 bg-purple-950/40 text-purple-300 text-[10px] font-mono">
              <CheckCircle2 className="h-3 w-3" /> Scoped & Valid
            </Badge>
          ) : (
            <Badge variant="outline" className="h-5 gap-1 border-amber-500/40 bg-amber-950/40 text-amber-300 text-[10px] font-mono">
              <AlertTriangle className="h-3 w-3" /> Scope Warning ({validation.warnings.length})
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {CSS_SNIPPETS.map((snip, idx) => (
            <Button
              key={idx}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleInsertSnippet(snip.code)}
              className="h-7 text-[11px] text-neutral-300 hover:text-white hover:bg-neutral-800 gap-1 font-sans"
            >
              <Sparkles className="h-3 w-3 text-purple-400" />
              {snip.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Scope info alert */}
      <div className="bg-purple-50/70 border-b border-purple-200/60 px-4 py-2 text-xs text-purple-950 flex items-start gap-2 font-sans">
        <Info className="h-4 w-4 text-purple-700 shrink-0 mt-0.5" />
        <p className="text-[11px] text-purple-900">
          Target elements within <code className="bg-purple-100 text-purple-950 px-1 py-0.5 rounded font-mono font-semibold">.editorial-article-body</code>. Styles will safely apply to the public article and live preview without affecting admin chrome.
        </p>
      </div>

      {/* Scope warning alert if dangerous selector used */}
      {!validation.isValid && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 flex items-start gap-2 font-sans">
          <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold">CSS Containment Warning</p>
            <p className="text-[11px] text-amber-800">
              {validation.warnings.join("; ")}
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
          value={localCss}
          onChange={handleChange}
          spellCheck={false}
          className="flex-1 p-4 bg-transparent text-purple-200/90 font-mono text-xs leading-relaxed resize-none outline-none focus:ring-0 min-h-[500px]"
          placeholder="/* Custom CSS scoped to .editorial-article-body */
.editorial-article-body h2 {
  letter-spacing: -0.02em;
}"
        />
      </div>

      {/* Footer bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-neutral-200 bg-neutral-100 text-[11px] text-neutral-600 font-mono">
        <div>
          <span>{lines.length} lines</span>
          <span className="mx-2">•</span>
          <span>{localCss.length.toLocaleString()} characters</span>
        </div>
        <div className="text-neutral-500 text-[10px]">
          Scoped CSS Engine
        </div>
      </div>
    </div>
  )
}
