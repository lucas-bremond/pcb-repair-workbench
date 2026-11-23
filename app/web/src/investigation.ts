// The investigation: plan.json (the agent's, read-only here) and record.json (the user's, added to
// through the server). The page only looks things up: which branch an answer selects, whether a
// reading is in a range the plan gives, which result is in force. app/scripts/investigation.py
// walks the tree the same way (the 2D test checks they agree). Format: docs/scenario-format.md.

export type Outcome = "pass" | "fail" | "inconclusive"
export type ResultOutcome = Outcome | "not_done" | "disputed" | "skipped"
export type PartStatus = "ok" | "cleared" | "suspect" | "faulty" | "untestable"
export type Unit = "Ω" | "V" | "A" | "F" | "°C" | ""

export interface Target { ref?: string; net?: string; pins?: [string, string][] }
export interface Reading { key: string; label: string; unit: Unit; hint?: string; optional?: boolean }
export interface Expect { text: string; basis: "marking" | "datasheet" | "same_board" | "earlier" | "physics" | "rule_of_thumb" | "none"; source?: string }
export interface Condition { reading?: string; min?: number; max?: number; is?: "OL"; items?: "all_pass" | "any_fail" | "otherwise" }
export type SuspectChange = "ruled_out" | "confirmed" | "more_likely" | "less_likely"
export interface PartEffect { refs: string[]; status: PartStatus; of?: string; note?: string }
export interface Effects { suspects?: Record<string, SuspectChange>; parts?: PartEffect[] }
export interface Answer { id: string; label: string; outcome?: Outcome; when?: Condition[]; means?: string; effects?: Effects; next?: string }
export interface Probe { lead: "red" | "black" | "any"; ref?: string; pin?: string; net?: string }
export interface Protocol {
  title: string
  applies_to?: string[]
  goal: string
  instruments: string[]
  power: "off" | "on"
  steps: { text: string; reading?: Reading }[]
  expect?: Expect
  limits?: string
  answers: Answer[]
}
export interface SweepItem { id: string; target: Target; probes?: Probe[]; expect?: Expect; answers?: Answer[] }
export type StepKind = "check" | "measure" | "sweep" | "action" | "replan" | "done"
export interface Step {
  phase: string
  kind: StepKind
  title: string
  target?: Target
  protocol?: string
  probes?: Probe[]
  setup?: string[]
  power?: "off" | "on"
  warning?: string
  instruction?: string
  readings?: Reading[]
  instruments?: string[]
  expect?: Expect
  why?: string
  risk?: "none" | "low" | "medium" | "high"
  minutes?: number
  question?: string
  skip?: string
  answers?: Answer[]
  items?: SweepItem[]
}
export interface Suspect {
  id: string
  title: string
  parts?: string[]
  mode?: "short" | "open" | "degraded" | "dead" | "connection" | "other"
  status: "open" | "ruled_out" | "confirmed"
  why?: string
  evidence?: { for?: string[]; against?: string[] }
}
export interface Assessment { status: PartStatus; of?: string; evidence?: string[]; note?: string }
export interface Plan {
  format: "pcb-plan"
  version: 2
  revision: number
  date: string
  based_on: { model: string; observations: string | null; instructions: string | null; results: string | null; voided: number }
  summary: string
  warning?: string
  findings?: { id: string; title: string; text?: string; evidence?: string[] }[]
  suspects?: Suspect[]
  assessment?: Record<string, Assessment>
  protocols: Record<string, Protocol>
  phases: { id: string; title: string; goal?: string }[]
  start: string
  steps: Record<string, Step>
  history: { revision: number; date: string; reason: string; changes: string; model_changes?: string[]; replies?: Record<string, string> }[]
}
export interface Void { date: string; reason: string }
export interface Note { id: string; date: string; time?: string; text: string; about?: Target[]; step?: string; photos?: string[]; void?: Void }
export interface Result {
  id: string
  date: string
  time?: string
  plan_revision?: number
  step?: string
  item?: string
  target?: Target
  protocol?: string
  conditions?: { power?: "off" | "on"; in_circuit?: boolean; notes?: string }
  readings?: Record<string, string>
  answer?: string
  outcome: ResultOutcome
  effects?: Effects
  notes?: string
  photos?: string[]
  supersedes?: string
  void?: Void
}
export interface RecordDoc { format: "pcb-record"; version: 2; observations: Note[]; instructions: Note[]; results: Result[] }
export type RecordList = "observations" | "instructions" | "results"

