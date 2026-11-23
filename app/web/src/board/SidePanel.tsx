// The board's lists, each a panel of the workspace: parts (a sortable, filterable table), nets and
// traces. The filter box at the top of each is shared: typing in one filters all three.
import { useMemo, useState, type ReactNode } from "react"
import { ArrowDown, ArrowUp, ClipboardCheck, Plus, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Chip, KindTag } from "@/components/bits"
import { OUTCOME_LABEL, PART_STATUS, protocolChoices, resultsForPart, type Result } from "@/investigation"
import { OutcomeTag } from "@/investigate/pieces"
import { TestDialog } from "@/investigate/TestDialog"
import { KINDS, kindOf, natural, partName, partSides, type Part, type Side } from "@/model"
import { useStore, type Prefs, type SortKey } from "@/store"
import { useEditOps } from "@/board/editOps"
import { revealDetails } from "@/workspace/api"

interface Row { ref: string; p: Part; name: string; type: string; known: number; total: number; sides: Side[]; results: Result[]; last: Result | null }
// tested: failures first, then unclear, then passed, then untested
const TESTED_ORDER: Record<string, number> = { fail: 0, inconclusive: 1, pass: 2 }
const testedRank = (r: Row) => (r.last ? TESTED_ORDER[r.last.outcome] : 3)
const SORTS: Record<SortKey, (a: Row, b: Row) => number> = {
  tested: (a, b) => testedRank(a) - testedRank(b) || natural(a.name, b.name),
  ref: (a, b) => natural(a.name, b.name),
  type: (a, b) => natural(a.type, b.type) || natural(a.name, b.name),
  value: (a, b) => natural(a.p.value, b.p.value) || natural(a.name, b.name),
  known: (a, b) => a.known - b.known || a.known / a.total - b.known / b.total || natural(a.name, b.name),
}

/** A list panel: a header with its count and the board filter (shared by the lists), then the list. */
function ListFrame({ id, count, children }: { id: string; count: ReactNode; children: ReactNode }) {
  const { search, setSearch } = useStore()
  return (
    <div className="flex h-full flex-col" data-list={id}>
      <div className="flex shrink-0 items-center gap-2 border-b px-2.5 py-1.5">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 pl-7 text-xs" data-search={id}
            {...(id === "parts" ? { id: "search" } : {})} placeholder="Filter parts, nets and traces…" aria-label="Filter parts, nets and traces" />
        </div>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums" id={`n-${id}`}>{count}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2.5 py-2">{children}</div>
    </div>
  )
}

const shown = (n: number, of: number) => (n === of ? `${of}` : `${n} of ${of}`)

