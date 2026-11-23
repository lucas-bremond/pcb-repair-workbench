"""Validate a scenario and generate its outputs.

A scenario is one folder: scenario.json (the board model, see app/schema/scenario.schema.json),
plan.json (the agent's investigation plan) and record.json (what the user did and said), the
photos and documents they refer to, and two folders this script writes:

    exports/      netlist.md, block-diagram.svg, schematic.kicad_sch and investigation.md, meant to
                  be read and versioned with the scenario (build.sh adds schematic.svg and the
                  KiCad checks)
    generated/    the viewer's data: view.json, model3d.json, resized photos and 3D textures, and
                  status.json (this build's result); a cache, rebuilt from the rest, never edited

A broken plan.json never stops the build: the model must stay editable while the plan is out of
date. Its problems are reported separately ("plan" in the JSON result).

Usage (from app/):
    python -I scripts/build.py SCENARIO                        # validate and generate
    python -I scripts/build.py SCENARIO --check                # validate only
    python -I scripts/build.py SCENARIO --input FILE --json    # validate FILE as the scenario
                                                               # and generate from it (the server)
    python -I scripts/build.py SCENARIO --investigation [--record FILE] --json
                                                               # check plan.json and record.json
                                                               # (or FILE) only, and write
                                                               # investigation.md (the server)
    python -I scripts/build.py SCENARIO --check-netlist F.net  # compare a kicad-cli netlist
"""

import argparse
import html
import io
import json
import re
import sys
import uuid
from pathlib import Path

import cv2
from jsonschema import Draft202012Validator
from PIL import Image, ImageOps

sys.path.insert(0, str(Path(__file__).resolve().parent))
from align import frame_and_images  # noqa: E402
from board3d import board_3d_payload  # noqa: E402
import investigation  # noqa: E402
from schematic import merge_layout, prune_conflicts, render, resolve_layout, symbol_geometry  # noqa: E402

APP = Path(__file__).resolve().parent.parent
SCHEMA = json.loads((APP / "schema" / "scenario.schema.json").read_text(encoding="utf-8"))
PHOTO_WIDTH_PX = 2400  # sharp enough to place trace points when zoomed
NAMESPACE = uuid.UUID("6f1c2a9e-0d5b-4c1e-9a43-7f0e2b8d5c11")

# ----------------------------------------------------------------------------- scenario


def load_scenario(path: Path) -> tuple[dict, list[str]]:
    """The scenario document with defaults filled in, and the schema errors (empty when valid)."""
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as err:
        return {}, [f"{path.name}: {err}"]
    errors = [
        f"{'/'.join(str(k) for k in e.absolute_path) or '(top level)'}: {e.message}"
        for e in sorted(Draft202012Validator(SCHEMA).iter_errors(doc), key=lambda e: list(map(str, e.absolute_path)))
    ]
    if errors:
        return doc, errors
    model = json.loads(json.dumps(doc))  # a copy: the document itself is written back untouched
    for key, default in (("traces", []), ("power_nets", []), ("links", []), ("open_questions", []), ("blocks", {})):
        model.setdefault(key, default)
    # optional fields, filled in so the generators can read them directly
    for part in model["parts"].values():
        part["pins"] = {str(k): str(v) for k, v in part["pins"].items()}
        part.setdefault("kind", "")
    for net in model["nets"].values():
        net.setdefault("description", "")
        for n in net["nodes"]:
            n["pin"] = str(n["pin"])
            n.setdefault("evidence", "")
    for block in model["blocks"].values():
        block.setdefault("subtitle", "")
    for link in model["links"]:
        link.setdefault("label", "")
    for q in model["open_questions"]:
        q.setdefault("candidates", [])
        q.setdefault("why", "")
    model["board"].setdefault("model_date", "")
    return model, []


