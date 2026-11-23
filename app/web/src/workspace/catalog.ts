// The kinds of panel the workspace can open, any number of each: what they are called, their
// icon, the sidebar section they sit in, and the family they join when opened (a new photo goes
// beside the other board views, a new list beside the other lists).
import {
  Box, CircuitBoard, ClipboardList, Component, Crosshair, Footprints, ImageIcon, Info, Lightbulb, Network, ScrollText,
  Spline, Users, Workflow, type LucideIcon,
} from "lucide-react"
import type { Side } from "@/model"

export type PanelKind =
  | "step" | "path" | "suspects" | "questions" | "findings" | "log"
  | "parts" | "nets" | "traces" | "details" | "photo" | "board3d"
  | "diagram" | "schematic"
export type Section = "Investigation" | "Board" | "Diagrams"
export type Family = "investigation" | "notes" | "lists" | "details" | "views" | "diagrams"

export interface PanelSpec { title: string; icon: LucideIcon; section: Section; family: Family; hint: string }

export const CATALOG: Record<PanelKind, PanelSpec> = {
  step: { title: "Current step", icon: ClipboardList, section: "Investigation", family: "investigation", hint: "The plan's current step: what to do, where the probes go, your answer" },
  path: { title: "Phases and steps", icon: Footprints, section: "Investigation", family: "investigation", hint: "Where you are in the plan, and every step answered" },
  suspects: { title: "Suspects", icon: Users, section: "Investigation", family: "notes", hint: "The possible causes, updated by your answers" },
  questions: { title: "Open questions", icon: Crosshair, section: "Investigation", family: "notes", hint: "Gaps in the board model, and the step that settles each" },
  findings: { title: "Established", icon: Lightbulb, section: "Investigation", family: "notes", hint: "What the investigation has established" },
  log: { title: "Repair log", icon: ScrollText, section: "Investigation", family: "notes", hint: "Everything that happened, newest first; add observations and instructions" },
  parts: { title: "Parts", icon: Component, section: "Board", family: "lists", hint: "Every part: type, value, known pins; filter and sort" },
  nets: { title: "Nets", icon: Network, section: "Board", family: "lists", hint: "Every net and its weakest connection" },
  traces: { title: "Traces", icon: Spline, section: "Board", family: "lists", hint: "Copper followed on the photos" },
  details: { title: "Details", icon: Info, section: "Board", family: "details", hint: "What is selected; the editor's forms" },
  photo: { title: "2D", icon: ImageIcon, section: "Board", family: "views", hint: "The photos, with the parts' boxes and traces: one side, or both aligned. The reference for editing" },
  board3d: { title: "3D", icon: Box, section: "Board", family: "views", hint: "The board in 3D, built from the photos" },
  diagram: { title: "Block diagram", icon: Workflow, section: "Diagrams", family: "diagrams", hint: "The functional blocks and how they connect" },
  schematic: { title: "Schematic", icon: CircuitBoard, section: "Diagrams", family: "diagrams", hint: "The KiCad schematic, and its layout editor" },
}

export const SECTIONS: Section[] = ["Investigation", "Board", "Diagrams"]

/** What a 2D panel shows: the photos as taken (raw) or straightened into the board frame
 *  (aligned), and which sides: one, both, or (aligned only) one seen through the other. */
export type PhotoMode = "raw" | "aligned"
export type PhotoShow = Side | "both" | "overlay"
export const MODE_TITLE: Record<PhotoMode, string> = { raw: "Raw", aligned: "Aligned" }
export const SHOW_TITLE: Record<PhotoShow, string> = { top: "Top", bottom: "Bottom", both: "Both", overlay: "Overlay" }

/** A 2D panel's mode and sides, from its parameters. Layouts saved before the two switches kept
 *  `view` (top, bottom or aligned) and the aligned view's `layout` (side or overlay). */
export function photoView(params?: Record<string, unknown>): { mode: PhotoMode; show: PhotoShow } {
  const p = params || {}
  if (p.mode) return { mode: p.mode as PhotoMode, show: (p.show ?? "top") as PhotoShow }
  const v = (p.view ?? p.side ?? "top") as string
  if (v === "aligned") return { mode: "aligned", show: p.layout === "overlay" ? "overlay" : "both" }
  return { mode: "raw", show: v as Side }
}
/** Whether a 2D panel with these parameters shows that side. */
export const showsSide = (params: Record<string, unknown> | undefined, side: Side) => {
  const { show } = photoView(params)
  return show === side || show === "both" || show === "overlay"
}

/** A panel's tab title from its parameters (a 2D panel names what it shows, to tell several apart). */
export function panelTitle(kind: PanelKind, params?: Record<string, unknown>): string {
  if (kind !== "photo") return CATALOG[kind].title
  const { mode, show } = photoView(params)
  return `2D · ${mode === "aligned" ? "Aligned · " : ""}${SHOW_TITLE[show] || "Top"}`
}

/** The menu entries: one per kind. */
export interface MenuEntry { kind: PanelKind; params?: Record<string, unknown>; label: string; key: string }
export function menuEntries(section: Section): MenuEntry[] {
  return (Object.keys(CATALOG) as PanelKind[]).filter((k) => CATALOG[k].section === section).map((kind) => ({ kind, label: CATALOG[kind].title, key: kind }))
}
