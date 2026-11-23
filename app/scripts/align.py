"""The board frame, and the photos processed into it: background removed, perspective
corrected, front and back aligned.

The board frame is the board seen from the top, in millimetres. Each photo maps into it by a
homography (photo pixels to mm). It comes from one of two methods:

- "points": the scenario's hand-made geometry (a straight-on bottom photo with its outline and
  scale, and points seen on both photos, which fit the top photo's homography);
- "auto": computed from the photos. Each photo's board is segmented by the solder mask's
  colour (the hue both photos share); the straighter photo (the bottom by default) is the
  reference: its outline, deskewed and mirrored into a top view, defines the frame. The other
  photo is fitted onto it by aligning the two board shapes (ECC on the masks, which corrects
  perspective), then refined on holes and through-hole pads seen on both sides (RANSAC).

The background removal (GrabCut, seeded by the colour mask) and the alignment are slow (a second
or two per photo), so their results are cached in generated/aligned/, keyed by the photos and
the geometry settings.
"""

import hashlib
import io
import json
import math
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps

ALGO = 3  # bump to invalidate the caches when the processing changes
WORK = 1000  # analysis size: the photo's long side, in pixels
FRAME_PX_PER_MM = 20  # resolution of the aligned images
FRAME_MAX_PX = 2400
MARGIN_MM = 2.0
ASSUMED_LONG_SIDE_MM = 100.0


@dataclass
class Frame:
    method: str  # "points" or "auto"
    to_mm: dict  # side -> 3x3 homography, photo pixels -> board mm
    outline: list  # [(x, y)] in mm
    thickness: float
    scale_source: str
    residuals: dict = field(default_factory=dict)  # point name -> mm (method "points")
    quality: dict = field(default_factory=dict)

    @property
    def width(self) -> float:
        return max(x for x, _ in self.outline)

    @property
    def height(self) -> float:
        return max(y for _, y in self.outline)

    def mm(self, side: str, x: float, y: float) -> tuple[float, float]:
        p = self.to_mm[side] @ [x, y, 1.0]
        return (p[0] / p[2], p[1] / p[2])


# ----------------------------------------------------------------------------- small helpers


def load_rgb(path: Path) -> np.ndarray:
    return np.asarray(ImageOps.exif_transpose(Image.open(path)).convert("RGB"))


def _small(rgb: np.ndarray) -> tuple[np.ndarray, float]:
    h, w = rgb.shape[:2]
    f = WORK / max(h, w)
    return cv2.resize(rgb, (round(w * f), round(h * f)), interpolation=cv2.INTER_AREA), f


def T(x: float, y: float) -> np.ndarray:
    return np.array([[1, 0, x], [0, 1, y], [0, 0, 1]], float)


def R(a: float) -> np.ndarray:
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def S(k: float, ky: float | None = None) -> np.ndarray:
    return np.diag([k, k if ky is None else ky, 1.0])


def apply(H: np.ndarray, pts) -> np.ndarray:
    p = np.c_[np.asarray(pts, float), np.ones(len(pts))] @ H.T
    return p[:, :2] / p[:, 2:]


def fit_homography(src: list, dst: list) -> np.ndarray:
    """Least-squares homography (DLT, normalised) from point pairs."""
    src, dst = np.asarray(src, float), np.asarray(dst, float)

    def norm(p):
        c = p.mean(0)
        s = math.sqrt(2) / np.mean(np.linalg.norm(p - c, axis=1))
        return np.array([[s, 0, -s * c[0]], [0, s, -s * c[1]], [0, 0, 1]])

    ns, nd = norm(src), norm(dst)
    a = []
    for (x, y), (u, v) in zip(apply(ns, src), apply(nd, dst), strict=True):
        a.append([-x, -y, -1, 0, 0, 0, u * x, u * y, u])
        a.append([0, 0, 0, -x, -y, -1, v * x, v * y, v])
    h = np.linalg.svd(np.asarray(a))[2][-1].reshape(3, 3)
    h = np.linalg.inv(nd) @ h @ ns
    return h / h[2, 2]


# ----------------------------------------------------------------------------- segmentation


