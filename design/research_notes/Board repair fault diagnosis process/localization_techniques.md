# Fault-localization techniques used by board-level repair technicians (to 2026)

Scope: low-voltage consumer and embedded boards (5 V USB or DC adapter input, 3.3 V logic, a microcontroller, small DC or stepper motors with a driver IC, LEDs). Laptop and phone material is kept where the technique generalizes.

Source quality key, used in the findings below:

- **[V]** vendor or standards document (TI, Fluke, Microchip, Techspray, ASM International EDFA journal).
- **[P]** practitioner source (Rossmann Group forum moderators, EEVblog forum, iFixit, Hackaday, ACDI, a repair shop manual).
- **[N]** secondary notebook or tutorial of unknown authorship (the `applied-ee.github.io` EE notebook, Altium and Cadence blogs, small vendor blogs). Useful for thresholds, but treat as rules of thumb.
- **(snippet)** means the page itself could not be opened (HTTP 403 or timeout) and the statement comes from the search engine's summary of that page. These need re-checking before being hard-coded in a tool.

Pages that could not be read directly: every `repair.wiki` page (403), every `badcaps.net` thread (403), TI E2E (403), `repairfaq.org` (DNS failure, so no Goldwasser FAQ text was read), the Analog Devices article on power-plane shorts (timeout).

## 1. Power-off rail checks: resistance and diode mode to ground

### Takeaway

With the board unpowered, a rail that reads about 0 to 1 ohm to ground, or 0.000 V in diode mode in both probe directions, is a hard short; a normal rail shows a capacitor-charging climb in ohms and a junction-like 0.2 to 0.8 V in one direction in diode mode. The numbers are only meaningful per rail: high-current core rails legitimately read about 1 to 2 ohms and beep on continuity, so the real pass/fail rule is "compare with the expected value for that rail", not a single threshold.

### Cited Findings

**Preparation and safety**

