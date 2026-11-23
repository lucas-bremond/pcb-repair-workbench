# The scenario viewer

A tool for repairing a circuit board: working out how it is wired, one connection at a time, and following an expert's fault-finding plan step by step. Each board is a **scenario**: a folder with a `scenario.json` (the board), a `plan.json` (the investigation plan, written by an agent) and a `record.json` (what you did and saw), and the photos they refer to. The app lists the scenario folders it can see, opens one at a time, saves your edits to the board back to `scenario.json`, and adds your results and notes to `record.json`. It does no reasoning of its own: the agent, through the repository's skills, drives the diagnosis (see [Investigate](#investigate)).

**Start it** from the repository root: `make start`, then open http://localhost:8080 (see [Docker](#docker)). The start page lists the scenarios in `scenarios/` (committed with the repository).

A scenario opens in a **workspace of panels**, laid out after [Kandev](https://github.com/kdlbs/kandev)'s workbench (see [The workspace](#the-workspace)). Open any number of them, several of the same kind (two photos of the top side, zoomed on different areas), and arrange them by dragging their tabs. The panels:

- **Investigation:**
  - **Current step:** the plan, step by step: what to set up, what to do, where the probes go, what a good board reads, and your answer (see [Investigate](#investigate)).
  - **Phases and steps:** where you are in the plan.
  - **Suspects**, **Open questions** and **Established:** what the plan says, updated by your answers.
  - **Repair log:** the timeline of everything that happened (see [Repair log](#repair-log)).
- **Board:**
  - **Parts**, **Nets** and **Traces:** the lists.
  - **Details:** what is selected, and the editor's forms.
  - **2D:** the photos, the reference and the place to edit: **Raw** (as taken) or **Aligned**, each showing **Top**, **Bottom** or **Both** (and **Overlay** when aligned), switched in the panel.
  - **3D:** the board built from the photos (see [The board panels](#the-board-panels)).

  Select a part, a net or a trace in any of them to highlight its connections in all of them, coloured by confidence, with the evidence for each.

- **Diagrams:** the **Block diagram**, and the **Schematic** (the KiCad export and the layout editor).

Hover a confidence chip (next to a net or a pin) to see what its level means. The theme menu (sun/moon, at the bottom of the sidebar) switches between light, dark and the system's theme. The palette and the font follow Kandev's too: neutral greys, an indigo primary, and status colours (success, warning, destructive) as theme tokens.

## The workspace

- **The sidebar** (left), after Kandev's:
  - **The header:** the brand, then the **scenario picker**. The picker lists every scenario with its plan's revision, and offers **Edit scenario**, **New scenario** (how to run the `new-scenario` skill) and **All scenarios**.
  - **Collapse:** the button at its top right, or Ctrl+B, folds it to a rail of icons.
  - **Below:** **Add a note**, then one row per kind of panel in three sections (Investigation, Board, Diagrams), each with a count where it helps (open suspects, parts, nets). The Current step row says **Update** when the plan needs one.
  - **A row** brings its panel to the front, or opens one; the **+** on a row (on hover) opens another.
  - **Layouts** applies a preset arrangement:
    - **Investigate** (the default): the steps on the left, the current step in the middle, the photos and the suspects on the right;
    - **Board:** the lists, both photos, the details;
    - **Schematic:** the lists, the schematic and the block diagram, the details.
- **The save status** sits at the bottom of the sidebar, beside the theme menu. There is no top bar: the editor's controls are in the panels they apply to (see [Editing](#editing)).
- **Panels** sit in groups, each with a tab strip:
  - **Arrange:** drag a tab within its group, onto another group, or to a group's edge to split it.
  - **Add:** the **+** after the tabs adds a panel to the group.
  - **Group buttons:** maximize or restore, split right, split down, and close the group (in a narrow group, one **…** menu holds them). Double-click a tab to maximize its group.
  - **Empty group:** it offers **Add panel**.
  - **What is kept:** the arrangement, under `pcbmodel-layout` in the browser's localStorage. Each panel keeps its own settings, such as what a 2D panel shows (raw or aligned, and which sides) and the overlay's settings.

## Scenarios

A scenario folder:

| Path                | What it is                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `scenario.json`     | **The board:** parts, pins, nets with the confidence and evidence of every connection, instruments, and more. You edit it in the app   |
| `plan.json`         | **The agent's analysis:** test procedures, findings, suspects, the state of each part, and the plan as a tree of steps. Read-only here |
| `record.json`       | **Your record:** observations, instructions for the agent, and results. Added to, never edited                                         |
| `photos/`, `docs/`… | The photos and documents it refers to (any layout; paths are relative to the folder)                                                   |
| `exports/`          | Written by the build: `investigation.md`, `netlist.md`, `block-diagram.svg`, `schematic.kicad_sch`; `schematic.svg` from `build.sh`    |
| `generated/`        | Written by the build: the viewer's data (resized photos, 3D textures, `view.json`, `status.json`). A cache; never committed            |

The three files are specified in [docs/scenario-format.md](../docs/scenario-format.md) (who writes what, the plan's steps and answers, what the app derives, what the build checks), and checked by [`schema/scenario.schema.json`](schema/scenario.schema.json), [`schema/plan.schema.json`](schema/plan.schema.json) and [`schema/record.schema.json`](schema/record.schema.json) (JSON Schema 2020-12). `scenario.json` in short:

- `board`: `title` (the scenario's name), `name`, `marking`, `description`, `model_date`.
- `instruments`: what you have on the bench (`multimeter`, `bench_supply`, `usb_meter`, `esr_meter`, `oscilloscope`...). The plan only asks for what these can do.
- `confidence`: the five levels below, with their rank, colour and meaning.
- `photos`: `top` and/or `bottom`, each a file with its pixel size, and `display_rotation: 180` to show a photo turned so its silkscreen reads upright. Boxes and traces always stay in the original file's pixels.
- `parts`: by reference: `kind`, `value`, `package`, `label`, `group` (its block), `pins` (number to name), `box` (where it is on each photo) and `formerly` (earlier references, so the plan and the record still find a renamed part).
- `nets`: by name: `description`, `formerly`, and `nodes`, each `{ ref, pin, conf, evidence }`. A connection's evidence can cite a result (`R12: 0.3 Ω`): only those are `measured`.
- `traces`: copper followed on a photo, as polylines.
- `blocks` and `links` for the block diagram, `open_questions`, `power_nets`, `schematic_order`, `schematic_layout` and `schematic` for the schematic, and `geometry` for how the photos map onto the board (all optional; see [Board tab](#board-tab)).

The build ([`scripts/build.py`](scripts/build.py)) checks a scenario against the schema and for consistency (every node's part and pin exist, a pin is on one net only, every part's group is a block, traces are on existing nets, photo files exist), then writes `exports/` and `generated/`. The server runs it on every save, so a scenario on disk always passes it. It also checks `plan.json` and `record.json` ([`scripts/investigation.py`](scripts/investigation.py)), but reports a plan's problems separately: a plan that no longer matches the model never blocks an edit to the model.

### Creating one

The [`new-scenario`](../.claude/skills/new-scenario/SKILL.md) skill walks an agent (Claude Code, in this repository) through it: ask for the photos, the name, the fault, what was already tried and the instruments at hand, create the folder, identify the parts and their boxes, record only the connections it has evidence for, add the open questions, check the result, and write the first plan with the [`plan-investigation`](../.claude/skills/plan-investigation/SKILL.md) skill. Its tools work on their own too:

```sh
python3 -I app/scripts/new_scenario.py scenarios/my-board --title "My board" --top top.jpg --bottom bottom.jpg [--rotate-bottom] [--closeup ...] [--doc ...] \
  [--instrument multimeter ...] [--observation "Pressing Move resets the unit." ...]
python3 -I app/scripts/photo_tools.py grid PHOTO out.jpg [--crop X0,Y0,X1,Y1]   # a labelled coordinate grid, to read pixel positions
python3 -I app/scripts/photo_tools.py boxes scenarios/my-board top out.jpg        # the part boxes and traces drawn on a photo, to check them
python3 -I app/scripts/scenario_json.py scenarios/my-board/scenario.json          # restore the standard layout after a hand edit
```

`new_scenario.py` copies the photos, reads their sizes, and writes a `scenario.json` the build accepts (no parts yet, the instruments), a `record.json` with your first observations, and a `README.md`. [`migrate_v2.py`](scripts/migrate_v2.py) converts a scenario from the earlier format (its repair log becomes observations, and the whole log is kept in `docs/repair-log-v1.md` for the first plan).

## Confidence levels

Every connection (a pin on a net) has one level. A net is only as certain as its weakest connection. The names are fixed; each scenario words their meaning.

| Level       | Typical meaning                                                                        |
| ----------- | -------------------------------------------------------------------------------------- |
| `measured`  | Checked on the board with a meter                                                      |
| `confirmed` | Silkscreen label, a wire seen soldered to the pad, or a measurement recorded elsewhere |
| `photo`     | Trace, copper area or tinned strip followed in a close-up                              |
| `datasheet` | Pin function from the part's datasheet (the part number itself is read from the photo) |
| `assumed`   | Standard circuit practice or placement only                                            |

Pins that aren't on any net are **unknown**, not unconnected. The schematic leaves them open, and the viewer draws parts with no known connection as dashed boxes.

## The board panels

**2D** (the photos, the reference, and where you edit; **Raw** shows them as taken and **Aligned** processed by the build, then **Top**, **Bottom** or **Both** pick the sides, **Overlay** (aligned only) one seen through the other; **Labels** shows every part's label, **Traces** the traced copper):

- **Zoom and pan** each photo on its own: pinch on a trackpad or Ctrl/⌘ + scroll zooms at the pointer, up to 1000 %. Drag to pan, or scroll while zoomed. Double-click zooms in (Shift + double-click zooms out), except while editing, where a double-click ends a trace. **−**, **+** and **Fit** sit above each photo. A drag that pans never selects what it started on, so you can pan from anywhere, including in draw mode.
- A photo with `display_rotation: 180` is shown turned; the page turns boxes and traces with it.

**2D · Aligned** (the photos processed by the build):

- **What it shows:** each side with its background removed, its perspective corrected, and both sides aligned on the board, so a point on one side is at the same place on the other.
- **Both:** one above the other, the top as seen from above, the bottom as seen from below (mirrored back so its labels read). The arrows beside the switches turn the whole view, one side, both or the overlay, by 90° each way.
- **Overlay:** one side in front, the other seen through the board at the opacity the slider sets: a pad or a via on the bottom shows where it is under the top's parts.
- Boxes, traces, selection and the editor work as in 2D: everything is stored in the original photos' pixels and mapped through each photo's alignment.

How the photos are processed ([`scripts/align.py`](scripts/align.py)):

- **The board frame** is the board seen from the top, in millimetres; each photo maps into it by a homography. The aligned view and the 3D view share it.
- **Automatic** (the default for a new scenario): each photo's board is segmented by the solder mask's colour (the hue the two photos share, found in each photo under its own light) and cut out with GrabCut, which keeps parts overhanging the board and drops the background and the wires. The straighter photo (`geometry.reference`, the bottom by default) defines the frame: its outline, deskewed so the long side is horizontal, and mirrored into a top view. The other photo is fitted onto it by aligning the two board shapes (ECC, a homography: this corrects its perspective), then refined on the holes and through-hole pads seen on both sides (RANSAC). On the example it lands within 0.9 mm on average of the hand-picked points ([`tests/check_align.py`](tests/check_align.py)).
- **Hand-picked points** (when `geometry` has `bottom_x0`, `bottom_y1`, `outline_bottom_px`, `top_points` and a scale, as the example does; `alignment` forces either method): the bottom photo, assumed straight-on, defines the frame by a scale and a mirror, and the top photo's homography is fitted on the points seen on both photos; the build reports each point's residual.
- **Scale:** `board_width_mm` (measure it: the most accurate), else `bottom_px_per_mm`, else an assumed 100 mm long board (the view then says so).
- **Cache:** segmentation and alignment take a second or two per photo, so the results are kept in `generated/aligned/` and reused until a photo or the geometry changes; saves stay fast.

**3D** (needs WebGL, and both photos):

- **What it shows:** the board with both photos mapped onto its faces, and every part with a box as a simple 3D body on its side of the board. Wires leave their pads in their real colours.
- **Controls:** drag to orbit, scroll to zoom, right-drag to pan. **3D**, **Top** and **Bottom** set the view; **X-ray board** makes the board see-through, which is useful for nets that cross sides. Click a part to select it.
- **Traces** (the switch above the scene, shared with the photos): the copper actually followed in the close-ups, drawn as copper strips on the right side of the board. Hover over a strip to see its source photo; selecting a net lights its strips.
- **Enhanced photo:** swaps in contrast-boosted textures (the same photos, no pixels added) in which the copper under the solder mask shows as outlines across the whole board. Use it to follow traces by eye; nothing in it has been traced.
- **Selection** is shared with 2D. A selected net draws lines joining its parts (the shortest tree through them), each coloured by the weaker end's confidence. These lines show the model's connections, **not the copper route**. **Show on board** on an open question lights the parts to probe.
- The 3D scene is built when the scenario opens: moved boxes and new traces show in 3D after a reload.

3D bodies are sized from each part's kind, package and photo box; `geometry.bodies` overrides them. Heights are typical values, not measurements, and parts photographed at an angle are placed at the base of their box. Treat the result as a map for finding parts and probe points, not as a mechanical model.

**Lists:** one panel each, with the filter box at the top, shared by the three (typing in one filters all), and a count of what matches.

- **Parts**, as a table: part, a **type tag** (IC, transistor, diode, LED, resistor, capacitor, electrolytic, inductor, switch, wire pad), value, **Nets** (pins on a known net out of all pins), and **Tested**: the latest test result (hover it for every result), or a **Test** button that opens the test dialog with the plan's procedures for that kind of part (and the general ones, such as an inspection). The button is disabled when the plan has none for the kind: a procedure for another kind, such as diode mode on a resistor, would give a wrong verdict. Click a column header to sort (Tested sorts failures first), again to reverse. Filter by type with the tag chips (several at once), by side (top, bottom, or not placed) with the side menu, or to parts with at least one known net. **Reset** clears the filters. A dot marks each part the plan has assessed. The page remembers the sort and the filters.
- **Nets** and **Traces**.
- A click on a row selects it; a **double-click** also brings up the Details panel (opening one if none is open). The same goes for a block in the diagram and an open question.

## Editing

Click **Edit** at the top of a 2D panel, which also holds the tools (**Select**, **Draw trace**, **Finish trace**), **Undo**, **Redo** and a hint for what a click does now. The Details panel has **Edit**, **Undo**, **Redo** and **Clear selection** too:

- **Draw trace:** click points along copper you can follow in a photo, then double-click, press Enter or click **Finish trace**. The trace takes the selected net; change it and add its evidence in the side panel.
- **Select / move:**
  - **Traces:** select one to drag its points. Drag a small square to insert a point; Alt-click or right-click a point to delete it. **Extend** adds points at the end, and Delete removes the trace.
  - **Parts:** select one to drag its box or resize it by the corners, add or remove its box on either photo, and edit each pin's net, confidence and evidence. For example, record a meter check by setting the pin's confidence to `measured`. "(unknown)" takes the pin off its net, and "New net…" creates a net. "edited" marks what changed since the page loaded.
- **The scenario:** **Edit scenario** in the scenario picker opens its form in the Details panel: its name, the board, its marking, the device and fault, and the review date.
- **Part properties:** a selected part's reference (renaming it updates its nets, open questions, schematic layout and 3D overrides), label, type, block, value, package, note and pinout source. Each pin's name can be changed; **Add pin** and the × beside a pin add and remove pins. **Add part** (under the parts table) and **Delete part** add and remove whole parts.
- **Nets:** select a net to rename it (its traces and power symbols follow; renaming onto an existing net merges the two), describe it, or delete it (its pins become unknown and its traces go).
- **Undo** (Ctrl+Z) and **Redo** (Ctrl+Shift+Z) step through the edits, on the photos and in the schematic editor alike.

**Saving is automatic.** A moment after each edit the page sends the scenario to the server, which writes it to a temporary file, runs the build on it, and replaces `scenario.json` only if the build accepts it. The status at the top right says **Saving…**, **Saved**, or **Not saved** with the reasons (an edit the build refuses, such as a trace on a net that no longer exists, stays in the page until you fix or undo it). If something else changed `scenario.json` since the page loaded (another tab, an agent, a text editor), the save stops and asks you to reload instead of overwriting it. The file is written with a stable layout ([`server/scenario-json.mjs`](server/scenario-json.mjs), the same as [`scripts/scenario_json.py`](scripts/scenario_json.py)), so a diff shows only what changed.

## Investigate

The diagnosis is a loop between you and an agent. The agent (Claude Code, with the [`plan-investigation`](../.claude/skills/plan-investigation/SKILL.md) skill) reads the board model, your observations, instructions and results, and writes `plan.json`: what is established, the suspects, the state of each part, the test procedures for your instruments, and the next steps as a tree. You follow the tree in the **Current step** panel and report back. When the tree ends, or the model or your notes changed, you run the skill again; it keeps every result, and regrows the tree from where you stand. The process it follows (power off before power on, cheap and safe checks before invasive ones, one reading that clears many parts at once) comes from how repair shops work: see [docs/research/](../docs/research/board-repair-diagnosis.md).

Its panels (the Investigate layout shows them together):

- **Phases and steps:** where you are in the plan's phases, and every step answered so far with its answer. Click one to look back at it (and answer it again: the new result replaces the old one, which stays in the record).
- **The step:**
  - the state to set up, as boxes to tick before the answer can be saved;
  - any hazard, before the action;
  - the action, and where each probe goes (red, black), linked to the part on the board;
  - the procedure, with a field for each reading (`99.8`, `4.7k`, `4k7`, `0.62`, `OL`);
  - what a good board reads, and where that comes from (the part's marking, its datasheet, an identical part on this board, a rule of thumb);
  - why the step is asked.

  Your readings preselect the answer whose range they fall in; you confirm it or pick another, add a note, and **Save and continue** goes to the step the plan names for that answer. A **sweep** lists several parts to test with one procedure, each in its own dialog. **Can't answer** has "I could not do it" and "This step looks wrong" (both need a reason, and ask for a plan update), and "Skip it for now" where the plan allows it.

- **Suspects, open questions and what is established:**
  - each suspect's status, updated at once by the effects the plan wrote for each answer (ruled out, confirmed, more or less likely), and the parts it involves;
  - the model's open questions (`open_questions` in `scenario.json`): the gaps that matter for the fault, each with its pins, the measurement that settles it, and the plan step that does, with its answer once given. **Show on board** lights its pins. A part's or net's details list the questions about it too.

When the plan needs an update, a banner says why and shows the command to run in Claude Code (`/plan-investigation scenarios/<folder>`):

- the model changed: a part's kind, value or pins, a connection, or the instruments, compared through a fingerprint the build computes (moving a box or drawing a trace doesn't count);
- a new observation or instruction;
- a voided entry;
- the plan reached a "next round" step;
- a step was disputed or could not be done.

You can keep following the plan meanwhile. When the agent writes a new `plan.json`, the page picks it up by itself.

**Notes** (the **Note** button on a step, or in the Repair log) are either:

- **observations:** facts for the agent, such as what you saw, smelled, or did to the board;
- **instructions for the agent:** requests for its next round, such as a direction, a constraint ("no desoldering yet"), a doubt about the model ("re-read U2's marking"), or a question. An instruction stays in force until you void it, and the agent replies to each in the plan's history.

Both are linked to what is selected on the board and to the step you are on.

**Test this part** (a part's details) tests it outside the plan, with any of the plan's procedures, on the board or lifted out. The part's details list every result about it, and the parts table marks each part the plan has assessed (tested good, cleared of a short, suspect, faulty, can't test with your instruments).

## Repair log

The **Repair log** panel is the investigation's timeline, newest first:

- your observations and instructions, each instruction with the agent's reply, or "waiting for the next planning round";
- your results, with their readings;
- the agent's plan revisions, with what changed and why, and every change it made to the model.

Filter it by kind. Nothing in it is edited: add an observation or an instruction, and **Void** an entry that was wrong (a slip, the wrong part). A void entry stays, struck through, with its reason, and counts for nothing. The build exports the plan, the results and the timeline as `exports/investigation.md`, for reading outside the app.

## Schematic

`exports/schematic.kicad_sch` draws **every known connection** ([`scripts/schematic.py`](scripts/schematic.py)). Only pins with no known net stay open: they are unknown, not unconnected.

- **Signal nets** are wired. A wire's colour is the weakest confidence among the pins it joins. Solid means verified (`photo`, `confirmed` or `measured`); dashed means `datasheet` or `assumed`. Each wired net is named once, on its board pad if it has one.
- **Power nets** (`power_nets`) use power symbols. A power-net pin without a wire gets a short stub and a symbol automatically.
- **The layout** is hand-made per block in `schematic_layout`, or comes from the [schematic editor](#schematic-editor) (`schematic`). Parts not placed by hand are stacked below their block.

The build refuses a layout in which a wire:

- joins two nets, or reaches a pin whose net is unknown;
- runs diagonally, or through a pin;
- ends in the middle of another wire;
- leaves a power-net group without a power symbol;
- or in which two pins touch.

If an edit re-assigns a pin, the hand-laid wires of its old group are dropped with a warning and those pins fall back to labels; an edit to connections never makes the build fail. A known pin left without a wire is reported and labelled.

The **KiCad export** view shows `exports/schematic.svg`, which only `build.sh` refreshes (it needs `kicad-cli`); the editor below always reflects the scenario.

### Schematic editor

**Schematic → Edit layout**:

- **Select / move:** drag a part (it snaps to the 2.54 mm grid, and its wires follow with new corners); click a wire or a power symbol to select it; **Delete** removes it; **M** mirrors the selected part.
- **Draw wire:** click pins or points (pins and wire ends snap within 1.3 mm, corners are added automatically); double-click or Enter ends the wire; Esc cancels.
- **Power symbol:** pick the net and direction, then click a pin end or a wire end.
- **Problems** are listed live, with the same rules as the build. A wire that reaches a pin with an unknown net offers a one-click fix: add that pin to the wire's net as `assumed`.
- **Zoom:** the − and + buttons, or Ctrl+scroll.
- Orange rings mark known pins that are not wired; faded power symbols are the ones the build will add.

After any move or new wire, the editor tidies the wires: it drops repeated points and back-and-forth spikes, and splits a wire wherever another wire ends or turns on it, so every joint is a wire end. Moving a part does not move power symbols sitting on shared corners: tidy those by hand.

The layout is saved in `scenario.json` as `schematic` (absolute sheet millimetres). **Reset to automatic layout** removes it, so `schematic_layout` applies again.

## How it fits together

| Path                                                   | What it is                                                                                                       |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| [`schema/`](schema/)                                   | The three files' schemas: `scenario.schema.json`, `plan.schema.json`, `record.schema.json`                       |
| [`scripts/build.py`](scripts/build.py)                 | Validates a scenario and writes `exports/` and `generated/` (netlist, block diagram, schematic, 3D)              |
| [`scripts/schematic.py`](scripts/schematic.py)         | KiCad schematic generation and its layout rules                                                                  |
| [`scripts/align.py`](scripts/align.py)                 | The board frame: background removal, perspective correction, front and back alignment                            |
| [`scripts/board3d.py`](scripts/board3d.py)             | 3D geometry for the 3D panel                                                                                     |
| [`scripts/investigation.py`](scripts/investigation.py) | Checks and walks the plan, derives suspects and part states, the fingerprint; `status` and `stamp` for the agent |
| [`scripts/build.sh`](scripts/build.sh)                 | The build plus the KiCad checks for one scenario (needs Docker)                                                  |
| [`scripts/requirements.txt`](scripts/requirements.txt) | The pinned Python packages for the scripts                                                                       |
| [`server/`](server/)                                   | The server: lists, serves and saves scenarios, serves the app (Node.js, no dependencies)                         |
| [`web/`](web/)                                         | The app: React 19, TypeScript, shadcn/ui, three.js, built by Vite                                                |
| [`tests/`](tests/)                                     | Headless browser tests against a copy of the example                                                             |

**The server** ([`server/server.mjs`](server/server.mjs)) reads the scenario folders under its roots (`SCENARIO_ROOTS`, `name=path` pairs) and answers:

- `GET /api/scenarios`: every folder holding a `scenario.json`, with its title, counts and a thumbnail.
- `GET /api/scenarios/<root>/<folder>`: the scenario, `plan.json` and `record.json`, the last build status (with the model's fingerprint and the plan's problems) and the generated view data. It reruns the build first when `scenario.json` or the scripts are newer than `generated/`, so a scenario edited by hand or by an agent is rebuilt when it is opened, and re-checks the investigation alone when only `plan.json` or `record.json` changed.
- `PUT /api/scenarios/<root>/<folder>`: saves an edited scenario (see [Editing](#editing)); 409 when the file changed on disk, 422 with the build's errors when it refuses the scenario.
- `POST /api/scenarios/<root>/<folder>/record`: `{ op: "add", list, entry }` adds an observation, instruction or result to `record.json` (the server numbers it: `O1`, `I1`, `R1`...), `{ op: "void", list, id, reason }` voids one; the build checks the record before it replaces the file (422 otherwise). The server never writes `plan.json`.
- `GET /api/scenarios/<root>/<folder>/etags`: a version of each of the three files, which the page polls to pick up the agent's changes. It reloads `scenario.json` too when nothing is waiting to be saved; otherwise the next save reports the conflict.
- `GET /files/<root>/<folder>/<path>`: a file in the scenario folder (photos, generated data, exports, documents).
- Everything else: the built app (`STATIC_DIR`, `web/dist`).

**The app** ([`web/src/`](web/src/)) opens `?s=<root>/<folder>` and lists the scenarios without it:

| Path in `web/src/`    | What it is                                                                                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main.tsx`            | Opens the scenario in the URL, or the scenario browser (`ScenarioBrowser.tsx`)                                                                                                |
| `model.ts`            | The scenario's types, what the page derives from it, and the edit helpers (`setConnection`...)                                                                                |
| `investigation.ts`    | The plan's and the record's types, walking the tree, matching readings to answers (as `investigation.py`)                                                                     |
| `store.tsx`           | The scenario being edited, undo and redo, the autosave, the plan and the record, selection and preferences                                                                    |
| `investigate/`        | The step card, the test dialog, notes, the open questions panel, and the shared tags and fields                                                                               |
| `board/`              | The board panels' content: the lists, photos and their overlays, details, the 3D scene, the editor's operations                                                               |
| `schematic/layout.ts` | Schematic layout rules (same as `schematic.py`), used by the schematic editor                                                                                                 |
| `tabs/`               | Block diagram, schematic (KiCad export and layout editor), the investigation's panels, Repair log                                                                             |
| `workspace/`          | The workspace (dockview): the panel catalogue and component map, layouts and their storage, the sidebar and scenario picker, the editor's controls and save status, the theme |
| `components/ui/`      | shadcn/ui components (new-york style, neutral theme), copied in as source                                                                                                     |

three.js is in its own chunk, loaded the first time a 3D panel opens.

## Docker

The [`Makefile`](../Makefile) at the repository root builds and runs everything in Docker. It needs only Docker: no Node.js or Python on the host.

```sh
make build                            # build the image homestar-flux-app
make start                            # serve it at http://localhost:8080 (builds the image first if missing)
SCENARIOS=~/boards make start         # another scenarios folder (default: ./scenarios)
make stop                             # stop it
make dev                              # live reload at http://localhost:5173 (DEV_PORT to change it); Ctrl-C to stop
make check SCENARIO=scenarios/my-board  # validate a scenario and regenerate its outputs
```

`make start` mounts the scenarios folder into the container, writable, and runs it as your user so the files it writes are yours. `PORT`, `IMAGE` and `CONTAINER` can be overridden too. After changing the app, `make build` again.

[`Dockerfile`](Dockerfile) stages, with the repository root as the build context ([`.dockerignore`](../.dockerignore) sends only `app/`):

1. **web** (`node:22-bookworm-slim`): `npm ci` and `npm run build` in `web/`, which gives `web/dist/`.
2. **base** (`python:3.13-slim` with the packages from [`scripts/requirements.txt`](scripts/requirements.txt), plus the `node` binary).
3. **serve** (the default): the scripts, the schema, the server and `web/dist`, serving on port 8080.

**`make dev`** runs the `dev` stage with the repository mounted: the server on port 8787 (restarted when `server/` changes) and the Vite dev server on 5173, which hot reloads `web/src` and forwards `/api` and `/files` to the server. Edits to the Python scripts apply the next time a scenario is opened. Without Docker: `node server/server.mjs` with `PORT=8787 STATIC_DIR=` (and `PYTHON` pointing at a Python with the requirements), and `npm run dev` in `web/`.

## Build and checks

```sh
python -I scripts/build.py ../scenarios/homestar-flux           # validate and generate one scenario
python -I scripts/build.py ../scenarios/homestar-flux --check   # validate only
scripts/build.sh ../scenarios/homestar-flux                     # plus the KiCad export and checks (needs Docker)
```

`build.sh` regenerates the outputs, then uses `kicad-cli` 9.0.9 (Docker image `kicad/kicad:9.0`) to export the schematic's SVG (`exports/schematic.svg`), round-trip its netlist (the netlist KiCad derives from the generated schematic must match the scenario's nets) and run the electrical rules check (ERC); the reports land in `generated/kicad/`.

The browser tests ([`tests/`](tests/)) serve a copy of `scenarios/homestar-flux` in a temporary folder with the real server ([`tests/server.mjs`](tests/server.mjs)), so they can edit it freely. They need the built app (`npm run build` in `web/`), a Python with the requirements (`PYTHON`) and Chrome or Chromium (`CHROME`):

- **2D viewer and editors** ([`tests/ui-test.mjs`](tests/ui-test.mjs)), 98 checks with no JavaScript errors:
  - **Scenarios:** the browser lists the scenarios and opens one.
  - **Viewer:** the default layout, net and part highlighting (power nets left out of a part's neighbours), the confidence chips' tooltips, search, the diagram and schematic panels, and block selection.
  - **Board panels:** the type column, type and side filters, the known-nets switch, sorting both ways, reset, the bottom photo's 180° turn, Ctrl + scroll zoom at the pointer, drag to pan (without selecting), scroll to pan when zoomed, **Fit**, a 3D panel beside the photos, the 2D panel's two switches (raw both sides without an overlay, aligned keeping the sides, an overlay turning back into both sides in raw, one aligned side alone), the aligned view (both sides mapped, the bottom flipped to read, the overlay, a quarter turn of the whole view, moving a box there).
  - **Workspace:** a group's **+** adds a panel (two of the same kind), split right gives an empty group that adds a panel, maximize and restore, close a group, a sidebar row reveals its panel and its **+** opens another, the layout kept after a reload, the sidebar folded to a rail (kept), an empty workspace still opens panels, a double-click on a list row showing its details, a layout preset, the scenario picker.
  - **Board editor:** draw a trace, name it, drag a point, move a box (on both photos, including the turned one), change a connection, undo and redo; rename the scenario; rename a part and change its value, type, package and pins; add and delete a part; rename and delete a net.
  - **Investigate:**
    - the plan opens on its first step, the open questions show the step that settles each, and the answer waits for the set-up to be ticked;
    - readings preselect the matching answer (one reading, then four), saved results move along the tree, and their effects update the parts and suspects at once;
    - the page and `investigation.py` agree on the current step;
    - a sweep item is tested in the dialog, and an earlier step shows its answer;
    - a disputed step, a new instruction and a voided result each ask for an update;
    - the timeline is newest first, and an instruction waits for its reply;
    - a new `plan.json` written on disk is picked up with the reply;
    - a model change makes the plan out of date and undoing it makes it current;
    - a part is tested outside the plan, the parts table's Tested column shows the outcomes and its button opens the test, the export has the results, and **Edit part** opens the editor.
  - **Saving:** the file on disk matches the page after the autosave, the build reads the same nets from it as the page shows, the edits survive a reload, an edit the build refuses is reported and not written, and a change made on disk by something else is not overwritten.
  - **Schematic editor:** open clean, drag U4 (wires follow, layout stays valid), draw a wire to a pin with no net (problems reported), the one-click fix, place a power symbol (valid again), and the saved layout is accepted by the build.
- **The investigation logic** ([`tests/test_investigation.py`](tests/test_investigation.py), no browser):
  - reading parsing and answer matching;
  - walking the tree: answers, skips, the latest result, void results, disputed steps, sweeps;
  - derived suspects and part states, the fingerprint, renames through `formerly`;
  - the plan checks: broken references, loops, unreachable steps, missing instruments;
  - the reasons for an update;
  - the `plan-investigation` skill's protocol library.
- **Photo alignment** ([`tests/check_align.py`](tests/check_align.py)): aligns the example's photos automatically and checks the result against its hand-picked points (mean under 1.2 mm, worst under 2.6 mm).
- **3D panel** ([`tests/ui3d-test.mjs`](tests/ui3d-test.mjs), software WebGL), 11 checks: the scene renders in its panel, clicking U4 in the scene selects it, net selection and an open question's **Show on board** light the right parts (3D stays in front), the panel is kept after a reload, the views switch, `M+` lights only its traced copper, and the trace and enhanced-photo toggles work. No JavaScript errors.
