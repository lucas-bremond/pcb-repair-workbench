"""The investigation: plan.json (the agent's analysis) and record.json (what the user did and said).

Loads and checks both against scenario.json, walks the plan's tree of steps along the user's
answers, computes the model's fingerprint, and writes exports/investigation.md. The format is
specified in docs/scenario-format.md; the app (web/src/investigation.ts) walks the tree the same way.

For the agent (from the repository root):
    python -I app/scripts/investigation.py status SCENARIO [--json]   # where things stand, what changed
    python -I app/scripts/investigation.py check SCENARIO             # strict check of plan.json
    python -I app/scripts/investigation.py stamp SCENARIO             # set plan.based_on to now,
                                                                      # format plan.json, check it
"""

import argparse
import hashlib
import json
import math
import re
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

sys.path.insert(0, str(Path(__file__).resolve().parent))
import scenario_json  # noqa: E402

APP = Path(__file__).resolve().parent.parent
PLAN_SCHEMA = json.loads((APP / "schema" / "plan.schema.json").read_text(encoding="utf-8"))
RECORD_SCHEMA = json.loads((APP / "schema" / "record.schema.json").read_text(encoding="utf-8"))
LISTS = {"observations": "O", "instructions": "I", "results": "R"}
ANSWERED = {"pass", "fail", "inconclusive"}
BLOCKING = {"not_done", "disputed"}
TERMINAL = {"replan", "done"}

# ----------------------------------------------------------------------------- loading


def schema_errors(doc, schema: dict, name: str) -> list[str]:
    return [
        f"{name}: {'/'.join(str(k) for k in e.absolute_path) or '(top level)'}: {e.message}"
        for e in sorted(Draft202012Validator(schema).iter_errors(doc), key=lambda e: list(map(str, e.absolute_path)))
    ]


def load(path: Path, schema: dict, name: str | None = None) -> tuple[dict | None, list[str]]:
    """The document (None when the file does not exist) and its schema errors, reported under
    `name` (default: the file's name)."""
    name = name or path.name
    if not path.exists():
        return None, []
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as err:
        return None, [f"{name}: {err}"]
    return doc, schema_errors(doc, schema, name)


def empty_record() -> dict:
    return {"format": "pcb-record", "version": 2, "observations": [], "instructions": [], "results": []}


def number(entry_id: str | None) -> int:
    return int(entry_id[1:]) if entry_id else 0


# ----------------------------------------------------------------------------- readings

PREFIX = {"p": 1e-12, "n": 1e-9, "u": 1e-6, "µ": 1e-6, "μ": 1e-6, "m": 1e-3, "k": 1e3, "K": 1e3, "M": 1e6, "G": 1e9}


def parse_reading(text: str, unit: str = "") -> float:
    """A meter reading in base units: "4.7k", "4k7", "0.62 V", "100n", "OL" (inf). NaN when unreadable.
    A lone "m" is milli, except for resistance, where meters show M for mega. Same as the app's."""
    t = re.sub(r"\s+", "", str(text).strip().replace(",", "."))
    if not t:
        return math.nan
    if re.fullmatch(r"(?i)(ol|o\.l\.?|open|inf|∞)", t):
        return math.inf

    def mult(p: str) -> float:
        return 1e6 if p == "m" and unit == "Ω" else PREFIX.get(p, 1)

    m = re.fullmatch(r"(\d+)([pnuµμmkKMG])(\d+)[ΩVFA]?", t)
    if m:
        return float(f"{m[1]}.{m[3]}") * mult(m[2])
    m = re.fullmatch(r"(?i)([-+]?\d*\.?\d+(?:e[-+]?\d+)?)([pnuµμmkKMG]?)(?:Ω|ohms?|V|F|A|°C)?", t)
    if not m:
        return math.nan
    return float(m[1]) * (mult(m[2]) if m[2] else 1)


def condition_holds(cond: dict, readings: dict, units: dict) -> bool:
    if "reading" not in cond:
        return False
    v = parse_reading(readings.get(cond["reading"], ""), units.get(cond["reading"], ""))
    if math.isnan(v):
        return False
    if cond.get("is") == "OL" and v != math.inf:
        return False
    if "min" in cond and not v >= cond["min"]:
        return False
    return not ("max" in cond and not v <= cond["max"])


def sweep_holds(cond: dict, outcomes: list[str]) -> bool:
    kind = cond.get("items")
    if kind == "all_pass":
        return bool(outcomes) and all(o == "pass" for o in outcomes)
    if kind == "any_fail":
        return any(o == "fail" for o in outcomes)
    return kind == "otherwise"


