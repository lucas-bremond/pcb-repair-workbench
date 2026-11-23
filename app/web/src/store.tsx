import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useApplyTheme } from "@/theme"
import { clone, deriveModel, fileUrl, loadScenario, makeData, setBox, setConnection, type Box, type BuildStatus, type Data, type Data3D, type Loaded, type Model, type Scenario, type Side, type View } from "@/model"
import { derived, emptyRecord, needsUpdate, walk, type Assessment, type LiveSuspect, type Note, type Plan, type RecordDoc, type RecordList, type Result, type Walk } from "@/investigation"

export type Selection =
  | { kind: "part"; ref: string }
  | { kind: "net"; net: string }
  | { kind: "trace"; id: string }
  | { kind: "question"; id: string }
  | { kind: "block"; key: string }
  | { kind: "scenario" } // its name, board and instruments, in the Details panel
  | null

export type SortKey = "ref" | "type" | "value" | "known" | "tested"
/** Browser preferences (localStorage "pcbmodel-ui"). The panels' arrangement is kept apart, under
 *  "pcbmodel-layout" (workspace/api.ts). */
export interface Prefs {
  theme: "light" | "dark" | "system"
  sidebar?: { collapsed?: boolean; closed?: string[] } // the sidebar folded to a rail; its folded sections
  sort: { key: SortKey; dir: 1 | -1 }
  types: string[]
  side: "" | "top" | "bottom" | "none"
  known: boolean
  labels: boolean
  traces: boolean
}
export const PREFS_KEY = "pcbmodel-ui"
const DEFAULT_PREFS: Prefs = {
  theme: "system", sidebar: {}, sort: { key: "ref", dir: 1 }, types: [], side: "", known: false, labels: false, traces: true,
}
export function loadPrefs(): Prefs {
  try {
    const p = { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") }
    if (!p.sort || !p.sort.key) p.sort = DEFAULT_PREFS.sort
    for (const old of ["tab", "mode", "aligned", "closed", "layout", "detailFolded", "investigate"]) delete p[old] // from the tabbed layout
    return p
  } catch { return { ...DEFAULT_PREFS } }
}

export interface Highlight { refColors: Record<string, string> | null; traceNet: string | null; traceId: string | null }
export interface Draft { side: Side; points: [number, number][]; extend: string | null }
export interface SaveState {
  state: "saved" | "pending" | "saving" | "error" | "conflict"
  errors: string[]
  warnings: string[]
  message?: string
}

interface Store {
  id: string
  doc: Scenario
  loaded: Scenario // the scenario as it was when the page loaded, to mark what changed since
  D: Data
  D3: Data3D | null
  M: Model
  rank: (k: string) => number
  levels: string[] // strongest first
  enabled: Set<string>
  selection: Selection
  select: (s: Selection) => void
  highlight: Highlight
  prefs: Prefs
  setPrefs: (p: Partial<Prefs> | ((p: Prefs) => Partial<Prefs>)) => void
  search: string
  setSearch: (s: string) => void
  // ---- editing: every change goes to scenario.json (autosaved)
  editing: boolean
  setEditing: (on: boolean) => void
  tool: "select" | "draw"
  setTool: (t: "select" | "draw") => void
  draft: Draft | null
  setDraft: (d: Draft | null) => void
  getDraft: () => Draft | null
  hint: string | null
  setHint: (h: string | null) => void
  mutate: (fn: (doc: Scenario) => void) => void
  /** Live edits during a drag: call begin() once (one undo step), then edit(fn) on every move. */
  live: { begin: () => void; edit: (fn: (doc: Scenario) => void) => void }
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  save: SaveState
  /** Save now (tests and before leaving); resolves when nothing is left to save. */
  flush: () => Promise<SaveState>
  setBox: (doc: Scenario, ref: string, side: Side, value: Box | null) => void
  setConnection: (doc: Scenario, ref: string, pin: string, net: string | null, conf: string, evidence: string) => void
  newTraceId: () => string
  // ---- the investigation: plan.json (the agent's, read-only) and record.json (added to via the server)
  plan: Plan | null
  record: RecordDoc
  status: BuildStatus // the last build: the model's fingerprint, plan.json's problems
  walked: Walk
  suspects: LiveSuspect[]
  partStates: Record<string, Assessment>
  updateReasons: string[] // why the plan skill should run again (empty: the plan is current)
  /** Add an observation, instruction or result (the server numbers it); resolves to the saved entry. */
  addRecord: <T extends Note | Result>(list: RecordList, entry: Omit<T, "id" | "date"> & { date?: string }) => Promise<T>
  voidRecord: (list: RecordList, id: string, reason: string) => Promise<void>
  /** Which step the Investigate tab shows (null: the current one). */
  viewStep: string | null
  setViewStep: (id: string | null) => void
}
const Ctx = createContext<Store | null>(null)
export const useStore = () => useContext(Ctx)!

const SAVE_DELAY_MS = 600

const POLL_MS = 3000

export function StoreProvider({ initial, children }: { initial: Loaded; children: ReactNode }) {
  const id = initial.id
  const [loaded] = useState(() => clone(initial.doc))
  const [doc, setDoc] = useState<Scenario>(() => ({ ...clone(initial.doc), traces: clone(initial.doc.traces || []) }))
  const [view, setView] = useState<View | null>(initial.view)
  const [plan, setPlan] = useState<Plan | null>(initial.plan)
  const [record, setRecordState] = useState<RecordDoc>(() => ({ ...emptyRecord(), ...(initial.record || {}) }))
  const [status, setStatus] = useState<BuildStatus>(initial.status)
  const [viewStep, setViewStep] = useState<string | null>(null)
  const planEtag = useRef(initial.planEtag), recordEtag = useRef(initial.recordEtag)
  const [D3] = useState<Data3D | null>(() => {
    if (!initial.data3d) return null
    const d = clone(initial.data3d)
    for (const k of Object.keys(d.textures)) d.textures[k] = fileUrl(id, d.textures[k])
    return d
  })
  const docRef = useRef(doc)
  docRef.current = doc
  const undoStack = useRef<string[]>([]), redoStack = useRef<string[]>([])
  const [canUndo, setCanUndo] = useState(false), [canRedo, setCanRedo] = useState(false)

  // ---- autosave: PUT the whole document a moment after the last change; one request at a time
  const [save, setSaveState] = useState<SaveState>(() => ({
    state: initial.status.ok ? "saved" : "error", errors: initial.status.ok ? [] : initial.status.errors, warnings: initial.status.warnings || [],
  }))
  const etag = useRef(initial.etag)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlight = useRef<Promise<void> | null>(null)
  const dirty = useRef(false)
  const saveRef = useRef(save) // the current state, updated at once (flush() reads it before React renders)
  const setSave = useCallback((next: SaveState | ((s: SaveState) => SaveState)) => {
    saveRef.current = typeof next === "function" ? next(saveRef.current) : next
    setSaveState(saveRef.current)
  }, [])
  const putOnce = useCallback(async () => {
    dirty.current = false
    const sent = docRef.current
    setSave((s) => ({ ...s, state: "saving" }))
    let r: Response, body: any
    try {
      r = await fetch(`api/scenarios/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doc: sent, etag: etag.current }) })
      body = await r.json().catch(() => ({}))
    } catch (e: any) {
      dirty.current = true
      setSave((s) => ({ ...s, state: "error", errors: [`Could not reach the server: ${e.message}`] }))
      return
    }
    if (r.ok) {
      etag.current = body.etag
      if (body.view) setView(body.view)
      if (body.status) setStatus(body.status)
      setSave({ state: dirty.current ? "pending" : "saved", errors: [], warnings: body.status?.warnings || [] })
    } else if (r.status === 409) {
      setSave({ state: "conflict", errors: [], warnings: [], message: body.error })
    } else {
      setSave({ state: "error", errors: body.status?.errors || [body.error || `${r.status} ${r.statusText}`], warnings: body.status?.warnings || [] })
    }
  }, [id])
  const run = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    if (inFlight.current || saveRef.current.state === "conflict") return
    inFlight.current = (async () => {
      do await putOnce(); while (dirty.current && !["error", "conflict"].includes(saveRef.current.state))
    })().finally(() => { inFlight.current = null })
  }, [putOnce])
  const schedule = useCallback(() => {
    dirty.current = true
    setSave((s) => (s.state === "conflict" ? s : { ...s, state: inFlight.current ? s.state : "pending" }))
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(run, SAVE_DELAY_MS)
  }, [run])
  const flush = useCallback(async () => {
    if (dirty.current && !inFlight.current) run()
    while (inFlight.current) await inFlight.current
    if (dirty.current && !["error", "conflict"].includes(saveRef.current.state)) { run(); while (inFlight.current) await inFlight.current }
    return saveRef.current
  }, [run])
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current || inFlight.current) e.preventDefault() }
    addEventListener("beforeunload", warn)
    return () => removeEventListener("beforeunload", warn)
  }, [])

  const commit = useCallback((next: Scenario) => { docRef.current = next; setDoc(next); schedule() }, [schedule])
  const mutate = useCallback((fn: (d: Scenario) => void) => {
    undoStack.current.push(JSON.stringify(docRef.current)); redoStack.current = []
    const next = clone(docRef.current)
    fn(next)
    setCanUndo(true); setCanRedo(false)
    commit(next)
  }, [commit])
  const live = useMemo(() => ({
    begin: () => { undoStack.current.push(JSON.stringify(docRef.current)); redoStack.current = []; setCanUndo(true); setCanRedo(false) },
    edit: (fn: (d: Scenario) => void) => { const next = clone(docRef.current); fn(next); commit(next) },
  }), [commit])
  const undo = useCallback(() => {
    const prev = undoStack.current.pop()
    if (!prev) return
    redoStack.current.push(JSON.stringify(docRef.current))
    setCanUndo(undoStack.current.length > 0); setCanRedo(true)
    commit(JSON.parse(prev))
  }, [commit])
  const redo = useCallback(() => {
    const next = redoStack.current.pop()
    if (!next) return
    undoStack.current.push(JSON.stringify(docRef.current))
    setCanUndo(true); setCanRedo(redoStack.current.length > 0)
    commit(JSON.parse(next))
  }, [commit])

  // ---- the record: one entry at a time through the server, which numbers it and checks the file
  const recordCall = useCallback(async (body: object) => {
    const r = await fetch(`api/scenarios/${id}/record`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const out = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(out.status?.errors?.join("; ") || out.error || `${r.status} ${r.statusText}`)
    recordEtag.current = out.recordEtag
    setRecordState({ ...emptyRecord(), ...out.record })
    if (out.status) setStatus((s) => ({ ...s, plan: out.status.plan, fingerprint: out.status.fingerprint ?? s.fingerprint }))
    return out.entry
  }, [id])
  const addRecord = useCallback(<T extends Note | Result>(list: RecordList, entry: Omit<T, "id" | "date"> & { date?: string }) =>
    recordCall({ op: "add", list, entry: { date: new Date().toLocaleDateString("sv-SE"), time: new Date().toTimeString().slice(0, 8), ...entry } }) as Promise<T>, [recordCall])
  const voidRecord = useCallback(async (list: RecordList, entryId: string, reason: string) => {
    await recordCall({ op: "void", list, id: entryId, reason, date: new Date().toLocaleDateString("sv-SE") })
  }, [recordCall])

  // ---- the agent works on the same folder: pick up its plan.json, and its scenario.json edits when
  // nothing is waiting to be saved here (otherwise the next save reports the conflict)
  useEffect(() => {
    let stop = false
    const tick = async () => {
      if (stop || document.hidden) return
      const r = await fetch(`api/scenarios/${id}/etags`, { cache: "no-cache" }).catch(() => null)
      const tags = r?.ok ? await r.json() : null
      if (!tags || stop) return
      const scenarioChanged = tags.scenario !== etag.current
      const clean = !dirty.current && !inFlight.current && saveRef.current.state === "saved"
      if (tags.plan === planEtag.current && tags.record === recordEtag.current && !(scenarioChanged && clean)) return
      const fresh = await loadScenario(id).catch(() => null)
      if (!fresh || stop) return
      planEtag.current = fresh.planEtag
      recordEtag.current = fresh.recordEtag
      setPlan(fresh.plan)
      setRecordState({ ...emptyRecord(), ...(fresh.record || {}) })
      setStatus(fresh.status)
      if (fresh.etag !== etag.current && !dirty.current && !inFlight.current && saveRef.current.state === "saved") {
        etag.current = fresh.etag
        undoStack.current = []; redoStack.current = []; setCanUndo(false); setCanRedo(false)
        docRef.current = { ...fresh.doc, traces: fresh.doc.traces || [] }
        setDoc(docRef.current)
        if (fresh.view) setView(fresh.view)
      }
    }
    const t = setInterval(tick, POLL_MS)
    return () => { stop = true; clearInterval(t) }
  }, [id])

  const walked = useMemo(() => walk(plan, record), [plan, record])
  const { suspects, parts: partStates } = useMemo(() => (plan ? derived(plan, record) : { suspects: [], parts: {} }), [plan, record])
  const updateReasons = useMemo(() => (plan ? needsUpdate(plan, status.fingerprint, record, walked) : []), [plan, status.fingerprint, record, walked])

  const D = useMemo(() => makeData(id, doc, view), [id, doc, view])
  const M = useMemo(() => deriveModel(doc), [doc])
  const rank = useCallback((k: string) => D.confidence[k]?.rank ?? 0, [D])
  const levels = useMemo(() => Object.keys(D.confidence).sort((a, b) => rank(b) - rank(a)), [D, rank])
  const enabled = useMemo(() => new Set(Object.keys(D.confidence)), [D])
  const [selection, select] = useState<Selection>(null)
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs)
  const setPrefs = useCallback((p: Partial<Prefs> | ((p: Prefs) => Partial<Prefs>)) =>
    setPrefsState((old) => ({ ...old, ...(typeof p === "function" ? p(old) : p) })), [])
  useEffect(() => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch { /* page-only */ } }, [prefs])
  useApplyTheme(prefs.theme)
  const [search, setSearch] = useState("")

  const [editing, setEditingState] = useState(false)
  const [tool, setToolState] = useState<"select" | "draw">("select")
  const [draft, setDraftState] = useState<Draft | null>(null)
  const draftRef = useRef<Draft | null>(null)
  const setDraft = useCallback((d: Draft | null) => { draftRef.current = d; setDraftState(d) }, [])
  const getDraft = useCallback(() => draftRef.current, [])
  const [hint, setHint] = useState<string | null>(null)
  const setTool = useCallback((t: "select" | "draw") => { setToolState(t); setHint(null); if (t !== "draw") setDraft(null) }, [setDraft])
  const setEditing = useCallback((on: boolean) => { setEditingState(on); setTool("select") }, [setTool])

  const newTraceId = useCallback(() => {
    const n = Math.max(0, ...(docRef.current.traces || []).map((t) => +((String(t.id).match(/\d+/) || ["0"])[0])))
    return "t" + (n + 1)
  }, [])

  const highlight = useMemo<Highlight>(() => {
    const none: Highlight = { refColors: null, traceNet: null, traceId: null }
    const s = selection
    if (!s) return none
    const color = (k: string) => D.confidence[k].color
    if (s.kind === "net") {
      const net = M.nets[s.net]
      if (!net) return none
      const best: Record<string, string> = {}
      for (const n of net.nodes.filter((n) => enabled.has(n.conf)))
        if (!best[n.ref] || rank(n.conf) < rank(best[n.ref])) best[n.ref] = n.conf
      return { refColors: Object.fromEntries(Object.entries(best).map(([r, c]) => [r, color(c)])), traceNet: s.net, traceId: null }
    }
    if (s.kind === "part") {
      const p = M.parts[s.ref]
      if (!p) return none
      const colors: Record<string, string> = { [s.ref]: "#6366f1" }
      const power = new Set(doc.power_nets || []) // everything is on ground: sharing it says nothing
      for (const num of Object.keys(p.pins)) {
        const pn = M.pinNet[`${s.ref}.${num}`]
        if (pn && enabled.has(pn.conf) && !power.has(pn.net))
          for (const n of M.nets[pn.net].nodes) if (n.ref !== s.ref && enabled.has(n.conf)) colors[n.ref] ||= "#f59e0b"
      }
      return { ...none, refColors: colors }
    }
    if (s.kind === "trace") {
      const t = M.traces.find((x) => x.id === s.id)
      if (!t) return none
      const colors: Record<string, string> = {}
      for (const n of M.nets[t.net]?.nodes || []) colors[n.ref] = color(n.conf)
      return { ...none, refColors: colors, traceId: s.id }
    }
    if (s.kind === "scenario") return none
    if (s.kind === "question") {
      const q = D.questions.find((x) => x.id === s.id)
      return q ? { ...none, refColors: Object.fromEntries(q.pins.map(([r]) => [r, "#dc2626"])) } : none
    }
    return {
      ...none,
      refColors: Object.fromEntries(Object.keys(M.parts).filter((r) => M.parts[r].group === s.key).map((r) => [r, "#6366f1"])),
    }
  }, [selection, M, enabled, D, rank, doc.power_nets])

  const store: Store = {
    id, doc, loaded, D, D3, M, rank, levels, enabled, selection, select, highlight, prefs, setPrefs, search, setSearch,
    editing, setEditing, tool, setTool, draft, setDraft, getDraft, hint, setHint,
    mutate, live, canUndo, canRedo, undo, redo, save, flush, setBox, setConnection, newTraceId,
    plan, record, status, walked, suspects, partStates, updateReasons, addRecord, voidRecord, viewStep, setViewStep,
  }
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}
