// 3D mode of the Board tab. Built on first use; the scene comes from the last build (outline,
// part bodies, traced copper, textures), while names, nets and the selection are the page's live
// ones, so the side lists, details and filters drive both modes.
import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { partName, type Data3D, type Model } from "@/model"
import { useStore, type Highlight } from "@/store"

declare global {
  interface Window { __ready?: boolean; __project?: (ref: string) => { x: number; y: number }; __lit?: () => string[]; __traces?: () => string[]; __look?: (p: number[], t: number[]) => void }
}

interface Live { M: Model; highlight: Highlight; net: string | null; enabled: Set<string>; rank: (k: string) => number; color: (k: string) => string; labels: boolean; traces: boolean; select: (ref: string) => void }

function build(host: HTMLElement, labelsHost: HTMLElement, tip: HTMLElement, P3: Data3D, live: () => Live) {
  const B = P3.board, T = B.thickness, W = B.width, H = B.height
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  host.prepend(renderer.domElement)
  renderer.domElement.className = "block size-full"
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(35, 1, 0.5, 2000)
  camera.up.set(0, 0, 1)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  scene.add(new THREE.HemisphereLight(0xffffff, 0x94a3b8, 2.2))
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-60, -80, 150); scene.add(sun)
  const under = new THREE.DirectionalLight(0xffffff, 0.9); under.position.set(40, 60, -150); scene.add(under)

  const P = (x: number, y: number) => new THREE.Vector2(x - W / 2, -(y - H / 2)) // board mm (y down) -> scene (y up)
  const shape = new THREE.Shape(B.outline.map(([x, y]) => P(x, y)))
  const boardMats: THREE.Material[] = []
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.8 })
  const ext = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false })
  ext.translate(0, 0, -T / 2)
  scene.add(new THREE.Mesh(ext, [new THREE.MeshBasicMaterial({ visible: false }), sideMat])); boardMats.push(sideMat)
  const loader = new THREE.TextureLoader()
  const faceMats: Record<string, THREE.MeshStandardMaterial> = {}, texCache: Record<string, THREE.Texture> = {}
  const tex = (key: string) => {
    if (!texCache[key]) {
      const t = loader.load(P3.textures[key]); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy()
      texCache[key] = t
    }
    return texCache[key]
  }
  const face = (side: string, z: number, faceSide: THREE.Side) => {
    const g = new THREE.ShapeGeometry(shape, 64)
    const pos = g.attributes.position, uv = new Float32Array(pos.count * 2)
    for (let i = 0; i < pos.count; i++) { uv[2 * i] = (pos.getX(i) + W / 2) / W; uv[2 * i + 1] = (pos.getY(i) + H / 2) / H }
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2))
    const m = new THREE.MeshStandardMaterial({ map: tex(side), roughness: 0.85, side: faceSide })
    boardMats.push(m); faceMats[side] = m
    const mesh = new THREE.Mesh(g, m); mesh.position.z = z; scene.add(mesh)
  }
  face("top", T / 2 + 0.01, THREE.FrontSide)
  face("bottom", -T / 2 - 0.01, THREE.BackSide)
  const setEnhanced = (on: boolean) => {
    for (const side of ["top", "bottom"]) { faceMats[side].map = tex(side + (on ? "_enhanced" : "")); faceMats[side].needsUpdate = true }
  }

  // traced copper
  const traceGroup = new THREE.Group(); scene.add(traceGroup)
  const traceMeshes: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = []
  for (const t of P3.traces) {
    const z = (t.side === "top" ? 1 : -1) * (T / 2 + 0.06)
    const pts = t.points.map(([x, y]) => P(x, y))
    const add = (mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>) => { mesh.userData = { net: t.net, evidence: t.evidence }; traceGroup.add(mesh); traceMeshes.push(mesh) }
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1]
      const seg = new THREE.Mesh(new THREE.BoxGeometry(a.distanceTo(b), 0.9, 0.12),
        new THREE.MeshStandardMaterial({ color: 0xc8823c, metalness: 0.6, roughness: 0.35, emissive: 0x7c3d12, emissiveIntensity: 0.35 }))
      seg.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, z); seg.rotation.z = Math.atan2(b.y - a.y, b.x - a.x); add(seg)
    }
    for (const q of pts) {
      const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 16), new THREE.MeshStandardMaterial({ color: 0xc8823c, metalness: 0.6, roughness: 0.35 }))
      dot.rotation.x = Math.PI / 2; dot.position.set(q.x, q.y, z); add(dot)
    }
  }
  const lightTraces = (net: string | null) => {
    for (const m of traceMeshes) {
      const on = !net || m.userData.net === net
      m.material.transparent = !on; m.material.opacity = on ? 1 : 0.2
      m.material.emissive.setHex(net && on ? 0xf59e0b : 0x7c3d12); m.material.emissiveIntensity = net && on ? 0.9 : 0.35
    }
  }

  // parts
  const groups: Record<string, THREE.Group> = {}, anchors: Record<string, THREE.Vector3> = {}
  const mat = (color: any, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, ...extra })
  const addMesh = (group: THREE.Group, geo: THREE.BufferGeometry, m: THREE.Material, z: number) => { const mesh = new THREE.Mesh(geo, m); mesh.position.z = z; group.add(mesh); return mesh }
  for (const [ref, p] of Object.entries(P3.parts3d)) {
    const b = p.body, s = p.side === "top" ? 1 : -1, base = (s * T) / 2
    const g = new THREE.Group(), c = P(p.x, p.y); g.position.set(c.x, c.y, 0)
    g.userData.ref = ref
    let top = b.h || 1
    if (b.shape === "box") addMesh(g, new THREE.BoxGeometry(b.w, b.l, b.h), mat(b.color), base + (s * b.h) / 2)
    else if (b.shape === "cylinder") {
      const cyl = new THREE.CylinderGeometry(b.d / 2, b.d / 2, b.h, 40); cyl.rotateX(Math.PI / 2)
      addMesh(g, cyl, mat(b.color), base + (s * b.h) / 2)
      const cap = new THREE.CylinderGeometry((b.d / 2) * 0.92, (b.d / 2) * 0.92, 0.3, 40); cap.rotateX(Math.PI / 2)
      addMesh(g, cap, mat("#d4d4d8", { metalness: 0.6 }), base + s * (b.h + 0.1))
    } else if (b.shape === "rod") {
      const rod = new THREE.CylinderGeometry(b.d / 2, b.d / 2, b.len, 24); if (b.axis === "x") rod.rotateZ(Math.PI / 2)
      addMesh(g, rod, mat(b.color, { transparent: true, opacity: 0.9 }), base + (s * b.d) / 2); top = b.d
    } else if (b.shape === "led") {
      const sp = new THREE.CylinderGeometry(2.6, 2.6, b.spacer, 24); sp.rotateX(Math.PI / 2)
      addMesh(g, sp, mat("#111827"), base + b.spacer / 2)
      const len = b.h - b.spacer - 2.5, body = new THREE.CylinderGeometry(2.5, 2.5, len, 32); body.rotateX(Math.PI / 2)
      addMesh(g, body, mat(b.color, { transparent: true, opacity: 0.85, emissive: b.color, emissiveIntensity: 0.15 }), base + b.spacer + len / 2)
      addMesh(g, new THREE.SphereGeometry(2.5, 32, 16), mat(b.color, { transparent: true, opacity: 0.85 }), base + b.spacer + len)
    } else if (b.shape === "button") {
      addMesh(g, new THREE.BoxGeometry(b.w, b.l, b.h), mat("#3f3f46"), base + b.h / 2)
      const stem = new THREE.CylinderGeometry(1.75, 1.75, b.stem - b.h, 24); stem.rotateX(Math.PI / 2)
      addMesh(g, stem, mat(b.color), base + b.h + (b.stem - b.h) / 2); top = b.stem
    } else if (b.shape === "pad") {
      for (const z of [T / 2 + 0.05, -T / 2 - 0.05]) addMesh(g, new THREE.TorusGeometry(1.3, 0.45, 12, 32), mat(b.color, { metalness: 0.7, roughness: 0.3 }), z)
      top = 1
      // the wire leaves the top side and heads away from the board's centre
      const dir = new THREE.Vector2(c.x, c.y).normalize()
      const pts = [[0, 0, T / 2], [0, 0, T / 2 + 3], [dir.x * 10, dir.y * 10, 7], [dir.x * 32, dir.y * 32, 3]].map((v) => new THREE.Vector3(...v))
      const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.7, 10), mat(b.wire, { roughness: 0.4 }))
      wire.userData.ref = ref; g.add(wire)
    }
    g.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial
      const mm = m.clone(); (o as THREE.Mesh).material = mm
      o.userData.base = { opacity: mm.opacity, transparent: mm.transparent, emissive: mm.emissive.getHex(), ei: mm.emissiveIntensity }
    })
    scene.add(g); groups[ref] = g
    anchors[ref] = new THREE.Vector3(c.x, c.y, base + s * (Math.min(top, 4) + 0.6))
  }

  // labels, tooltip, picking
  const labelEls: Record<string, HTMLDivElement> = {}
  for (const ref of Object.keys(groups)) {
    const d = document.createElement("div")
    d.className = "lbl3d"; d.textContent = partName(live().M.parts[ref] || ({} as any), ref); d.style.display = "none"
    labelsHost.append(d); labelEls[ref] = d
  }
  let lit = new Set<string>()
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
  const pick = (ev: { clientX: number; clientY: number }) => {
    const r = renderer.domElement.getBoundingClientRect()
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    for (const hit of ray.intersectObjects(Object.values(groups), true)) {
      let o: THREE.Object3D | null = hit.object
      while (o && !o.userData.ref) o = o.parent
      if (o) return o.userData.ref as string
    }
    return null
  }
  const showTip = (e: PointerEvent, text: string) => {
    const r = host.getBoundingClientRect()
    tip.style.display = "block"; tip.style.left = e.clientX - r.left + 12 + "px"; tip.style.top = e.clientY - r.top + 12 + "px"; tip.textContent = text
  }
  let down: [number, number] | null = null
  const cv = renderer.domElement
  cv.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY] })
  cv.addEventListener("pointerup", (e) => {
    if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) { const ref = pick(e); if (ref && live().M.parts[ref]) live().select(ref) }
  })
  cv.addEventListener("pointermove", (e) => {
    const ref = pick(e)
    if (!ref && traceGroup.visible) {
      const hit = ray.intersectObjects(traceMeshes, false)[0]
      if (hit) { showTip(e, `${hit.object.userData.net} — traced: ${hit.object.userData.evidence}`); cv.style.cursor = ""; return }
    }
    if (!ref) { tip.style.display = "none"; cv.style.cursor = ""; return }
    const p = live().M.parts[ref]
    showTip(e, `${p ? partName(p, ref) : ref} — ${p?.value ?? ""}`); cv.style.cursor = "pointer"
  })
  cv.addEventListener("pointerleave", () => { tip.style.display = "none" })

  // highlighting and ratsnest
  let rats = new THREE.Group(); scene.add(rats)
  const highlight = (colors: Record<string, string> | null, edges: [string, string, string][] = []) => {
    lit = new Set(Object.keys(colors || {}))
    for (const [ref, g] of Object.entries(groups)) g.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return
      const b = o.userData.base, m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial
      if (!colors) { m.transparent = b.transparent; m.opacity = b.opacity; m.emissive.setHex(b.emissive); m.emissiveIntensity = b.ei }
      else if (colors[ref]) { m.transparent = b.transparent; m.opacity = b.opacity; m.emissive.set(colors[ref]); m.emissiveIntensity = 0.75 }
      else { m.transparent = true; m.opacity = 0.18; m.emissive.setHex(b.emissive); m.emissiveIntensity = b.ei }
      m.needsUpdate = true
    })
    scene.remove(rats); rats = new THREE.Group()
    for (const [a, b, color] of edges) {
      rats.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(anchors[a], anchors[b]), 1, 0.35, 8),
        new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.9 })))
      for (const r of [a, b]) { const dot = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 8), new THREE.MeshBasicMaterial({ color, depthTest: false })); dot.position.copy(anchors[r]); rats.add(dot) }
    }
    rats.renderOrder = 10; scene.add(rats)
  }
  const spanningEdges = (nodes: { ref: string; conf: string }[]) => { // minimum spanning tree over the parts of a net (Prim)
    const L = live(), conf: Record<string, string> = {}
    for (const n of nodes) if (!conf[n.ref] || L.rank(n.conf) < L.rank(conf[n.ref])) conf[n.ref] = n.conf
    const refs = Object.keys(conf).filter((r) => anchors[r])
    const inTree = new Set(refs.slice(0, 1)), edges: [string, string, string][] = []
    while (inTree.size < refs.length) {
      let best: [string, string, number] | null = null
      for (const a of inTree) for (const b of refs) if (!inTree.has(b)) { const d = anchors[a].distanceTo(anchors[b]); if (!best || d < best[2]) best = [a, b, d] }
      inTree.add(best![1])
      const weak = L.rank(conf[best![0]]) < L.rank(conf[best![1]]) ? conf[best![0]] : conf[best![1]]
      edges.push([best![0], best![1], L.color(weak)])
    }
    return edges
  }
  const refresh = () => { // mirror the page's selection
    const L = live(), st = L.highlight
    const net = L.net && L.M.nets[L.net] ? L.net : null
    highlight(st.refColors, net ? spanningEdges(L.M.nets[net].nodes.filter((n) => L.enabled.has(n.conf))) : [])
    const tr = st.traceId ? L.M.traces.find((t) => t.id === st.traceId) : null
    lightTraces(st.traceNet || tr?.net || null)
    traceGroup.visible = L.traces
  }

  // views, render loop
  const views: Record<string, [number, number, number]> = { iso: [0, -1.25 * W, 1.15 * W], top: [0, -0.45 * W, 1.75 * W], bottom: [0, -0.45 * W, -1.75 * W] } // framed on the board width
  const setView = (v: string) => { camera.position.set(...views[v]); controls.target.set(0, 0, 0); controls.update() }
  const setXray = (on: boolean) => { for (const m of boardMats) { m.transparent = on; m.opacity = on ? 0.3 : 1; m.depthWrite = !on; m.needsUpdate = true } }
  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(resize); ro.observe(host)
  const v = new THREE.Vector3()
  let visible = false, looping = false
  const frame = () => {
    if (!visible) { looping = false; return }
    controls.update(); renderer.render(scene, camera)
    const all = live().labels, w = host.clientWidth, h = host.clientHeight
    for (const [ref, el] of Object.entries(labelEls)) {
      if (!(all || lit.has(ref))) { el.style.display = "none"; continue }
      v.copy(anchors[ref]).project(camera)
      if (v.z > 1) { el.style.display = "none"; continue }
      el.style.display = "block"; el.classList.toggle("hit", lit.has(ref))
      el.style.left = ((v.x + 1) / 2) * w + "px"; el.style.top = ((1 - v.y) / 2) * h + "px"
    }
    requestAnimationFrame(frame)
  }
  resize(); setView("iso")
  // test hooks (tests/ui3d-test.mjs)
  window.__project = (ref) => {
    const q = anchors[ref].clone().project(camera), r = cv.getBoundingClientRect()
    return { x: r.left + ((q.x + 1) / 2) * r.width, y: r.top + ((1 - q.y) / 2) * r.height }
  }
  window.__lit = () => [...lit].sort()
  window.__traces = () => traceMeshes.filter((m) => m.material.opacity === 1).map((m) => m.userData.net)
  window.__look = (pos, target) => { camera.position.set(...(pos as [number, number, number])); controls.target.set(...(target as [number, number, number])); controls.update() }
  return {
    refresh, setView, setEnhanced, setXray,
    show: () => { visible = true; resize(); if (!looping) { looping = true; requestAnimationFrame(frame) } },
    hide: () => { visible = false },
  }
}

