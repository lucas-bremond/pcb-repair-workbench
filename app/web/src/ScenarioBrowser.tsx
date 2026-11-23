// The start page: every scenario folder the server can see, grouped by the folder holding it.
// Opening one loads the page with ?s=<root>/<folder>.
import { useEffect, useState } from "react"
import { AlertTriangle, CircuitBoard, FolderOpen, ImageOff, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { fileUrl } from "@/model"
import { loadPrefs, PREFS_KEY } from "@/store"
import { ThemeMenu, useApplyTheme, type Theme } from "@/theme"

export interface ScenarioEntry {
  id: string
  root: string
  name: string
  title: string
  board?: string
  marking?: string
  description?: string
  parts?: number
  nets?: number
  questions?: number
  thumbnail?: string | null
  modified?: number
  plan?: number | null // the plan's revision
  error?: string
}

const ROOT_TITLES: Record<string, string> = { scenarios: "Scenarios" }

export const scenarioHref = (id: string) => `?s=${encodeURIComponent(id)}`

export function ScenarioBrowser() {
  const [theme, setThemeState] = useState<Theme>(() => loadPrefs().theme)
  const setTheme = (t: Theme) => {
    setThemeState(t)
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ ...loadPrefs(), theme: t })) } catch { /* page-only */ }
  }
  useApplyTheme(theme)
  const [data, setData] = useState<{ roots: string[]; scenarios: ScenarioEntry[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = () => {
    setError(null)
    fetch("api/scenarios", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status} ${r.statusText}`))))
      .then(setData, (e) => setError(`Could not list the scenarios: ${e.message}`))
  }
  useEffect(() => { document.title = "Scenarios"; load() }, [])

  const roots = data ? [...data.roots].sort((a, b) => (a === "scenarios" ? -1 : b === "scenarios" ? 1 : a.localeCompare(b))) : []
  return (
    <div className="min-h-svh bg-background">
      <header className="flex items-center gap-3 border-b px-4 py-2">
        <CircuitBoard className="size-5 text-primary" />
        <h1 className="text-base font-semibold">Scenarios</h1>
        <span className="text-xs text-muted-foreground">Pick a board to open</span>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" title="Refresh" aria-label="Refresh" id="refresh" onClick={load}><RefreshCw /></Button>
          <ThemeMenu theme={theme} setTheme={setTheme} />
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6" id="browser">
        {error && <p className="text-destructive">{error}</p>}
        {!data && !error && <p className="text-muted-foreground">Loading…</p>}
        {roots.map((root) => {
          const list = data!.scenarios.filter((s) => s.root === root)
          return (
            <section key={root} data-root={root}>
              <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <FolderOpen className="size-4" /> {ROOT_TITLES[root] || root}
                <span className="font-normal tracking-normal normal-case">{list.length}</span>
              </h2>
              {list.length === 0 ? (
                <Card className="p-4 text-sm text-muted-foreground">
                  {root === "scenarios" ? (
                    <>
                      <p className="mb-1 font-medium text-foreground">No scenarios yet.</p>
                      <p>A scenario is a folder with a <code>scenario.json</code> and its photos, in the <code>scenarios/</code> folder (or the one given as <code>SCENARIOS=…</code> to <code>make start</code>).
                        To create one from your photos, ask Claude Code in this repository to use the <b>new-scenario</b> skill.</p>
                    </>
                  ) : <p>No scenario folders here.</p>}
                </Card>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((s) => <ScenarioCard key={s.id} s={s} />)}
                </div>
              )}
            </section>
          )
        })}
      </main>
    </div>
  )
}

function ScenarioCard({ s }: { s: ScenarioEntry }) {
  return (
    <a href={scenarioHref(s.id)} data-scenario={s.id} className="group block rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      <Card className="h-full gap-0 overflow-hidden p-0 transition-colors group-hover:border-primary">
        <div className="flex aspect-[16/9] items-center justify-center overflow-hidden bg-muted">
          {s.thumbnail
            ? <img src={fileUrl(s.id, s.thumbnail)} alt="" loading="lazy" className="size-full object-cover" />
            : <ImageOff className="size-8 text-muted-foreground" />}
        </div>
        <div className="flex flex-col gap-1 p-3">
          <h3 className="font-semibold leading-tight">{s.title}</h3>
          {s.error ? (
            <p className="flex items-start gap-1.5 text-xs text-destructive"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {s.error}</p>
          ) : (
            <>
              {(s.board || s.marking) && <p className="truncate text-xs text-muted-foreground" title={s.marking}>{[s.board, s.marking].filter(Boolean).join(" · ")}</p>}
              {s.description && <p className="line-clamp-2 text-[13px]">{s.description}</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                {s.parts} parts · {s.nets} nets · {s.questions} open questions
                {s.modified ? ` · edited ${new Date(s.modified).toLocaleDateString()}` : ""}
              </p>
            </>
          )}
          <p className="text-[11px] text-muted-foreground"><code>{s.id}</code></p>
        </div>
      </Card>
    </a>
  )
}