def validate(model: dict, folder: Path) -> list[str]:
    """Problems the schema cannot see (references between sections, files); empty when consistent."""
    errors = []
    levels = model["confidence"]
    parts = model["parts"]
    photos = model["photos"]
    for side, info in photos.items():
        if not (folder / info["file"]).is_file():
            errors.append(f"photos.{side}: file {info['file']} not found")
    seen: dict[tuple[str, str], str] = {}
    for name, net in model["nets"].items():
        for node in net["nodes"]:
            key = (node["ref"], node["pin"])
            if node["ref"] not in parts:
                errors.append(f"net {name}: unknown part {node['ref']}")
            elif node["pin"] not in parts[node["ref"]]["pins"]:
                errors.append(f"net {name}: {node['ref']} has no pin {node['pin']}")
            if node["conf"] not in levels:
                errors.append(f"net {name}: unknown confidence {node['conf']!r}")
            if key in seen:
                errors.append(f"{key[0]}.{key[1]} is on both {seen[key]} and {name}")
            seen[key] = name
    for ref, part in parts.items():
        if part["group"] not in model["blocks"]:
            errors.append(f"{ref}: group {part['group']!r} is not a block")
        for side, box in part.get("box", {}).items():
            if side not in photos:
                errors.append(f"{ref}: box on unknown photo {side!r}")
            elif not (box[0] < box[2] and box[1] < box[3]):
                errors.append(f"{ref}.box.{side}: expected [x0, y0, x1, y1] with x0 < x1 and y0 < y1")
    for t in model["traces"]:
        if t["side"] not in photos:
            errors.append(f"trace {t['id']}: unknown photo {t['side']!r}")
        if t["net"] not in model["nets"]:
            errors.append(f"trace {t['id']}: net {t['net']!r} does not exist")
    for q in model["open_questions"]:
        for ref, pin in q["pins"]:
            if ref not in parts or str(pin) not in parts[ref]["pins"]:
                errors.append(f"{q['id']}: unknown pin {ref}.{pin}")
    for link in model["links"]:
        for block in (link["from"], link["to"]):
            if block not in model["blocks"]:
                errors.append(f"link {link['from']}-{link['to']}: unknown block {block}")
        if link["conf"] not in levels:
            errors.append(f"link {link['from']}-{link['to']}: unknown confidence {link['conf']!r}")
    for ref in (model.get("schematic") or {}).get("parts", {}):
        if ref not in parts:
            errors.append(f"schematic: unknown part {ref}")
    return errors


def pin_nets(model: dict) -> dict[tuple[str, str], tuple[str, str]]:
    """Map (ref, pin) to (net name, confidence)."""
    return {(n["ref"], n["pin"]): (name, n["conf"]) for name, net in model["nets"].items() for n in net["nodes"]}


def net_confidence(model: dict, net: dict) -> str:
    """A net is only as certain as its weakest connection."""
    rank = {k: v["rank"] for k, v in model["confidence"].items()}
    return min((n["conf"] for n in net["nodes"]), key=rank.__getitem__)


# ----------------------------------------------------------------------------- netlist.md


def md_escape(text: str) -> str:
    return str(text).replace("|", "\\|")