export const emptyRecord = (): RecordDoc => ({ format: "pcb-record", version: 2, observations: [], instructions: [], results: [] })
export const num = (id: string | null | undefined) => (id ? +id.slice(1) || 0 : 0)
export const today = () => new Date().toLocaleDateString("sv-SE") // YYYY-MM-DD, local time

// ---------------------------------------------------------------- readings

const PREFIX: Record<string, number> = { p: 1e-12, n: 1e-9, u: 1e-6, µ: 1e-6, μ: 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9 }

/** A meter reading in base units: "4.7k", "4k7", "0.62 V", "100n", "OL" (Infinity). NaN when
 *  unreadable. A lone "m" is milli, except for resistance, where meters show M for mega. */
export function parseReading(text: string, unit: Unit = ""): number {
  const t = String(text).trim().replace(/,/g, ".").replace(/\s+/g, "")
  if (!t) return NaN
  if (/^(ol|o\.l\.?|open|inf|∞)$/i.test(t)) return Infinity
  const mult = (p: string) => (p === "m" && unit === "Ω" ? 1e6 : PREFIX[p] ?? 1)
  const embedded = t.match(/^(\d+)([pnuµμmkKMG])(\d+)[ΩVFA]?$/) // 4k7, 2u2
  if (embedded) return parseFloat(`${embedded[1]}.${embedded[3]}`) * mult(embedded[2])
  const m = t.match(/^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)([pnuµμmkKMG]?)(?:Ω|ohms?|V|F|A|°C)?$/i)
  if (!m) return NaN
  return parseFloat(m[1]) * (m[2] ? mult(m[2]) : 1)
}

/** A value for display: 4700 Ω -> "4.7 kΩ", 4.7e-5 F -> "47 µF". */
export function fmt(v: number, unit: string): string {
  if (!Number.isFinite(v)) return "OL"
  if (v === 0) return `0 ${unit}`
  const steps: [number, string][] = [[1e9, "G"], [1e6, "M"], [1e3, "k"], [1, ""], [1e-3, "m"], [1e-6, "µ"], [1e-9, "n"], [1e-12, "p"]]
  const [f, p] = steps.find(([f]) => Math.abs(v) >= f) || steps[steps.length - 1]
  return `${+(v / f).toPrecision(3)} ${p}${unit}`
}

export function conditionHolds(c: Condition, readings: Record<string, string>, units: Record<string, Unit>): boolean {
  if (!c.reading) return false
  const v = parseReading(readings[c.reading] ?? "", units[c.reading] ?? "")
  if (Number.isNaN(v)) return false
  if (c.is === "OL" && v !== Infinity) return false
  if (c.min !== undefined && !(v >= c.min)) return false
  return !(c.max !== undefined && !(v <= c.max))
}

/** The first answer whose conditions all hold (an answer without conditions never matches). */
export function matchAnswer(answers: Answer[], readings: Record<string, string>, units: Record<string, Unit>): Answer | null {
  return answers.find((a) => a.when?.length && a.when.every((c) => conditionHolds(c, readings, units))) || null
}

function sweepHolds(c: Condition, outcomes: ResultOutcome[]): boolean {
  if (c.items === "all_pass") return outcomes.length > 0 && outcomes.every((o) => o === "pass")
  if (c.items === "any_fail") return outcomes.some((o) => o === "fail")
  return c.items === "otherwise"
}

/** The first sweep answer whose item conditions hold; one without conditions always does. */
export function matchSweep(answers: Answer[], outcomes: ResultOutcome[]): Answer | null {
  return answers.find((a) => !a.when?.length || a.when.every((c) => sweepHolds(c, outcomes))) || null
}

// ---------------------------------------------------------------- the plan's steps

export const protocolOf = (plan: Plan, step: Step) => (step.protocol ? plan.protocols[step.protocol] : undefined)
export function stepReadings(plan: Plan, step: Step): Reading[] {
  if (step.readings?.length) return step.readings
  return (protocolOf(plan, step)?.steps || []).flatMap((s) => (s.reading ? [s.reading] : []))
}
export const stepAnswers = (plan: Plan, step: Step): Answer[] => (step.answers?.length ? step.answers : protocolOf(plan, step)?.answers || [])
export const itemAnswers = (plan: Plan, step: Step, item: SweepItem): Answer[] => (item.answers?.length ? item.answers : protocolOf(plan, step)?.answers || [])
export const unitsOf = (readings: Reading[]) => Object.fromEntries(readings.map((r) => [r.key, r.unit])) as Record<string, Unit>

export const live = (record: RecordDoc) => record.results.filter((r) => !r.void)
const key = (step: string, item?: string) => `${step}\u0000${item ?? ""}`

