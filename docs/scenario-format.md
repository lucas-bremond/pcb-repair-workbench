# Scenario folder format, version 2

This is the specification of a scenario folder: what the skills generate, what the app displays and what it writes back. The JSON Schemas in `app/schema/` (`scenario.schema.json`, `plan.schema.json`, `record.schema.json`) check it, `app/scripts/investigation.py` and `app/web/src/investigation.ts` implement it, and `app/scripts/migrate_v2.py` converts a version 1 scenario.

The examples borrow names from the Homestar Flux scenario, but their values, part lists and step ids are illustrative, not that board's real data.

## Principles

1. **One folder is one scenario.** It holds everything the app shows: the photos and documents, the board model, the investigation plan and the record of what was done.
2. **Three files are the source of truth**, one per writer: `scenario.json` (the board), `plan.json` (the agent's analysis) and `record.json` (what the user did and said). Everything under `exports/` and `generated/` is rebuilt from them by `build.py` and is never edited.
3. **The agent reasons, the app displays.** Skills write the model, the test procedures, the plan and the conclusions. The app shows them, lets the user correct the model, and records answers. The only things the app computes are lookups: which branch an answer selects, whether a number falls in a range the plan gives, and which result is the latest for a step.
4. **The record is add-only.** A result, an observation or an instruction is never edited or deleted. A wrong one is voided, and results outlive the plan steps that asked for them.
5. **Every expectation says where it comes from**, as every connection already says how sure it is.

## The folder

```
scenarios/<id>/
  scenario.json            the board: its description, the instruments, the model
  plan.json                the agent's analysis: procedures, suspects, the tree of steps
  record.json              the user's record: observations, instructions, results
  README.md                a human introduction: the device, the fault, the files
  photos/
    <top>.jpg              one straight-on photo per side (named in "photos")
    <bottom>.jpg
    parts/                 close-ups
    notes/                 photos attached to observations and results
  docs/                    manuals and datasheets
  exports/                 rebuilt by the build, committed with the scenario
    netlist.md
    block-diagram.svg
    schematic.kicad_sch
    schematic.svg          (only by build.sh, with KiCad)
    investigation.md       the plan, the results and the timeline, readable without the app
  generated/               rebuilt by the build, a cache ignored by git
    view.json              what the 2D and aligned views need
    model3d.json           the 3D board
    aligned/               the cut-out, straightened photos
    photos/, textures/     resized photos
    status.json            build messages and the model fingerprint (see "Fingerprint")
    plan-base.json         the model as it was when the plan was written (see "Fingerprint")
```

`exports/investigation.md` replaces `exports/repair-log.md`.

## Who writes what

| File            | Holds                                                         | Written by                                 | In the app          |
| --------------- | ------------------------------------------------------------- | ------------------------------------------ | ------------------- |
| `scenario.json` | `board`, `instruments`, and the model                         | the agent first, then the user corrects it | editable, with undo |
| `plan.json`     | procedures, findings, suspects, assessment, the tree of steps | the agent only                             | read-only           |
| `record.json`   | `observations`, `instructions`, `results`                     | the user, through the app                  | add only (and void) |

The app never writes `plan.json`, and the agent never writes `record.json` after it has created the scenario. This is what makes it safe for both to work on the same folder at the same time.

Rules for the agent at each update round:

- **`record.json`:** it reads all of it and changes nothing.
- **`scenario.json`:** it changes only what a result proves or what an instruction asks for, and says so in the plan's history. For example, a continuity result promotes a connection to `measured`, with the result's id as its evidence. It edits the file in place, so an edit the user saved meanwhile is not overwritten.
- **`plan.json`:** it rewrites the file.

How the app saves:

- **`scenario.json`:** the whole file a moment after each edit, as today. The server validates it and refuses to overwrite a file that changed on disk.
- **`record.json`:** one entry at a time, appended by the server.
- **`plan.json`:** never. The page reloads it when it changes on disk.

A scenario without `plan.json` or `record.json` is valid: the app shows the model and says no plan has been made yet.

Unknown fields are rejected in all three files.

## Identifiers

| Thing       | Form                                                    | Rule                                                            |
| ----------- | ------------------------------------------------------- | --------------------------------------------------------------- |
| Part        | the designator (`U4`, `C7`, `J_DCP`)                    | as today                                                        |
| Net         | a name (`+5V`, `U4_VDD`)                                | as today                                                        |
| Observation | `O1`, `O2`, ...                                         | numbered in order, never reused                                 |
| Instruction | `I1`, `I2`, ...                                         | numbered in order, never reused                                 |
| Result      | `R1`, `R2`, ...                                         | numbered in order, never reused                                 |
| Suspect     | `S1`, `S2`, ...                                         | stable across plan revisions                                    |
| Finding     | `F1`, `F2`, ...                                         | stable across plan revisions                                    |
| Step        | lowercase words with dashes (`rail-5v-to-gnd`)          | stable across plan revisions; never reused for a different step |
| Protocol    | lowercase words with dashes (`diode`, `rail-to-ground`) | stable                                                          |

A **target** names what a step, a result or a note is about. It always has the same shape, with exactly one of its three fields:

```jsonc
{ "ref": "C7" }                               // a part
{ "net": "+5V" }                              // a net
{ "pins": [["U4", "4"], ["C7", "1"]] }        // two points
```

**Renames.** `plan.json` and `record.json` keep the names they were written with. When the user renames a part or a net, the app adds the old name to that part's or net's `formerly` list in `scenario.json`, and every lookup goes through it. A target whose part was deleted is shown as removed. The agent brings `plan.json` up to the current names at its next update.

## `scenario.json`: the board

```jsonc
{
  "format": "pcb-scenario",
  "version": 2,

  "board": { ... },
  "instruments": [ ... ],

  "confidence": { ... },     // the model: unchanged from version 1
  "photos": { ... },
  "parts": { ... },
  "nets": { ... },
  "traces": [ ... ],
  "power_nets": [ ... ],
  "blocks": { ... },
  "links": [ ... ],
  "open_questions": [ ... ],
  "geometry": { ... },
  "schematic_order": [ ... ],
  "schematic_layout": { ... },
  "schematic": { ... }
}
```

Required: `format`, `version`, `board`, `confidence`, `photos`, `parts`, `nets`.

### `board`

Unchanged: `title`, `name`, `marking`, `description` (the device and the fault, in a sentence or two), `model_date`.

### `instruments`

What the user has on the bench. The agent writes only steps that these instruments can carry out, and says in the plan what a missing instrument would have settled.

```jsonc
"instruments": [
  { "kind": "multimeter", "model": "Fluke 117", "notes": "no capacitance range; diode test up to 2 V" },
  { "kind": "bench_supply", "model": "30 V 5 A", "notes": "current limit adjustable from 10 mA" }
]
```

| Field   | Required | Meaning                                                                                                                                                                                                     |
| ------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kind`  | yes      | One of `multimeter`, `bench_supply`, `usb_meter`, `esr_meter`, `lcr_meter`, `component_tester`, `oscilloscope`, `thermal_camera`, `magnifier`, `soldering_iron`, `hot_air`, `freeze_spray`, or another word |
| `model` | no       | Make and model                                                                                                                                                                                              |
| `notes` | no       | Limits that matter (ranges, modes it lacks)                                                                                                                                                                 |

### The model

`confidence`, `photos`, `parts`, `nets`, `traces`, `power_nets`, `blocks`, `links`, `open_questions`, `geometry`, `schematic_order`, `schematic_layout` and `schematic` keep their version 1 definitions, with three additions:

- **`formerly`** on a part and on a net: the names it had before (see "Renames").
- **A connection's `evidence` can cite a result**, written as its id (`"R12: 0.3 Ω between U4 pin 4 and C7 +"`). Only such a connection is `measured`.
- **Parts carry no status field.** A part's state (untested, cleared, suspect, faulty) is derived from the plan and the results (see "What the app derives").

## `record.json`: what the user did and said

```jsonc
{
  "format": "pcb-record",
  "version": 2,
  "observations": [ ... ],
  "instructions": [ ... ],
  "results": [ ... ]
}
```

The three lists are add-only. An entry's fields do not change after it is saved, except `void`:

```jsonc
"void": { "date": "2026-11-22", "reason": "Measured C8, not C7." }
```

A void entry stays in the file, is shown struck through, and counts for nothing. Voiding one counts as new evidence for the agent.

### `observations`

What the user saw, did or knows, in their own words: the symptoms, the device's history, things tried before the plan existed, and anything noticed along the way. They are facts for the agent to reason from.

```jsonc
"observations": [
  { "id": "O1", "date": "2026-11-05", "text": "Pressing Move resets the unit: the lamp goes back on and the timer LED goes off." },
  { "id": "O2", "date": "2026-11-05", "text": "Same reset with a second 5 V adapter.", "about": [{ "ref": "J_DCP" }] },
  { "id": "O7", "date": "2026-11-22", "text": "C7's top looks slightly domed.", "about": [{ "ref": "C7" }],
    "step": "inspect-capacitors", "photos": ["photos/notes/c7-top.jpg"] }
]
```

| Field    | Required | Meaning                                       |
| -------- | -------- | --------------------------------------------- |
| `id`     | yes      | `O<n>`                                        |
| `date`   | yes      | `YYYY-MM-DD`                                  |
| `time`   | no       | `HH:MM:SS`, local: orders a day's entries     |
| `text`   | yes      | Markdown                                      |
| `about`  | no       | Targets, linked to the board                  |
| `step`   | no       | The plan step the user was on when writing it |
| `photos` | no       | Paths inside the scenario folder              |
| `void`   | no       | See above                                     |

### `instructions`

What the user asks of the agent for its next round: a direction to take, a constraint, a doubt about the model to resolve, a question. They are requests, where observations are facts.

```jsonc
"instructions": [
  { "id": "I1", "date": "2026-11-22", "text": "Do not plan anything that needs desoldering until every power-off check is done." },
  { "id": "I2", "date": "2026-11-22", "text": "I added C12 next to U2. Re-read U2's marking on the close-up: I think it is a regulator, not a logic chip.",
    "about": [{ "ref": "U2" }, { "ref": "C12" }] },
  { "id": "I3", "date": "2026-11-23", "text": "Why is C7 a suspect if it measures fine?", "about": [{ "ref": "C7" }], "step": "c7-rail-check" }
]
```

| Field   | Required | Meaning                                       |
| ------- | -------- | --------------------------------------------- |
| `id`    | yes      | `I<n>`                                        |
| `date`  | yes      | `YYYY-MM-DD`                                  |
| `time`  | no       | `HH:MM:SS`, local: orders a day's entries     |
| `text`  | yes      | Markdown                                      |
| `about` | no       | Targets, linked to the board                  |
| `step`  | no       | The plan step the user was on when writing it |
| `void`  | no       | Withdraws the instruction                     |

The agent reads every instruction that is not void at every round, so a constraint such as `I1` stays in force until the user voids it. It answers each new one in the plan's history (see "History"), and the app shows that answer under the instruction.

### `results`

Every answer the user gives to a step is one result. This is the single record of tests: the plan's steps and the "Test this part" button both write here. It replaces version 1's `tests`.

```jsonc
"results": [
  { "id": "R6", "date": "2026-11-21", "plan_revision": 2,
    "step": "rail-5v-to-gnd", "target": { "net": "+5V" }, "protocol": "rail-to-ground",
    "conditions": { "power": "off", "in_circuit": true },
    "readings": { "ohms": "OL" },
    "answer": "ok", "outcome": "pass",
    "effects": { "parts": [{ "refs": ["C3", "C4", "C9"], "status": "cleared", "of": "short" }], "suspects": { "S2": "ruled_out" } } },

  { "id": "R9", "date": "2026-11-21", "plan_revision": 2,
    "step": "diode-sweep", "item": "D2", "target": { "ref": "D2" }, "protocol": "diode",
    "conditions": { "power": "off", "in_circuit": true },
    "readings": { "fwd": "0.61", "rev": "OL" },
    "answer": "good", "outcome": "pass" },

  { "id": "R15", "date": "2026-11-22",
    "target": { "ref": "R5" }, "protocol": "resistor",
    "conditions": { "power": "off", "in_circuit": false },
    "readings": { "ohms": "4.68k" },
    "answer": "good", "outcome": "pass", "notes": "Lifted one leg to be sure." },

  { "id": "R16", "date": "2026-11-22", "plan_revision": 3,
    "step": "u4-out-to-rails", "target": { "ref": "U4" },
    "outcome": "disputed", "notes": "The plan says pin 8 is OUTA, but the trace from pin 8 goes to the LED." }
]
```

| Field           | Required | Meaning                                                                                                                    |
| --------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| `id`            | yes      | `R<n>`                                                                                                                     |
| `date`          | yes      | `YYYY-MM-DD`                                                                                                               |
| `time`          | no       | `HH:MM:SS`, local: orders a day's entries                                                                                  |
| `plan_revision` | no       | The plan's revision when the result was entered (absent for a test outside the plan)                                       |
| `step`          | no       | The step answered. Absent for a test made with "Test this part"                                                            |
| `item`          | no       | For a sweep: the item's id                                                                                                 |
| `target`        | yes\*    | What was tested, copied from the step or the item, so the result stands on its own. \*Optional when the step has no target |
| `protocol`      | no       | The protocol followed                                                                                                      |
| `conditions`    | no       | `power` (`off`, `on`), `in_circuit` (true, or false when the part was lifted), `notes` (anything else about the state)     |
| `readings`      | no       | Each reading as typed, by its key                                                                                          |
| `answer`        | no       | The id of the answer chosen (absent for the built-in answers)                                                              |
| `outcome`       | yes      | `pass`, `fail`, `inconclusive`, `not_done`, `disputed` or `skipped`                                                        |
| `effects`       | no       | The chosen answer's effects, copied at the time, so they survive the step                                                  |
| `notes`         | no       | The user's remarks                                                                                                         |
| `photos`        | no       | Paths inside the scenario folder                                                                                           |
| `supersedes`    | no       | The id of an earlier result this one replaces (the same step done again)                                                   |
| `void`          | no       | See above                                                                                                                  |

Rules:

- **Latest wins.** For a step (or a sweep item), the result in force is the latest one that is not void.
- **Results outlive steps.** When an update drops a step, its results stay. They remain in the part's history and in the timeline, and the agent has already folded what they proved into the plan's findings, suspects and assessment.

## `plan.json`: the agent's analysis

```jsonc
{
  "format": "pcb-plan",
  "version": 2,
  "revision": 3,
  "date": "2026-11-22",
  "based_on": { "model": "sha256:9f2c…", "observations": "O7", "instructions": "I2", "results": "R14", "voided": 1 },
  "summary": "The adapter and the motor are ruled out. The reset comes from the motor driver's side: U4 or its supply capacitor C7. Next: U4's pins with power off.",
  "warning": "Do not press Move or Shooting Star more than the plan asks: each press pushes current through whatever has failed.",
  "findings": [ ... ],
  "suspects": [ ... ],
  "assessment": { ... },
  "protocols": { ... },
  "phases": [ ... ],
  "start": "safety",
  "steps": { ... },
  "history": [ ... ]
}
```

| Field        | Required | Meaning                                                                                                                              |
| ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `revision`   | yes      | Starts at 1, plus one at each update                                                                                                 |
| `date`       | yes      | When this revision was written                                                                                                       |
| `based_on`   | yes      | What the agent had read: the model's fingerprint, the last observation, instruction and result ids (or null), and how many were void |
| `summary`    | yes      | Where the investigation stands and what the plan is about to establish                                                               |
| `warning`    | no       | A standing safety note, shown at the top of every step                                                                               |
| `findings`   | no       | What is established so far                                                                                                           |
| `suspects`   | no       | The possible causes, most likely first                                                                                               |
| `assessment` | no       | The state of each part, as of `based_on.results`                                                                                     |
| `protocols`  | yes      | The test procedures for this board                                                                                                   |
| `phases`     | yes      | The stages of the investigation, in order                                                                                            |
| `start`      | yes      | The id of the first step                                                                                                             |
| `steps`      | yes      | Every step, by id                                                                                                                    |
| `history`    | yes      | One entry per revision: what changed, why, and the answers to the user's instructions                                                |

### Findings, suspects, assessment

```jsonc
"findings": [
  { "id": "F1", "title": "Failure mode: brownout reset",
    "text": "Move and Shooting Star both switch the motor output on. Something then pulls the supply down far enough to reset the microcontroller.",
    "evidence": ["O1", "O3", "R4"] }
],
"suspects": [
  { "id": "S1", "title": "U4 (motor driver) has a shorted output stage", "parts": ["U4"], "mode": "short",
    "status": "open", "why": "The reset happens with the motor unplugged, so the current flows inside U4 or on its supply.",
    "evidence": { "for": ["R4"], "against": [] } },
  { "id": "S4", "title": "The motor", "parts": ["M1"], "mode": "short", "status": "ruled_out",
    "why": "Same reset with M+ disconnected.", "evidence": { "for": [], "against": ["O4"] } }
],
"assessment": {
  "C3": { "status": "cleared", "of": "short", "evidence": ["R6"] },
  "C7": { "status": "suspect", "of": "high ESR", "evidence": ["O7"], "note": "Cannot be cleared with a multimeter." },
  "D2": { "status": "ok", "evidence": ["R9"] }
}
```

- **Suspect `mode`:** `short`, `open`, `degraded` (drift, high resistance, high ESR), `dead` (does not function), `connection` (joint, connector, wire) or `other`.
- **Suspect `status`:** `open`, `ruled_out` or `confirmed`. The order of the array is the ranking.
- **Assessment `status`:** `ok` (tested, good), `cleared` (cleared of the failure named in `of`, not of others), `suspect`, `faulty`, or `untestable` (cannot be judged with the user's instruments). Parts not listed are untested.
- **`evidence`:** ids of results and observations.

### `protocols`

The test procedures for this board: how to test each kind of part present, and the net-level measurements, written by the agent for the instruments the user has. A step refers to a protocol and adds what is specific to its target. The app's "Test this part" button uses the same protocols for a test the plan did not ask for.

```jsonc
"protocols": {
  "diode": {
    "title": "Diode: junction test",
    "applies_to": ["diode"],
    "goal": "A diode conducts one way only. The meter's diode mode shows its forward voltage one way and OL the other.",
    "instruments": ["multimeter"],
    "power": "off",
    "steps": [
      { "text": "**Unplug the adapter.** Set the meter to diode mode." },
      { "text": "**Forward:** red probe on the anode, black on the cathode (the band).",
        "reading": { "key": "fwd", "label": "Forward", "unit": "V", "hint": "e.g. 0.62" } },
      { "text": "**Reverse:** swap the probes.",
        "reading": { "key": "rev", "label": "Reverse", "unit": "V", "hint": "OL" } }
    ],
    "expect": { "text": "0.5 to 0.8 V forward (0.15 to 0.45 V for a Schottky), OL reverse.", "basis": "rule_of_thumb", "source": "Fluke, How to test diodes" },
    "limits": "In circuit, a part in parallel can lower both readings. A low reading both ways needs one leg lifted to be sure.",
    "answers": [
      { "id": "shorted", "label": "Low and equal both ways", "outcome": "fail",
        "when": [{ "reading": "fwd", "max": 0.1 }, { "reading": "rev", "max": 0.1 }] },
      { "id": "open", "label": "OL both ways", "outcome": "fail",
        "when": [{ "reading": "fwd", "is": "OL" }, { "reading": "rev", "is": "OL" }] },
      { "id": "good", "label": "A junction one way, OL the other", "outcome": "pass",
        "when": [{ "reading": "fwd", "min": 0.15, "max": 0.9 }, { "reading": "rev", "is": "OL" }] },
      { "id": "unclear", "label": "Something else", "outcome": "inconclusive" }
    ]
  }
}
```

| Field         | Required | Meaning                                                                                                                                                                                                                  |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `title`       | yes      | Shown as the dialog's heading                                                                                                                                                                                            |
| `applies_to`  | no       | Part kinds it is for, or `["net"]`, `["pins"]` for net-level and two-point measurements. The app offers a part only the procedures for its kind and those without `applies_to` (or with it empty), such as an inspection |
| `goal`        | yes      | What the test establishes, in a sentence or two                                                                                                                                                                          |
| `instruments` | yes      | Instrument kinds needed; each must be in the scenario's `instruments`                                                                                                                                                    |
| `power`       | yes      | `off` or `on`: the board's state during the test                                                                                                                                                                         |
| `steps`       | yes      | In order: `text` (Markdown, one action) and an optional `reading`                                                                                                                                                        |
| `expect`      | no       | What a good result looks like (see "Expectations")                                                                                                                                                                       |
| `limits`      | no       | What this test cannot conclude                                                                                                                                                                                           |
| `answers`     | yes      | The possible answers (see "Answers"), without `next`                                                                                                                                                                     |

A **reading** is `{ "key", "label", "unit", "hint"?, "optional"? }`. `unit` is `Ω`, `V`, `A`, `F`, `°C` or empty. The user types readings as they see them (`4.7k`, `0.62`, `OL`), and they are stored as typed.

### Phases

```jsonc
"phases": [
  { "id": "safety", "title": "Safety and set-up", "goal": "The board is unpowered and the meter is known to read correctly." },
  { "id": "inspect", "title": "Look before measuring", "goal": "Find visible damage before any power is applied." },
  { "id": "power-off", "title": "Measurements with power off", "goal": "Find shorts and opens without risk." },
  { "id": "power-on", "title": "Measurements with power on", "goal": "Prove the supply rails." },
  { "id": "isolate", "title": "Isolate the faulty part", "goal": "Split the suspects until one remains." },
  { "id": "repair", "title": "Repair and verify", "goal": "Replace the part and prove the fault is gone." }
]
```

Phases group the steps for display (a progress bar, a table of contents). The agent chooses them; the six above are the usual ones.

### Steps

The steps form a tree: each step lists its possible answers, and each answer names the step that follows. The app starts at `start` and follows the answers the user gave.

```jsonc
"steps": {
  "rail-5v-to-gnd": {
    "phase": "power-off",
    "kind": "measure",
    "title": "Is the +5V rail shorted to ground?",
    "target": { "net": "+5V" },
    "protocol": "rail-to-ground",
    "probes": [
      { "lead": "red", "ref": "C3", "pin": "1" },
      { "lead": "black", "ref": "C3", "pin": "2" }
    ],
    "setup": ["The adapter is unplugged", "The power switch is ON", "Meter on Ω, leads checked"],
    "instruction": "Hold the probes on C3's two pads for five seconds and read the value once it stops moving.",
    "expect": { "text": "Climbs past 1 kΩ as the capacitors charge.", "basis": "rule_of_thumb", "source": "docs/research, rail-to-ground bands" },
    "why": "One reading clears every capacitor on +5V of a short: C3, C4 and C9. It does not clear a worn capacitor.",
    "risk": "none",
    "minutes": 2,
    "answers": [
      { "id": "short", "label": "Under 10 Ω and steady", "outcome": "fail",
        "when": [{ "reading": "ohms", "max": 10 }],
        "means": "Something on +5V is shorted to ground.",
        "effects": { "suspects": { "S2": "more_likely" } },
        "next": "split-5v-rail" },
      { "id": "low", "label": "10 Ω to 1 kΩ, steady", "outcome": "inconclusive",
        "when": [{ "reading": "ohms", "min": 10, "max": 1000 }],
        "means": "Lower than expected, but not a dead short.",
        "next": "replan-low-rail" },
      { "id": "ok", "label": "Over 1 kΩ, or climbing to OL", "outcome": "pass",
        "when": [{ "reading": "ohms", "min": 1000 }],
        "means": "+5V is not shorted.",
        "effects": { "parts": [{ "refs": ["C3", "C4", "C9"], "status": "cleared", "of": "short" }],
                     "suspects": { "S2": "ruled_out" } },
        "next": "rail-u4-vdd-to-gnd" }
    ]
  }
}
```

Fields common to every kind:

| Field         | Required | Meaning                                                                                                       |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `phase`       | yes      | A phase id                                                                                                    |
| `kind`        | yes      | `check`, `measure`, `sweep`, `action`, `replan` or `done` (see below)                                         |
| `title`       | yes      | The step as a question or an order, in one line                                                               |
| `target`      | no       | What the step is about (highlighted on the board)                                                             |
| `protocol`    | no       | A protocol id: the step shows that protocol's steps and readings                                              |
| `probes`      | no       | Where each lead goes: `{ "lead": "red" \| "black" \| "any", "ref", "pin" }` or `{ "lead", "net" }`            |
| `setup`       | no       | The state the board and the instruments must be in, each ticked before the action                             |
| `power`       | no       | `off` or `on`. Defaults to the protocol's, else `off`. Shown as a badge                                       |
| `warning`     | no       | A hazard and its consequence, shown before the instruction                                                    |
| `instruction` | no       | Markdown: what to do. Required when there is no `protocol`                                                    |
| `readings`    | no       | The values to enter, when there is no `protocol` (same shape as a protocol's reading)                         |
| `instruments` | no       | Instrument kinds needed. Defaults to the protocol's                                                           |
| `expect`      | no       | What a good result looks like for this target (overrides the protocol's)                                      |
| `why`         | yes      | Why the step is asked: what it separates or clears                                                            |
| `risk`        | no       | `none`, `low`, `medium` or `high`: the risk to the board                                                      |
| `minutes`     | no       | A time estimate                                                                                               |
| `question`    | no       | The id of the open question this step settles (`OQ1`)                                                         |
| `skip`        | no       | A step id: where to continue when the user skips this step. Without it, the step cannot be skipped            |
| `answers`     | yes\*    | The possible answers, each with the step that follows. Overrides the protocol's. \*Not on `replan` and `done` |

The kinds:

| Kind      | What the user does                                             | Answers                                                         |
| --------- | -------------------------------------------------------------- | --------------------------------------------------------------- |
| `check`   | Looks, smells, tries something, and picks an answer            | Choices                                                         |
| `measure` | Enters one or more readings                                    | Ranges on the readings; the app preselects the one that matches |
| `sweep`   | Does the same test on a list of items                          | On the items' outcomes together                                 |
| `action`  | Changes the board: unplugs, lifts a leg, replaces a part       | Usually `done`                                                  |
| `replan`  | Nothing: the tree ends here and the agent must update the plan | None. `instruction` says what the agent needs to decide         |
| `done`    | Nothing: the fault is found, fixed and verified                | None. `instruction` is the closing summary                      |

A **sweep** adds `items`, each with an `id`, a `target`, and optionally its own `probes`, `expect` and `answers`:

```jsonc
"diode-sweep": {
  "phase": "power-off",
  "kind": "sweep",
  "title": "Test every diode",
  "protocol": "diode",
  "why": "A shorted diode is a common cause of a dragged-down rail, and this costs five minutes.",
  "items": [
    { "id": "D1", "target": { "ref": "D1" } },
    { "id": "D2", "target": { "ref": "D2" } },
    { "id": "D5", "target": { "ref": "D5" },
      "expect": { "text": "0.15 to 0.45 V forward: D5 is a Schottky (SS14).", "basis": "datasheet" } }
  ],
  "answers": [
    { "id": "fail", "label": "At least one failed", "when": [{ "items": "any_fail" }], "next": "replan-diode-failed" },
    { "id": "pass", "label": "All passed", "when": [{ "items": "all_pass" }], "next": "transistor-sweep" },
    { "id": "partial", "label": "Some could not be judged", "when": [{ "items": "otherwise" }], "next": "transistor-sweep" }
  ]
}
```

Each item is tested with the protocol and gets its own result. The sweep is answered once every item has a result.

### Answers

```jsonc
{ "id": "ok", "label": "Over 1 kΩ, or climbing to OL", "outcome": "pass",
  "when": [{ "reading": "ohms", "min": 1000 }],
  "means": "+5V is not shorted.",
  "effects": { ... },
  "next": "rail-u4-vdd-to-gnd" }
```

| Field     | Required | Meaning                                                                                              |
| --------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `id`      | yes      | Unique within the step                                                                               |
| `label`   | yes      | What the user picks or confirms                                                                      |
| `outcome` | yes\*    | `pass`, `fail` or `inconclusive`. \*Not on a sweep's answers                                         |
| `when`    | no       | Conditions that select this answer automatically. All must hold. The first matching answer is chosen |
| `means`   | no       | What this answer tells, in a sentence, shown once it is given                                        |
| `effects` | no       | What this answer changes, written in advance by the agent (see below)                                |
| `next`    | yes\*    | The step that follows. \*In a plan step; a protocol's own answers have none                          |

Conditions:

| Condition                                       | Holds when                                                                              |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| `{ "reading": "ohms", "min": 10, "max": 1000 }` | The reading, as a number, is within the bounds (both inclusive, either may be left out) |
| `{ "reading": "rev", "is": "OL" }`              | The reading is over the meter's limit                                                   |
| `{ "items": "all_pass" }`                       | Sweep: every item passed                                                                |
| `{ "items": "any_fail" }`                       | Sweep: at least one item failed                                                         |
| `{ "items": "otherwise" }`                      | Sweep: neither of the above                                                             |

`OL` counts as larger than any number, so `{ "min": 1000 }` holds for it. Bounds are in the reading's base unit (Ω, V, A, F). The user can always override the preselected answer.

Three answers exist on every step without being written, because the user must always be able to say them:

| Built-in answer  | Outcome    | What follows                                                                              |
| ---------------- | ---------- | ----------------------------------------------------------------------------------------- |
| Could not do it  | `not_done` | The step stays current. The app asks for a plan update, and the note says what went wrong |
| Step looks wrong | `disputed` | The same                                                                                  |
| Skip for now     | `skipped`  | Only where the step has a `skip`: the walk continues there                                |

**Effects** let the app show the consequences of an answer at once, before the agent's next update. They are a lookup, written by the agent:

```jsonc
"effects": {
  "suspects": { "S2": "ruled_out", "S1": "more_likely" },
  "parts": [{ "refs": ["C3", "C4"], "status": "cleared", "of": "short" }]
}
```

`suspects` values are `ruled_out`, `confirmed`, `more_likely` or `less_likely`. `parts` entries use the assessment's fields. At the next update the agent folds them into `suspects` and `assessment`.

### Expectations

```jsonc
"expect": { "text": "4.47 to 4.94 kΩ (4.7 kΩ, 5 %). In circuit, a lower reading is not a fault.", "basis": "marking", "source": "R5's code 472" }
```

| `basis`         | The expectation comes from                            |
| --------------- | ----------------------------------------------------- |
| `marking`       | The value marked on the part                          |
| `datasheet`     | The part's datasheet (named in `source`)              |
| `same_board`    | An identical part or circuit on this board            |
| `earlier`       | An earlier result on this board (its id in `source`)  |
| `physics`       | The netlist and basic circuit laws                    |
| `rule_of_thumb` | General repair practice (the reference in `source`)   |
| `none`          | Nothing: the reading is recorded for later comparison |

### History

```jsonc
"history": [
  { "revision": 1, "date": "2026-11-05", "reason": "First plan, from the photos and observations O1 to O4.",
    "changes": "Opening checks, the rail sweep, the driver's pin checks." },
  { "revision": 3, "date": "2026-11-22", "reason": "R12 to R14, instructions I1 and I2, and C12 added to the model by the user.",
    "changes": "Kept 9 steps and their results. Dropped `c8-short` (C8 removed from the model). Added the lifted-leg test of C7. S2 ruled out.",
    "model_changes": ["U2: kind `ic` to regulator AMS1117-3.3, pins renamed from its datasheet (I2).", "U4 pin 4 to `U4_VDD`: `assumed` to `measured` (R12)."],
    "replies": {
      "I1": "Understood: no step in this plan needs desoldering before the power-off phase is complete.",
      "I2": "You were right: the close-up reads AMS1117 3.3. U2 is now the 3.3 V regulator, and C12 its output capacitor."
    } }
]
```

| Field           | Required | Meaning                                                                    |
| --------------- | -------- | -------------------------------------------------------------------------- |
| `revision`      | yes      | The revision this entry describes                                          |
| `date`          | yes      | `YYYY-MM-DD`                                                               |
| `reason`        | yes      | What prompted the update                                                   |
| `changes`       | yes      | What changed in the plan: steps kept, dropped and added, suspects moved    |
| `model_changes` | no       | Every change the agent made to `scenario.json` in this round, and why      |
| `replies`       | no       | The agent's answer to each instruction it handled in this round, by its id |

## What the app derives

All of this is computed for display and stored nowhere.

| Derived                    | How                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The current step           | Start at `start`. While the step has a result in force with an `answer`, follow that answer's `next` (or the step's `skip`). The first without one is current |
| The path                   | The steps walked that way, with their results                                                                                                                 |
| A phase's progress         | The share of the path's steps in that phase, and whether the current step is in it                                                                            |
| A suspect's status         | `suspects[].status`, then the `effects` of results newer than `based_on.results`, in order                                                                    |
| A part's state             | `assessment[ref]`, then the same newer effects, then the outcome of newer results that target the part                                                        |
| A part's test history      | Every result whose target is the part, or names one of its pins                                                                                               |
| An instruction's state     | Answered when a history entry has a reply for it; waiting otherwise                                                                                           |
| The timeline               | Observations, instructions, results and plan revisions, by date and id                                                                                        |
| "The plan needs an update" | The plan is out of date (below); or the current step is a `replan`; or the result in force for the current step is `not_done` or `disputed`                   |

### Fingerprint

The plan is **out of date** when what the agent read is no longer what the folder says. `based_on` records what it read, and the app compares:

- **The model changed.** `based_on.model` is a hash of the parts of `scenario.json` the plan depends on: each part's `kind`, `value`, `package` and `pins`; each net's nodes (`ref`, `pin`, `conf`); `power_nets`; and `instruments`. Moving a box, drawing a trace, editing a note or laying out the schematic does not change it. The build computes the current hash (in `generated/status.json`, and in the server's answer to each save).
- **A new observation or instruction exists**, with an id after `based_on.observations` or `based_on.instructions`.
- **An entry was voided** since: the count of void entries differs from `based_on.voided`.

New results do not make the plan out of date: following the tree is the normal course.

When it writes a plan, the agent also saves a copy of the model it read as `generated/plan-base.json`. At the next round it compares that copy with the current `scenario.json` to see exactly what the user changed.

## What the build checks

Each file is checked on its own, and the app's saves are refused only for errors in the file being saved. The user's edits to the model are never blocked by a plan that no longer matches it.

`scenario.json`, as today, plus: an instrument has a `kind`; a `formerly` name does not collide with a current name.

`record.json`: ids are unique and in order; a `supersedes` names an existing result; a target has exactly one field; a result that answers no step has a target.

`plan.json`, checked against the other two when the agent writes it (the skill must not leave a plan that fails):

- a target, a probe or an effect names a part, a pin, a net or a suspect that does not exist;
- an instrument kind used by a protocol or a step is not in `instruments`;
- a step's `phase`, `protocol`, `question`, `skip` or a `next` names something that does not exist;
- a `when` names a reading the step does not have, or `items` outside a sweep;
- a step is not reachable from `start`, or the steps form a loop;
- a path does not end in a `replan` or a `done` step;
- an `evidence` entry or a `replies` key names a result, an observation or an instruction that does not exist;
- `based_on` does not match the folder at the time of writing.

Later, the same mismatches between `plan.json` and an edited model are reported as "out of date", not as errors. The build also warns when a result's `step` is no longer in the plan (expected after an update), and when a step with `power: on` can be reached without passing a step in a `power-off` phase.

## Changes from version 1

| Version 1                      | Version 2                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| One file, `scenario.json`      | Three: `scenario.json`, `plan.json`, `record.json`                                                               |
| `tests`                        | `record.json` `results`: a target (part, net or two pins) in place of `ref`, plus `step`, `conditions`, `answer` |
| Protocols built into the app   | `plan.json` `protocols`, written by the agent                                                                    |
| `log.investigation`            | `record.json` `observations` (what was seen and tried) and the derived timeline                                  |
| `log.findings`, `log.suspects` | `plan.json` `findings`, `suspects`                                                                               |
| `log.progress`                 | `plan.json` `phases` and the derived progress                                                                    |
| `log.next_tests`               | `plan.json` `steps`                                                                                              |
| `log.warning`                  | `plan.json` `warning`                                                                                            |
| Renaming rewrites `tests`      | `formerly` on the part or net                                                                                    |
| `exports/repair-log.md`        | `exports/investigation.md`                                                                                       |

A one-off script migrates `scenarios/homestar-flux`: its 15 investigation rows become observations, and the plan skill then writes its first plan.

## Decisions taken

1. **The `log` section is gone.** The Repair log panel is a read-only timeline, with the findings and the suspects. The user adds observations and instructions; the rest is the agent's.
2. **Three files, one per writer.**
3. **The record is add-only**, with `void` in place of delete.
4. **The app evaluates `when` conditions** to preselect an answer. This is the only rule it runs on a reading.
5. **Effects are copied into the result** when it is saved, so the suspects and part states update at once and survive the next plan revision.
