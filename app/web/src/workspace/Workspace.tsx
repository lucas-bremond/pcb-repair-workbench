// The workspace: every view is a dockview panel. Any number can be open, several of the same kind,
// arranged by dragging their tabs, split, maximized or closed (after Kandev's workbench). Each
// group's header has a "+" menu to add a panel, and maximize, split and close buttons; an empty
// group offers the same menu. The layout is kept in the browser (api.ts).
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react"
import {
  DockviewDefaultTab, DockviewReact, type IDockviewHeaderActionsProps, type IDockviewPanelHeaderProps, type IDockviewPanelProps,
  type IWatermarkPanelProps,
} from "dockview-react"
import { Columns2, Maximize2, Minimize2, MoreHorizontal, PanelTop, Plus, RotateCcw, RotateCw, Rows2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { DetailPanel } from "@/board/DetailPanel"
import { PhotoView } from "@/board/PhotoView"
import { NetsPanel, PartsPanel, TracesPanel } from "@/board/SidePanel"
import { QuestionsPanel } from "@/investigate/QuestionsPanel"
import { alignedPhoto, type Side } from "@/model"
import { useStore } from "@/store"
import { DiagramTab } from "@/tabs/DiagramTab"
import { FindingsPanel, PathPanel, StepPanel, SuspectsPanel } from "@/tabs/InvestigateTab"
import { LogTab } from "@/tabs/LogTab"
import { SchematicTab } from "@/tabs/SchematicTab"
import { attach, openPanel } from "@/workspace/api"
import { EditBar } from "@/workspace/editor"
import {
  CATALOG, menuEntries, MODE_TITLE, panelTitle, photoView, SECTIONS, SHOW_TITLE, type PanelKind, type PhotoMode, type PhotoShow,
} from "@/workspace/catalog"

// three.js and the 3D scene load only the first time a 3D panel opens
const Board3D = lazy(() => import("@/board/Board3D").then((m) => ({ default: m.Board3D })))

/** Whether a panel is on screen (its tab active and its group shown). */
function useVisible(api: IDockviewPanelProps["api"]) {
  const [visible, setVisible] = useState(api.isVisible)
  useEffect(() => { const d = api.onDidVisibilityChange((e) => setVisible(e.isVisible)); return () => d.dispose() }, [api])
  return visible
}

const Scroll = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`h-full overflow-auto ${className}`}>{children}</div>
)

/** Labels and traces on the photos (shared by every photo panel). */
function PhotoSwitches() {
  const { prefs, setPrefs } = useStore()
  return (
    <>
      <Label className="text-xs font-normal"><Switch size="sm" data-switch="labels" className="tags" checked={prefs.labels} onCheckedChange={(c) => setPrefs({ labels: c })} /> Labels</Label>
      <Label className="text-xs font-normal"><Switch size="sm" data-switch="traces" className="showtraces" checked={prefs.traces} onCheckedChange={(c) => setPrefs({ traces: c })} /> Traces</Label>
    </>
  )
}

interface PhotoParams {
  mode?: PhotoMode; show?: PhotoShow; front?: Side; opacity?: number; rotate?: number
  turn?: boolean // before rotate: the bottom turned 180°, now ignored
  view?: string; side?: Side; layout?: string // layouts saved before the two switches
}

const SHOWS: PhotoShow[] = ["top", "bottom", "both", "overlay"]

/** The 2D panel: the photos as taken (Raw) or straightened into the board frame (Aligned), and
 *  one side, both, or one seen through the other (aligned only). Both switches, and the aligned
 *  view's own settings, are the panel's parameters. */
