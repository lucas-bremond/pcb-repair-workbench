// The investigation's panels: the current step (with whether the plan needs an update), the phases
// and the steps walked, the suspects, and what is established. Everything the user enters goes to
// record.json; the plan itself is read-only here and changes only when the plan-investigation
// skill runs.
import { useState } from "react"
import { ArrowDown, ArrowUp, CircleCheck, CircleDot, Circle, ClipboardList, MessageSquarePlus, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { InlineMd } from "@/components/InlineMd"
import { A } from "@/components/bits"
import { stepAnswers, unanswered, type LiveSuspect } from "@/investigation"
import { OutcomeTag } from "@/investigate/pieces"
import { CommandBox, StepCard } from "@/investigate/StepCard"
import { NoteDialog } from "@/investigate/NoteDialog"
import { useStore } from "@/store"
import { reveal, revealBoard } from "@/workspace/api"
import { partSides } from "@/model"

const SUSPECT_STATUS: Record<LiveSuspect["status"], { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-warning/15 text-warning" },
  confirmed: { label: "Confirmed", cls: "bg-destructive/15 text-destructive" },
  ruled_out: { label: "Ruled out", cls: "bg-muted text-muted-foreground" },
}

/** A section inside a panel: a small uppercase heading (the panel's tab already names it). */
function Panel({ title, id, children, count }: { title: string; id: string; children: React.ReactNode; count?: React.ReactNode }) {
  return (
    <section className="space-y-2" id={id}>
      <h3 className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{title}{count !== undefined && <span className="font-normal normal-case">{count}</span>}</h3>
      {children}
    </section>
  )
}

const NoPlan = () => <p className="text-sm text-muted-foreground">No plan yet.</p>

/** Why the skill should run again, and how. */
export function UpdateBanner() {
  const s = useStore()
  const [noting, setNoting] = useState(false)
  const errors = s.status.plan?.errors || []
  const stale = s.status.plan?.stale || []
  const waiting = unanswered(s.plan, s.record)
  if (!s.updateReasons.length && !errors.length && !stale.length) return null
  return (
    <div className="space-y-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm " id="needsupdate">
      <p className="flex items-center gap-1.5 font-semibold"><RefreshCw className="size-4" /> {errors.length ? "plan.json has problems" : "The plan needs an update"}</p>
      <ul className="list-disc space-y-0.5 pl-5" id="updatereasons">
        {s.updateReasons.map((r, i) => <li key={i}>{r}</li>)}
        {waiting.length > 0 && <li>{waiting.length} instruction{waiting.length > 1 ? "s" : ""} waiting for an answer: {waiting.join(", ")}</li>}
        {errors.map((e, i) => <li key={`e${i}`} className="text-destructive">{e}</li>)}
        {stale.length > 0 && <li>{stale.length} reference{stale.length > 1 ? "s" : ""} to things the model no longer has (for example: {stale[0]})</li>}
      </ul>
      <p className="text-xs">You can keep following the plan meanwhile. When ready, run in Claude Code:</p>
      <CommandBox text={`/plan-investigation ${s.id}`} />
      <Button size="xs" variant="outline" onClick={() => setNoting(true)}><MessageSquarePlus /> Add an instruction for the agent</Button>
      <NoteDialog open={noting} onOpenChange={setNoting} kind="instructions" about={[]} step={s.walked.current} />
    </div>
  )
}

export function PathPanel() {
  const s = useStore()
  return <div className="h-full space-y-5 overflow-auto p-3">{s.plan ? <PhasesAndPath /> : <NoPlan />}</div>
}

function PhasesAndPath() {
  const s = useStore()
  const plan = s.plan!
  const w = s.walked
  const shown = s.viewStep || w.current
  const phaseOf = (id: string | null) => plan.phases.findIndex((p) => p.id === plan.steps[id || ""]?.phase)
  const currentPhase = phaseOf(w.current)
  return (
    <div className="space-y-3">
      <Panel title="Phases" id="phases">
        <ol className="space-y-1 text-sm">
          {plan.phases.map((p, i) => {
            const state = w.state === "done" || i < currentPhase ? "done" : i === currentPhase ? "current" : "later"
            const Icon = state === "done" ? CircleCheck : state === "current" ? CircleDot : Circle
            return (
              <li key={p.id} data-phase={p.id} data-state={state} title={p.goal}
                className={cn("flex items-start gap-1.5", state === "current" && "font-semibold", state === "later" && "text-muted-foreground")}>
                <Icon className={cn("mt-0.5 size-4 shrink-0", state === "done" && "text-success", state === "current" && "text-primary")} />{p.title}
              </li>
            )
          })}
        </ol>
      </Panel>
      <Panel title="Steps" id="path" count={`${w.path.length} done`}>
        <ol className="space-y-0.5 text-sm">
          {w.path.map((p, i) => {
            const step = plan.steps[p.step]
            const a = stepAnswers(plan, step).find((x) => x.id === p.answer)
            const outcome = p.result?.outcome || a?.outcome || (step.kind === "sweep" ? null : "skipped")
            return (
              <li key={p.step}>
                <button type="button" data-path={p.step} onClick={() => { s.setViewStep(p.step); reveal("step") }}
                  className={cn("w-full rounded px-1.5 py-1 text-left hover:bg-muted", shown === p.step && "bg-muted")}>
                  <span className="text-muted-foreground">{i + 1}.</span> {step.title}
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {outcome && <OutcomeTag outcome={outcome} className="text-xs" />}{a?.label}
                  </span>
                </button>
              </li>
            )
          })}
          {w.current && plan.steps[w.current] && (
            <li>
              <button type="button" data-path={w.current} data-current onClick={() => { s.setViewStep(null); reveal("step") }}
                className={cn("w-full rounded border-l-2 border-primary px-1.5 py-1 text-left font-medium hover:bg-muted", shown === w.current && "bg-muted")}>
                <span className="text-muted-foreground">{w.path.length + 1}.</span> {plan.steps[w.current].title}
                <span className="block text-xs font-normal text-primary">
                  {w.state === "replan" ? "update the plan" : w.state === "done" ? "done" : w.flag ? w.flag.replace("_", " ") : "you are here"}
                </span>
              </button>
            </li>
          )}
        </ol>
      </Panel>
    </div>
  )
}

export function SuspectsPanel() {
  const s = useStore()
  return <div className="h-full overflow-auto p-3">{s.plan ? <Suspects /> : <NoPlan />}</div>
}

export function FindingsPanel() {
  const s = useStore()
  return <div className="h-full overflow-auto p-3">{s.plan ? <Findings /> : <NoPlan />}</div>
}

function Suspects() {
  const s = useStore()
  const select = (ref: string) => { s.select({ kind: "part", ref }); revealBoard(partSides(s.M.parts[ref])[0]) }
  const open = s.suspects.filter((x) => x.status !== "ruled_out"), out = s.suspects.filter((x) => x.status === "ruled_out")
  return (
    <Panel title="Suspects" id="suspects" count={`${open.length} open`}>
      <ul className="space-y-2 text-sm">
        {[...open, ...out].map((x) => (
          <li key={x.id} data-suspect={x.id} data-status={x.status} data-trend={x.trend || undefined} className={cn(x.status === "ruled_out" && "opacity-60")}>
            <div className="flex items-start gap-1.5">
              <span className={cn("mt-0.5 shrink-0 rounded-full px-1.5 text-[11px] leading-[17px]", SUSPECT_STATUS[x.status].cls)}>{SUSPECT_STATUS[x.status].label}</span>
              <span className="min-w-0 flex-1"><span className="text-muted-foreground">{x.id}</span> <InlineMd text={x.title} id={s.id} className="inline [&>p]:inline" /></span>
              {x.trend === "more_likely" && <ArrowUp className="size-4 shrink-0 text-destructive" aria-label="more likely" />}
              {x.trend === "less_likely" && <ArrowDown className="size-4 shrink-0 text-success" aria-label="less likely" />}
            </div>
            {x.parts?.length ? <p className="mt-0.5 pl-1 text-xs">{x.parts.map((r, i) => <span key={r}>{i > 0 && ", "}{s.M.parts[r] ? <A data-ref={r} onClick={() => select(r)}>{r}</A> : r}</span>)}</p> : null}
            {x.changedBy.length > 0 && <p className="pl-1 text-xs text-muted-foreground">changed by {x.changedBy.join(", ")} since the plan</p>}
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function Findings() {
  const s = useStore()
  const findings = s.plan!.findings || []
  if (!findings.length) return <p className="text-sm text-muted-foreground">Nothing established yet.</p>
  return (
    <Panel title="Established" id="findings">
      <ul className="space-y-1.5 text-sm">
        {findings.map((f) => (
          <li key={f.id} data-finding={f.id}>
            <b>{f.title}.</b> <InlineMd text={f.text || ""} id={s.id} className="inline text-muted-foreground [&>p]:inline" />
            {f.evidence?.length ? <span className="text-xs text-muted-foreground"> ({f.evidence.join(", ")})</span> : null}
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/** The current step (or an earlier one looked back at), under the plan's summary and whether it needs an update. */
export function StepPanel() {
  const s = useStore()
  const [noting, setNoting] = useState(false)
  if (!s.plan) {
    const errors = s.status.plan?.errors || []
    return (
      <div className="mx-auto max-w-2xl space-y-3 p-6" id="noplan">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><ClipboardList className="size-5" /> No investigation plan yet</h2>
        {errors.length > 0 && <ul className="list-disc pl-5 text-sm text-destructive">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
        <p className="text-sm">The plan is written by the agent from the board model, your observations and your instruments. Run in Claude Code:</p>
        <CommandBox text={`/plan-investigation ${s.id}`} />
        <p className="text-sm text-muted-foreground">This page picks up the plan as soon as it is written.</p>
      </div>
    )
  }
  const stepId = s.viewStep && s.plan.steps[s.viewStep] ? s.viewStep : s.walked.current
  return (
    <div className="h-full overflow-auto" id="investigate">
      <div className="mx-auto max-w-4xl space-y-3 p-4">
        <UpdateBanner />
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground" id="plansummary">
            <InlineMd text={s.plan.summary} id={s.id} className="inline [&>p]:inline" />{" "}
            <span className="text-xs">(plan revision {s.plan.revision}, {s.plan.date})</span>
          </p>
          <Button id="addnote" size="sm" variant="outline" onClick={() => setNoting(true)}><MessageSquarePlus /> Note</Button>
        </div>
        {s.viewStep && s.viewStep !== s.walked.current && (
          <p className="text-xs">Looking back at an earlier step. <A onClick={() => s.setViewStep(null)}>Back to the current step</A></p>
        )}
        <Card className="p-4">{stepId ? <StepCard key={stepId} stepId={stepId} /> : <p>The plan has no steps.</p>}</Card>
      </div>
      <NoteDialog open={noting} onOpenChange={setNoting} step={stepId} />
    </div>
  )
}
