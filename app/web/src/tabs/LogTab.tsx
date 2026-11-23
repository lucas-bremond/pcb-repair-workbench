// Repair log tab: the investigation's timeline, read-only. The user's observations, instructions
// and results (record.json), and the agent's plan revisions with their replies (plan.json), newest
// first. Nothing here is edited: the user adds observations and instructions, and voids an entry
// that was wrong (it stays, struck through, and counts for nothing).
import { useMemo, useState, type ReactNode } from "react"
import { Ban, Bot, ClipboardCheck, Eye, MessageSquarePlus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { InlineMd } from "@/components/InlineMd"
import { A } from "@/components/bits"
import { useDialogs } from "@/components/dialogs"
import { num, replyTo, stepAnswers, stepReadings, targetText, type Note, type Plan, type RecordList, type Result, type Target } from "@/investigation"
import { OutcomeTag, readingsText } from "@/investigate/pieces"
import { NoteDialog, type NoteKind } from "@/investigate/NoteDialog"
import { useShowOnBoard } from "@/investigate/StepCard"
import { useStore } from "@/store"

// `seq` orders the entries of one day: a plan revision r is r, a result entered under revision k is
// k + 0.5, and an observation or instruction the latest plan has not read yet comes after it.
type Entry =
  | { kind: "observations" | "instructions"; date: string; time: string; seq: number; order: number; e: Note }
  | { kind: "results"; date: string; time: string; seq: number; order: number; e: Result }
  | { kind: "plan"; date: string; time: string; seq: number; order: number; h: Plan["history"][number] }

const FILTERS = [["all", "All"], ["observations", "Observations"], ["instructions", "Instructions"], ["results", "Results"], ["plan", "Plan"]] as const

function About({ about }: { about?: Target[] }) {
  const show = useShowOnBoard()
  if (!about?.length) return null
  return <span className="text-xs text-muted-foreground">about {about.map((t, i) => <span key={i}>{i > 0 && ", "}<A onClick={() => show(t)}>{targetText(t)}</A></span>)}</span>
}

function Row({ icon, id, date, children, entry, voided, onVoid }: {
  icon: ReactNode; id: string; date: string; children: ReactNode; entry: string; voided?: { date: string; reason: string }; onVoid?: () => void
}) {
  return (
    <li data-entry={id} data-kind={entry} data-void={voided ? "" : undefined} className="group flex gap-3 border-b py-2.5 last:border-0">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1 space-y-1 text-sm">
        <div className={cn("space-y-1", voided && "line-through opacity-60")}>{children}</div>
        {voided && <p className="text-xs text-muted-foreground">Void since {voided.date}: {voided.reason}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
        <span>{id}</span><span>{date}</span>
        {onVoid && !voided && (
          <Button size="xs" variant="ghost" data-void-btn={id} className="h-5 px-1 text-muted-foreground opacity-40 group-hover:opacity-100 focus-visible:opacity-100" onClick={onVoid}><Ban /> Void</Button>
        )}
      </div>
    </li>
  )
}

export function LogTab() {
  const s = useStore()
  const dialogs = useDialogs()
  const show = useShowOnBoard()
  const plan = s.plan
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all")
  const [noting, setNoting] = useState<NoteKind | null>(null)
  const entries = useMemo(() => {
    const latest = plan?.revision ?? 0
    const unread = (k: "observations" | "instructions", id: string) => (plan && num(id) > num(plan.based_on[k]) ? latest + 0.5 : 0)
    const all: Entry[] = [
      ...s.record.observations.map((e) => ({ kind: "observations" as const, date: e.date, time: e.time || "", seq: unread("observations", e.id), order: num(e.id), e })),
      ...s.record.instructions.map((e) => ({ kind: "instructions" as const, date: e.date, time: e.time || "", seq: unread("instructions", e.id), order: num(e.id), e })),
      ...s.record.results.map((e) => ({ kind: "results" as const, date: e.date, time: e.time || "", seq: e.plan_revision ? e.plan_revision + 0.5 : num(e.id) > num(plan?.based_on.results) ? latest + 0.5 : 0, order: num(e.id), e })),
      ...(plan?.history || []).map((h) => ({ kind: "plan" as const, date: h.date, time: "", seq: h.revision, order: 0, h })),
    ]
    const cmp = (a: string, b: string) => (a === b ? 0 : a < b ? 1 : -1)
    return all.sort((a, b) => cmp(a.date, b.date) || b.seq - a.seq || cmp(a.time, b.time) || b.order - a.order) // newest first
  }, [s.record, plan])
  const shown = entries.filter((x) => filter === "all" || x.kind === filter)
  const voidIt = (list: RecordList, id: string) => async () => {
    const reason = await dialogs.prompt({ title: `Void ${id}?`, body: "It stays in the record, struck through, and no longer counts. Say why (a slip, the wrong part...).", action: "Void" })
    if (reason) await s.voidRecord(list, id, reason).catch((e) => dialogs.confirm({ title: "Not saved", body: e.message, action: "OK" }))
  }

  const resultRow = (r: Result) => {
    const step = r.step ? plan?.steps[r.step] : undefined
    const proto = plan?.protocols[r.protocol || step?.protocol || ""]
    const asked = step && plan ? stepReadings(plan, step) : proto ? proto.steps.flatMap((x) => (x.reading ? [x.reading] : [])) : []
    const answers = step && plan ? (r.item ? step.items?.find((i) => i.id === r.item)?.answers || proto?.answers || [] : stepAnswers(plan, step)) : proto?.answers || []
    const answer = answers.find((a) => a.id === r.answer)
    return (
      <Row key={r.id} icon={<ClipboardCheck className="size-4" />} id={r.id} date={r.date} entry="results" voided={r.void} onVoid={voidIt("results", r.id)}>
        <p>
          <b>{step ? step.title : proto ? proto.title : "Test"}</b>
          {r.target && <> · <A onClick={() => show(r.target)}>{targetText(r.target)}</A></>}
          {!r.step && <span className="text-xs text-muted-foreground"> (outside the plan)</span>}
          {r.step && !step && <span className="text-xs text-muted-foreground"> (step {r.step}, no longer in the plan)</span>}
        </p>
        <p className="flex flex-wrap items-center gap-2"><OutcomeTag outcome={r.outcome} /> {answer?.label}
          {r.conditions?.in_circuit === false && <span className="text-xs text-muted-foreground">part lifted</span>}</p>
        {r.readings && <p className="text-xs">{readingsText(r, asked)}</p>}
        {r.notes && <p className="text-xs italic">“{r.notes}”</p>}
      </Row>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4" id="log">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-semibold">Repair log</h2>
        <Button id="addobs" size="sm" variant="outline" onClick={() => setNoting("observations")}><Plus /> Observation</Button>
        <Button id="addinst" size="sm" variant="outline" onClick={() => setNoting("instructions")}><MessageSquarePlus /> Instruction for the agent</Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Everything that happened, newest first: what you saw and asked, what you measured, and how the agent revised the plan.
        Entries are never edited; void one that was wrong.
      </p>
      <ToggleGroup type="single" variant="outline" size="sm" value={filter} onValueChange={(v) => v && setFilter(v as typeof filter)} id="logfilter">
        {FILTERS.map(([k, label]) => <ToggleGroupItem key={k} value={k} data-filter={k} className="px-3">{label}</ToggleGroupItem>)}
      </ToggleGroup>
      <Card className="px-4 py-1">
        {shown.length === 0 && <p className="py-4 text-sm text-muted-foreground">Nothing yet.</p>}
        <ul id="timeline">
          {shown.map((x) => {
            if (x.kind === "results") return resultRow(x.e)
            if (x.kind === "plan") {
              const h = x.h
              return (
                <Row key={`plan-${h.revision}`} icon={<Bot className="size-4" />} id={`Plan ${h.revision}`} date={h.date} entry="plan">
                  <p><b>Plan revision {h.revision}.</b> <InlineMd text={h.reason} id={s.id} className="inline [&>p]:inline" /></p>
                  <InlineMd text={h.changes} id={s.id} className="text-xs text-muted-foreground" />
                  {h.model_changes?.length ? <ul className="list-disc pl-5 text-xs">{h.model_changes.map((c, i) => <li key={i}>Model: {c}</li>)}</ul> : null}
                </Row>
              )
            }
            const e = x.e
            const reply = x.kind === "instructions" ? replyTo(plan, e.id) : null
            return (
              <Row key={e.id} icon={x.kind === "observations" ? <Eye className="size-4" /> : <MessageSquarePlus className="size-4" />} id={e.id} date={e.date} entry={x.kind}
                voided={e.void} onVoid={voidIt(x.kind, e.id)}>
                <p className="text-xs font-semibold text-muted-foreground">{x.kind === "observations" ? "Observation" : "Instruction for the agent"}</p>
                <InlineMd text={e.text} id={s.id} className="space-y-1" />
                <p className="flex flex-wrap gap-2"><About about={e.about} />{e.step && plan?.steps[e.step] && <span className="text-xs text-muted-foreground">during “{plan.steps[e.step].title}”</span>}</p>
                {x.kind === "instructions" && !e.void && (
                  reply
                    ? <p className="rounded-md bg-muted px-2 py-1 text-xs" data-reply><b>Agent (revision {reply.revision}):</b> {reply.text}</p>
                    : <p className="text-xs text-warning" data-waiting>Waiting for the next planning round.</p>
                )}
              </Row>
            )
          })}
        </ul>
      </Card>
      <NoteDialog open={!!noting} onOpenChange={(o) => { if (!o) setNoting(null) }} kind={noting || "observations"} about={[]} step={s.walked.current} />
    </div>
  )
}
