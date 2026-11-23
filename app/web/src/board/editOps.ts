// Trace drawing and deletion, shared by the photos, the toolbar, the detail panel and the keyboard.
import { useDialogs } from "@/components/dialogs"
import { deleteNet, deletePart, renameNet, renamePart, validName, type Side } from "@/model"
import { useStore } from "@/store"

export function useEditOps() {
  const s = useStore()
  const dialogs = useDialogs()
  const currentTrace = () => (s.selection?.kind === "trace" ? s.selection.id : null)

  const addDraftPoint = (side: Side, pt: [number, number]) => {
    const d = s.getDraft() || { side, points: [], extend: null }
    if (d.side !== side) { s.setHint("A trace stays on one side: finish it first."); return d }
    const next = { ...d, points: [...d.points, pt] }
    s.setDraft(next)
    return next
  }
  const finishDraft = () => {
    const d = s.getDraft()
    if (!d) return
    s.setDraft(null)
    // a double-click to finish also fires two clicks: drop repeated points
    const points = d.points.filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 3)
    if (d.extend) {
      const id = d.extend
      if (points.length) s.mutate((a) => { a.traces.find((t) => t.id === id)!.points.push(...points) })
      s.setTool("select"); s.select({ kind: "trace", id })
      return
    }
    if (points.length < 2) return
    const id = s.newTraceId()
    const net = s.selection?.kind === "net" ? s.selection.net : Object.keys(s.M.nets)[0]
    s.mutate((a) => { a.traces.push({ id, net, side: d.side, points, evidence: "" }) })
    s.setTool("select"); s.select({ kind: "trace", id })
  }
  const cancelDraft = () => s.setDraft(null)
  const deleteTrace = async (id: string, ask = true) => {
    if (ask && !(await dialogs.confirm({ title: `Delete trace ${id}?`, action: "Delete", danger: true }))) return
    s.mutate((a) => { a.traces = a.traces.filter((t) => t.id !== id) })
    s.select(null)
  }
  const deletePoint = async (i: number) => {
    const id = currentTrace()
    const t = s.doc.traces.find((x) => x.id === id)
    if (!t) return
    if (t.points.length <= 2) {
      if (await dialogs.confirm({ title: `Delete trace ${t.id}?`, body: "A trace needs two points.", action: "Delete trace", danger: true }))
        deleteTrace(t.id, false)
      return
    }
    s.mutate((a) => { a.traces.find((x) => x.id === t.id)!.points.splice(i, 1) })
  }
  const extend = (id: string) => {
    const t = s.M.traces.find((x) => x.id === id)
    if (!t) return
    s.setTool("draw")
    s.setDraft({ side: t.side, points: [], extend: id })
  }
  // ---- parts and nets
  const askName = async (title: string, body: string, taken: (n: string) => boolean): Promise<string | null> => {
    const name = (await dialogs.prompt({ title, body, action: "OK" }))?.trim()
    if (!name) return null
    if (!validName(name)) { await dialogs.confirm({ title: "Not a valid name", body: `“${name}”: use no spaces and no dots.`, action: "OK" }); return null }
    if (taken(name)) { await dialogs.confirm({ title: "Name taken", body: `“${name}” is already used.`, action: "OK" }); return null }
    return name
  }
  const addPart = async () => {
    const ref = await askName("New part", "Reference (for example R12 or U3). It starts with two pins; set its type, value and pins in the details.", (n) => !!s.doc.parts[n])
    if (!ref) return
    s.mutate((d) => {
      d.blocks = d.blocks || {}
      let group = Object.keys(d.blocks)[0]
      if (!group) { group = "other"; d.blocks.other = { title: "Other", col: 0, row: 0 } }
      d.parts[ref] = { value: "", group, pins: { 1: "1", 2: "2" } }
    })
    s.select({ kind: "part", ref })
  }
  const renamePartTo = async (ref: string, to: string) => {
    if (to === ref) return true
    if (!validName(to) || s.doc.parts[to]) {
      await dialogs.confirm({ title: "Cannot rename", body: s.doc.parts[to] ? `${to} is already a part.` : `“${to}”: use no spaces and no dots.`, action: "OK" })
      return false
    }
    s.mutate((d) => renamePart(d, ref, to))
    s.select({ kind: "part", ref: to })
    return true
  }
  const removePart = async (ref: string) => {
    const pins = Object.keys(s.M.parts[ref]?.pins || {}).filter((n) => s.M.pinNet[`${ref}.${n}`]).length
    const body = [pins ? `Its ${pins} known connection(s) go too.` : "", "Its results stay in the record."].filter(Boolean).join(" ")
    if (!(await dialogs.confirm({ title: `Delete ${ref}?`, body, action: "Delete", danger: true }))) return
    s.mutate((d) => deletePart(d, ref))
    s.select(null)
  }
  const renameNetTo = async (name: string, to: string) => {
    if (to === name) return true
    if (!validName(to)) { await dialogs.confirm({ title: "Cannot rename", body: `“${to}”: use no spaces and no dots.`, action: "OK" }); return false }
    if (s.doc.nets[to] && !(await dialogs.confirm({ title: `Merge into ${to}?`, body: `${to} already exists: its pins and ${name}'s become one net.`, action: "Merge" }))) return false
    s.mutate((d) => renameNet(d, name, to))
    s.select({ kind: "net", net: to })
    return true
  }
  const removeNet = async (name: string) => {
    const traces = s.doc.traces.filter((t) => t.net === name).length
    const body = `Its ${s.M.nets[name]?.nodes.length || 0} pin(s) become unknown${traces ? `, and its ${traces} trace(s) are deleted` : ""}.`
    if (!(await dialogs.confirm({ title: `Delete net ${name}?`, body, action: "Delete", danger: true }))) return
    s.mutate((d) => deleteNet(d, name))
    s.select(null)
  }
  return { addDraftPoint, finishDraft, cancelDraft, deleteTrace, deletePoint, extend, currentTrace, addPart, renamePartTo, removePart, renameNetTo, removeNet }
}
