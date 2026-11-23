// The schematic layout and its rules: the same as schematic.py (analyse, prune_conflicts) so the
// editor reports exactly what the build would refuse.
import { clone, type Model } from "@/model"

export type Pt = [number, number]
export interface Layout { parts: Record<string, [number, number, boolean]>; wires: Pt[][]; power: [string, number, number, string][] }
export interface Geometry { w: number; h: number; top: number; pins: [string, string, number, number, number][] }
export interface SchData { auto: Layout & { headers: [string, number, number][]; right: number }; geometry: Record<string, Geometry>; powerNets: string[] }
export interface PinEnd { x: number; y: number; out: "L" | "R"; ref: string; num: string }
export interface Problem { text: string; wire?: number; power?: number; group?: string; fix?: { pin: string; net: string } | null }
export interface Analysis {
  problems: Problem[]
  find: (p: Pt) => string
  styled: Record<string, { net: string; conf: string }>
  wired: Set<string>
  ends: Record<string, PinEnd>
  cnt: Record<string, number>
  autoPower: { pk: string; e: PinEnd; net: string; conf: string }[]
  loose: string[]
}

export const r2 = (v: number) => Math.round(v * 100) / 100
export const snapG = (v: number) => r2(Math.round(v / 2.54) * 2.54)
export const PDIRS: Record<string, Pt> = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] }
const key = (p: Pt) => `${p[0]},${p[1]}`

export function pinEndsOf(G: SchData["geometry"], lay: Layout): Record<string, PinEnd> {
  const out: Record<string, PinEnd> = {}
  for (const [ref, [sx, sy, mir]] of Object.entries(lay.parts))
    for (const [num, , px, py, ang] of G[ref]?.pins || []) { // a part added or renamed since the last save has no geometry yet
      const x = mir ? -px : px, a = mir ? 180 - ang : ang
      out[`${ref}.${num}`] = { x: r2(sx + x), y: r2(sy - py), out: a === 0 ? "L" : "R", ref, num }
    }
  return out
}

