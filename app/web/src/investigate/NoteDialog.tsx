// Write an observation (a fact: what you saw, did or know) or an instruction (a request for the agent's
// next round), linked to what is selected on the board and to the step being followed.
import { useEffect, useState } from "react"
import { Eye, MessageSquarePlus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { targetText, type Note, type Target } from "@/investigation"
import { useStore } from "@/store"

export type NoteKind = "observations" | "instructions"

const KIND: Record<NoteKind, { label: string; title: string; help: string; placeholder: string }> = {
  observations: {
    label: "Observation", title: "Add an observation",
    help: "A fact for the agent to reason from: what you saw, smelled, measured outside the plan, or did to the board.",
    placeholder: "C7's top looks slightly domed. The fault happened once without pressing anything.",
  },
  instructions: {
    label: "Instruction for the agent", title: "Write an instruction for the agent",
    help: "A request for the next planning round: a direction, a constraint, a doubt about the model, a question. It stays in force until you void it.",
    placeholder: "Don't plan any desoldering yet. Re-read U2's marking: I think it is a regulator.",
  },
}

export function NoteDialog({ open, onOpenChange, kind: initialKind = "observations", about: initialAbout, step }: {
  open: boolean; onOpenChange: (o: boolean) => void; kind?: NoteKind; about?: Target[]; step?: string | null
}) {
  const s = useStore()
  const [kind, setKind] = useState<NoteKind>(initialKind)
  const [text, setText] = useState("")
  const [about, setAbout] = useState<Target[]>([])
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!open) return
    setKind(initialKind); setText(""); setError("")
    const sel = s.selection
    setAbout(initialAbout ?? (sel?.kind === "part" ? [{ ref: sel.ref }] : sel?.kind === "net" ? [{ net: sel.net }] : []))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const k = KIND[kind]
  const save = async () => {
    if (!text.trim()) return
    setSaving(true); setError("")
    try {
      await s.addRecord<Note>(kind, { text: text.trim(), ...(about.length ? { about } : {}), ...(step ? { step } : {}) })
      onOpenChange(false)
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-dialog="note" id="notedialog">
        <DialogHeader>
          <DialogTitle>{k.title}</DialogTitle>
          <DialogDescription>{k.help}</DialogDescription>
        </DialogHeader>
        <ToggleGroup type="single" variant="outline" size="sm" value={kind} onValueChange={(v) => v && setKind(v as NoteKind)} className="w-full">
          <ToggleGroupItem value="observations" data-kind="observations" className="flex-1"><Eye /> Observation</ToggleGroupItem>
          <ToggleGroupItem value="instructions" data-kind="instructions" className="flex-1"><MessageSquarePlus /> Instruction</ToggleGroupItem>
        </ToggleGroup>
        <textarea id="notetext" autoFocus rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={k.placeholder}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save() }}
          className="w-full resize-y rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30" />
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>About:</span>
          {about.length === 0 && <span>nothing in particular (select a part or net on the board to link it)</span>}
          {about.map((t, i) => (
            <span key={i} className={cn("inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-foreground")} data-about={targetText(t)}>
              {targetText(t)}
              <button type="button" aria-label={`Unlink ${targetText(t)}`} onClick={() => setAbout(about.filter((_, j) => j !== i))}><X className="size-3" /></button>
            </span>
          ))}
          {step && s.plan?.steps[step] && <span>· while on “{s.plan.steps[step].title}”</span>}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button id="notesave" disabled={!text.trim() || saving} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
