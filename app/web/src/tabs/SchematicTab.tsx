// Schematic panel: the KiCad export as built, and the layout editor (parts, wires, power symbols).
import { useEffect, useMemo, useRef, useState } from "react"
import { Cable, Maximize2, Minus, MousePointer2, Plus, RotateCcw, Trash2, Undo2, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useDialogs } from "@/components/dialogs"
import { clone } from "@/model"
import { useStore } from "@/store"
import {
  analyseLayout, autoLayout, mirrorPart, movePart, normalizeWires, orthoTo, PDIRS, pinEndsOf, powerShape, r2, snapG,
  type Analysis, type Layout, type Pt, type SchData,
} from "@/schematic/layout"

export const schHooks: { analyse?: () => Analysis; layout?: () => Layout; svg?: () => SVGSVGElement | null; pinEnds?: () => ReturnType<typeof pinEndsOf> } = {}

function KicadView() {
  const { D } = useStore()
  const [z, setZ] = useState(1)
  return (
    <div id="schkicad" className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="icon-xs" variant="outline" data-z="-1" onClick={() => setZ((v) => Math.max(1, v / 1.4))}><Minus /></Button>
        <Button size="icon-xs" variant="outline" data-z="1" onClick={() => setZ((v) => Math.min(6, v * 1.4))}><Plus /></Button>
        <Button size="xs" variant="outline" data-z="0" onClick={() => setZ(1)}><Maximize2 /> Fit</Button>
        <span className="ml-2 text-xs text-muted-foreground">exports/schematic.kicad_sch as exported by kicad-cli when build.sh last ran. Wire colour = confidence; solid = verified, dashed = datasheet or assumed. Open pins are unknown.</span>
      </div>
      <Card className="schem min-h-0 flex-1 overflow-auto p-2.5">
        <div id="schem" className="[&_svg]:h-auto [&_svg]:bg-white" style={{ ["--z" as any]: z }}
          dangerouslySetInnerHTML={{ __html: D.schematicSvg }} />
      </Card>
    </div>
  )
}