def _hue_hist(small: np.ndarray) -> np.ndarray:
    """Hues of saturated pixels, weighted towards the centre of the photo."""
    hsv = cv2.cvtColor(small, cv2.COLOR_RGB2HSV)
    h, w = hsv.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    weight = np.exp(-(((xx - w / 2) / (0.35 * w)) ** 2 + ((yy - h / 2) / (0.35 * h)) ** 2))
    sel = (hsv[..., 1] > 70) & (hsv[..., 2] > 30)
    hist = np.bincount(hsv[..., 0][sel], weights=weight[sel], minlength=180)
    return hist / max(hist.sum(), 1e-9)


def _smooth(h: np.ndarray) -> np.ndarray:
    return np.convolve(np.r_[h[-10:], h, h[:10]], np.ones(9) / 9, "same")[10:-10]


def board_hues(smalls: dict) -> dict:
    """The solder mask's hue in each photo: the peak both photos share, then each photo's own
    peak near it (the light differs between photos)."""
    joint = int(np.argmax(_smooth(sum(_hue_hist(s) for s in smalls.values()))))
    out = {}
    for side, s in smalls.items():
        h = _smooth(_hue_hist(s))
        out[side] = max(((joint + d) % 180 for d in range(-30, 31)), key=lambda i: h[i])
    return out


def board_shape(small: np.ndarray, hue: int) -> np.ndarray:
    """The board's shape (filled, without parts overhanging it): solder-mask-coloured pixels,
    closed, the largest region, holes filled. For alignment."""
    hsv = cv2.cvtColor(small, cv2.COLOR_RGB2HSV)
    dh = np.abs(hsv[..., 0].astype(int) - hue)
    dh = np.minimum(dh, 180 - dh)
    seed = ((dh < 16) & (hsv[..., 1] > 45) & (hsv[..., 2] > 20)).astype(np.uint8)
    seed = cv2.morphologyEx(seed, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (45, 45)))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(seed)
    if n < 2:
        raise ValueError("no board found (no region of solder-mask colour)")
    seed = (lab == 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)
    contours, _ = cv2.findContours(seed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    filled = np.zeros_like(seed)
    cv2.drawContours(filled, contours, -1, 1, -1)
    return filled


def board_cutout(small: np.ndarray, shape: np.ndarray) -> np.ndarray:
    """The board with the parts that overhang it, for background removal: GrabCut seeded by the
    board's shape, then an opening that drops thin wires leaving the board."""
    gc = np.full(shape.shape, cv2.GC_PR_BGD, np.uint8)
    gc[shape == 1] = cv2.GC_PR_FGD
    gc[cv2.erode(shape, np.ones((25, 25), np.uint8)) == 1] = cv2.GC_FGD
    gc[cv2.dilate(shape, np.ones((41, 41), np.uint8)) == 0] = cv2.GC_BGD
    cv2.setRNGSeed(0)
    bgd, fgd = np.zeros((1, 65)), np.zeros((1, 65))
    cv2.grabCut(cv2.cvtColor(small, cv2.COLOR_RGB2BGR), gc, None, bgd, fgd, 4, cv2.GC_INIT_WITH_MASK)
    m = np.isin(gc, (cv2.GC_FGD, cv2.GC_PR_FGD)).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m)
    return (lab == 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))).astype(np.uint8) if n > 1 else shape


# ----------------------------------------------------------------------------- alignment


def _moments(m: np.ndarray) -> tuple[float, float, float, float]:
    M = cv2.moments(m, True)
    return M["m10"] / M["m00"], M["m01"] / M["m00"], 0.5 * math.atan2(2 * M["mu11"], M["mu20"] - M["mu02"]), M["m00"]


def _ecc(template: np.ndarray, image: np.ndarray, W: np.ndarray) -> tuple[float, np.ndarray]:
    """Refine W (template pixels -> image pixels) by ECC on the blurred masks, coarse to fine."""
    cc = 0.0
    for lvl, blur in ((4, 9), (2, 7), (1, 5)):
        sm = S(1 / lvl)
        t = cv2.GaussianBlur(cv2.resize(template.astype(np.float32), None, fx=1 / lvl, fy=1 / lvl), (0, 0), blur / lvl * 2)
        i = cv2.GaussianBlur(cv2.resize(image.astype(np.float32), None, fx=1 / lvl, fy=1 / lvl), (0, 0), blur / lvl * 2)
        w = (sm @ W @ np.linalg.inv(sm)).astype(np.float32)
        w /= w[2, 2]
        criteria = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6)
        cc, w = cv2.findTransformECC(t, i, w, cv2.MOTION_HOMOGRAPHY, criteria, None, 5)
        W = np.linalg.inv(sm) @ w.astype(float) @ sm
    return float(cc), W


