// The board editor's controls, shown where they apply: the 2D panels carry the full bar (Edit, select
// or draw, finish, undo, redo, and what a click does now), the Details panel a compact one. The save
// status sits in the sidebar's footer, and the editor's keys work anywhere on the page.
import { useEffect } from "react"
import { AlertTriangle, Check, Loader2, MousePointer2, PenLine, Pencil, Redo2, RotateCw, Undo2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useEditOps } from "@/board/editOps"
import { useStore } from "@/store"

/** Where the edits stand: saved to scenario.json, waiting, or refused (with the reasons). */
export function SaveStatus() {
  const { save, editing } = useStore()
  const { state, errors, warnings, message } = save
  if (state === "saved" && !editing && !warnings.length) return null
  const label = {
    saved: <><Check className="text-success" /> Saved</>,
    pending: <><Loader2 className="animate-spin" /> Saving…</>,
    saving: <><Loader2 className="animate-spin" /> Saving…</>,
    error: <><AlertTriangle className="text-destructive" /> Not saved</>,
    conflict: <><AlertTriangle className="text-destructive" /> Changed on disk</>,
  }[state]
  const details = state === "error" ? errors : state === "conflict" ? [message || "scenario.json changed on disk."] : warnings
  if (!details.length) return <span id="savestatus" data-state={state} className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">{label}</span>
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button id="savestatus" data-state={state} variant="ghost" size="xs" className="text-xs [&_svg]:size-3.5">
          {label}{state === "saved" && <span className="text-muted-foreground">({warnings.length} warning{warnings.length > 1 ? "s" : ""})</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-md p-3 text-xs">
        {state === "error" && <p className="mb-1.5 font-semibold">scenario.json was not updated. Fix these (or undo), and the next edit saves:</p>}
        {state === "conflict" && <p className="mb-1.5 font-semibold">Something else changed scenario.json. Reload to get its version; edits not yet saved here are lost.</p>}
        {state === "saved" && <p className="mb-1.5 font-semibold">Saved, with warnings:</p>}
        <ul id="saveerrors" className="list-disc space-y-1 pl-4">{details.map((e, i) => <li key={i}>{e}</li>)}</ul>
        {state === "conflict" && <Button size="xs" className="mt-2" onClick={() => location.reload()}><RotateCw /> Reload</Button>}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Edit on and off; with `full`, the photo tools and what a click does now. Undo and redo while editing. */
export function EditBar({ full = false }: { full?: boolean }) {
  const s = useStore()
  const ops = useEditOps()
  const { editing } = s
  const hint = s.hint || (!editing ? "Click a box, a trace or a list item. Dashed boxes: no known connections." : s.tool === "draw"
    ? "Click points on a photo; double-click, Enter or “Finish trace” to end; Esc cancels. The new trace takes the selected net."
    : "Select a part to move or resize its box and edit its pins; select a trace to drag its points.")
  return (
    <div className="flex min-w-0 shrink-0 items-center gap-1.5" data-editbar={full ? "full" : "compact"}>
      <Toggle id="edit" variant="outline" size="sm" pressed={editing} onPressedChange={(on) => s.setEditing(on)}
        title="Edit the board model: boxes, traces, parts, pins and nets"
        className="h-7 shrink-0 px-2.5 text-xs data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
        <Pencil /> Edit
      </Toggle>
      <div {...(full ? { id: "editbar" } : {})} hidden={!editing} className="flex shrink-0 items-center gap-1.5">
        {full && (
          <>
            <ToggleGroup type="single" variant="outline" size="sm" value={s.tool} onValueChange={(v) => v && s.setTool(v as "select" | "draw")}>
              <ToggleGroupItem value="select" data-tool="select" title="Select a part or trace; drag boxes, corners and trace points" className="h-7 px-2 text-xs">
                <MousePointer2 /> Select
              </ToggleGroupItem>
              <ToggleGroupItem value="draw" data-tool="draw" title="Click points on a photo; double-click, Enter or Finish to end; Esc cancels" className="h-7 px-2 text-xs">
                <PenLine /> Draw trace
              </ToggleGroupItem>
            </ToggleGroup>
            <Button id="finish" size="sm" variant="outline" className="h-7 text-xs" hidden={!(s.draft && (s.draft.points.length >= 2 || s.draft.extend))} onClick={ops.finishDraft}>
              <Check /> Finish trace
            </Button>
          </>
        )}
        <Button id="undo" size="icon-sm" variant="outline" className="size-7" title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!s.canUndo} onClick={s.undo}><Undo2 /></Button>
        <Button id="redo" size="icon-sm" variant="outline" className="size-7" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" disabled={!s.canRedo} onClick={s.redo}><Redo2 /></Button>
      </div>
      {full && <span className={cn("min-w-0 truncate text-xs text-muted-foreground")} id="hint" title={hint}>{hint}</span>}
    </div>
  )
}

/** The editor's keys: undo and redo, Escape (cancel the trace being drawn, or clear the selection),
 *  Enter (finish the trace), Delete (the selected trace, while editing). */
export function useEditorKeys() {
  const s = useStore()
  const ops = useEditOps()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|SELECT|TEXTAREA/.test((document.activeElement as HTMLElement)?.tagName || "") || document.querySelector("[role=dialog]")
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !typing) { e.preventDefault(); if (e.shiftKey) s.redo(); else s.undo(); return }
      if (typing) return
      if (e.key === "Escape") { if (s.getDraft()) ops.cancelDraft(); else s.select(null) }
      else if (e.key === "Enter" && s.getDraft()) ops.finishDraft()
      else if ((e.key === "Delete" || e.key === "Backspace") && s.editing && s.selection?.kind === "trace") { e.preventDefault(); ops.deleteTrace(s.selection.id) }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  })
}