function PhotoPanel({ api, params }: IDockviewPanelProps<PhotoParams>) {
  const s = useStore()
  const a = s.D.aligned
  const sidesOf = (m: PhotoMode) => (["top", "bottom"] as Side[]).filter((x) => s.D.photos[x] && (m === "raw" || a?.sides[x]))
  const can = (m: PhotoMode, x: PhotoShow) => {
    const sides = sidesOf(m)
    if (m === "aligned" && !a) return false
    if (x === "overlay") return m === "aligned" && sides.length > 1
    return x === "both" ? sides.length > 1 : sides.includes(x)
  }
  const want = photoView(params as Record<string, unknown>)
  const mode: PhotoMode = sidesOf(want.mode).length && (want.mode === "raw" || a) ? want.mode : "raw"
  // what is asked if this mode has it, else the nearest: overlay becomes both, both the first side
  const pick = (m: PhotoMode, x: PhotoShow): PhotoShow | undefined =>
    can(m, x) ? x : x === "overlay" && can(m, "both") ? "both" : sidesOf(m)[0]
  const show = pick(mode, want.show)
  if (!show) return <p className="p-4 text-sm text-muted-foreground">This scenario has no board photo.</p>
  const choose = (m: PhotoMode, x: PhotoShow) => {
    const next = { mode: m, show: pick(m, x)! }
    api.updateParameters({ ...params, ...next, view: undefined, side: undefined, layout: undefined })
    api.setTitle(panelTitle("photo", next))
  }
  const switches = (
    <>
      <ToggleGroup type="single" variant="outline" size="sm" value={mode} className="shrink-0" onValueChange={(v) => v && choose(v as PhotoMode, show)}>
        {(["raw", "aligned"] as PhotoMode[]).map((m) => (
          <ToggleGroupItem key={m} value={m} data-photo-mode={m} className="h-7 px-2 text-xs" disabled={!sidesOf(m).length || (m === "aligned" && !a)}
            title={m === "raw" ? "The photos as taken" : a ? "The photos with their background removed, straightened and aligned on the board" : "This scenario has no aligned photos"}>
            {MODE_TITLE[m]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <ToggleGroup type="single" variant="outline" size="sm" value={show} className="shrink-0" onValueChange={(v) => v && choose(mode, v as PhotoShow)}>
        {SHOWS.map((x) => (
          <ToggleGroupItem key={x} value={x} data-photo-show={x} className="h-7 px-2 text-xs" disabled={!can(mode, x)}
            title={x === "overlay" ? (mode === "raw" ? "Only for the aligned photos" : "One side, the other seen through the board") : x === "both" ? "Both sides, one above the other" : undefined}>
            {SHOW_TITLE[x]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </>
  )
  if (mode === "aligned") return <AlignedView params={params} show={show} set={(p) => api.updateParameters({ ...params, ...p })} switches={switches} />
  if (show === "both") return (
    <div className="flex h-full flex-col gap-2 p-2.5" data-panel-photo="raw" data-photo-shows="both">
      <EditBar full />
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">{switches}<PhotoSwitches /></div>
      {sidesOf("raw").map((x) => <PhotoView key={x} side={x} title={SHOW_TITLE[x]} />)}
    </div>
  )
  return (
    <div className="flex h-full flex-col gap-2 p-2.5" data-panel-photo="raw" data-photo-shows={show}>
      <EditBar full />
      <PhotoView side={show as Side} tools={<>{switches}<PhotoSwitches /></>} />
    </div>
  )
}

/** Both sides in the board frame, one above the other (the bottom flipped to read from below), one
 *  side alone, or one over the other, see-through. Boxes, traces and editing work as on the raw photos. */
function AlignedView({ params, show, set, switches }: { params: PhotoParams; show: PhotoShow; set: (p: PhotoParams) => void; switches: ReactNode }) {
  const s = useStore()
  const a = s.D.aligned!
  const o = { front: "top" as Side, opacity: 0.5, rotate: 0, ...params }
  const sides = (["top", "bottom"] as Side[]).filter((x) => a.sides[x] && s.D.photos[x])
  const how = a.method === "points"
    ? "Aligned on the hand-picked points in scenario.json."
    : `Aligned automatically: ${a.quality.matched_features ?? 0} holes and pads matched on both sides.`
  const front = sides.includes(o.front) ? o.front : sides[0]
  const back = sides.find((x) => x !== front)
  const overlay = show === "overlay" && back
  const shown = show === "both" || show === "overlay" ? sides : sides.filter((x) => x === show)
  const photoOf = (side: Side, readable: boolean) => alignedPhoto(s.id, a, side, s.D.photos[side], readable && side === "bottom", o.rotate)!
  const turn = (by: number) => set({ rotate: (((o.rotate + by) % 360) + 360) % 360 })
  return (
    <div className="flex h-full flex-col gap-2 p-2.5" id="aligned" data-panel-photo="aligned" data-photo-shows={show}>
      <EditBar full />
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
        {switches}
        {overlay ? (
          <>
            <ToggleGroup type="single" variant="outline" size="sm" value={front} onValueChange={(v) => v && set({ front: v as Side })}>
              {sides.map((x) => <ToggleGroupItem key={x} value={x} data-afront={x} className="h-7 px-2 text-xs">{SHOW_TITLE[x]} in front</ToggleGroupItem>)}
            </ToggleGroup>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              {SHOW_TITLE[back]} side
              <input type="range" id="aopacity" min={0} max={1} step={0.05} value={o.opacity} className="w-24 accent-primary" onChange={(e) => set({ opacity: +e.target.value })} />
              {Math.round(o.opacity * 100)} %
            </label>
          </>
        ) : null}
        <div className="flex items-center gap-1" id="arotate" data-rotate={o.rotate}>
          <Button size="icon-xs" variant="outline" id="arot-left" title="Turn the view 90° to the left" onClick={() => turn(-90)}><RotateCcw /></Button>
          <Button size="icon-xs" variant="outline" id="arot-right" title="Turn the view 90° to the right" onClick={() => turn(90)}><RotateCw /></Button>
          <span className="min-w-8 text-xs text-muted-foreground tabular-nums">{o.rotate}°</span>
        </div>
        <PhotoSwitches />
        <span className="text-xs text-muted-foreground" id="ahow" title={`Scale: ${a.scale_source}`}>{how}</span>
      </div>
      {overlay ? (
        <PhotoView key={`over-${front}`} side={front} photo={photoOf(front, false)}
          caption={`${SHOW_TITLE[front]} side, ${back} seen through the board`} overlay={{ src: photoOf(back, false).src, css: photoOf(back, false).css, opacity: o.opacity, label: `Board ${back} side` }} />
      ) : shown.map((x) => (
        <PhotoView key={`side-${x}`} side={x} title={SHOW_TITLE[x]} photo={photoOf(x, true)}
          caption={x === "bottom" ? "seen from below, background removed, aligned with the top" : "background removed, straightened"} />
      ))}
    </div>
  )
}

function Board3DPanel({ api }: IDockviewPanelProps) {
  const visible = useVisible(api)
  return (
    <div className="flex h-full flex-col gap-2 p-2.5" data-panel-3d>
      <div className="flex shrink-0 items-center gap-3"><PhotoSwitches /></div>
      <Suspense fallback={<section id="view3d" className="p-8 text-muted-foreground">Loading the 3D view…</section>}>
        <div className="min-h-0 flex-1"><Board3D visible={visible} /></div>
      </Suspense>
    </div>
  )
}

function SchematicPanel({ api }: IDockviewPanelProps) {
  const visible = useVisible(api)
  return <SchematicTab visible={visible} />
}

const components: Record<PanelKind, React.FunctionComponent<IDockviewPanelProps<any>>> = {
  step: () => <StepPanel />,
  path: () => <PathPanel />,
  suspects: () => <SuspectsPanel />,
  questions: () => <QuestionsPanel />,
  findings: () => <FindingsPanel />,
  log: () => <Scroll className="p-4"><LogTab /></Scroll>,
  parts: () => <PartsPanel />,
  nets: () => <NetsPanel />,
  traces: () => <TracesPanel />,
  details: () => <DetailPanel />,
  photo: PhotoPanel,
  board3d: Board3DPanel,
  diagram: () => <Scroll><DiagramTab /></Scroll>,
  schematic: SchematicPanel,
}

/** The panels that can be added, by section (the photo once per side). */
export function AddPanelItems({ onPick }: { onPick: (kind: PanelKind, params?: Record<string, unknown>) => void }) {
  return (
    <>
      {SECTIONS.map((section, i) => (
        <div key={section}>
          {i > 0 && <DropdownMenuSeparator />}
          <DropdownMenuLabel className="text-[11px] tracking-wider text-muted-foreground uppercase">{section}</DropdownMenuLabel>
          {menuEntries(section).map((e) => {
            const Icon = CATALOG[e.kind].icon
            return <DropdownMenuItem key={e.key} data-add={e.key} title={CATALOG[e.kind].hint} onSelect={() => onPick(e.kind, e.params)}><Icon /> {e.label}</DropdownMenuItem>
          })}
        </div>
      ))}
    </>
  )
}

const ACTION = "size-6 p-0 text-muted-foreground hover:bg-muted hover:text-foreground"

function LeftActions({ group }: IDockviewHeaderActionsProps) {
  return (
    <div className="flex items-center pl-0.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-xs" variant="ghost" className={ACTION} data-group-add title="Add a panel" aria-label="Add a panel"><Plus /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <AddPanelItems onPick={(kind, params) => openPanel(kind, params, { referenceGroup: group.id })} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function RightActions({ group, containerApi }: IDockviewHeaderActionsProps) {
  const [maximized, setMaximized] = useState(group.api.isMaximized())
  const [narrow, setNarrow] = useState(group.api.width < 380)
  useEffect(() => {
    const d = containerApi.onDidMaximizedGroupChange(() => setMaximized(group.api.isMaximized()))
    const w = group.api.onDidDimensionsChange((e) => setNarrow(e.width < 380))
    return () => { d.dispose(); w.dispose() }
  }, [group, containerApi])
  const split = (direction: "right" | "below") => containerApi.addGroup({ referenceGroup: group, direction })
  if (narrow)
    return (
      <div className="flex items-center pr-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-xs" variant="ghost" className={ACTION} data-group-more title="Group actions" aria-label="Group actions"><MoreHorizontal /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem data-group-max onSelect={() => (maximized ? group.api.exitMaximized() : group.api.maximize())}>{maximized ? <Minimize2 /> : <Maximize2 />} {maximized ? "Restore" : "Maximize"}</DropdownMenuItem>
            <DropdownMenuItem data-group-split="right" onSelect={() => split("right")}><Columns2 /> Split right</DropdownMenuItem>
            <DropdownMenuItem data-group-split="below" onSelect={() => split("below")}><Rows2 /> Split down</DropdownMenuItem>
            <DropdownMenuItem data-group-close onSelect={() => group.api.close()}><X /> Close the group</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  return (
    <div className="flex items-center gap-0.5 pr-1">
      <Button size="icon-xs" variant="ghost" className={ACTION} data-group-max title={maximized ? "Restore" : "Maximize"} aria-label={maximized ? "Restore" : "Maximize"}
        onClick={() => (maximized ? group.api.exitMaximized() : group.api.maximize())}>{maximized ? <Minimize2 /> : <Maximize2 />}</Button>
      <Button size="icon-xs" variant="ghost" className={ACTION} data-group-split="right" title="Split right" aria-label="Split right"
        onClick={() => split("right")}><Columns2 /></Button>
      <Button size="icon-xs" variant="ghost" className={ACTION} data-group-split="below" title="Split down" aria-label="Split down"
        onClick={() => split("below")}><Rows2 /></Button>
      <Button size="icon-xs" variant="ghost" className={ACTION} data-group-close title="Close the group" aria-label="Close the group"
        onClick={() => group.api.close()}><X /></Button>
    </div>
  )
}

/** An empty group (or an empty workspace): add a panel. */
function Watermark({ group }: IWatermarkPanelProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground" data-empty-group>
      <PanelTop className="size-5 opacity-50" />
      <p className="text-xs">{group ? "Empty group" : "No panels open"}</p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="xs" variant="ghost" data-watermark-add className="text-muted-foreground"><Plus /> Add panel</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <AddPanelItems onPick={(kind, params) => openPanel(kind, params, group ? { referenceGroup: group.id } : undefined)} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/** The default tab; a double-click maximizes its group (or restores it). */
function Tab(props: IDockviewPanelHeaderProps) {
  return (
    <div className="flex h-full items-center" data-tab-kind={props.api.component}
      onDoubleClick={() => (props.api.group.api.isMaximized() ? props.api.group.api.exitMaximized() : props.api.group.api.maximize())}>
      <DockviewDefaultTab {...props} />
    </div>
  )
}

const theme = { name: "pcb", className: "dockview-theme-pcb", gap: 0 }

export function Workspace() {
  return (
    <DockviewReact
      className="min-h-0 flex-1"
      theme={theme}
      components={components}
      defaultTabComponent={Tab}
      leftHeaderActionsComponent={LeftActions}
      rightHeaderActionsComponent={RightActions}
      watermarkComponent={Watermark}
      noPanelsOverlay="watermark"
      defaultRenderer="always"
      disableFloatingGroups
      onReady={(e) => attach(e.api)}
    />
  )
}