def write_netlist_md(model: dict, path: Path) -> None:
    nets_of = pin_nets(model)
    lines = [
        "# Board model: netlist",
        "",
        f"Generated by `build.py` from `scenario.json` ({model['board']['marking']}). Do not edit by hand.",
        "",
        "## Confidence levels",
        "",
        "| Level | Meaning |",
        "| ----- | ------- |",
    ]
    for level, info in sorted(model["confidence"].items(), key=lambda kv: -kv[1]["rank"]):
        lines.append(f"| `{level}` | {md_escape(info['meaning'])} |")
    lines += ["", "## Nets", ""]
    lines += ["| Net | Weakest link | Connections | Description |", "| --- | --- | --- | --- |"]
    for name, net in model["nets"].items():
        nodes = ", ".join(f"{n['ref']}.{n['pin']} ({n['conf']})" for n in net["nodes"])
        lines.append(
            f"| `{md_escape(name)}` | `{net_confidence(model, net)}` | {md_escape(nodes)} | "
            f"{md_escape(net['description'])} |"
        )
    lines += ["", "### Evidence per connection", ""]
    lines += ["| Net | Pin | Confidence | Evidence |", "| --- | --- | --- | --- |"]
    for name, net in model["nets"].items():
        for n in net["nodes"]:
            pin_name = model["parts"][n["ref"]]["pins"][n["pin"]]
            lines.append(
                f"| `{md_escape(name)}` | {n['ref']}.{n['pin']} ({md_escape(pin_name)}) | "
                f"`{n['conf']}` | {md_escape(n['evidence'])} |"
            )
    lines += ["", "## Open questions", ""]
    lines += ["| ID | Question | Pins | Check |", "| --- | --- | --- | --- |"]
    for q in model["open_questions"]:
        pins = ", ".join(f"{r}.{p}" for r, p in q["pins"])
        lines.append(f"| {q['id']} | {md_escape(q['title'])} | {pins} | {md_escape(q['check'])} |")
    lines += ["", "## Parts", ""]
    lines += ["| Ref | Value | Block | Pins on a net | Unknown pins |", "| --- | --- | --- | --- | --- |"]
    for ref, part in sorted(model["parts"].items(), key=lambda kv: natural_key(kv[0])):
        known = [p for p in part["pins"] if (ref, p) in nets_of]
        unknown = [p for p in part["pins"] if (ref, p) not in nets_of]
        lines.append(
            f"| {ref} | {md_escape(part['value'])} | {model['blocks'][part['group']]['title']} | "
            f"{len(known)} of {len(part['pins'])} | {', '.join(unknown) or '—'} |"
        )
    lines += ["", "## Block diagram", "", "```mermaid", "flowchart LR"]
    for key, block in model["blocks"].items():
        lines.append(f'    {key}["{block["title"]}<br/><small>{block["subtitle"]}</small>"]')
    for link in model["links"]:
        a, b, conf, label = link["from"], link["to"], link["conf"], link.get("label", "")
        arrow = "-->" if conf in ("measured", "confirmed", "photo", "datasheet") else "-.->"
        lines.append(f'    {a} {arrow}|"{label} ({conf})"| {b}')
    lines += ["```", ""]
    path.write_text("\n".join(align_tables(lines)), encoding="utf-8")


def align_tables(lines: list[str]) -> list[str]:
    """Pad Markdown table columns the way Prettier does, so the file passes a Prettier check."""
    out, block = [], []
    for line in lines + [""]:
        if line.startswith("|"):
            block.append(line)
            continue
        if block:
            rows = [[c.strip() for c in re.split(r"(?<!\\)\|", r)[1:-1]] for r in block]
            widths = [max(3, *(len(r[i]) for r in rows if i < len(r))) for i in range(len(rows[0]))]
            for k, row in enumerate(rows):
                cells = ["-" * w if k == 1 else c.ljust(w) for c, w in zip(row, widths, strict=True)]
                out.append("| " + " | ".join(cells) + " |")
            block = []
        out.append(line)
    return out[:-1]


