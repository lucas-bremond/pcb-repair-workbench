// The workspace's panels (dockview): open one, reveal one (focus an open panel of that kind, or open
// it), the layout presets, and the layout kept in the browser. One workspace per page, so this is
// a module: the sidebar, the header and the panels' own links all go through it. It holds the
// latest dockview instance and never lets go of it: React's development mode unmounts and remounts
// components once, and forgetting the instance then left every "open a panel" doing nothing.
import type { AddPanelOptions, DockviewApi, IDockviewPanel } from "dockview-react"
import { CATALOG, panelTitle, showsSide, type Family, type PanelKind } from "@/workspace/catalog"

export const LAYOUT_KEY = "pcbmodel-layout"
export type Preset = "investigate" | "board" | "schematic"
export const PRESETS: { id: Preset; title: string; hint: string }[] = [
  { id: "investigate", title: "Investigate", hint: "The current step in the middle, the photos and the suspects beside it" },
  { id: "board", title: "Board", hint: "The lists, both photos and the details: for correcting the model" },
  { id: "schematic", title: "Schematic", hint: "The schematic and the block diagram, with the lists and the details" },
]
const DEFAULT_PRESET: Preset = "investigate"

let api: DockviewApi | null = null
const listeners = new Set<() => void>()
let version = 0
const notify = () => { version++; listeners.forEach((f) => f()) }

/** For useSyncExternalStore: re-render when panels open, close or change focus. */
export const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f) } }
export const snapshot = () => version
export const getApi = () => api

export function openKinds(): Map<PanelKind, number> {
  const m = new Map<PanelKind, number>()
  for (const p of api?.panels || []) m.set(p.api.component as PanelKind, (m.get(p.api.component as PanelKind) || 0) + 1)
  return m
}
export const activeKind = () => (api?.activePanel?.api.component as PanelKind | undefined) ?? null

function nextId(kind: PanelKind) {
  let n = 1
  while (api?.getPanel(`${kind}-${n}`)) n++
  return `${kind}-${n}`
}

type Position = AddPanelOptions["position"]
const WIDTH: Partial<Record<Family, number>> = { lists: 320, details: 360, investigation: 280, notes: 380 }

/** Where a new panel of this kind goes: beside an open panel of its family, else right of the active group. */
function placeFor(kind: PanelKind): Position | undefined {
  if (!api) return undefined
  const family = CATALOG[kind].family
  const sibling = api.panels.find((p) => CATALOG[p.api.component as PanelKind]?.family === family)
  if (sibling) return { referenceGroup: sibling.group.id }
  if (api.activeGroup) return { referenceGroup: api.activeGroup.id, direction: "right" }
  return undefined
}

/** Open a new panel of a kind (in `position`, or beside its family). */
export function openPanel(kind: PanelKind, params: Record<string, unknown> = {}, position?: Position, inactive = false): IDockviewPanel | null {
  if (!api) return null
  const where = position ?? placeFor(kind)
  return api.addPanel({
    id: nextId(kind), component: kind, title: panelTitle(kind, params), params, inactive,
    ...(where ? { position: where } : {}),
    ...(WIDTH[CATALOG[kind].family] && (!where || "direction" in where) ? { initialWidth: WIDTH[CATALOG[kind].family] } : {}),
  } as AddPanelOptions)
}

/** Focus an open panel of this kind (the first that `match`es its parameters), or open one. */
export function reveal(kind: PanelKind, match?: (params: Record<string, unknown>) => boolean, params: Record<string, unknown> = {}): IDockviewPanel | null {
  if (!api) return null
  const open = api.panels.find((p) => p.api.component === kind && (!match || match((p.params || {}) as Record<string, unknown>)))
  if (open) { open.api.setActive(); return open }
  return openPanel(kind, params)
}

/** A Details panel in front (a list row's double-click): the open one, else a new one. */
export const revealDetails = () => reveal("details")

/** "Show on the board": a board view in front. A visible one stays; else a 2D panel (on that side,
 *  if asked), else 3D, else a new 2D panel. */
