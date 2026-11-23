"""Checks of app/scripts/investigation.py on a small made-up board: reading parsing, answer matching,
walking the plan's tree along the record, sweeps, the fingerprint, renames, the plan checks and the
reasons for an update. No browser, no photos. From the repository root:

    python -I app/tests/test_investigation.py
"""

import copy
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import investigation as inv  # noqa: E402

FAILED = []


def check(name: str, ok: bool, info: object = "") -> None:
    print(f"{'PASS' if ok else 'FAIL'} {name}{' — ' + str(info) if info != '' else ''}")
    if not ok:
        FAILED.append(name)


SCENARIO = {
    "board": {"title": "Test board", "name": "Test", "marking": ""},
    "instruments": [{"kind": "multimeter"}],
    "parts": {
        "C1": {"kind": "capacitor", "value": "100 nF", "group": "g", "pins": {"1": "1", "2": "2"}},
        "C2": {"kind": "capacitor", "value": "100 nF", "group": "g", "pins": {"1": "1", "2": "2"}},
        "D1": {"kind": "diode", "value": "1N4148", "group": "g", "pins": {"1": "K", "2": "A"}},
    },
    "nets": {
        "+5V": {"nodes": [{"ref": "C1", "pin": "1", "conf": "photo"}, {"ref": "C2", "pin": "1", "conf": "assumed"}]},
        "GND": {"nodes": [{"ref": "C1", "pin": "2", "conf": "photo"}, {"ref": "C2", "pin": "2", "conf": "photo"}]},
    },
    "power_nets": ["+5V", "GND"],
    "open_questions": [],
}
PROTO_DIODE = {
    "title": "Diode",
    "goal": "One way only.",
    "instruments": ["multimeter"],
    "power": "off",
    "steps": [
        {"text": "Forward.", "reading": {"key": "fwd", "label": "Forward", "unit": "V"}},
        {"text": "Reverse.", "reading": {"key": "rev", "label": "Reverse", "unit": "V"}},
    ],
    "answers": [
        {"id": "short", "label": "Short", "outcome": "fail", "when": [{"reading": "fwd", "max": 0.1}, {"reading": "rev", "max": 0.1}]},
        {"id": "good", "label": "Good", "outcome": "pass", "when": [{"reading": "fwd", "min": 0.15, "max": 0.9}, {"reading": "rev", "is": "OL"}]},
        {"id": "unclear", "label": "Other", "outcome": "inconclusive"},
    ],
}
PLAN = {
    "format": "pcb-plan",
    "version": 2,
    "revision": 1,
    "date": "2026-11-22",
    "based_on": {},
    "summary": "Test.",
    "suspects": [{"id": "S1", "title": "A shorted capacitor", "parts": ["C1", "C2"], "mode": "short", "status": "open"}],
    "protocols": {"diode": PROTO_DIODE},
    "phases": [{"id": "power-off", "title": "Power off"}],
    "start": "look",
    "steps": {
        "look": {
            "phase": "power-off",
            "kind": "check",
            "title": "Any burn marks?",
            "instruction": "Look.",
            "why": "Cheap.",
            "skip": "rail",
            "answers": [
                {"id": "yes", "label": "Yes", "outcome": "fail", "next": "replan-damage"},
                {"id": "no", "label": "No", "outcome": "pass", "next": "rail"},
            ],
        },
        "rail": {
            "phase": "power-off",
            "kind": "measure",
            "title": "+5V to GND",
            "target": {"net": "+5V"},
            "readings": [{"key": "ohms", "label": "Resistance", "unit": "Ω"}],
            "instruction": "Measure.",
            "why": "Clears every capacitor of a short.",
            "answers": [
                {"id": "short", "label": "Under 10 Ω", "outcome": "fail", "when": [{"reading": "ohms", "max": 10}], "next": "replan-short",
                 "effects": {"suspects": {"S1": "more_likely"}}},
                {"id": "ok", "label": "Over 1 kΩ", "outcome": "pass", "when": [{"reading": "ohms", "min": 1000}], "next": "diodes",
                 "effects": {"suspects": {"S1": "ruled_out"}, "parts": [{"refs": ["C1", "C2"], "status": "cleared", "of": "short"}]}},
                {"id": "between", "label": "In between", "outcome": "inconclusive", "next": "replan-short"},
            ],
        },
        "diodes": {
            "phase": "power-off",
            "kind": "sweep",
            "title": "Every diode",
            "protocol": "diode",
            "why": "Cheap.",
            "items": [{"id": "D1", "target": {"ref": "D1"}}],
            "answers": [
                {"id": "fail", "label": "One failed", "when": [{"items": "any_fail"}], "next": "replan-short"},
                {"id": "pass", "label": "All passed", "when": [{"items": "all_pass"}], "next": "done"},
                {"id": "partial", "label": "Some unclear", "next": "replan-short"},
            ],
        },
        "replan-damage": {"phase": "power-off", "kind": "replan", "title": "Damage found", "instruction": "Plan the repair of what burnt."},
        "replan-short": {"phase": "power-off", "kind": "replan", "title": "A short", "instruction": "Find it."},
        "done": {"phase": "power-off", "kind": "done", "title": "No fault found", "instruction": "Nothing more."},
    },
    "history": [{"revision": 1, "date": "2026-11-22", "reason": "First plan.", "changes": "All."}],
}


