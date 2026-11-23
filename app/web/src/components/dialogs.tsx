// Promise-based confirm and prompt dialogs (shadcn Dialog), in place of window.confirm/prompt.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

interface Ask { kind: "confirm" | "prompt"; title: string; body?: string; action?: string; danger?: boolean }
interface Dialogs {
  confirm: (o: Omit<Ask, "kind">) => Promise<boolean>
  prompt: (o: Omit<Ask, "kind">) => Promise<string | null>
}
const Ctx = createContext<Dialogs | null>(null)
export const useDialogs = () => useContext(Ctx)!

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [ask, setAsk] = useState<Ask | null>(null)
  const [text, setText] = useState("")
  const resolve = useRef<(v: any) => void>(() => {})
  const open = useCallback((a: Ask) => new Promise<any>((res) => { resolve.current = res; setText(""); setAsk(a) }), [])
  const done = (v: any) => { resolve.current(v); resolve.current = () => {}; setAsk(null) }
  const api: Dialogs = {
    confirm: useCallback((o) => open({ ...o, kind: "confirm" }), [open]),
    prompt: useCallback((o) => open({ ...o, kind: "prompt" }), [open]),
  }
  const cancel = () => done(ask?.kind === "prompt" ? null : false)
  const ok = () => done(ask?.kind === "prompt" ? text.trim() || null : true)
  return (
    <Ctx.Provider value={api}>
      {children}
      <Dialog open={!!ask} onOpenChange={(o) => { if (!o) cancel() }}>
        <DialogContent className="sm:max-w-md" data-dialog={ask?.kind}>
          <DialogHeader>
            <DialogTitle>{ask?.title}</DialogTitle>
            {ask?.body && <DialogDescription>{ask.body}</DialogDescription>}
          </DialogHeader>
          {ask?.kind === "prompt" && (
            <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ok() }} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={cancel}>Cancel</Button>
            <Button data-ok variant={ask?.danger ? "destructive" : "default"} onClick={ok}>{ask?.action || "OK"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  )
}
