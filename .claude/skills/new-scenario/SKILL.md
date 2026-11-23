---
name: new-scenario
description: Create a new PCB repair scenario from photos of a circuit board and the user's observations and instruments, a scenario folder with scenario.json, record.json, the photos, the generated netlist, schematic and 3D data, and a first investigation plan, ready to open in the app. Use when the user wants to start modelling or repairing a new board, gives board photos, or asks to create or add a scenario.
---

# Create a scenario from board photos

A **scenario** is one folder (format in [docs/scenario-format.md](../../../docs/scenario-format.md)):

- `scenario.json`: the board model and the user's instruments;
- `record.json`: the user's observations, instructions and results;
- `plan.json`: the investigation plan, written at the end by the `plan-investigation` skill;
- the photos and documents they refer to, and the outputs the build writes (`exports/`, `generated/`).

Scenarios live in `scenarios/<id>/`, committed with the repository. `scenarios/homestar-flux/` is a complete one: read its `scenario.json` before writing one.

The model's purpose is to plan meter checks on the real board. **What you infer from photos is a hypothesis**: record how sure you are of every connection, and prefer leaving a pin unknown to guessing.

## 1. Ask

Ask the user, in one round (use the question tool when you have one; skip what they already said):

- **The photos:** which files, and which one shows the **top** (component side) and which the **bottom**. Others are close-ups. Ask for a straight-on photo of each side if there is none; close-ups of chip markings help most.
- **The name** of the scenario (the page heading, for example "Acme X1 amplifier") and its **folder id** (lowercase, dashes; default: from the name). It goes in `scenarios/<id>/`.
- **The device and the fault:** what it is and what goes wrong, in a sentence or two. This becomes `board.description`.
- **Observations:** the symptoms in detail (what happens, when, after what), the device's history (dropped, wet, repaired before, how it failed), and everything already tried, with what it showed. Each becomes an observation in `record.json`, in the user's words: they are the facts the plan reasons from.
- **Instruments:** what they have on the bench: a multimeter (which modes: diode, capacitance?), a USB power meter, a current-limited bench supply, an ESR meter, an oscilloscope, a thermal camera. The plan only asks for what these can do.
- Optional: manuals or datasheets to copy into `docs/`, and the board's measured **width in mm** (enables a scaled 3D view).

Look at the photos yourself before asking about orientation: if the bottom photo's silkscreen reads upside down, offer `--rotate-bottom`.

## 2. Create the folder

The scripts need Python 3.10+ with `app/scripts/requirements.txt` (jsonschema, Pillow, NumPy). Check with `python3 -c "import jsonschema, PIL, numpy"`; if that fails, make a virtual environment (`python3 -m venv .venv && .venv/bin/pip install -r app/scripts/requirements.txt`, then use `.venv/bin/python`), or run every command below in the app's image: `docker run --rm --user "$(id -u):$(id -g)" -v "$PWD":/w -w /w homestar-flux-app python -I app/scripts/...` (`make build` first; it sees only the repository, so copy the user's photos into it, for example into `scenarios/<id>-incoming/`, and delete that copy afterwards). Convert HEIC photos to JPEG first (macOS: `sips -s format jpeg in.heic --out out.jpg`).

```sh
python3 -I app/scripts/new_scenario.py scenarios/<id> --title "<name>" --name "<board>" \
  --marking "<silkscreen text>" --description "<device and fault>" \
  --top <top.jpg> --bottom <bottom.jpg> [--rotate-bottom] --closeup <close-ups...> [--doc <pdfs...>] \
  --instrument multimeter [--instrument "usb_meter:UM25C" ...] \
  --observation "<a symptom or fact>" [--observation "..." ...]
```

It copies the photos (into `photos/`, close-ups into `photos/parts/`), reads their sizes, and writes a valid `scenario.json` with no parts yet but the instruments, a `record.json` with the observations, and a `README.md`.

## 3. Survey the board