def natural_key(text: str) -> list:
    return [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", text)]


# ----------------------------------------------------------------------------- block diagram


def block_diagram_svg(model: dict) -> str:
    colors = {k: v["color"] for k, v in model["confidence"].items()}
    bw, bh, gx, gy, margin = 230, 74, 90, 70, 30
    blocks = model["blocks"]
    cols = max((b["col"] for b in blocks.values()), default=0) + 1
    rows = max((b["row"] for b in blocks.values()), default=0) + 1
    width = margin * 2 + cols * bw + (cols - 1) * gx
    height = margin * 2 + rows * bh + (rows - 1) * gy + 40

    def box(key: str) -> tuple[float, float]:
        b = blocks[key]
        return margin + b["col"] * (bw + gx), margin + b["row"] * (bh + gy)

    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
        f'font-family="system-ui, sans-serif" role="img" aria-label="Board block diagram">',
        "<defs>",
    ]
    for level, color in colors.items():
        out.append(
            f'<marker id="arrow-{level}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" '
            f'markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{color}"/></marker>'
        )
    out.append("</defs>")
    for link in model["links"]:
        a, b, conf, label = link["from"], link["to"], link["conf"], link.get("label", "")
        ax, ay = box(a)
        bx, by = box(b)
        x1, y1, x2, y2 = edge_points(ax, ay, bx, by, bw, bh)
        dash = "" if conf in ("measured", "confirmed", "photo") else ' stroke-dasharray="6 4"'
        out.append(
            f'<g class="link" data-from="{a}" data-to="{b}"><line x1="{x1:.0f}" y1="{y1:.0f}" '
            f'x2="{x2:.0f}" y2="{y2:.0f}" stroke="{colors[conf]}" stroke-width="2.2"{dash} '
            f'marker-end="url(#arrow-{conf})"/>'
            f'<text x="{(x1 + x2) / 2:.0f}" y="{(y1 + y2) / 2 - 6:.0f}" font-size="12" '
            f'text-anchor="middle" fill="{colors[conf]}" paint-order="stroke" stroke="#fff" '
            f'stroke-width="4">{html.escape(label)}</text></g>'
        )
    for key, block in blocks.items():
        x, y = box(key)
        fill = "#fef2f2" if key == "motor" else "#f8fafc"
        stroke = "#dc2626" if key == "motor" else "#475569"
        out.append(
            f'<g class="block" data-block="{key}"><rect x="{x}" y="{y}" width="{bw}" height="{bh}" '
            f'rx="8" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>'
            f'<text x="{x + bw / 2}" y="{y + 30}" font-size="15" font-weight="600" '
            f'text-anchor="middle" fill="#0f172a">{html.escape(block["title"])}</text>'
            f'<text x="{x + bw / 2}" y="{y + 52}" font-size="11.5" text-anchor="middle" '
            f'fill="#475569">{html.escape(block["subtitle"])}</text></g>'
        )
    lx, ly = margin, height - 22
    for level, info in sorted(model["confidence"].items(), key=lambda kv: -kv[1]["rank"]):
        out.append(
            f'<line x1="{lx}" y1="{ly}" x2="{lx + 26}" y2="{ly}" stroke="{info["color"]}" '
            f'stroke-width="2.5"/><text x="{lx + 32}" y="{ly + 4}" font-size="12" '
            f'fill="#334155">{level}</text>'
        )
        lx += 130
    out.append(
        f'<text x="{width - margin}" y="{ly + 4}" font-size="12" text-anchor="end" '
        f'fill="#dc2626">red block: fault area</text>'
    )
    out.append("</svg>")
    return "\n".join(out)


def edge_points(ax, ay, bx, by, bw, bh) -> tuple[float, float, float, float]:
    """Connect two boxes from the nearest edges' midpoints."""
    acx, acy, bcx, bcy = ax + bw / 2, ay + bh / 2, bx + bw / 2, by + bh / 2
    if abs(bcx - acx) * bh >= abs(bcy - acy) * bw:
        sign = 1 if bcx > acx else -1
        return acx + sign * bw / 2, acy, bcx - sign * bw / 2, bcy
    sign = 1 if bcy > acy else -1
    return acx, acy + sign * bh / 2, bcx, bcy - sign * bh / 2


# ----------------------------------------------------------------------------- KiCad schematic


def kicad_nets(netlist_text: str) -> dict[str, set[tuple[str, str]]]:
    """Parse the nets of a kicad-cli 'kicadsexpr' netlist (labelled nets only)."""
    nets = {}
    for block in re.findall(
        r"\(net \(code \"?\d+\"?\) \(name \"([^\"]*)\"\)(.*?)\)\s*(?=\(net |\)\s*\)\s*$)", netlist_text, flags=re.S
    ):
        name, body = block
        nodes = {n for n in re.findall(r'\(node \(ref "([^"]+)"\) \(pin "([^"]+)"\)', body) if not n[0].startswith("#")}
        nets[name.lstrip("/")] = nodes
    return nets