def _circles(small: np.ndarray, shape: np.ndarray, r0: int, r1: int) -> np.ndarray:
    """Round holes and pads on the board: (x, y) in analysis pixels."""
    g = cv2.GaussianBlur(cv2.cvtColor(small, cv2.COLOR_RGB2GRAY), (0, 0), 1.5)
    c = cv2.HoughCircles(g, cv2.HOUGH_GRADIENT, dp=1, minDist=max(4, r0 * 2), param1=120, param2=18, minRadius=r0, maxRadius=r1)
    if c is None:
        return np.zeros((0, 2))
    inside = cv2.dilate(shape, np.ones((9, 9), np.uint8))
    h, w = shape.shape
    return np.array([(x, y) for x, y, _ in c[0] if inside[min(int(y), h - 1), min(int(x), w - 1)]]).reshape(-1, 2)


def _refine_on_circles(W: np.ndarray, ref: tuple, oth: tuple, unit: float) -> tuple[np.ndarray, int]:
    """Re-fit other -> reference (analysis pixels) on circles matched through W, twice (the
    second pass matches through the first fit). Returns the homography and its inlier count."""
    (rs, rshape), (os_, oshape) = ref, oth
    cr = _circles(rs, rshape, max(3, int(unit * 0.4)), int(unit * 2.2))
    co = _circles(os_, oshape, max(3, int(unit * 0.4)), int(unit * 2.6))
    H = np.linalg.inv(W)  # other -> reference
    inliers = 0
    if len(cr) < 6 or len(co) < 6:
        return H, 0
    for tol in (2.0, 2.0):
        mapped = apply(H, co)
        src, dst = [], []
        for (x, y), p in zip(mapped, co, strict=True):
            d = np.hypot(cr[:, 0] - x, cr[:, 1] - y)
            j = int(np.argmin(d))
            if d[j] < unit * tol:
                src.append(p)
                dst.append(cr[j])
        if len(src) < 6:
            break
        Hn, inl = cv2.findHomography(np.float32(src), np.float32(dst), cv2.RANSAC, unit * 0.8)
        if Hn is None or inl.sum() < 6:
            break
        H, inliers = Hn, int(inl.sum())
    return H, inliers


def auto_align(ref: tuple, oth: tuple, ref_px_per_mm_small: float) -> tuple[np.ndarray, dict]:
    """Homography from the other photo to the reference photo (analysis pixels), seen from the
    opposite side of the board, so it includes a reflection: a photo of the bottom is always the
    mirror image of the top view. Tries both mirrored starting orientations (the board shape
    alone can't tell them apart when it is nearly symmetric); the most matched holes and pads,
    then the best shape match, wins."""
    (rs, rshape), (os_, oshape) = ref, oth
    cb, co = _moments(rshape), _moments(oshape)
    scale = math.sqrt(co[3] / cb[3])
    candidates = []
    for reflect in (True,):
        for extra in (0.0, math.pi):
            F = np.diag([1, -1, 1.0]) if reflect else np.eye(3)
            W = T(co[0], co[1]) @ R(co[2] + extra) @ S(scale) @ F @ R(-cb[2]) @ T(-cb[0], -cb[1])  # reference -> other
            try:
                cc, W = _ecc(rshape, oshape, W)
            except cv2.error:
                continue
            H, inliers = _refine_on_circles(W, ref, oth, ref_px_per_mm_small)
            candidates.append((inliers, cc, reflect, H))
    if not candidates:
        raise ValueError("could not align the two photos (the board shapes don't match)")
    inliers, cc, reflect, H = max(candidates, key=lambda c: (c[0], c[1]))
    return H, {"shape_match": round(cc, 4), "matched_features": inliers, "mirrored": reflect}


# ----------------------------------------------------------------------------- the frame