export function analyseLayout(S: SchData, M: Model, rank: (k: string) => number, lay: Layout): Analysis {
  const POWER = new Set(S.powerNets), pinNet = M.pinNet
  const ends = pinEndsOf(S.geometry, lay), pinAt: Record<string, string> = {}
  const problems: Problem[] = []
  for (const [k, e] of Object.entries(ends)) {
    const at = `${e.x},${e.y}`
    if (pinAt[at]) problems.push({ text: `pins ${pinAt[at]} and ${k} touch; move one of the parts` })
    pinAt[at] = k
  }
  const segs: { a: Pt; b: Pt; i: number }[] = [], parent: Record<string, string> = {}
  const find = (x: string) => { if (!(x in parent)) parent[x] = x; while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
  lay.wires.forEach((w, i) => {
    const pts = w.map((p) => [r2(p[0]), r2(p[1])] as Pt)
    if (pts.length < 2) problems.push({ text: `wire ${i}: needs two points`, wire: i })
    for (let k = 0; k + 1 < pts.length; k++) {
      const [a, b] = [pts[k], pts[k + 1]]
      if (a[0] !== b[0] && a[1] !== b[1]) problems.push({ text: `wire ${i}: a segment is diagonal`, wire: i })
      if (a[0] !== b[0] || a[1] !== b[1]) segs.push({ a, b, i })
    }
  })
  const cnt: Record<string, number> = {}
  for (const s of segs) { parent[find(key(s.a))] = find(key(s.b)); for (const p of [s.a, s.b]) cnt[key(p)] = (cnt[key(p)] || 0) + 1 }
  const onSeg = (p: Pt, a: Pt, b: Pt) =>
    (a[0] === b[0] && b[0] === p[0] && Math.min(a[1], b[1]) <= p[1] && p[1] <= Math.max(a[1], b[1])) ||
    (a[1] === b[1] && b[1] === p[1] && Math.min(a[0], b[0]) <= p[0] && p[0] <= Math.max(a[0], b[0]))
  for (const k of Object.keys(cnt)) {
    const p = k.split(",").map(Number) as Pt
    for (const s of segs) if (k !== key(s.a) && k !== key(s.b) && onSeg(p, s.a, s.b)) problems.push({ text: `a wire ends on the middle of wire ${s.i}: split it there`, wire: s.i })
  }
  for (const [pk, e] of Object.entries(ends))
    for (const s of segs)
      if (onSeg([e.x, e.y], s.a, s.b) && key([e.x, e.y]) !== key(s.a) && key([e.x, e.y]) !== key(s.b)) problems.push({ text: `wire ${s.i} runs through pin ${pk}`, wire: s.i })
  const groups: Record<string, { pins: Set<string>; power: number[]; points: Set<string> }> = {}
  const grp = (id: string) => groups[id] || (groups[id] = { pins: new Set(), power: [], points: new Set() })
  for (const k of Object.keys(cnt)) { grp(find(k)).points.add(k); if (pinAt[k]) grp(find(k)).pins.add(pinAt[k]) }
  lay.power.forEach(([net, x, y, d], j) => {
    const k = key([r2(x), r2(y)])
    if (!PDIRS[d]) problems.push({ text: `power symbol ${net}: bad direction ${d}`, power: j })
    if (cnt[k]) grp(find(k)).power.push(j)
    else if (pinAt[k]) { const g = grp("pin:" + k); g.pins.add(pinAt[k]); g.power.push(j); g.points.add(k) }
    else problems.push({ text: `power symbol ${net} is not on a pin or wire end`, power: j })
  })
  const wired = new Set<string>(), styled: Analysis["styled"] = {}
  for (const [id, g] of Object.entries(groups)) {
    const nets = new Set([...g.pins].map((p) => pinNet[p]?.net ?? null).concat(g.power.map((j) => lay.power[j][0])))
    const known = [...nets].filter((n): n is string => n !== null)
    if (known.length > 1) problems.push({ text: `a wire joins nets ${known.sort().join(", ")} (${[...g.pins].sort().join(", ")})`, group: id })
    for (const p of g.pins) if (!pinNet[p]) problems.push({ text: `${p} is wired but its net is unknown`, fix: known.length === 1 ? { pin: p, net: known[0] } : null, group: id })
    if (!g.pins.size && !g.power.length) problems.push({ text: "a wire is not connected to any pin", group: id })
    if (known.length !== 1) continue
    const net = known[0], confs = [...g.pins].map((p) => pinNet[p]?.conf).filter(Boolean) as string[]
    styled[id] = { net, conf: confs.length ? confs.reduce((p, q) => (rank(p) <= rank(q) ? p : q)) : "confirmed" }
    g.pins.forEach((p) => pinNet[p] && wired.add(p))
    if (POWER.has(net) && !g.power.length && g.points.size) problems.push({ text: `wired ${net} group (${[...g.pins].sort().join(", ")}) needs a power symbol`, group: id })
  }
  const placedPower = new Set(lay.power.map(([, x, y]) => key([r2(x), r2(y)])))
  const autoPower: Analysis["autoPower"] = [], loose: string[] = []
  for (const [pk, e] of Object.entries(ends)) {
    const pn = pinNet[pk]
    if (!pn || wired.has(pk) || placedPower.has(key([e.x, e.y]))) continue
    if (POWER.has(pn.net)) autoPower.push({ pk, e, net: pn.net, conf: pn.conf })
    else loose.push(pk)
  }
  return { problems, find: (p) => find(key(p)), styled, wired, ends, cnt, autoPower, loose }
}

/** The hand layout from model.yaml, minus wired groups whose pins no longer share one net (schematic.py prune_conflicts). */
export function autoLayout(S: SchData, M: Model, rank: (k: string) => number): Layout {
  const lay: Layout = { parts: clone(S.auto.parts), wires: clone(S.auto.wires), power: clone(S.auto.power) }
  const A = analyseLayout(S, M, rank, lay)
  const bad = new Set(A.problems.filter((p) => p.group !== undefined && (p.text.includes("joins nets") || p.text.includes("unknown"))).map((p) => p.group))
  if (!bad.size) return lay
  lay.wires = lay.wires.filter((w) => !bad.has(A.find(w[0])))
  lay.power = lay.power.filter(([, x, y]) => !bad.has(A.find([r2(x), r2(y)])) && !bad.has("pin:" + r2(x) + "," + r2(y)))
  return lay
}

const same = (p: Pt, q: Pt) => p[0] === q[0] && p[1] === q[1]

/** Tidy wires after an edit: drop repeated points and back-and-forth spikes, then split a wire
 * wherever another wire ends on its middle (as KiCad does for a T), so every joint is an end point. */
export function normalizeWires(lay: Layout): Layout {
  let wires = lay.wires.map((w) => {
    let pts = w.map((p) => [r2(p[0]), r2(p[1])] as Pt).filter((p, i, a) => i === 0 || !same(p, a[i - 1]))
    for (let changed = true; changed;) {
      changed = false
      for (let i = 1; i + 1 < pts.length; i++) {
        const [a, b, c] = [pts[i - 1], pts[i], pts[i + 1]]
        const colinear = (a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1])
        const back = colinear && (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) < 0
        if (back) { pts.splice(i, 1); pts = pts.filter((p, k, arr) => k === 0 || !same(p, arr[k - 1])); changed = true; break }
      }
    }
    return pts
  }).filter((w) => w.length >= 2)
  const ends = wires.flat() // every vertex: the build treats each as a joint
  wires = wires.map((w) => {
    const out = [w[0]]
    for (let i = 1; i < w.length; i++) {
      const a = w[i - 1], b = w[i]
      const inner = ends.filter((p) => !same(p, a) && !same(p, b) &&
        ((a[0] === b[0] && p[0] === a[0] && Math.min(a[1], b[1]) < p[1] && p[1] < Math.max(a[1], b[1])) ||
         (a[1] === b[1] && p[1] === a[1] && Math.min(a[0], b[0]) < p[0] && p[0] < Math.max(a[0], b[0]))))
      inner.sort((p, q) => Math.hypot(p[0] - a[0], p[1] - a[1]) - Math.hypot(q[0] - a[0], q[1] - a[1]))
      for (const p of inner) if (!same(p, out[out.length - 1])) out.push(p)
      out.push(b)
    }
    return out
  })
  lay.wires = wires
  return lay
}