/** The parts table: type chips, side and known-nets filters, sortable columns. */
export function PartsPanel() {
  const { D, M, enabled, prefs, setPrefs, search, selection, select, editing, partStates, plan, record } = useStore()
  const ops = useEditOps()
  const [testing, setTesting] = useState<string | null>(null)
  const f = search.trim().toLowerCase()
  const all = useMemo<Row[]>(() => Object.keys(M.parts).map((ref) => {
    const p = M.parts[ref], pins = Object.keys(p.pins)
    const known = pins.filter((n) => { const pn = M.pinNet[`${ref}.${n}`]; return pn && enabled.has(pn.conf) }).length
    const results = resultsForPart(plan, record, new Set([ref, ...(p.formerly || [])]))
    const last = [...results].reverse().find((r) => r.outcome in TESTED_ORDER) || null
    return { ref, p, name: partName(p, ref), type: kindOf(p).label, known, total: pins.length, sides: partSides(p), results, last }
  }), [M, enabled, plan, record])
  const rows = all.filter((r) =>
    (!f || `${r.ref} ${r.name} ${r.p.value} ${r.type}`.toLowerCase().includes(f)) &&
    (!prefs.types.length || prefs.types.includes(r.p.kind || "")) &&
    (!prefs.side || (prefs.side === "none" ? !r.sides.length : r.sides.includes(prefs.side))) &&
    (!prefs.known || r.known > 0))
  const { key, dir } = prefs.sort
  rows.sort((a, b) => dir * (SORTS[key] || SORTS.ref)(a, b))
  const count: Record<string, number> = {}
  for (const p of Object.values(D.parts)) count[p.kind || ""] = (count[p.kind || ""] || 0) + 1
  const kinds = [...Object.keys(KINDS), ...Object.keys(count).filter((k) => !KINDS[k])].filter((k) => count[k])
  const filtering = prefs.types.length > 0
  const sortBy = (k: SortKey) =>
    setPrefs((p) => ({ sort: p.sort.key === k ? { key: k, dir: (-p.sort.dir) as 1 | -1 } : { key: k, dir: k === "known" ? -1 : 1 } }))
  const Th = ({ k, children, className, title }: { k: SortKey; children: ReactNode; className?: string; title?: string }) => (
    <TableHead
      data-sort={k}
      title={title}
      onClick={() => sortBy(k)}
      className={cn("sticky -top-2 z-10 h-7 cursor-pointer bg-background px-1 text-[11px] select-none hover:text-foreground", key === k && "text-primary", className)}
    >
      <span className="inline-flex items-center gap-0.5">
        {children}
        {key === k && (dir > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </span>
    </TableHead>
  )
  return (
    <ListFrame id="parts" count={shown(rows.length, all.length)}>
      <div className="mb-2 flex flex-col gap-2">
        <div className="typechips flex flex-wrap gap-1" id="typechips" title="Show only these types (none selected: all)">
          {kinds.map((k) => {
            const on = prefs.types.includes(k), kind = kindOf({ kind: k } as Part)
            return (
              <button
                key={k}
                data-kind={k}
                aria-pressed={on}
                onClick={() => setPrefs((p) => ({ types: on ? p.types.filter((x) => x !== k) : [...p.types, k] }))}
                className={cn("rounded-full border border-transparent px-2 py-px text-[11px] transition-opacity", kind.cls,
                  filtering && !on && "opacity-45", on && "border-current")}
              >
                {kind.label}<span className="ml-1 opacity-70">{count[k]}</span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <NativeSelect id="pside" size="sm" aria-label="Side" value={prefs.side} className="h-7 py-0 text-xs"
            onChange={(e) => setPrefs({ side: e.target.value as Prefs["side"] })}>
            <NativeSelectOption value="">Both sides</NativeSelectOption>
            <NativeSelectOption value="top">Top side</NativeSelectOption>
            <NativeSelectOption value="bottom">Bottom side</NativeSelectOption>
            <NativeSelectOption value="none">Not placed</NativeSelectOption>
          </NativeSelect>
          <Label className="text-xs font-normal" title="Only parts with at least one pin on a known net">
            <Switch size="sm" id="pknown" checked={prefs.known} onCheckedChange={(c) => setPrefs({ known: c })} /> Known nets
          </Label>
          <Button id="preset" variant="link" size="xs" className="ml-auto px-0" hidden={!(prefs.types.length || prefs.side || prefs.known)}
            onClick={() => setPrefs({ types: [], side: "", known: false })}>
            Reset
          </Button>
        </div>
      </div>
      <Table className="ptable table-fixed text-xs" containerClassName="overflow-visible">
        <colgroup><col className="w-[18%]" /><col className="w-[24%]" /><col /><col className="w-[12%]" /><col className="w-[78px]" /></colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <Th k="ref">Part</Th><Th k="type">Type</Th><Th k="value">Value</Th>
            <Th k="known" className="text-right" title="Pins on a known net / all pins">Nets</Th>
            <Th k="tested" className="pl-2" title="The latest test result, or a button to test the part">Tested</Th>
          </TableRow>
        </TableHeader>
        <TableBody id="parts">
          {rows.length ? rows.map((r) => (
            <TableRow
              key={r.ref}
              data-ref={r.ref}
              data-state={selection?.kind === "part" && selection.ref === r.ref ? "selected" : undefined}
              onClick={() => select({ kind: "part", ref: r.ref })}
              onDoubleClick={(e) => { if (!(e.target as HTMLElement).closest("button")) { select({ kind: "part", ref: r.ref }); revealDetails() } }}
              title={`${r.name}: ${r.p.value}${r.p.package ? " · " + r.p.package : ""}${r.sides.length ? " · " + r.sides.join(" and ") + " side" + (r.sides.length > 1 ? "s" : "") : " · not placed on either side"}`}
              className="cursor-pointer data-[state=selected]:bg-primary/15"
            >
              <TableCell className="truncate px-1 py-1 font-semibold">
                {r.name}
                {partStates[r.ref] && <span data-state={partStates[r.ref].status} title={`${PART_STATUS[partStates[r.ref].status].label}${partStates[r.ref].of ? ` of ${partStates[r.ref].of}` : ""}`}
                  className={cn("ml-1 inline-block size-2 rounded-full align-middle", PART_STATUS[partStates[r.ref].status].dot)} />}
              </TableCell>
              <TableCell className="truncate px-1 py-1"><KindTag part={r.p} /></TableCell>
              <TableCell className="truncate px-1 py-1">{r.p.value}</TableCell>
              <TableCell className={cn("kn px-1 py-1 text-right tabular-nums", r.known ? "" : "text-muted-foreground")}>{r.known}/{r.total}</TableCell>
              <TableCell className="py-0.5 pr-1 pl-2" data-tested={r.last?.outcome || undefined}>
                {r.last ? (
                  <span title={r.results.map((x) => `${x.id} · ${x.date} · ${OUTCOME_LABEL[x.outcome]}${x.notes ? ` · ${x.notes}` : ""}`).join("\n")}>
                    <OutcomeTag outcome={r.last.outcome} className="text-[11px]" />
                    {r.results.length > 1 && <span className="ml-0.5 text-[10px] text-muted-foreground">×{r.results.length}</span>}
                  </span>
                ) : (
                  <Button size="xs" variant="ghost" data-test-part={r.ref} className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                    disabled={!protocolChoices(plan, r.p.kind || "").length}
                    title={protocolChoices(plan, r.p.kind || "").length ? `Test ${r.name} with one of the plan's procedures` : "The plan has no test procedure for this kind of part yet: the plan-investigation skill adds them"}
                    onClick={() => setTesting(r.ref)}><ClipboardCheck /> Test</Button>
                )}
              </TableCell>
            </TableRow>
          )) : (
            <TableRow className="hover:bg-transparent"><TableCell colSpan={5} className="py-3 text-center text-muted-foreground">No part matches the filters.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
      {testing && M.parts[testing] && (
        <TestDialog key={testing} open onOpenChange={(o) => { if (!o) setTesting(null) }}
          spec={{ title: `Test ${partName(M.parts[testing], testing)}`, subtitle: [M.parts[testing].kind, M.parts[testing].value, M.parts[testing].package].filter(Boolean).join(" · "),
            target: { ref: testing }, protocols: protocolChoices(plan, M.parts[testing].kind || ""), allowLifted: true }} />
      )}
      {editing && <Button id="addpart" size="xs" variant="outline" className="mt-2" onClick={ops.addPart}><Plus /> Add part</Button>}
    </ListFrame>
  )
}

const itemCls = "flex cursor-pointer items-center justify-between gap-2 rounded-md px-1.5 py-1 text-[13px] hover:bg-muted data-[selected=true]:bg-primary/15"

export function NetsPanel() {
  const { M, enabled, search, selection, select } = useStore()
  const f = search.trim().toLowerCase()
  const items = Object.entries(M.nets).flatMap(([name, net]) => {
    const vis = net.nodes.filter((n) => enabled.has(n.conf))
    if (!vis.length) return []
    const hay = (name + " " + net.description + " " + net.nodes.map((n) => n.ref).join(" ")).toLowerCase()
    if (f && !hay.includes(f)) return []
    return [{ name, vis: vis.length }]
  })
  return (
    <ListFrame id="nets" count={shown(items.length, Object.keys(M.nets).length)}>
      <ul id="nets">
        {items.map(({ name, vis }) => (
          <li key={name} data-net={name} className={itemCls} data-selected={selection?.kind === "net" && selection.net === name}
            onClick={() => select({ kind: "net", net: name })} onDoubleClick={() => { select({ kind: "net", net: name }); revealDetails() }}>
            <span className="truncate">{name}</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">{vis} <Chip level={M.netConfidence[name]} /></span>
          </li>
        ))}
      </ul>
    </ListFrame>
  )
}

export function TracesPanel() {
  const { M, search, selection, select } = useStore()
  const f = search.trim().toLowerCase()
  const items = M.traces.filter((t) => !f || (t.id + " " + t.net + " " + (t.evidence || "")).toLowerCase().includes(f))
  return (
    <ListFrame id="traces" count={shown(items.length, M.traces.length)}>
      <ul id="traces">
        {items.map((t) => (
          <li key={t.id} data-trace={t.id} className={itemCls} data-selected={selection?.kind === "trace" && selection.id === t.id}
            onClick={() => select({ kind: "trace", id: t.id })} onDoubleClick={() => { select({ kind: "trace", id: t.id }); revealDetails() }}>
            <span className="truncate">{t.id} · {t.net}</span>
            <span className="text-xs text-muted-foreground">{t.side}</span>
          </li>
        ))}
      </ul>
    </ListFrame>
  )
}
