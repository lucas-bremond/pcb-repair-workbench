"""Check the automatic photo alignment (app/scripts/align.py) against the hand-picked points of
scenarios/homestar-flux: align its two photos automatically, then measure where the top photo's
points land against the bottom photo's, in mm. Run from the repository root:

    python -I app/tests/check_align.py
"""

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "app" / "scripts"))
import align  # noqa: E402

folder = REPO / "scenarios" / "homestar-flux"
model = json.loads((folder / "scenario.json").read_text(encoding="utf-8"))
g = model["geometry"]
sides = ["top", "bottom"]
rgbs = {s: align.load_rgb(folder / model["photos"][s]["file"]) for s in sides}
smalls = {s: align._small(rgbs[s]) for s in sides}
hues = align.board_hues({s: smalls[s][0] for s in sides})
shapes = {s: align.board_shape(smalls[s][0], hues[s]) for s in sides}
auto = align._auto_frame({**model, "geometry": {"bottom_px_per_mm": g["bottom_px_per_mm"]}}, smalls, shapes)
errors = {
    name: float(sum((a - b) ** 2 for a, b in zip(auto.mm("top", *pt), auto.mm("bottom", *pb), strict=True)) ** 0.5)
    for name, (pt, pb) in g["top_points"].items()
}
mean = sum(errors.values()) / len(errors)
worst = max(errors, key=errors.get)
print(f"auto alignment: {auto.quality}")
print(f"hand-picked points: mean {mean:.2f} mm, worst {worst} {errors[worst]:.2f} mm")
ok = mean < 1.2 and errors[worst] < 2.6
print("PASS" if ok else "FAIL", "(limits: mean under 1.2 mm, worst under 2.6 mm)")
sys.exit(0 if ok else 1)
