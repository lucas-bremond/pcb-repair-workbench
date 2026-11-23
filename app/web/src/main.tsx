import { StrictMode, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import "@fontsource-variable/figtree"
import "dockview-react/dist/styles/dockview.css"
import "./index.css"
import "./workspace/dockview.css"
import { App } from "@/App"
import { loadScenario } from "@/model"
import { ScenarioBrowser } from "@/ScenarioBrowser"
import { StoreProvider } from "@/store"
import { TooltipProvider } from "@/components/ui/tooltip"
import { DialogsProvider } from "@/components/dialogs"

// ?s=<root>/<folder> opens a scenario; without it, the page lists them.
const id = new URLSearchParams(location.search).get("s")
const root = createRoot(document.getElementById("root")!)
const render = (node: ReactNode) => root.render(
  <StrictMode>
    <TooltipProvider delayDuration={400}>
      <DialogsProvider>{node}</DialogsProvider>
    </TooltipProvider>
  </StrictMode>,
)

if (!id) render(<ScenarioBrowser />)
else {
  try {
    const loaded = await loadScenario(id)
    if (!loaded.view && !loaded.status.ok) throw new Error(loaded.status.errors.join("; "))
    document.title = loaded.doc.board.title || loaded.doc.board.name
    render(<StoreProvider initial={loaded}><App /></StoreProvider>)
  } catch (err: any) {
    const el = document.getElementById("root")!
    el.className = "p-6 font-sans"
    el.innerHTML = ""
    const p = document.createElement("p"), a = document.createElement("a")
    p.textContent = `Could not open the scenario ${id}: ${err.message}`
    a.href = "./"; a.textContent = "Back to the scenarios"; a.className = "underline"
    el.append(p, a)
  }
}