def check_netlist(model: dict, netlist_path: Path) -> list[str]:
    exported = kicad_nets(netlist_path.read_text(encoding="utf-8"))
    problems = []
    for name, net in model["nets"].items():
        want = {(n["ref"], n["pin"]) for n in net["nodes"]}
        got = exported.get(name)
        if got is None:
            problems.append(f"net {name} missing from the KiCad netlist")
        elif got != want:
            problems.append(f"net {name}: model {sorted(want)} != KiCad {sorted(got)}")
    labelled = {k for k in exported if not k.startswith(("Net-(", "unconnected-("))}
    for extra in sorted(labelled - set(model["nets"])):
        problems.append(f"KiCad has a net {extra} that the model does not")
    return problems


# ----------------------------------------------------------------------------- viewer data


def photo_jpeg(path: Path, rotate: int = 0) -> tuple[bytes, float]:
    """The photo, resized for the viewer and turned by `rotate` degrees (0 or 180).
    Boxes and traces stay in the original photo's pixels; the page maps them through the turn."""
    img = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    if rotate:
        img = img.rotate(rotate)
    scale = PHOTO_WIDTH_PX / img.width
    img = img.resize((PHOTO_WIDTH_PX, round(img.height * scale)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=78)
    return buf.getvalue(), scale


def schematic_svg_markup(folder: Path, drawn: tuple) -> str:
    """exports/schematic.svg from kicad-cli, cropped to what was drawn, ready to inline in the page;
    empty when build.sh has not exported it."""
    path = folder / "exports" / "schematic.svg"
    if not path.exists():
        return ""
    svg = path.read_text(encoding="utf-8")
    svg = re.sub(r"<\?xml[^>]*>\s*", "", svg)
    svg = re.sub(r"<!DOCTYPE[^>]*>\s*", "", svg)
    x0, y0, x1, y1 = drawn
    return re.sub(
        r'width="[^"]*mm" height="[^"]*mm" viewBox="[^"]*"',
        f'viewBox="{x0:.2f} {y0:.2f} {x1 - x0:.2f} {y1 - y0:.2f}"',
        svg,
        count=1,
    )


def write_files(root: Path, files: dict[str, bytes], prune: bool) -> None:
    """Write files under root, only those that changed; with prune, remove the files not listed."""
    for rel, content in files.items():
        path = root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists() or path.read_bytes() != content:
            path.write_bytes(content)
    if prune and root.exists():
        for path in sorted(root.rglob("*"), reverse=True):  # children before their folders
            if path.relative_to(root).parts[0] == "kicad":
                continue  # build.sh's KiCad reports
            if path.is_file() and str(path.relative_to(root)) not in files:
                path.unlink()
            elif path.is_dir() and not any(path.iterdir()):
                path.rmdir()


def generated_files(model: dict, folder: Path, diagram_svg: str, drawn: tuple, schematic_data: dict) -> tuple[dict, list]:
    """The viewer's data for generated/: {relative path: bytes}, and notes for the build log.
    Image paths in the JSON are relative to the scenario folder."""
    files: dict[str, bytes] = {}
    photos = {}
    for side, info in model["photos"].items():
        rotate = info.get("display_rotation", 0)
        jpeg, scale = photo_jpeg(folder / info["file"], rotate)
        files[f"photos/{side}.jpg"] = jpeg
        photos[side] = {
            "src": f"generated/photos/{side}.jpg",
            "size": info["size"],
            "rot": rotate,
            "w": round(info["size"][0] * scale),
            "h": round(info["size"][1] * scale),
            "scale": scale,
            "file": info["file"],
        }
    view = {
        "photos": photos,
        "diagram": diagram_svg,
        "schematic": schematic_data,
        "schematicSvg": schematic_svg_markup(folder, drawn),
    }
    notes: list[str] = []
    try:
        frame, aligned, view["aligned"] = frame_and_images(model, folder)
        files.update(aligned)
    except (ValueError, cv2.error) as err:  # a photo the processing can't handle: no aligned view, no 3D
        frame, view["aligned"] = None, None
        notes.append(f"photo processing: {err}")
    files["view.json"] = json.dumps(view, ensure_ascii=False).encode()
    if frame and {"top", "bottom"} <= set(frame.to_mm):
        data3d, residuals, textures = board_3d_payload(model, folder, frame)
        for rel, content in textures.items():
            files[rel] = content
        data3d["textures"] = {k: f"generated/{v}" for k, v in data3d["textures"].items()}
        files["model3d.json"] = json.dumps(data3d, ensure_ascii=False).encode()
        if residuals:
            worst = max(residuals, key=residuals.get)
            notes.append(f"3D fit on {len(residuals)} points, worst {worst} {residuals[worst]:.2f} mm")
        else:
            q = frame.quality
            notes.append(f"photos aligned automatically ({q.get('matched_features', 0)} holes and pads matched, shape match {q.get('shape_match')})")
    return files, notes


# ----------------------------------------------------------------------------- investigation


def investigation_status(model: dict, folder: Path, record: dict) -> dict:
    """The model's fingerprint and plan.json's state: its schema errors, its references the model no
    longer has (stale), and where the user is in it."""
    out: dict = {"fingerprint": investigation.fingerprint(model), "plan": None}
    plan, errors = investigation.load(folder / "plan.json", investigation.PLAN_SCHEMA)
    if plan is None and not errors:
        return out
    if errors:
        out["plan"] = {"errors": errors, "stale": []}
        return out
    w = investigation.walk(plan, record)
    out["plan"] = {
        "errors": [],
        "stale": investigation.check_plan(plan, model, record, strict=False),
        "revision": plan["revision"],
        "current": w["current"],
        "state": w["state"],
        "needs_update": investigation.needs_update(plan, model, record),
    }
    return out


def write_investigation(model: dict, folder: Path, record: dict) -> None:
    """exports/investigation.md, when the scenario has a plan or a record."""
    plan, errors = investigation.load(folder / "plan.json", investigation.PLAN_SCHEMA)
    if plan is None and not (folder / "record.json").exists():
        return
    (folder / "exports").mkdir(exist_ok=True)
    investigation.write_investigation_md(model, None if errors else plan, record, folder / "exports" / "investigation.md", align_tables)


# ----------------------------------------------------------------------------- main


def build_layout(model: dict) -> tuple[dict, dict, list[str]]:
    """The automatic layout (schematic_layout, minus wired groups whose pins no longer share a
    net) and the layout to draw (the editor's full layout, `schematic`, when there is one)."""
    auto_layout, dropped = prune_conflicts(model, resolve_layout(model), pin_nets(model))
    edited = model.get("schematic")
    return auto_layout, merge_layout(auto_layout, edited), [] if edited else dropped


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("scenario", type=Path, help="the scenario folder (holding scenario.json)")
    parser.add_argument("--input", type=Path, help="read the scenario from this file instead of scenario.json")
    parser.add_argument("--check", action="store_true", help="validate only; write nothing")
    parser.add_argument("--json", action="store_true", help="print the result as JSON (ok, errors, warnings, summary)")
    parser.add_argument("--investigation", action="store_true", help="check plan.json and record.json only, write investigation.md")
    parser.add_argument("--record", type=Path, help="with --investigation: read the record from this file instead of record.json")
    parser.add_argument("--check-netlist", type=Path, help="kicad-cli netlist to compare")
    parser.add_argument("--dump-nets", action="store_true", help="print the nets as JSON and stop")
    args = parser.parse_args()
    folder = args.scenario.resolve()
    warnings: list[str] = []
    extra: dict = {}

    def done(errors: list[str], summary: str = "") -> int:
        result = {"ok": not errors, "errors": errors, "warnings": warnings, "summary": summary, **extra}
        if not errors and not args.check and not args.dump_nets and not args.check_netlist:
            (folder / "generated").mkdir(exist_ok=True)
            (folder / "generated" / "status.json").write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
        if args.json:
            print(json.dumps(result, ensure_ascii=False))
        else:
            for w in warnings:
                print("warning:", w)
            print("scenario errors:\n  " + "\n  ".join(errors) if errors else summary)
            plan = extra.get("plan")
            for e in (plan or {}).get("errors", []) + (plan or {}).get("stale", []):
                print("plan:", e)
        return 1 if errors else 0

    model, errors = load_scenario(args.input or folder / "scenario.json")
    if not errors:
        errors = validate(model, folder)
    if errors:
        return done(errors)
    record, record_errors = investigation.load(args.record or folder / "record.json", investigation.RECORD_SCHEMA, "record.json")
    if record is not None and not record_errors:
        record_errors = investigation.check_record(record)
    if args.record and record is None and not record_errors:
        record_errors = [f"{args.record}: not found"]
    if args.record and record_errors:  # a record save: refused
        return done(record_errors)
    warnings += record_errors  # a broken record.json on disk: reported, the model still builds
    record = record if record is not None and not record_errors else investigation.empty_record()
    extra.update(investigation_status(model, folder, record))
    if args.investigation:
        if not args.check:
            write_investigation(model, folder, record)
        return done([], "investigation checked")
    if args.check_netlist:
        problems = check_netlist(model, args.check_netlist)
        print("\n".join(problems) or f"KiCad netlist matches the model ({len(model['nets'])} nets)")
        return 1 if problems else 0
    if args.dump_nets:
        print(
            json.dumps(
                {n: sorted([x["ref"], x["pin"], x["conf"]] for x in net["nodes"]) for n, net in model["nets"].items()}
            )
        )
        return 0

    rank = {k: v["rank"] for k, v in model["confidence"].items()}
    power_nets = set(model["power_nets"])
    auto_layout, layout, dropped = build_layout(model)
    if dropped:
        warnings.append(f"hand-laid wires dropped, their pins no longer share one net: {', '.join(dropped)}")
    try:
        sch_text, drawn, report = render(model, layout, pin_nets(model), rank, power_nets)
    except (ValueError, KeyError) as err:
        return done([f"schematic: {err}"])
    if report["unconnected"]:
        warnings.append(f"known pins left as labels (no wire in the layout): {', '.join(report['unconnected'])}")
    n_pins = sum(len(p["pins"]) for p in model["parts"].values())
    summary = (
        f"{len(model['parts'])} parts, {len(model['nets'])} nets, {len(pin_nets(model))} of {n_pins} pins on a net, "
        f"{len(model['open_questions'])} open questions"
    )
    if args.check:
        return done([], summary)

    diagram = block_diagram_svg(model)
    schematic_data = {
        "auto": auto_layout,
        "geometry": {ref: symbol_geometry(part) for ref, part in model["parts"].items()},
        "powerNets": sorted(power_nets),
    }
    try:
        generated, notes = generated_files(model, folder, diagram, drawn, schematic_data)
    except (OSError, ValueError, KeyError) as err:
        return done([f"generating the viewer data: {err}"])
    netlist = folder / "exports" / "netlist.md"
    netlist.parent.mkdir(exist_ok=True)
    write_netlist_md(model, netlist)
    write_investigation(model, folder, record)
    write_files(folder / "exports", {"block-diagram.svg": (diagram + "\n").encode(), "schematic.kicad_sch": sch_text.encode()}, prune=False)
    write_files(folder / "generated", generated, prune=True)
    for note in notes:
        if note.startswith("photo processing"):
            warnings.append(note)
        else:
            summary += f"; {note}"
    return done([], summary)


if __name__ == "__main__":
    sys.exit(main())