export function Board3D({ visible }: { visible: boolean }) {
  const s = useStore()
  const host = useRef<HTMLDivElement>(null), labels = useRef<HTMLDivElement>(null), tip = useRef<HTMLDivElement>(null)
  const api = useRef<ReturnType<typeof build> | null>(null)
  const [failed, setFailed] = useState(false)
  const [enhanced, setEnhanced] = useState(false), [xray, setXray] = useState(false)
  const liveRef = useRef<Live>(null!)
  liveRef.current = {
    M: s.M, highlight: s.highlight, net: s.selection?.kind === "net" ? s.selection.net : null, enabled: s.enabled, rank: s.rank,
    color: (k) => s.D.confidence[k].color, labels: s.prefs.labels, traces: s.prefs.traces,
    select: (ref) => s.select({ kind: "part", ref }),
  }
  useEffect(() => {
    if (!visible) { api.current?.hide(); return }
    if (!api.current && !failed) {
      if (!s.D3) { setFailed(true); return }
      try { api.current = build(host.current!, labels.current!, tip.current!, s.D3, () => liveRef.current) } catch { setFailed(true); return }
    }
    if (api.current) { api.current.refresh(); api.current.show(); window.__ready = true }
  }, [visible, failed, s.D3])
  useEffect(() => { if (visible) api.current?.refresh() })
  useEffect(() => () => api.current?.hide(), [])
  const B = s.D3?.board
  return (
    <section id="view3d" hidden={!visible}
      className="relative h-full min-h-[240px] overflow-hidden rounded-md border bg-[image:var(--scene-bg)]">
      <div ref={host} className="absolute inset-0" />
      <div className="absolute top-2.5 left-2.5 z-10 flex flex-wrap items-center gap-1.5 rounded-lg border bg-background/90 px-1.5 py-1 shadow-sm backdrop-blur">
        {(["iso", "top", "bottom"] as const).map((v) => (
          <Button key={v} size="xs" variant="ghost" data-view={v} onClick={() => api.current?.setView(v)}>{v === "iso" ? "3D" : v === "top" ? "Top" : "Bottom"}</Button>
        ))}
        <Label className="ml-1 text-xs font-normal" title="Contrast-boosted photos: copper under the solder mask shows as outlines">
          <Switch size="sm" id="enhanced" checked={enhanced} onCheckedChange={(c) => { setEnhanced(c); api.current?.setEnhanced(c) }} /> Enhanced photo
        </Label>
        <Label className="ml-1 text-xs font-normal" title="Make the board see-through, for nets that cross sides">
          <Switch size="sm" id="xray" checked={xray} onCheckedChange={(c) => { setXray(c); api.current?.setXray(c) }} /> X-ray board
        </Label>
      </div>
      <div ref={labels} className="pointer-events-none absolute inset-0 overflow-hidden" id="labels3d" />
      <div ref={tip} id="tip3d" className="pointer-events-none absolute z-20 hidden rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground" />
      {failed && (s.D3
        ? <p className="absolute inset-0 p-8 text-destructive">WebGL is not available in this browser, so the 3D view cannot run. The 2D photos still work.</p>
        : <p id="no3d" className="absolute inset-0 p-8 text-muted-foreground">This scenario has no 3D geometry. Add a <code>geometry</code> section to scenario.json (a straight-on bottom photo, the board outline and points seen on both photos) to build the 3D view.</p>)}
      {B && (
        <div id="note3d" className="pointer-events-none absolute right-2.5 bottom-2 left-2.5 rounded-md bg-background/85 px-2 py-1 text-xs text-muted-foreground">
          {B.width.toFixed(0)} × {B.height.toFixed(0)} mm (scale from {B.scale_source}){B.max_residual_mm != null ? `, top photo fitted within ${B.max_residual_mm} mm` : ", photos aligned automatically"}.
          Positions ±1–2 mm, heights estimated; part positions and copper are from the last build. Lines on a selected net join its parts, not the copper route.
        </div>
      )}
    </section>
  )
}