/** The result in force per step (and sweep item): the latest that is not void. */
export function inForce(record: RecordDoc): Map<string, Result> {
  const m = new Map<string, Result>()
  for (const r of live(record)) if (r.step) m.set(key(r.step, r.item), r)
  return m
}
export const resultFor = (force: Map<string, Result>, step: string, item?: string) => force.get(key(step, item))

export interface PathEntry { step: string; result: Result | null; answer: string | null }
export interface Walk { path: PathEntry[]; current: string | null; state: "step" | "replan" | "done" | "blocked" | "none"; flag: string | null }

/** Follow the user's answers from plan.start. The current step is the first one without a usable
 *  answer; it is not part of the path. */
export function walk(plan: Plan | null, record: RecordDoc): Walk {
  if (!plan) return { path: [], current: null, state: "none", flag: null }
  const force = inForce(record)
  const path: PathEntry[] = []
  const seen = new Set<string>()
  let cur = plan.start
  for (;;) {
    const step = plan.steps[cur]
    if (!step || seen.has(cur)) return { path, current: cur, state: "blocked", flag: step ? "loop" : "missing step" }
    seen.add(cur)
    if (step.kind === "replan" || step.kind === "done") return { path, current: cur, state: step.kind, flag: null }
    const r = resultFor(force, cur) || null
    if (r && (r.outcome === "not_done" || r.outcome === "disputed")) return { path, current: cur, state: "step", flag: r.outcome }
    if (r && r.outcome === "skipped") {
      if (step.skip) { path.push({ step: cur, result: r, answer: null }); cur = step.skip; continue }
      return { path, current: cur, state: "step", flag: null }
    }
    let answer: Answer | null = null
    if (r?.answer) {
      answer = stepAnswers(plan, step).find((a) => a.id === r.answer) || null
      if (!answer) return { path, current: cur, state: "step", flag: "answer no longer in the plan" }
    } else if (step.kind === "sweep") {
      const items = step.items || []
      const got = items.map((it) => resultFor(force, cur, it.id))
      if (items.length && got.every(Boolean)) answer = matchSweep(step.answers || [], got.map((g) => g!.outcome))
    }
    if (!answer?.next) return { path, current: cur, state: "step", flag: null }
    path.push({ step: cur, result: r, answer: answer.id })
    cur = answer.next
  }
}

// ---------------------------------------------------------------- derived state

export interface LiveSuspect extends Suspect { trend: "more_likely" | "less_likely" | null; changedBy: string[] }

/** Suspects and part states as of now: the plan's, then the effects of the results in force that are
 *  newer than the plan, in order. */
export function derived(plan: Plan, record: RecordDoc): { suspects: LiveSuspect[]; parts: Record<string, Assessment> } {
  const suspects = new Map((plan.suspects || []).map((s) => [s.id, { ...s, trend: null, changedBy: [] } as LiveSuspect]))
  const parts: Record<string, Assessment> = Object.fromEntries(Object.entries(plan.assessment || {}).map(([k, v]) => [k, { ...v }]))
  const since = num(plan.based_on.results)
  const force = new Set(inForce(record).values())
  for (const r of live(record)) {
    if (num(r.id) <= since || (r.step && !force.has(r))) continue
    for (const [sid, change] of Object.entries(r.effects?.suspects || {})) {
      const s = suspects.get(sid)
      if (!s) continue
      if (change === "ruled_out" || change === "confirmed") s.status = change
      else s.trend = change
      s.changedBy.push(r.id)
    }
    for (const e of r.effects?.parts || []) for (const ref of e.refs) parts[ref] = { status: e.status, of: e.of, note: e.note, evidence: [r.id] }
  }
  return { suspects: [...suspects.values()], parts }
}

/** Why the plan no longer reflects the folder; new results don't count. */
export function outdated(plan: Plan, fingerprint: string | undefined, record: RecordDoc): string[] {
  const b = plan.based_on, why: string[] = []
  if (fingerprint && b.model !== fingerprint) why.push("the board model changed")
  for (const [k, what] of [["observations", "observation"], ["instructions", "instruction"]] as const) {
    const fresh = record[k].filter((e) => num(e.id) > num(b[k]) && !e.void).map((e) => e.id)
    if (fresh.length) why.push(`new ${what}${fresh.length > 1 ? "s" : ""}: ${fresh.join(", ")}`)
  }
  const voided = (["observations", "instructions", "results"] as const).reduce((n, k) => n + record[k].filter((e) => e.void).length, 0)
  if (voided !== b.voided) why.push("an entry was voided")
  return why
}

