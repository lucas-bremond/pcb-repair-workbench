# Writing the plan's steps

The format is [docs/scenario-format.md](../../../../docs/scenario-format.md) ("`plan.json`: the agent's analysis"). This page is about writing steps an unskilled person can follow, and a tree the app can walk without thinking.

## The reader

Someone with a multimeter who has never repaired a board. They read the step, do exactly that, and type what the meter shows. They do not know what a rail, a net or ESR is unless the step says it in plain words. They will stop following a plan that asks for something they cannot do, so every step must be doable with the declared instruments and say how.

## One step

| Field         | Write                                                                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`       | A question when the step measures or checks ("Is the 5 V rail shorted to ground?"), an order when it acts ("Unplug the motor's red wire")                  |
| `setup`       | The state before acting, one ticked item each: "The adapter is unplugged", "The motor is disconnected", "Meter on Ω"                                       |
| `warning`     | Only for a real hazard to the person or the board, stated with its consequence, no action inside: "Each press pushes current through whatever has failed." |
| `instruction` | One action, with the part and pin named as the board view shows them. Markdown: `**bold**` for the action, `code` for markings                             |
| `probes`      | Where each lead goes, so the app highlights both points on the photo. Always for measurements                                                              |
| `expect`      | The value and range a good board gives, with `basis` and `source`. `none` is honest when there is no reference                                             |
| `why`         | One or two sentences: what this separates or clears, naming suspects ("Clears C3, C4 and C9 of a short; S2 is ruled out if it passes")                     |
| `risk`        | `none` for anything unpowered and non-invasive, `low` for powered probing, `medium` for stress tests, `high` for desoldering or injection                  |
| `minutes`     | A novice's time: an expert's estimate plus half                                                                                                            |
| `question`    | The open question it settles (`OQ1`), so the app links them                                                                                                |
| `skip`        | Only when the plan can go on without it: where to continue                                                                                                 |

Use a `protocol` when one fits (copy it from `reference/protocols.json` into `plan.json` `protocols`, adjusted to the user's instruments), and give the step its own `instruction`, `probes` and `expect` for this target. Write `readings` on the step only when no protocol fits.

## Answers

Every `check`, `measure`, `action` and `sweep` step needs answers, each with a `next`. The user always also has "could not do it", "the step looks wrong" and "skip" (where `skip` is set): don't write those.

- **Cover every outcome.** For a `measure`, the ranges must leave no gap: a reading that matches no answer leaves the user choosing by label, which is where mistakes happen. Order matters: the first matching answer is preselected, so put the narrow ones first (`max 1`, then `max 10`, then `max 1000`, then `min 1000`).
- **Bounds are in base units**: Ω, V, A, F. 4.7 kΩ is `4700`; 47 µF is `0.000047`. `OL` is larger than any number, so `{"min": 1000}` matches it; `{"is": "OL"}` matches only OL.
- **A `measure` step's answers override its protocol's.** Copy the protocol's answers and add `next`, `means` and `effects`, or rewrite the ranges for this target.
- **`outcome`** is about the thing tested: `pass` when it is as a good board would be, `fail` when it is not, `inconclusive` when the reading cannot decide. It is not about whether the fault was found.
- **`means`** is the sentence the user reads after answering: what it tells, in plain words.
- **`effects`** are what the answer proves, written now so the app updates the suspects and the parts at once: `{"suspects": {"S2": "ruled_out"}, "parts": [{"refs": ["C3", "C4"], "status": "cleared", "of": "short"}]}`. Only claim what the measurement can prove (see "What a multimeter cannot conclude" in `process.md`).

### Per-target ranges

Generic protocols cannot know the value. Give each `measure` step (or each sweep item, in its `answers`) ranges for its target:

- **Resistor**, marked 4.7 kΩ at 5 %: `in-tolerance` 4465 to 4935; `high` min 4936; `low` max 4464 (`inconclusive` in circuit: parallel paths only lower a reading); `open` is OL. Under 10 Ω, widen the band by the lead resistance (0.2 to 0.4 Ω).
- **Rail voltage**, 5 V nominal: `in-range` 4.75 to 5.25 (down to 4.35 V at the far end of a long USB cable); `low` 0.1 to 4.75; `zero` max 0.1; `high` min 5.25.
- **Schottky in a diode sweep:** an item `expect` of 0.15 to 0.45 V, and item `answers` with that band.

## Sweeps

One step, one protocol, many items. Use it for "every diode", "every LED", "the resistors in the motor block". Each item gets its own result. The sweep's own answers decide on the items together:

```jsonc
"answers": [
  { "id": "fail", "label": "At least one failed", "when": [{ "items": "any_fail" }], "next": "..." },
  { "id": "pass", "label": "All passed", "when": [{ "items": "all_pass" }], "next": "..." },
  { "id": "partial", "label": "Some could not be judged", "next": "..." }
]
```

Always end with an answer without `when`: it catches the rest. Keep a sweep under about 15 items; split larger ones by block. Put the effects that apply to each item on the item's answers (or the protocol's, via the step), and the effects that need all of them on the sweep's answers.

## How deep to write the tree

Write the branches the next measurements can take, three to eight steps deep, and end every branch in a `replan` or a `done` step:

- A `replan` step's `instruction` tells the next round what it has to decide, in a sentence the user also reads ("The 5 V rail is shorted. Next round: split it at L_102 and find the part"). Title it for the user: "Update the plan: the 5 V rail is shorted".
- Don't plan the far branches in detail: they depend on results nobody can predict, and a long tree of guesses is worse than a short tree that asks for a new round.
- A `done` step comes only after the repair is verified: the original failing test, run several times.

## Updating a plan

- **Keep the walked path.** Every step on the path the user walked keeps its id, its `kind` and the ids of its answers, so their results stay attached. Change its text if needed, not its meaning. If a walked step is now wrong, keep it and change only where its answers lead.
- **Keep ids stable.** Suspects (`S1`...), findings (`F1`...) and steps keep their ids across revisions; never give an old id to something else. A dropped step's id is retired.
- **Regrow from the current step.** Rewrite the subtree from where the user stands. Results on dropped steps are not lost: fold what they proved into `findings`, `suspects` and `assessment`.
- **Fold the effects.** The results since the last revision have `effects`; make `suspects` and `assessment` say the same, with the result ids in `evidence`.
- **A disputed or not-done step** means the step was wrong or impossible. Read the result's notes, fix the model or the step, and say what you did in the history.
- **Answer every instruction** the status lists as unanswered, in `history[-1].replies`, even when the answer is "no, because...". Instructions in force are constraints on every revision.
- **Model changes** (`scenario.json`) are only those a result proves (a `continuity` result between two pins makes that connection `measured`, with `"evidence": "R12: 0.3 Ω between U4 pin 4 and C7 +"`) or an instruction asks for. List each in `history[-1].model_changes`.

## Words

Plain words, short sentences, no em dashes. Name parts as the board does (`U4`, `C7`), pins as `U4 pin 4 (VDD)`, nets in `code` only when the user needs the name. Say "the 5 V supply" in prose and `+5V` in a probe.
