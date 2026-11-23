# AGENTS.md

Guidance for coding agents working in this repository. Read this first, then [README.md](README.md), [app/README.md](app/README.md), [docs/scenario-format.md](docs/scenario-format.md) (the three files of a scenario) and [docs/architecture.md](docs/architecture.md) (what calls what).

## What this repo is

A tool for repairing circuit boards, in `app/`. Each board is a **scenario**, one folder holding three files and the photos they refer to:

- `scenario.json`: the board, with its parts, pins and nets, the confidence and evidence of every connection, open questions, photos, 3D geometry and the user's instruments;
- `plan.json`: the investigation plan, written by an agent;
- `record.json`: the user's observations, instructions and results.

**The agent drives the diagnosis, through skills; the app is only an interface.** The app (served by `make start`) lists the scenario folders and opens one at a time. It saves edits to the model in `scenario.json`, walks the user through `plan.json`, and appends what they enter to `record.json`. The build generates, per scenario, a netlist, a block diagram, a KiCad schematic, an investigation report and the viewer's data (2D photos, 3D board).

- **`scenarios/homestar-flux/`** is a real repair in progress: a Sega Toys Homestar Flux planetarium that resets when its motor starts.
  - Its `plan.json` and `record.json` are the record of truth for that diagnosis (prime suspect: U4, an MX08L motor driver). `docs/repair-log-v1.md` keeps the log from before the three-file format.
  - When asked about that repair, run `python -I app/scripts/investigation.py status scenarios/homestar-flux`, and read its `README.md`, `plan.json` and `record.json`.
  - Everything runs off a 5 V adapter. Advise against pressing Move or Shooting Star repeatedly until the fault is isolated.
- **`scenarios/`** holds every scenario, one folder each, committed with the repository. Two skills drive the work on them:
  - `new-scenario` creates a scenario from photos: `app/scripts/new_scenario.py` scaffolds the folder, and `photo_tools.py` draws coordinate grids and box overlays to place parts by eye.
  - `plan-investigation` writes and updates `plan.json` each round, with `app/scripts/investigation.py` `status`, `stamp` and `check`. Its reference material distils [docs/research/](docs/research/board-repair-diagnosis.md).

## Layout

| Path                                 | What it is                                                                                                                                                                                                                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                          | Overview and quick start                                                                                                                                                                                                                                                               |
| `Makefile`, `.dockerignore`          | Docker build, `make start` / `stop` / `dev` / `check`                                                                                                                                                                                                                                  |
| `docs/scenario-format.md`            | **The scenario format**: the three files, who writes what, the plan's tree, what the app derives, what the build checks                                                                                                                                                                |
| `app/schema/`                        | The three files' JSON Schemas (2020-12): `scenario`, `plan`, `record`                                                                                                                                                                                                                  |
| `.claude/skills/new-scenario/`       | The skill that builds a scenario from photos (asks, scaffolds, identifies, validates, then plans)                                                                                                                                                                                      |
| `.claude/skills/plan-investigation/` | The skill that writes and updates `plan.json`; `reference/` holds the process, step-writing rules and a protocol library                                                                                                                                                               |
| `app/scripts/`                       | `build.py` (validate a scenario, write its outputs), `investigation.py` (check and walk the plan, `status`/`stamp`/`check`), `align.py` (photo processing and the board frame), `schematic.py`, `board3d.py`, `scenario_json.py`, `new_scenario.py`, `photo_tools.py`, `migrate_v2.py` |
| `app/scripts/build.sh`               | `build.py` plus the KiCad export and checks for one scenario (`kicad/kicad:9.0` in Docker)                                                                                                                                                                                             |
| `app/server/`                        | The server: lists, serves and saves scenarios, serves the app (Node.js, no dependencies)                                                                                                                                                                                               |
| `app/web/`                           | The app: React 19, TypeScript, shadcn/ui, Tailwind CSS 4, three.js, built by Vite                                                                                                                                                                                                      |
| `app/tests/`                         | Headless browser tests against a temporary copy of the example                                                                                                                                                                                                                         |
| `app/Dockerfile`                     | Image build (app, then Python with Node.js)                                                                                                                                                                                                                                            |
| `scenarios/homestar-flux/`           | A scenario: `scenario.json`, `plan.json`, `record.json`, photos, manuals, `exports/` (with `investigation.md`)                                                                                                                                                                         |
| Per scenario, generated              | `exports/` (committed with the scenario) and `generated/` (a cache, ignored by git)                                                                                                                                                                                                    |

