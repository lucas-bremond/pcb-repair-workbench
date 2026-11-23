"""Board geometry and the 3D mode of the viewer's Board tab, for build.py.

Everything is in the top-view board frame, in millimetres: origin at the outline's top-left,
x to the right, y down. bottom-1.jpg maps to it by a scale and a top-to-bottom mirror (the
board was flipped about its long axis between the photos); top-1.jpg, taken at an angle, by
a homography fitted on points visible in both photos.
"""

import io
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

TEXTURE_PX_PER_MM = 12
TALL_KINDS = {"led", "switch", "electrolytic"}
LED_COLOURS = {"red": "#ef4444", "yellow": "#facc15", "green": "#4ade80"}
WIRE_COLOURS = {
    "red": "#dc2626",
    "black": "#18181b",
    "yellow": "#facc15",
    "orange": "#f97316",
    "brown": "#78350f",
}


class Geometry:
    """The 3D board from the board frame (align.py): every photo pixel maps to board mm."""

    def __init__(self, frame, folder: Path):
        self.frame = frame
        self.folder = folder
        self.outline = frame.outline
        self.width, self.height = frame.width, frame.height
        self.thickness = frame.thickness
        self.scale_source = frame.scale_source
        self.residuals = frame.residuals

    def from_bottom(self, x: float, y: float) -> tuple[float, float]:
        return self.frame.mm("bottom", x, y)

    def from_top(self, x: float, y: float) -> tuple[float, float]:
        return self.frame.mm("top", x, y)

    def texture(self, side: str, photo: str, enhanced: bool = False) -> bytes:
        """The photo warped into the board frame, as JPEG bytes; `enhanced` boosts local
        contrast so copper under the solder mask shows (the same pixels, nothing added)."""
        r = TEXTURE_PX_PER_MM
        size = (math.ceil(self.width * r), math.ceil(self.height * r))
        to_board = np.diag([r, r, 1.0]) @ self.frame.to_mm[side]
        inv = np.linalg.inv(to_board)
        inv /= inv[2, 2]
        img = ImageOps.exif_transpose(Image.open(self.folder / photo)).convert("RGB")
        warped = img.transform(size, Image.PERSPECTIVE, tuple(inv.flatten()[:8]), Image.BICUBIC)
        if enhanced:
            warped = ImageOps.autocontrast(warped, cutoff=1)
            warped = warped.filter(ImageFilter.UnsharpMask(radius=10, percent=260, threshold=0))
            warped = ImageEnhance.Color(warped).enhance(1.5)
        buf = io.BytesIO()
        warped.save(buf, format="JPEG", quality=80)
        return buf.getvalue()

    def trace(self, side: str, points: list) -> list:
        to_board = self.from_top if side == "top" else self.from_bottom
        return [[round(c, 2) for c in to_board(x, y)] for x, y in points]

    def footprint(self, ref: str, part: dict, override: dict) -> dict | None:
        """Board-frame placement of a part's 3D body, or None if it has no box."""
        box = part.get("box", {})
        side = "top" if "top" in box else "bottom" if "bottom" in box else None
        if side is None:
            return None
        x0, y0, x1, y1 = box[side]
        to_board = self.from_top if side == "top" else self.from_bottom
        corners = [to_board(x, y) for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1))]
        bx0, bx1 = min(c[0] for c in corners), max(c[0] for c in corners)
        by0, by1 = min(c[1] for c in corners), max(c[1] for c in corners)
        w, length = bx1 - bx0, by1 - by0
        cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2
        if side == "top" and part["kind"] in TALL_KINDS:
            # photographed at an angle: tall parts lean up the image, so their base is the box's bottom
            foot = min(w, override.get("d", w))
            cy = by1 - foot / 2
            length = foot
        if "at" in override:
            cx, cy = override["at"]
        return {"side": side, "x": round(cx, 2), "y": round(cy, 2), "w": round(w, 2), "l": round(length, 2)}


