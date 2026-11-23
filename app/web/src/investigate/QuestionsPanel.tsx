// The model's open questions (scenario.json "open_questions"), a panel: each names the
// pins involved and the measurement that settles it, and, when a plan step settles it, that step
// and whether it has been answered.
import { Crosshair } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { A } from "@/components/bits"
import { stepAnswers } from "@/investigation"
import { partName } from "@/model"
import { OutcomeTag } from "@/investigate/pieces"
import { useStore } from "@/store"
import { reveal, revealBoard, revealDetails } from "@/workspace/api"

export function QuestionsPanel() {
  const s = useStore()
  const { D, plan, walked } = s
  if (!D.questions.length) return <p className="p-3 text-sm text-muted-foreground" id="qs">No open questions.</p>
  const toBoard = (sel: Parameters<typeof s.select>[0]) => { s.select(sel); revealBoard() }
  return (
    <div className="h-full space-y-2 overflow-auto p-3" id="qs">
      <p className="text-xs text-muted-foreground">{D.questions.length} gaps in the board model, each with the measurement that settles it.</p>
      <ul className="space-y-1.5">
        {D.questions.map((q) => {
          const stepId = plan && Object.keys(plan.steps).find((k) => plan.steps[k].question === q.id)
          const done = stepId ? walked.path.find((p) => p.step === stepId) : undefined
          const answer = done && plan ? stepAnswers(plan, plan.steps[done.step]).find((a) => a.id === done.answer) : undefined
          return (
            <li key={q.id} data-question={q.id} className="q">
              <details className="group rounded-md border px-2 py-1.5 text-sm">
                <summary className="flex cursor-pointer list-none items-start gap-1.5" title="Double-click for its details"
                  onDoubleClick={() => { s.select({ kind: "question", id: q.id }); revealDetails() }}>
                  <span className="shrink-0 font-semibold text-destructive">{q.id}</span>
                  <span className="min-w-0 flex-1">{q.title}</span>
                  {done?.result && <OutcomeTag outcome={done.result.outcome} className="text-xs" />}
                </summary>
                <div className="mt-1.5 space-y-1 text-xs">
                  <p>Pins:{" "}
                    {q.pins.map(([r, p], i) => (
                      <span key={i}>{i > 0 && ", "}<A data-ref={r} onClick={() => toBoard({ kind: "part", ref: r })}>{partName(D.parts[r], r)}.{p}</A></span>
                    ))}
                  </p>
                  {q.candidates?.length ? <p className="text-muted-foreground">Candidates: {q.candidates.join(", ")}</p> : null}
                  <p className="rounded bg-primary/10 px-1.5 py-1"><b>Check:</b> {q.check}</p>
                  {q.why && <p className="text-muted-foreground">{q.why}</p>}
                  {stepId && plan && (
                    <p className={cn(done && "text-muted-foreground")}>
                      Settled by the step <A data-qstep={stepId} onClick={() => { s.setViewStep(stepId === walked.current ? null : stepId); reveal("step") }}>{plan.steps[stepId].title}</A>
                      {answer ? `: ${answer.label}` : stepId === walked.current ? " (the current step)" : ""}
                    </p>
                  )}
                  <Button size="xs" variant="outline" data-showq={q.id} onClick={() => toBoard({ kind: "question", id: q.id })}><Crosshair /> Show on board</Button>
                </div>
              </details>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
