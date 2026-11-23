# How experts find the fault, as rules for the plan

This is the working summary of [docs/research/board-repair-diagnosis.md](../../../../docs/research/board-repair-diagnosis.md), which has the sources, the grading of every number, and the conflicts between sources. The numbers here are defaults. A datasheet, an identical part on the same board, or an earlier reading on this board always beats them, and the step's `expect.basis` says which one was used.

## The phases, in order

| #   | Phase                     | Goal                                                       | Leave it when                                                                   |
| --- | ------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 0   | Safety and set-up         | Unpowered, discharged, meter proven, lead resistance noted | Always first. Nothing else until it is done                                     |
| 1   | Intake                    | Symptom, history, trigger, what still works                | Usually already in the observations. Ask only what is missing, as `check` steps |
| 2   | Reproduce (gated)         | Confirm the fault exists, list what works                  | Only if nothing is burnt, hot, wet, swollen or blown. Otherwise skip to 3       |
| 3   | Inspect, power off        | Burns, bulges, cracks, corrosion, bridges, loose wires     | Damage found: isolate that part and re-measure before any power. Else continue  |
| 4   | Measure, power off        | Input path continuity, every rail to ground, sweeps        | A rail shorted: short-finding. Input open: follow it. Clean: continue           |
| 5   | Power on, current-limited | Current first, then each rail in power-chain order         | Current limit hit: back to 4 on the downstream rails. Rails proven: continue    |
| 6   | Isolate                   | Half-split the failing function's chain                    | One stage left                                                                  |
| 7   | Confirm the part          | Lift, remove, compare with a twin, substitute              | Part confirmed bad: continue. Good: back to 6                                   |
| 8   | Root cause                | Why did it fail (a downstream short, overload, liquid)?    | Cause removed or accepted                                                       |
| 9   | Repair, verify, record    | Re-run the original failing test over several cycles       | Symptom gone: `done`. Still there: back to 6 without the repaired part          |

Phases 0 to 4 are safe for an unskilled user and need no power. Put them first in every first plan, compressed when the observations already cover them.

## Ordering rules (constraints, not preferences)

1. The safety step comes first in every first plan, and its `setup` is ticked before anything else.
2. **Power off before power on.** No step with `power: on` may be reachable before the rail-to-ground check of every rail it powers has passed.
3. **Inspection before power.** If anything is reported burnt, hot, swollen, wet or smelly, the plan does not power the board until that part is isolated or replaced.
4. **One change at a time.** An `action` step changes one thing, and the next step re-tests.
5. **Ration the trigger.** When an action triggers the fault (a button that resets the unit, a motor start), each repetition re-stresses whatever has failed. Ask for it only when the step measures something during it, and at most a few times in a plan. Say so in a `warning`.
6. **Cheap and safe before invasive.** Lifting a leg, desoldering or cutting a trace (risk `high`) comes only when every `none` and `low` risk step that separates the same suspects is done, skipped or impossible with the user's instruments.
7. **Only the user's instruments.** Never write a step that needs an instrument not in `scenario.json` `instruments`. When a missing instrument would settle something, say so in the step's `why` or in a finding, and give the best fallback.
8. **Injection** (feeding a shorted rail from a bench supply to find the hot part) only with a declared `bench_supply`, with the limits on screen: voltage at or below 0.5 V by default and never above the rail's own, current starting at 100 to 200 mA and capped at 1 A, stop at 50 °C on any part.

## Decision table: what an observation routes to

| Observation                                                    | Route                                                                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Burn marks, smell, bulged or cracked part, corrosion, a bridge | Isolate or remove that part, re-measure the rail, no power yet                                                |
| A rail reads about 0 Ω to ground, unpowered                    | Short-finding: inspect, split the rail at a series part, remove suspects one at a time, injection if a supply |
| No rail shorted, yet power-up hits the current limit           | A downstream rail, reversed polarity or a failed power semiconductor: measure each downstream rail            |
| Near-zero current, dead                                        | An open path: adapter, jack, fuse, switch, polarity diode, trace, a regulator not enabled                     |
| Voltage at a regulator's input, none at its output             | The enable pin and the output's resistance to ground before blaming the regulator                             |
| Rails correct on a meter, device dead                          | Ripple (scope), then clock, reset, enable, then the failing chain by half-split                               |
| Rails correct, one function missing                            | That function's chain, half-split, the IC's supply pin first                                                  |
| The fault appears only when a load switches on                 | Power integrity: split the load from the driver first (see the playbook below)                                |
| The fault comes and goes, or responds to tapping and flexing   | Connections: reseat connectors, inspect and reflow joints of large, hot and stressed parts                    |
| The fault changes as the unit warms up                         | Electrolytic capacitors (ESR), then local heat and cold to localize                                           |
| Several unrelated symptoms                                     | One shared cause (a rail, clock, reset), unless the history says liquid, drop, surge or an earlier repair     |

## Priors: what to suspect first

Without evidence, in this order: connections (solder joints, connectors, wires), electrolytic capacitors (high ESR on boards older than 5 to 10 years), power parts that switch a load (drivers, transistors, MOSFETs, regulators), ceramic and tantalum capacitors shorted on a rail, logic ICs last. There are no field statistics behind this order: never present it as a probability. History overrides it: liquid, a drop, a surge or an earlier repair make several faults likely.

