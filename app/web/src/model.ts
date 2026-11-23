// The scenario document (scenario.json, edited in place by the page), what the page derives from
// it, and the server's generated view data (resized photos, diagram, schematic geometry). The
// investigation (plan.json, record.json) is in investigation.ts.
import type { Plan, RecordDoc } from "@/investigation"

export type Side = "top" | "bottom"
export const SIDES: Side[] = ["top", "bottom"]
export type Box = [number, number, number, number] // x0, y0, x1, y1 in the photo's pixels

export interface ConfidenceLevel { rank: number; color: string; meaning: string }
export interface Part {
  kind?: string
  value: string
  package?: string
  label?: string
  group: string
  pins: Record<string, string>
  box?: Partial<Record<Side, Box>>
  wire?: string
  note?: string
  pinout_source?: string
  formerly?: string[] // earlier references, so the plan and the record still find it
}
export interface NetNode { ref: string; pin: string; conf: string; evidence: string }
export interface Net { description?: string; formerly?: string[]; nodes: NetNode[] }
export interface Trace { id: string; net: string; side: Side; points: [number, number][]; evidence?: string }
export interface Question { id: string; title: string; pins: [string, string | number][]; candidates?: string[]; check: string; why?: string }
export interface Block { title: string; subtitle?: string; col: number; row: number }
export interface Link { from: string; to: string; conf: string; label?: string }
export interface Board { title: string; name: string; marking: string; model_date?: string; description?: string }
export interface Instrument { kind: string; model?: string; notes?: string }

/** scenario.json (see app/schema/scenario.schema.json). */
export interface Scenario {
  format: "pcb-scenario"
  version: 2
  board: Board
  instruments?: Instrument[]
  confidence: Record<string, ConfidenceLevel>
  photos: Partial<Record<Side, { file: string; size: [number, number]; display_rotation?: number }>>
  parts: Record<string, Part>
  nets: Record<string, Net>
  traces: Trace[] // [] when the file has none (the page adds it)
  power_nets?: string[]
  blocks?: Record<string, Block>
  links?: Link[]
  open_questions?: Question[]
  schematic_order?: string[]
  schematic_layout?: unknown
  schematic?: unknown
  geometry?: unknown
}

/** A photo as the page shows it: the resized copy in generated/ and how it maps to the original.
 *  With H (aligned view), the original's pixels map to the view by that homography instead. */
/** `w` by `h` is the view; `css` is the image's transform about its centre, for an image of `iw` by `ih`
 *  (the view's size unless the view is turned a quarter). */
export interface Photo { file: string; src: string; w: number; h: number; scale: number; size: [number, number]; rot: number; H?: Mat3; Hi?: Mat3; css?: string; iw?: number; ih?: number }
export type Mat3 = number[][]
/** The photos processed into the board frame (generated/view.json "aligned"). */
export interface AlignedView {
  method: "points" | "auto"
  width: number
  height: number
  px_per_mm: number
  scale_source: string
  quality: { reference?: Side; shape_match?: number; matched_features?: number; mirrored?: boolean }
  sides: Partial<Record<Side, { src: string; H: Mat3 }>>
}
/** generated/view.json, written by build.py. */
export interface View { photos: Partial<Record<Side, Photo>>; diagram: string; schematic: unknown; schematicSvg: string; aligned?: AlignedView | null }
/** plan.json's state as the build sees it: schema errors, references the model no longer has. */
export interface PlanStatus { errors: string[]; stale: string[]; revision?: number; current?: string | null; state?: string }
export interface BuildStatus { ok: boolean; errors: string[]; warnings: string[]; summary?: string; fingerprint?: string; plan?: PlanStatus | null }

/** What the components read: the live scenario and the last generated view, merged. Only the
 *  photos the scenario has are in `photos`. */