def record(*results, observations=(), instructions=()):
    return {"format": "pcb-record", "version": 2, "observations": list(observations), "instructions": list(instructions), "results": list(results)}


def res(rid, step, outcome, answer=None, item=None, readings=None, **kw):
    r = {"id": rid, "date": "2026-11-22", "step": step, "target": {"ref": "D1"}, "outcome": outcome}
    if answer:
        r["answer"] = answer
    if item:
        r["item"] = item
    if readings:
        r["readings"] = readings
    return r | kw


# ---------------------------------------------------------------- readings and answers
check("parse 4.7k", inv.parse_reading("4.7k", "Ω") == 4700)
check("parse 4k7", inv.parse_reading("4k7", "Ω") == 4700)
check("parse 0,62 V", abs(inv.parse_reading("0,62 V", "V") - 0.62) < 1e-9)
check("parse OL", inv.parse_reading("OL", "Ω") == math.inf)
check("parse 2m on Ω is mega", inv.parse_reading("2m", "Ω") == 2e6)
check("parse 2m on V is milli", inv.parse_reading("2m", "V") == 2e-3)
check("parse junk is NaN", math.isnan(inv.parse_reading("abc", "V")))
units = {"fwd": "V", "rev": "V"}
check("a good diode matches 'good'", inv.match_answer(PROTO_DIODE["answers"], {"fwd": "0.62", "rev": "OL"}, units)["id"] == "good")
check("a shorted diode matches 'short'", inv.match_answer(PROTO_DIODE["answers"], {"fwd": "0.01", "rev": "0.01"}, units)["id"] == "short")
check("an odd reading matches nothing", inv.match_answer(PROTO_DIODE["answers"], {"fwd": "0.62", "rev": "0.5"}, units) is None)
check("OL is above any min", inv.condition_holds({"reading": "x", "min": 1000}, {"x": "OL"}, {"x": "Ω"}))

# ---------------------------------------------------------------- walking the tree
plan = copy.deepcopy(PLAN)
plan["based_on"] = inv.based_on_now(SCENARIO, record())
w = inv.walk(plan, record())
check("an empty record starts at start", w["current"] == "look" and w["state"] == "step" and not w["path"], w)
w = inv.walk(plan, record(res("R1", "look", "pass", "no")))
check("an answer moves to its next step", w["current"] == "rail" and [p["step"] for p in w["path"]] == ["look"], w)
w = inv.walk(plan, record(res("R1", "look", "fail", "yes")))
check("an answer can end in replan", w["current"] == "replan-damage" and w["state"] == "replan", w)
w = inv.walk(plan, record(res("R1", "look", "fail", "yes"), res("R2", "look", "pass", "no")))
check("the latest result wins", w["current"] == "rail", w)
w = inv.walk(plan, record(res("R1", "look", "pass", "no"), res("R2", "look", "fail", "yes", void={"date": "2026-11-22", "reason": "slip"})))
check("a void result counts for nothing", w["current"] == "rail", w)
w = inv.walk(plan, record(res("R1", "look", "skipped")))
check("a skip follows the step's skip", w["current"] == "rail" and w["path"][0]["answer"] is None, w)
w = inv.walk(plan, record(res("R1", "look", "disputed", notes="Can't see")))
check("a disputed step stays current and is flagged", w["current"] == "look" and w["flag"] == "disputed", w)
rec = record(res("R1", "look", "pass", "no"), res("R2", "rail", "pass", "ok", readings={"ohms": "OL"}))
w = inv.walk(plan, rec)
check("a sweep is current until every item has a result", w["current"] == "diodes", w)
w = inv.walk(plan, record(*rec["results"], res("R3", "diodes", "pass", "good", item="D1")))
check("a sweep's answer comes from its items", w["current"] == "done" and w["state"] == "done", w)
w = inv.walk(plan, record(*rec["results"], res("R3", "diodes", "fail", "short", item="D1")))
check("a failed item takes the any_fail branch", w["current"] == "replan-short", w)
w = inv.walk(plan, record(*rec["results"], res("R3", "diodes", "inconclusive", "unclear", item="D1")))
check("an unclear item falls to the catch-all answer", w["current"] == "replan-short" and w["path"][-1]["answer"] == "partial", w)

# ---------------------------------------------------------------- derived state
ok_answer = plan["steps"]["rail"]["answers"][1]
full = record(res("R1", "look", "pass", "no"), res("R2", "rail", "pass", "ok", readings={"ohms": "OL"}, effects=ok_answer["effects"]))
suspects, parts = inv.derived(plan, full)
check("effects of newer results apply", suspects["S1"]["status"] == "ruled_out" and parts["C1"]["status"] == "cleared" and parts["C1"]["of"] == "short", (suspects, parts))
superseded = record(res("R1", "look", "pass", "no"), res("R2", "rail", "pass", "ok", readings={"ohms": "OL"},
                    effects={"suspects": {"S1": "ruled_out"}}), res("R3", "rail", "fail", "short", effects={"suspects": {"S1": "more_likely"}}))