def body(ref: str, part: dict, fp: dict, override: dict) -> dict:
    """3D body description for the viewer: shape, size (mm) and colour."""
    kind, value = part["kind"], str(part["value"]).lower()
    w, length = fp["w"], fp["l"]
    b = {"shape": "box", "w": w * 0.85, "l": length * 0.85, "h": 1.0, "color": "#3f3f46"}
    if kind == "ic":
        b.update(h=2.4 if "18" in str(part.get("package", "")) else 1.6, color="#27272a")
    elif kind == "transistor":
        b.update(w=min(w, 3.0), l=min(length, 3.0), h=1.1, color="#27272a")
    elif kind == "resistor":
        b.update(w=min(w, 6.5), l=min(length, 6.5), h=0.6, color="#1c1917")
    elif kind == "capacitor":
        b.update(w=min(w, 4.5), l=min(length, 4.5), h=0.8, color="#a8a29e")
    elif kind == "diode" and "glass" in value:
        b.update(shape="rod", d=1.6, len=max(w, length) * 0.8, axis="x" if w >= length else "y", color="#c2410c")
    elif kind == "diode":
        b.update(w=min(w, 5.0), l=min(length, 5.0), h=2.2, color="#18181b")
    elif kind == "electrolytic":
        b.update(shape="cylinder", d=override.get("d", min(w, length)), h=override.get("h", 11), color="#1e293b")
    elif kind == "inductor":
        b.update(w=w * 0.9, l=length * 0.9, h=override.get("h", 6), color="#3f3f46")
    elif kind == "led":
        colour = next((c for name, c in LED_COLOURS.items() if name in value), "#e5e7eb")
        b.update(shape="led", d=5.0, h=18.0, spacer=10.0, color=colour)
    elif kind == "switch" and "slide" in value:
        b.update(w=12.0, l=6.5, h=6.5, color="#9ca3af")
    elif kind == "switch":
        b.update(shape="button", w=6.0, l=6.0, h=3.5, stem=13.0, color="#18181b")
    elif kind == "pad":
        b.update(shape="pad", d=3.0, h=0.2, color="#d4d4d8", wire=WIRE_COLOURS.get(part.get("wire", ""), "#71717a"))
    b.update({k: v for k, v in override.items() if k in ("h", "d")})
    return {k: (round(v, 2) if isinstance(v, float) else v) for k, v in b.items()}


def board_3d_payload(model: dict, folder: Path, frame) -> tuple[dict, dict, dict]:
    """The data for the viewer's 3D mode, the fit residuals (mm) for the build log, and the
    texture images it refers to ({path under the data folder: JPEG bytes}).

    Names, pins and nets come from the page's own (live, editable) model; this adds only
    what the 3D scene needs: the board outline, part bodies, traced copper and textures.
    """
    geo = Geometry(frame, folder)
    overrides = (model.get("geometry") or {}).get("bodies", {})
    parts3d = {}
    for ref, part in model["parts"].items():
        override = overrides.get(ref, {})
        fp = geo.footprint(ref, part, override)
        if fp:
            parts3d[ref] = {**fp, "body": body(ref, part, fp, override)}
    payload = {
        "board": {
            "outline": [[round(x, 2), round(y, 2)] for x, y in geo.outline],
            "width": round(geo.width, 2),
            "height": round(geo.height, 2),
            "thickness": geo.thickness,
            "scale_source": geo.scale_source,
            "max_residual_mm": round(max(geo.residuals.values()), 2) if geo.residuals else None,
            "alignment": frame.method,
        },
        "parts3d": parts3d,
        "traces": [
            {"net": t["net"], "side": t["side"], "evidence": t["evidence"], "points": geo.trace(t["side"], t["points"])}
            for t in model.get("traces", [])
        ],
        "textures": {},
    }
    files = {}
    for side in ("top", "bottom"):
        for suffix in ("", "_enhanced"):
            path = f"textures/{side}{suffix}.jpg"
            files[path] = geo.texture(side, model["photos"][side]["file"], enhanced=bool(suffix))
            payload["textures"][f"{side}{suffix}"] = path
    return payload, geo.residuals, files
