// The Details panel: what is selected (part, net, trace, open question, block), and in the
// annotation editor the forms that change it.
import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react"
import { ClipboardCheck, Pencil, Plus, RotateCcw, Spline, Trash2, X } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { A, Chip, Ev, H3, KindTag, Note } from "@/components/bits"
import { useDialogs } from "@/components/dialogs"
import { deriveModel, KINDS, partName, partSides, setConnection, validName, type Box, type Question, type Side } from "@/model"
import { useStore } from "@/store"
import { EditBar } from "@/workspace/editor"
import { useEditOps } from "@/board/editOps"
import { protocolChoices, resultsForPart, stepReadings, targetText, type Result } from "@/investigation"
import { OutcomeTag, PartStateTag, readingsText } from "@/investigate/pieces"
import { TestDialog } from "@/investigate/TestDialog"

/** An uncontrolled text field that commits on the native change event (blur or Enter), like a form field. */
export function CommitInput({ value, onCommit, ...rest }: { value: string; onCommit: (v: string) => void } & Omit<ComponentProps<"input">, "value" | "onChange">) {
  const ref = useRef<HTMLInputElement>(null)
  const cb = useRef(onCommit)
  cb.current = onCommit
  useEffect(() => {
    const el = ref.current!
    const h = () => cb.current(el.value.trim())
    el.addEventListener("change", h)
    return () => el.removeEventListener("change", h)
  }, [])
  useEffect(() => { if (ref.current && document.activeElement !== ref.current) ref.current.value = value }, [value])
  return <Input ref={ref} defaultValue={value} {...rest} />
}

/** CommitInput's multi-line twin, for descriptions and notes. */
export function CommitText({ value, onCommit, className, ...rest }: { value: string; onCommit: (v: string) => void } & Omit<ComponentProps<"textarea">, "value" | "onChange">) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const cb = useRef(onCommit)
  cb.current = onCommit
  useEffect(() => {
    const el = ref.current!
    const h = () => cb.current(el.value.trim())
    el.addEventListener("change", h)
    return () => el.removeEventListener("change", h)
  }, [])
  useEffect(() => { if (ref.current && document.activeElement !== ref.current) ref.current.value = value }, [value])
  return <textarea ref={ref} defaultValue={value} rows={2}
    className={cn("w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30", className)} {...rest} />
}

/** A labelled form row. */
const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="mb-1.5 block text-[13px]"><span className="mb-0.5 block text-xs text-muted-foreground">{label}</span>{children}</label>
)

/** Set a text field, dropping it when empty (optional fields stay out of scenario.json). */
function setText<T extends object>(obj: T, key: keyof T, v: string) {
  if (v) (obj as any)[key] = v
  else delete (obj as any)[key]
}

const NEW = "__new__"
function NetSelect({ value, onPick, className, id }: { value: string; onPick: (net: string | null) => void; className?: string; id?: string }) {
  const { M } = useStore()
  const dialogs = useDialogs()
  return (
    <NativeSelect id={id} size="sm" value={value} className={cn("h-7 w-full py-0 text-xs", className)}
      onChange={async (e) => {
        let v: string | null = e.target.value
        if (v === NEW) v = await dialogs.prompt({ title: "New net", body: "Name of the new net (it needs at least one pin before the build accepts it).", action: "Create" })
        if (v !== null) onPick(v || null)
      }}>
      <NativeSelectOption value="">(unknown)</NativeSelectOption>
      {Object.keys(M.nets).map((n) => <NativeSelectOption key={n} value={n}>{n}</NativeSelectOption>)}
      {value && !M.nets[value] && <NativeSelectOption value={value}>{value}</NativeSelectOption>}
      <NativeSelectOption value={NEW}>New net…</NativeSelectOption>
    </NativeSelect>
  )
}

const Heading = ({ kind, title }: { kind: string; title: string }) => (
  <>
    <H3>{kind}</H3>
    <h2 className="mb-1 text-lg leading-tight font-semibold">{title}</h2>
  </>
)

