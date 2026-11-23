"""Photo helpers for building a scenario by eye: read pixel coordinates off a photo, and check
the boxes placed so far. Coordinates are always the original photo's pixels (after its EXIF
rotation), as scenario.json stores them.

Usage (from the repository root):
    python -I app/scripts/photo_tools.py grid PHOTO OUT.jpg [--step 200] [--crop X0,Y0,X1,Y1] [--width 1600]
        the photo (or a crop of it) with a labelled coordinate grid: read box corners and points
    python -I app/scripts/photo_tools.py boxes SCENARIO SIDE OUT.jpg [--crop X0,Y0,X1,Y1] [--width 1600]
        the side's photo with every part box and trace drawn and labelled: check placements
"""

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


def load(path: Path) -> Image.Image:
    return ImageOps.exif_transpose(Image.open(path)).convert("RGB")


def parse_crop(text: str | None, img: Image.Image) -> tuple[int, int, int, int]:
    if not text:
        return 0, 0, img.width, img.height
    x0, y0, x1, y1 = (int(float(v)) for v in text.split(","))
    return max(0, x0), max(0, y0), min(img.width, x1), min(img.height, y1)


def font(size: int):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # older Pillow
        return ImageFont.load_default()


def crop_scaled(img: Image.Image, crop: tuple, width: int) -> tuple[Image.Image, float]:
    part = img.crop(crop)
    scale = min(4.0, width / part.width)  # fit the width; a small crop is enlarged, up to 4x
    return part.resize((round(part.width * scale), round(part.height * scale)), Image.LANCZOS), scale


def label(draw: ImageDraw.ImageDraw, xy, text: str, f, fill="#ffffff", bg="#000000c0"):
    x, y = xy
    l, t, r, b = draw.textbbox((x, y), text, font=f)
    draw.rectangle((l - 2, t - 1, r + 2, b + 1), fill=bg)
    draw.text((x, y), text, font=f, fill=fill)


def cmd_grid(args) -> None:
    img = load(args.photo)
    crop = parse_crop(args.crop, img)
    out, scale = crop_scaled(img, crop, args.width)
    draw = ImageDraw.Draw(out, "RGBA")
    f = font(14)
    step = args.step or max(10, round((crop[2] - crop[0]) / 10 / 10) * 10)
    first_x = (crop[0] // step + 1) * step
    first_y = (crop[1] // step + 1) * step
    for x in range(first_x, crop[2], step):
        vx = (x - crop[0]) * scale
        draw.line((vx, 0, vx, out.height), fill=(255, 255, 0, 140), width=1)
        label(draw, (vx + 2, 2), str(x), f)
    for y in range(first_y, crop[3], step):
        vy = (y - crop[1]) * scale
        draw.line((0, vy, out.width, vy), fill=(0, 255, 255, 140), width=1)
        label(draw, (2, vy + 2), str(y), f)
    out.save(args.out, quality=88)
    print(f"{args.out}: {crop} of {img.width}x{img.height} px, grid every {step} px, shown at {scale:.3f}x")


def cmd_boxes(args) -> None:
    folder = args.scenario
    doc = json.loads((folder / "scenario.json").read_text(encoding="utf-8"))
    photo = doc["photos"].get(args.side)
    if not photo:
        sys.exit(f"no {args.side} photo in {folder / 'scenario.json'}")
    img = load(folder / photo["file"])
    crop = parse_crop(args.crop, img)
    out, scale = crop_scaled(img, crop, args.width)
    draw = ImageDraw.Draw(out, "RGBA")
    f = font(13)
    to_view = lambda x, y: ((x - crop[0]) * scale, (y - crop[1]) * scale)  # noqa: E731
    for t in doc.get("traces", []):
        if t["side"] == args.side:
            draw.line([to_view(*p) for p in t["points"]], fill=(249, 115, 22, 230), width=3)
    n = 0
    for ref, part in doc["parts"].items():
        box = part.get("box", {}).get(args.side)
        if not box:
            continue
        n += 1
        x0, y0 = to_view(box[0], box[1])
        x1, y1 = to_view(box[2], box[3])
        draw.rectangle((x0, y0, x1, y1), outline=(255, 64, 64, 255), width=2)
        label(draw, (x0, max(0, y0 - 16)), part.get("label") or ref, f)
    out.save(args.out, quality=88)
    print(f"{args.out}: {n} box(es) on the {args.side} photo, shown at {scale:.3f}x")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="cmd", required=True)
    g = sub.add_parser("grid", help="draw a labelled coordinate grid on a photo")
    g.add_argument("photo", type=Path)
    g.add_argument("out", type=Path)
    g.add_argument("--step", type=int, help="grid spacing in photo pixels (default: about 10 lines across)")
    g.add_argument("--crop", help="X0,Y0,X1,Y1 in photo pixels")
    g.add_argument("--width", type=int, default=1600, help="output width in pixels")
    b = sub.add_parser("boxes", help="draw a scenario's part boxes and traces on one of its photos")
    b.add_argument("scenario", type=Path)
    b.add_argument("side", choices=["top", "bottom"])
    b.add_argument("out", type=Path)
    b.add_argument("--crop", help="X0,Y0,X1,Y1 in photo pixels")
    b.add_argument("--width", type=int, default=1600, help="output width in pixels")
    args = parser.parse_args()
    {"grid": cmd_grid, "boxes": cmd_boxes}[args.cmd](args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
