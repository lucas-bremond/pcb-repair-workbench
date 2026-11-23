"""Create a new scenario folder from board photos.

Copies the photos into the folder, reads their sizes, and writes a minimal scenario.json that
the build accepts (no parts or nets yet, the instruments), a record.json holding the user's first
observations (symptoms, history, what was tried), and a README.md. The plan-investigation skill
then writes plan.json.

Usage (from the repository root):
    python -I app/scripts/new_scenario.py scenarios/my-board --title "Acme X1" \\
        --top ~/photos/top.jpg --bottom ~/photos/bottom.jpg --closeup ~/photos/IMG_*.jpg \\
        [--name "Acme X1 main board"] [--marking "X1-MB REV:B"] [--description "..."] \\
        [--rotate-bottom] [--doc manual.pdf] \\
        [--instrument multimeter --instrument "usb_meter:UM25C"] \\
        [--observation "Pressing Move resets the unit." --observation "Same with another adapter."]
"""

import argparse
import datetime
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageOps

sys.path.insert(0, str(Path(__file__).resolve().parent))
import scenario_json  # noqa: E402

PHOTO_TYPES = {".jpg", ".jpeg", ".png", ".webp"}

CONFIDENCE = {
    "measured": {"rank": 5, "color": "#15803d", "meaning": "Checked on the board with a meter."},
    "confirmed": {
        "rank": 4,
        "color": "#2563eb",
        "meaning": "Silkscreen label, a wire seen soldered to the pad, or a measurement in the repair log.",
    },
    "photo": {"rank": 3, "color": "#7c3aed", "meaning": "Trace, copper area or tinned strip followed in a close-up photo."},
    "datasheet": {
        "rank": 2,
        "color": "#b45309",
        "meaning": "Pin function from the part's datasheet; the part number itself is read from the photo.",
    },
    "assumed": {"rank": 1, "color": "#dc2626", "meaning": "Standard circuit practice or placement only. Treat as a hypothesis."},
}


def photo_size(path: Path) -> list[int]:
    with Image.open(path) as img:
        img = ImageOps.exif_transpose(img)
        return [img.width, img.height]


def copy_into(src: Path, folder: Path, sub: str) -> str:
    """Copy a file into folder/sub, keeping its name (numbered if taken); return its relative path."""
    dest_dir = folder / sub
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / src.name
    n = 2
    while dest.exists():
        dest = dest_dir / f"{src.stem}-{n}{src.suffix}"
        n += 1
    shutil.copy2(src, dest)
    return str(dest.relative_to(folder))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("folder", type=Path, help="the new scenario folder, for example scenarios/my-board")
    parser.add_argument("--title", required=True, help="the scenario's name, shown as the page heading")
    parser.add_argument("--name", help="the board, for example 'Acme X1 main board' (default: the title)")
    parser.add_argument("--marking", default="", help="what the board's silkscreen says (part number, revision, date)")
    parser.add_argument("--description", default="", help="the device and the fault, in a sentence or two")
    parser.add_argument("--top", type=Path, help="photo of the top (component) side, as straight-on as possible")
    parser.add_argument("--bottom", type=Path, help="photo of the bottom side")
    parser.add_argument("--rotate-bottom", action="store_true", help="show the bottom photo turned 180° (so its text reads upright)")
    parser.add_argument("--closeup", type=Path, nargs="*", default=[], help="close-up photos (copied to photos/parts/)")
    parser.add_argument("--doc", type=Path, nargs="*", default=[], help="manuals, datasheets (copied to docs/)")
    parser.add_argument("--instrument", action="append", default=[], help="an instrument the user has: kind[:model], e.g. multimeter, bench_supply, usb_meter:UM25C (repeatable)")
    parser.add_argument("--observation", action="append", default=[], help="a symptom, a fact from the history or something already tried, in the user's words (repeatable)")
    parser.add_argument("--force", action="store_true", help="write scenario.json even if the folder already has one")
    args = parser.parse_args()

    folder = args.folder
    if (folder / "scenario.json").exists() and not args.force:
        print(f"{folder / 'scenario.json'} already exists (use --force to replace it)")
        return 1
    if not args.top and not args.bottom:
        print("give at least one board photo: --top and/or --bottom")
        return 1
    for p in [args.top, args.bottom, *args.closeup, *args.doc]:
        if p and not p.is_file():
            print(f"not a file: {p}")
            return 1
    for p in [args.top, args.bottom, *args.closeup]:
        if p and p.suffix.lower() not in PHOTO_TYPES:
            print(f"{p}: use JPEG, PNG or WebP (convert HEIC first, for example: sips -s format jpeg in.heic --out out.jpg)")
            return 1

    folder.mkdir(parents=True, exist_ok=True)
    photos = {}
    for side, src in (("top", args.top), ("bottom", args.bottom)):
        if src:
            rel = copy_into(src, folder, "photos")
            photos[side] = {"file": rel, "size": photo_size(folder / rel)}
            if side == "bottom" and args.rotate_bottom:
                photos[side]["display_rotation"] = 180
    closeups = [copy_into(p, folder, "photos/parts") for p in args.closeup]
    docs = [copy_into(p, folder, "docs") for p in args.doc]

    board = {"title": args.title, "name": args.name or args.title, "marking": args.marking}
    if args.description:
        board["description"] = args.description
    today = datetime.date.today().isoformat()
    board["model_date"] = today
    instruments = []
    for spec in args.instrument:
        kind, _, model = spec.partition(":")
        instruments.append({"kind": kind.strip()} | ({"model": model.strip()} if model.strip() else {}))
    doc = {
        "format": "pcb-scenario",
        "version": 2,
        "board": board,
        "instruments": instruments,
        "confidence": CONFIDENCE,
        "photos": photos,
        "parts": {},
        "nets": {},
        "traces": [],
        "power_nets": [],
        "blocks": {},
        "links": [],
        "open_questions": [],
    }
    scenario_json.dump_file(doc, folder / "scenario.json")
    if not (folder / "record.json").exists() or args.force:
        observations = [{"id": f"O{i}", "date": today, "text": text.strip()} for i, text in enumerate(args.observation, 1) if text.strip()]
        record = {"format": "pcb-record", "version": 2, "observations": observations, "instructions": [], "results": []}
        scenario_json.dump_file(record, folder / "record.json")

    readme = folder / "README.md"
    if not readme.exists():
        lines = [f"# {args.title}", "", args.description or "The device and the fault.", "", "## Files", ""]
        lines += [f"- `{p['file']}`: {side} side" for side, p in photos.items()]
        lines += [f"- `{c}`: close-up" for c in closeups] + [f"- `{d}`: document" for d in docs]
        lines += ["", "The investigation is in the app's Investigate tab (exported to `exports/investigation.md`).", ""]
        readme.write_text("\n".join(lines), encoding="utf-8")
    print(f"created {folder}: {len(photos)} board photo(s), {len(closeups)} close-up(s), {len(docs)} document(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
