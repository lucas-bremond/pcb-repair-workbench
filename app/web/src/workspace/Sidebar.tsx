// The left sidebar, after Kandev's: the brand and the scenario picker, a collapse toggle (to an icon
// rail), then sections listing every kind of panel. A row brings its panel to the front, or opens it;
// its "+" opens another one. The Layouts section applies a preset arrangement.
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react"
import {
  ChevronDown, ChevronRight, CircuitBoard, FolderOpen, LayoutDashboard, MessageSquarePlus, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Terminal,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { NoteDialog } from "@/investigate/NoteDialog"
import { CommandBox } from "@/investigate/StepCard"
import { scenarioHref, type ScenarioEntry } from "@/ScenarioBrowser"
import { useStore } from "@/store"
import { ThemeMenu } from "@/theme"
import { SaveStatus } from "@/workspace/editor"
import { activeKind, applyPreset, openPanel, PRESETS, reveal, snapshot, subscribe } from "@/workspace/api"
import { CATALOG, menuEntries, SECTIONS, type PanelKind } from "@/workspace/catalog"

const ITEM_ACTIVE = "relative text-foreground hover:bg-muted/60 before:absolute before:left-0 before:inset-y-1.5 before:w-[3px] before:rounded-full before:bg-primary before:content-['']"
const ITEM_INACTIVE = "text-foreground/80 hover:bg-muted/60"

function NavItem({ icon: Icon, label, hint, active, badge, collapsed, onClick, onNew, nav }: {
  icon: LucideIcon; label: string; hint?: string; active?: boolean; badge?: ReactNode; collapsed: boolean; onClick: () => void; onNew?: () => void; nav?: string
}) {
  const row = (
    <button type="button" onClick={onClick} data-nav={nav} aria-label={label} data-active={active || undefined}
      className={cn("flex items-center rounded-md text-[13px] font-medium transition-colors", collapsed ? "mx-auto h-9 w-9 justify-center" : "h-8 w-full gap-2.5 px-2.5 text-left",
        active ? ITEM_ACTIVE : ITEM_INACTIVE)}>
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {/* on hover, the "+" takes the badge's place */}
      {!collapsed && badge && <span className={cn("flex shrink-0 items-center", onNew && "group-hover/item:invisible")}>{badge}</span>}
    </button>
  )
  if (collapsed) return <Tooltip><TooltipTrigger asChild>{row}</TooltipTrigger><TooltipContent side="right">{label}</TooltipContent></Tooltip>
  return (
    <div className="group/item relative" title={hint}>
      {row}
      {onNew && (
        <button type="button" data-new={nav} title={`Open another ${label}`} aria-label={`Open another ${label}`} onClick={onNew}
          className="absolute top-1/2 right-1.5 hidden size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground group-hover/item:flex hover:bg-muted hover:text-foreground">
          <Plus className="size-3.5" />
        </button>
      )}
    </div>
  )
}

function Section({ id, label, collapsed, children, summary }: { id: string; label: string; collapsed: boolean; children: ReactNode; summary?: ReactNode }) {
  const { prefs, setPrefs } = useStore()
  const closed = prefs.sidebar?.closed || []
  const open = !closed.includes(id)
  if (collapsed) return <div className="flex flex-col gap-0.5 border-t pt-1.5">{children}</div>
  return (
    <div data-section={id}>
      <button type="button" aria-expanded={open} data-section-toggle={id}
        onClick={() => setPrefs((p) => ({ sidebar: { ...p.sidebar, closed: open ? [...closed, id] : closed.filter((x) => x !== id) } }))}
        className="flex min-h-8 w-full items-center gap-1.5 px-2 text-left text-foreground/70 transition-colors hover:text-foreground">
        <span className="truncate text-[11px] font-semibold tracking-wider uppercase">{label}</span>
        {!open && summary != null && <span className="text-[11px] text-muted-foreground/70 tabular-nums">{summary}</span>}
        <ChevronRight className={cn("ml-auto size-3.5 text-muted-foreground/60 transition-transform", open && "rotate-90")} />
      </button>
      {open && <div className="flex flex-col gap-0.5">{children}</div>}
    </div>
  )
}

/** The scenario's name, opening a list of every scenario (after Kandev's workspace picker). */
function ScenarioPicker() {
  const s = useStore()
  const [list, setList] = useState<ScenarioEntry[] | null>(null)
  const [creating, setCreating] = useState(false)
  const load = () => fetch("api/scenarios", { cache: "no-cache" }).then((r) => r.json()).then((d) => setList(d.scenarios), () => setList([]))
  return (
    <>
      <DropdownMenu onOpenChange={(o) => { if (o) load() }}>
        <DropdownMenuTrigger asChild>
          <button type="button" id="title" title="Switch scenario"
            className="flex h-7 min-w-0 flex-1 items-center gap-1 rounded-md px-1.5 text-left text-xs font-medium text-foreground/85 hover:bg-muted/60">
            <span className="truncate">{s.D.board.title || s.D.board.name}</span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80" id="scenariomenu">
          <DropdownMenuLabel className="text-[11px] tracking-wider text-muted-foreground uppercase">Scenarios</DropdownMenuLabel>
          {list === null && <p className="px-2 py-1.5 text-xs text-muted-foreground">Loading…</p>}
          {list?.map((x) => (
            <DropdownMenuItem key={x.id} asChild>
              <a href={scenarioHref(x.id)} data-scenario-item={x.id} className="flex items-center gap-2">
                <CircuitBoard /> <span className="min-w-0 flex-1 truncate">{x.title}</span>
                {x.id === s.id && <span className="rounded-full border border-primary/40 bg-primary/15 px-1.5 text-[10px] text-primary">Active</span>}
                <span className="rounded border px-1.5 text-[10px] text-muted-foreground">{x.plan ? `Plan ${x.plan}` : "No plan"}</span>
              </a>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem id="editscenario" onSelect={() => { s.select({ kind: "scenario" }); reveal("details") }}><Pencil /> Edit scenario</DropdownMenuItem>
          <DropdownMenuItem id="newscenario" onSelect={() => setCreating(true)}><Plus /> New scenario</DropdownMenuItem>
          <DropdownMenuItem asChild><a href="./" id="scenarios"><FolderOpen /> All scenarios</a></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Terminal className="size-5" /> New scenario</DialogTitle>
            <DialogDescription>
              The agent builds a scenario from your photos: it asks for the board's name, the fault, what you already tried and your instruments, models the board, and writes the first plan. Run in Claude Code, in this repository:
            </DialogDescription>
          </DialogHeader>
          <CommandBox text="/new-scenario" />
          <p className="text-xs text-muted-foreground">The new scenario appears in this list as soon as its folder is written.</p>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function Sidebar() {
  const s = useStore()
  useSyncExternalStore(subscribe, snapshot)
  const [noting, setNoting] = useState(false)
  const collapsed = !!s.prefs.sidebar?.collapsed
  const toggle = () => s.setPrefs((p) => ({ sidebar: { ...p.sidebar, collapsed: !collapsed } }))
  const active = activeKind()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") { e.preventDefault(); toggle() } }
    addEventListener("keydown", onKey)
    return () => removeEventListener("keydown", onKey)
  })
  const counts: Partial<Record<PanelKind, ReactNode>> = {
    suspects: s.suspects.filter((x) => x.status === "open").length || undefined,
    questions: s.D.questions.length || undefined,
    findings: s.plan?.findings?.length || undefined,
    parts: Object.keys(s.M.parts).length,
    nets: Object.keys(s.M.nets).length,
    traces: s.M.traces.length || undefined,
  }
  const badge = (kind: PanelKind) => {
    if (kind === "step" && (s.updateReasons.length > 0 || !s.plan))
      return <span id="planflag" className="rounded-full bg-warning/20 px-1.5 text-[10px] font-semibold text-warning" title={s.plan ? s.updateReasons.join("; ") : "No plan yet"}>{s.plan ? "Update" : "No plan"}</span>
    const n = counts[kind]
    return n != null ? <span className="text-[11px] text-muted-foreground tabular-nums">{n}</span> : null
  }
  return (
    <aside id="sidebar" data-collapsed={collapsed || undefined}
      className={cn("flex h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width]", collapsed ? "w-[52px]" : "w-[248px]")}>
      {collapsed ? (
        <div className="flex shrink-0 flex-col items-center gap-1 border-b px-1 py-1.5">
          <a href="./" className="flex size-7 items-center justify-center rounded-md text-base font-bold tracking-tight hover:bg-muted/60" title="All scenarios">P</a>
          <Button variant="ghost" size="icon-sm" className="size-7" data-sidebar-toggle onClick={toggle} title="Expand the sidebar (Ctrl+B)" aria-label="Expand the sidebar"><PanelLeftOpen /></Button>
        </div>
      ) : (
        <div className="flex h-10 shrink-0 items-center gap-1.5 border-b px-3">
          <a href="./" className="shrink-0 text-lg font-bold tracking-tight hover:text-foreground/80" title="All scenarios">PCB</a>
          <span aria-hidden className="shrink-0 text-muted-foreground/30 select-none">/</span>
          <ScenarioPicker />
          <Button variant="ghost" size="icon-sm" className="size-7 shrink-0" data-sidebar-toggle onClick={toggle} title="Collapse the sidebar (Ctrl+B)" aria-label="Collapse the sidebar"><PanelLeftClose /></Button>
        </div>
      )}
      <nav className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 py-2">
        <NavItem icon={MessageSquarePlus} label="Add a note" hint="An observation, or an instruction for the agent's next round" collapsed={collapsed} nav="note" onClick={() => setNoting(true)} />
        {SECTIONS.map((section) => (
          <Section key={section} id={section.toLowerCase()} label={section} collapsed={collapsed}
            summary={section === "Investigation" && s.updateReasons.length ? "update" : undefined}>
            {menuEntries(section).map((e) => (
              <NavItem key={e.key} icon={CATALOG[e.kind].icon} label={e.label} hint={CATALOG[e.kind].hint} collapsed={collapsed} nav={e.key}
                active={active === e.kind} badge={badge(e.kind)}
                onClick={() => reveal(e.kind, undefined, e.params)} onNew={() => openPanel(e.kind, e.params)} />
            ))}
          </Section>
        ))}
        <Section id="layouts" label="Layouts" collapsed={collapsed}>
          {PRESETS.map((p) => (
            <NavItem key={p.id} icon={LayoutDashboard} label={p.title} hint={p.hint} collapsed={collapsed} nav={`preset-${p.id}`} onClick={() => applyPreset(p.id)} />
          ))}
        </Section>
      </nav>
      <div className={cn("flex shrink-0 items-center gap-1 border-t px-2 py-1.5", collapsed && "flex-col")}>
        <ThemeMenu theme={s.prefs.theme} setTheme={(theme) => s.setPrefs({ theme })} />
        {!collapsed && <div className="ml-auto flex min-w-0 justify-end"><SaveStatus /></div>}
      </div>
      <NoteDialog open={noting} onOpenChange={setNoting} step={s.walked.current} />
    </aside>
  )
}
