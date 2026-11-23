// Test one thing with one of the plan's procedures: a sweep item the plan asks for, or a part tested
// on the user's own initiative ("Test this part"). The readings preselect an answer from the ranges
// the plan gives; the user confirms or picks another, and the result goes to record.json.
import { useState } from "react"
import { ClipboardCheck, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { InlineMd } from "@/components/InlineMd"
import { matchAnswer, unitsOf, type Answer, type Expect, type Probe, type Result, type Target } from "@/investigation"
import { AnswerChoice, ExpectLine, ProbeList, ProtocolSteps, rangesMissed } from "@/investigate/pieces"
import { useStore } from "@/store"

export interface TestSpec {
  title: string
  subtitle?: string
  target: Target
  protocols: string[] // the choices, in order; the first is the default
  answers?: Answer[] // overrides the protocol's (a sweep item's own ranges)
  expect?: Expect
  probes?: Probe[]
  step?: string // the plan step and sweep item it answers
  item?: string
  allowLifted?: boolean // a free test: on the board or lifted out
}

export function TestDialog({ spec, open, onOpenChange, onSaved }: { spec: TestSpec; open: boolean; onOpenChange: (o: boolean) => void; onSaved?: (r: Result) => void }) {
  const s = useStore()
  const plan = s.plan!
  const [protoId, setProtoId] = useState(spec.protocols[0])
  const [lifted, setLifted] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [chosen, setChosen] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const proto = plan.protocols[protoId]
  if (!proto) return null
  const asked = proto.steps.flatMap((x) => (x.reading ? [x.reading] : []))
  const answers = spec.answers?.length && protoId === spec.protocols[0] ? spec.answers : proto.answers
  const units = unitsOf(asked)
  const matched = matchAnswer(answers, values, units)?.id || null
  const answerId = chosen ?? matched
  const answer = answers.find((a) => a.id === answerId) || null
  const missing = asked.filter((r) => !r.optional && !values[r.key]?.trim())
  const expect = spec.expect || proto.expect

  const reset = () => { setValues({}); setChosen(null); setNotes(""); setError("") }
  const save = async () => {
    if (!answer) return
    setSaving(true); setError("")
    const readings = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v))
    try {
      const saved = await s.addRecord<Result>("results", {
        ...(spec.step ? { plan_revision: plan.revision, step: spec.step } : {}),
        ...(spec.item ? { item: spec.item } : {}),
        target: spec.target,
        protocol: protoId,
        conditions: { power: proto.power, in_circuit: !lifted },
        ...(Object.keys(readings).length ? { readings } : {}),
        answer: answer.id,
        outcome: answer.outcome || "inconclusive",
        ...(answer.effects ? { effects: answer.effects } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      })
      reset()
      onOpenChange(false)
      onSaved?.(saved)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl" data-dialog="test" id="testdialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ClipboardCheck className="size-5 text-primary" /> {spec.title}</DialogTitle>
          {spec.subtitle && <DialogDescription>{spec.subtitle}</DialogDescription>}
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {spec.protocols.length > 1 && (
            <Label className="font-normal">Procedure
              <NativeSelect id="tproto" size="sm" value={protoId} className="h-8 text-sm" onChange={(e) => { setProtoId(e.target.value); reset() }}>
                {spec.protocols.map((k) => <NativeSelectOption key={k} value={k}>{plan.protocols[k].title}</NativeSelectOption>)}
              </NativeSelect>
            </Label>
          )}
          {spec.allowLifted && (
            <Label className="font-normal">
              <NativeSelect id="tcircuit" size="sm" value={lifted ? "out" : "in"} className="h-8 text-sm" onChange={(e) => setLifted(e.target.value === "out")}>
                <NativeSelectOption value="in">On the board (in circuit)</NativeSelectOption>
                <NativeSelectOption value="out">Lifted out of the circuit</NativeSelectOption>
              </NativeSelect>
            </Label>
          )}
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs" data-power={proto.power}>Power {proto.power}</span>
        </div>
        <div className="space-y-3 text-sm">
          <InlineMd text={proto.goal} id={s.id} />
          {proto.instruments.length > 0 && <p className="flex flex-wrap items-center gap-1.5 text-muted-foreground"><Wrench className="size-4" /> {proto.instruments.map((k) => k.replace(/_/g, " ")).join(" · ")}</p>}
          {spec.probes?.length ? <ProbeList probes={spec.probes} onShow={() => {}} /> : null}
          <ProtocolSteps protocol={proto} values={values} setValue={(k, v) => { setValues((x) => ({ ...x, [k]: v })); setChosen(null) }} />
          {expect && <ExpectLine expect={expect} />}
          {proto.limits && <p className="text-xs text-muted-foreground"><b>What this cannot tell:</b> {proto.limits}</p>}
          <div>
            <p className="mb-1.5 font-medium">{missing.length ? "Enter the readings, or pick what you saw:" : "Your answer:"}</p>
            <AnswerChoice name="test" answers={answers} chosen={answerId} matched={matched} onChoose={setChosen} />
            {!missing.length && rangesMissed(answers, values, units) && !chosen && <p className="mt-1 text-xs text-warning">The readings match none of the ranges: check them, or pick the closest answer.</p>}
          </div>
          <Input id="tnotes" placeholder="Notes (what you saw, anything odd)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button id="tsave" disabled={!answer || saving} onClick={save}>Save the result</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