export interface Data {
  board: Board
  confidence: Record<string, ConfidenceLevel>
  parts: Record<string, Part>
  nets: Record<string, Net>
  questions: Question[]
  blocks: Record<string, Block>
  photos: Record<Side, Photo>
  diagram: string
  schematicSvg: string
  schematic: unknown
  aligned: AlignedView | null
}
export interface Data3D {
  board: { outline: [number, number][]; width: number; height: number; thickness: number; scale_source: string; max_residual_mm: number | null; alignment?: string }
  parts3d: Record<string, { side: Side; x: number; y: number; w: number; l: number; body: Record<string, any> }>
  traces: { net: string; side: Side; evidence: string; points: [number, number][] }[]
  textures: Record<string, string>
}

/** The server's answer for one scenario (GET /api/scenarios/:id). */
export interface Loaded {
  id: string
  doc: Scenario
  etag: string
  status: BuildStatus
  view: View | null
  data3d: Data3D | null
  plan: Plan | null
  planEtag: string | null
  record: RecordDoc | null
  recordEtag: string | null
}

/** URL of a file in a scenario folder. */
export const fileUrl = (id: string, rel: string) => `files/${id}/${rel}`

export async function loadScenario(id: string): Promise<Loaded> {
  const r = await fetch(`api/scenarios/${id}`, { cache: "no-cache" })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body.error || `${r.status} ${r.statusText}`)
  return body as Loaded
}

export const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o))

export function makeData(id: string, doc: Scenario, view: View | null): Data {
  const photos = {} as Record<Side, Photo>
  for (const side of SIDES) {
    const p = view?.photos[side]
    if (p && doc.photos[side]) photos[side] = { ...p, src: fileUrl(id, p.src) }
  }
  return {
    board: doc.board, confidence: doc.confidence, parts: doc.parts, nets: doc.nets, questions: doc.open_questions || [],
    blocks: doc.blocks || {}, photos, diagram: view?.diagram || "", schematicSvg: view?.schematicSvg || "",
    schematic: view?.schematic || { auto: { parts: {}, wires: [], power: [], headers: [], right: 0 }, geometry: {}, powerNets: [] },
    aligned: view?.aligned || null,
  }
}

export interface Model {
  parts: Record<string, Part>
  nets: Record<string, Net>
  traces: Trace[]
  netConfidence: Record<string, string>
  pinNet: Record<string, { net: string; conf: string; evidence: string }>
}

/** The lookups the page needs: each net's weakest link and each pin's net. */
export function deriveModel(doc: Scenario): Model {
  const rank = (k: string) => doc.confidence[k]?.rank ?? 0
  const nets: Record<string, Net> = {}
  for (const [name, n] of Object.entries(doc.nets))
    nets[name] = { ...n, nodes: n.nodes.map((x) => ({ ...x, pin: String(x.pin), evidence: x.evidence || "" })) }
  const netConfidence: Record<string, string> = {}
  for (const [k, n] of Object.entries(nets))
    if (n.nodes.length) netConfidence[k] = n.nodes.map((x) => x.conf).reduce((p, q) => (rank(p) <= rank(q) ? p : q))
  const pinNet: Model["pinNet"] = {}
  for (const [name, net] of Object.entries(nets))
    for (const n of net.nodes) pinNet[`${n.ref}.${n.pin}`] = { net: name, conf: n.conf, evidence: n.evidence }
  return { parts: doc.parts, nets, traces: doc.traces || [], netConfidence, pinNet }
}

/** Put a part's box on one photo (null removes it). */
export function setBox(doc: Scenario, ref: string, side: Side, value: Box | null) {
  const part = doc.parts[ref]
  const box = part.box || (part.box = {})
  if (value) box[side] = value.map(Math.round) as Box
  else delete box[side]
  if (!Object.keys(box).length) delete part.box
}

