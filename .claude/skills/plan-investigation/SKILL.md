---
name: plan-investigation
description: Write or update the investigation plan of a PCB repair scenario (plan.json), the step-by-step tree of checks and measurements the user follows in the app's Investigate tab, with the suspects, the findings and the test procedures. Use after new-scenario creates a scenario, and whenever the user asks to plan, re-plan, update or continue an investigation, says they entered results, observations or instructions in the app, changed the board model, or reached a step that asks for a plan update.
---

# Plan the investigation

You drive the diagnosis; the app does not think. The user follows `plan.json` in the app's Current step panel, acts on the real board, and reports back into `record.json`. Each round, you read what they did and said, update what is known, and write the next part of the tree.

A scenario folder is `scenarios/<id>/`:

- `scenario.json`: the board model (parts, nets with a confidence per connection, photos, instruments). The user edits it in the app; you change it only where a result proves something or an instruction asks.
- `record.json`: the user's observations, instructions and results. **Never write it.**
- `plan.json`: yours. Its format is specified in [docs/scenario-format.md](../../../docs/scenario-format.md), and checked by `app/schema/plan.schema.json` and `app/scripts/investigation.py`.

Read before writing:

- [reference/process.md](reference/process.md): the phases, the ordering rules, the decision table, the thresholds and the playbooks.
- [reference/writing-steps.md](reference/writing-steps.md): how to write steps an unskilled person can follow, answers that cover every reading, sweeps, and how to update a plan without losing results.
- [reference/protocols.json](reference/protocols.json): standard test procedures in the plan's format. Copy the ones you need into `plan.json` `protocols`.

The scripts need Python 3.10+ with `app/scripts/requirements.txt` (see the `new-scenario` skill for the set-up, or run them in the app's image). Below, `python` is that Python.

## 1. Find out where things stand

```sh
python -I app/scripts/investigation.py status scenarios/<id>
```

It prints:

- the current step;
- why the plan needs an update;
- what changed in the model since the plan was written (from `generated/plan-base.json`);
- the path the user walked, with each answer;
- the results, observations and void entries since the last revision;
- the instructions in force, and which ones you have not answered yet;
- the suspects as they stand now.

With `--json` it prints the full data. Then read `scenario.json`, `record.json` and the current `plan.json`.

If there is no `plan.json`, this is the first plan: the facts are the observations in `record.json` and `board.description`. If the status shows nothing new and no reason to update, say so and stop.

## 2. Think it through

Work out the state of the diagnosis before writing anything:

- **What is established:** the findings, with the observations and results that show them.
- **What each result proves**, and what it cannot (see "What a multimeter cannot conclude" in `process.md`).
- **The suspects:** each a part, joint or connection with a failure mode, ranked by the evidence, then by the priors in `process.md`. Suspects keep their ids across revisions; add new ones with new ids. Keep a catch-all "something not in the model" suspect when the evidence is thin.
- **The parts' states:** fold the `effects` of the new results into `assessment`, with the result ids as evidence.
- **The user's instructions in force:** constraints on everything you write, until they void them.
- **A disputed or not-done step:** read its notes. Usually the model or the step was wrong: fix that first.
- **Model changes the user made:** a renamed or re-typed part, a new connection. Re-read what changed and whether it moves the suspects.
- **What the next measurements must separate:** pick them by the ordering rules first (safety, power off before on, cheap and safe before invasive, only the user's instruments), then by how evenly they split the suspects and how much they clear at once (rail-to-ground checks and sweeps clear many parts per reading).

## 3. Update the model, only where proven

Edit `scenario.json` in place, by its fields (never rewrite the whole file, as the user may be editing it in the app):

- A passed `continuity` result between two pins: that connection becomes `measured`, with `"evidence": "R12: 0.3 Ω, U4 pin 4 to C7 +"`. A new connection goes on its net with the same evidence.
- A failed one: the connection is wrong or the board is open. Say which you think and why; don't delete a connection on one reading.
- What an instruction asks (re-read a marking, change a part's kind): do it if the photos or datasheet support it, else explain in the reply.

Then run `python -I app/scripts/scenario_json.py scenarios/<id>/scenario.json` and `python -I app/scripts/build.py scenarios/<id>`, and fix what it reports. List every change in this revision's `model_changes`.

## 4. Write `plan.json`

For a first plan, start at revision 1. For an update, add one to `revision` and keep everything that still holds:

- `summary`: where the investigation stands and what the next steps establish, in two or three sentences.
- `warning`: a standing safety note when there is one (a fault triggered by a button: ration the presses).
- `findings`, `suspects`, `assessment`: as worked out in step 2.
- `protocols`: the procedures the steps use, plus one for every kind of part in the model (the app's **Test** button offers a part only the procedures for its kind), copied from the library and limited to the user's instruments.
- `phases`: the stages, in order (usually those of `process.md`, merged or dropped as the situation needs).
- `start` and `steps`: the tree. Keep the walked path's ids and answer ids (see "Updating a plan" in `writing-steps.md`), and regrow the tree from the current step. End every branch in a `replan` or a `done` step.
- `history`: add one entry, with:
  - `reason`: what prompted this round;
  - `changes`: steps kept, dropped and added, and suspects moved;
  - `model_changes`;
  - `replies`: one per unanswered instruction.

Don't edit `based_on` by hand: the next command sets it.

## 5. Stamp and check

```sh
python -I app/scripts/investigation.py stamp scenarios/<id>
python -I app/scripts/build.py scenarios/<id>
```

`stamp` records what you read in `based_on` (the model's fingerprint and the last record ids), formats `plan.json`, saves the model you planned from to `generated/plan-base.json` (the next round's status compares against it), and checks the plan strictly:

- every reference exists;
- the user has every instrument it needs;
- every step can be reached;
- there are no loops;
- every path ends in `replan` or `done`.

Fix every problem it reports and stamp again. `build.py` then regenerates `exports/investigation.md`.

If the user saved something to `record.json` while you were working, `stamp` picks it up in `based_on`. Re-run `status` and check that nothing new changes your plan.

## 6. Tell the user

In a few lines:

- what you concluded from their results;
- what changed in the plan and the model;
- your answers to their instructions;
- the first step they will see.

The app picks up the new plan by itself (or on a reload). Remind them that they can write instructions for the next round in the app, and run this skill again when the app says the plan needs an update (the Current step panel, and **Update** beside it in the sidebar).

## Rules

- **Never write `record.json`.** Never drop or renumber a result, observation or instruction.
- **Never invent a measurement or an observation.** Every finding cites its evidence ids.
- **Never ask for an instrument the user does not have.** Say what it would settle instead.
- **Never present a guess as a measurement.** Suspect weights are ranks, not probabilities. Connection confidence follows the model's rules (only meter checks are `measured`).
- **Safety first.** Power off before power on, and inspection before power. Ration the trigger. Injection only with a bench supply and its limits on screen.
- **Writing style:** plain words, no em dashes.