def match_answer(answers: list[dict], readings: dict, units: dict) -> dict | None:
    """The first answer whose conditions all hold (an answer without conditions never matches)."""
    for a in answers:
        if a.get("when") and all(condition_holds(c, readings, units) for c in a["when"]):
            return a
    return None


def match_sweep(answers: list[dict], outcomes: list[str]) -> dict | None:
    """The first answer whose item conditions hold; one without conditions always does."""
    for a in answers:
        if not a.get("when") or all(sweep_holds(c, outcomes) for c in a["when"]):
            return a
    return None


# ----------------------------------------------------------------------------- the plan's steps


def protocol_of(plan: dict, step: dict) -> dict | None:
    return plan.get("protocols", {}).get(step.get("protocol", ""))


def step_readings(plan: dict, step: dict) -> list[dict]:
    """The readings a step asks for: its own, else its protocol's."""
    if step.get("readings"):
        return step["readings"]
    proto = protocol_of(plan, step)
    return [s["reading"] for s in (proto or {}).get("steps", []) if s.get("reading")]


def step_answers(plan: dict, step: dict) -> list[dict]:
    return step.get("answers") or (protocol_of(plan, step) or {}).get("answers", [])


def item_answers(plan: dict, step: dict, item: dict) -> list[dict]:
    return item.get("answers") or (protocol_of(plan, step) or {}).get("answers", [])


def live(record: dict) -> list[dict]:
    """The results that are not void, in order."""
    return [r for r in record.get("results", []) if not r.get("void")]


def in_force(record: dict) -> dict[tuple[str, str | None], dict]:
    """The result in force per (step, item): the latest that is not void."""
    latest = {}
    for r in live(record):
        if r.get("step"):
            latest[(r["step"], r.get("item"))] = r
    return latest


def walk(plan: dict | None, record: dict | None) -> dict:
    """Follow the user's answers from plan.start.

    Returns {"path": [{"step", "result", "answer"}], "current": step id or None,
    "state": "step" | "replan" | "done" | "blocked" | "none", "flag": outcome or reason or None}.
    The current step is the first one without a usable answer; it is not part of the path."""
    if not plan:
        return {"path": [], "current": None, "state": "none", "flag": None}
    latest = in_force(record or {})
    path, cur, seen = [], plan["start"], set()
    while True:
        step = plan["steps"].get(cur)
        if step is None or cur in seen:
            return {"path": path, "current": cur, "state": "blocked", "flag": "missing step" if step is None else "loop"}
        seen.add(cur)
        if step["kind"] in TERMINAL:
            return {"path": path, "current": cur, "state": step["kind"], "flag": None}
        r = latest.get((cur, None))
        if r and r["outcome"] in BLOCKING:
            return {"path": path, "current": cur, "state": "step", "flag": r["outcome"]}
        if r and r["outcome"] == "skipped":
            if step.get("skip"):
                path.append({"step": cur, "result": r, "answer": None})
                cur = step["skip"]
                continue
            return {"path": path, "current": cur, "state": "step", "flag": None}
        answer = None
        if r and r.get("answer"):
            answer = next((a for a in step_answers(plan, step) if a["id"] == r["answer"]), None)
            if answer is None:
                return {"path": path, "current": cur, "state": "step", "flag": "answer no longer in the plan"}
        elif step["kind"] == "sweep":
            items = step.get("items", [])
            got = [latest.get((cur, it["id"])) for it in items]
            if items and all(got):
                answer = match_sweep(step.get("answers", []), [g["outcome"] for g in got])
        if not answer or not answer.get("next"):
            return {"path": path, "current": cur, "state": "step", "flag": None}
        path.append({"step": cur, "result": r, "answer": answer["id"]})
        cur = answer["next"]


# ----------------------------------------------------------------------------- names, fingerprint


def names(scenario: dict) -> tuple[dict[str, str], dict[str, str]]:
    """Every name a part or a net goes by (its current one and its former ones) -> the current one."""
    refs = {r: r for r in scenario["parts"]}
    for r, p in scenario["parts"].items():
        for old in p.get("formerly", []):
            refs.setdefault(old, r)
    nets = {n: n for n in scenario["nets"]}
    for n, net in scenario["nets"].items():
        for old in net.get("formerly", []):
            nets.setdefault(old, n)
    return refs, nets