/** Put a pin on a net (null takes it off every net). Updating the same net keeps the node's place. */
export function setConnection(doc: Scenario, ref: string, pin: string, net: string | null, conf: string, evidence: string) {
  let found: { name: string; i: number } | null = null
  for (const [name, n] of Object.entries(doc.nets))
    n.nodes.forEach((x, i) => { if (x.ref === ref && String(x.pin) === pin) found = { name, i } })
  const f = found as { name: string; i: number } | null
  if (f && net === f.name) {
    doc.nets[f.name].nodes[f.i] = { ref, pin, conf, evidence }
    return
  }
  if (f) doc.nets[f.name].nodes.splice(f.i, 1)
  if (net) (doc.nets[net] || (doc.nets[net] = { description: "Added in the editor.", nodes: [] })).nodes.push({ ref, pin, conf, evidence })
  for (const k of Object.keys(doc.nets)) if (!doc.nets[k].nodes.length) delete doc.nets[k]
}


/** Rename a key while keeping the object's key order (so the file's diff stays small). */
function renameKey<T>(obj: Record<string, T>, from: string, to: string): Record<string, T> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k === from ? to : k, v]))
}
type Sch = { parts?: Record<string, unknown>; wires?: unknown[]; power?: unknown[][] }
type SchBlock = { place?: Record<string, unknown>; wires?: unknown[][]; power?: unknown[][] }
const schBlocks = (doc: Scenario) => Object.values((doc.schematic_layout || {}) as Record<string, SchBlock>)

/** Remember a part's or net's earlier name, so plan.json and record.json entries written with it
 *  still find it (renaming back drops the name from the list). */
function remember(item: { formerly?: string[] }, from: string, to: string) {
  const list = [...new Set([...(item.formerly || []), from])].filter((n) => n !== to)
  if (list.length) item.formerly = list
  else delete item.formerly
}

/** Give a part a new reference everywhere it is used: nets, open questions, schematic layouts, 3D
 *  overrides. plan.json and record.json keep the old name: the part remembers it in `formerly`. */
export function renamePart(doc: Scenario, from: string, to: string) {
  doc.parts = renameKey(doc.parts, from, to)
  remember(doc.parts[to], from, to)
  for (const n of Object.values(doc.nets)) for (const x of n.nodes) if (x.ref === from) x.ref = to
  for (const q of doc.open_questions || []) for (const p of q.pins) if (p[0] === from) p[0] = to
  for (const b of schBlocks(doc)) {
    if (b.place?.[from] !== undefined) b.place = renameKey(b.place, from, to)
    b.wires = b.wires?.map((w) => w.map((step) => (typeof step === "string" && step.startsWith(from + ".") ? to + step.slice(from.length) : step)))
  }
  const sch = doc.schematic as Sch | undefined
  if (sch?.parts?.[from] !== undefined) sch.parts = renameKey(sch.parts, from, to)
  const bodies = (doc.geometry as { bodies?: Record<string, unknown> } | undefined)?.bodies
  if (bodies?.[from] !== undefined) (doc.geometry as { bodies: Record<string, unknown> }).bodies = renameKey(bodies, from, to)
}

/** Remove a part and every reference to it (its pins leave their nets; empty nets go). */
export function deletePart(doc: Scenario, ref: string) {
  delete doc.parts[ref]
  for (const [k, n] of Object.entries(doc.nets)) {
    n.nodes = n.nodes.filter((x) => x.ref !== ref)
    if (!n.nodes.length) delete doc.nets[k]
  }
  for (const q of doc.open_questions || []) q.pins = q.pins.filter((p) => p[0] !== ref)
  for (const b of schBlocks(doc)) {
    if (b.place) delete b.place[ref]
    b.wires = b.wires?.filter((w) => !w.some((step) => typeof step === "string" && step.startsWith(ref + ".")))
  }
  const sch = doc.schematic as Sch | undefined
  if (sch?.parts) delete sch.parts[ref]
  const bodies = (doc.geometry as { bodies?: Record<string, unknown> } | undefined)?.bodies
  if (bodies) delete bodies[ref]
}

