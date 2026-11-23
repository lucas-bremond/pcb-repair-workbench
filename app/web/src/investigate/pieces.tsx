// Pieces shared by the Investigate tab, the test dialog and the repair log: outcome and part-state
// tags, a protocol's steps with their reading fields, the answers to choose from, the expectation,
// and where the probes go.
import { CheckCircle2, CircleHelp, CircleSlash, MessageSquareWarning, SkipForward, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { InlineMd } from "@/components/InlineMd"
import { A } from "@/components/bits"
import {
  BASIS_LABEL, conditionHolds, fmt, OUTCOME_LABEL, parseReading, PART_STATUS,
  type Answer, type Assessment, type Expect, type Probe, type Protocol, type Reading, type Result, type ResultOutcome, type Unit,
} from "@/investigation"
import { useStore } from "@/store"

const OUTCOME_STYLE: Record<ResultOutcome, { icon: typeof CheckCircle2; cls: string }> = {
  pass: { icon: CheckCircle2, cls: "text-success" },
  fail: { icon: XCircle, cls: "text-destructive" },
  inconclusive: { icon: CircleHelp, cls: "text-warning" },
  not_done: { icon: CircleSlash, cls: "text-zinc-600 dark:text-zinc-300" },
  disputed: { icon: MessageSquareWarning, cls: "text-accent" },
  skipped: { icon: SkipForward, cls: "text-zinc-500 dark:text-zinc-400" },
}

export function OutcomeTag({ outcome, className }: { outcome: ResultOutcome; className?: string }) {
  const o = OUTCOME_STYLE[outcome], Icon = o.icon
  return <span className={cn("inline-flex items-center gap-1 font-medium whitespace-nowrap", o.cls, className)} data-outcome={outcome}><Icon className="size-3.5" />{OUTCOME_LABEL[outcome]}</span>
}

export function PartStateTag({ state }: { state: Assessment }) {
  const st = PART_STATUS[state.status]
  return (
    <span data-state={state.status} title={state.note || undefined}
      className={cn("inline-block rounded-full px-1.5 text-[11px] leading-[17px] whitespace-nowrap", st.cls)}>
      {st.label}{state.of ? ` of ${state.of}` : ""}
    </span>
  )
}

/** "Forward 0.62 V, Reverse OL", from a result's readings and the labels of the readings asked. */
export function readingsText(r: Pick<Result, "readings">, asked: Reading[]): string {
  const byKey = Object.fromEntries(asked.map((x) => [x.key, x]))
  return Object.entries(r.readings || {}).map(([k, v]) => {
    const x = byKey[k], n = parseReading(v, x?.unit || "")
    return `${x?.label || k} ${Number.isNaN(n) ? v : fmt(n, x?.unit || "")}`
  }).join(", ")
}

export function ReadingField({ reading, value, onChange }: { reading: Reading; value: string; onChange: (v: string) => void }) {
  const bad = value.trim() !== "" && Number.isNaN(parseReading(value, reading.unit))
  return (
    <label className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-medium">{reading.label}{reading.optional ? " (optional)" : ""}</span>
      <Input data-reading={reading.key} className="h-7 w-36 text-sm" placeholder={reading.hint} value={value} onChange={(e) => onChange(e.target.value)} />
      <span className="text-muted-foreground">{reading.unit}</span>
      {bad && <span className="text-destructive">not a number (use e.g. 4.7k, 0.62, OL)</span>}
    </label>
  )
}

/** A protocol's procedure, numbered, with a field under each step that takes a reading. */
export function ProtocolSteps({ protocol, values, setValue }: { protocol: Protocol; values: Record<string, string>; setValue: (k: string, v: string) => void }) {
  const { id } = useStore()
  return (
    <ol className="space-y-1.5" data-protocol-steps>
      {protocol.steps.map((st, i) => (
        <li key={i} className="flex gap-2.5 rounded-md border px-2.5 py-2">
          <span className="w-5 shrink-0 text-right font-semibold text-muted-foreground">{i + 1}.</span>
          <div className="min-w-0 flex-1 space-y-1.5">
            {st.text && <InlineMd text={st.text} id={id} className="space-y-1" />}
            {st.reading && <ReadingField reading={st.reading} value={values[st.reading.key] || ""} onChange={(v) => setValue(st.reading!.key, v)} />}
          </div>
        </li>
      ))}
    </ol>
  )
}

/** The answers to pick from; the first whose ranges match the readings is marked. */
export function AnswerChoice({ answers, chosen, matched, onChoose, name }: {
  answers: Answer[]; chosen: string | null; matched: string | null; onChoose: (id: string) => void; name: string
}) {
  return (
    <div role="radiogroup" aria-label="Answer" className="grid gap-1.5" data-answers={name}>
      {answers.map((a) => (
        <button key={a.id} type="button" role="radio" aria-checked={chosen === a.id} data-answer={a.id} data-matched={matched === a.id || undefined}
          onClick={() => onChoose(a.id)}
          className={cn("flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm hover:bg-muted",
            chosen === a.id && "border-primary bg-primary/10 ring-1 ring-primary")}>
          <span className={cn("mt-1 size-3 shrink-0 rounded-full border", chosen === a.id && "border-primary bg-primary")} />
          <span className="min-w-0 flex-1">
            {a.label}
            {matched === a.id && <span className="ml-1.5 rounded bg-primary/15 px-1 text-[11px] text-primary">matches your readings</span>}
            {chosen === a.id && a.means && <span className="mt-0.5 block text-xs text-muted-foreground">{a.means}</span>}
          </span>
          {a.outcome && <OutcomeTag outcome={a.outcome} className="text-xs" />}
        </button>
      ))}
    </div>
  )
}

/** Why a reading matches nothing: the first range it misses, for the user to double-check. */
export function rangesMissed(answers: Answer[], readings: Record<string, string>, units: Record<string, Unit>) {
  return answers.some((a) => a.when?.length) && !answers.some((a) => a.when?.length && a.when.every((c) => conditionHolds(c, readings, units)))
}

export function ExpectLine({ expect, prefix = "A good board" }: { expect: Expect; prefix?: string }) {
  const { id } = useStore()
  return (
    <div className="rounded-md bg-muted px-2.5 py-2 text-sm" data-expect={expect.basis}>
      <b>{prefix}:</b> <InlineMd text={expect.text} id={id} className="inline [&>p]:inline" />{" "}
      <Tooltip>
        <TooltipTrigger asChild><span className="cursor-help text-xs text-muted-foreground underline decoration-dotted">({BASIS_LABEL[expect.basis]})</span></TooltipTrigger>
        <TooltipContent className="max-w-72">{expect.source || "Where this expectation comes from."}</TooltipContent>
      </Tooltip>
    </div>
  )
}

const LEAD: Record<Probe["lead"], string> = { red: "bg-red-600", black: "bg-zinc-950 ring-1 ring-zinc-500", any: "bg-zinc-400" }

/** Where the probes go, each linked to its part on the board. */
export function ProbeList({ probes, onShow }: { probes: Probe[]; onShow: (p: Probe) => void }) {
  const { M } = useStore()
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" data-probes>
      {probes.map((p, i) => {
        const pinName = p.ref && p.pin ? M.parts[p.ref]?.pins[p.pin] : undefined
        return (
          <li key={i} className="flex items-center gap-1.5">
            <span className={cn("inline-block size-2.5 rounded-full", LEAD[p.lead])} title={p.lead === "any" ? "either probe" : `${p.lead} probe`} />
            <A data-probe={p.ref || p.net} onClick={() => onShow(p)}>
              {p.ref ? `${p.ref}${p.pin ? ` pin ${p.pin}` : ""}` : p.net}
            </A>
            {pinName && pinName !== p.pin && <span className="text-xs text-muted-foreground">({pinName})</span>}
          </li>
        )
      })}
    </ul>
  )
}