def fingerprint(scenario: dict) -> str:
    """A hash of what the plan depends on: parts (kind, value, package, pins), nets (their nodes and
    confidence), power nets and instruments. Boxes, traces, notes and layouts do not count."""
    core = {
        "parts": {
            r: {"kind": p.get("kind", ""), "value": p["value"], "package": p.get("package", ""), "pins": {str(k): str(v) for k, v in p["pins"].items()}}
            for r, p in scenario["parts"].items()
        },
        "nets": {n: sorted([x["ref"], str(x["pin"]), x["conf"]] for x in net["nodes"]) for n, net in scenario["nets"].items()},
        "power_nets": sorted(scenario.get("power_nets", [])),
        "instruments": sorted([i["kind"], i.get("model", ""), i.get("notes", "")] for i in scenario.get("instruments", [])),
    }
    text = json.dumps(core, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return "sha256:" + hashlib.sha256(text.encode()).hexdigest()[:16]


def last_id(record: dict, key: str) -> str | None:
    items = record.get(key, [])
    return max((e["id"] for e in items), key=number) if items else None


def voided(record: dict) -> int:
    return sum(1 for key in LISTS for e in record.get(key, []) if e.get("void"))


def based_on_now(scenario: dict, record: dict) -> dict:
    return {
        "model": fingerprint(scenario),
        "observations": last_id(record, "observations"),
        "instructions": last_id(record, "instructions"),
        "results": last_id(record, "results"),
        "voided": voided(record),
    }


def outdated(plan: dict, scenario: dict, record: dict) -> list[str]:
    """Why the plan no longer reflects the folder (empty when it does). New results don't count:
    following the tree is the normal course."""
    b, now, why = plan["based_on"], based_on_now(scenario, record), []
    if b["model"] != now["model"]:
        why.append("the board model changed")
    for key, what in (("observations", "observation"), ("instructions", "instruction")):
        new = [e["id"] for e in record.get(key, []) if number(e["id"]) > number(b[key]) and not e.get("void")]
        if new:
            why.append(f"new {what}{'s' if len(new) > 1 else ''}: {', '.join(new)}")
    if now["voided"] != b["voided"]:
        why.append("an entry was voided")
    return why


def needs_update(plan: dict, scenario: dict, record: dict) -> list[str]:
    """Every reason to run the planning skill again."""
    why = outdated(plan, scenario, record)
    w = walk(plan, record)
    if w["state"] == "replan":
        why.append(f"the plan reached its end: {w['current']}")
    elif w["state"] == "blocked":
        why.append(f"the plan is broken at {w['current']} ({w['flag']})")
    elif w["flag"]:
        why.append(f"step {w['current']}: {w['flag'].replace('_', ' ')}")
    return why


# ----------------------------------------------------------------------------- checks


def target_problem(target: dict, refs: dict, nets: dict) -> str | None:
    if "ref" in target:
        return None if target["ref"] in refs else f"unknown part {target['ref']}"
    if "net" in target:
        return None if target["net"] in nets else f"unknown net {target['net']}"
    for ref, _pin in target["pins"]:
        if ref not in refs:
            return f"unknown part {ref}"
    return None


def pin_problem(ref: str, pin: str, scenario: dict, refs: dict) -> str | None:
    if ref not in refs:
        return f"unknown part {ref}"
    if str(pin) not in scenario["parts"][refs[ref]]["pins"]:
        return f"{ref} has no pin {pin}"
    return None


def check_record(record: dict) -> list[str]:
    """Problems the schema cannot see: ids unique and in order, superseded results that exist."""
    errors = []
    for key, prefix in LISTS.items():
        last = 0
        for e in record.get(key, []):
            n = number(e["id"])
            if e["id"][0] != prefix or n <= last:
                errors.append(f"record.json: {key}: {e['id']} is out of order or repeated")
            last = max(last, n)
    ids = {r["id"] for r in record.get("results", [])}
    for r in record.get("results", []):
        if not r.get("step") and not r.get("target"):
            errors.append(f"record.json: {r['id']} answers no step and has no target")
        if r.get("supersedes") and r["supersedes"] not in ids:
            errors.append(f"record.json: {r['id']} supersedes {r['supersedes']}, which does not exist")
    return errors


def check_plan(plan: dict, scenario: dict, record: dict, strict: bool) -> list[str]:
    """Problems in plan.json against the current folder. Strict (the agent's check) uses current names
    only and requires based_on to match; otherwise names go through `formerly`."""
    problems = []
    refs, nets = names(scenario) if not strict else ({r: r for r in scenario["parts"]}, {n: n for n in scenario["nets"]})
    instruments = {i["kind"] for i in scenario.get("instruments", [])}
    steps, protocols = plan["steps"], plan["protocols"]
    phases = {p["id"] for p in plan["phases"]}
    suspects = {s["id"] for s in plan.get("suspects", [])}
    questions = {q["id"] for q in scenario.get("open_questions", [])}
    known = {e["id"] for key in LISTS for e in record.get(key, [])}

    def say(where: str, what: str | None) -> None:
        if what:
            problems.append(f"{where}: {what}")

    def check_effects(where: str, effects: dict | None) -> None:
        for sid in (effects or {}).get("suspects", {}):
            if sid not in suspects:
                say(where, f"effect on unknown suspect {sid}")
        for entry in (effects or {}).get("parts", []):
            for ref in entry["refs"]:
                if ref not in refs:
                    say(where, f"effect on unknown part {ref}")

    def check_answers(where: str, answers: list[dict], readings: set[str], sweep: bool, in_plan: bool) -> None:
        seen = set()
        for a in answers:
            w = f"{where}, answer {a['id']}"
            if a["id"] in seen:
                say(w, "repeated id")
            seen.add(a["id"])
            if not sweep and "outcome" not in a:
                say(w, "no outcome")
            for c in a.get("when", []):
                if "items" in c and not sweep:
                    say(w, "an items condition outside a sweep")
                if "reading" in c and c["reading"] not in readings:
                    say(w, f"condition on unknown reading {c['reading']}")
            if in_plan:
                if not a.get("next"):
                    say(w, "no next step")
                elif a["next"] not in steps:
                    say(w, f"next step {a['next']} does not exist")
            check_effects(w, a.get("effects"))

    for pid, proto in protocols.items():
        for kind in proto["instruments"]:
            if kind not in instruments:
                say(f"protocol {pid}", f"needs a {kind}, which is not in the instruments")
        keys = {s["reading"]["key"] for s in proto["steps"] if s.get("reading")}
        check_answers(f"protocol {pid}", proto["answers"], keys, sweep=False, in_plan=False)

    if plan["start"] not in steps:
        problems.append(f"start: step {plan['start']} does not exist")
    for sid, step in steps.items():
        w = f"step {sid}"
        kind = step["kind"]
        if step["phase"] not in phases:
            say(w, f"unknown phase {step['phase']}")
        proto = protocols.get(step.get("protocol", "")) if step.get("protocol") else None
        if step.get("protocol") and proto is None:
            say(w, f"unknown protocol {step['protocol']}")
        if step.get("target"):
            say(w, target_problem(step["target"], refs, nets))
            for ref, pin in step["target"].get("pins", []):
                say(w, pin_problem(ref, pin, scenario, refs) if ref in refs else None)
        for probe in step.get("probes", []) + [p for it in step.get("items", []) for p in it.get("probes", [])]:
            if probe.get("ref") and probe.get("pin"):
                say(w, pin_problem(probe["ref"], probe["pin"], scenario, refs))
            elif probe.get("ref"):
                say(w, target_problem({"ref": probe["ref"]}, refs, nets))
            elif probe.get("net"):
                say(w, target_problem({"net": probe["net"]}, refs, nets))
        for kind_needed in step.get("instruments", []):
            if kind_needed not in instruments:
                say(w, f"needs a {kind_needed}, which is not in the instruments")
        if step.get("question") and step["question"] not in questions:
            say(w, f"unknown open question {step['question']}")
        if step.get("skip") and step["skip"] not in steps:
            say(w, f"skip goes to {step['skip']}, which does not exist")
        if kind in TERMINAL:
            if step.get("answers") or step.get("items"):
                say(w, f"a {kind} step has no answers or items")
            continue
        if not step.get("why"):
            say(w, "no why")
        if kind == "sweep":
            if not step.get("items"):
                say(w, "a sweep without items")
            if not proto:
                say(w, "a sweep needs a protocol")
            keys = {r["key"] for r in step_readings(plan, step)}
            ids = set()
            for it in step.get("items", []):
                if it["id"] in ids:
                    say(w, f"repeated item {it['id']}")
                ids.add(it["id"])
                say(f"{w}, item {it['id']}", target_problem(it["target"], refs, nets))
                if it.get("answers"):
                    check_answers(f"{w}, item {it['id']}", it["answers"], keys, sweep=False, in_plan=False)
            if not step.get("answers"):
                say(w, "no answers")
            check_answers(w, step.get("answers", []), set(), sweep=True, in_plan=True)
        else:
            if step.get("items"):
                say(w, "items outside a sweep")
            if not step.get("answers"):
                say(w, "no answers")
            if not step.get("instruction") and not proto:
                say(w, "no instruction and no protocol")
            keys = {r["key"] for r in step_readings(plan, step)}
            check_answers(w, step.get("answers", []), keys, sweep=False, in_plan=True)

    # the tree: every step reachable from start, no loops, every path ends in replan or done
    if plan["start"] in steps:
        reach, state = set(), {}

        def visit(sid: str, trail: list[str]) -> None:
            if sid not in steps:
                return
            if state.get(sid) == 1:
                problems.append(f"steps form a loop: {' -> '.join(trail[trail.index(sid):] + [sid])}")
                return
            if state.get(sid) == 2:
                return
            state[sid] = 1
            reach.add(sid)
            step = steps[sid]
            nexts = [a.get("next") for a in step.get("answers", []) if a.get("next")] + ([step["skip"]] if step.get("skip") else [])
            for n in nexts:
                visit(n, trail + [sid])
            state[sid] = 2

        visit(plan["start"], [])
        for sid in steps:
            if sid not in reach:
                problems.append(f"step {sid} is not reachable from {plan['start']}")

    for s in plan.get("suspects", []):
        for ref in s.get("parts", []):
            if ref not in refs:
                say(f"suspect {s['id']}", f"unknown part {ref}")
        for e in s.get("evidence", {}).get("for", []) + s.get("evidence", {}).get("against", []):
            if e not in known:
                say(f"suspect {s['id']}", f"evidence {e} does not exist")
    for f in plan.get("findings", []):
        for e in f.get("evidence", []):
            if e not in known:
                say(f"finding {f['id']}", f"evidence {e} does not exist")
    for ref, a in plan.get("assessment", {}).items():
        if ref not in refs:
            say("assessment", f"unknown part {ref}")
        for e in a.get("evidence", []):
            if e not in known:
                say(f"assessment {ref}", f"evidence {e} does not exist")
    for h in plan["history"]:
        for iid in h.get("replies", {}):
            if iid not in known:
                say(f"history {h['revision']}", f"reply to unknown instruction {iid}")
    if plan["history"][-1]["revision"] != plan["revision"]:
        problems.append(f"history: the last entry is for revision {plan['history'][-1]['revision']}, not {plan['revision']}")
    for key in ("findings", "suspects"):
        ids = [x["id"] for x in plan.get(key, [])]
        for dup in sorted({i for i in ids if ids.count(i) > 1}):
            problems.append(f"{key}: repeated id {dup}")
    if strict:
        now = based_on_now(scenario, record)
        if plan["based_on"] != now:
            problems.append(f"based_on is {json.dumps(plan['based_on'])}, the folder is now {json.dumps(now)} (run stamp)")
    return problems


# ----------------------------------------------------------------------------- derived state


def derived(plan: dict, record: dict) -> tuple[dict[str, dict], dict[str, dict]]:
    """Suspects (by id) and part states (by ref) as of now: the plan's, then the effects of the results
    in force that are newer than the plan."""
    suspects = {s["id"]: dict(s, trend=None) for s in plan.get("suspects", [])}
    parts = {ref: dict(a) for ref, a in plan.get("assessment", {}).items()}
    since = number(plan["based_on"]["results"])
    force = {id(r) for r in in_force(record).values()}
    for r in live(record):
        if number(r["id"]) <= since or (r.get("step") and id(r) not in force):
            continue
        eff = r.get("effects", {})
        for sid, change in eff.get("suspects", {}).items():
            if sid in suspects:
                if change in ("ruled_out", "confirmed"):
                    suspects[sid]["status"] = change
                else:
                    suspects[sid]["trend"] = change
        for entry in eff.get("parts", []):
            for ref in entry["refs"]:
                parts[ref] = {k: v for k, v in entry.items() if k != "refs"} | {"evidence": [r["id"]]}
    return suspects, parts


# ----------------------------------------------------------------------------- investigation.md


def md(text: str) -> str:
    return str(text).replace("|", "\\|").replace("\n", " ")


def target_text(t: dict | None) -> str:
    if not t:
        return ""
    if "ref" in t:
        return t["ref"]
    if "net" in t:
        return t["net"]
    return " to ".join(f"{r}.{p}" for r, p in t["pins"])


def write_investigation_md(scenario: dict, plan: dict | None, record: dict, path: Path, fmt_tables) -> None:
    """The plan, the results and the timeline, readable without the app."""
    lines = [
        f"# Investigation: {scenario['board']['title']}",
        "",
        "Generated by `build.py` from `plan.json` and `record.json`. Do not edit by hand.",
        "",
    ]
    if plan:
        w = walk(plan, record)
        why = needs_update(plan, scenario, record)
        lines += [f"Plan revision {plan['revision']} ({plan['date']}).", ""]
        if plan.get("warning"):
            lines += [f"> {plan['warning']}", ""]
        lines += ["## Where we are", "", plan["summary"], ""]
        cur = plan["steps"].get(w["current"] or "", {})
        if w["state"] == "done":
            lines += [f"**Done:** {cur.get('title', '')}", ""]
        elif w["current"]:
            lines += [f"**Current step:** {cur.get('title', w['current'])} (`{w['current']}`)", ""]
        if why:
            lines += ["**The plan needs an update:** " + "; ".join(why) + ".", ""]
        suspects, parts = derived(plan, record)
        if plan.get("findings"):
            lines += ["## Findings", ""]
            lines += [f"- **{f['title']}.** {f.get('text', '')}".rstrip() for f in plan["findings"]]
            lines.append("")
        if suspects:
            lines += ["## Suspects", "", "| Suspect | Parts | Status | Why |", "| --- | --- | --- | --- |"]
            for s in suspects.values():
                status = s["status"].replace("_", " ") + (f" ({s['trend'].replace('_', ' ')})" if s.get("trend") else "")
                lines.append(f"| {s['id']}: {md(s['title'])} | {', '.join(s.get('parts', []))} | {status} | {md(s.get('why', ''))} |")
            lines.append("")
        if parts:
            lines += ["## Parts assessed", "", "| Part | State | Note |", "| --- | --- | --- |"]
            for ref, a in sorted(parts.items()):
                state = a["status"] + (f" of {a['of']}" if a.get("of") else "")
                lines.append(f"| {ref} | {state} | {md(a.get('note', ''))} |")
            lines.append("")
        lines += ["## Steps taken", ""]
        if not w["path"]:
            lines.append("None yet.")
        for i, p in enumerate(w["path"], 1):
            step = plan["steps"][p["step"]]
            r = p["result"]
            label = next((a["label"] for a in step_answers(plan, step) if a["id"] == p["answer"]), "skipped" if p["answer"] is None else p["answer"])
            reading = ", ".join(f"{k} {v}" for k, v in (r or {}).get("readings", {}).items())
            lines.append(f"{i}. **{step['title']}** {label}{f' ({reading})' if reading else ''}{f' [{r['id']}]' if r else ''}")
        lines.append("")
    else:
        lines += ["No plan yet: run the plan-investigation skill.", ""]
    results = record.get("results", [])
    if results:
        lines += ["## Results", "", "| Result | Date | Step | Target | Readings | Outcome | Notes |", "| --- | --- | --- | --- | --- | --- | --- |"]
        for r in results:
            readings = ", ".join(f"{k} {v}" for k, v in r.get("readings", {}).items())
            step = r.get("step", "") + (f" / {r['item']}" if r.get("item") else "")
            outcome = r["outcome"].replace("_", " ") + (f" ({r['answer']})" if r.get("answer") else "")
            rid = f"~~{r['id']}~~ (void: {r['void']['reason']})" if r.get("void") else r["id"]
            lines.append(f"| {md(rid)} | {r['date']} | {md(step)} | {md(target_text(r.get('target')))} | {md(readings)} | {outcome} | {md(r.get('notes', ''))} |")
        lines.append("")
    replies = {iid: (h["revision"], text) for h in (plan or {}).get("history", []) for iid, text in h.get("replies", {}).items()}
    timeline = [(e["date"], number(e["id"]), "observations", e) for e in record.get("observations", [])]
    timeline += [(e["date"], number(e["id"]), "instructions", e) for e in record.get("instructions", [])]
    if timeline:
        lines += ["## Observations and instructions", ""]
        for date, _, key, e in sorted(timeline, key=lambda x: (x[0], x[2], x[1])):
            kind = "Observation" if key == "observations" else "Instruction"
            text = e["text"].replace("\n", " ")
            if e.get("void"):
                text = f"~~{text}~~ (void: {e['void']['reason']})"
            lines.append(f"- **{e['id']}** ({date}, {kind.lower()}) {text}")
            if e["id"] in replies:
                rev, reply = replies[e["id"]]
                lines.append(f"  - Reply (revision {rev}): {reply}")
        lines.append("")
    if plan:
        lines += ["## Plan history", ""]
        for h in plan["history"]:
            lines.append(f"- **Revision {h['revision']}** ({h['date']}). {h['reason']} {h['changes']}")
            lines += [f"  - Model: {c}" for c in h.get("model_changes", [])]
        lines.append("")
    path.write_text("\n".join(fmt_tables(lines)), encoding="utf-8")


# ----------------------------------------------------------------------------- the agent's commands


def load_folder(folder: Path) -> tuple[dict, dict | None, dict, list[str]]:
    """scenario.json, plan.json (or None), record.json (or an empty one), and their schema errors."""
    scenario = json.loads((folder / "scenario.json").read_text(encoding="utf-8"))
    plan, perr = load(folder / "plan.json", PLAN_SCHEMA)
    record, rerr = load(folder / "record.json", RECORD_SCHEMA)
    return scenario, plan, record or empty_record(), perr + rerr + (check_record(record) if record and not rerr else [])


def model_diff(base: dict, now: dict) -> list[str]:
    """What changed in the parts and nets between the model the plan was written from and now."""
    out = []
    bp, np_ = base.get("parts", {}), now.get("parts", {})
    for ref in sorted(set(np_) - set(bp)):
        former = [r for r in np_[ref].get("formerly", []) if r in bp]
        out.append(f"part {ref} renamed from {former[0]}" if former else f"part {ref} added ({np_[ref].get('kind', '')} {np_[ref]['value']})")
    renamed = {f for p in np_.values() for f in p.get("formerly", [])}
    for ref in sorted(set(bp) - set(np_) - renamed):
        out.append(f"part {ref} removed")
    for ref in sorted(set(bp) & set(np_)):
        for key in ("kind", "value", "package", "pins"):
            if bp[ref].get(key) != np_[ref].get(key):
                out.append(f"part {ref}: {key} {json.dumps(bp[ref].get(key), ensure_ascii=False)} -> {json.dumps(np_[ref].get(key), ensure_ascii=False)}")
    nodes = lambda doc: {(x["ref"], str(x["pin"])): (n, x["conf"]) for n, net in doc.get("nets", {}).items() for x in net["nodes"]}  # noqa: E731
    bn, nn = nodes(base), nodes(now)
    for key in sorted(set(bn) | set(nn)):
        if bn.get(key) != nn.get(key):
            was = f"{bn[key][0]} ({bn[key][1]})" if key in bn else "no net"
            new = f"{nn[key][0]} ({nn[key][1]})" if key in nn else "no net"
            out.append(f"pin {key[0]}.{key[1]}: {was} -> {new}")
    if base.get("instruments") != now.get("instruments"):
        out.append(f"instruments: {json.dumps(now.get('instruments', []), ensure_ascii=False)}")
    if sorted(base.get("power_nets", [])) != sorted(now.get("power_nets", [])):
        out.append(f"power nets: {now.get('power_nets', [])}")
    return out


def status(folder: Path) -> dict:
    scenario, plan, record, errors = load_folder(folder)
    out: dict = {"scenario": str(folder), "errors": errors, "fingerprint": fingerprint(scenario), "based_on_now": based_on_now(scenario, record)}
    if not plan or errors:
        out["plan"] = None
        return out
    w = walk(plan, record)
    b = plan["based_on"]
    base_file = folder / "generated" / "plan-base.json"
    base = json.loads(base_file.read_text(encoding="utf-8")) if base_file.exists() else None
    suspects, parts = derived(plan, record)
    step_ids = set(plan["steps"])
    out["plan"] = {
        "revision": plan["revision"],
        "needs_update": needs_update(plan, scenario, record),
        "problems": check_plan(plan, scenario, record, strict=False),
        "model_changes": (model_diff(base, scenario) if base else ["(no generated/plan-base.json: compare by hand)"]) if b["model"] != fingerprint(scenario) else [],
        "current": w["current"],
        "state": w["state"],
        "flag": w["flag"],
        "path": [{"step": p["step"], "answer": p["answer"], "result": (p["result"] or {}).get("id")} for p in w["path"]],
        "new_results": [r for r in live(record) if number(r["id"]) > number(b["results"])],
        "results_off_plan": [r["id"] for r in live(record) if r.get("step") and r["step"] not in step_ids],
        "new_observations": [e for e in record["observations"] if number(e["id"]) > number(b["observations"])],
        "instructions_in_force": [e for e in record["instructions"] if not e.get("void")],
        "unanswered_instructions": [
            e["id"] for e in record["instructions"] if not e.get("void") and not any(e["id"] in h.get("replies", {}) for h in plan["history"])
        ],
        "voided": [e["id"] for key in LISTS for e in record.get(key, []) if e.get("void")],
        "suspects": [{"id": s["id"], "title": s["title"], "status": s["status"], "trend": s["trend"]} for s in suspects.values()],
        "parts": parts,
    }
    return out


def print_status(st: dict) -> None:
    print(f"scenario: {st['scenario']}")
    for e in st["errors"]:
        print(f"  error: {e}")
    p = st["plan"]
    if p is None:
        print("no plan.json yet" if not st["errors"] else "fix the errors above first")
        print(f"based_on for a new plan: {json.dumps(st['based_on_now'])}")
        return
    print(f"plan revision {p['revision']}; current step: {p['current']} ({p['state']}{', ' + p['flag'] if p['flag'] else ''})")
    print("needs update: " + ("; ".join(p["needs_update"]) or "no"))
    for title, items in (
        ("problems in plan.json", p["problems"]),
        ("model changes since the plan", p["model_changes"]),
        ("unanswered instructions", p["unanswered_instructions"]),
        ("results whose step is no longer in the plan", p["results_off_plan"]),
        ("void entries", p["voided"]),
    ):
        if items:
            print(f"{title}:")
            for i in items:
                print(f"  - {i}")
    print("path walked:")
    for i, s in enumerate(p["path"], 1):
        print(f"  {i}. {s['step']} -> {s['answer'] or 'skipped'} ({s['result'] or 'derived from its items'})")
    if p["new_results"]:
        print("results since the plan:")
        for r in p["new_results"]:
            readings = ", ".join(f"{k}={v}" for k, v in r.get("readings", {}).items())
            where = r.get("step", "(outside the plan)") + (f"/{r['item']}" if r.get("item") else "")
            print(f"  - {r['id']} {where} {target_text(r.get('target'))}: {r['outcome']}{' (' + r['answer'] + ')' if r.get('answer') else ''} {readings} {r.get('notes', '')}".rstrip())
    if p["new_observations"]:
        print("observations since the plan:")
        for e in p["new_observations"]:
            print(f"  - {e['id']}{' (void)' if e.get('void') else ''}: {e['text']}")
    if p["instructions_in_force"]:
        print("instructions in force:")
        for e in p["instructions_in_force"]:
            print(f"  - {e['id']}: {e['text']}")
    print("suspects now:")
    for s in p["suspects"]:
        print(f"  - {s['id']} {s['status']}{' (' + s['trend'] + ')' if s['trend'] else ''}: {s['title']}")
    print(f"based_on for the next revision: {json.dumps(st['based_on_now'])}")


def main() -> int:
    parser = argparse.ArgumentParser(description="The investigation plan: status, check, stamp.")
    parser.add_argument("command", choices=["status", "check", "stamp"])
    parser.add_argument("scenario", type=Path)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    folder = args.scenario.resolve()
    if args.command == "status":
        st = status(folder)
        print(json.dumps(st, ensure_ascii=False, indent=1) if args.json else "", end="\n" if args.json else "")
        if not args.json:
            print_status(st)
        return 1 if st["errors"] else 0
    scenario, plan, record, errors = load_folder(folder)
    if plan is None and not errors:
        print("no plan.json")
        return 1
    if args.command == "stamp" and not errors:
        plan["based_on"] = based_on_now(scenario, record)
        scenario_json.dump_file(plan, folder / "plan.json")
        (folder / "generated").mkdir(exist_ok=True)
        base = {k: scenario.get(k) for k in ("parts", "nets", "power_nets", "instruments")}
        (folder / "generated" / "plan-base.json").write_text(json.dumps(base, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"stamped: {json.dumps(plan['based_on'])}")
    problems = errors or check_plan(plan, scenario, record, strict=True)
    for p in problems:
        print(f"plan problem: {p}")
    if not problems:
        w = walk(plan, record)
        print(f"plan.json is valid: revision {plan['revision']}, {len(plan['steps'])} steps, current step {w['current']} ({w['state']})")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