/** Rename a net everywhere: traces, power nets, power symbols in the schematic layouts. */
export function renameNet(doc: Scenario, from: string, to: string) {
  if (doc.nets[to]) { // merging into an existing net
    doc.nets[to].nodes.push(...doc.nets[from].nodes)
    for (const old of doc.nets[from].formerly || []) remember(doc.nets[to], old, to)
    delete doc.nets[from]
  } else doc.nets = renameKey(doc.nets, from, to)
  remember(doc.nets[to], from, to)
  for (const t of doc.traces) if (t.net === from) t.net = to
  if (doc.power_nets) doc.power_nets = [...new Set(doc.power_nets.map((n) => (n === from ? to : n)))]
  const fix = (power?: unknown[][]) => power?.forEach((p) => { if (p[0] === from) p[0] = to })
  for (const b of schBlocks(doc)) fix(b.power)
  fix((doc.schematic as Sch | undefined)?.power)
}

/** Remove a net: its pins become unknown, and the traces drawn on it go too. */
export function deleteNet(doc: Scenario, name: string) {
  delete doc.nets[name]
  doc.traces = doc.traces.filter((t) => t.net !== name)
}

/** A reference or net name the build accepts: no spaces and no dots (pins are written REF.PIN). */
export const validName = (s: string) => /^[^\s.]+$/.test(s)

