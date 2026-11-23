// One step of the plan, as the user follows it: the state to set up, the hazard, the action, where
// the probes go, the readings, what a good board gives, why the step is asked, and the answer. The
// answer goes to record.json; the next step is the one the plan names for it.
import { useMemo, useState } from "react"
import { AlertTriangle, ChevronDown, Clock, Flag, MapPin, MessageSquarePlus, RotateCcw, Terminal, Zap, ZapOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { InlineMd } from "@/components/InlineMd"
import { A } from "@/components/bits"
import { useDialogs } from "@/components/dialogs"
import {
  inForce, matchAnswer, protocolOf, resultFor, stepAnswers, stepReadings, targetText, unitsOf,
  type Probe, type Result, type ResultOutcome, type Step, type SweepItem, type Target,
} from "@/investigation"
import { AnswerChoice, ExpectLine, OutcomeTag, ProbeList, ProtocolSteps, ReadingField, rangesMissed, readingsText } from "@/investigate/pieces"
import { NoteDialog } from "@/investigate/NoteDialog"
import { TestDialog, type TestSpec } from "@/investigate/TestDialog"
import { useStore } from "@/store"
import { revealBoard } from "@/workspace/api"
import { partSides } from "@/model"

const RISK: Record<string, string> = { none: "No risk", low: "Low risk", medium: "Some risk", high: "High risk" }

/** Select what a probe or target names on the board, and go there. */
export function useShowOnBoard() {
  const s = useStore()
  return (t: Target | Probe | undefined) => {
    if (!t) return
    const ref = "ref" in t && t.ref ? t.ref : "pins" in t && t.pins?.length ? t.pins[0][0] : undefined
    if (ref && s.M.parts[ref]) { s.select({ kind: "part", ref }); revealBoard(partSides(s.M.parts[ref])[0]) }
    else if ("net" in t && t.net && s.M.nets[t.net]) { s.select({ kind: "net", net: t.net }); revealBoard() }
  }
}

export function CommandBox({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/60 px-2.5 py-1.5 font-mono text-xs" data-command>
      <Terminal className="size-3.5 shrink-0 text-muted-foreground" />
      <code className="min-w-0 flex-1 break-all">{text}</code>
      <Button size="xs" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* not allowed */ } }}>
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  )
}

function Answered({ result, step, onAgain }: { result: Result; step: Step; onAgain: () => void }) {
  const s = useStore()
  const plan = s.plan!
  const answer = stepAnswers(plan, step).find((a) => a.id === result.answer)
  return (
    <div className="space-y-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm " id="answered" data-result={result.id}>
      <div className="flex flex-wrap items-center gap-2">
        <OutcomeTag outcome={result.outcome} />
        <b>{answer?.label || (result.outcome === "skipped" ? "Skipped" : "")}</b>
        <span className="text-xs text-muted-foreground">{result.date} · {result.id}</span>
        <Button size="xs" variant="outline" className="ml-auto" id="again" onClick={onAgain}><RotateCcw /> Answer again</Button>
      </div>
      {result.readings && <p className="text-xs">{readingsText(result, stepReadings(plan, step))}</p>}
      {answer?.means && <p className="text-xs text-muted-foreground">{answer.means}</p>}
      {result.notes && <p className="text-xs italic">“{result.notes}”</p>}
    </div>
  )
}