def _points_frame(model: dict) -> Frame:
    g = model["geometry"]
    x0, y1 = g["bottom_x0"], g["bottom_y1"]
    outline_px = np.asarray(g["outline_bottom_px"], float)
    if g.get("board_width_mm"):
        s = (outline_px[:, 0].max() - outline_px[:, 0].min()) / g["board_width_mm"]
        source = f"board width measured as {g['board_width_mm']} mm"
    else:
        s = g["bottom_px_per_mm"]
        source = g.get("scale_note") or f"{s} px per mm on the bottom photo"
    bottom = np.array([[1 / s, 0, -x0 / s], [0, -1 / s, y1 / s], [0, 0, 1]])
    outline = [tuple(p) for p in apply(bottom, outline_px)]
    pairs = g["top_points"]
    top = fit_homography([p[0] for p in pairs.values()], [apply(bottom, [p[1]])[0] for p in pairs.values()])
    residuals = {
        name: float(np.hypot(*(apply(top, [p[0]])[0] - apply(bottom, [p[1]])[0]))) for name, p in pairs.items()
    }
    return Frame("points", {"top": top, "bottom": bottom}, outline, g.get("thickness_mm", 1.6), source, residuals)


def _auto_frame(model: dict, smalls: dict, shapes: dict) -> Frame:
    g = model.get("geometry", {})
    sides = list(smalls)
    ref = g.get("reference", "bottom" if "bottom" in sides else sides[0])
    rs, rf = smalls[ref]
    contours, _ = cv2.findContours(shapes[ref], cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    contour = max(contours, key=cv2.contourArea)
    poly = cv2.approxPolyDP(contour, 0.002 * cv2.arcLength(contour, True), True)[:, 0, :] / rf  # reference photo px
    (cx, cy), (rw, rh), angle = cv2.minAreaRect(np.float32(poly))
    if rw < rh:
        angle += 90
        rw, rh = rh, rw
    long_px = rw
    if g.get("board_width_mm"):
        ppm = long_px / g["board_width_mm"]
        source = f"board width measured as {g['board_width_mm']} mm"
    elif ref == "bottom" and g.get("bottom_px_per_mm"):
        ppm = g["bottom_px_per_mm"]
        source = g.get("scale_note") or f"{ppm} px per mm on the bottom photo"
    else:
        ppm = long_px / ASSUMED_LONG_SIDE_MM
        source = f"assumed {ASSUMED_LONG_SIDE_MM:.0f} mm long: set geometry.board_width_mm to the measured width"
    # reference photo px -> mm: centred, deskewed (long side horizontal), mirrored if it is the bottom
    mirror = S(-1, 1) if ref == "bottom" else np.eye(3)
    to_ref = S(1 / ppm) @ mirror @ R(-math.radians(angle)) @ T(-cx, -cy)
    to_mm = {ref: to_ref}
    quality: dict = {"reference": ref}
    other = next((s for s in sides if s != ref), None)
    if other:
        os_, of = smalls[other]
        H_small, quality_o = auto_align((rs, shapes[ref]), (os_, shapes[other]), ppm * rf)
        quality.update(quality_o)
        to_mm[other] = to_ref @ S(1 / rf) @ H_small @ S(of)
        # turn the whole frame so the top photo is not upside down in it
        if "top" in to_mm and abs(_rotation(to_mm["top"])) > math.pi / 2:
            for k in to_mm:
                to_mm[k] = R(math.pi) @ to_mm[k]
    outline = apply(to_mm[ref], poly)
    shift = T(-outline[:, 0].min(), -outline[:, 1].min())
    for k in to_mm:
        to_mm[k] = shift @ to_mm[k]
        to_mm[k] /= to_mm[k][2, 2]
    outline = [tuple(p) for p in apply(shift, outline)]
    return Frame("auto", to_mm, outline, g.get("thickness_mm", 1.6), source, {}, quality)


def _rotation(H: np.ndarray) -> float:
    """The rotation angle of a homography's linear part, ignoring any reflection."""
    a, b, c, d = H[0, 0], H[0, 1], H[1, 0], H[1, 1]
    if a * d - b * c < 0:
        b, d = -b, -d
    return math.atan2(c - b, a + d)


# ----------------------------------------------------------------------------- outputs and cache


def _cache_key(model: dict, folder: Path) -> str:
    h = hashlib.sha256(f"align {ALGO}".encode())
    for side in ("top", "bottom"):
        if side in model["photos"]:
            h.update(side.encode())
            h.update((folder / model["photos"][side]["file"]).read_bytes())
    g = {k: v for k, v in (model.get("geometry") or {}).items() if k not in ("bodies", "notes")}
    h.update(json.dumps(g, sort_keys=True).encode())
    return h.hexdigest()[:20]


def _uses_points(model: dict) -> bool:
    g = model.get("geometry") or {}
    if g.get("alignment") == "auto":
        return False
    return all(k in g for k in ("bottom_x0", "bottom_y1", "outline_bottom_px", "top_points")) and (
        g.get("bottom_px_per_mm") or g.get("board_width_mm")
    )


def frame_and_images(model: dict, folder: Path) -> tuple[Frame | None, dict, dict]:
    """The board frame, the aligned images ({path under generated/: bytes}), and the view data
    for them. Reuses generated/aligned/ when the photos and geometry have not changed."""
    sides = [s for s in ("top", "bottom") if s in model["photos"]]
    if not sides:
        return None, {}, {}
    key = _cache_key(model, folder)
    cache = folder / "generated" / "aligned"
    meta_path = cache / "meta.json"
    if meta_path.exists():
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        if meta.get("key") == key and all((cache / f"{s}.webp").exists() for s in sides):
            frame = Frame(
                meta["method"], {k: np.array(v) for k, v in meta["to_mm"].items()}, [tuple(p) for p in meta["outline"]],
                meta["thickness"], meta["scale_source"], meta["residuals"], meta["quality"],
            )
            files = {f"aligned/{s}.webp": (cache / f"{s}.webp").read_bytes() for s in sides}
            files["aligned/meta.json"] = meta_path.read_bytes()
            return frame, files, meta["view"]

    rgbs = {s: load_rgb(folder / model["photos"][s]["file"]) for s in sides}
    smalls = {s: _small(rgbs[s]) for s in sides}
    hues = board_hues({s: smalls[s][0] for s in sides})
    shapes = {s: board_shape(smalls[s][0], hues[s]) for s in sides}
    cutouts = {s: board_cutout(smalls[s][0], shapes[s]) for s in sides}
    frame = _points_frame(model) if _uses_points(model) else _auto_frame(model, smalls, shapes)

    # the aligned images: each photo warped into the frame, the background made transparent
    ppm = FRAME_PX_PER_MM
    if max(frame.width, frame.height) * ppm > FRAME_MAX_PX:
        ppm = FRAME_MAX_PX / max(frame.width, frame.height)
    size = (math.ceil((frame.width + 2 * MARGIN_MM) * ppm), math.ceil((frame.height + 2 * MARGIN_MM) * ppm))
    to_px = S(ppm) @ T(MARGIN_MM, MARGIN_MM)
    files, view_sides = {}, {}
    for s in sides:
        A = to_px @ frame.to_mm[s]
        A /= A[2, 2]
        rgb = cv2.warpPerspective(rgbs[s], A, size, flags=cv2.INTER_AREA, borderValue=(0, 0, 0))
        f = smalls[s][1]
        alpha = cv2.warpPerspective(cutouts[s].astype(np.float32), A @ S(1 / f), size, flags=cv2.INTER_LINEAR)
        alpha = cv2.GaussianBlur(alpha, (0, 0), 1.2)
        rgba = np.dstack([rgb, np.clip(alpha * 255, 0, 255).astype(np.uint8)])
        buf = io.BytesIO()
        Image.fromarray(rgba, "RGBA").save(buf, format="WEBP", quality=82, method=4)
        files[f"aligned/{s}.webp"] = buf.getvalue()
        view_sides[s] = {"src": f"generated/aligned/{s}.webp", "H": [[round(v, 9) for v in row] for row in A.tolist()]}
    view = {
        "method": frame.method,
        "width": size[0],
        "height": size[1],
        "px_per_mm": round(ppm, 4),
        "scale_source": frame.scale_source,
        "quality": frame.quality,
        "sides": view_sides,
    }
    meta = {
        "key": key,
        "method": frame.method,
        "to_mm": {k: v.tolist() for k, v in frame.to_mm.items()},
        "outline": [list(p) for p in frame.outline],
        "thickness": frame.thickness,
        "scale_source": frame.scale_source,
        "residuals": frame.residuals,
        "quality": frame.quality,
        "view": view,
    }
    files["aligned/meta.json"] = json.dumps(meta).encode()
    return frame, files, view
