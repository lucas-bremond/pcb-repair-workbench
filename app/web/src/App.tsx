// The scenario page, after Kandev's workbench: the sidebar (scenario picker, panels, layouts, save
// status) and the workspace of panels. The editor's controls are in the panels they apply to.
import { useEffect } from "react"
import { useStore } from "@/store"
import { TestHooks } from "@/TestHooks"
import { useEditorKeys } from "@/workspace/editor"
import { Sidebar } from "@/workspace/Sidebar"
import { Workspace } from "@/workspace/Workspace"

export function App() {
  const { D } = useStore()
  useEffect(() => { document.title = D.board.title || D.board.name }, [D.board.title, D.board.name])
  useEditorKeys()
  return (
    <div className="flex h-svh overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <Workspace />
      </main>
      <TestHooks />
    </div>
  )
}
