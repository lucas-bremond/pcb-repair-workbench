import { Card } from "@/components/ui/card"
import { useStore } from "@/store"
import { revealBoard, revealDetails } from "@/workspace/api"

/** The block diagram as built; a click on a block shows its parts on the board, a double-click its details. */
export function DiagramTab() {
  const { D, select } = useStore()
  return (
    <div className="flex flex-col gap-3 p-3">
      <p className="text-sm text-muted-foreground">Solid links: confirmed or traced in a photo. Dashed: datasheet or assumed. Click a block to see its parts on the board, double-click it for its details.</p>
      <Card className="diagram overflow-auto bg-white p-3 dark:bg-white"
        onClick={(e) => {
          const g = (e.target as Element).closest<SVGGElement>(".block[data-block]")
          if (!g) return
          select({ kind: "block", key: g.dataset.block! })
          revealBoard()
        }}
        onDoubleClick={(e) => {
          const g = (e.target as Element).closest<SVGGElement>(".block[data-block]")
          if (!g) return
          select({ kind: "block", key: g.dataset.block! })
          revealDetails()
        }}
        dangerouslySetInnerHTML={{ __html: D.diagram }} />
    </div>
  )
}