export function revealBoard(side?: "top" | "bottom") {
  const views = api?.panels.filter((p) => CATALOG[p.api.component as PanelKind]?.family === "views") || []
  const photos = views.filter((p) => p.api.component === "photo")
  const onSide = (p: IDockviewPanel) => !side || showsSide(p.params, side)
  const visible = views.find((p) => p.api.isVisible && (p.api.component !== "photo" || onSide(p)))
  if (visible) return visible
  const pick = photos.find(onSide) || photos[0] || views[0]
  if (pick) { pick.api.setActive(); return pick }
  return openPanel("photo", { mode: "raw", show: side || "top" })
}

export function applyPreset(preset: Preset) {
  if (!api) return
  api.clear()
  // groups get their widths once the whole arrangement exists (dockview shares the space evenly first)
  const widths: [IDockviewPanel, number][] = []
  const width = (p: IDockviewPanel, w: number) => { widths.push([p, w]); return p }
  const add = (kind: PanelKind, params: Record<string, unknown>, position?: Position, width?: number, inactive = false) =>
    api!.addPanel({
      id: nextId(kind), component: kind, title: panelTitle(kind, params), params, inactive,
      ...(position ? { position } : {}), ...(width ? { initialWidth: width } : {}),
    } as AddPanelOptions)
  if (preset === "investigate") {
    const path = width(add("path", {}), 270)
    const step = add("step", {}, { referencePanel: path.id, direction: "right" })
    const top = width(add("photo", { mode: "raw", show: "top" }, { referencePanel: step.id, direction: "right" }), 560)
    add("photo", { mode: "raw", show: "bottom" }, { referencePanel: top.id }, undefined, true)
    add("board3d", {}, { referencePanel: top.id }, undefined, true)
    const sus = add("suspects", {}, { referencePanel: top.id, direction: "below" })
    for (const k of ["details", "questions", "findings", "log"] as PanelKind[]) add(k, {}, { referencePanel: sus.id }, undefined, true)
    step.api.setActive()
  } else if (preset === "board") {
    const parts = width(add("parts", {}), 330)
    add("nets", {}, { referencePanel: parts.id }, undefined, true)
    add("traces", {}, { referencePanel: parts.id }, undefined, true)
    const top = add("photo", { mode: "raw", show: "top" }, { referencePanel: parts.id, direction: "right" })
    add("board3d", {}, { referencePanel: top.id }, undefined, true)
    add("photo", { mode: "raw", show: "bottom" }, { referencePanel: top.id, direction: "below" })
    width(add("details", {}, { referencePanel: top.id, direction: "right" }), 360)
    parts.api.setActive()
  } else {
    const parts = width(add("parts", {}), 320)
    add("nets", {}, { referencePanel: parts.id }, undefined, true)
    const sch = add("schematic", {}, { referencePanel: parts.id, direction: "right" })
    add("diagram", {}, { referencePanel: sch.id }, undefined, true)
    width(add("details", {}, { referencePanel: sch.id, direction: "right" }), 360)
    sch.api.setActive()
  }
  for (const [p, w] of widths) p.group.api.setSize({ width: w })
}

/** Called by the workspace when dockview is ready: restore the saved layout, or the default. */
export function attach(a: DockviewApi) {
  api = a
  let restored = false
  try {
    const saved = localStorage.getItem(LAYOUT_KEY)
    if (saved) { a.fromJSON(JSON.parse(saved)); restored = a.panels.length > 0 }
  } catch { restored = false }
  if (!restored) applyPreset(DEFAULT_PRESET)
  const save = () => { try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(a.toJSON())) } catch { /* page-only */ } }
  a.onDidLayoutChange(() => { save(); notify() })
  a.onDidActivePanelChange(notify)
  a.onDidAddPanel(notify)
  a.onDidRemovePanel(notify)
  ;(window as any).__ws = { api: a, reveal, openPanel, applyPreset, revealBoard, kinds: () => a.panels.map((p) => p.api.component) }
  notify()
}