function Questions({ qs }: { qs: Question[] }) {
  if (!qs.length) return null
  return (
    <>
      <H3>Open questions</H3>
      {qs.map((q) => (
        <p key={q.id} className="mb-2 text-[13px]"><b>{q.id}</b> {q.title}<br /><Ev>Check: {q.check}</Ev></p>
      ))}
    </>
  )
}

function useQuestionsFor() {
  const { D } = useStore()
  return (pred: (ref: string, pin: string) => boolean) => D.questions.filter((q) => q.pins.some(([r, p]) => pred(r, String(p))))
}

const th = "h-7 px-1 text-[11px]"
const td = "px-1 py-1 align-top whitespace-normal"

function NetDetail({ name }: { name: string }) {
  const s = useStore()
  const { M, enabled, select, editing } = s
  const ops = useEditOps()
  const questionsFor = useQuestionsFor()
  const net = M.nets[name]
  const vis = net.nodes.filter((n) => enabled.has(n.conf))
  const traced = M.traces.filter((t) => t.net === name)
  return (
    <>
      <Heading kind="Net" title={name} />
      {editing ? (
        <div id="netform" className="mb-2">
          <Field label="Name"><CommitInput id="netname" className="h-7 text-xs" value={name} onCommit={async (v) => { if (v && !(await ops.renameNetTo(name, v))) s.select({ kind: "net", net: name }) }} /></Field>
          <Field label="Description"><CommitText id="netdesc" value={net.description || ""} onCommit={(v) => s.mutate((d) => setText(d.nets[name], "description", v))} /></Field>
          <Button id="netdel" size="xs" variant="outline" className="text-destructive" onClick={() => ops.removeNet(name)}><Trash2 /> Delete net</Button>
        </div>
      ) : <p className="mb-2">{net.description}</p>}
      <p className="mb-2 flex items-center gap-1.5">Weakest link: <Chip level={M.netConfidence[name]} /></p>
      <Table className="text-xs">
        <TableHeader><TableRow><TableHead className={th}>Pin</TableHead><TableHead className={th}>Confidence and evidence</TableHead></TableRow></TableHeader>
        <TableBody>
          {vis.map((n, i) => {
            const p = M.parts[n.ref]
            return (
              <TableRow key={i}>
                <TableCell className={td}><A data-ref={n.ref} onClick={() => select({ kind: "part", ref: n.ref })}>{partName(p, n.ref)}</A>.{n.pin}<br /><Ev>{p.pins[n.pin]}</Ev></TableCell>
                <TableCell className={td}><Chip level={n.conf} /><div className="mt-0.5 text-xs text-muted-foreground">{n.evidence}</div></TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      {traced.length > 0 && (
        <>
          <H3>Traces</H3>
          {traced.map((t) => <p key={t.id} className="text-xs text-muted-foreground"><A data-trace={t.id} onClick={() => select({ kind: "trace", id: t.id })}>{t.id}</A> ({t.side}): {t.evidence || ""}</p>)}
        </>
      )}
      <Questions qs={questionsFor((r, p) => net.nodes.some((n) => n.ref === r && n.pin === p))} />
    </>
  )
}

function PartDetail({ ref_ }: { ref_: string }) {
  const s = useStore()
  const ops = useEditOps()
  const dialogs = useDialogs()
  const { D, M, enabled, editing, loaded, levels, select } = s
  const questionsFor = useQuestionsFor()
  const loadedPinNet = useMemo(() => deriveModel(loaded).pinNet, [loaded])
  const p = M.parts[ref_]
  const sides = partSides(p)
  const [testing, setTesting] = useState(false)
  const tests = resultsForPart(s.plan, s.record, new Set([ref_, ...(p.formerly || [])])).reverse()
  const choices = protocolChoices(s.plan, p.kind || "")
  const state = s.partStates[ref_]
  const asked = (r: Result) => {
    const step = r.step ? s.plan?.steps[r.step] : undefined
    if (step && s.plan) return stepReadings(s.plan, step)
    return (s.plan?.protocols[r.protocol || ""]?.steps || []).flatMap((x) => (x.reading ? [x.reading] : []))
  }
  let body
  if (editing) {
    const boxEdited = JSON.stringify(p.box || null) !== JSON.stringify(loaded.parts[ref_]?.box || null)
    const set = (key: "label" | "value" | "package" | "note" | "pinout_source", v: string) =>
      s.mutate((d) => { if (key === "value") d.parts[ref_].value = v; else setText(d.parts[ref_], key, v) })
    const blocks = Object.entries(D.blocks)
    body = (
      <>
        <div id="partform" className="grid grid-cols-2 gap-x-2">
          <Field label="Reference"><CommitInput id="pref" className="h-7 text-xs" value={ref_} onCommit={(v) => { if (v) ops.renamePartTo(ref_, v) }} /></Field>
          <Field label="Label (optional)"><CommitInput id="plabel" className="h-7 text-xs" value={p.label || ""} onCommit={(v) => set("label", v)} /></Field>
          <Field label="Type">
            <NativeSelect id="pkind" size="sm" value={p.kind || ""} className="h-7 w-full py-0 text-xs"
              onChange={(e) => s.mutate((d) => setText(d.parts[ref_], "kind", e.target.value))}>
              <NativeSelectOption value="">(none)</NativeSelectOption>
              {Object.entries(KINDS).map(([k, v]) => <NativeSelectOption key={k} value={k}>{v.label}</NativeSelectOption>)}
              {p.kind && !KINDS[p.kind] && <NativeSelectOption value={p.kind}>{p.kind}</NativeSelectOption>}
            </NativeSelect>
          </Field>
          <Field label="Block">
            <NativeSelect id="pgroup" size="sm" value={p.group} className="h-7 w-full py-0 text-xs" onChange={(e) => s.mutate((d) => { d.parts[ref_].group = e.target.value })}>
              {blocks.map(([k, b]) => <NativeSelectOption key={k} value={k}>{b.title}</NativeSelectOption>)}
              {!D.blocks[p.group] && <NativeSelectOption value={p.group}>{p.group}</NativeSelectOption>}
            </NativeSelect>
          </Field>
          <Field label="Value or part number"><CommitInput id="pvalue" className="h-7 text-xs" value={p.value} onCommit={(v) => set("value", v)} /></Field>
          <Field label="Package"><CommitInput id="ppackage" className="h-7 text-xs" value={p.package || ""} onCommit={(v) => set("package", v)} /></Field>
          <div className="col-span-2"><Field label="Note"><CommitText id="pnote" value={p.note || ""} onCommit={(v) => set("note", v)} /></Field></div>
          <div className="col-span-2"><Field label="Pinout source"><CommitInput id="ppinout" className="h-7 text-xs" value={p.pinout_source || ""} placeholder="Datasheet, photo…" onCommit={(v) => set("pinout_source", v)} /></Field></div>
        </div>
        <Button id="pdel" size="xs" variant="outline" className="text-destructive" onClick={() => ops.removePart(ref_)}><Trash2 /> Delete part</Button>
        <H3>Box</H3>
        <p className="mb-1.5 text-xs text-muted-foreground">Drag the box to move it, its corners to resize.{boxEdited && <b className="ml-1 text-primary">edited</b>}</p>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(D.photos) as Side[]).map((side) => p.box?.[side] ? (
            <Button key={side} size="xs" variant="outline" data-boxdel={side} className="text-destructive" onClick={() => s.mutate((a) => s.setBox(a, ref_, side, null))}>
              <Trash2 /> Remove from {side}
            </Button>
          ) : (
            <Button key={side} size="xs" variant="outline" data-boxadd={side} onClick={() => {
              const ph = D.photos[side], cx = Math.round(ph.w / ph.scale / 2), cy = Math.round(ph.h / ph.scale / 2), h = Math.round(40 / ph.scale)
              s.mutate((a) => s.setBox(a, ref_, side, [cx - h, cy - h, cx + h, cy + h] as Box))
            }}><Plus /> Add box on {side}</Button>
          ))}
          {boxEdited && loaded.parts[ref_] && <Button size="xs" variant="outline" data-boxreset onClick={() => s.mutate((a) => {
            const was = loaded.parts[ref_].box
            if (was) a.parts[ref_].box = JSON.parse(JSON.stringify(was)); else delete a.parts[ref_].box
          })}><RotateCcw /> Revert to page load</Button>}
        </div>
        <H3>Pins</H3>
        <Table className="text-xs">
          <TableHeader><TableRow><TableHead className={cn(th, "w-20")}>Pin</TableHead><TableHead className={th}>Net, confidence, evidence</TableHead></TableRow></TableHeader>
          <TableBody>
            {Object.entries(p.pins).map(([num, name]) => {
              const pn = M.pinNet[`${ref_}.${num}`] || { net: "", conf: "assumed", evidence: "" }
              const was = loadedPinNet[`${ref_}.${num}`]
              const edited = JSON.stringify(was || null) !== JSON.stringify(M.pinNet[`${ref_}.${num}`] || null)
              const save = (net: string | null, conf: string, ev: string) => s.mutate((a) => s.setConnection(a, ref_, num, net, conf, ev))
              return (
                <TableRow key={num} data-pin={num}>
                  <TableCell className={cn(td, "space-y-1")}>
                    <div className="flex items-center gap-0.5">
                      <b>{num}</b>
                      <Button size="icon-xs" variant="ghost" className="ml-auto size-5 text-muted-foreground" title={`Remove pin ${num}`} data-pindel={num}
                        onClick={() => s.mutate((d) => { setConnection(d, ref_, num, null, "assumed", ""); delete d.parts[ref_].pins[num] })}><X /></Button>
                    </div>
                    <CommitInput className="pname h-7 px-1.5 text-xs" value={name} title="Pin name or function" onCommit={(v) => s.mutate((d) => { d.parts[ref_].pins[num] = v || num })} />
                    {edited && <b className="text-primary">edited</b>}
                  </TableCell>
                  <TableCell className={cn(td, "space-y-1")}>
                    <NetSelect className="pnet" value={pn.net} onPick={(net) => save(net, pn.conf, pn.evidence)} />
                    <NativeSelect size="sm" value={pn.conf} className="pconf h-7 w-full py-0 text-xs" onChange={(e) => save(pn.net || null, e.target.value, pn.evidence)}>
                      {levels.map((k) => <NativeSelectOption key={k} value={k}>{k}</NativeSelectOption>)}
                    </NativeSelect>
                    <CommitInput className="pev h-7 text-xs" value={pn.evidence} placeholder="Evidence (photo, measurement…)" onCommit={(v) => save(pn.net || null, pn.conf, v)} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <Button id="pinadd" size="xs" variant="outline" className="mt-2" onClick={async () => {
          const next = String(Math.max(0, ...Object.keys(p.pins).map(Number).filter(Number.isFinite)) + 1)
          const num = (await dialogs.prompt({ title: `Add a pin to ${ref_}`, body: `Pin number (for example ${next}).`, action: "Add" }))?.trim()
          if (!num) return
          if (!validName(num) || p.pins[num]) { await dialogs.confirm({ title: "Cannot add the pin", body: p.pins[num] ? `${ref_} already has pin ${num}.` : "Use no spaces and no dots.", action: "OK" }); return }
          s.mutate((d) => { d.parts[ref_].pins[num] = num })
        }}><Plus /> Add pin</Button>
        <p className="mt-2 text-xs text-muted-foreground">Changes are saved as you go. “(unknown)” removes the pin from its net.</p>
      </>
    )
  } else {
    body = (
      <>
        <Table className="text-xs">
          <TableHeader><TableRow><TableHead className={th}>Pin</TableHead><TableHead className={th}>Name</TableHead><TableHead className={th}>Net</TableHead></TableRow></TableHeader>
          <TableBody>
            {Object.entries(p.pins).map(([num, name]) => {
              const pn = M.pinNet[`${ref_}.${num}`]
              return (
                <TableRow key={num}>
                  <TableCell className={td}>{num}</TableCell>
                  <TableCell className={td}>{name}</TableCell>
                  {pn && enabled.has(pn.conf)
                    ? <TableCell className={td}><span className="inline-flex flex-wrap items-center gap-1"><A data-net={pn.net} onClick={() => select({ kind: "net", net: pn.net })}>{pn.net}</A> <Chip level={pn.conf} /></span></TableCell>
                    : <TableCell className={cn(td, "text-muted-foreground")}>{pn ? "hidden by filter" : "unknown"}</TableCell>}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <p className="mt-2 text-xs text-muted-foreground">Teal: this part. Amber: parts sharing a signal net with it (power nets left out).</p>
      </>
    )
  }
  return (
    <>
      <Heading kind="Part" title={partName(p, ref_)} />
      <p className="mb-2"><KindTag part={p} /> <b>{p.value}</b>{p.package ? " · " + p.package : ""}{state && <> <PartStateTag state={state} /></>}<br />
        <span className="text-[13px] text-muted-foreground">Block: {D.blocks[p.group]?.title}{sides.length ? " · " + sides.join(" and ") + " side" + (sides.length > 1 ? "s" : "") : " · not placed on either side"}{p.label ? " · ref " + ref_ : ""}</span>
      </p>
      {p.note && <Note>{p.note}</Note>}
      {p.pinout_source && <p className="mb-2 text-xs text-muted-foreground">Pinout: {p.pinout_source}</p>}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {choices.length ? <Button id="ptest" size="xs" onClick={() => setTesting(true)}><ClipboardCheck /> Test this part</Button> : (
          <Tooltip>
            <TooltipTrigger asChild><span tabIndex={0}><Button id="ptest" size="xs" disabled><ClipboardCheck /> Test this part</Button></span></TooltipTrigger>
            <TooltipContent className="max-w-64">The plan has no test procedure for this kind of part yet: the plan-investigation skill adds them.</TooltipContent>
          </Tooltip>
        )}
        {!editing && <Button id="pedit" size="xs" variant="outline" title="Correct its reference, value, type or pins"
          onClick={() => s.setEditing(true)}><Pencil /> Edit part</Button>}
      </div>
      {testing && choices.length > 0 && (
        <TestDialog key={ref_} open onOpenChange={setTesting}
          spec={{ title: `Test ${partName(p, ref_)}`, subtitle: [p.kind, p.value, p.package].filter(Boolean).join(" · "), target: { ref: ref_ }, protocols: choices, allowLifted: true }} />
      )}
      {state?.note && <p className="mb-2 text-xs text-muted-foreground">{state.note}</p>}
      {tests.length > 0 && (
        <>
          <H3>Results</H3>
          <ul id="ptests" className="mb-2 space-y-1.5">
            {tests.map((t) => {
              const step = t.step ? s.plan?.steps[t.step] : undefined
              const what = step?.title || s.plan?.protocols[t.protocol || ""]?.title || t.protocol || "Test"
              return (
                <li key={t.id} data-test={t.id} className="rounded-md border px-2 py-1.5 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <OutcomeTag outcome={t.outcome} />
                    <span className="text-muted-foreground">{t.date} · {t.id} · {what}{t.target && !t.target.ref ? ` (${targetText(t.target)})` : ""}{t.conditions?.in_circuit === false ? " · lifted" : ""}</span>
                  </div>
                  {t.readings && <div className="mt-0.5">{readingsText(t, asked(t))}</div>}
                  {t.notes && <div className="mt-0.5 text-muted-foreground">{t.notes}</div>}
                </li>
              )
            })}
          </ul>
        </>
      )}
      {body}
      <Questions qs={questionsFor((r) => r === ref_)} />
    </>
  )
}

function TraceDetail({ id }: { id: string }) {
  const s = useStore()
  const ops = useEditOps()
  const t = s.M.traces.find((x) => x.id === id)!
  const valid = !!s.M.nets[t.net]
  return (
    <>
      <Heading kind="Trace" title={id} />
      {s.editing ? (
        <div className="space-y-2">
          <label className="block text-[13px]">Net <NetSelect id="tnet" value={t.net} onPick={(net) => net && s.mutate((a) => { a.traces.find((x) => x.id === id)!.net = net })} /></label>
          <label className="block text-[13px]">Evidence <CommitInput id="tev" className="h-7 text-xs" value={t.evidence || ""} placeholder="Which photo shows this copper"
            onCommit={(v) => s.mutate((a) => { a.traces.find((x) => x.id === id)!.evidence = v })} /></label>
          <p className="text-xs text-muted-foreground">{t.side} side · {t.points.length} points. Drag a point to move it, drag a small square to add one, Alt-click (or right-click) a point to delete it.</p>
          <div className="flex flex-wrap gap-1.5">
            <Button id="textend" size="xs" variant="outline" onClick={() => ops.extend(id)}><Spline /> Extend from the last point</Button>
            <Button id="tdel" size="xs" variant="outline" className="text-destructive" onClick={() => ops.deleteTrace(id)}><Trash2 /> Delete trace</Button>
          </div>
        </div>
      ) : (
        <>
          <p className="mb-1">Net <A data-net={t.net} onClick={() => s.select({ kind: "net", net: t.net })}>{t.net}</A> · {t.side} side · {t.points.length} points</p>
          <p className="mb-1 text-xs text-muted-foreground">{t.evidence || ""}</p>
          <p className="text-xs text-muted-foreground">Use “Edit” to change it.</p>
        </>
      )}
      {!valid && <Note>Net {t.net} does not exist: pick one, or the build will refuse this trace.</Note>}
    </>
  )
}

function QuestionDetail({ id }: { id: string }) {
  const { D, M, select } = useStore()
  const q = D.questions.find((x) => x.id === id)!
  return (
    <>
      <Heading kind="Open question" title={q.id} />
      <p className="mb-2 font-semibold">{q.title}</p>
      <p className="mb-2">Pins:{" "}
        {q.pins.map(([r, p], i) => (
          <span key={i}>{i > 0 && ", "}<A data-ref={r} onClick={() => select({ kind: "part", ref: r })}>{partName(M.parts[r], r)}.{p}</A> ({M.parts[r].pins[String(p)] || "?"})</span>
        ))}
      </p>
      <Note><b>Check:</b> {q.check}</Note>
      <p className="mb-2 text-[13px] text-muted-foreground">{q.why}</p>
      <p className="mb-1 text-xs text-muted-foreground">Candidates: {(q.candidates || []).join(", ")}</p>
      <p className="text-xs text-muted-foreground">Red: the parts to probe.</p>
    </>
  )
}

function BlockDetail({ blockKey }: { blockKey: string }) {
  const { D, M, select } = useStore()
  const refs = Object.keys(M.parts).filter((r) => M.parts[r].group === blockKey)
  return (
    <>
      <Heading kind="Block" title={D.blocks[blockKey]?.title || blockKey} />
      <ul className="list-disc space-y-0.5 pl-5">
        {refs.map((r) => <li key={r}><A data-ref={r} onClick={() => select({ kind: "part", ref: r })}>{partName(M.parts[r], r)}</A> · {M.parts[r].value}</li>)}
      </ul>
    </>
  )
}

/** The scenario's own fields: its name, the board and the fault. */
function ScenarioForm() {
  const s = useStore()
  const b = s.doc.board
  const set = (key: "title" | "name" | "marking" | "description" | "model_date", v: string) =>
    s.mutate((d) => { if (key === "title") d.board.title = v || d.board.title; else if (key === "name" || key === "marking") d.board[key] = v; else setText(d.board, key, v) })
  return (
    <div id="scenarioform" className="mb-3">
      <Heading kind="Scenario" title={b.title || b.name} />
      <p className="mb-3 text-xs text-muted-foreground">Saved to scenario.json as you go.</p>
      <Field label="Name"><CommitInput id="stitle" className="h-7 text-xs" value={b.title} onCommit={(v) => set("title", v)} /></Field>
      <Field label="Board"><CommitInput id="sboard" className="h-7 text-xs" value={b.name} onCommit={(v) => set("name", v)} /></Field>
      <Field label="Marking (as printed on the board)"><CommitInput id="smarking" className="h-7 text-xs" value={b.marking} onCommit={(v) => set("marking", v)} /></Field>
      <Field label="Device and fault"><CommitText id="sdesc" rows={3} value={b.description || ""} onCommit={(v) => set("description", v)} /></Field>
      <Field label="Model reviewed on"><CommitInput id="sdate" type="date" className="h-7 text-xs" value={b.model_date || ""} onCommit={(v) => set("model_date", v)} /></Field>
      <Instruments />
    </div>
  )
}

const INSTRUMENT_KINDS = ["multimeter", "bench_supply", "usb_meter", "esr_meter", "lcr_meter", "component_tester", "oscilloscope", "thermal_camera", "magnifier", "soldering_iron", "hot_air", "freeze_spray"]

/** What the user has on the bench: the plan only asks for what these can do. */
function Instruments() {
  const s = useStore()
  const list = s.doc.instruments || []
  const edit = (fn: (l: NonNullable<typeof s.doc.instruments>) => void) => s.mutate((d) => { fn(d.instruments ||= []) })
  return (
    <div id="instruments">
      <span className="mb-0.5 block text-xs text-muted-foreground">Instruments (the plan only uses these)</span>
      <ul className="space-y-1">
        {list.map((x, i) => (
          <li key={i} data-instrument={x.kind} className="flex items-center gap-1">
            <NativeSelect size="sm" value={x.kind} className="h-7 w-36 py-0 text-xs" onChange={(e) => edit((l) => { l[i].kind = e.target.value })}>
              {[...INSTRUMENT_KINDS, ...(INSTRUMENT_KINDS.includes(x.kind) ? [] : [x.kind])].map((k) => <NativeSelectOption key={k} value={k}>{k.replace(/_/g, " ")}</NativeSelectOption>)}
            </NativeSelect>
            <CommitInput className="h-7 min-w-0 flex-1 text-xs" value={x.model || ""} placeholder="Model, limits" onCommit={(v) => edit((l) => setText(l[i], "model", v))} />
            <Button size="icon-xs" variant="ghost" title="Remove" onClick={() => edit((l) => { l.splice(i, 1) })}><X /></Button>
          </li>
        ))}
      </ul>
      <Button id="instadd" size="xs" variant="outline" className="mt-1" onClick={() => edit((l) => { l.push({ kind: list.some((x) => x.kind === "multimeter") ? "usb_meter" : "multimeter" }) })}><Plus /> Add an instrument</Button>
    </div>
  )
}

function Empty() {
  const { D, levels, editing } = useStore()
  return (
    <>
      <H3>Details</H3>
      <p className="mb-2 text-muted-foreground">Select a net, a part or a trace.</p>
      {editing && (
        <>
          <H3>Editing</H3>
          <p className="mb-2 text-xs text-muted-foreground">Select a part to edit it, its box and its pins, a net to rename it, or a trace to reshape it. “Draw trace” adds copper you followed in a photo.
            Every change is saved to scenario.json as you go; Undo (Ctrl+Z) steps back.</p>
        </>
      )}
      <H3>Confidence levels</H3>
      {levels.map((k) => <p key={k} className="mb-1.5 text-[13px]"><Chip level={k} tip={false} /> {D.confidence[k].meaning}</p>)}
      <p className="text-[13px] text-muted-foreground">Pins that are not on any net are <b>unknown</b>, not unconnected.</p>
    </>
  )
}

export function DetailPanel() {
  const { selection: sel, M, D, select } = useStore()
  let content
  if (sel?.kind === "net" && M.nets[sel.net]) content = <NetDetail name={sel.net} />
  else if (sel?.kind === "part" && M.parts[sel.ref]) content = <PartDetail ref_={sel.ref} />
  else if (sel?.kind === "trace" && M.traces.some((t) => t.id === sel.id)) content = <TraceDetail id={sel.id} />
  else if (sel?.kind === "question" && D.questions.some((q) => q.id === sel.id)) content = <QuestionDetail id={sel.id} />
  else if (sel?.kind === "block") content = <BlockDetail blockKey={sel.key} />
  else if (sel?.kind === "scenario") content = <ScenarioForm />
  else content = <Empty />
  // the editor applies to a part, a net or a trace; the scenario's form is always editable
  const editable = sel?.kind === "part" || sel?.kind === "net" || sel?.kind === "trace"
  return (
    <div className="flex h-full flex-col">
      {sel && sel.kind !== "scenario" && (
        <div className="flex shrink-0 items-center gap-1.5 border-b px-4 py-1.5">
          {editable && <EditBar />}
          <Button id="clear" size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={() => select(null)}><X /> Clear selection</Button>
        </div>
      )}
      <aside className="detail min-h-0 flex-1 overflow-auto px-4 py-3 text-sm" id="detail">{content}</aside>
    </div>
  )
}