`app/README.md` documents the format, the viewer, the editors, the server, the schematic rules and the checks in detail.

## Decisions

### Workflow

- **Work on `main` directly.** The owner asked for commits and pushes straight to `main` for this repo. Push only when asked.
- **One commit per ask.** Commit every change as soon as it is done, one commit for each request from the owner, so any one of them can be reverted on its own. Don't mix two asks in one commit, and include the regenerated outputs (such as a scenario's `exports/`) built from that change alone. A large ask may be split into a series of working commits, each building and passing the tests.
- **Commit style:** conventional prefixes, mostly `feat: ...` (also `docs:`, `chore:`). Explain the why in the body.
- **Do not delete remote branches.** A stale `agent/retrace-photo-analysis` branch remains on the remote; the owner will remove it.
- **Writing style for every doc and message:** never use em dashes (use a full stop or a comma instead). Documentation is Markdown, never Word files. Markdown files are formatted with Prettier (`npx prettier@3 --write <file>.md`), which aligns the tables.

### Scenarios

- **Three files, one writer each.**
  - `scenario.json` (the board) is written by the agent at creation, then edited by the user in the app (autosave). An agent changes it later only where a result proves something or an instruction asks for it, edits it in place, and lists every change in the plan's history.
  - `plan.json` is the agent's: the app never writes it.
  - `record.json` is the user's, add-only: the app appends entries through the server, which numbers them. Nothing edits or deletes an entry; a wrong one is voided. The agent writes it only when creating a scenario.
  - Never hand-edit `exports/` or `generated/`; they are rebuilt from the three files.
  - To change a scenario by hand or as an agent, edit its file and run `python -I app/scripts/build.py <folder>` (or `make check SCENARIO=<folder>`). The server also rebuilds a scenario whose files are newer than its `generated/` when it is opened.