function Sweep({ stepId, step }: { stepId: string; step: Step }) {
  const s = useStore()
  const plan = s.plan!
  const force = useMemo(() => inForce(s.record), [s.record])
  const [testing, setTesting] = useState<SweepItem | null>(null)
  const show = useShowOnBoard()
  const proto = protocolOf(plan, step)
  const items = step.items || []
  const done = items.filter((it) => resultFor(force, stepId, it.id)).length
  const spec = (it: SweepItem): TestSpec => ({
    title: `${targetText(it.target)}: ${proto?.title || step.title}`, subtitle: step.title, target: it.target, protocols: step.protocol ? [step.protocol] : [],
    answers: it.answers, expect: it.expect || step.expect, probes: it.probes, step: stepId, item: it.id,
  })
  return (
    <div className="space-y-2">
      <p className="text-sm"><b>{done} of {items.length}</b> tested. Test each one; the plan moves on once all have a result.</p>
      <ul className="divide-y rounded-md border" id="sweep">
        {items.map((it) => {
          const r = resultFor(force, stepId, it.id)
          return (
            <li key={it.id} data-item={it.id} className="flex flex-wrap items-center gap-2 px-2.5 py-1.5 text-sm">
              <A className="font-medium" onClick={() => show(it.target)}>{targetText(it.target)}</A>
              {s.M.parts[it.target.ref || ""] && <span className="text-xs text-muted-foreground">{s.M.parts[it.target.ref!].value}</span>}
              {it.expect && <span className="text-xs text-muted-foreground">· {it.expect.text}</span>}
              <span className="ml-auto flex items-center gap-2">
                {r && <OutcomeTag outcome={r.outcome} className="text-xs" />}
                {r?.readings && <span className="text-xs text-muted-foreground">{readingsText(r, stepReadings(plan, step))}</span>}
                <Button size="xs" variant={r ? "outline" : "default"} data-test-item={it.id} onClick={() => setTesting(it)}>{r ? "Test again" : "Test"}</Button>
              </span>
            </li>
          )
        })}
      </ul>
      {testing && <TestDialog key={testing.id} spec={spec(testing)} open onOpenChange={(o) => { if (!o) setTesting(null) }} />}
    </div>
  )
}

