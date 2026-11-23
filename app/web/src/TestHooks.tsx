// Hooks for the headless tests (tests/ui-test.mjs, tests/ui3d-test.mjs): read the editor's state,
// wait for the autosave, and map photo and schematic coordinates to the screen.
import { clone, toView, type Side } from "@/model"
import { useStore } from "@/store"
import { visiblePhoto } from "@/board/PhotoView"
import { schHooks } from "@/tabs/SchematicTab"

declare global { interface Window { __editor?: any } }

export function TestHooks() {
  const s = useStore()
  const screen = (svg: SVGSVGElement, x: number, y: number) => {
    const p = svg.createSVGPoint(); p.x = x; p.y = y
    const q = p.matrixTransform(svg.getScreenCTM()!)
    return { x: q.x, y: q.y }
  }
  window.__editor = {
    state: () => clone(s.doc),
    save: () => s.save,
    flush: () => s.flush(),
    mutate: s.mutate,
    investigation: () => ({ walked: clone(s.walked), record: clone(s.record), revision: s.plan?.revision ?? null, reasons: s.updateReasons, suspects: clone(s.suspects), parts: clone(s.partStates) }),
    nets: () => Object.fromEntries(Object.entries(s.M.nets).map(([n, net]) => [n, net.nodes.map((x) => [x.ref, x.pin, x.conf]).sort()])),
    toScreen: (side: Side, x: number, y: number) => { const v = visiblePhoto(side)!; const [vx, vy] = toView(v.ph, x, y); return screen(v.svg, vx, vy) },
    sch: {
      analyse: () => { const A = schHooks.analyse!(); return { problems: A.problems.map((p) => p.text), loose: A.loose, wired: A.wired.size } },
      layout: () => schHooks.layout!(),
      toScreen: (x: number, y: number) => screen(schHooks.svg!()!, x, y),
      pinEnd: (k: string) => schHooks.pinEnds!()[k],
    },
  }
  return null
}