/** Move a part by (dx, dy); the wires and power symbols on its pins follow, keeping right angles. */
export function movePart(G: SchData["geometry"], base: Layout, ref: string, dx: number, dy: number): Layout {
  const lay = clone(base), before = pinEndsOf(G, base)
  lay.parts[ref] = [r2(lay.parts[ref][0] + dx), r2(lay.parts[ref][1] + dy), lay.parts[ref][2]]
  const after = pinEndsOf(G, lay), moved: Record<string, Pt> = {}
  for (const [k, e] of Object.entries(before)) if (k.startsWith(ref + ".")) moved[`${e.x},${e.y}`] = [after[k].x, after[k].y]
  lay.wires = lay.wires.map((w) => {
    const pts = w.map((p) => moved[`${r2(p[0])},${r2(p[1])}`] || p), out = [pts[0]]
    for (let i = 1; i < pts.length; i++) {
      const a = out[out.length - 1], b = pts[i]
      if (a[0] !== b[0] && a[1] !== b[1]) out.push(moved[`${r2(w[i][0])},${r2(w[i][1])}`] ? [a[0], b[1]] : [b[0], a[1]])
      out.push(b)
    }
    return out.filter((p, i, arr) => i === 0 || p[0] !== arr[i - 1][0] || p[1] !== arr[i - 1][1])
  })
  lay.power = lay.power.map(([n, x, y, d]) => { const m = moved[`${r2(x)},${r2(y)}`]; return m ? [n, m[0], m[1], d] : [n, x, y, d] })
  return normalizeWires(lay)
}

/** Mirror a part; pins swap sides and their wires follow. */
export function mirrorPart(G: SchData["geometry"], base: Layout, ref: string): Layout {
  const before = pinEndsOf(G, base), mirrored = clone(base)
  mirrored.parts[ref][2] = !base.parts[ref][2]
  const after = pinEndsOf(G, mirrored), moved: Record<string, Pt> = {}
  for (const [k, e] of Object.entries(before)) if (k.startsWith(ref + ".")) moved[`${e.x},${e.y}`] = [after[k].x, after[k].y]
  mirrored.wires = base.wires.map((w) => {
    const pts = w.map((p) => moved[`${r2(p[0])},${r2(p[1])}`] || p), out = [pts[0]]
    for (let i = 1; i < pts.length; i++) { const a = out[out.length - 1], b = pts[i]; if (a[0] !== b[0] && a[1] !== b[1]) out.push([b[0], a[1]]); out.push(b) }
    return out
  })
  mirrored.power = base.power.map(([n, x, y, d]) => { const mv = moved[`${r2(x)},${r2(y)}`]; return mv ? [n, mv[0], mv[1], d] : [n, x, y, d] })
  return normalizeWires(mirrored)
}

export function powerShape(net: string, d: string): Pt[][] {
  const [dx, dy] = PDIRS[d], [px, py] = [-dy, dx], at = (a: number, b: number): Pt => [r2(dx * a + px * b), r2(dy * a + py * b)]
  return net === "GND"
    ? [[at(0, 0), at(1.27, 0)], [at(1.27, -1.27), at(1.27, 1.27)], [at(1.9, -0.76), at(1.9, 0.76)], [at(2.5, -0.25), at(2.5, 0.25)]]
    : [[at(0, 0), at(1.27, 0)], [at(1.27, -1.27), at(1.27, 1.27)]]
}

export const orthoTo = (from: Pt, to: Pt): Pt[] => (from[0] === to[0] || from[1] === to[1] ? [to] : [[to[0], from[1]], to])