export function needsUpdate(plan: Plan, fingerprint: string | undefined, record: RecordDoc, w: Walk): string[] {
  const why = outdated(plan, fingerprint, record)
  if (w.state === "replan") why.push(`the plan reached its end: ${plan.steps[w.current!]?.title || w.current}`)
  else if (w.state === "blocked") why.push(`the plan is broken at ${w.current} (${w.flag})`)
  else if (w.flag) why.push(`step “${plan.steps[w.current!]?.title || w.current}”: ${w.flag.replace("_", " ")}`)
  return why
}

/** Instructions not yet answered in the plan's history. */
export function unanswered(plan: Plan | null, record: RecordDoc): string[] {
  const replied = new Set((plan?.history || []).flatMap((h) => Object.keys(h.replies || {})))
  return record.instructions.filter((e) => !e.void && !replied.has(e.id)).map((e) => e.id)
}

export function replyTo(plan: Plan | null, id: string): { revision: number; text: string } | null {
  for (const h of plan?.history || []) if (h.replies?.[id]) return { revision: h.revision, text: h.replies[id] }
  return null
}

// ---------------------------------------------------------------- names and targets

/** Every name a part or net goes by (current and former) -> the current one. */
export function names(parts: Record<string, { formerly?: string[] }>, nets: Record<string, { formerly?: string[] }>) {
  const refs: Record<string, string> = {}, netNames: Record<string, string> = {}
  for (const r of Object.keys(parts)) refs[r] = r
  for (const [r, p] of Object.entries(parts)) for (const old of p.formerly || []) refs[old] ??= r
  for (const n of Object.keys(nets)) netNames[n] = n
  for (const [n, net] of Object.entries(nets)) for (const old of net.formerly || []) netNames[old] ??= n
  return { refs, nets: netNames }
}

export function targetText(t: Target | undefined): string {
  if (!t) return ""
  if (t.ref) return t.ref
  if (t.net) return t.net
  return (t.pins || []).map(([r, p]) => `${r} pin ${p}`).join(" to ")
}

/** The parts a target or probe list touches (for "show on the board" and part histories). */
export function targetRefs(t: Target | undefined, probes: Probe[] = []): string[] {
  const refs = new Set<string>()
  if (t?.ref) refs.add(t.ref)
  for (const [r] of t?.pins || []) refs.add(r)
  for (const p of probes) if (p.ref) refs.add(p.ref)
  return [...refs]
}

/** Every result about a part (its own target, one of its pins, or a sweep item on it), oldest first.
 *  `names` are the part's reference and its former ones. */
export function resultsForPart(plan: Plan | null, record: RecordDoc, names: Set<string>): Result[] {
  return live(record).filter((r) => targetRefs(r.target).some((x) => names.has(x))
    || !!(r.step && r.item && plan?.steps[r.step]?.items?.some((it) => it.id === r.item && targetRefs(it.target).some((x) => names.has(x)))))
}

/** The plan's procedures to offer for a part: those meant for its kind, then the general ones.
 *  None when the plan has nothing for its kind: a wrong procedure (diode mode on a resistor) would
 *  give a wrong verdict. */
export function protocolChoices(plan: Plan | null, kind: string): string[] {
  const all = Object.entries(plan?.protocols || {})
  const fits = all.filter(([, x]) => x.applies_to?.includes(kind)).map(([k]) => k)
  // then the general ones (no applies_to, such as an inspection); never one meant for another kind
  return [...fits, ...all.filter(([k, x]) => !fits.includes(k) && !x.applies_to?.length).map(([k]) => k)]
}

export const OUTCOME_LABEL: Record<ResultOutcome, string> = {
  pass: "Pass", fail: "Fail", inconclusive: "Inconclusive", not_done: "Could not do it", disputed: "Step looks wrong", skipped: "Skipped",
}
export const PART_STATUS: Record<PartStatus, { label: string; cls: string; dot: string }> = {
  ok: { label: "Tested good", cls: "bg-success/15 text-success", dot: "bg-success" },
  cleared: { label: "Cleared", cls: "bg-primary/15 text-primary", dot: "bg-primary" },
  suspect: { label: "Suspect", cls: "bg-warning/15 text-warning", dot: "bg-warning" },
  faulty: { label: "Faulty", cls: "bg-destructive/15 text-destructive", dot: "bg-destructive" },
  untestable: { label: "Can't test", cls: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200", dot: "bg-zinc-400" },
}
export const BASIS_LABEL: Record<Expect["basis"], string> = {
  marking: "from its marking", datasheet: "from the datasheet", same_board: "compared with this board", earlier: "from an earlier reading",
  physics: "from the circuit", rule_of_thumb: "rule of thumb", none: "no reference",
}
