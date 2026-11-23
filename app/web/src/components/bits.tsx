// Small shared pieces: confidence chips, part-type tags, in-text links, section headings.
import type { ComponentProps, ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { kindOf, type Part } from "@/model"
import { useStore } from "@/store"

/** A confidence level as a coloured pill; hovering it shows what the level means (tip={false} where the meaning is already written next to it). */
export function Chip({ level, className, tip = true, ...rest }: { level: string; tip?: boolean } & ComponentProps<"span">) {
  const { D } = useStore()
  const pill = (
    <span
      className={cn("inline-flex items-center rounded-full px-2 py-px text-[11px] leading-4 font-medium whitespace-nowrap text-white", tip && "cursor-help", className)}
      style={{ background: D.confidence[level]?.color }}
      data-conf={level}
      {...rest}
    >
      {level}
    </span>
  )
  const meaning = D.confidence[level]?.meaning
  if (!tip || !meaning) return pill
  return (
    <Tooltip>
      <TooltipTrigger asChild>{pill}</TooltipTrigger>
      <TooltipContent className="max-w-64">{meaning}</TooltipContent>
    </Tooltip>
  )
}

export function KindTag({ part, className }: { part: Part; className?: string }) {
  const k = kindOf(part)
  return (
    <span className={cn("inline-block rounded-full px-1.5 text-[11px] leading-[17px] whitespace-nowrap", k.cls, className)} title={`kind: ${part.kind || "?"}`}>
      {k.label}
    </span>
  )
}

export function A({ className, ...rest }: ComponentProps<"a">) {
  return <a className={cn("cursor-pointer text-primary underline underline-offset-2 hover:text-primary/80", className)} {...rest} />
}

export function H3({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("mt-3 mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase first:mt-0", className)}>{children}</h3>
}

export function Note({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("my-2 rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-[13px] ", className)}>
      {children}
    </div>
  )
}

export const Ev = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cn("text-xs text-muted-foreground", className)}>{children}</span>
)
