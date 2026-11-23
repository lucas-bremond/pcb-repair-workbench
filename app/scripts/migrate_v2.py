"""Migrate a version 1 scenario folder to version 2 (docs/scenario-format.md).

Version 1 kept the repair log ("log") and the part tests ("tests") inside scenario.json. Version 2
splits the investigation into plan.json (the agent's) and record.json (the user's). This script:

- writes record.json: the log's investigation rows become observations (O1, O2...) and the tests
  become results (R1, R2...);
- saves the whole old log, rendered, to docs/repair-log-v1.md, for the plan-investigation skill to
  read when it writes the first plan (findings, suspects and next tests are the agent's to redo);
- removes "log" and "tests" from scenario.json, sets "version": 2, and adds the instruments given;
- removes exports/repair-log.md (exports/investigation.md replaces it).

Usage (from the repository root):
    python -I app/scripts/migrate_v2.py scenarios/<id> [--instrument multimeter ...]
Then run the plan-investigation skill on the folder.
"""

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import scenario_json  # noqa: E402

STATUS = {"open": "Open", "ruled_out": "Ruled out", "confirmed": "Confirmed"}


def cell(text) -> str:
    return str(text).replace("|", "\\|").replace("\n", " ")


def render_log(doc: dict) -> str:
    """The version 1 log as Markdown, as build.py used to export it."""
    log = doc.get("log", {})
    lines = [f"# Repair log, version 1: {doc['board']['title']}", "", "The repair log as it was before the investigation moved to `plan.json` and `record.json`.", ""]
    if log.get("warning"):
        lines += [f"> {log['warning']}", ""]
    if log.get("progress"):
        lines += ["## Where we were", ""]
        current = next((i for i, step in enumerate(log["progress"]) if not step["done"]), None)
        for i, step in enumerate(log["progress"]):
            here = " (we were here)" if i == current else ""
            lines.append(f"- [{'x' if step['done'] else ' '}] **{i + 1}. {step['text']}**{here}")
            lines += [f"  - [{'x' if sub['done'] else ' '}] {sub['text']}" for sub in step.get("steps", [])]
        lines.append("")
    if log.get("investigation"):
        lines += ["## Investigation", "", "| # | Date | Action | Result | Conclusion |", "| --- | --- | --- | --- | --- |"]
        for r in log["investigation"]:
            lines.append(f"| {r['n']} | {r['date']} | {cell(r['action'])} | {cell(r.get('result', ''))} | {cell(r.get('conclusion', ''))} |")
        lines.append("")
    if log.get("findings"):
        lines += ["## Findings", ""]
        lines += [f"- **{f['title']}.** {f.get('text', '')}".rstrip() for f in log["findings"]]
        lines.append("")
    if log.get("suspects"):
        lines += ["## Suspects", ""]
        for x in log["suspects"]:
            note = f" ({x['note']})" if x.get("note") else ""
            parts = f" [{', '.join(x['parts'])}]" if x.get("parts") else ""
            lines.append(f"- {STATUS[x['status']]}{note}: {x['suspect']}{parts}")
        lines.append("")
    if log.get("next_tests"):
        lines += ["## Next tests", ""]
        for i, t in enumerate(log["next_tests"], 1):
            text = t.get("text", "").replace("\n", "\n   ")
            lines.append(f"{i}. [{'x' if t['done'] else ' '}] **{t['title']}.** {text}".rstrip())
        lines.append("")
    return "\n".join(lines)


def sentence(text: str) -> str:
    text = text.strip()
    return text if not text or re.search(r"[.!?]$", text) else text + "."


def migrate(folder: Path, instruments: list[str]) -> str:
    path = folder / "scenario.json"
    doc = json.loads(path.read_text(encoding="utf-8"))
    if doc.get("version") == 2:
        return f"{folder}: already version 2"
    if (folder / "record.json").exists():
        raise SystemExit(f"{folder}: record.json already exists; not overwriting it")
    log, tests = doc.pop("log", {}) or {}, doc.pop("tests", []) or []
    observations = []
    for i, row in enumerate(log.get("investigation", []), 1):
        text = f"**{sentence(row['action'])}** {sentence(row.get('result', ''))}"
        if row.get("conclusion"):
            text += f" Conclusion: {sentence(row['conclusion'])[0].lower()}{sentence(row['conclusion'])[1:]}"
        observations.append({"id": f"O{i}", "date": row["date"], "text": text.strip()})
    results = []
    for i, t in enumerate(tests, 1):
        r = {"id": f"R{i}", "date": t["date"], "target": {"ref": t["ref"]}, "protocol": t["protocol"], "conditions": {"power": "off", "in_circuit": t["in_circuit"]}}
        if t.get("readings"):
            r["readings"] = t["readings"]
        r["outcome"] = t["outcome"]
        if t.get("notes"):
            r["notes"] = t["notes"]
        results.append(r)
    record = {"format": "pcb-record", "version": 2, "observations": observations, "instructions": [], "results": results}
    if log:
        (folder / "docs").mkdir(exist_ok=True)
        (folder / "docs" / "repair-log-v1.md").write_text(render_log({"board": doc["board"], "log": log}), encoding="utf-8")
    doc["version"] = 2
    if instruments and "instruments" not in doc:
        ordered = {}
        for k, v in doc.items():
            ordered[k] = v
            if k == "board":
                ordered["instruments"] = [{"kind": kind} for kind in instruments]
        doc = ordered
    scenario_json.dump_file(doc, path)
    scenario_json.dump_file(record, folder / "record.json")
    old = folder / "exports" / "repair-log.md"
    if old.exists():
        old.unlink()
    return f"{folder}: migrated ({len(observations)} observations, {len(results)} results{', log saved to docs/repair-log-v1.md' if log else ''})"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("folders", type=Path, nargs="+")
    parser.add_argument("--instrument", action="append", default=[], help="an instrument kind the user has (repeatable)")
    args = parser.parse_args()
    for folder in args.folders:
        print(migrate(folder.resolve(), args.instrument))
    return 0


if __name__ == "__main__":
    sys.exit(main())
