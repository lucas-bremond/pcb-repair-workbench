// A small, safe Markdown subset for the repair log's text: `code`, **bold**, [links](url), and
// lines starting with "- " as a list. Relative links point into the scenario folder.
import { Fragment, type ReactNode } from "react"
import { fileUrl } from "@/model"

const TOKEN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g

function inline(text: string, id: string): ReactNode[] {
  return text.split(TOKEN).map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1)
      return <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{part.slice(1, -1)}</code>
    if (part.startsWith("**") && part.endsWith("**") && part.length > 3) return <b key={i}>{inline(part.slice(2, -2), id)}</b>
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
    if (link) {
      const href = /^(https?:|mailto:)/.test(link[2]) ? link[2] : link[2].startsWith("#") ? null : fileUrl(id, link[2])
      return href
        ? <a key={i} href={href} target="_blank" rel="noreferrer" className="text-primary underline">{link[1]}</a>
        : <Fragment key={i}>{link[1]}</Fragment>
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}

export function InlineMd({ text, id, className }: { text: string; id: string; className?: string }) {
  const lines = text.split("\n")
  const out: ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length) out.push(<ul key={out.length} className="my-1 list-disc space-y-0.5 pl-5">{list.map((l, i) => <li key={i}>{inline(l, id)}</li>)}</ul>)
    list = []
  }
  for (const line of lines) {
    if (line.startsWith("- ")) { list.push(line.slice(2)); continue }
    flush()
    if (line.trim()) out.push(<p key={out.length}>{inline(line, id)}</p>)
  }
  flush()
  return <div className={className}>{out}</div>
}