Read the photos at full resolution, region by region. To read pixel coordinates, draw a grid (coordinates are always the original photo's pixels):

```sh
python3 -I app/scripts/photo_tools.py grid scenarios/<id>/photos/<top.jpg> /tmp/grid.jpg                 # whole photo
python3 -I app/scripts/photo_tools.py grid scenarios/<id>/photos/<top.jpg> /tmp/zoom.jpg --crop 800,1600,1400,2200   # a region, enlarged
```

Write the outputs to a scratch folder, not into the scenario. For each part, note: its **reference** (the silkscreen designator; invent one only for unlabelled parts, such as `J_DCP` for a wire pad, and say so in `note`), its **kind** (`ic`, `transistor`, `diode`, `led`, `resistor`, `capacitor`, `electrolytic`, `inductor`, `switch`, `pad`), its **value** exactly as marked (resistor codes, capacitor voltage, chip markings; "unmarked" when there is none), its **package**, and which functional **block** it belongs to (power input, regulator, MCU, motor driver...).

## 4. Write the model

Edit `scenarios/<id>/scenario.json` (keep it valid JSON; `python3 -I app/scripts/scenario_json.py <file>` restores the standard layout after hand edits):

- **`blocks`:** one per functional area, `{ "title", "subtitle", "col", "row" }` on a small grid (the block diagram), and **`links`** between them (`{ "from", "to", "conf", "label" }`).
- **`parts`:** `{ "kind", "value", "package", "group": <block>, "pins": { "1": "<name>", ... }, "box": { "top": [x0, y0, x1, y1] } }`. Pin names: from the datasheet when the part number is readable (then say so in `pinout_source`), else the conventional ones for the kind (`A`/`K` for diodes and LEDs, `1`/`2` for passives, the package's usual order for transistors, marked as an assumption in `pinout_source`), else just the numbers. Add `label` for silkscreen text that is not a designator (`DC+`), and `wire` for a pad's wire colour.
- **`nets`:** only connections with evidence, each node `{ "ref", "pin", "conf", "evidence" }`:
  - `confirmed`: a silkscreen label at the pad, or a wire seen soldered to it;
  - `photo`: a trace, copper area or tinned strip you can follow on a photo (name the photo in the evidence);
  - `datasheet`: a pin's function from the datasheet of a part whose marking you read (for example a regulator's GND pin);
  - `assumed`: standard practice or placement only (a decoupling capacitor next to a chip). Keep these few, and never call a placement guess `photo`.
  - Never `measured`: that is for the user's meter checks. Pins with no evidence stay off every net: unknown, not unconnected.
- **`traces`:** for copper you followed, a polyline on that photo: `{ "id": "t1", "net", "side", "points": [[x, y], ...], "evidence" }`.
- **`power_nets`:** the supply and ground nets (drawn as power symbols).
- **`open_questions`:** the gaps that matter for the fault, each with the measurement that settles it: `{ "id": "OQ1", "title", "pins": [[ref, pin]], "candidates", "check", "why" }`. Order them by how much they would narrow the diagnosis.

## 5. Check, and fix until it passes

```sh
python3 -I app/scripts/build.py scenarios/<id>                       # validate and write exports/ and generated/
python3 -I app/scripts/photo_tools.py boxes scenarios/<id> top /tmp/boxes-top.jpg   # check the boxes on each photo
```

The build reports every problem (unknown pins, a pin on two nets, a part's group that is not a block, boxes on missing photos...). Fix them all. Look at the box overlays and correct boxes that miss their part. The schematic is drawn automatically (parts stacked per block, power pins on symbols); `schematic_layout` can place parts and wires by hand later, or the user can lay it out in the app's schematic editor.

## 6. The aligned and 3D views

The build processes the photos itself: it removes their background, corrects the perspective, and aligns the top and bottom (the app's **Aligned** view, and the 3D view). It reports "photos aligned automatically (N holes and pads matched)"; look at `generated/aligned/top.webp` and `bottom.webp` to check the cut-outs. What helps:

- **The scale:** ask the user to measure the board's width (its longest side, in mm) and set `geometry.board_width_mm`; without it the board is assumed 100 mm long.
- **The reference:** the straighter photo defines the frame (`geometry.reference`, `bottom` by default); set it to `top` if the top photo is the straight-on one.
- **If the automatic fit is poor** (few holes and pads matched, or parts visibly off in the overlay), hand-picked points replace it: `outline_bottom_px`, `bottom_x0`, `bottom_y1` and at least 4 `top_points` seen on both photos (see the schema and the example). Skip this unless needed.

## 7. Plan the investigation

Run the [`plan-investigation`](../plan-investigation/SKILL.md) skill on the new folder. It writes `plan.json`, the first steps the user follows in the app: safety and set-up, the checks with the power off that clear the most suspects, and so on, limited to their instruments.

## 8. Hand over

- Tell the user to run `make start` (or `make build && make start` if the app changed) and open http://localhost:8080, where the scenario is listed.
  - In the **Current step** panel they follow the plan: tick the set-up, do the step, enter the reading.
  - With **Edit** (top bar), on the photos and in the Details panel, they fix names, values, boxes and connections; every edit is saved to `scenario.json`.
  - In the **Repair log** panel, with **Add a note** in the sidebar, or with **Note** on any step, they write observations, and instructions for the agent's next round.
  - When the app says the plan needs an update, they run `/plan-investigation scenarios/<id>` in Claude Code.
- Summarise:
  - the parts found;
  - the nets, and the connections by confidence level;
  - what you could not read;
  - the main suspects;
  - the first step of the plan.
- `app/scripts/build.sh scenarios/<id>` (needs Docker, pulls `kicad/kicad:9.0`) adds the KiCad SVG shown in the Schematic panel and the KiCad checks; offer it, don't run it unasked.
