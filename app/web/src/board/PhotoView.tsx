// One board photo with its overlay: part boxes, traced copper and, in the editor, handles.
// Zoom (Ctrl/⌘ + wheel, pinch, buttons, double-click) and pan (drag, or wheel while zoomed).
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react"
import { Maximize2, Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { imageStyle, toPhoto, toView, viewRect, type Box, type Photo, type Side } from "@/model"
import { useStore } from "@/store"
import { useEditOps } from "@/board/editOps"

// Every photo on the page (a side can be shown by several panels: 2D, the aligned view), for the
// test hooks to map photo pixels to the screen through the one that is visible.
const shown = new Map<object, { side: Side; svg: SVGSVGElement; ph: Photo }>()
export function visiblePhoto(side: Side): { svg: SVGSVGElement; ph: Photo } | null {
  for (const e of shown.values()) if (e.side === side && e.svg.isConnected && e.svg.checkVisibility({ visibilityProperty: true })) return e
  return null
}
const ZMAX = 10

type Drag = { kind: "move" | "corner" | "point" | "insert"; corner?: string; i: number; start: [number, number]; moved: boolean; box?: Box }
type Pan = { id: number; x: number; y: number; sl: number; st: number; on: boolean }

function svgPoint(svg: SVGSVGElement, ev: { clientX: number; clientY: number }) {
  const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY
  return p.matrixTransform(svg.getScreenCTM()!.inverse())
}

/** `photo` replaces the side's photo (the aligned view passes its processed one); `overlay`
 *  lays another image over it (the other side, see-through). */
export function PhotoView({ side, title, photo, caption, overlay, tools }: {
  side: Side; title?: string; photo?: Photo; caption?: string; overlay?: { src: string; opacity: number; label: string; css?: string } | null; tools?: React.ReactNode
}) {
  const s = useStore()
  const { D, M, highlight, prefs, editing, tool, draft, selection } = s
  const ops = useEditOps()
  const ph = photo || D.photos[side]
  const vp = useRef<HTMLDivElement>(null), stage = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null)
  const zoom = useRef(1)
  const [zl, setZl] = useState(1)
  const drag = useRef<Drag | null>(null), pan = useRef<Pan | null>(null), suppressClick = useRef(false)
  const [panning, setPanning] = useState(false)

  const setZoom = (z: number, cx?: number, cy?: number) => {
    const v = vp.current!, st = stage.current!
    z = Math.min(ZMAX, Math.max(1, z))
    if (cx === undefined || cy === undefined) { cx = v.clientWidth / 2; cy = v.clientHeight / 2 }
    const fx = (v.scrollLeft + cx) / st.offsetWidth, fy = (v.scrollTop + cy) / st.offsetHeight
    zoom.current = z
    st.style.width = `${z * 100}%`
    v.scrollLeft = fx * st.offsetWidth - cx
    v.scrollTop = fy * st.offsetHeight - cy
    setZl(z)
  }
  const key = useRef({})
  useEffect(() => { if (svg.current) shown.set(key.current, { side, svg: svg.current, ph }) })
  useEffect(() => () => { shown.delete(key.current) }, [])
  useEffect(() => {
    const v = vp.current!
    const onWheel = (e: WheelEvent) => {
      const r = v.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) { // pinch on a trackpad, or Ctrl/⌘ + wheel
        e.preventDefault()
        const d = Math.max(-60, Math.min(60, e.deltaMode ? e.deltaY * 16 : e.deltaY))
        setZoom(zoom.current * Math.exp(-d * 0.01), e.clientX - r.left, e.clientY - r.top)
      } else if (zoom.current > 1) { // zoomed: scrolling pans, until the photo's edge
        const sl = v.scrollLeft, st = v.scrollTop
        v.scrollLeft += e.deltaX; v.scrollTop += e.deltaY
        if (v.scrollLeft !== sl || v.scrollTop !== st) e.preventDefault()
      }
    }
    v.addEventListener("wheel", onWheel, { passive: false })
    return () => v.removeEventListener("wheel", onWheel)
  }, [side])

  const selRef = selection?.kind === "part" ? selection.ref : null
  const selTrace = selection?.kind === "trace" ? selection.id : null
  const partKnown = (ref: string) => Object.keys(M.parts[ref].pins).some((p) => M.pinNet[`${ref}.${p}`])
  const any = !!(highlight.refColors || highlight.traceNet || highlight.traceId)

  const onPointerDown = (ev: RPointerEvent<SVGSVGElement>) => {
    const t = ev.target as SVGElement
    if (editing && tool === "select" && t.dataset.drag && ev.button !== 1) {
      if (t.dataset.drag === "point" && (ev.altKey || ev.button === 2)) { ops.deletePoint(+t.dataset.i!); ev.preventDefault(); return }
      const p = svgPoint(svg.current!, ev)
      drag.current = { kind: t.dataset.drag as Drag["kind"], corner: t.dataset.corner, i: +(t.dataset.i ?? 0), start: [p.x, p.y], moved: false }
      svg.current!.setPointerCapture(ev.pointerId)
      ev.preventDefault()
    } else if (ev.button === 0 || ev.button === 1) {
      // anything else may become a pan: it starts once the pointer moves a few pixels
      pan.current = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, sl: vp.current!.scrollLeft, st: vp.current!.scrollTop, on: false }
      if (ev.button === 1) ev.preventDefault()
    }
  }
  const onPointerMove = (ev: RPointerEvent<SVGSVGElement>) => {
    const pn = pan.current
    if (pn && pn.id === ev.pointerId) {
      const dx = ev.clientX - pn.x, dy = ev.clientY - pn.y
      if (!pn.on && Math.hypot(dx, dy) > 4) { pn.on = true; svg.current!.setPointerCapture(ev.pointerId); setPanning(true) }
      if (pn.on) { vp.current!.scrollLeft = pn.sl - dx; vp.current!.scrollTop = pn.st - dy }
      return
    }
    const d = drag.current
    if (!d) return
    const p = svgPoint(svg.current!, ev)
    const dx = p.x - d.start[0], dy = p.y - d.start[1]
    if (!d.moved && Math.hypot(dx, dy) < 3) return
    if (!d.moved) { s.live.begin(); d.moved = true }
    const [px, py] = toPhoto(ph, p.x, p.y)
    const sc = ph.scale
    if (d.kind === "point" || d.kind === "insert") {
      const kind = d.kind
      s.live.edit((a) => {
        const tr = a.traces.find((x) => x.id === selTrace)!
        if (kind === "insert") tr.points.splice(d.i, 0, [px, py])
        else tr.points[d.i] = [px, py]
      })
      d.kind = "point"
    } else if (selRef) {
      const base = d.box || (d.box = M.parts[selRef].box![side]!.slice() as Box)
      let next: Box
      if (d.kind === "move") { // shift in photo pixels, so the box keeps its size exactly
        const [sx, sy] = toPhoto(ph, d.start[0], d.start[1])
        const ddx = px - sx, ddy = py - sy
        next = [base[0] + ddx, base[1] + ddy, base[2] + ddx, base[3] + ddy]
      } else { // corners are named as seen on screen
        let [x0, y0, x1, y1] = viewRect(ph, base)
        const m = 4 * sc
        if (d.corner!.includes("w")) x0 = Math.min(p.x, x1 - m); else x1 = Math.max(p.x, x0 + m)
        if (d.corner!.includes("n")) y0 = Math.min(p.y, y1 - m); else y1 = Math.max(p.y, y0 + m)
        const [ax, ay] = toPhoto(ph, x0, y0), [bx, by] = toPhoto(ph, x1, y1)
        next = [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)]
      }
      s.live.edit((a) => s.setBox(a, selRef, side, next))
    }
  }
  const endPan = () => { pan.current = null; setPanning(false) }
  const onPointerUp = (ev: RPointerEvent<SVGSVGElement>) => {
    const pn = pan.current
    if (pn && pn.id === ev.pointerId) {
      if (pn.on) { suppressClick.current = true; setTimeout(() => { suppressClick.current = false }, 0) }
      endPan()
    }
    drag.current = null
  }
  const onClick = (ev: React.MouseEvent<SVGSVGElement>) => {
    if (suppressClick.current) { suppressClick.current = false; return } // the end of a pan, not a click
    if (editing && tool === "draw") {
      const p = svgPoint(svg.current!, ev)
      ops.addDraftPoint(side, toPhoto(ph, p.x, p.y))
      if (ev.detail >= 2) ops.finishDraft()
      return
    }
    const t = ev.target as SVGElement
    if (t.dataset.trace) s.select({ kind: "trace", id: t.dataset.trace })
    else if (t.dataset.ref) s.select({ kind: "part", ref: t.dataset.ref })
  }
  const onDoubleClick = (ev: React.MouseEvent<SVGSVGElement>) => {
    if (editing && tool === "draw") { ev.preventDefault(); ops.finishDraft(); return }
    if (editing) return // a double-click also ends a trace; zoom with the buttons or a pinch while editing
    const r = vp.current!.getBoundingClientRect()
    setZoom(zoom.current * (ev.shiftKey ? 1 / 2 : 2), ev.clientX - r.left, ev.clientY - r.top)
  }

  const V = (x: number, y: number) => toView(ph, x, y)
  const pts = (points: [number, number][]) => points.map(([x, y]) => V(x, y).join(",")).join(" ")
  const handles: React.ReactNode[] = []
  if (editing && selRef) {
    const b = M.parts[selRef]?.box?.[side]
    if (b) {
      const [x0, y0, x1, y1] = viewRect(ph, b)
      handles.push(<rect key="eb" x={x0} y={y0} width={x1 - x0} height={y1 - y0} className="editbox" data-drag="move" />)
      for (const [x, y, c] of [[x0, y0, "nw"], [x1, y0, "ne"], [x1, y1, "se"], [x0, y1, "sw"]] as const)
        handles.push(<circle key={c} cx={x} cy={y} r={6} className="handle" data-drag="corner" data-corner={c} />)
    }
  }
  if (editing && selTrace) {
    const t = M.traces.find((x) => x.id === selTrace)
    if (t && t.side === side) {
      t.points.forEach(([x, y], i) => {
        const [vx, vy] = V(x, y)
        handles.push(<circle key={"p" + i} cx={vx} cy={vy} r={6} className="handle" data-drag="point" data-i={i}><title>Drag to move; Alt-click or right-click to delete</title></circle>)
      })
      for (let i = 0; i + 1 < t.points.length; i++) {
        const [ax, ay] = V(...t.points[i]), [bx, by] = V(...t.points[i + 1])
        handles.push(<rect key={"m" + i} x={(ax + bx) / 2 - 4} y={(ay + by) / 2 - 4} width={8} height={8} className="handle mid" data-drag="insert" data-i={i + 1}><title>Drag to add a point here</title></rect>)
      }
    }
  }

  return (
    <div className="photo flex min-h-0 flex-1 flex-col gap-1.5" data-side={side}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          {tools}
          {title && <span className="font-semibold">{title}</span>}
          <span className="truncate text-xs text-muted-foreground" id={`cap-${side}`}>
            {caption ?? ph.file + (ph.rot ? ` · turned ${ph.rot}° so the labels read upright` : "")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-xs" data-zoom="-1" title="Zoom out" onClick={() => setZoom(zoom.current / 1.5)}><Minus /></Button>
          <span className="min-w-11 text-center text-xs text-muted-foreground tabular-nums" id={`zl-${side}`}>{Math.round(zl * 100)}%</span>
          <Button variant="outline" size="icon-xs" data-zoom="1" title="Zoom in" onClick={() => setZoom(zoom.current * 1.5)}><Plus /></Button>
          <Button variant="outline" size="xs" data-zoom="0" title="Fit the whole photo" onClick={() => setZoom(1)}><Maximize2 /> Fit</Button>
        </div>
      </div>
      {/* the photo fits the panel: as wide as it can be without being taller than the panel */}
      <div className="flex min-h-0 flex-1 justify-center [container-type:size]">
        <div ref={vp} id={`vp-${side}`} className={cn("viewport relative overflow-hidden rounded-md bg-[var(--photo-bg)]", zl > 1 && "zoomed", panning && "panning")}
          style={{ aspectRatio: `${ph.w} / ${ph.h}`, width: `min(100cqw, calc(100cqh * ${ph.w / ph.h}))` }}>
          <div ref={stage} id={`stage-${side}`} className={cn("stage relative w-full select-none", prefs.labels && "showtags", editing && tool === "draw" && "drawing")}
            style={{ aspectRatio: `${ph.w} / ${ph.h}` }}>
            <img alt={`Board ${side} side`} src={ph.src} className="pointer-events-none block w-full" style={imageStyle(ph)} draggable={false} />
            {overlay && <img alt={overlay.label} src={overlay.src} data-overlay className="pointer-events-none absolute inset-0 size-full" style={{ ...(imageStyle(ph, overlay.css) ?? {}), opacity: overlay.opacity }} draggable={false} />}
            <svg ref={svg} viewBox={`0 0 ${ph.w} ${ph.h}`} data-side={side} className={cn("absolute inset-0 size-full", any && "dim", !prefs.traces && "notraces")}
              onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={endPan}
              onClick={onClick} onDoubleClick={onDoubleClick}
              onContextMenu={(ev) => { if (editing && (ev.target as SVGElement).dataset.drag === "point") ev.preventDefault() }}>
              {Object.entries(M.parts).map(([ref, part]) => {
                const b = part.box?.[side]
                if (!b) return null
                const [x0, y0, x1, y1] = viewRect(ph, b)
                const color = highlight.refColors?.[ref]
                return (
                  <g key={ref}>
                    <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} rx={3} data-ref={ref}
                      className={cn("box", !partKnown(ref) && "unknown", color && "hit")} style={color ? { stroke: color } : undefined}>
                      <title>{`${ref} — ${part.value}`}</title>
                    </rect>
                    <text x={x0 + 2} y={Math.max(14, y0 - 4)} className={cn("tag", color && "hit")} data-ref={ref}>{ref.replace(/^J_/, "")}</text>
                  </g>
                )
              })}
              {M.traces.filter((t) => t.side === side).map((t) => (
                <g key={t.id}>
                  <polyline points={pts(t.points)} className="trace-halo" />
                  <polyline points={pts(t.points)} data-trace={t.id} data-net={t.net}
                    className={cn("trace", highlight.traceNet === t.net && "hit", highlight.traceId === t.id && "sel")}>
                    <title>{`trace ${t.id} · ${t.net} · ${t.evidence || ""}`}</title>
                  </polyline>
                </g>
              ))}
              {handles}
              {draft && draft.side === side && (
                <>
                  <polyline points={pts(draft.points)} className="draft" />
                  {draft.points.map(([x, y], i) => { const [vx, vy] = V(x, y); return <circle key={i} cx={vx} cy={vy} r={5} className="handle" pointerEvents="none" /> })}
                </>
              )}
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