export function StepCard({ stepId }: { stepId: string }) {
  const s = useStore()
  const dialogs = useDialogs()
  const show = useShowOnBoard()
  const plan = s.plan!
  const step = plan.steps[stepId]
  const proto = protocolOf(plan, step)
  const force = useMemo(() => inForce(s.record), [s.record])
  const result = resultFor(force, stepId)
  const [again, setAgain] = useState(false)
  const [ticked, setTicked] = useState<Set<number>>(new Set())
  const [values, setValues] = useState<Record<string, string>>({})
  const [chosen, setChosen] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [noting, setNoting] = useState(false)
  if (!step) return <p className="text-muted-foreground">This step is no longer in the plan.</p>
  const phase = plan.phases.find((p) => p.id === step.phase)
  const power = step.power || proto?.power || "off"
  const readings = stepReadings(plan, step)
  const answers = stepAnswers(plan, step)
  const units = unitsOf(readings)
  const matched = step.kind === "measure" ? matchAnswer(answers, values, units)?.id || null : null
  const answerId = chosen ?? matched
  const answer = answers.find((a) => a.id === answerId) || null
  const setupDone = (step.setup || []).every((_, i) => ticked.has(i))
  const missing = readings.filter((r) => !r.optional && !values[r.key]?.trim())
  const expect = step.expect || proto?.expect
  const answerable = ["check", "measure", "action"].includes(step.kind)
  const showForm = !result || again || result.outcome === "not_done" || result.outcome === "disputed"
  const isCurrent = s.walked.current === stepId

  const record = async (outcome: ResultOutcome, extra: Partial<Result>) => {
    setSaving(true); setError("")
    try {
      await s.addRecord<Result>("results", {
        plan_revision: plan.revision, step: stepId,
        ...(step.target ? { target: step.target } : {}),
        ...(step.protocol ? { protocol: step.protocol } : {}),
        conditions: { power, in_circuit: true },
        outcome, ...extra,
        ...(result ? { supersedes: result.id } : {}),
      })
      setAgain(false); setValues({}); setChosen(null); setNotes(""); setTicked(new Set())
      s.setViewStep(null)
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }
  const save = () => {
    if (!answer) return
    const kept = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v))
    record(answer.outcome || "inconclusive", {
      ...(Object.keys(kept).length ? { readings: kept } : {}), answer: answer.id,
      ...(answer.effects ? { effects: answer.effects } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}),
    })
  }
  const escape = async (outcome: "not_done" | "disputed" | "skipped") => {
    const ask = {
      not_done: { title: "Could not do this step?", body: "Say what stopped you (a missing tool, a pad you can't reach, a part not where the plan says). The agent reads it at the next round." },
      disputed: { title: "This step looks wrong?", body: "Say what is wrong with it (a wrong pin, a part that isn't there, a reading that makes no sense). The agent reads it at the next round." },
      skipped: { title: "Skip this step for now?", body: "Optional: why. The plan continues where it says." },
    }[outcome]
    const why = await dialogs.prompt({ ...ask, action: outcome === "skipped" ? "Skip" : "Save" })
    if (why === null && outcome !== "skipped") return
    record(outcome, why ? { notes: why } : {})
  }

  return (
    <article className="space-y-3" id="step" data-step={stepId} data-kind={step.kind} data-current={isCurrent || undefined}>
      <header className="space-y-1">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{phase?.title || step.phase}</p>
        <h2 className="text-lg leading-snug font-semibold" id="steptitle">{step.title}</h2>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {step.kind !== "replan" && step.kind !== "done" && (
            <span data-power={power} className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5", power === "on" ? "bg-destructive/15 text-destructive" : "bg-muted")}>
              {power === "on" ? <Zap className="size-3" /> : <ZapOff className="size-3" />} Power {power}
            </span>
          )}
          {step.risk && <span className="rounded bg-muted px-1.5 py-0.5">{RISK[step.risk]}</span>}
          {step.minutes !== undefined && <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5"><Clock className="size-3" /> about {step.minutes} min</span>}
          {step.question && <A className="text-xs" data-settles={step.question} onClick={() => { s.select({ kind: "question", id: step.question! }); revealBoard() }}>settles {step.question}: {s.D.questions.find((q) => q.id === step.question)?.title}</A>}
          {(step.instruments || proto?.instruments || []).map((k) => <span key={k} className="rounded bg-muted px-1.5 py-0.5">{k.replace(/_/g, " ")}</span>)}
        </div>
      </header>

      {plan.warning && step.kind !== "done" && <p className="rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-xs " data-plan-warning>{plan.warning}</p>}

      {step.kind === "replan" && (
        <div className="space-y-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-2.5 text-sm " id="replan">
          <p className="flex items-center gap-1.5 font-semibold"><Flag className="size-4" /> This is as far as the plan goes.</p>
          {step.instruction && <InlineMd text={step.instruction} id={s.id} />}
          <p>Run the planning skill in Claude Code to get the next steps. Your results so far are kept, and this page picks up the new plan by itself.</p>
          <CommandBox text={`/plan-investigation ${s.id}`} />
          <Button size="xs" variant="outline" onClick={() => setNoting(true)}><MessageSquarePlus /> Add an instruction for the agent first</Button>
        </div>
      )}
      {step.kind === "done" && (
        <div className="space-y-1 rounded-md border border-success/40 bg-success/10 px-3 py-2.5 text-sm " id="done">
          <p className="font-semibold">The investigation is complete.</p>
          {step.instruction && <InlineMd text={step.instruction} id={s.id} />}
        </div>
      )}

      {step.kind !== "replan" && step.kind !== "done" && (
        <>
          {step.warning && (
            <p className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-2 text-sm " data-warning>
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" /> {step.warning}
            </p>
          )}
          {showForm && step.setup?.length ? (
            <div className="space-y-1 rounded-md border px-2.5 py-2" id="setup">
              <p className="text-xs font-semibold text-muted-foreground">Before you start, check:</p>
              {step.setup.map((t, i) => (
                <label key={i} className="flex items-start gap-2 text-sm">
                  <Checkbox className="mt-0.5" checked={ticked.has(i)} data-setup={i}
                    onCheckedChange={(c) => setTicked((x) => { const n = new Set(x); if (c === true) n.add(i); else n.delete(i); return n })} />
                  <InlineMd text={t} id={s.id} className="[&>p]:inline" />
                </label>
              ))}
            </div>
          ) : null}
          {step.instruction && <InlineMd text={step.instruction} id={s.id} className="space-y-1.5 text-sm" />}
          {step.probes?.length ? (
            <div className="flex flex-wrap items-center gap-2"><MapPin className="size-4 text-muted-foreground" /><ProbeList probes={step.probes} onShow={show} /></div>
          ) : step.target ? (
            <p className="flex items-center gap-1.5 text-sm"><MapPin className="size-4 text-muted-foreground" /> <A onClick={() => show(step.target)}>{targetText(step.target)}</A></p>
          ) : null}
          {proto && step.kind !== "sweep" && (
            <details className="rounded-md border px-2.5 py-1.5 text-sm" open={showForm && step.kind === "measure"}>
              <summary className="cursor-pointer font-medium">How to: {proto.title}</summary>
              <div className="mt-2 space-y-2">
                <InlineMd text={proto.goal} id={s.id} className="text-muted-foreground" />
                {showForm ? <ProtocolSteps protocol={proto} values={values} setValue={(k, v) => { setValues((x) => ({ ...x, [k]: v })); setChosen(null) }} />
                  : <ol className="list-decimal space-y-1 pl-5">{proto.steps.map((x, i) => <li key={i}><InlineMd text={x.text} id={s.id} /></li>)}</ol>}
              </div>
            </details>
          )}
          {showForm && !proto && step.readings?.length ? (
            <div className="space-y-1.5 rounded-md border px-2.5 py-2" id="readings">
              {step.readings.map((r) => <ReadingField key={r.key} reading={r} value={values[r.key] || ""} onChange={(v) => { setValues((x) => ({ ...x, [r.key]: v })); setChosen(null) }} />)}
            </div>
          ) : null}
          {expect && <ExpectLine expect={expect} />}
          {step.why && <p className="text-sm"><b>Why this step:</b> <InlineMd text={step.why} id={s.id} className="inline [&>p]:inline" /></p>}
          {proto?.limits && <p className="text-xs text-muted-foreground"><b>What this cannot tell:</b> {proto.limits}</p>}

          {step.kind === "sweep" && <Sweep stepId={stepId} step={step} />}
          {result && !showForm && answerable && <Answered result={result} step={step} onAgain={() => setAgain(true)} />}
          {result && (result.outcome === "not_done" || result.outcome === "disputed") && (
            <p className="rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-sm " id="flagged">
              <OutcomeTag outcome={result.outcome} /> {result.notes} The plan needs an update; you can also answer the step after all.
            </p>
          )}

          {showForm && (answerable || step.kind === "sweep") && (
            <div className="space-y-2 border-t pt-3">
              {answerable && (
                <>
                  <p className="text-sm font-medium">{step.kind === "measure" && missing.length ? "Enter the readings above, or pick what you saw:" : "Your answer:"}</p>
                  <AnswerChoice name="step" answers={answers} chosen={answerId} matched={matched} onChoose={setChosen} />
                  {step.kind === "measure" && !missing.length && rangesMissed(answers, values, units) && !chosen && (
                    <p className="text-xs text-warning">The readings match none of the ranges: check them, or pick the closest answer.</p>
                  )}
                  <Input id="stepnotes" placeholder="Notes (what you saw, anything odd)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </>
              )}
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex flex-wrap items-center gap-2">
                {answerable && (
                  <Button id="stepsave" disabled={!answer || !setupDone || saving} onClick={save}
                    title={!setupDone ? "Tick the checks above first" : !answer ? "Pick an answer" : undefined}>
                    Save and continue
                  </Button>
                )}
                {answerable && !setupDone && <span className="text-xs text-muted-foreground">Tick the checks above first.</span>}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button id="stepmore" variant="outline" size="sm">Can't answer <ChevronDown /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem data-escape="not_done" onSelect={() => escape("not_done")}>I could not do it</DropdownMenuItem>
                    <DropdownMenuItem data-escape="disputed" onSelect={() => escape("disputed")}>This step looks wrong</DropdownMenuItem>
                    {step.skip && <DropdownMenuItem data-escape="skipped" onSelect={() => escape("skipped")}>Skip it for now</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
                {again && <Button variant="ghost" size="sm" onClick={() => setAgain(false)}>Cancel</Button>}
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setNoting(true)}><MessageSquarePlus /> Note</Button>
              </div>
            </div>
          )}
        </>
      )}
      <NoteDialog open={noting} onOpenChange={setNoting} kind={step.kind === "replan" ? "instructions" : "observations"}
        about={step.target ? [step.target] : []} step={stepId} />
    </article>
  )
}