suspects, _ = inv.derived(plan, superseded)
check("only results in force apply their effects", suspects["S1"]["status"] == "open" and suspects["S1"]["trend"] == "more_likely", suspects)
suspects, _ = inv.derived(plan, rec)
check("effects are read from the result, not the plan", suspects["S1"]["status"] == "open", suspects)

# ---------------------------------------------------------------- fingerprint, renames, checks
f0 = inv.fingerprint(SCENARIO)
moved = copy.deepcopy(SCENARIO)
moved["parts"]["C1"]["box"] = {"top": [0, 0, 10, 10]}
moved["parts"]["C1"]["note"] = "a note"
check("boxes and notes don't change the fingerprint", inv.fingerprint(moved) == f0)
changed = copy.deepcopy(SCENARIO)
changed["parts"]["C1"]["value"] = "10 µF"
check("a value changes the fingerprint", inv.fingerprint(changed) != f0)
conf = copy.deepcopy(SCENARIO)
conf["nets"]["+5V"]["nodes"][1]["conf"] = "measured"
check("a confidence changes the fingerprint", inv.fingerprint(conf) != f0)
check("the plan is valid when stamped", inv.check_plan(plan, SCENARIO, record(), strict=True) == [], inv.check_plan(plan, SCENARIO, record(), strict=True))
check("nothing to update right after the stamp", inv.outdated(plan, SCENARIO, record()) == [])
check("a model change makes it out of date", inv.outdated(plan, changed, record()) == ["the board model changed"])
obs = record(observations=[{"id": "O1", "date": "2026-11-22", "text": "C1 looks cracked."}])
check("a new observation makes it out of date", inv.outdated(plan, SCENARIO, obs) == ["new observation: O1"])
check("a disputed step needs an update", any("disputed" in x for x in inv.needs_update(plan, SCENARIO, record(res("R1", "look", "disputed")))))
renamed = copy.deepcopy(SCENARIO)
renamed["parts"]["D10"] = renamed["parts"].pop("D1") | {"formerly": ["D1"]}
check("a renamed part is found through formerly", inv.check_plan(plan, renamed, record(), strict=False) == [], inv.check_plan(plan, renamed, record(), strict=False))
check("but the strict check wants the new name", any("unknown part D1" in p for p in inv.check_plan(plan, renamed, record(), strict=True)))
broken = copy.deepcopy(plan)
broken["steps"]["rail"]["answers"][0]["next"] = "nowhere"
broken["steps"]["orphan"] = {"phase": "power-off", "kind": "done", "title": "Never reached", "instruction": "."}
broken["steps"]["look"]["answers"][1]["when"] = [{"reading": "volts", "min": 1}]
problems = inv.check_plan(broken, SCENARIO, record(), strict=False)
check("broken references are reported", any("nowhere" in p for p in problems) and any("orphan" in p and "reachable" in p for p in problems)
      and any("unknown reading volts" in p for p in problems), problems)
loop = copy.deepcopy(plan)
loop["steps"]["rail"]["answers"][2]["next"] = "look"
check("a loop is reported", any("loop" in p for p in inv.check_plan(loop, SCENARIO, record(), strict=False)))
noinst = copy.deepcopy(SCENARIO)
noinst["instruments"] = []
check("a protocol needing a missing instrument is reported", any("multimeter" in p for p in inv.check_plan(plan, noinst, record(), strict=False)))
bad = record(res("R2", "look", "pass", "no"), res("R1", "look", "pass", "no"))
check("record ids out of order are refused", inv.check_record(bad) != [])
check("the plan and record schemas accept the examples",
      not inv.schema_errors(plan, inv.PLAN_SCHEMA, "plan") and not inv.schema_errors(full, inv.RECORD_SCHEMA, "record"),
      inv.schema_errors(plan, inv.PLAN_SCHEMA, "plan") + inv.schema_errors(full, inv.RECORD_SCHEMA, "record"))
# ---------------------------------------------------------------- the skill's protocol library
library = json.loads((Path(__file__).resolve().parents[2] / ".claude/skills/plan-investigation/reference/protocols.json").read_text(encoding="utf-8"))
lib_plan = copy.deepcopy(plan) | {"protocols": library}
lib_scenario = copy.deepcopy(SCENARIO) | {"instruments": [{"kind": k} for k in ("multimeter", "usb_meter", "esr_meter")]}
lib_problems = inv.schema_errors(lib_plan, inv.PLAN_SCHEMA, "library") + inv.check_plan(lib_plan, lib_scenario, record(), strict=False)
check("the skill's protocol library is valid", not lib_problems, lib_problems)
unreadable = [f"{k}: {a['id']}" for k, p in library.items() for a in p["answers"] for c in a.get("when", [])
              if c.get("reading") not in {s["reading"]["key"] for s in p["steps"] if s.get("reading")}]
check("library conditions name the protocol's own readings", not unreadable, unreadable)

print(f"\n{len(FAILED)} failed" if FAILED else "\nall passed")
sys.exit(1 if FAILED else 0)