- **The app has no intelligence.** It walks the plan's tree along the user's answers, preselects an answer when a reading falls in a range the plan gives, and shows the effects the plan wrote for each answer. It decides nothing else. Diagnostic knowledge goes into the `plan-investigation` skill and its reference, never into `web/src/`.
- **The plan is a tree.** Every answer names the next step, and every branch ends in a `replan` step (the agent's next round) or `done`. A step keeps its id and its answers' ids across revisions while results point at it. `python -I app/scripts/investigation.py stamp <folder>` records what the plan was based on (the model's fingerprint, the last record ids) and checks it strictly. The page flags the plan as out of date when the model changed, the user wrote a new observation or instruction, voided an entry, disputed a step, or reached a `replan` step.
- **The format is the spec and the schemas.** [docs/scenario-format.md](docs/scenario-format.md) is the reference. Any new field goes into it, the matching schema in `app/schema/` (with a description), `web/src/model.ts` or `web/src/investigation.ts`, and, if the build uses it, `build.py` or `investigation.py`. The schemas reject unknown fields, so typos fail loudly. `investigation.py` and `investigation.ts` walk the tree the same way: change both, and the 2D test checks they agree.
- **One file layout:** the three files are written with two-space indent and arrays of plain values on one line, by `app/server/scenario-json.mjs` and `app/scripts/scenario_json.py` alike. Keep the two identical, so a saved file only differs where its content does.
- **Every connection has a confidence level:** `measured` > `confirmed` > `photo` > `datasheet` > `assumed` (the names are fixed; a scenario words their meaning). A net is only as certain as its weakest connection. Only promote a connection with evidence, and record that evidence in the connection's `evidence` field. A meter check becomes `measured`. A placement-only guess is `assumed`, not `photo` (the example's 2026-11-08 audit downgraded four such links).
- **Pins not on any net are unknown, not unconnected.** The schematic leaves them open, and the viewer draws a part with no known connection as a dashed box.
- **The photos are processed by the build** (`align.py`, OpenCV): background removed, perspective corrected, both sides aligned in one board frame (the board from the top, in mm), shared by the Aligned and 3D views. Automatic by default (segmentation by solder-mask colour, shape alignment, refined on holes and pads; the bottom is always the mirror of the top), or from hand-picked points when the geometry has them. Results are cached in `generated/aligned/`; bump `ALGO` when the processing changes. `tests/check_align.py` guards its accuracy on the example.
- **Photo coordinates are always in the original file's pixels**, even for a photo shown turned (`display_rotation: 180`); the page converts them to and from the screen.
- **The schematic rules live in two places, and must stay in sync:** `schematic.py` (`analyse`, `prune_conflicts`) and `web/src/schematic/layout.ts`. The 2D test checks that the build accepts the layout the editor saves, and that it reads the same nets from the saved file as the page shows.
- **Schematic:** every known connection is drawn. Signal nets are wired, and a wire's colour is its weakest confidence (solid when verified, dashed when `datasheet` or `assumed`). Power nets use power symbols. The build refuses a layout that joins two nets, runs diagonally or through a pin, ends mid-wire, leaves a power group without a symbol, or makes two pins touch.

### The app and the server

- **Saving:** the page PUTs the whole scenario a moment after each edit; the server writes it to a temporary file, runs `build.py` on it, and replaces `scenario.json` only when the build accepts it (else 422 with the errors, shown as "Not saved"). It refuses to overwrite a file that changed on disk since the page loaded it (409, "Changed on disk"), so an agent editing `scenario.json` while the app is open is safe. Undo and redo are in the page; they cover the model, not the record. A plan that no longer matches the model never blocks a save: its problems are reported apart.
- **The record** goes through `POST /api/scenarios/<id>/record`, one entry at a time, checked by `build.py --investigation` before the file is replaced. The page polls the three files' versions every 3 seconds and picks up the agent's `plan.json`, and its `scenario.json` edits when nothing is waiting to be saved.
- **The server has no dependencies** (Node.js built-ins only) and runs the Python scripts as subprocesses, one at a time per scenario. Scenario ids are `<root>/<folder>`; files are served only from inside a scenario folder.
- **React + shadcn/ui** (new-york style), with Kandev's palette in light and dark. The theme follows the system by default, and a menu at the bottom of the sidebar switches it. shadcn components are copied into `web/src/components/ui/` and may be adapted (for example, `Table` takes a `containerClassName`). Use shadcn dialogs, not `window.confirm` or `window.prompt`.
- **The page is a workspace of panels** (dockview, after Kandev's workbench: `web/src/workspace/`). Every view is a panel kind in `catalog.ts`, any number of each can be open, and the user arranges them; three presets give a starting layout. Panels share the store (selection, filters, the scenario); a panel's own settings (what a 2D panel shows: raw or aligned photos, and which sides, both or an overlay) are its dockview parameters. Links between views go through `workspace/api.ts` (`reveal`, `revealBoard`), never by switching a tab. The sidebar and the scenario picker follow Kandev's too. The editor's controls live in the panels they apply to (the 2D panels, the Details panel), not in a page-wide bar, and so do the palette and font (`index.css`): use the theme tokens (`primary`, `success`, `warning`, `destructive`, `muted`), not raw colours, and `muted` for hovers.
- **2D is the reference and the only place to draw.** The 3D panel is built from the photos when the scenario was last saved, and only when it has a `geometry` section; three.js loads with the first 3D panel.
- **Browser preferences** (theme, the sidebar's state, sort, filters) are kept in localStorage under `pcbmodel-ui`, and the panels' arrangement under `pcbmodel-layout`. Nothing about a scenario is kept in the browser.
- **Tests rely on DOM ids and `data-*` attributes** (`#parts tr[data-ref]`, `#nets li[data-net]`, `.box[data-ref]`, `[data-nav]`, `[data-add]`, `[data-group-*]`, `[data-scenario]`, `#detail`, `#savestatus`, and so on) and on the `window.__editor` hooks in `TestHooks.tsx` and `window.__ws` (the workspace, `workspace/api.ts`). The browser tests run on frozen copies of the example's three files (`app/tests/fixtures/`), so the real repair can move on; refresh them when the format changes. Keep them when changing the UI, or update the tests in the same change.
- **Avoid layout shifts during drags.** Text that appears or changes while a box, point or part is being dragged must not move the canvas (the save status sits in the sidebar's footer, away from the panels, for this reason).

### Build and deployment

- **`make build` / `make start` / `make stop`**, at the root, build one image (the app, the server, Python and Node.js) and serve it at http://localhost:8080, bound to 127.0.0.1, with `scenarios/` (or `SCENARIOS=…`) mounted writable and the container running as the host user. `PORT`, `IMAGE` and `CONTAINER` can be overridden. Only Docker is needed on the host. **`make dev`** runs the server (8787) and the Vite dev server (5173, hot reload, forwarding `/api` and `/files`) from the Dockerfile's `dev` stage with the repository mounted.
- **KiCad stays out of the image.** Only `app/scripts/build.sh` runs `kicad-cli`, to refresh a scenario's `exports/schematic.svg`, round-trip the netlist and run the electrical rules check (ERC).
- **Builds are deterministic:** rebuilding a scenario with no changes gives byte-identical `exports/` and `generated/`, and rebuilding the app gives byte-identical `web/dist/`.

### Tried and dropped

- **Automated photo analysis did not work on the example board.** re:trace (general-purpose YOLO detector, bare-copper trace finder) found no parts and no real traces. A PCB-trained YOLO26 detector found most parts but mistyped the through-hole ones, called U4 a diode, and added nothing new. Both evaluations were deleted, and the example's observations O11 and O12 record the outcome. Connections come from close-up photos, by eye, and from meter checks.
- **A probabilistic next-test engine was considered and left out.** The research ([docs/research/](docs/research/board-repair-diagnosis.md)) describes scoring every test by probability per cost, but its update factors have no evidence behind them on a reverse-engineered board. The plan's order follows explicit rules (safety, power off first, cheap and safe first), written by the agent, so every step can say why it is asked.

## Commands

```sh
make start                                    # Docker: serve the app at http://localhost:8080 (make build after app changes)
make stop
make dev                                      # Docker: live reload at http://localhost:5173 (Ctrl-C to stop)
make check SCENARIO=scenarios/homestar-flux    # Docker: validate a scenario and regenerate its outputs

# without Docker (Python 3.10+ with app/scripts/requirements.txt, Node.js 20.19+)
python -I app/scripts/build.py scenarios/homestar-flux   # validate and generate (--check: validate only)
app/scripts/build.sh scenarios/homestar-flux             # plus the KiCad export and checks (needs Docker)
cd app/web && npm ci && npm run build                   # the app, into web/dist
PYTHON=/path/to/python node app/server/server.mjs       # serve it at http://localhost:8080

# checks (from app/tests, after: npm i puppeteer-core@23; build the app first)
CHROME=/path/to/chrome PYTHON=/path/to/python node ui-test.mjs     # scenarios, panels and workspace, editors, saving, investigation, repair log: 98 checks
CHROME=/path/to/chrome PYTHON=/path/to/python node ui3d-test.mjs   # 3D panel: 11 checks
python -I app/tests/check_align.py                                 # from the root: automatic photo alignment accuracy
python -I app/tests/test_investigation.py                          # from the root: the plan's tree, checks, fingerprint, protocol library

# the investigation, for the agent (from the root)
python -I app/scripts/investigation.py status scenarios/<id>   # where it stands, what changed since the plan
python -I app/scripts/investigation.py stamp scenarios/<id>    # after writing plan.json: set based_on, format, check
```

Run the two browser tests and `test_investigation.py` after any change to the app, the server, `build.py`, `investigation.py`, `schematic.py` or the schemas. They serve a temporary copy of `scenarios/homestar-flux` with the real server, so they never touch the committed example.