- Disconnect every power source, including the battery, before diode-mode testing, or the device may be damaged. [P] [iFixit, microsoldering school day two](https://www.ifixit.com/News/98564/microsoldering-school-day-two-to-fix-the-problem-you-first-have-to-find-the-problem)
- Turn off circuit power, confirm no voltage is present, and discharge capacitors first, because "Voltage may be present in the circuit due to charged capacitors." [V] [Fluke, how to test diodes](https://www.fluke.com/en-us/learn/blog/digital-multimeters/how-to-test-diodes)
- Before any reading, short the meter leads together and confirm they read close to zero (this is also the lead resistance to subtract). [V] [Fluke, troubleshooting DC power supplies with a DMM](https://www.fluke.com/en-us/learn/blog/predictive-maintenance/troubleshooting-dc-power-supply-with-digital-multimeter)
- Worked example of lead subtraction: a meter reading of 3.15 ohms on a shorted line, minus 0.3 ohm of probe resistance, gives about 2.8 ohms for the line. [P] [Rossmann Group forum, thread 65597](https://boards.rossmanngroup.com/threads/820-02098-shorted-ppbus_aon_spkramp_abc_isns-but-nothing-heats-up-even-with-10w-of-power.65597/)

**Resistance-mode thresholds (rail to ground, or between two nets that should be isolated)**

- 0 to 1 ohm: hard short, direct metal to metal. 1 to 100 ohms: low-resistance path, either a component or a resistive short (contamination, partial bridge). 100 ohms to 10 kilohms: possibly normal in-circuit resistance (pull-ups, termination), check the schematic. OL: nets are isolated. [N] [EE notebook, short between nets](https://applied-ee.github.io/ee-notebook/docs/measurement/continuity-connections/short-between-nets)
- A different definition: a short is "typically under 10 ohms". [P] [ACDI, power rail shorts with a thermal camera](https://www.acdi.com/troubleshooting-electronic-board-power-rail-shorts-with-a-thermal-camera/)
- A reading near 0 ohms that climbs toward OL is a capacitor charging, not a short. Wait for the reading to settle. [N] [EE notebook, short between nets](https://applied-ee.github.io/ee-notebook/docs/measurement/continuity-connections/short-between-nets)
- CPU and GPU core rails are the standing exception. A MacBook CPU core rail (PPVCORE_S0_CPU) measured 1.8 ohms on a board under repair, and a moderator stated that a continuity beep to CPU Vcore is expected because that path is low resistance. [P] [Rossmann Group forum, thread 29438](https://boards.rossmanngroup.com/threads/820-3330-dead-short-on-ppbus.29438/)
- Repair Wiki states that CPU and GPU rails often read as shorts, which makes real shorts on them difficult to identify because of their low resistance and high current. [P] (snippet) [Repair Wiki, Short Circuits, Repair Basics](https://repair.wiki/w/Short_Circuits_-_Repair_Basics)
- An inductor between two nets (filter, matching network, buck output) reads very low resistance, so a low reading across it is not a short. Two ground points should read very low to each other, and any conductor not tied to ground should read very high to ground. [N] [Altium, how to test for a short circuit on a PCB](https://resources.altium.com/p/how-test-short-circuit-pcb)
- Resistance mode on semiconductors in circuit "can produce a false reading"; Fluke calls diode test "almost always the best approach" for junctions. [V] [Fluke, how to test diodes](https://www.fluke.com/en-us/learn/blog/digital-multimeters/how-to-test-diodes)

**Diode-mode thresholds**

- 0.000 V in both directions: true metal-to-metal short. 0.4 to 0.7 V in one direction and OL in the other: normal silicon junction (protection or body diode). 0.2 to 0.3 V in one direction: Schottky diode, likely intentional. OL in both directions: nets are isolated. Always measure both polarities by swapping leads. [N] [EE notebook, short between nets](https://applied-ee.github.io/ee-notebook/docs/measurement/continuity-connections/short-between-nets)
- Good silicon diode forward drop: 0.5 to 0.8 V. Good germanium: 0.2 to 0.3 V. Reverse biased good diode: OL. Open diode: OL in both directions. A shorted diode reads the same low drop (about 0.4 V) in both directions. [V] [Fluke, how to test diodes](https://www.fluke.com/en-us/learn/blog/digital-multimeters/how-to-test-diodes)
- Phone-board practice: a healthy line on an iPhone display connector reads about 0.7 V on every working example, 0 V "would indicate a short circuit somewhere on the board", and OL means an open line, "a break in the line where there shouldn't be". Any reading other than the expected one means a fault somewhere on that line. [P] [iFixit, microsoldering school day two](https://www.ifixit.com/News/98564/microsoldering-school-day-two-to-fix-the-problem-you-first-have-to-find-the-problem)
- A partial short example: a diode-mode reading of 0.152 on an iPhone main rail (VCC_MAIN) was low enough for the technician to treat the rail as shorted. [P] [iFixit Answers 593751](https://jp.ifixit.com/Answers/View/593751/Looking+for+a+short+on+VCC+MAIN,+injected+4.2v+blew+component)
- After the shorted parts were removed from a MacBook rail, a reading of 0.100 on one inductor and 0.436 on the main bus were both judged "probably normal" by a moderator, because resistive dividers remained on the line. Low is not always bad. [P] [Rossmann Group forum, thread 29438](https://boards.rossmanngroup.com/threads/820-3330-dead-short-on-ppbus.29438/)
- Diode mode uses about 1 mA of test current and can read OL on a resistive fault that resistance mode would catch, so check both modes. Many protection diodes in parallel give a lower forward voltage than one diode would. [N] [EE notebook, short between nets](https://applied-ee.github.io/ee-notebook/docs/measurement/continuity-connections/short-between-nets)

**The red-probe-on-ground convention**

- Procedure as taught: put the red lead on a ground pad and the black lead on the pad or pin under test. The meter then injects its small test current into the ground plane and displays the drop to the test point. [P] [iFixit, microsoldering school day two](https://www.ifixit.com/News/98564/microsoldering-school-day-two-to-fix-the-problem-you-first-have-to-find-the-problem)
- Fluke's definition of polarity: a diode is forward biased when the red (positive) lead is on the anode and the black lead on the cathode. [V] [Fluke, how to test diodes](https://www.fluke.com/en-us/learn/blog/digital-multimeters/how-to-test-diodes)
- Repair Wiki notes that reversing the probe connection may give low readings because of the internal protection diodes of ICs, even when there is no short. [P] (snippet) [Repair Wiki, Short Circuits, Repair Basics](https://repair.wiki/w/Short_Circuits_-_Repair_Basics)
- MOSFET body diodes can show a "short" in only one direction, which is why both polarities are measured before calling a short. [N] [EE notebook, short between nets](https://applied-ee.github.io/ee-notebook/docs/measurement/continuity-connections/short-between-nets)

**Where to probe**

- Measure rail to ground at the bypass capacitor of each IC on the rail. The lowest reading is closest to the short. [N] [EE notebook, short between nets](https://applied-ee.github.io/ee-notebook/docs/measurement/continuity-connections/short-between-nets)
- Check resistance between IC or connector pins and from each pin to ground. Low resistance between two pins that are neither power nor ground can indicate a burned-out part such as a capacitor. [N] [Altium, how to test for a short circuit on a PCB](https://resources.altium.com/p/how-test-short-circuit-pcb)
- Large inductors (buck converter coils) are the standard probe points for a rail on a laptop board: moderators tell users to measure resistance to ground at the coils to find which rail is low. [P] (snippet) [Rossmann Group forum search results](https://boards.rossmanngroup.com/threads/820-00244-a-short-on-ppbus_g3h.42793/)

### Inferences

- The reason for red-on-ground was not stated in any page that could be read. The findings above support this explanation: almost every IC pin has an ESD diode with its anode on ground and its cathode on the pin, so red on ground forward biases that diode and gives a finite, repeatable number (typically 0.3 to 0.8 V) for every healthy pin, where black on ground would mostly give OL and hide both shorts-to-something and opens. A missing junction (OL) then reveals an open line or a missing IC, and a low value reveals a short or leakage. Mark this as inference in the tool's help text.
- A practical decision table for a guided tool, combining the sources (thresholds differ by source, so each band carries its origin):

  | Reading, red on ground, black on rail             | Verdict                                        | Basis                       |
  | ------------------------------------------------- | ---------------------------------------------- | --------------------------- |
  | 0.000 to about 0.010 V, both polarities           | Dead short                                     | EE notebook, iFixit         |
  | About 0.010 to 0.2 V                              | Partial short or a legitimately low-ohm rail   | iFixit 0.152 case, Rossmann |
  | 0.2 to 0.3 V                                      | Schottky or many junctions in parallel, verify | EE notebook, Fluke          |
  | 0.3 to 0.8 V                                      | Normal                                         | Fluke, iFixit, EE notebook  |
  | OL                                                | Open line, or no junction on this net          | iFixit                      |
  | Ohms: under 1 ohm steady                          | Dead short, unless a core rail                 | EE notebook                 |
  | Ohms: 1 to 10 ohms steady                         | Suspect, compare with expectation              | ACDI under 10, Rossmann 1.8 |
  | Ohms: climbing reading that ends in kilohms or OL | Normal (capacitors charging)                   | EE notebook                 |

- On a small 5 V consumer board with a microcontroller, no rail should legitimately sit at a few ohms (there is no multi-amp core rail), so "under about 10 ohms and not climbing" can be treated as a fault there. The core-rail exception matters only for laptops, GPUs and phones.
- The 0.000 to 0.010 V band in the question is consistent with the sources (0 V, 0.000 V) but no page read gives 0.010 V as an explicit limit.

### Gaps

- No readable source gives a ranked table of "normal ohms to ground" per rail type for small embedded boards. The only numeric core-rail example is 1.8 ohms on a MacBook CPU rail.
- The search summary reported that one guide treats "anything under 0.3 V" in diode mode as a short and that a forum poster notes most meters diode-test at over 2 V. The pages behind those statements could not be identified or opened (badcaps threads return 403), so neither is confirmed.
- The reason for the red-on-ground convention is not confirmed by a primary source (see Inferences).
- Repair Wiki's own page on short circuits could not be read in full.

## 2. Known-good comparison, reference values, and what to do without a schematic

### Takeaway

Technicians judge almost every reading by comparison: against community-posted diode-mode tables, an identical working board, or, failing both, the identical twin circuits on the same board. Without any reference, the fallback order is rails, grounds, clock, reset, then signal tracing, with the rule that the board is always right when it disagrees with a schematic.

### Cited Findings

- Diode-mode readings are compared with community-posted readings for that connector, or with an identical known-good device when none are published. [P] [iFixit, microsoldering school day two](https://www.ifixit.com/News/98564/microsoldering-school-day-two-to-fix-the-problem-you-first-have-to-find-the-problem)
- Fluke recommends comparing a suspect diode's readings with a known good diode for best results. [V] [Fluke, how to test diodes](https://www.fluke.com/en-us/learn/blog/digital-multimeters/how-to-test-diodes)
- Known-good substitution: swap the suspect part or module with a known-good one. "If the fault goes away, that confirms the source." It works best on socketed ICs, modules, cables and connectors. Identical channels (left and right, channel A and B) can be swapped against each other. Trap: a spare from the same batch may share the defect. [N] [EE notebook, fault isolation strategies](https://applied-ee.github.io/ee-notebook/docs/debugging/fault-isolation)
- Comparing identical parts on the same board gives a relative threshold: a capacitor reading about twice the ESR of its identical neighbours is suspect even if the absolute value looks acceptable. [N] [EE notebook, ESR meter](https://applied-ee.github.io/ee-notebook/docs/measurement/test-instruments/esr-meter)
- Thermal comparison against a "golden sample": with the same injection, a component that differs by more than 10 °C from the same component on the golden board is suspect. Without a golden sample, the suspect is taken to 60 or 70 °C to confirm. [V] [ASM International EDFA 2021, IR method](https://static.asminternational.org/EDFA/202102/24/)
- ESD-damaged ICs degrade parametrically (leakage, offset, thresholds) and can pass basic tests. The stated way to confirm is comparison against reference measurements from a known-good board. [N] [EE notebook, failure modes and patterns](https://applied-ee.github.io/ee-notebook/docs/debugging/failure-modes-and-patterns)
- Working without a schematic, in order: (1) power rails, find the input, follow it to the regulators and measure the outputs (common rails are 5 V, 3.3 V, 1.8 V, 1.2 V); (2) grounds, confirm continuity across several exposed ground points; (3) clocks, "If the clock isn't running, nothing downstream will work"; (4) reset, "A processor held in reset looks dead but isn't broken"; (5) signal tracing using visual routing, continuity checks, datasheet pinouts and standard connector pinouts. [N] [EE notebook, fault isolation strategies](https://applied-ee.github.io/ee-notebook/docs/debugging/fault-isolation)
- With a schematic: verify that it matches the board revision, and when the two disagree "the board is always right". [N] [EE notebook, fault isolation strategies](https://applied-ee.github.io/ee-notebook/docs/debugging/fault-isolation)
- Datasheets supply expected values when no board reference exists: for example the DRV8833 dual H-bridge datasheet fixes the supply range (2.7 to 10.8 V), the expected bypass parts (10 µF minimum on VM, 2.2 µF on VINT, 0.01 µF on VCP) and the idle supply current (1.7 mA typical, 3 mA maximum at 5 V with inputs low). [V] [TI DRV8833 datasheet](https://www.ti.com/lit/ds/symlink/drv8833.pdf)
- Predict before measuring: hypothesize, predict what the measurement should show, measure, then update. [N] [EE notebook, fault isolation strategies](https://applied-ee.github.io/ee-notebook/docs/debugging/fault-isolation)

### Inferences

- For a guided tool with no reference board, the usable hierarchy of "expected value" sources is: (a) a value recorded earlier on the same board when it worked, (b) an identical circuit on the same board (second motor channel, second LED string, the other H-bridge half), (c) the IC datasheet's typical application circuit and electrical characteristics, (d) generic thresholds from section 1. The tool should store which of these a pass/fail limit came from.
- A dual H-bridge driver is its own reference: OUT1 and OUT2 (and the A and B bridges) should give matching diode-mode readings to ground and to the motor supply. A pin that differs from its twins by a large margin is the suspect. This follows from the identical-channel rule above. It is not stated for H-bridges in a source that was read.

### Gaps

- No readable source gives a percentage rule for how far a diode-mode reading may differ from the reference before it is a fault. Practitioners speak of "the expected value" without a tolerance.
- Public diode-mode databases exist for phones and game consoles (the search surfaced one for the Game Boy Advance SP at retrosix.wiki), but nothing was found for small appliance boards, so a tool for such boards has to build its reference from twins and datasheets.

## 3. Short-circuit location

### Takeaway

Once a rail is confirmed shorted, the two professional families of method are (1) feed the short from a current-limited supply at or below the rail's own voltage and find what gets warm, and (2) feed a small current and follow the voltage or resistance gradient to the lowest point. Thermal methods are fast but fail on very low-ohm shorts that dissipate almost nothing; gradient tracing needs 10 to 100 µV resolution but does not depend on heat. Removing parts and splitting the rail are the fallback.

### Cited Findings

**Voltage injection: settings recommended by each source**

| Source                        | Voltage                                        | Current limit                                                       |
| ----------------------------- | ---------------------------------------------- | ------------------------------------------------------------------- |
| ASM EDFA (failure analysis)   | Ramp slowly from 0 V to the rated rail voltage | Start 0.2 A, then 0.5, 1, 2, 5 A steps only if nothing passes 40 °C |
| ACDI (repair service)         | The board's rated voltage                      | Start 0.5 A, raise 0.5 A at a time                                  |
| EE notebook                   | 0.5 to 1 V, "keep voltage < 1V"                | 100 to 500 mA                                                       |
| EEVblog, masterx81            | The rail's voltage                             | 50, 100, 150 mA and so on up to 1 A                                 |
| EEVblog, Gyro                 | Limit under 0.5 V                              | 100 mA to 1 A                                                       |
| EEVblog, rs20                 | 0.5 V maximum                                  | 0.5 A                                                               |
| PNW Computers manual          | 1.0 V                                          | Not given                                                           |
| Rossmann forum, 2informaticos | Start at 1 V, increase only if needed          | Limit set to maximum (laptop boards)                                |
| Repair Wiki                   | The rail's own voltage (0.75 V or 1.8 V rails) | Never beyond the rail's rating                                      |

- ASM EDFA procedure in full: limit current to 0.2 A, slowly increase voltage from 0 V to the rated rail voltage while an IR camera monitors case temperatures, letting temperatures stabilize at each step. Flag any component above 40 °C. Keep every case at or below 50 °C and reduce the voltage if one starts to exceed it. If nothing exceeds 40 °C, raise the current limit stepwise. Preferred ambient is 0 to 25 °C. Injection power must be raised slowly to avoid case-temperature overshoot. [V] [ASM International EDFA 2021](https://static.asminternational.org/EDFA/202102/24/)
- ACDI procedure: solder a red and a black wire across a large bypass capacitor on the shorted rail, set 0.5 A and the rated voltage, disconnect the board from everything else, switch the supply on, and view both sides with the thermal camera. Ignore anything under 100 °F (about 38 °C). Raise the limit 0.5 A at a time. "DO NOT go over the current that the weakest component can handle." [P] [ACDI](https://www.acdi.com/troubleshooting-electronic-board-power-rail-shorts-with-a-thermal-camera/)
- Repair Wiki rule: "Never inject voltage beyond a rail's specified voltage or current rating." On low-voltage GPU rails it says to inject the rail's own voltage (0.75 V, 1.8 V) and warns that exceeding it will likely kill the core. It also notes that thermal detection works poorly at very low injection voltages because little heat is generated. [P] (snippet) [Repair Wiki, Short Circuits](https://repair.wiki/w/Short_Circuits_-_Repair_Basics), [Repair Wiki, 1.8V rail on Navi GPUs](https://repair.wiki/w/1.8V_Rail_on_Navi_GPUs_Explained)
- Rossmann forum moderator advice for laptop boards: use a proper lab supply, set the current limit to maximum first, start injecting at 1 V and increase only if needed; never start with a high voltage, even on the main power rail (the 3 V starting point and the "even on the main rail" wording come from search summaries of other threads on the same forum). Use thick cables so the board heats and not the cables. A supply that drops out in current limit may inject nothing, so one with a true constant-current mode is needed. [P] [Rossmann Group forum, thread 65597](https://boards.rossmanngroup.com/threads/820-02098-shorted-ppbus_aon_spkramp_abc_isns-but-nothing-heats-up-even-with-10w-of-power.65597/)
- Supply handling: set the correct voltage, set the current limit to zero so the output is off, connect, then raise the current slowly. [P] DavidAlfa, [EEVblog, short finding on a PCB](https://www.eevblog.com/forum/testgear/short-finding-on-a-pcb/)
- Never hot-plug the board into a supply that is already on, because of current spikes. Use the supply's output button, and prefer a supply with no power-on overshoot. [P] masterx81, [EEVblog, short finding on a PCB](https://www.eevblog.com/forum/testgear/short-finding-on-a-pcb/)
- Current needed to see a fault thermally: a dead short on a small capacitor can show at "as low as 50ma", a partial short may need 100 to 200 mA, and a semiconductor with a thermal pad may need up to 1 A for a rise of a few degrees. [P] masterx81, [EEVblog, short finding on a PCB](https://www.eevblog.com/forum/testgear/short-finding-on-a-pcb/)

**Which side to inject on, and the shorted high-side switch rule**

- Before injecting on an input rail, rule out a shorted high-side MOSFET of a buck converter. Test: if the resistance from the input rail to the converter's output (CPU core) is lower than the resistance from the input rail to ground, the high-side FET is shorted. Moderators ask "why do people still inject voltage before discarding high-side shorted MOSFETs" and note that ohm-scale measurements alone detect CPU supply problems. [P] dukefawks and 2informaticos, [Rossmann Group forum, thread 29438](https://boards.rossmanngroup.com/threads/820-3330-dead-short-on-ppbus.29438/), (snippet) [Rossmann Group forum search results](https://boards.rossmanngroup.com/threads/820-00244-a-short-on-ppbus_g3h.42793/)
- The consequence when that check is skipped: Louis Rossmann warned in the same thread that injecting voltage would kill the integrated GPU (HD4000) fed through the shorted FETs, and advised removing those FETs first. Another poster put his success rate at about 20 percent for cases where the CPU survived a shorted CPU MOSFET on the main rail. [P] larossmann and smiba, [Rossmann Group forum, thread 29438](https://boards.rossmanngroup.com/threads/820-3330-dead-short-on-ppbus.29438/)
- A real damage report: 4.2 V injected into an iPhone main rail from a wire soldered near the PMIC, with a supply that went to 5.16 A, produced "pop" and a puff of smoke, and the damaged part was never identified. The answer given was to protect with a small fuse, "say .5A", and to start an adjustable supply at low current. [P] [iFixit Answers 593751](https://jp.ifixit.com/Answers/View/593751/Looking+for+a+short+on+VCC+MAIN,+injected+4.2v+blew+component)
- Logic-family protection diodes are only rated for about 10 mA (CD4000B) or about 20 mA (74HC): "50 or even 100mA will lead to local overheating on the chip with nasty side effects." This is the argument for keeping injected voltage below a diode drop when the current path is not certain. [P] commenter hartl, [Hackaday, short circuit tracer for a buck](https://hackaday.com/2022/03/10/short-circuit-tracer-for-a-buck/)

**Finding the hot part**

- Thermal camera: a shorted section shows hotter than it should, which works "in many, but not all cases". [P] [iFixit, microsoldering school day two](https://www.ifixit.com/News/98564/microsoldering-school-day-two-to-fix-the-problem-you-first-have-to-find-the-problem)
- Sensitivity: a thermal camera spots a rise of about 2 °C, a finger only notices about 7 to 10 °C. [P] masterx81, [EEVblog, short finding on a PCB](https://www.eevblog.com/forum/testgear/short-finding-on-a-pcb/)
- Differential mode: showing temperature change since power was applied, a change as small as 0.1 °C is enough to identify a short. [N] (snippet) [EE World](https://www.eeworldonline.com/?p=435766)
- Reading the image: colours show relative, not absolute, temperature, so use the spot readout. Bare metal usually shows as a false hot spot. Confirm the location by touching a warmed metal pointer to the spot, since the visual overlay may be misaligned. [P] [ACDI](https://www.acdi.com/troubleshooting-electronic-board-power-rail-shorts-with-a-thermal-camera/)
- Interpreting what is warm: a hot capacitor is likely the fault, remove it and re-measure, and repeat because more may be found. A warm inductor or ferrite bead may be normal (it is in the current path), remove it and repeat for more clues. A warm board area with no part suggests a solder bridge. No warm spot at all suggests a large solder short or a PCB short "that can handle all the current and more that you applied". [P] [ACDI](https://www.acdi.com/troubleshooting-electronic-board-power-rail-shorts-with-a-thermal-camera/)
- A component that gets warm is in the short path but may be a victim and not the fault. A short that persists after the suspect is removed is elsewhere. [N] [EE notebook, short between nets](https://applied-ee.github.io/ee-notebook/docs/measurement/continuity-connections/short-between-nets)
- Finger: usable for low-voltage boards only. [N] [EE notebook, short between nets](https://applied-ee.github.io/ee-notebook/docs/measurement/continuity-connections/short-between-nets). Also listed with IR thermometer, thermocouple, smell and smoke. [P] jeroen79, [EEVblog, how to find short](https://www.eevblog.com/forum/beginners/how-to-find-short/)
- Isopropyl alcohol: wet the board, apply limited current and watch where it evaporates first. Attributed on the forum to Louis Rossmann. Liquid flux is used the same way. [P] Brumby, [EEVblog, how to find short](https://www.eevblog.com/forum/beginners/how-to-find-short/); Specmaster and Whales, [EEVblog, short finding on a PCB](https://www.eevblog.com/forum/testgear/short-finding-on-a-pcb/)
- Freeze spray, frost method: spray the powered board, let ambient moisture frost it within a few seconds (a duster, or the can held upside down, speeds this), and watch the thaw. "If an area melts faster than the rest, it indicates the fault position." [V] [Techspray](https://techspray.com/using-freeze-spray-to-diagnose-faulty-electronics)
- Freeze spray risk: the liquid refrigerant, the plastic straw and the spray head can build static charge, and a wrist strap does not protect against that. An anti-static formulation exists for sensitive work. [V] [Techspray](https://techspray.com/using-freeze-spray-to-diagnose-faulty-electronics)
- Thermal failure cases: a short inside a large FPGA did not show on the camera and needed a millivolt meter (nctnico, [EEVblog](https://www.eevblog.com/forum/testgear/short-finding-on-a-pcb/)). A ThinkPad X280 short drew about 4.9 A at 1.5 V with nothing visibly heating; replies said to check the other side of the board (snippet, [badcaps](https://www.badcaps.net/forum/troubleshooting-hardware-devices-and-electronics-theory/troubleshooting-laptops-tablets-and-mobile-devices/3158375-lenovo-x280-short-on-board-voltage-injection-pulling-4-9a-but-nothing-heating-up)). A liquid-damaged MacBook line reading about 2.8 ohms was fed about 10 W with only a nearby part warming slightly ([Rossmann forum 65597](https://boards.rossmanngroup.com/threads/820-02098-shorted-ppbus_aon_spkramp_abc_isns-but-nothing-heats-up-even-with-10w-of-power.65597/)). With IPA, a healthy 0.1 ohm resistor was the warmest part on one board, a false lead (snippet, [badcaps 89908](https://www.badcaps.net/forum/troubleshooting-hardware-devices-and-electronics-theory/troubleshooting-desktop-motherboards-graphics-cards-and-pc-peripherals/89908-finding-a-dead-short-component?p=1597884)).

**Gradient tracing: millivolts, milliohms, and tone meters**

- Principle: pass a known current through the short and measure the voltage along the rail. The reading falls as the probe nears the short; the point of lowest voltage (or lowest resistance) is the short. [N] [EE notebook, short between nets](https://applied-ee.github.io/ee-notebook/docs/measurement/continuity-connections/short-between-nets); [P] PeteH, [EEVblog](https://www.eevblog.com/forum/testgear/short-finding-on-a-pcb/)
- Resolution needed: at 0.5 A, a meter resolving 1 mV gives about 2 milliohms and one resolving 0.1 mV gives about 0.2 milliohm (bktemp). A cheap 3.5 digit meter on its 200 mV range resolves about 100 µV, about 100 micro-ohms at 1 A (Gyro). xavier60 passes 500 mA and wants "10uV resolution or better". Measure at the board, not at the supply leads. [P] [EEVblog, how to find short](https://www.eevblog.com/forum/beginners/how-to-find-short/)
- Ground-side variant: with 500 mA flowing, the shorted part has the highest voltage on its ground end compared with the rest of the ground plane. [P] xavier60, [EEVblog, how to find short](https://www.eevblog.com/forum/beginners/how-to-find-short/)
- Analog Devices describes the same method for multi-layer power planes: a constant DC source between the power and ground layers, a microvolt meter, and the short located at the lowest voltage. [V] (snippet) [Analog Devices, locating shorts on power planes](https://www.analog.com/en/resources/technical-articles/locating-shorts-on-power-planes-of-multi-layer-pcbs.html)
- Milliohm meters: around 1 to 4 milliohms of resolution is needed; a 2-wire probe reaches 10 to 20 milliohms at best, so 4-wire (Kelvin) probing is "mandatory" (kripton2035). Near a dead short the reading falls to roughly 0.3 to 0.1 ohm and a 4.5 digit meter is needed to see the change (MosherIV). A counterpoint: 4-wire is not required if only the trend, rising or falling, is watched (matkar). [P] [EEVblog, short finding on a PCB](https://www.eevblog.com/forum/testgear/short-finding-on-a-pcb/), [EEVblog, how to find short](https://www.eevblog.com/forum/beginners/how-to-find-short/)
- Low-cost version: a constant-current source of about 50 mA (an LM317 with a resistor, or a bench supply limited to 50 or 100 mA) through the board, read as a voltage drop with a multimeter. Probe contact resistance can exceed the short's resistance, which is why real milliohm meters use four probes. [P] [Hackaday, short circuit tracer for a buck](https://hackaday.com/2022/03/10/short-circuit-tracer-for-a-buck/)
- Tone meters (Polar ToneOhm, Short Squeek, Shorty, HY-TRAK 100D) turn resistance into pitch, so the eyes stay on the board; regarded as faster than a numeric milliohm meter. [P] 1audio, AndrewBCN, shakalnokturn, [EEVblog, short finding on a PCB](https://www.eevblog.com/forum/testgear/short-finding-on-a-pcb/)
- Heat or cold as a probe for the gradient method: with a sensitive meter across the rail, hot air or freeze spray over the faulty part changes the reading sharply ("your meter will go wazzo when directly over the short"); in one 4-wire case freeze spray on the faulty device changed the reading by "a few milliohm". [P] ThomasC, [Hackaday](https://hackaday.com/2022/03/10/short-circuit-tracer-for-a-buck/); Smith, [EEVblog](https://www.eevblog.com/forum/testgear/short-finding-on-a-pcb/)
- Limits: gradient tracing "doesn't work very well" for a short inside a large BGA; check the decoupling capacitors under it. On multi-layer boards the short may be on an internal layer. [P] xavier60 and Gyro, [EEVblog, how to find short](https://www.eevblog.com/forum/beginners/how-to-find-short/); [N] [EE notebook](https://applied-ee.github.io/ee-notebook/docs/measurement/continuity-connections/short-between-nets)

**Removing parts and splitting the rail**

- Remove parts from the shorted rail one at a time and re-measure after each; test the removed part on its own. Without a thermal camera this is the main fallback. [P] MattHollands and jeroen79, [EEVblog, how to find short](https://www.eevblog.com/forum/beginners/how-to-find-short/)
- Cracked ceramic capacitors are the first parts to pull; multilayer ceramics across a battery or input rail are a recurrent cause. [P] senso, [EEVblog, how to find short](https://www.eevblog.com/forum/beginners/how-to-find-short/)
- A warm inductor or ferrite bead is a splitting point: remove it and repeat the test, and the short stays on one side only. [P] [ACDI](https://www.acdi.com/troubleshooting-electronic-board-power-rail-shorts-with-a-thermal-camera/)
- Isolating loads on a shared rail: disconnect one subsystem at a time by removing it, pulling a connector, cutting a trace or holding it in reset, and test after each step. Boards designed for service include zero-ohm links for this. [N] [EE notebook, fault isolation strategies](https://applied-ee.github.io/ee-notebook/docs/debugging/fault-isolation)
- On a board with many decoupling capacitors, cutting the supply trace to isolate sections and repairing the cuts afterwards is used as a last resort. [P] commenter Thomas, [Hackaday](https://hackaday.com/2022/03/10/short-circuit-tracer-for-a-buck/); nigelwright7557, [EEVblog](https://www.eevblog.com/forum/testgear/short-finding-on-a-pcb/)
- Destructive last resorts: drilling out a suspect via, sanding layers, cutting the board into sections. Removing components shows whether the part or the board is at fault. X-ray is the non-destructive option for shorts under BGA, LGA and QFN packages. [N] [Altium](https://resources.altium.com/p/how-test-short-circuit-pcb)
- Brute force exists but is not controlled: a 15 A lab supply as a last resort while looking for smoke (rfclown), and traces "can generally handle a couple amps" (Seekonk). Excess current can stress or blow thin traces (masterx81, Smith). [P] [EEVblog, short finding on a PCB](https://www.eevblog.com/forum/testgear/short-finding-on-a-pcb/), [EEVblog, how to find short](https://www.eevblog.com/forum/beginners/how-to-find-short/)

### Inferences

- The sources split into two schools on current: failure-analysis and general repair sources start at 50 to 500 mA, while Rossmann forum moderators working on laptop main rails set the current limit to maximum and control the voltage (start 1 V). The laptop advice assumes thick planes and shorts of a few milliohms that need amps to dissipate anything. For a 5 V consumer board with thin traces and a small driver IC, the low-current school is the safe default: start at 0.5 V or less and 100 to 200 mA, cap at about 1 A, and stop at 50 °C on any part.
- The dissipated power is P = I squared times R, so a 0.05 ohm dead short at 0.5 A dissipates about 12 mW and will not show on a finger or under alcohol, while a 2 ohm partial short at 0.5 A dissipates 0.5 W and shows quickly. This explains the cited failure cases and suggests a selection rule: measured short above about 1 ohm, use thermal methods; below about 0.2 ohm, go straight to gradient tracing or part removal.
- "Which side of a regulator" as a rule, synthesized from the cited Rossmann and Repair Wiki material: inject onto the shorted rail itself, at that rail's nominal voltage or less. If the shorted rail is a regulator's output, connect at the output (inductor or output capacitor) and never apply the input-rail voltage there. If the shorted rail is an input rail feeding switching converters, first check that no converter's high-side switch is shorted (input-to-output resistance lower than input-to-ground resistance), because then the injected input voltage lands on the low-voltage load. No source read states this as one sentence.
- Keeping the injected voltage under about 0.5 V (Gyro's limit) means no silicon junction on the board can conduct, so the current can only flow through the actual short. That makes the sub-0.5 V gradient method the lowest-risk powered technique for an unskilled user.

### Gaps

- No source gives a measured success rate for any localization method. The only percentage found is one forum member's roughly 20 percent rate of the CPU surviving a shorted CPU MOSFET. iFixit says the thermal camera works "in many, but not all cases".
- No source read documents the rosin or flux smoke method (heating rosin onto the board so it melts or smokes at the hot part) beyond the mention that liquid flux and "flux atomizers" are used like alcohol.
- NorthridgeFix, iPad Rehab, Electronics Repair School (Sorin), Learn Electronics Repair (Richard), Big Clive and Mend It Mark publish mainly as video; no text of theirs was retrieved, so their specific numbers are not represented.
- Sam Goldwasser's FAQ could not be reached (DNS failure on repairfaq.org), so its series light bulb current limiter is not cited.
- Trace current capacity ("a couple of amps") is a single forum remark. No IPC-2221 based safe-current figure for typical 0.2 to 0.3 mm traces was collected.

## 4. Power-on checks: rail voltages, ripple, sag, enables, reset, clocks

### Takeaway

Powered diagnosis always starts with the rails, measured at the load's supply pin and under load, against a 5 percent window; then clock, then reset, then signals. A multimeter confirms steady values only; dips, ripple and reset glitches need a scope with single-shot triggering.

### Cited Findings

**Order of work**

- Power first, then clocks, then signals: check that supply voltage is present and correct, including under load; confirm the oscillator runs and reaches the IC; then trace signals from input toward output. Do not measure the symptom first, because "power faults masquerade as everything else". [N] [EE notebook, triage and first response](https://applied-ee.github.io/ee-notebook/docs/debugging/triage-and-first-response)
- Before power: look (charring, bulging capacitors, cracked packages, solder bridges), smell (burnt, electrolyte), listen, touch after power-off. If something looks or smells burnt, "don't power it up again until the cause is understood." [N] [EE notebook, triage and first response](https://applied-ee.github.io/ee-notebook/docs/debugging/triage-and-first-response)
- Microcontroller that does not run, in order: power and ground pins (inspect under a microscope), oscillator, reset circuit (is reset held low long enough, and not stuck low), then the errata sheet. [N] [Purdue ECE 477, systematic debugging slides](https://engineering.purdue.edu/ece477/Course/Lectures/ToSource/Slides/10-Debugging.pdf)

**Rail voltage tolerance**

- USB 2.0 allows 5 percent on the nominal 5 V, a host range of 4.75 to 5.25 V; with worst-case cable and connector drop the voltage at the load can be as low as 4.35 V. [V] (snippet) [TI reference design TIDUF26](https://ti.com/document-viewer/lit/html/TIDUF26/GUID-6FEF7EB9-D30E-40CF-AAB2-676BA10F3841)
- A later USB engineering change raised the upper VBUS limit to 5.50 V. [V] (snippet) [USB 3.1 ECN, VBUS max limit](https://doc.xdevs.com/doc/Standards/USB%203.1/usb_31_030215/ECNs/USB%203.1%20ECN%20VBUS%20Max%20Limit.pdf)
- A Microchip device's supply conditions: 3.3 V rail 3.135 to 3.465 V, 5 V rail 4.75 to 5.25 V (both 5 percent). [V] (snippet) [Microchip electrical characteristics](https://onlinedocs.microchip.com/oxy/GUID-FAA05C30-286C-48ED-929F-AF87B46D8887-en-US-1/GUID-E7FF3F95-993A-40AE-BAFC-38CA521C035C.html)
- Compare a measured DC output against the manufacturer's rated output; Fluke gives no percentage. Set the meter to DC volts, on a manual-range meter one range above the expected voltage. [V] [Fluke, troubleshooting DC power supplies](https://www.fluke.com/en-us/learn/blog/predictive-maintenance/troubleshooting-dc-power-supply-with-digital-multimeter)
- Measure at the IC's supply pin, not at the regulator output. [N] [EE notebook, failure modes and patterns](https://applied-ee.github.io/ee-notebook/docs/debugging/failure-modes-and-patterns)
- Symptom to cause for a regulator: no output, check the input voltage, then the output impedance (a shorted load), then replace the regulator. Output over or under specification, check the regulator's ground pin and its solder joint. Output drops when the load is connected, bad regulator or load impedance too low (partial short). Excessive heat, input too high or load partially shorted. Excessive ripple, check filter capacitor size and input ripple. [N] [Purdue ECE 477](https://engineering.purdue.edu/ece477/Course/Lectures/ToSource/Slides/10-Debugging.pdf)
- A regulator that oscillates shows a low output, runs hot and may improve with added load. Find it with the scope's bandwidth limit off at 100 ns/div or faster; a 20 MHz limit hides a 50 MHz oscillation. [N] [EE notebook, failure modes and patterns](https://applied-ee.github.io/ee-notebook/docs/debugging/failure-modes-and-patterns)
- Repair Wiki: a rail stuck at zero, or failing to reach its specified voltage, may indicate a short. [P] (snippet) [Repair Wiki, Short Circuits](https://repair.wiki/w/Short_Circuits_-_Repair_Basics)

**Ripple and sag**

- Ripple with a multimeter: set AC volts, which on most meters rejects the DC component and reads the AC-coupled RMS value. Percent ripple = AC RMS reading divided by the DC reading, times 100. [V] (snippet) [Fluke KA-02761](https://my.fluke.com/en-us/article/KA-02761), [Fluke, facts about true-rms](https://www.fluke.com/ko-kr/learn/blog/digital-multimeters/facts-about-true-rms-measurement)
- Meter check for this method: with the probes on a clean DC source in AC mode, the reading should settle to zero within a second or two; if it does, the meter blocks DC and can read AC on DC. A handheld meter may not resolve 1 to 2 mV of ripple. [P] (snippet) [diyAudio forum](https://www.diyaudio.com/community/goto/post?id=4425705)
- Meter bandwidth limits the method: a Fluke 88V measures AC only to 5 kHz, well below switching-regulator and PWM frequencies. [V] (snippet) [Fluke, alternator ripple with a multimeter](https://www.fluke.com/en-us/learn/blog/digital-multimeters/how-to-test-alternator-ripple-voltage-with-a-multimeter)
- The only numeric DMM ripple limits found are automotive, for a 14 V system: 50 mV AC or less desirable, 0.05 to 0.10 V caution, 0.30 to 0.50 V or more a fault. [V] (snippet) [Fluke, alternator ripple with a multimeter](https://www.fluke.com/en-us/learn/blog/digital-multimeters/how-to-test-alternator-ripple-voltage-with-a-multimeter)
- A multimeter gives a single snapshot and cannot detect transients, noise, ripple detail or intermittent sag; Fluke recommends an oscilloscope for those. [V] [Fluke, troubleshooting DC power supplies](https://www.fluke.com/en-us/learn/blog/predictive-maintenance/troubleshooting-dc-power-supply-with-digital-multimeter)
- Capturing a dip: arm the scope in single-shot mode so it waits for the trigger and freezes the event; trigger on a falling edge at the threshold of interest. [V] (snippet) [Fluke, ABCs of portable oscilloscopes part 5](https://fluke.com/en-ie/learn/blog/oscilloscopes/abcs-of-portable-oscilloscopes-part-5-capturing-intermittent-and-random-events-with-a-portable-oscilloscope); [N] (snippet) [EE notebook, power sequencing](https://applied-ee.github.io/ee-notebook/docs/measurement/power-rails-supplies/power-sequencing)
- Brownout signature: dips under load cause random resets or crashes, and parts may misbehave instead of stopping. Example values: a 3.3 V rail reading 2.8 V is a brownout. Scope the supply during the fault. [N] [EE notebook, failure modes and patterns](https://applied-ee.github.io/ee-notebook/docs/debugging/failure-modes-and-patterns), [EE notebook, triage](https://applied-ee.github.io/ee-notebook/docs/debugging/triage-and-first-response)
- Slow intermittents: log a critical rail with a meter in logging mode, or leave the scope armed and walk away, since hovering with a probe changes the thermal environment. [N] [EE notebook, thermal and intermittent faults](https://applied-ee.github.io/ee-notebook/docs/retro-legacy/testing-and-troubleshooting/thermal-and-intermittent-faults/)

**Enable, power-good, reset**

- A processor's reset must stay asserted until all mandatory rails are within specification and power-good is high. [N] (snippet) [board bring-up checklist](https://dev.to/beefedai/board-bring-up-checklist-first-power-on-to-bootloader-14il)
- Measure whether the reset pin sits at its active or inactive level: "A processor held in reset looks dead but isn't broken." [N] [EE notebook, fault isolation strategies](https://applied-ee.github.io/ee-notebook/docs/debugging/fault-isolation)
- A processor that runs for a few milliseconds and resets, repeatedly: check the watchdog timer and the reset circuit. A processor that crashes when the board is moved or flexed has a cold solder joint; retouch all power and ground joints. [N] [Purdue ECE 477](https://engineering.purdue.edu/ece477/Course/Lectures/ToSource/Slides/10-Debugging.pdf)
- Brownout-reset thresholds are per device and often selectable. One TI microcontroller family has four levels (BOR0 to BOR3) and always starts at the lowest, matching its 1.62 V minimum supply. The value depends on the supply's ramp rate. [V] (snippet) [TI SLAU846A](https://ti.com/document-viewer/lit/html/SLAU846A/GUID-A81AE1B2-2792-46E8-8C7A-CF85BC20418D)
- Motor driver enable and fault pins are checkpoints too. On a DRV8833: nSLEEP low puts the driver to sleep (logic low is 0.5 V maximum, logic high 2.5 V minimum, internal 500 kilohm pull-down, up to 1 ms to wake); nFAULT is an open-drain output driven low on overcurrent or overtemperature (0.5 V maximum when low at 5 mA). [V] [TI DRV8833 datasheet](https://www.ti.com/lit/ds/symlink/drv8833.pdf)

**Clocks and crystals**

- A scope probe on the oscillator pins "can detune it enough to disable it". [N] [Purdue ECE 477](https://engineering.purdue.edu/ece477/Course/Lectures/ToSource/Slides/10-Debugging.pdf)
- A 10x probe presents about 10 megohms and about 15 pF. "If probing changes the symptom, the probe is part of the problem." [N] [EE notebook, signal tracing](https://applied-ee.github.io/ee-notebook/docs/retro-legacy/testing-and-troubleshooting/signal-tracing/)
- Microchip recommends a high-impedance 10x probe for external oscillator pins and warns that the probe's capacitance may influence the crystal. [V] (snippet) [Microchip, oscillator problems and delays](https://onlinedocs.microchip.com/oxy/GUID-D6FD9F43-8DC4-476E-A55E-AA21FA1CC865-en-US-4/GUID-40DF8F00-3CD5-4D26-95CC-108A48346A08.html)
- Workarounds reported on forums: use 10x and never 1x; add a series resistor of about 100 kilohms at the probe tip; or measure a buffered clock-output pin instead of the crystal. [P] (snippet) [All About Circuits forum](https://forum.allaboutcircuits.com/threads/crystal-oscillator-question.200524/post-1906135)
- Indirect proof of a running clock and core: a "heartbeat" pin toggled by firmware, viewed on a scope. [N] [Purdue ECE 477](https://engineering.purdue.edu/ece477/Course/Lectures/ToSource/Slides/10-Debugging.pdf)

**Probing risks while powered**

- Do not solder, attach wires or connect probes while the board is powered; a grounded iron tip or a slipped probe creates shorts. Do not probe fine-pitch surface-mount pads directly, since a momentary bridge between microcontroller pins "can be disastrous". Never tie a pin straight to a rail to force a level, always through a resistor (10 kilohms). Do not power parts of the circuit from separate external supplies driving the same net. [N] [Purdue ECE 477](https://engineering.purdue.edu/ece477/Course/Lectures/ToSource/Slides/10-Debugging.pdf)

### Inferences

- Pass/fail windows a tool can apply, derived from the 5 percent rule: 5 V rail pass 4.75 to 5.25 V at the source, and down to about 4.4 V at the far end of a USB cable is still within the USB allowance; 3.3 V rail pass 3.135 to 3.465 V. A reading below the window on the adapter side with the board connected, which recovers when the board is unplugged, points to the board (excess load) and not the adapter.
- No source gives a general ripple limit for 5 V or 3.3 V logic rails. A defensible tool rule is relative: record ripple with the load idle and again with the load running, and flag a large increase, with the caveat that a DMM's AC mode is blind above a few kilohertz and misses the PWM-frequency ripple that TI measures in section 8.
- For reset investigations the useful scope setup is: channel 1 on the MCU supply pin, channel 2 on the reset pin, single-shot, falling-edge trigger on the supply set just above the device's brownout threshold. This arrangement is inferred from the cited single-shot and "measure at the IC pin" guidance, not quoted from one source.

### Gaps

- No vendor application note with a numeric ripple limit for low-voltage logic rails was retrieved. The 50 mV figure often quoted for PC supplies was not confirmed by any source in this research.
- No Keysight, Tektronix or Rigol application note on ripple probing technique (short ground spring, 20 MHz bandwidth limit, AC coupling) was read; the only scope-setting numbers come from the EE notebook.
- Crystal amplitude and expected waveform values (what a healthy crystal pin looks like in volts) were not found.

## 5. Current-draw diagnosis with a USB power meter or bench supply

### Takeaway

The input current, read on an inline USB meter or the bench supply's display, sorts faults before any probing: zero means an open input path or a device that never asks for power, a tiny steady draw means the controller is alive but not starting, an immediate current limit or a collapsed voltage means a short on a main rail, and rhythmic pulsing means a protection circuit cycling on a shorted secondary rail or a reset loop. The published tables are for phones and laptops; the categories generalize, the numbers do not.

### Cited Findings

- Signature table from a repair shop's manual (phones and laptops on USB power): 5.1 V at 0.00 A, dead charging port or controller, the charger is live but the device does not respond. 0 V output and 0.00 A, short to ground: "Main power rail short; charger's OCP is tripping." 0.00 A and totally dead, possible blown input fuse, verify voltage past the first two input MOSFETs. 0.01 to 0.05 A at 5.1 V, dead PMIC or CPU: "Device detects charger but cannot start the boot sequence." 0.02 to 0.10 A while switched off, leaky capacitor or partial short. Pulsing current, shorted secondary rail: "Check for low resistance on inductors near CPU/GPU." Current fluctuating as the voltage goes from 5 V to 0 V, boot loop or reset. Above 1.0 A at 5 V, power path is probably working, look at software, display or battery. [P] [PNW Computers IT manual, power diagnostics](https://pnw-computers.github.io/IT-Manual/diagnostics/power_diagnostics/)
- Repair Wiki files MacBook faults by current signature: "not turning on, pulling 0.02 A at 5 V" (charger stuck at 5 V with 20 mA draw, fix around a specific controller chip) and "about 0.23 to 0.31 A at 5 V" (compare both ports; see whether one port cycles or draws a different amount). [P] (snippet) [Repair Wiki, A1708 0.02 A](https://repair.wiki/w/MacBook_Pro_A1708_Not_turning_on,_pulling_0.02A_at_5V_repair), [Repair Wiki, A2289 0.23 to 0.31 A](https://repair.wiki/w/MacBook_Pro_A2289_Not_turning_on,_~0.23-0.31A_current_draw_at_5V_repair)
- An inline USB meter also shows the voltage, and a voltage drop under load is itself a symptom. Most standard USB ports are rated for 500 mA. [P] (snippet) [Adafruit USB power gauge](https://learn.adafruit.com/adafruit-usb-power-gauge-mini-kit)
- Excess current draw has three listed causes: a short, oscillation, or latch-up. Confirm with a touch or thermal check. [N] [EE notebook, failure modes and patterns](https://applied-ee.github.io/ee-notebook/docs/debugging/failure-modes-and-patterns)
- Unplug or disable subsystems one at a time until the current draw returns to normal; the last one removed holds the fault. [P] jeroen79, [EEVblog, how to find short](https://www.eevblog.com/forum/beginners/how-to-find-short/); [N] [EE notebook, fault isolation](https://applied-ee.github.io/ee-notebook/docs/debugging/fault-isolation)
- A supply that hits its limit can read almost zero volts with high amps: in the iFixit case the supply showed the voltage going to 0 while the current went to 5.16 A. [P] [iFixit Answers 593751](https://jp.ifixit.com/Answers/View/593751/Looking+for+a+short+on+VCC+MAIN,+injected+4.2v+blew+component)
- Reference idle currents come from datasheets. A DRV8833 driver draws 1.7 mA typical (3 mA maximum) with inputs low and 1.6 µA typical (2.5 µA maximum) asleep, so a small driver IC contributes almost nothing to idle draw when healthy. [V] [TI DRV8833 datasheet](https://www.ti.com/lit/ds/symlink/drv8833.pdf)
- A pulsing current can be a motor driver's protection retrying: on a DRV8833, an overcurrent (2 A minimum, 3.3 A typical trip) disables the bridge, and the driver re-enables after 1.35 ms; "If the fault condition is still present, the cycle repeats." [V] [TI DRV8833 datasheet](https://www.ti.com/lit/ds/symlink/drv8833.pdf)

### Inferences

- Generalized signature table for a 5 V adapter board with a microcontroller, LEDs and a small motor (the categories are cited above, the adaptation is inference):

  | Observation at the input                                  | Likely class of fault                                                     | Next step                                   |
  | --------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------- |
  | 0 mA, full voltage                                        | Open input path: fuse, switch, connector, polarity diode, broken trace    | Continuity along the input path (section 6) |
  | A few mA, steady, nothing works                           | Regulator or MCU not starting: missing rail, enable, reset, clock         | Rail, reset and clock checks (section 4)    |
  | Normal idle current, one function dead                    | Fault local to that function, or its drive signal                         | Signal tracing (section 7)                  |
  | Supply in current limit at once, voltage collapsed        | Short on a main rail                                                      | Power-off rail check, then section 3        |
  | Normal idle, jump to limit or a voltage dip on one action | Fault in the load that the action switches on (motor, driver, its supply) | Load-split tests (section 8)                |
  | Rhythmic pulsing                                          | Protection retrying (driver overcurrent, supply hiccup) or a reset loop   | Scope the rail and the reset line           |

- A bench supply set to the nominal voltage with the current limit just above the known-good idle draw is a safer first power-up than the original adapter, because a fault then shows as "CC" on the supply instead of as heat on the board. No source read states this as a numbered rule, although the "start low and raise" practice in section 3 implies it.

### Gaps

- No published current-signature table exists for small appliance or embedded boards. All numeric tables found are for phones and laptops with USB Power Delivery negotiation, where 20 mA and 230 to 310 mA have model-specific meanings.
- The source for the generic table (PNW Computers) is a single shop's manual; its categories match forum practice but its numbers were not cross-checked.

## 6. Open circuits and intermittent faults

### Takeaway

Intermittents are "almost always thermal, mechanical, or marginal", so the method is to characterize the fault along four axes (temperature, position, time, load) and then provoke it locally while monitoring: tap and flex for cracked joints, freeze spray or gentle heat on one part at a time for thermal faults, wiggle for connectors. Opens are confirmed with continuity along the net and, in diode mode, by an OL where a junction should be.

### Cited Findings

- Characterize first: by temperature (heat gun or freeze spray), position (flex, wiggle, tap), time (after warm-up, hours, days) and load (full load or one operating point). [N] [EE notebook, triage and first response](https://applied-ee.github.io/ee-notebook/docs/debugging/triage-and-first-response)
- Tap test: power the circuit and monitor it (scope, meter or the output itself), then gently tap the board, components and connectors with an insulated tool. A fault that appears on a tap points to a cracked solder joint, a fractured trace or an intermittent connector contact in that area. [N] [EE notebook, thermal and intermittent faults](https://applied-ee.github.io/ee-notebook/docs/retro-legacy/testing-and-troubleshooting/thermal-and-intermittent-faults/)
- Flex test: gently flex the board while monitoring; cracks invisible under magnification can open under flex. [N] [EE notebook, thermal and intermittent faults](https://applied-ee.github.io/ee-notebook/docs/retro-legacy/testing-and-troubleshooting/thermal-and-intermittent-faults/)
- Where cracked joints are found: parts under high thermal stress (power transistors, regulators, large resistors) and connector pins, including board-to-board connectors cracked at their mounting pads. The mechanism is expansion opening the contact and contraction closing it. [N] [EE notebook, thermal and intermittent faults](https://applied-ee.github.io/ee-notebook/docs/retro-legacy/testing-and-troubleshooting/thermal-and-intermittent-faults/), [EE notebook, failure modes and patterns](https://applied-ee.github.io/ee-notebook/docs/debugging/failure-modes-and-patterns)
- Freeze spray, selective cooling: cool individual components or small areas, never the whole board, starting with the most suspect (electrolytic capacitors, semiconductors on heatsinks, joints near heat sources). If the fault appears or disappears when one part is cooled, that part is temperature sensitive. [N] [EE notebook, thermal and intermittent faults](https://applied-ee.github.io/ee-notebook/docs/retro-legacy/testing-and-troubleshooting/thermal-and-intermittent-faults/)
- Manufacturer's procedures: for a unit that overheats and shuts down, spray suspect areas until it restarts. For bad joints, spray isolated areas of the energized unit until it fails; the thermal shock opens cold, loose or brittle joints. Freeze spray also helps locate hairline cracks in stressed traces. [V] [Techspray](https://techspray.com/using-freeze-spray-to-diagnose-faulty-electronics)
- Heat: warm one area gently with a heat gun or a hot-air tool on low to reproduce a fault that appears after warm-up; the goal is the part's failing temperature, not desoldering. A board that works cold and fails after "15-20 minutes of operation" has a thermally marginal component. [N] [EE notebook, thermal and intermittent faults](https://applied-ee.github.io/ee-notebook/docs/retro-legacy/testing-and-troubleshooting/thermal-and-intermittent-faults/)
- Risks: cooling below the dew point leaves condensation that can bridge closely spaced traces, so let the board return to room temperature and dry before drawing conclusions. Freeze spray can generate static. [N] [EE notebook, thermal and intermittent faults](https://applied-ee.github.io/ee-notebook/docs/retro-legacy/testing-and-troubleshooting/thermal-and-intermittent-faults/); [V] [Techspray](https://techspray.com/using-freeze-spray-to-diagnose-faulty-electronics)
- Reflow as a test and a fix: for a processor that crashes when the board is moved, retouch all power and ground solder joints. Random digital inputs and inconsistent ADC readings are also traced to cold joints (a cold joint "can act like a capacitor"). [N] [Purdue ECE 477](https://engineering.purdue.edu/ece477/Course/Lectures/ToSource/Slides/10-Debugging.pdf)
- Visual inspection targets: solder bridges, cracked or blobbed joints, tin whiskers, burn marks (brown instead of green solder mask), poorly plated vias. Use a magnifier or low-power microscope. [N] [Altium](https://resources.altium.com/p/how-test-short-circuit-pcb)
- Opens in diode mode: OL where the reference shows a junction means "a break in the line where there shouldn't be". [P] [iFixit, microsoldering school day two](https://www.ifixit.com/News/98564/microsoldering-school-day-two-to-fix-the-problem-you-first-have-to-find-the-problem)
- Open trace and via signatures: an open trace gives an open circuit on a continuity test and a hairline crack under magnification; a delaminated via gives an intermittent open and a visible ring separation. Corrosion undercutting the copper is one cause. [N] (snippet) [JLCPCB, how to repair a PCB](https://jlcpcb.com/blog/how-to-repair-pcb)
- Liquid damage: corrosion shows as green or white deposits, especially on connector pins; inspect at 10x or more, then check continuity. The recommended order is visual inspection, continuity, voltage mapping, then thermal checks, before any soldering. Liquid produces unpredictable shorts, corrosion and latent faults that show up intermittently. [N] [EE notebook, failure modes and patterns](https://applied-ee.github.io/ee-notebook/docs/debugging/failure-modes-and-patterns); (snippet) [liquid-damage diagnostics guide](https://dev.to/apex_/advanced-component-level-diagnostics-pinpointing-trace-and-power-failures-on-liquid-damaged-27pj)
- Liquid damage can destroy inner layers: on one MacBook a capacitor blew and damaged a layer or two beneath it, and the line stayed shorted after the part was removed. [P] [Rossmann Group forum, thread 65597](https://boards.rossmanngroup.com/threads/820-02098-shorted-ppbus_aon_spkramp_abc_isns-but-nothing-heats-up-even-with-10w-of-power.65597/)

### Inferences

- A continuity test only proves a connection at the meter's tiny test current. For a net that carries motor or LED current, a voltage-drop test under load is the stronger check: with the load running, measure the voltage between the two ends of the same net (connector pin to IC pin); anything beyond a few tens of millivolts on a short trace indicates a resistive joint, crack or corroded via. This is the same principle as the gradient tracing in section 3, applied to opens. It is not stated in this form by a source that was read.
- Tap and flex tests should be done with the monitoring instrument already armed (single-shot scope or a logging meter on the rail), since the event may last milliseconds.

### Gaps

- No source gives numbers for freeze spray temperatures, hot-air settings for stress testing, tap force or flex limits. Techspray gives none, and the EE notebook gives only the 15 to 20 minute warm-up figure.
- No practitioner text was found on wiggle-testing connectors and flat-flex cables beyond the general "wiggle" axis.
- Goldwasser's material on intermittents and bad solder joints could not be retrieved.

## 7. Signal tracing and half-splitting

### Takeaway

Once power, clock and reset are proven, a missing function is found by checking the signal at the midpoint of its chain and halving the remaining section each time, which reaches the faulty stage in about log2(N) measurements. Where there is no natural signal, a known one is injected or a level is forced through a resistor.

### Cited Findings

- Half-split procedure: identify the full chain from input to output or from source to load; pick a midpoint that can be probed or disconnected; if the signal is correct there the fault is in the second half, otherwise in the first; repeat. "For a 16-stage signal chain, at most 4 measurements are needed to find the faulty stage." It applies to audio chains, digital data paths and power distribution. [N] [EE notebook, fault isolation strategies](https://applied-ee.github.io/ee-notebook/docs/debugging/fault-isolation)
- Efficiency: the failing stage is reached in log2(N) steps. A military maintenance manual puts it at about half the measurements of serial tracing on an 8-stage circuit. [N] [EE notebook, signal tracing](https://applied-ee.github.io/ee-notebook/docs/retro-legacy/testing-and-troubleshooting/signal-tracing/); [V] (snippet) [US Army TM 9-254](https://firetrucksandequipment.tpub.com/TM-9-254/css/TM-9-254_231.htm)
- Signal injection: inject a known signal (a 1 kHz sine for audio) at a stage's input and probe its output; if it is present the stage works. Injecting in reverse order from the output back, the first stage where injection gives no output is the failing one. [N] [EE notebook, signal tracing](https://applied-ee.github.io/ee-notebook/docs/retro-legacy/testing-and-troubleshooting/signal-tracing/)
- Forcing known states: tie an input high or low to see whether downstream logic responds; replace a sensor with a fixed voltage; power a section from a clean bench supply. [N] [EE notebook, fault isolation strategies](https://applied-ee.github.io/ee-notebook/docs/debugging/fault-isolation)
- Forcing rule: never connect a port pin directly to a supply rail to get a 1 or a 0, since a pin configured as an output will be destroyed. Always use a resistor, 10 kilohms being a good value. [N] [Purdue ECE 477](https://engineering.purdue.edu/ece477/Course/Lectures/ToSource/Slides/10-Debugging.pdf)
- Digital symptom to cause: an output always high or always low is most likely a "stuck at" fault in the pin's driver, and the fix is another pin or a new microcontroller. The same value on adjacent pins means a solder bridge. Random input values mean a floating input or a cold joint. A microcontroller too warm to touch means outputs fighting each other or a pin sourcing too much current. [N] [Purdue ECE 477](https://engineering.purdue.edu/ece477/Course/Lectures/ToSource/Slides/10-Debugging.pdf)
- Probe loading: a 10x probe is about 10 megohms and 15 pF, negligible at low frequency. [N] [EE notebook, signal tracing](https://applied-ee.github.io/ee-notebook/docs/retro-legacy/testing-and-troubleshooting/signal-tracing/)
- Hardware or firmware: hardware is indicated when the failure persists across known-good firmware, rails are wrong or noisy, there is no clock or debug activity, or symptoms track temperature or mechanical stress. [N] [EE notebook, triage and first response](https://applied-ee.github.io/ee-notebook/docs/debugging/triage-and-first-response)
- Do not deep-dive into components before the stage is narrowed down, which wastes time measuring good parts in a working section. [N] (snippet) [EE notebook, signal tracing](https://applied-ee.github.io/ee-notebook/docs/retro-legacy/testing-and-troubleshooting/signal-tracing/)

### Inferences

- For a motor function the chain is: button, MCU input pin, MCU output pins (the driver's IN pins), driver outputs, motor connector, motor. The natural midpoint is the driver's input pins. If the inputs toggle correctly when the button is pressed and the outputs do not follow, the fault is the driver or its supply; if the inputs never move, the fault is upstream (button, MCU, firmware). On a DRV8833 the outputs should follow the inputs within about 1.1 µs, so "inputs correct, outputs wrong" is a clean verdict.
- A multimeter can stand in for a scope on slow, steady signals (a pin held high while a button is pressed), which makes half-splitting possible with a multimeter alone as long as the signal is not PWM.

### Gaps

- No source read covers logic probes specifically, or gives logic-level pass/fail thresholds for 3.3 V and 5 V CMOS (input high and low limits). Those should come from the specific IC datasheet.
- No oscilloscope vendor note (Tektronix, Keysight, Rigol) on signal tracing was retrieved.

## 8. Brownout or reset when a motor starts

### Takeaway

A reset at motor start is either a supply dip (low-frequency, cured by bulk capacitance or a stiffer source) or noise coupling (high-frequency, cured by decoupling and layout), or an excessive current demand from a faulty load (shorted winding, stalled mechanism, damaged driver). Professionals separate these by scoping the rail at the MCU pin during the event, by powering the logic and the motor from separate sources, and by disconnecting the motor to see whether the fault follows the load or stays with the driver.

### Cited Findings

**Why the rail dips, and how much is normal**

- If local bulk capacitance is too small, "the system responds to excessive current demands or dumps from the motor with a change in motor supply voltage." The inductance between the supply and the driver limits how fast the supply can deliver current. [V] [TI SLVAFT0, bulk capacitor sizing](https://www.ti.com/lit/pdf/slvaft0)
- Rule of thumb: at least 1 to 4 µF of bulk capacitance per watt of motor power. [V] [TI SLVAFT0](https://www.ti.com/lit/pdf/slvaft0)
- Sizing formula with real capacitors: C_bulk > k × ΔI_motor × T_pwm / ΔV_supply, with k of about 3 to account for ESR. Ideal example: 200 mA of current variation at 20 kHz (50 µs) with 100 mV allowed gives 100 µF. [V] [TI SLVAFT0](https://www.ti.com/lit/pdf/slvaft0)
- Measured ripple on a 12 V evaluation board at 50 percent duty into a 3 ohm, 470 µH load: 120 µF gave almost 500 mV, 270 µF gave about 160 mV (80 mV was predicted for an ideal capacitor), 600 µF gave about 57 mV (36 mV predicted). [V] [TI SLVAFT0](https://www.ti.com/lit/pdf/slvaft0)
- ESR matters as much as capacitance: simulating the 270 µF case, 0 ohm ESR gave about 100 mV of ripple and 50 milliohms gave about 200 mV. The ESR shows on the scope as a sharp step at each switching edge, on top of the charge and discharge ramp. [V] [TI SLVAFT0](https://www.ti.com/lit/pdf/slvaft0)
- A driver datasheet gives a minimum, not a guarantee: DRV8833 asks for a 10 µF minimum ceramic on VM, and states that "system-level testing is required to determine the appropriate sized bulk capacitor." [V] [TI DRV8833 datasheet](https://www.ti.com/lit/ds/symlink/drv8833.pdf)
- Inrush: a small-vendor guide puts motor start current at 5 to 10 times rated current for 50 to 200 ms, and says the ESP32's brownout detector resets the chip at about 2.9 V. [N] (snippet) [Industrial Monitor Direct, ESP32 motor surge](https://industrialmonitordirect.com/blogs/knowledgebase/esp32-24v-dc-motor-surge-protection-circuit-design)
- A linear regulator needs headroom throughout the inrush: one guide requires a 5 V regulator's input to stay above 7.5 V at all times. [N] (snippet) [Industrial Monitor Direct, PICAXE motor EMI](https://industrialmonitordirect.com/blogs/knowledgebase/suppressing-motor-emi-on-picaxe-28x1-wiring-decoupling-guide)

**Thresholds at which things reset**

- DRV8833 undervoltage lockout: VM falling threshold 2.6 V maximum; the protection table lists the bridge disabled below 2.5 V and recovery above 2.7 V, and all internal logic is reset. [V] [TI DRV8833 datasheet](https://www.ti.com/lit/ds/symlink/drv8833.pdf)
- DRV8833 overcurrent: trip level 2 A minimum, 3.3 A typical, 4 µs deglitch, retry after 1.35 ms, nFAULT low while tripped. Thermal shutdown at 150 °C minimum, 160 °C typical. "A short to ground, supply, or across the motor winding will all result in an overcurrent shutdown." [V] [TI DRV8833 datasheet](https://www.ti.com/lit/ds/symlink/drv8833.pdf)
- MCU brownout thresholds are device specific and often configurable (one TI family starts at its lowest level, for a 1.62 V minimum supply). [V] (snippet) [TI SLAU846A](https://ti.com/document-viewer/lit/html/SLAU846A/GUID-A81AE1B2-2792-46E8-8C7A-CF85BC20418D)

**Separating dip from noise from a faulty load**

- First check: supply droop at the moment of motor start, with an oscilloscope. A multimeter can miss short transients. [P] [DigiKey TechForum, STM32 resets when motor starts](https://forum.digikey.com/t/stm32-based-motor-controller-randomly-resets-when-dc-motor-starts/69814)
- Second question: do the resets happen only at start-up, or also at sudden load changes while running? [P] [DigiKey TechForum](https://forum.digikey.com/t/stm32-based-motor-controller-randomly-resets-when-dc-motor-starts/69814)
- Split test: "temporarily power the microcontroller via a battery" to tell noise from supply dips. If the resets stop, the shared supply was dipping; if they continue, the cause is noise coupling or the return path. [P] APDahlen (DigiKey staff), [DigiKey TechForum](https://forum.digikey.com/t/stm32-based-motor-controller-randomly-resets-when-dc-motor-starts/69814)
- Quick mitigation that doubles as a test: a series diode on the MCU supply (with its local capacitor after it) lets the MCU ride through the dip. Others: bulk capacitance near the driver, a flyback diode where applicable, ferrite beads on the logic supply, separate return paths. [P] [DigiKey TechForum](https://forum.digikey.com/t/stm32-based-motor-controller-randomly-resets-when-dc-motor-starts/69814)
- Capacitor substitution as a test: in one case 0.1 µF decoupling capacitors did not stop the resets and a 1000 µF capacitor across the MCU supply did, which identifies low-frequency droop. In the same case the meter showed a steady 4.95 V, so the multimeter had missed the dip. [P] (snippet) [Parallax forum](https://forums.parallax.com/discussion/comment/890920)
- Flyback diodes clamp inductive kickback and protect the switching device; they do little for supply droop. They belong close to the motor terminals (within 25 mm in one guide). [N] (snippet) [Industrial Monitor Direct, PICAXE motor EMI](https://industrialmonitordirect.com/blogs/knowledgebase/suppressing-motor-emi-on-picaxe-28x1-wiring-decoupling-guide)

**Bulk capacitor and ESR checks**

- ESR rises with age and is worse when hot. [N] [EE notebook, failure modes and patterns](https://applied-ee.github.io/ee-notebook/docs/debugging/failure-modes-and-patterns)
- Typical good ESR and suspect limits at 100 kHz, 20 °C: 10 µF 25 V, 1 to 5 ohms, suspect above 10 ohms. 100 µF 25 V, 0.1 to 0.5 ohm, suspect above 2 ohms. 1000 µF 16 V, 0.02 to 0.1 ohm, suspect above 0.5 ohm. 1000 µF 50 V, 0.05 to 0.2 ohm, suspect above 1 ohm. 4700 µF 25 V, 0.01 to 0.05 ohm, suspect above 0.3 ohm. [N] [EE notebook, ESR, leakage, gain](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/esr-leakage-gain)
- ESR meter facts: test signal 50 to 100 kHz at about 40 mV peak (other meters 0.1 to 0.3 V), low enough not to turn on silicon junctions (about 0.6 V), so in-circuit testing is possible. Range typically 0.00 to 40 ohms with 0.01 ohm resolution; 40 ohms or more means a dead capacitor. Capacitors under about 0.3 µF cannot be tested this way. [N] [EE notebook, ESR meter](https://applied-ee.github.io/ee-notebook/docs/measurement/test-instruments/esr-meter)
- ESR procedure and traps: discharge the capacitor first, through about 100 ohms and not a screwdriver. A suspiciously low in-circuit reading may be a parallel path, so lift one lead for a definitive result. A shorted capacitor reads as a perfect ESR, so check for a short and check capacitance too. ESR alone does not reveal partial dry-out. [N] [EE notebook, ESR meter](https://applied-ee.github.io/ee-notebook/docs/measurement/test-instruments/esr-meter); (snippet, the page behind the shorted-capacitor warning was not identified among the search results) [search result: Wikipedia, ESR meter](https://en.wikipedia.org/wiki/ESR_meter)
- A generic ESR chart is disputed: a forum member calls such charts unreliable and says the datasheet for the specific part must be used, because values vary so much. Datasheets usually quote ESR at 120 Hz, meters test at about 100 kHz, so the numbers do not compare directly. [P] (snippet) [All About Circuits forum](https://forum.allaboutcircuits.com/threads/good-or-bad-capacitor-how-to-determine-this-using-esr-tables.170947/); [N] [EE notebook, ESR meter](https://applied-ee.github.io/ee-notebook/docs/measurement/test-instruments/esr-meter)
- Leakage check with a multimeter on its highest ohm range, capacitor discharged and out of circuit: above 100 megohms or OL is good, 1 to 100 megohms moderate, under 1 megohm high, under 10 kilohms very leaky. [N] [EE notebook, ESR, leakage, gain](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/esr-leakage-gain)

**Motor driver (H-bridge) faults**

- Shoot-through is both switches of one half-bridge conducting at once, a low-resistance path across the supply that can damage the board and the FETs. After a suspected shoot-through, check for burn marks or shorts near the motor output pins, the charge-pump pin (VCP) and the motor supply (VM), and check the FETs for shorts. [V] (snippet) [TI E2E FAQ, debugging common issues in BLDC motor drivers](https://e2e.ti.com/support/motor-drivers-group/motor-drivers/f/motor-drivers-forum/1176539/faq-quick-guide-to-debugging-common-issues-in-bldc-motor-drivers)
- Overcurrent at a driver output has three wiring causes: output shorted to ground, to the supply, or to the other output. Poor soldering, poor terminal connections or a short in the motor windings can short the output pins to each other. [V] (snippet) [TI SLVAEV8, using VDS monitors to identify fault types](https://www.ti.com/document-viewer/lit/html/SLVAEV8/using-vds-monitors-to-identify-fault-types-x6545)
- A healthy integrated bridge has built-in dead time (450 ns on a DRV8833) and an off-state output leakage of 1 µA or less, and an on-resistance of about 360 milliohms for the high side plus low side at 5 V and 25 °C (200 plus 160). [V] [TI DRV8833 datasheet](https://www.ti.com/lit/ds/symlink/drv8833.pdf)
- MOSFET check with a multimeter in diode mode: charge the gate (red on gate, black on source), drain to source should then read low; short gate to source, drain to source should read OL apart from the body diode. Any conduction from gate to source or drain means a dead MOSFET. [N] [EE notebook, ESR, leakage, gain](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/esr-leakage-gain)
- Floating logic inputs are a cited cause of stuck bridge outputs in discrete gate-driver designs. [N] (snippet) [Industrial Monitor Direct, IR2110 H-bridge](https://industrialmonitordirect.com/blogs/knowledgebase/troubleshooting-ir2110-h-bridge-both-outputs-always-high)

**The motor itself**

- Winding resistance by ohmmeter is unreliable on brushed DC motors because brush and commutator contact resistance adds to the reading: a 24 V gearmotor read 0.674 ohm on a multimeter against 0.196 ohm by the voltage and current method. [V] (snippet) [Bodine Electric](https://bodine-electric.com/blog/?p=895)
- Better method: lock the armature, apply a reduced voltage (low enough that the shaft can be held), and record voltage and current at five or more different shaft positions; resistance is V divided by I. Work quickly, because the winding heats and its resistance changes. [V] (snippet) [Bodine Electric, armature resistance procedure](https://bodine-electric.com/blog/wp-content/uploads/2025/01/BODINE-GEARMOTORS-07470033-B-armature-resistance.pdf)
- Stall current is the supply voltage divided by the winding resistance, and must be measured with the rotor locked, because back-EMF otherwise spoils the measurement. [P] (snippet) [Arduino forum](https://forum.arduino.cc/t/figuring-out-the-stall-current-of-a-brushed-pmdc-motor/693564)
- Shorted windings: the coil's field cannot form, so the motor runs erratically or not at all, and the shorted coils run hot. Checks are the 180 degree resistance test and the bar-to-bar test on the commutator. An infinite reading is an open winding. [V] (snippet) [Groschopp](https://www.groschopp.com/?p=3219)
- Limit of the resistance check: a shorted turn among 50 to 200 turns may not change the DC reading at all. [P] (snippet) [element14 forum](https://community.element14.com/technologies/test-and-measurement/f/forum/46117/milliohm-meter/55250)

### Inferences

- A decision sequence for "resets when the motor starts", ordered from least to most invasive, assembled from the cited tests:
  1. Power off. Diode-mode and ohms from the motor supply rail to ground, and each driver output to ground and to the motor supply, comparing the two outputs with each other (sections 1 and 2). A dead short or a large mismatch condemns the driver or a part on its rail.
  2. Unplug the motor and measure its resistance across the terminals while turning the shaft slowly by hand. Expected stall current is supply voltage divided by that resistance; if this exceeds what the adapter or the driver can deliver (for example more than the adapter's rated current, or near the driver's overcurrent trip), a start-up dip is expected even from a healthy motor, and a seized mechanism will hold it there.
  3. Power on with the motor unplugged and trigger the function. If the reset still happens with no load, the fault is in the driver or the board (shoot-through, a shorted output, or the driver's own supply), not in the motor.
  4. Run the motor alone from a separate current-limited supply at its nominal voltage. A healthy small motor draws a brief peak then settles to a fraction of stall current; one that sits at the current limit or runs rough has a mechanical jam or a winding fault.
  5. Power on with the motor connected, scope the rail at the MCU supply pin and the reset pin, single-shot. A dip below the MCU's brownout level or the driver's UVLO (2.5 to 2.6 V on a DRV8833-class part) confirms a supply collapse; a clean rail with a reset pulse points to noise or a firmware or watchdog cause.
  6. If it dips: test the bulk capacitor (ESR against the table, or temporarily parallel a known-good capacitor of similar value, observing polarity and voltage rating), and test with a stiffer source or a shorter cable.
- Step 3 (motor unplugged) is the highest-value single test for an unskilled user with only a multimeter and the device itself, because it splits load from driver without any instrument.
- Repeated triggering of a fault that causes shoot-through or an overcurrent retry stresses the driver and the supply on every attempt. Limiting the number of powered attempts, and using a current-limited supply for them, follows from the DRV8833's retry behaviour (re-enabling every 1.35 ms into a persistent fault) and from the general "don't power it up again until the cause is understood" rule.
- The 1 to 4 µF per watt rule gives a sanity check for a small board: a 5 V motor drawing 0.5 A (2.5 W) wants roughly 2.5 to 10 µF as a bare minimum by that rule, while TI's measured data shows hundreds of microfarads are needed to hold ripple near 100 mV at 2 A. A board whose only bulk capacitor near the driver is missing, bulged or high in ESR is therefore a credible cause of start-up dips.

### Gaps

- No STMicroelectronics, Microchip or Analog Devices application note on motor-start brownout was retrieved; the TI note and the DRV8833 datasheet are the only vendor documents read in full on this topic.
- No source gives a procedure for diode-mode testing of an integrated H-bridge's output pins with expected values. The comparison-of-twins approach in the inferences is a general technique applied to this case.
- The MX08L (the suspect driver in the Homestar Flux repair) was not researched here; its UVLO, overcurrent and on-resistance values must come from its own datasheet. The DRV8833 numbers are an example of a comparable low-voltage dual H-bridge.
- The ESP32 brownout figure (about 2.9 V) and the 5 to 10 times inrush figure come from a small vendor blog seen only as a search snippet and should not be used as limits.
- No measured success rates or typical fault frequencies (driver versus motor versus capacitor) were found for this symptom.

## 9. Equipment tiers: which technique needs which tool

### Takeaway

Most of the localization work, including the decisive split tests, needs only a multimeter. A current-limited bench supply is the first upgrade because it makes powered testing safe and enables short-finding; a scope is the only way to see dips, ripple and resets; thermal cameras and ESR meters speed up specific searches; hot air is needed once parts have to come off.

### Cited Findings

- Multimeter only: power-off resistance and diode-mode checks of rails and pins in both polarities; continuity along a net; comparative resistance at bypass capacitors; DC rail voltages; a coarse AC-mode ripple reading; MOSFET gate-charge check; capacitor leakage on the high ohm range. [N] [EE notebook, short between nets](https://applied-ee.github.io/ee-notebook/docs/measurement/continuity-connections/short-between-nets), [EE notebook, ESR, leakage, gain](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/esr-leakage-gain); [V] [Fluke, how to test diodes](https://www.fluke.com/en-us/learn/blog/digital-multimeters/how-to-test-diodes)
- A multimeter is the stated minimum for short finding, and its limits are known: a common meter's ohm range cannot resolve most dead shorts, a 2-wire reading is good to 10 to 20 milliohms at best, and a 4.5 digit meter is needed to see the reading change near a short. [P] Shock, kripton2035 and MosherIV, [EEVblog, short finding on a PCB](https://www.eevblog.com/forum/testgear/short-finding-on-a-pcb/), [EEVblog, how to find short](https://www.eevblog.com/forum/beginners/how-to-find-short/)
- Multimeter on its millivolt range plus any constant current (bench supply, or a battery with an LM317 at about 50 mA): gradient tracing. A 200 mV range resolving 100 µV is enough at 1 A. [P] Gyro, [EEVblog, how to find short](https://www.eevblog.com/forum/beginners/how-to-find-short/); [Hackaday](https://hackaday.com/2022/03/10/short-circuit-tracer-for-a-buck/)
- USB power meter: input voltage and current signature, no board access needed. [P] [PNW Computers IT manual](https://pnw-computers.github.io/IT-Manual/diagnostics/power_diagnostics/)
- Current-limited bench supply: voltage injection, safe first power-up, running a motor on its own. Wanted features: true constant-current mode (not a cut-out), an output on/off button, no power-on overshoot. A Korad 3305 is one model named. [P] masterx81, [EEVblog](https://www.eevblog.com/forum/testgear/short-finding-on-a-pcb/); 2informaticos, [Rossmann forum](https://boards.rossmanngroup.com/threads/820-02098-shorted-ppbus_aon_spkramp_abc_isns-but-nothing-heats-up-even-with-10w-of-power.65597/)
- Finger, isopropyl alcohol, freeze spray: zero-cost or low-cost heat detectors used with injection. A finger needs a rise of 7 to 10 °C. [P] [EEVblog, short finding on a PCB](https://www.eevblog.com/forum/testgear/short-finding-on-a-pcb/); [V] [Techspray](https://techspray.com/using-freeze-spray-to-diagnose-faulty-electronics)
- Thermal camera: sees a 2 °C rise, so it works at lower, safer currents; called with a current-limited supply "the best tools" for shorts. A Flir C200 is one model named. It fails on shorts inside large ICs and on very low-ohm shorts. [P] nctnico and masterx81, [EEVblog](https://www.eevblog.com/forum/testgear/short-finding-on-a-pcb/)
- Milliohm meter or tone tracer (4-wire): fastest for dead shorts that produce no heat; needs 1 to 4 milliohm resolution. Kelvin clips can be too large for fine probing. [P] kripton2035 and MultiMike, [EEVblog](https://www.eevblog.com/forum/testgear/short-finding-on-a-pcb/)
- Oscilloscope: droop and reset capture (single-shot), ripple, regulator oscillation (bandwidth limit off, 100 ns/div or faster), clock presence with a 10x probe, signal tracing of PWM and data lines. A multimeter "can miss short transients". [N] [EE notebook, failure modes and patterns](https://applied-ee.github.io/ee-notebook/docs/debugging/failure-modes-and-patterns); [P] [DigiKey TechForum](https://forum.digikey.com/t/stm32-based-motor-controller-randomly-resets-when-dc-motor-starts/69814)
- ESR or LCR meter: in-circuit ESR of electrolytics at 50 to 100 kHz; an LCR meter for parts under about 0.3 µF. [N] [EE notebook, ESR meter](https://applied-ee.github.io/ee-notebook/docs/measurement/test-instruments/esr-meter)
- Hot-air station or soldering iron: removing suspects one by one, lifting an inductor or ferrite to split a rail, reflowing suspect joints, and gentle local heating for thermal intermittents. [P] [ACDI](https://www.acdi.com/troubleshooting-electronic-board-power-rail-shorts-with-a-thermal-camera/); [N] [EE notebook, thermal and intermittent faults](https://applied-ee.github.io/ee-notebook/docs/retro-legacy/testing-and-troubleshooting/thermal-and-intermittent-faults/)
- Microscope or 10x loupe: inspection for cracked joints, corrosion, bridges and burn marks. X-ray only for hidden joints under BGA and QFN parts. [N] [Altium](https://resources.altium.com/p/how-test-short-circuit-pcb)

### Inferences

- Technique-to-tool matrix for a guided tool (M multimeter, U USB meter, B bench supply, T thermal camera, S scope, E ESR or LCR meter, H hot air or iron):

  | Technique                                         | Minimum tools    | Better with | Board at risk?                             |
  | ------------------------------------------------- | ---------------- | ----------- | ------------------------------------------ |
  | Visual and smell inspection                       | Loupe            | Microscope  | No                                         |
  | Rail-to-ground ohms and diode mode                | M                |             | No (unpowered, discharged)                 |
  | Twin or known-good comparison                     | M                |             | No                                         |
  | Continuity along a net                            | M                |             | No                                         |
  | Input current signature                           | U or B           |             | Low                                        |
  | Rail voltages under load                          | M                | S           | Low (probe slips)                          |
  | Motor unplugged split test                        | None, or M       | B           | Low                                        |
  | Motor on external supply, winding resistance      | M + B            |             | Low for the board (motor is disconnected)  |
  | Half-split signal tracing of steady signals       | M                | S           | Low                                        |
  | Tap, flex, wiggle                                 | M                | S           | Low to medium                              |
  | Freeze spray or heat stress                       | Spray or hot air | S           | Medium (static, condensation, overheating) |
  | Voltage injection, find heat by finger or alcohol | B                | T           | High if voltage or current is set wrong    |
  | Gradient tracing below 0.5 V                      | B + M (mV range) | 4-wire      | Low                                        |
  | Droop, ripple and reset capture                   | S                |             | Low                                        |
  | Capacitor ESR                                     | E                |             | No (discharge first)                       |
  | Remove parts, lift inductor, cut trace            | H                |             | High (pad and trace damage, irreversible)  |

- For an unskilled user, the tool should exhaust every row marked "No" or "Low" before offering a "High" row, and should require the numeric limits (voltage at or below the rail, a starting current, a 50 °C stop) to be confirmed before an injection step is shown.

### Gaps

- No source read ranks the tools by cost-effectiveness or gives an explicit "buy in this order" recommendation; the tiers above are assembled from individual statements.
- Emissivity settings and close-focus lens requirements for cheap thermal cameras on small parts were not covered by any source read (the FLIR material found was a webinar listing with no text).