// Part kinds, each with a tag colour (light and dark).
export const KINDS: Record<string, { label: string; cls: string }> = {
  ic: { label: "IC", cls: "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100" },
  transistor: { label: "Transistor", cls: "bg-primary/15 text-primary" },
  diode: { label: "Diode", cls: "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200" },
  led: { label: "LED", cls: "bg-lime-100 text-lime-800 dark:bg-lime-900/60 dark:text-lime-200" },
  resistor: { label: "Resistor", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200" },
  capacitor: { label: "Capacitor", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200" },
  electrolytic: { label: "Electrolytic", cls: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200" },
  inductor: { label: "Inductor", cls: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/60 dark:text-fuchsia-200" },
  switch: { label: "Switch", cls: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200" },
  pad: { label: "Wire pad", cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200" },
}
export const kindOf = (p: Part) =>
  KINDS[p.kind || ""] || { label: p.kind || "Other", cls: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200" }

export const natural = (a: unknown, b: unknown) =>
  String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" })

export const partName = (p: Part, ref: string) => p.label || ref
export const partSides = (p: Part) => (Object.keys(p.box || {}) as Side[]).filter((k) => p.box![k])

// ---- homographies (3x3, row-major)
export const mul3 = (a: Mat3, b: Mat3): Mat3 => a.map((r) => [0, 1, 2].map((j) => r[0] * b[0][j] + r[1] * b[1][j] + r[2] * b[2][j]))
export function inv3(m: Mat3): Mat3 {
  const [[a, b, c], [d, e, f], [g, h, i]] = m
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g
  const det = a * A + b * B + c * C
  return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det], [B / det, (a * i - c * g) / det, -(a * f - c * d) / det], [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]]
}
export const applyH = (m: Mat3, x: number, y: number): [number, number] => {
  const w = m[2][0] * x + m[2][1] * y + m[2][2]
  return [(m[0][0] * x + m[0][1] * y + m[0][2]) / w, (m[1][0] * x + m[1][1] * y + m[1][2]) / w]
}

/** One side as the aligned view shows it: the processed image, with the original photo's
 *  pixels mapped into it. With `readable`, the bottom is mirrored back to be read from below and
 *  turned to match the original photo as shown (its display_rotation). `rotate` then turns the
 *  whole view clockwise, by 0, 90, 180 or 270°. */
export function alignedPhoto(id: string, a: AlignedView, side: Side, raw: Photo, readable = false, rotate = 0): Photo | null {
  const s = a.sides[side]
  if (!s) return null
  const turn180: Mat3 = [[-1, 0, a.width], [0, -1, a.height], [0, 0, 1]]
  let H = s.H
  let sx = 1, sy = 1 // the same flips for the image, as a CSS scale about its centre
  if (readable) {
    H = mul3([[1, 0, 0], [0, -1, a.height], [0, 0, 1]], H) // mirror back: the photo's own handedness
    sy = -1
    // the angle the original photo is turned by here, against the one it is shown at
    const [ox, oy] = applyH(H, raw.size[0] / 2, raw.size[1] / 2), [ux, uy] = applyH(H, raw.size[0] / 2 + 100, raw.size[1] / 2)
    const angle = (Math.atan2(uy - oy, ux - ox) * 180) / Math.PI
    const want = raw.rot || 0
    if (Math.abs(((angle - want + 540) % 360) - 180) > 90) { H = mul3(turn180, H); sx = -sx; sy = -sy } // more than 90° away: turn it
  }
  const q = ((Math.round(rotate / 90) % 4) + 4) % 4
  const W = a.width, Hh = a.height
  const R: Mat3 = [ // clockwise quarter turns of the w by h view, into its new frame
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    [[0, -1, Hh], [1, 0, 0], [0, 0, 1]],
    [[-1, 0, W], [0, -1, Hh], [0, 0, 1]],
    [[0, 1, 0], [-1, 0, W], [0, 0, 1]],
  ][q]
  H = mul3(R, H)
  const [w, h] = q % 2 ? [Hh, W] : [W, Hh]
  const det = Math.abs(H[0][0] * H[1][1] - H[0][1] * H[1][0]) / H[2][2] ** 2
  const css = [q ? `rotate(${q * 90}deg)` : "", sx === 1 && sy === 1 ? "" : `scale(${sx}, ${sy})`].filter(Boolean).join(" ") || undefined
  return { file: raw.file, src: fileUrl(id, s.src), w, h, iw: W, ih: Hh, scale: Math.sqrt(det), size: raw.size, rot: 0, H, Hi: inv3(H), css }
}

/** The style of an image drawn in a view: as is, or turned by `css` about the view's centre. */
export function imageStyle(ph: Photo, css = ph.css): Record<string, string> | undefined {
  if (!css) return undefined
  const iw = ph.iw ?? ph.w, ih = ph.ih ?? ph.h
  if (iw === ph.w && ih === ph.h) return { transform: css }
  return { position: "absolute", left: "50%", top: "50%", width: `${(iw / ph.w) * 100}%`, height: `${(ih / ph.h) * 100}%`, maxWidth: "none", transform: `translate(-50%, -50%) ${css}` }
}

// Photo coordinates (boxes and traces, in the original file's pixels) <-> on-screen view coordinates
// (the embedded, resized photo, possibly turned 180° by display_rotation).
export function toView(ph: Photo, x: number, y: number): [number, number] {
  if (ph.H) return applyH(ph.H, x, y)
  return ph.rot === 180 ? [(ph.size[0] - x) * ph.scale, (ph.size[1] - y) * ph.scale] : [x * ph.scale, y * ph.scale]
}
export function toPhoto(ph: Photo, vx: number, vy: number): [number, number] {
  if (ph.Hi) { const [x, y] = applyH(ph.Hi, vx, vy); return [Math.round(x), Math.round(y)] }
  let x = vx / ph.scale, y = vy / ph.scale
  if (ph.rot === 180) { x = ph.size[0] - x; y = ph.size[1] - y }
  return [Math.round(x), Math.round(y)]
}
export function viewRect(ph: Photo, b: Box): Box {
  if (ph.H) { // a box in the original photo is a quadrilateral here: its bounding box
    const c = [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]].map(([x, y]) => applyH(ph.H!, x, y))
    return [Math.min(...c.map((p) => p[0])), Math.min(...c.map((p) => p[1])), Math.max(...c.map((p) => p[0])), Math.max(...c.map((p) => p[1]))]
  }
  const [ax, ay] = toView(ph, b[0], b[1]), [bx, by] = toView(ph, b[2], b[3])
  return [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)]
}