function SchEditor({ active }: { active: boolean }) {
  const s = useStore()
  const { D, M, rank, doc } = s
  const dialogs = useDialogs()
  const S = D.schematic as SchData, G = S.geometry, POWER = useMemo(() => new Set(S.powerNets), [S])
  const [tool, setToolState] = useState<"select" | "wire" | "power">("select")
  const [sel, setSel] = useState<{ ref?: string; wire?: number; power?: number } | null>(null)
  const [draft, setDraft] = useState<{ points: Pt[]; hover?: Pt } | null>(null)
  const [zoom, setZoom] = useState(2.5)
  const [powerNet, setPowerNet] = useState(S.powerNets[0])
  const [powerDir, setPowerDir] = useState("D")
  const [msg, setMsg] = useState<string | null>(null)
  const svg = useRef<SVGSVGElement>(null), box = useRef<HTMLDivElement>(null)
  const drag = useRef<{ ref: string; start: Pt; base: Layout; moved: boolean } | null>(null)
  const zoomAnchor = useRef<{ fx: number; fy: number; cx: number; cy: number } | null>(null)

  const auto = useMemo(() => autoLayout(S, M, rank), [S, M, rank])
  const lay: Layout = (doc.schematic as Layout) || auto
  const A = useMemo(() => analyseLayout(S, M, rank, lay), [S, M, rank, lay])
  schHooks.analyse = () => A
  schHooks.layout = () => clone(lay)
  schHooks.svg = () => svg.current
  schHooks.pinEnds = () => pinEndsOf(G, lay)

  const setTool = (t: typeof tool) => { setToolState(t); setDraft(null); setMsg(null) }
  const editLayout = (fn: (l: Layout) => void) => s.mutate((a) => { if (!a.schematic) a.schematic = clone(auto); fn(a.schematic as Layout) })
  const svgMM = (ev: { clientX: number; clientY: number }): Pt => {
    const p = svg.current!.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY
    const q = p.matrixTransform(svg.current!.getScreenCTM()!.inverse())
    return [q.x, q.y]
  }
  const snapPoint = ([x, y]: Pt): Pt => { // pin ends and wire ends within 1.3 mm win; else the grid
    let best: Pt | null = null, bd = 1.3
    for (const e of Object.values(pinEndsOf(G, lay))) { const d = Math.hypot(e.x - x, e.y - y); if (d < bd) { bd = d; best = [e.x, e.y] } }
    for (const w of lay.wires) for (const p of w) { const d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; best = [r2(p[0]), r2(p[1])] } }
    return best || [snapG(x), snapG(y)]
  }
  const finishWire = () => {
    if (!draft) return
    const pts = draft.points.filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1])
    setDraft(null)
    if (pts.length >= 2) editLayout((l) => { l.wires.push(pts); normalizeWires(l) })
  }
  const deleteSel = () => {
    if (sel?.wire !== undefined) { const i = sel.wire; setSel(null); editLayout((l) => { l.wires.splice(i, 1) }) }
    else if (sel?.power !== undefined) { const j = sel.power; setSel(null); editLayout((l) => { l.power.splice(j, 1) }) }
  }
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (/INPUT|SELECT|TEXTAREA/.test((document.activeElement as HTMLElement)?.tagName || "") || document.querySelector("[role=dialog]")) return
      if (e.key === "Escape") setDraft(null)
      else if (e.key === "Enter") finishWire()
      else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSel() }
      else if ((e.key === "m" || e.key === "M") && sel?.ref) { const ref = sel.ref; s.mutate((a) => { a.schematic = mirrorPart(G, lay, ref) }) }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  })
  useEffect(() => { // Ctrl/Cmd + scroll zooms around the pointer
    const b = box.current!
    const onWheel = (ev: WheelEvent) => {
      if (!ev.ctrlKey && !ev.metaKey) return
      ev.preventDefault()
      const r = b.getBoundingClientRect()
      zoomAnchor.current = { fx: (b.scrollLeft + ev.clientX - r.left) / b.scrollWidth, fy: (b.scrollTop + ev.clientY - r.top) / b.scrollHeight, cx: ev.clientX - r.left, cy: ev.clientY - r.top }
      setZoom((z) => Math.min(8, Math.max(0.6, z * (ev.deltaY < 0 ? 1.15 : 1 / 1.15))))
    }
    b.addEventListener("wheel", onWheel, { passive: false })
    return () => b.removeEventListener("wheel", onWheel)
  }, [])
  useEffect(() => {
    const a = zoomAnchor.current, b = box.current!
    if (!a) return
    zoomAnchor.current = null
    b.scrollLeft = a.fx * b.scrollWidth - a.cx; b.scrollTop = a.fy * b.scrollHeight - a.cy
  }, [zoom])

  const onPointerDown = (ev: React.PointerEvent<SVGSVGElement>) => {
    if (tool !== "select") return
    const g = (ev.target as Element).closest<SVGGElement>("[data-ref]")
    if (!g) return
    const ref = g.dataset.ref!
    setSel({ ref }); drag.current = { ref, start: svgMM(ev), base: clone(lay), moved: false }
    svg.current!.setPointerCapture(ev.pointerId); ev.preventDefault()
  }
  const onPointerMove = (ev: React.PointerEvent<SVGSVGElement>) => {
    if (draft) { const p = snapPoint(svgMM(ev)); const path = orthoTo(draft.points[draft.points.length - 1], p); setDraft({ ...draft, hover: path[path.length - 1] }); return }
    const d = drag.current
    if (!d) return
    const [x, y] = svgMM(ev), dx = snapG(x - d.start[0]), dy = snapG(y - d.start[1])
    if (!d.moved && !dx && !dy) return
    if (!d.moved) { s.live.begin(); d.moved = true }
    s.live.edit((a) => { a.schematic = movePart(G, d.base, d.ref, dx, dy) })
  }
  const onClick = (ev: React.MouseEvent<SVGSVGElement>) => {
    const p = snapPoint(svgMM(ev))
    if (tool === "wire") {
      const pts = draft ? [...draft.points, ...orthoTo(draft.points[draft.points.length - 1], p)] : [p]
      if (ev.detail >= 2) {
        setDraft(null)
        const clean = pts.filter((q, i, a) => i === 0 || q[0] !== a[i - 1][0] || q[1] !== a[i - 1][1])
        if (clean.length >= 2) editLayout((l) => { l.wires.push(clean); normalizeWires(l) })
      } else setDraft({ points: pts })
      return
    }
    if (tool === "power") {
      const onEnd = Object.values(pinEndsOf(G, lay)).some((e) => e.x === p[0] && e.y === p[1]) || lay.wires.some((w) => w.some((q) => r2(q[0]) === p[0] && r2(q[1]) === p[1]))
      if (!onEnd) { setMsg("Click exactly on a pin end or a wire end."); return }
      editLayout((l) => { l.power.push([powerNet, p[0], p[1], powerDir]) })
      return
    }
    const t = ev.target as SVGElement
    const pw = t.closest<SVGGElement>("[data-power]")
    if (t.dataset.wire !== undefined) setSel({ wire: +t.dataset.wire })
    else if (pw) setSel({ power: +pw.dataset.power! })
    else if (!t.closest("[data-ref]")) setSel(null)
  }

  const xs = Object.values(lay.parts).map((p) => p[0]), ys = Object.values(lay.parts).map((p) => p[1])
  const vb = [Math.min(...xs) - 30, 30, Math.max(...xs) - Math.min(...xs) + 70, Math.max(...ys) + 10]
  const color = (k: string) => D.confidence[k].color
  const Power = ({ net, x, y, d, stroke }: { net: string; x: number; y: number; d: string; stroke: string }) => {
    const [dx, dy] = PDIRS[d]
    return (
      <>
        {powerShape(net, d).map((line, i) => <polyline key={i} points={line.map(([a, b]) => `${x + a},${y + b}`).join(" ")} className="sch-pwr" stroke={stroke} />)}
        <text x={x + 5.08 * dx} y={y + 3.81 * dy + 0.5} className="sch-ptext" textAnchor="middle">{net}</text>
      </>
    )
  }
  const hint = msg || {
    select: "Drag a part to move it (wires follow); click a wire or power symbol to select it; Delete removes it; M mirrors the selected part.",
    wire: "Click pins or points; corners are added automatically. Double-click or Enter ends the wire; Esc cancels. Ctrl+scroll zooms.",
    power: "Click a pin end or a wire end to place the power symbol.",
  }[tool]

  return (
    <div id="schedit" className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1.5">
        <ToggleGroup type="single" variant="outline" size="sm" value={tool} onValueChange={(v) => v && setTool(v as typeof tool)}>
          <ToggleGroupItem value="select" data-stool="select" className="bg-background px-2.5"><MousePointer2 /> Select / move</ToggleGroupItem>
          <ToggleGroupItem value="wire" data-stool="wire" className="bg-background px-2.5"><Cable /> Draw wire</ToggleGroupItem>
          <ToggleGroupItem value="power" data-stool="power" className="bg-background px-2.5"><Zap /> Power symbol</ToggleGroupItem>
        </ToggleGroup>
        <span id="power-opts" hidden={tool !== "power"} className="inline-flex gap-1">
          <NativeSelect id="power-net" size="sm" className="h-8 bg-background" value={powerNet} onChange={(e) => setPowerNet(e.target.value)}>
            {S.powerNets.map((n) => <NativeSelectOption key={n} value={n}>{n}</NativeSelectOption>)}
          </NativeSelect>
          <NativeSelect id="power-dir" size="sm" className="h-8 bg-background" value={powerDir} onChange={(e) => setPowerDir(e.target.value)}>
            <NativeSelectOption value="D">down</NativeSelectOption><NativeSelectOption value="U">up</NativeSelectOption>
            <NativeSelectOption value="L">left</NativeSelectOption><NativeSelectOption value="R">right</NativeSelectOption>
          </NativeSelect>
        </span>
        <Button id="sch-delete" size="sm" variant="outline" className="bg-background" title="Delete" disabled={sel?.wire === undefined && sel?.power === undefined} onClick={deleteSel}><Trash2 /> Delete selected</Button>
        <Button id="sch-undo" size="sm" variant="outline" className="bg-background" disabled={!s.canUndo} onClick={s.undo}><Undo2 /> Undo</Button>
        <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-6" />
        <Button size="icon-sm" variant="outline" className="bg-background" data-schz="-1" onClick={() => setZoom((z) => Math.min(6, Math.max(0.6, z / 1.4)))}><Minus /></Button>
        <Button size="icon-sm" variant="outline" className="bg-background" data-schz="1" onClick={() => setZoom((z) => Math.min(6, Math.max(0.6, z * 1.4)))}><Plus /></Button>
        <Button id="sch-reset" size="sm" variant="outline" className="bg-background" onClick={async () => {
          if (await dialogs.confirm({ title: "Reset the layout?", body: "Go back to the automatic layout (from schematic_layout in scenario.json).", action: "Reset", danger: true })) s.mutate((a) => { delete a.schematic })
        }}><RotateCcw /> Reset to automatic layout</Button>
      </div>
      <p className="text-xs text-muted-foreground" id="schedit-hint">{hint}</p>
      <div className="grid grid-cols-[minmax(0,1fr)_330px] gap-3">
        <Card ref={box} className="schedit-canvas min-h-0 flex-1 overflow-auto bg-[#f5f4ef] p-0">
          <svg ref={svg} id="schedit-svg" xmlns="http://www.w3.org/2000/svg" viewBox={vb.join(" ")} style={{ width: `${zoom * 100}%` }}
            className={cn("block h-auto select-none", tool !== "select" && "cursor-crosshair")}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onClick={onClick}
            onPointerUp={() => { drag.current = null }}>
            {S.auto.headers.map(([title, x, y]) => <text key={title} x={x} y={y} className="sch-hdr">{title}</text>)}
            {lay.wires.map((w, i) => {
              const id = A.find(w[0]), st = A.styled[id] || { conf: "assumed", net: "?" }
              return (
                <polyline key={i} points={w.map((p) => p.join(",")).join(" ")} data-wire={i} className={cn("sch-wire", sel?.wire === i && "sel")}
                  stroke={A.styled[id] ? color(st.conf) : "#000"} strokeDasharray={rank(st.conf) >= 3 ? undefined : "1.2 0.8"}>
                  <title>{`wire ${i} · ${st.net} (${st.conf})`}</title>
                </polyline>
              )
            })}
            {Object.entries(A.cnt).map(([k, n]) => {
              const [x, y] = k.split(",").map(Number), pin = Object.values(A.ends).some((e) => e.x === x && e.y === y)
              return n >= 3 || (n >= 2 && pin) ? <circle key={k} cx={x} cy={y} r={0.6} className="sch-junction" /> : null
            })}
            {Object.entries(lay.parts).map(([ref, [sx, sy, mir]]) => {
              const geo = G[ref]
              if (!geo || !M.parts[ref]) return null // added or renamed since the last save: drawn once the save returns its geometry
              return (
                <g key={ref} data-ref={ref} className={cn("sch-part", sel?.ref === ref && "sel")}>
                  <rect x={sx - geo.w / 2} y={sy - geo.top} width={geo.w} height={geo.h} className="sch-body" />
                  <text x={sx - geo.w / 2} y={sy - geo.top - 0.8} className="sch-ref">{ref}</text>
                  <text x={sx - geo.w / 2} y={sy - geo.top + geo.h + 2.2} className="sch-val">{M.parts[ref].value}</text>
                  {geo.pins.map(([num, name, px, py, ang]) => {
                    const x = sx + (mir ? -px : px), y = sy - py, inward = (mir ? 180 - ang : ang) === 0 ? 1 : -1
                    const pk = `${ref}.${num}`, pn = M.pinNet[pk]
                    return (
                      <g key={num}>
                        <line x1={x} y1={y} x2={x + inward * 2.54} y2={y} className="sch-pin" />
                        <text x={x + inward * 1.27} y={y - 0.4} className="sch-pnum" textAnchor="middle">{num}</text>
                        {geo.pins.length > 2 && <text x={x + inward * 3.1} y={y + 0.45} className="sch-pname" textAnchor={inward > 0 ? "start" : "end"}>{name}</text>}
                        <circle cx={x} cy={y} r={0.55} data-pin={pk}
                          className={cn("sch-end", pn && !A.wired.has(pk) && !POWER.has(pn.net) && "loose", !pn && "unknown")}>
                          <title>{`${pk} (${name}) · ${pn ? pn.net + ", " + pn.conf : "unknown net"}`}</title>
                        </circle>
                      </g>
                    )
                  })}
                </g>
              )
            })}
            {lay.power.map(([net, x, y, d], j) => (
              <g key={j} data-power={j} className={cn("sch-power", sel?.power === j && "sel")}><Power net={net} x={x} y={y} d={d} stroke="#840000" /></g>
            ))}
            {A.autoPower.map((a) => {
              const dx = PDIRS[a.e.out][0]
              return (
                <g key={a.pk} className="sch-auto">
                  <line x1={a.e.x} y1={a.e.y} x2={a.e.x + dx * 2.54} y2={a.e.y} className="sch-pwr" stroke={color(a.conf)} />
                  <Power net={a.net} x={a.e.x + dx * 2.54} y={a.e.y} d={a.e.out} stroke="#840000" />
                </g>
              )
            })}
            {draft && <polyline points={draft.points.concat(draft.hover ? [draft.hover] : []).map((p) => p.join(",")).join(" ")} className="sch-draft" />}
          </svg>
        </Card>
        <Card id="schedit-problems" className="h-fit gap-2 p-3 text-sm">
          {A.problems.length ? (
            <>
              <b className="text-destructive">{A.problems.length} problem(s): the build will refuse this layout</b>
              <ul className="list-disc space-y-1 pl-5">
                {A.problems.map((p, i) => (
                  <li key={i}>{p.text}{p.fix && (
                    <Button size="xs" variant="outline" className="ml-1 h-auto py-0.5" data-fix={i} onClick={() => {
                      const f = p.fix!, [ref, ...rest] = f.pin.split(".")
                      s.mutate((a) => s.setConnection(a, ref, rest.join("."), f.net, "assumed", "Wired in the schematic editor; not verified."))
                    }}>Add {p.fix.pin} to {p.fix.net} as assumed</Button>
                  )}</li>
                ))}
              </ul>
            </>
          ) : <b className="text-success">No problems: the build will accept this layout.</b>}
          {A.loose.length > 0 && <p>Known but not wired (labelled in KiCad, orange rings): {A.loose.join(", ")}</p>}
          <p className="text-muted-foreground">{A.autoPower.length} power-net pin(s) get an automatic power symbol (shown faded).</p>
        </Card>
      </div>
    </div>
  )
}

export function SchematicTab({ visible = true }: { visible?: boolean }) {
  const [view, setView] = useState<"kicad" | "edit">("kicad")
  return (
    <div className="flex h-full flex-col gap-3 p-3">
      {/* one row, so the note appearing mid-drag does not move the canvas */}
      <div className="flex min-h-8 items-center gap-3">
        <ToggleGroup type="single" variant="outline" size="sm" value={view} onValueChange={(v) => v && setView(v as "kicad" | "edit")} className="shrink-0">
          <ToggleGroupItem value="kicad" data-schview="kicad" className="px-3">KiCad export</ToggleGroupItem>
          <ToggleGroupItem value="edit" data-schview="edit" className="px-3">Edit layout</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {view === "kicad" ? <KicadView /> : <SchEditor active={visible} />}
    </div>
  )
}