How parts fail, within each kind: film resistors open (59 %) or drift (36 %), rarely short. Ceramic capacitors short (49 %). Tantalum capacitors short (57 %). Aluminium electrolytics wear out (capacitance down, ESR up). An H-bridge driver output fails stuck short (28 %), open (16 %) or with too much on-resistance (30 %), and that last one passes every static meter test.

## Thresholds, power off

Short the probes first and note the lead resistance (0.1 to 0.4 Ω); subtract it below 10 Ω. Never use the continuity beeper as a verdict (meters beep anywhere from 10 to 200 Ω): ask for the ohms.

| Reading, rail to ground (black probe on ground) | Meaning                                                        |
| ----------------------------------------------- | -------------------------------------------------------------- |
| 0 to 1 Ω, steady                                | Hard short                                                     |
| 1 to 10 Ω, steady (small 5 V board)             | A fault on a board without a multi-amp core rail               |
| 10 Ω to 1 kΩ, steady                            | Low: compare with a twin rail or the datasheet; often a replan |
| Starts low, climbs toward kΩ or OL              | Normal: capacitors charging. Wait for it to settle             |
| Diode mode 0.000 V both ways                    | True short                                                     |
| Diode mode 0.4 to 0.8 V one way, OL the other   | A normal junction                                              |

One rail-to-ground reading clears **every capacitor on that rail of a short** (they are in parallel), and nothing else: not an open or worn capacitor, not a dead IC that is not shorted, not an intermittent short. Write the effect as `cleared` with `"of": "short"`, never `ok`.

Pins not on any net are unknown, so "every part on the rail" is a lower bound. Name in `why` the parts the model puts there, and say the reading may cover more.

## Thresholds, power on

- Rails within 5 %: 4.75 to 5.25 V, 3.135 to 3.465 V. Measure at the IC's supply pin, not at the regulator.
- A multimeter averages: it cannot see a millisecond dip. Never conclude "the rail is fine" about a reset under load from a DC reading. Record the reading idle and during the load, and say what a scope or a min/max mode would add.
- Current draw (USB meter or bench supply): zero at full voltage = an open input; a few steady mA and nothing works = a regulator or the MCU not starting; immediate current limit with the voltage collapsed = a main-rail short; normal idle with a jump on one action = a fault in the load that action switches on; rhythmic pulsing = protection retrying or a reset loop.

## Sweeps that clear whole groups

In this order, each one cheap and safe:

1. Inspection of every part (one `check` step, or a sweep of the suspect area).
2. Meter set-up: lead resistance, capacitors discharged.
3. Power-entry continuity: connector, switch, fuse, series diode, ferrite beads, 0 Ω links.
4. Every power net to ground (one `measure` step per rail, effects clear every capacitor on it of a short).
5. Diode mode over every diode, LED and transistor (a `sweep` per kind), twins compared.
6. Suspect resistors: burnt, in the power path, current sense, gate drive.
7. ESR of every electrolytic (only with an `esr_meter`).
8. First power-up, current first.
9. Powered voltages: input, each regulator's input, enable and output, each rail at the load.
10. Event-driven tests (during the trigger), load substitution.
11. Lifting or removing parts: last.

**Twin comparison** replaces a known-good board: identical diodes, identical capacitors in a bank, the two outputs of a driver, pins of the same type on one IC. A reading unlike its twins is the finding, even when it looks plausible alone. Use `expect.basis: "same_board"`.

## Playbook: resets when a load starts (motor, lamp, solenoid)

From least to most invasive:

1. Power off: the load's supply rail to ground; each driver output to ground and to the supply, both probe directions, outputs compared with each other.
2. Unplug the load and measure it (a motor: a few ohms at every shaft position, never OL, never near 0 at all positions; turn the shaft slowly).
3. Power on with the load unplugged and trigger the function once: a reset with no load condemns the driver or the board, not the load.
4. Run the load alone from a separate current-limited supply (with a `bench_supply`).
5. During the trigger, with the load connected: the rail at the MCU's supply pin and the reset pin, on a scope in single-shot (with an `oscilloscope`). Only this sees the dip; the others bracket it.
6. If the rail dips: the bulk capacitor's ESR (with an `esr_meter`), or temporarily parallel a known-good capacitor of the same value or larger, polarity right.

A static pass does not clear a driver (30 % of driver failures are on-resistance). The deciding measurements are the loaded output voltage and the supply at the driver's pin during a start. An electrolytic cannot be cleared with a multimeter alone: `untestable` unless there is an ESR meter, or until a substitution test.

## Playbook: dead board

Input path (adapter output, connector, switch, fuse) with power off; every rail to ground; then power on, current first; then each regulator's input, enable, output; then reset and clock at the MCU.

## Playbook: one function missing

The function's chain from input to output (button, MCU input, MCU output, driver, connector, load), its midpoint first. Steady signals (a pin high while a button is held) can be checked with a multimeter; PWM cannot.

## Playbook: intermittent

Characterize on four axes first (temperature, position, time, load) with `check` steps. Then reseat connectors, inspect and reflow joints of large and stressed parts, tap and flex with an insulated stick, then heat and cold on small areas (with `freeze_spray` or `hot_air`). A passing test only lowers suspicion: the fault "will reappear".

## What a multimeter cannot conclude

Write these as `untestable` or `inconclusive`, never `pass`: an electrolytic's ESR, a driver's on-resistance, a crystal oscillating, a rail dip under load, a shorted turn in a winding, a relay's contact quality, a low in-circuit resistor reading (parallel paths can only lower it), which capacitor of a shorted rail is the bad one.
