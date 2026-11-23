# Component-level test procedures for board-level repair

Scope: low-voltage consumer boards (5 V input, 3.3 V logic), a technician with a digital multimeter (resistance, continuity, diode, DC/AC volts, possibly capacitance). Any test that needs more is marked **[needs: ...]**.

Reading conventions used below: "OL" is the meter's over-range display (open). "Red on X, black on Y" gives probe placement. Every threshold carries its source. Where a value came only from a search-result summary of a page that could not be opened, it is marked _(via search summary, page not read in full)_. Rules proposed for the app that are not stated by a source are kept under "Inferences".

Source quality note: several primary sources named in the brief could not be reached from this environment (see the Gaps of the first section). A personal engineering notebook, "Applied EE notebook" (applied-ee.github.io), is used often because it states explicit numeric thresholds. It is a secondary source of unknown authorship, so its numbers are best treated as practitioner rules of thumb, and they are cross-checked against vendor sources where one exists.

## How do the meter modes behave, and what are the general rules of in-circuit testing (parallel paths, when to lift a leg)?

### Takeaway

In-circuit readings are the total of every path between the probes, so resistance reads at or below the part's value, capacitance reads at or above it, and diode mode is a screen, not a verdict. The standard rule is: compare with the expected value or the same node on a good board, reverse the probes, and lift one leg only when the reading is ambiguous.

### Cited Findings

Meter behaviour:

- Diode mode sends a small current through the junction and displays the voltage drop. A good silicon junction drops 0.5 to 0.8 V. [Fluke 233 manual, diode tests](https://www.manualslib.com/manual/452558/Fluke-233.html?page=31) _(via search summary)_
- Diode mode test current is about 1 mA, so it can read OL on a resistive fault that resistance mode would catch. Check both modes. [Applied EE notebook, short between nets](https://applied-ee.github.io/ee-notebook/docs/measurement/continuity-connections/short-between-nets)
- The DMM diode-test voltage is about 2 to 3 V, which may not forward-bias some blue or white LEDs. [Applied EE notebook, dead or alive](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/dead-or-alive/)
- One older meter measured 2.88 V open-circuit in diode mode: enough to dimly light red, yellow and green LEDs, while blue, UV and white LEDs, Darlington transistors and series-connected high-voltage diodes showed as open. The meter's output can be checked with a second meter on volts. [DigiKey TechForum, test LED by a DMM](https://forum.digikey.com/t/test-led-by-a-digital-multimeter-dmm/1428) _(via search summary)_
- Continuity beepers do not have a common threshold. Fluke: "most will indicate continuity with a measurement between 0-50 ohms". [Fluke, what is continuity](https://www.fluke.com/en-my/learn/blog/electrical/what-is-continuity)
- Fluke 87V MAX: the beeper sounds below about 40 Ω on the 400 Ω range and below about 200 Ω on the 4 kΩ range. [Fluke 87V MAX manual p. 27](https://www.manualowl.com/m/Fluke/87V-MAX/Manual/528870?page=27) _(via search summary)_
- Other thresholds found: Fluke 10 beeps below 25 Ω ([Fluke 10 manual](https://www.manualslib.com/manual/1275529/Fluke-10.html?page=12)), a Keysight 34465A-series help page lists 10 Ω ([UBC copy of the help file](https://people.ece.ubc.ca/~eng-services/files/eHUB/Bench1-General/34465A%20DMM/Help%20file/Content/__E_Features%20and%20Functions/16%20Continuity.htm)), a Sefram meter defaults to 30 Ω ([Sefram BK390B manual](https://www.manualslib.com/manual/3416656/Sefram-Bk390b.html?page=42)). _(all via search summary)_
- A repair forum poster warns that many meters beep at up to about 50 Ω, so beep mode is not a valid short test. Read the ohms value instead. [badcaps.net thread](https://www.badcaps.net/forum/troubleshooting-hardware-devices-and-electronics-theory/troubleshooting-game-consoles-other-weird-devices/59242-short-to-gnd-display-board-honeywell-relay-module?p=1161524) _(via search summary)_
- A charging capacitor gives a short beep that then stops. "Capacitors will act like a short for a split second until they fill up with energy". [Adafruit/ladyada multimeter tutorial, mirror](https://mirrors.arcadecontrols.com/ladyyada.net/learn/multimeter/continuity.html) _(via search summary)_
- Test-lead resistance is usually 0.1 to 0.2 Ω for a standard pair. Short the leads together to read it, then subtract it (or use the meter's relative mode). [Fluke 87V MAX manual](https://www.manualowl.com/m/Fluke/87V-MAX/Manual/528870?page=27) _(via search summary)_. repair.wiki allows for roughly 0.4 Ω of probe resistance when judging a short. [repair.wiki, how to find short circuits](https://repair.wiki/w/How_to_find_short_circuits) _(via search summary, page returned 403)_
- Safety that generalizes: remove all power, confirm no voltage is present, and discharge capacitors before any resistance, continuity, diode or capacitance measurement. [Fluke, how to test diodes](https://www.fluke.com/en-us/learn/blog/digital-multimeters/how-to-test-diodes); [Fluke, what is continuity](https://www.fluke.com/en-my/learn/blog/electrical/what-is-continuity)
- Fluke's capacitor discharge method: a 20,000 Ω, 5 W resistor across the terminals for 5 seconds, then confirm with the meter. [Fluke, how to measure capacitance](https://www.fluke.com/en-us/learn/blog/digital-multimeters/how-to-measure-capacitance)
- For capacitors under 25 V a repair manual suggests shorting the terminals with a 1 kΩ resistor. Never discharge a high-voltage capacitor by sparking it with a screwdriver. [PNW Computers IT manual, capacitor testing](https://pnw-computers.github.io/IT-Manual/diagnostics/capacitor_testing/)

In-circuit rules:

- "The resistance displayed by the meter is the total resistance through all possible paths between the probes." [Fluke 87V MAX manual](https://www.manualowl.com/m/Fluke/87V-MAX/Manual/528870?page=27) _(via search summary)_
- In-circuit reliability by measurement: electrolytic ESR is reliable in circuit, semiconductor junctions in diode mode are usable as a screen, DC node voltage is always valid (10 MΩ meter input is sufficient), resistance is a rough check only, capacitance is unreliable except for large filter capacitors. [Applied EE notebook, in-circuit vs out-of-circuit testing](https://applied-ee.github.io/ee-notebook/docs/retro-legacy/testing-and-troubleshooting/in-circuit-vs-out-of-circuit-testing/)
- Resistance reads lower than marked when a parallel path exists (example: a 470 Ω resistor may read 320 Ω in circuit). Capacitance reads higher, because every parallel capacitor on the node is included. [same page](https://applied-ee.github.io/ee-notebook/docs/retro-legacy/testing-and-troubleshooting/in-circuit-vs-out-of-circuit-testing/)
- Decision rules from the same page: compare every reading with the schematic value or the same node on a working unit; if resistance is lower than expected, reverse the leads, and a change indicates a semiconductor junction in parallel; a "reasonable" resistance reading is not proof the part is good; lift a lead only when the reading is ambiguous, choosing the lead that disconnects the part from the most parallel paths. [same page](https://applied-ee.github.io/ee-notebook/docs/retro-legacy/testing-and-troubleshooting/in-circuit-vs-out-of-circuit-testing/)
- Watch the display for several seconds. A steadily climbing value suggests the meter is charging a capacitor. A reading that falls after starting open suggests another semiconductor path is turning on. "A stable reading is more meaningful than one that changes quickly." [Siborg, how to test PCB diodes without removing them](https://siborg.com/?p=175)
- When lifting one end of a two-terminal SMD part, choose the end that is easiest to reach and least likely to lift a fragile pad. [Siborg, same page](https://siborg.com/?p=175)
- Record the reference designator, probe polarity, mode, reading, whether the part was in circuit or lifted, and the meter model, since test currents and voltages vary between instruments. [Siborg, same page](https://siborg.com/?p=175)
- Point-to-point comparison with a known-good board is the fastest method. [Nuts and Volts, repairing circuit boards](https://www.nutsvolts.com/magazine/article/repairing-circuit-boards)

### Inferences

- The app should ask once per session for the meter's lead resistance (probes shorted) and subtract it from every low-ohm reading. Any verdict that depends on a sub-ohm difference should be flagged as beyond a 2-wire handheld meter.
- The app should never accept "it beeped" as a measured value. It should ask for the ohms reading, because beeper thresholds range from about 10 Ω to 200 Ω across the meters cited above.
- A universal in-circuit verdict table follows from the cited rules: reading equal to expected (within tolerance) gives "probably good, not proven"; reading lower than expected gives "ambiguous, reverse probes, then lift a leg"; reading higher than expected on a resistor or OL on a part that must conduct gives "part is suspect regardless of parallel paths", because parallel paths can only lower a resistance reading.
- Because diode-mode voltage and current differ per meter, forward-drop thresholds should be bands (for example 0.45 to 0.80 V for silicon), and comparison between identical parts on the same board is more reliable than an absolute number.

### Gaps

- Sam Goldwasser's Sci.Electronics.Repair FAQ (repairfaq.org) could not be reached (DNS failure from this environment, and the Wayback Machine is blocked), so none of its procedures are quoted here. Its pages on testing semiconductors and capacitors are worth reading directly: `https://www.repairfaq.org/sam/semitest.htm` and `https://www.repairfaq.org/sam/captest.htm`.
- repair.wiki, badcaps.net, TDK's FAQ and the Littelfuse education pages returned HTTP 403. Their content appears here only through search summaries.
- NEETS modules, Jestine Yong's book, EEVblog videos, Electronics Repair School and Learn Electronics Repair were not consulted directly (video content, or not surfaced by search).
- No source was found that states the diode-mode test current and open-circuit voltage for common low-cost meters. This matters for LED and gate-charge tests.

## Resistors (SMD and through-hole, zero-ohm links, current-sense resistors)

### Takeaway

Resistors fail mostly open or high. In circuit a good resistor can only read at or below its marked value, so a reading above tolerance is meaningful and a low reading is not. Zero-ohm links and sense resistors are below what a 2-wire handheld meter resolves, so they are checked for "not open" with power off and by voltage drop with power on.

### Cited Findings

Power off, in circuit:

- Onboard testing is acceptable only when the resistor has no parallel path, especially no identical resistor beside it. Two 10 Ω resistors in parallel read 5 Ω. If resistor B is open and identical resistor A is in parallel, testing B reads 10 Ω through A: "You are actually measuring resistor A if resistor B is open circuit." A shorted capacitor across a resistor makes it read near 0 Ω. A reading that is too high, too low or uncertain means test it offboard. [Jestine Yong, should you test resistors onboard or offboard](https://jestineyong.com/should-you-test-resistors-onboard-or-offboard/)
- In circuit the measured value appears lower than actual (anything between 0 and the marked value). A higher-than-marked reading can only happen if the resistor is going open, and "if it measures too high (out of original tolerance), that generally means it's bad, or at least lift one lead and try it again." [diyAudio thread, resistor measurement way off](https://www.diyaudio.com/community/threads/resistor-measurement-way-off.406423/) and [audiokarma thread](https://audiokarma.org/forums/threads/is-it-normal-for-resistors-to-have-big-deviation.1014166/) _(forum posts, via search summary)_
- If the resistor checks good with a leg lifted, a component in parallel with it is the one that is shorted. [forum reply, via search summary: videokarma.org](https://videokarma.org/showthread.php?p=1439162)
- If resistance reads lower than expected, reverse the leads. A change indicates a semiconductor junction in parallel. [Applied EE notebook, in-circuit vs out-of-circuit testing](https://applied-ee.github.io/ee-notebook/docs/retro-legacy/testing-and-troubleshooting/in-circuit-vs-out-of-circuit-testing/)

Out of circuit (definitive):

- Pass/fail rule: deviation = (measured - rated) / rated x 100 %. Pass if within the stated tolerance. Example: 4.7 kΩ ±5 % measuring 4.52 kΩ is -3.8 % (pass), 4.10 kΩ is -12.8 % (fail). [Applied EE notebook, within tolerance](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/within-tolerance/)
- Tolerance bands for a 10 kΩ part: ±1 % is 9.9 to 10.1 kΩ, ±5 % is 9.5 to 10.5 kΩ, ±10 % is 9.0 to 11.0 kΩ, ±20 % is 8.0 to 12.0 kΩ. Most modern resistors are ±1 % or ±5 %. A ±1 % resistor measuring outside ±5 % indicates a fault. [same page](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/within-tolerance/)
- Use a meter at least 3 to 4 times more accurate than the tolerance being verified. A ±0.5 % DMM cannot meaningfully verify ±1 % parts. [same page](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/within-tolerance/)
- "A 20% drift can look 'close enough,' so don't accept it casually." [Applied EE notebook, field failure modes by component](https://applied-ee.github.io/ee-notebook/docs/debugging/component-field-failures/)

Zero-ohm links and low-value resistors:

- Vishay CRCW0603 zero-ohm jumper: maximum resistance 20 mΩ, rated 2.0 A. [datasheets.com listing, Vishay CRCW0603 jumper](https://www.datasheets.com/vishay-dale/crcw06030000z0ea) _(via search summary)_
- NIC NRC06 zero-ohm jumper: maximum DC resistance 0.05 Ω, rated 1.0 A. [datasheets.com listing, NIC NRC06](https://www.datasheets.com/nic/nrc06zotrf) _(via search summary)_
- Small resistors (under about 100 Ω) can read as shorts on a continuity beeper. [SparkFun, how to use a multimeter, continuity](https://learn.sparkfun.com/tutorials/how-to-use-a-multimeter/continuity) _(via search summary)_
- A gate resistor in a MOSFET drive is typically 1 to 47 Ω. If it is open or high, a new MOSFET will not switch. [PNW Computers IT manual, MOSFET diagnostics](https://pnw-computers.github.io/IT-Manual/diagnostics/mosfet_diagnostics/)

Failure modes and frequency:

- Film resistors, MIL-HDBK-338B: open 59 %, parameter drift 36 %, short 5 %. NSWC Crane gives open 50 %, drift 45 %, short 5 %. [DSIAC, film resistor and capacitor failure modes and distributions](https://dsiac.dtic.mil/technical-inquiries/notable/film-resistor-and-capacitor-failure-modes-and-distributions)
- Panasonic: actual chip resistor failures are "primarily resistance value increase/open circuit". Sulfur attacks silver internal electrodes and forms non-conductive silver sulfide (open). Overload, ESD or surge can instead decrease the resistance of thick-film parts. [Panasonic, chip resistors, failure by usage environment and failure mode](https://industrial.panasonic.com/sa/products-resistors/chip-resistors/failure-mode) _(via search summary, page timed out)_
- Sulfur corrosion produces "increased resistance value over time in field with no external visual signs". [NIC Components, thick and thin film resistors failure mode study 2013](https://canada.newark.com/wcsstore/ExtendedSitesCatalogAssetStore/cms/asset/pdf/americas/common/nic-components/NIC-Components-Thick-Thin-Film-Resistors-FailureModeStudy2013.pdf) _(via search summary)_
- Through-hole resistors usually increase in value or go open, and shorts or decreases are rare. SMD resistors can increase, decrease, short or go open. [Jestine Yong, same article](https://jestineyong.com/should-you-test-resistors-onboard-or-offboard/)
- Field symptoms: open from overcurrent (charred or cracked body, reads open or megohms); value drift from chronic overheating; intermittent behaviour with vibration or temperature is usually a solder joint failure rather than the resistor. [Applied EE notebook, field failure modes](https://applied-ee.github.io/ee-notebook/docs/debugging/component-field-failures/)

Visual signs: charred or cracked body (open failures) per the page above; sulfur failures show no external sign per NIC.

### Inferences

- Suggested in-circuit decision rule for the app (power off, both probe polarities): reading within tolerance of the marked value gives "consistent with good"; reading above marked value plus tolerance (plus meter error) gives "resistor high or open, replace" (no lift needed, since parallel paths cannot raise a reading); reading below gives "inconclusive, lift one leg and re-measure"; reading changes when probes are reversed gives "a junction is in parallel, lift one leg".
- Zero-ohm link: with lead resistance subtracted, anything under about 0.5 Ω is "not open" on a handheld meter. The 20 to 50 mΩ datasheet limit cannot be verified with a 2-wire DMM whose leads alone are 0.1 to 0.2 Ω. A reading of several ohms or OL is a failed link.
- Current-sense resistor (typically milliohms to 1 Ω): power-off test only proves "not open". The practical test is power on: measure DC millivolts across it and compute current = V / R, then judge whether that current is plausible. An open sense resistor shows nearly the full supply across it with the load not running. This is Ohm's law applied to the cited voltage-drop method for fuses; no source describing it step by step was found.
- Power-on test for any resistor: the voltage across it must equal the current through it times its value. A resistor with supply voltage on one side and 0 V on the other, where the downstream node should be driven, is open or the downstream node is shorted to ground.

### Gaps

- No vendor procedure was found for testing current-sense resistors in circuit, or for 4-wire (Kelvin) measurement with handheld gear.
- No published threshold for "how far above tolerance is a fail" beyond the tolerance band itself.
- MIL-HDBK-338B itself could not be opened (403), so composition and wirewound resistor distributions are not included.

## Ceramic capacitors (MLCC), and what a multimeter can and cannot tell about any capacitor

### Takeaway

A multimeter can prove a capacitor is shorted and can show gross leakage or (with capacitance mode, out of circuit) an open or very low value. It cannot measure ESR, and in circuit it cannot tell which capacitor on a rail is the shorted one, because all capacitors on a rail are in parallel and read the same. MLCCs fail mostly by cracking into a short or a leak, usually with nothing to see.

### Cited Findings

What the multimeter can tell (power off, discharged):

- Short check with continuity, diode or the lowest ohms range: good is a brief beep that stops quickly (the meter charging the capacitor) and then OL, or no beep and OL. Shorted is a continuous solid beep, near 0 Ω. [PNW Computers IT manual, capacitor testing](https://pnw-computers.github.io/IT-Manual/diagnostics/capacitor_testing/)
- Resistance-rise test on the 200 kΩ or 2 MΩ range (or the highest range): reading starts low and climbs to OL is normal charging. Stays at 0 Ω is shorted. OL immediately with no movement is open, or the part is too small to see (under 1 nF). Settles in kΩ to MΩ is leaky. Electrolytics often settle at a few MΩ instead of OL. [Applied EE notebook, dead or alive](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/dead-or-alive/); [PNW Computers, capacitor testing](https://pnw-computers.github.io/IT-Manual/diagnostics/capacitor_testing/)
- Leakage bands for the settled resistance: above 100 MΩ or OL is good; 1 to 100 MΩ is moderate and may be acceptable for large electrolytics; under 1 MΩ is high leakage, suspect for film or ceramic; under 10 kΩ is very leaky and degraded. [Applied EE notebook, ESR, leakage, gain](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/esr-leakage-gain/)
- The same ohmmeter test as described by a repair magazine: a good capacitor starts near zero and climbs slowly toward infinity (large values ramp very slowly); an open one reads open; a shorted one reads close to zero ohms; a leaky one never fully climbs. [Nuts and Volts, repairing circuit boards](https://www.nutsvolts.com/magazine/article/repairing-circuit-boards)
- Capacitance mode: remove the capacitor from the circuit "to avoid measurement errors", hold the leads for a few seconds while the meter ranges, use relative mode for small values. OL means the capacitance is above the meter's range or the capacitor is faulty. Fluke gives no pass/fail tolerance. [Fluke, how to measure capacitance](https://www.fluke.com/en-us/learn/blog/digital-multimeters/how-to-measure-capacitance)
- Capacitance tolerance when measured out of circuit: usually ±20 % or as printed. A low reading means aged or dried out, OL or no change means open. [PNW Computers, capacitor testing](https://pnw-computers.github.io/IT-Manual/diagnostics/capacitor_testing/). A 10 % or 20 % deviation may be normal depending on series and test conditions. [Siborg, how to test capacitors without desoldering](https://siborg.com/?p=134)
- New-part tolerances by type: C0G/NP0 ±5 % or better; X7R ±10 % (voltage and temperature derating matter more); Y5V -20/+80 %; aluminium electrolytic -20/+80 % as listed on this page; tantalum ±10 to 20 %. [Applied EE notebook, within tolerance](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/within-tolerance/)

What the multimeter cannot tell:

- "Standard DMMs cannot measure ESR." ESR rises with age and causes ripple even when capacitance looks normal. [PNW Computers, capacitor testing](https://pnw-computers.github.io/IT-Manual/diagnostics/capacitor_testing/)
- "The capacitance value may be unchanged, but a higher than normal ESR is a sure sign that the cap is on the way out." High ESR cannot be detected with a capacitance meter. [ESP (Rod Elliott), capacitor ESR](https://sound-au.com/articles/esr.htm)
- An ohmmeter test for shorts "does not confirm the part operates within design limits". [US Army TM 9-2350-267-34 excerpt](https://personnelcarrier.tpub.com/TM-9-2350-267-34/css/TM-9-2350-267-34_30.htm) _(via search summary)_

In-circuit meaning (all capacitors on a rail read the same):

- Banks of identical capacitors on a rail are in parallel. One short makes the whole bank read as shorted to ground. [PNW Computers, capacitor testing](https://pnw-computers.github.io/IT-Manual/diagnostics/capacitor_testing/)
- "A short somewhere is a short everywhere". [iFixit, microsoldering school day two](https://www.ifixit.com/News/98564/microsoldering-school-day-two-to-fix-the-problem-you-first-have-to-find-the-problem)
- Near-zero resistance across a ceramic capacitor can indicate a shorted MLCC, but is also normal on a low-impedance core-voltage rail. A downstream IC, diode or power stage may be the actual short. "A capacitance value much higher than the printed marking usually means parallel capacitance is present." If several identical capacitors read similarly low, the circuit is likely the cause rather than failed parts. [Siborg, how to test capacitors without desoldering](https://siborg.com/?p=134)
- Lift one lead or remove the part when the capacitor is connected directly across a low-resistance rail, paralleled with multiple capacitors, or tied to active semiconductor circuitry. [Siborg, same page](https://siborg.com/?p=134)
- Some rails normally read very low: CPU and GPU core rails normally sit at 0 to 1 Ω to ground. [repair.wiki, how to find short circuits](https://repair.wiki/w/How_to_find_short_circuits) _(via search summary)_. The output side of a CPU or GPU MOSFET can naturally read about 1 to 5 Ω to ground. [PNW Computers, MOSFET diagnostics](https://pnw-computers.github.io/IT-Manual/diagnostics/mosfet_diagnostics/)

How experts check many capacitors on one rail (measure once, then isolate):

- Measure the rail to ground once. Resistance bands: 0 to 1 Ω is a hard (metal-to-metal) short; 1 to 100 Ω is a low-resistance path (a component, contamination or partial bridge); 100 Ω to 10 kΩ is possibly normal (pull-ups, termination), check the schematic; OL means isolated. [Applied EE notebook, short between nets](https://applied-ee.github.io/ee-notebook/docs/measurement/continuity-connections/short-between-nets)
- Diode mode, both polarities: 0.000 V both directions is a true metal-to-metal short; 0.4 to 0.7 V one direction and OL the other is a normal silicon junction (protection or body diode); 0.2 to 0.3 V one direction is a Schottky, likely intentional; OL both directions is isolated. A brief low reading that rises to OL is a capacitor charging, not a short. Many parallel protection diodes can produce a lower-than-expected forward voltage. [same page](https://applied-ee.github.io/ee-notebook/docs/measurement/continuity-connections/short-between-nets)
- Localize by comparative resistance: measure VCC to GND at each IC's bypass capacitor. The lowest reading is closest to the short. [same page](https://applied-ee.github.io/ee-notebook/docs/measurement/continuity-connections/short-between-nets)
- Voltage injection **[needs: current-limited bench supply]**: apply 0.5 to 1 V at 100 to 500 mA across the shorted rail and follow the voltage gradient with the DMM in millivolt mode, or find the warm part. Keep the voltage below 1 V. [same page](https://applied-ee.github.io/ee-notebook/docs/measurement/continuity-connections/short-between-nets)
- Inject about 1 V into the shorted rail and apply isopropyl alcohol to the bank. The alcohol evaporates almost instantly from the shorted capacitor because it heats up. [PNW Computers, capacitor testing](https://pnw-computers.github.io/IT-Manual/diagnostics/capacitor_testing/)
- Feed the rail below its nominal value (less than the 3.3 V or 5.0 V required), with low voltage and current limits raised slowly. Freezer spray then a brief power-up makes the hot short visible ("poor man's" method); a thermal camera shows it directly. [Nuts and Volts, repairing circuit boards](https://www.nutsvolts.com/magazine/article/repairing-circuit-boards)
- Remove capacitors one at a time near the fault. The short clears when the cracked one is removed. [Applied EE notebook, field failure modes](https://applied-ee.github.io/ee-notebook/docs/debugging/component-field-failures/)
- On multi-layer boards the short may be on an internal layer. [Applied EE notebook, short between nets](https://applied-ee.github.io/ee-notebook/docs/measurement/continuity-connections/short-between-nets)
- Before fitting a new MLCC on a rail such as 19 V, scrape away carbonized PCB material between the pads, since carbon conducts and re-creates the short. [PNW Computers, capacitor testing](https://pnw-computers.github.io/IT-Manual/diagnostics/capacitor_testing/)

MLCC failure modes and frequency:

- Ceramic capacitors, normalized failure mode distribution (NAVSEA): short 49 %, value change or drift 29 %, open 22 %. [DSIAC, film resistor and capacitor failure modes](https://dsiac.dtic.mil/technical-inquiries/notable/film-resistor-and-capacitor-failure-modes-and-distributions)
- Most field failures of MLCCs are related to cracks (poor process control, soldering thermal shock, board flex during handling or testing). The result ranges from a short to intermittent "noisy" behaviour. [NASA NEPP, Teverovsky, IMAPS 2013 paper](https://nepp.nasa.gov/files/24723/2013_n241_Teverovsky_IMAPS_Paper.pdf) _(via search summary)_
- Cracking failures usually begin as leakage with falling insulation resistance. [Vishay technical paper 49088](https://www.vishay.com/docs/49088/49088_technicalpaper.pdf) _(via search summary)_
- When a crack reaches the active electrode area, leakage occurs between internal electrodes. Repeated discharge in the cracked region under a high electric field progressively deteriorates the insulation resistance toward a short. [Murata FAQ, ceramic capacitors, mnt/0028](https://www.murata.com/support/faqs/capacitor/ceramiccapacitor/mnt/0028)
- A flex crack can create conduction between opposing internal electrodes, and an open can later progress to a short with continued use. Moisture speeds this up. [TDK FAQ, flex crack countermeasures (4)](https://product.tdk.com/en/contact/faq/capacitors-0086.html) _(via search summary, page returned 403)_
- Strain cracks are hard to spot from outside the chip. [Murata, strain crack mechanism and preventive measures for MLCC](https://article.murata.com/article/strain-crack-mechanism-and-preventive-measures-for-mlcc) _(via search summary)_. A hairline crack may show on the top surface, but is often hidden underneath. [Applied EE notebook, field failure modes](https://applied-ee.github.io/ee-notebook/docs/debugging/component-field-failures/)
- Causes of cracking: board flex during assembly, thermal shock, rough handling, nearby press-fit connectors. Symptoms: rail shorted to ground with upstream protection tripping, or subtle capacitance loss. [same page](https://applied-ee.github.io/ee-notebook/docs/debugging/component-field-failures/)
- Probe lightly, since excess force can fracture small ceramics. [Siborg, how to test capacitors without desoldering](https://siborg.com/?p=134)

### Inferences

- Capacitor verdicts available from a multimeter alone: "shorted" (certain once the part is isolated), "leaky" (settled resistance under 1 MΩ for a ceramic, out of circuit), "open or low" (capacitance mode, out of circuit, below the tolerance band), "no fault found, ESR and behaviour under voltage not tested". The app should never output "good" for an electrolytic from a multimeter test alone.
- The app should model the capacitor short test as a net-level test, not a part-level one: one measurement per power net (net to ground, ohms and diode mode, both polarities), with the result applied to every capacitor on that net as "not shorted" when the net reads high. Only when the net reads low does it open a localization sub-procedure (compare at each bypass capacitor, inject, remove one at a time). This matches the scenario format, where each capacitor's pins already name their nets.
- A rail-to-ground threshold for a small 5 V / 3.3 V board with no CPU core rail: under about 1 Ω (lead resistance subtracted) is a hard short; 1 to 100 Ω is abnormal until explained; above that, compare with a known-good board or accept. The 0 to 5 Ω "normal" exception applies to high-current core rails, which a simple 5 V consumer board usually does not have.
- X7R/X5R parts lose capacitance under DC bias, so a capacitance measurement at the meter's near-zero bias can read higher than the in-service value. A slightly low out-of-circuit reading on a high-K MLCC is not a reliable fail.

### Gaps

- No manufacturer source gives a multimeter insulation-resistance threshold for a cracked MLCC. The MΩ bands above are from a practitioner notebook.
- No quantified data was found on how often a cracked MLCC is visible to the eye.
- The Murata and TDK pages on cracking describe mechanisms, not field test procedures.

## Electrolytic and tantalum capacitors (ESR limits and published ESR tables)

### Takeaway

Aluminium electrolytics wear out by drying: ESR rises first, capacitance falls later, and a multimeter sees neither until late. The definitive test is an ESR meter compared with a chart or an identical part (suspect at 2 to 3 times the expected value). Solid tantalums fail short, sometimes with ignition, and are tested like a short.

### Cited Findings

ESR table (the chart printed on common ESR meters). "Typical ESR (Ω) for various capacitor values and voltages", the worst-case ESR for new standard (not low-ESR) electrolytics, compiled by the author from the panels of his ESR meters. [ESP (Rod Elliott), capacitor ESR, table 3.1](https://sound-au.com/articles/esr.htm)

| µF     | 10 V | 16 V | 25 V | 35 V | 63 V | 160 V | 250 V |
| ------ | ---- | ---- | ---- | ---- | ---- | ----- | ----- |
| 1.0    |      |      | 5.0  | 4.0  | 6.0  | 10    | 20    |
| 2.2    |      |      | 2.5  | 3.0  | 4.0  | 9.0   | 14    |
| 4.7    |      |      | 2.5  | 2.0  | 2.0  | 6.0   | 5.0   |
| 10     |      | 1.6  | 1.5  | 1.7  | 2.0  | 3.0   | 6.0   |
| 22     | 5.0  | 3.0  | 2.0  | 1.0  | 0.8  | 1.6   | 3.0   |
| 47     | 3.0  | 2.0  | 1.0  | 1.0  | 0.6  | 1.0   | 2.0   |
| 100    | 0.9  | 0.7  | 0.5  | 0.5  | 0.3  | 0.5   | 1.0   |
| 220    | 0.3  | 0.4  | 0.4  | 0.2  | 0.15 | 0.25  | 0.5   |
| 470    | 0.25 | 0.2  | 0.12 | 0.1  | 0.1  | 0.2   | 0.3   |
| 1,000  | 0.1  | 0.1  | 0.1  | 0.04 | 0.04 | 0.15  |       |
| 4,700  | 0.06 | 0.05 | 0.05 | 0.05 | 0.05 |       |       |
| 10,000 | 0.04 | 0.03 | 0.03 | 0.03 |      |       |       |

Note on the table: every cell above, including the empty ones, was checked against the table cells in the page's HTML. The author states it "was compiled using the details printed on my ESR meters, and is representative": some new capacitors will be much better, some not quite as good. Low-voltage and high-voltage parts have higher ESR than mid-range ones (35 to 63 V is "the happy area").

ESR decision rules:

- If a capacitor's measured ESR is "significantly exceeding that in the table, it is on the way out and should be replaced". Judgement is needed. Worked example from the article (a hypothetical chart value, not the table's): "If the chart says (for example) 6Ω for a 2.2μF 25V cap and you measure 3Ω, that's fine. If you were to measure 10Ω or more, the cap has passed its use-by date", which is a fail at about 1.7 times the chart value. A much lower than expected ESR may mean the capacitor is shorted. [ESP, capacitor ESR](https://sound-au.com/articles/esr.htm)
- Electrolytic ESR reading 2 to 3 times the expected value: the capacitor is failing, even if its capacitance still reads near nominal. ESR rises before capacitance drops. [Applied EE notebook, in-circuit vs out-of-circuit testing](https://applied-ee.github.io/ee-notebook/docs/retro-legacy/testing-and-troubleshooting/in-circuit-vs-out-of-circuit-testing/)
- A second practitioner table ("typical good" and "suspect if"): 10 µF 25 V good 1 to 5 Ω, suspect above 10 Ω; 100 µF 25 V good 0.1 to 0.5 Ω, suspect above 2 Ω; 1000 µF 16 V good 0.02 to 0.1 Ω, suspect above 0.5 Ω; 1000 µF 50 V good 0.05 to 0.2 Ω, suspect above 1 Ω; 4700 µF 25 V good 0.01 to 0.05 Ω, suspect above 0.3 Ω. [Applied EE notebook, ESR, leakage, gain](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/esr-leakage-gain/)
- A healthy 1000 µF 25 V electrolytic is typically below 0.1 Ω; dried out is 5 Ω or higher. [PNW Computers, capacitor testing](https://pnw-computers.github.io/IT-Manual/diagnostics/capacitor_testing/)
- Compare with the datasheet impedance of the exact series when known: a 3300 µF 16 V part listed at 0.015 Ω that reads 0.3 Ω is obviously sick. Published tables disagree with each other (a poster found 5.3, 14 and 1.5 Ω for 10 µF 25 V in three tables). "A bad cap has most likely a low capacitance and a high ESR." [EEVblog forum, ESR values for electrolytic caps](https://www.eevblog.com/forum/beginners/esr-values-for-electrolytic-caps/)
- Bob Parker's ESR meter documentation says there is no single "bad" ESR figure, since the threshold depends on the capacitor's rating, and the front-panel chart is a guide. [Scribd copy of the Parker ESR meter document](https://www.scribd.com/document/495279455/A1lI70QxneL) _(via search summary only; the chart's numbers were not read from this source)_
- Elevated ESR on one electrolytic compared with matching parts on the same board is a strong indicator of deterioration. Parts near heatsinks or switching transistors age faster. [Siborg, how to test capacitors without desoldering](https://siborg.com/?p=134)

ESR measurement conditions **[needs: ESR meter or LCR meter]**:

- ESR meters use about 100 kHz, where ESR dominates the impedance and most parallel paths have high enough impedance that the in-circuit reading is reliable. The in-circuit test voltage is about 0.1 to 0.3 V peak, which does not forward-bias semiconductor junctions. [Applied EE notebook, in-circuit vs out-of-circuit](https://applied-ee.github.io/ee-notebook/docs/retro-legacy/testing-and-troubleshooting/in-circuit-vs-out-of-circuit-testing/); [Applied EE notebook, ESR, leakage, gain](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/esr-leakage-gain/)
- An in-circuit ESR reading includes the parallel combination when capacitors share a rail. Lift one leg to isolate. [Applied EE notebook, ESR, leakage, gain](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/esr-leakage-gain/)
- Parallel capacitors can make an in-circuit reading look better than the individual part. A capacitor that reads high ESR in circuit is usually bad, but a dead one can sometimes read acceptable in circuit. [EEVblog forum, same thread](https://www.eevblog.com/forum/beginners/esr-values-for-electrolytic-caps/)
- ESR meters cannot measure below about 10 µF accurately. Lead and clip resistance adds several milliohms, so precision below about 30 mΩ is unrealistic. [ESP, capacitor ESR](https://sound-au.com/articles/esr.htm)
- ESR testing mainly matters for electrolytic and tantalum capacitors. Ceramics have milliohm ESR. A capacitor can have acceptable ESR but reduced capacitance, so ESR complements capacitance measurement. [Applied EE notebook, ESR, leakage, gain](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/esr-leakage-gain/)

Power on:

- Symptoms of a bad electrolytic: increased ripple on a DC rail, degraded decoupling with a downstream IC misbehaving; a shorted one drops the rail to zero or blows the fuse. [Applied EE notebook, field failure modes](https://applied-ee.github.io/ee-notebook/docs/debugging/component-field-failures/)
- A DMM averages its reading, so brief dropouts are hidden. Seeing ripple needs an oscilloscope. [Applied EE notebook, is voltage present](https://applied-ee.github.io/ee-notebook/docs/measurement/power-rails-supplies/voltage-present/) **[needs: oscilloscope]**
- Substitution (fit a known-good capacitor) is a valid test. [Applied EE notebook, field failure modes](https://applied-ee.github.io/ee-notebook/docs/debugging/component-field-failures/)

Aluminium electrolytic failure modes and frequency:

- Two categories: catastrophic (short circuit, open circuit) and wear-out, where the electrolyte gradually evaporates through the rubber seal, which decreases capacitance and increases tan δ (ESR). Aluminium electrolytics are "low in catastrophic failures" in the random-failure period "compared with semi-conductors and solid tantalum capacitors". Wear-out criteria in the endurance specifications are change in capacitance, tan δ and leakage current. [Nippon Chemi-Con technical note, reliability and failure modes](https://chemi-con.com/wp-content/uploads/2021/04/Failure-modes.pdf)
- Causes listed in the same note: short circuit from burred foil, metal particles or dielectric breakdown; open circuit from terminal disconnection or poor connection (mechanical stress); capacitance drop and tan δ increase from electrolyte vaporization (excessive thermal stress, excessive operating voltage, reverse voltage, excessive ripple current, charge-discharge duty, deterioration with time); leakage increase from oxide deterioration or chloride contamination; open vent from internal pressure rise; electrolyte leakage from poor sealing. [same note](https://chemi-con.com/wp-content/uploads/2021/04/Failure-modes.pdf)
- Rule of thumb: end of life is reached at about 40 % electrolyte loss, giving about 10 % capacitance reduction and ESR about 3 times the initial value. Failures of general-purpose aluminium electrolytics are mostly due to electrolyte leaking through the rubber seals. [NASA, Teverovsky, PCNS 2023 paper](https://ntrs.nasa.gov/api/citations/20230008869/downloads/20230008869-Teverovsky-PCNS-2023-Paper_v2.pdf) _(via search summary)_
- A manufacturer endurance spec (brand not identified in the summary) lists capacitance change within ±20 % of the initial value and tan δ at most 200 % of the initial limit after the life test. [datasheet hosted by RS](https://docs.rs-online.com/bc6e/A700000014718029.pdf) _(via search summary)_
- Normalized failure mode distribution for aluminium electrolytics in a Navy report: short 53 %, open 35 %. [NSWC Crane, capacitor failure mechanisms](https://www.navsea.navy.mil/Portals/103/Documents/NSWC_Crane/SD-18/PDFs/Products/Capacitors/CapacitorsFailureRevA.pdf) _(via search summary, page returned 403)_
- Contradiction between sources on the dominant mode: the Navy distribution above ranks short first; Chemi-Con and the field-failure notebook rank wear-out (ESR rise, capacitance drop) as the characteristic failure ("Most common: ESR rise/dry-out", [Applied EE notebook, field failure modes](https://applied-ee.github.io/ee-notebook/docs/debugging/component-field-failures/)); while another page of the same notebook calls a 0 Ω short "the most common electrolytic failure" ([dead or alive](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/dead-or-alive/)).
- Rule of thumb: in consumer electronics over 5 to 10 years old, electrolytics near heat sources (regulators, power transistors) are the first suspect. [Applied EE notebook, field failure modes](https://applied-ee.github.io/ee-notebook/docs/debugging/component-field-failures/)
- Polymer aluminium capacitors deteriorate by capacitance decrease and ESR increase, and "the failure mode is mainly open mode". [Murata, polymer capacitor failure mode](https://www.murata.com/en-global/products/capacitor/polymer/documents/failure-mode) _(via search summary)_

Visual signs:

- Bulging top vent, leaking residue (corrosive), discoloured PCB underneath, capacitor sitting crooked. [Applied EE notebook, field failure modes](https://applied-ee.github.io/ee-notebook/docs/debugging/component-field-failures/)
- A bulging top is a late and unreliable sign: the capacitor "may be very ill well before that happens". [ESP, capacitor ESR](https://sound-au.com/articles/esr.htm)
- Bulging, leaking or a burnt PCB: replace immediately. [PNW Computers, capacitor testing](https://pnw-computers.github.io/IT-Manual/diagnostics/capacitor_testing/)

Tantalum:

- Tantalum chip capacitors, normalized failure mode distribution (NAVSEA): short 57 %, open 32 %, value change 11 %. [DSIAC, film resistor and capacitor failure modes](https://dsiac.dtic.mil/technical-inquiries/notable/film-resistor-and-capacitor-failure-modes-and-distributions)
- At power turn-on, high inrush currents can cause surge-current failures. For solid tantalum capacitors with manganese dioxide cathodes these result "not only in a short circuit in the system, but can also cause ignition". Factors that reduce surge failures include voltage derating and series resistance. [NASA NEPP, Teverovsky, ESTEC derating paper](https://nepp.nasa.gov/files/24745/2013_n240_Teverovsky_ESTEC_Derating_paper.pdf) _(via search summary; the quote may come from a sibling NASA paper returned by the same search)_
- Short circuits are "a low level, but not negligible, failure mode"; a fused chip changes the short-circuit failure mode to open circuit. [Kyocera AVX technical paper](https://www.kyocera-avx.com/docs/techinfo/Tantalum-NiobiumCapacitors/rmtant.pdf) _(via search summary)_
- Tantalum: rectangular moulded body, polarized, stripe on the positive side (opposite to aluminium electrolytics, whose stripe is negative). Fails violently if reversed or overvoltaged. [PNW Computers, capacitor testing](https://pnw-computers.github.io/IT-Manual/diagnostics/capacitor_testing/)

Replacement rules: match capacitance (never lower; higher is acceptable for non-critical filter banks), voltage equal or higher, temperature rating equal or higher (prefer 105 °C over 85 °C near heat). [PNW Computers, capacitor testing](https://pnw-computers.github.io/IT-Manual/diagnostics/capacitor_testing/)

### Inferences

- Suggested electrolytic protocol for a multimeter-only technician: (1) visual (bulge, leak, crooked, stained board); (2) net-level short test; (3) if the symptom fits (old unit, ripple, resets under load) and no ESR meter is available, the app should say "cannot be cleared with a multimeter" and offer substitution or piggy-backing a known-good capacitor as the test, which the field-failure source accepts as valid.
- Suggested ESR verdict when an ESR meter is available: at or below the chart value is "good"; between 1 and 2 times is "marginal, compare with a twin"; at or above 2 to 3 times the chart value, or above the notebook's "suspect if" value, is "replace". A reading near zero on a capacitor whose net also reads shorted is "shorted", not "excellent".
- A device that resets when a motor starts (the Homestar symptom) is the classic case where bulk-capacitor ESR matters: the DMM shows a correct average rail while the rail dips for milliseconds. A DMM min/max capture mode or an oscilloscope is required to see it, so a "rail OK" verdict from a plain DC reading should be labelled as an average.
- Tantalum in-circuit test is the same net-level short test. A shorted tantalum is usually visibly burnt or cracked, but that is an inference from the ignition mechanism, not a cited statistic.

### Gaps

- The original Bob Parker / Dick Smith ESR meter chart was not read from a primary copy (the manual PDFs returned 403 and the Scribd copy was not opened). The ESP table is described by its author as compiled from his ESR meters' panels, so it is close to that chart, but it is not confirmed to be identical to it.
- Nichicon and Rubycon technical notes were not opened (timeout). The ±20 % / 200 % endurance limits come from an unidentified datasheet via a search summary.
- No source gives ESR limits for SMD tantalum or polymer parts by value.

## Diodes (signal, rectifier, Schottky, Zener, TVS) and LEDs

### Takeaway

Diode mode in both directions is the test: one forward drop in the right band and OL in reverse. In circuit, "near zero both ways" is a short only after parallel paths are excluded, and Zener and TVS parts can only be checked for shorts, since their breakdown voltage needs a bench supply.

### Cited Findings

Procedure and expected readings (power off, capacitors discharged):

- Fluke procedure: power off and verified, diode-test mode, leads across the diode, record, reverse the leads, record. Good silicon forward 0.5 to 0.8 V; good germanium 0.2 to 0.3 V; good reverse OL; open is OL in both directions; shorted is the same voltage drop "of approximately 0.4 V" in both directions. "You may need to disconnect one end of the diode from the circuit." [Fluke, how to test diodes](https://www.fluke.com/en-us/learn/blog/digital-multimeters/how-to-test-diodes)
- Fluke, resistance mode: remove the diode from the circuit; forward 1000 Ω to 10 MΩ, reverse OL, bad is the same reading in both directions. Resistance mode should not be used on a diode in circuit and "does not always indicate whether a diode is good or bad". [Fluke, same page](https://www.fluke.com/en-us/learn/blog/digital-multimeters/how-to-test-diodes)
- Practitioner bands: silicon 0.5 to 0.7 V forward, OL reverse; Schottky 0.2 to 0.4 V; LED red or green 1.5 to 2.2 V; LED blue or white 2.8 to 3.5 V; Zener 0.5 to 0.7 V forward, reverse OL or the Zener voltage. Fail signs: 0.000 V both directions is shorted; OL both directions is open; a low voltage both directions (for example 0.3 V) is leaky. [Applied EE notebook, dead or alive](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/dead-or-alive/)
- A second set of bands: conventional silicon about 0.45 to 0.80 V; Schottky about 0.15 to 0.45 V (meter and temperature dependent). [Siborg, how to test PCB diodes without removing them](https://siborg.com/?p=175)
- Where sources differ on a shorted diode: Fluke says about 0.4 V in both directions; the Applied EE notebook says 0.000 V both directions; a Fluke-manual-based FAQ says "if a junction is shorted, the meter reads 0 V in both forward- and reverse-bias tests" ([Test and Measurement Tips, testing transistors with a voltmeter FAQ](https://www.testandmeasurementtips.com/testing-transistors-with-a-voltmeter-faq/), _via search summary_).

In-circuit interpretation:

- Near zero in both directions: likely shorted, "but first rule out a low-resistance parallel path on the board". Open in both directions: an open diode, poor contact, or a node that prevents enough test voltage reaching the junction. Normal forward and open reverse: encouraging but not proof (reverse leakage at rated voltage, switching behaviour and breakdown may still be out of specification). A forward reading slightly unlike the reference is not a failure. [Siborg, same page](https://siborg.com/?p=175)
- Parallel resistors can create apparent reverse conduction. Junctions inside MOSFETs, transistors and ICs can look like extra diodes. A protection diode may read forward in one direction while an IC input clamp conducts in the other, which is not a failed diode. Lift one end for a questionable result. [Siborg, same page](https://siborg.com/?p=175)
- Compare a suspicious reading with an identical diode channel or a known-good board. This is often faster than a universal voltage-drop figure. [Siborg, same page](https://siborg.com/?p=175)
- Schottky diodes in power paths legitimately read 0.2 to 0.3 V one way. [Applied EE notebook, short between nets](https://applied-ee.github.io/ee-notebook/docs/measurement/continuity-connections/short-between-nets)

Zener and TVS:

- Diode mode confirms only the forward junction of a Zener or unidirectional TVS. Reverse breakdown is tested with a controlled supply, a series resistor and a voltage measurement at a specified current. Never apply an uncontrolled supply directly across the part. A bidirectional TVS is not a single junction and must be judged against its standoff and breakdown specifications. [Siborg, same page](https://siborg.com/?p=175) **[needs: bench supply and resistor]**
- Breakdown test: TVS in series with a resistor on a variable supply, DMM across the diode, raise the supply. The breakdown voltage is where the diode voltage stops following the supply. [DigiKey TechForum, how to test the breakdown voltage of a TVS diode](https://forum.digikey.com/t/how-to-test-the-breakdown-voltage-of-tvs-diode/999) _(via search summary)_
- A functional TVS looks like an open circuit at the meter's low test voltage, so a DMM in continuity or resistance mode cannot verify that a TVS works, only that it is not shorted. [Industrial Monitor Direct, testing TVS diodes](https://industrialmonitordirect.com/blogs/knowledgebase/testing-tvs-diodes-in-power-supplies-why-standard-dmm-methods-fail) _(via search summary)_
- A Zener or TVS will conduct in reverse at its rated voltage if the DMM's open-circuit voltage exceeds it. This is normal. [Applied EE notebook, dead or alive](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/dead-or-alive/)

LEDs:

- A DMM can test an LED if it applies enough voltage to overcome the forward voltage. Red, green and yellow are easy; blue and white need more. A white LED begins conducting at about 2.5 V, so a meter that outputs at least about 2.5 V can test most LEDs. At low output the LED may only glow very dimly. [Circuit Specialists, using a DMM to test LEDs](https://www.circuitspecialists.com/blog/?p=347) and [DigiKey TechForum, test LED by a DMM](https://forum.digikey.com/t/test-led-by-a-digital-multimeter-dmm/1428) _(via search summary; which of the two pages states the 2.5 V figure was not confirmed)_
- Red, green and yellow LEDs often light in diode mode. White, blue, UV and series strings may need more voltage than the meter supplies, "so OL does not prove an LED is open". Use a current-limited supply or LED tester. [Siborg, same page](https://siborg.com/?p=175)

Power on:

- A conducting silicon junction shows about 0.6 V across it (base-emitter of a transistor that is on). [Electronics Notes, transistor circuit fault finding](https://www.electronics-notes.com/info/t_and_m/meters/transistor-circuit-fault-finding.php)

Failure modes:

- Most diode and transistor failures are complete breakdowns, visible immediately on a go/no-go test; parameter degradation is rare. [Electronics Notes, how to test a transistor and a diode with a multimeter](https://www.electronics-notes.com/articles/test-methods/meters/multimeter-diode-transistor-test.php)

### Inferences

- Suggested diode-mode verdict bands (lifted or known isolated), combining the cited ranges: 0.00 to about 0.10 V both directions is "shorted"; 0.15 to 0.45 V forward with OL reverse is "good Schottky"; 0.45 to 0.80 V forward with OL reverse is "good silicon"; 1.5 to 2.2 V (red, yellow, green) or 2.5 to 3.5 V (blue, white) forward, ideally with a glow, is "good LED"; OL both directions is "open" for silicon and Schottky, and "open or meter voltage too low" for an LED; any conduction in reverse on an isolated silicon diode is "leaky or shorted".
- In circuit, the same bands apply with one change: a low reading in both directions is "ambiguous, lift one leg", and a normal forward reading with a non-OL reverse reading is "parallel path present, compare with a twin or lift".
- Power-on checks that follow from the forward-drop figures: a series (reverse-protection or OR-ing) diode should drop about 0.2 to 0.45 V (Schottky) or 0.5 to 0.8 V (silicon) from anode to cathode while carrying current; 0 V across it with current flowing means shorted, and full supply across it means open. A Zener used as a clamp or reference should show its rated voltage across it; far below with the source resistor healthy means it is leaky or shorted. An indicator LED that is lit shows 1.6 to 3.3 V across it; supply voltage across an unlit LED means the LED is open, and 0 V across it means no drive or a shorted LED. These are derived, not cited as procedures.
- A shorted TVS or Zener on the input rail is a classic cause of "rail shorted to ground, fuse blown" after an over-voltage or reverse-polarity event. No frequency statistic was found.

### Gaps

- No source confirmed how often TVS diodes fail short versus open. The search explicitly found no source for the widely repeated "TVS fails short" claim.
- No failure-mode distribution for diodes (MIL-HDBK-338B) could be retrieved.
- LED forward-voltage bands by colour come from practitioner sources, not an LED manufacturer's datasheet.

## Bipolar transistors (NPN and PNP)

### Takeaway

A BJT tests as two diodes sharing the base: exactly two of the six probe combinations conduct, at about 0.5 to 0.8 V, and collector to emitter reads OL both ways. Powered, a conducting silicon transistor shows about 0.6 V base to emitter, and a switch shows the collector near 0 V when on and near the rail when off.

### Cited Findings

Out of circuit (definitive go/no-go):

- Use diode check rather than a resistance range. Test all six lead combinations. Exactly two should conduct; any other count means the transistor is defective or is not a BJT. The base is the lead common to both conducting pairs. NPN: conducts with red (+) on the base. PNP: conducts with black (-) on the base. The base-emitter junction reads slightly higher than base-collector. Example PNP: B-E 0.655 V, B-C 0.621 V. [Kuphaldt, Lessons in Electric Circuits, meter check of a transistor (LibreTexts)](<https://workforce.libretexts.org/Bookshelves/Electronics_Technology/Book%3A_Electric_Circuits_III_-_Semiconductors_(Kuphaldt)/04%3A_Bipolar_Junction_Transistors/4.03%3A_Meter_Check_of_a_Transistor_(BJT)>)
- NPN: B-E and B-C read 0.5 to 0.7 V with the red lead on the base; C-E reads OL in both directions. PNP: same with the black lead on the base. Darlington: B-E reads about 1.2 to 1.4 V (two junctions in series, normal). Fail signs: OL on all junctions is open internal bonds; 0 V on B-E or B-C is a shorted junction. [Applied EE notebook, dead or alive](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/dead-or-alive/)
- An open junction gives OL for both forward and reverse bias on that junction; a shorted junction reads 0 V both ways. [Test and Measurement Tips FAQ, based on Fluke manuals](https://www.testandmeasurementtips.com/testing-transistors-with-a-voltmeter-faq/) _(via search summary)_
- Also check collector to emitter in both directions: it must be open both ways. This catches a transistor that has been "blown through", leaving a collector-emitter short while the diode junctions still read. [Electronics Notes, how to test a transistor and a diode with a multimeter](https://www.electronics-notes.com/articles/test-methods/meters/multimeter-diode-transistor-test.php). Caution: the fetched summary of this page appeared to state the NPN base polarity inverted in two steps, so use the Kuphaldt polarity above.
- The junction test checks basic integrity only. It cannot measure breakdown voltage or current gain. [Electronics Notes, same page](https://www.electronics-notes.com/articles/test-methods/meters/multimeter-diode-transistor-test.php)
- Gain **[needs: DMM with hFE socket or component tester]**: small-signal NPN or PNP (2N3904, BC547, 2N3906, BC557) typically 100 to 300; power transistors 20 to 70; Darlington 1000+. An hFE of 5 where 150 is expected indicates degradation. An hFE above about 500 on a 100 to 300 part can mean collector-base leakage mimicking gain. [Applied EE notebook, ESR, leakage, gain](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/esr-leakage-gain/)

In circuit, power off:

- Junction tests in circuit are a screen. One source states the diode test discussion is for out-of-circuit transistors only; another allows in-circuit use with care. [Test and Measurement Tips FAQ](https://www.testandmeasurementtips.com/testing-transistors-with-a-voltmeter-faq/); [Electronics Notes](https://www.electronics-notes.com/articles/test-methods/meters/multimeter-diode-transistor-test.php) _(via search summary)_
- A shorted BJT junction reads near zero both ways; an open device reads open on all junctions. [Applied EE notebook, field failure modes](https://applied-ee.github.io/ee-notebook/docs/debugging/component-field-failures/)

Power on (black lead on ground, DC volts):

- Linear common-emitter stage: base about 0.6 V above the emitter (silicon); emitter around 1 to 2 V (typically about 1 V across the emitter resistor); collector about half the rail voltage, or close to the rail with an inductive load. Switching circuit: collector near 0 V when on and near the rail when off; base about 0.6 V when on and 0 V when off; emitter usually grounded. [Electronics Notes, transistor circuit fault finding](https://www.electronics-notes.com/info/t_and_m/meters/transistor-circuit-fault-finding.php)

Failure modes:

- BJT shorted C-E or C-B (overcurrent, avalanche) leaves the circuit stuck high or low. Open (bond wire or die crack) gives no current. [Applied EE notebook, field failure modes](https://applied-ee.github.io/ee-notebook/docs/debugging/component-field-failures/)
- A transistor with healthy junctions but low gain has likely suffered thermal stress. [Applied EE notebook, ESR, leakage, gain](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/esr-leakage-gain/)

### Inferences

- Suggested six-reading entry form for the app (B-E, E-B, B-C, C-B, C-E, E-C in diode mode): pass when exactly two readings fall in 0.45 to 0.80 V, both share the base, B-E is at or slightly above B-C, and the other four read OL. Any reading under about 0.1 V is a shorted junction. C-E conducting in either direction is a failed (shorted or leaky) transistor. Parts with built-in bias resistors ("digital transistors") or Darlingtons will not fit this pattern and need their own expected values.
- In circuit, base resistors and neighbouring parts add parallel paths, so only two outcomes are trustworthy without lifting: a near-zero reading between any two pins in both directions (suspect short, confirm by lifting), and a clean two-junction pattern (probably good).
- Power-on decision rules that follow from the cited voltages, for a grounded-emitter NPN switch: base at about 0.6 to 0.7 V and collector near 0 V is on and healthy; base at about 0.6 to 0.7 V and collector at the rail means the transistor is open C-E or the load is open; base at 0 V and collector near 0 V means the transistor is shorted C-E or the collector load is open; base well above 0.8 V means the base-emitter junction is open. These are standard deductions, and no cited source tabulates them.

### Gaps

- No failure-mode percentage for BJTs could be retrieved (MIL-HDBK-338B table not accessible).
- No source found gives Vce(sat) limits to enter as a pass threshold. Typical datasheets give 0.1 to 0.3 V at moderate current, but that was not verified here.

## MOSFETs (N and P channel, body diode)

### Takeaway

A good MOSFET shows one body diode (about 0.4 to 0.9 V, red on source and black on drain for N-channel, reversed for P-channel), OL the other way, and OL from the gate to both other pins. The usual failure is a drain-source short, often with a damaged gate. In circuit, a low reading must be confirmed with the part removed because rails and parallel parts can read low.

### Cited Findings

Out of circuit:

- Discharge first by shorting all pins together (or gate to source). [PNW Computers IT manual, MOSFET diagnostics](https://pnw-computers.github.io/IT-Manual/diagnostics/mosfet_diagnostics/); [Applied EE notebook, dead or alive](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/dead-or-alive/)
- Body diode, N-channel: red on source, black on drain reads 0.4 to 0.9 V; reversed reads OL. [PNW Computers, MOSFET diagnostics](https://pnw-computers.github.io/IT-Manual/diagnostics/mosfet_diagnostics/). The same 0.4 to 0.9 V range is given by [Wevolver, how to test a MOSFET](https://www.wevolver.com/article/how-to-test-a-mosfet) _(via search summary)_.
- A narrower band: body diode 0.4 to 0.7 V with red on source, black on drain. [Applied EE notebook, dead or alive](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/dead-or-alive/)
- Gate to source and gate to drain should read OL in both directions. Any gate conductivity means damaged gate oxide. [Applied EE notebook, dead or alive](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/dead-or-alive/); [PNW Computers, MOSFET diagnostics](https://pnw-computers.github.io/IT-Manual/diagnostics/mosfet_diagnostics/)
- Resistance mode: drain to source with the MOSFET off should read megohms. A beep or near 0 Ω drain to source is shorted. Failure signs: a voltage drop in both directions D-S and S-D is a shorted junction; OL in both directions is an open internal diode. [PNW Computers, MOSFET diagnostics](https://pnw-computers.github.io/IT-Manual/diagnostics/mosfet_diagnostics/)
- Switching (go/no-go) test, N-channel: discharge all pins; red on gate, black on source for a few seconds to charge the gate; move red to drain with black on source: near 0 V or a beep means on; short gate to source; re-test drain to source: it should return to OL. [PNW Computers, MOSFET diagnostics](https://pnw-computers.github.io/IT-Manual/diagnostics/mosfet_diagnostics/); [Applied EE notebook, ESR, leakage, gain](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/esr-leakage-gain/)
- Limits of the switching test: logic-level MOSFETs (threshold about 1.5 to 2.5 V) turn on more easily from the meter than standard devices (about 4 V). A MOSFET that will not turn on may be standard-threshold rather than dead. The test confirms switching but not threshold voltage or Rds(on). [Applied EE notebook, ESR, leakage, gain](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/esr-leakage-gain/)
- Analog-meter variant: x10k range (which uses the 9 V battery), black on drain, charge and discharge the gate; a shorted FET reads toward zero ohms and does not discharge. P-channel: reverse the probe polarity. A reply warns that touching the gate with a finger can damage the oxide by static discharge. [DigiKey TechForum, how to test a MOSFET](https://forum.digikey.com/t/how-to-test-a-mosfet/1985)
- The definitive Rds(on) measurement applies a gate voltage above threshold and a specified drain current, then measures the drain-source voltage drop. [Toshiba FAQ on Rds(on)](https://toshiba.semicon-storage.com/ap-en/semiconductor/knowledge/faq/mosfet/electrical-characteristics-of-mosfetsstatic-characteristics-rds-.html) _(via search summary)_ **[needs: bench supply]**

In circuit, power off:

- Always measure both polarities: a MOSFET body diode may show as a "short" in only one direction. [Applied EE notebook, short between nets](https://applied-ee.github.io/ee-notebook/docs/measurement/continuity-connections/short-between-nets)
- A short may come from a nearby shorted decoupling capacitor. The output side of a CPU or GPU MOSFET can read about 1 to 5 Ω to ground naturally. "If a short is measured in-circuit, remove the MOSFET and retest on the bench." [PNW Computers, MOSFET diagnostics](https://pnw-computers.github.io/IT-Manual/diagnostics/mosfet_diagnostics/)
- In a buck stage, the inductor to the input rail should read OL. A 0 Ω reading means the high-side MOSFET is dead (shorted). [PNW Computers, MOSFET diagnostics](https://pnw-computers.github.io/IT-Manual/diagnostics/mosfet_diagnostics/)

Power on:

- V_GS = V_gate - V_source. An N-channel typically needs V_GS above about 4.5 V (logic-level parts) or above the datasheet threshold to turn on. [PNW Computers, MOSFET diagnostics](https://pnw-computers.github.io/IT-Manual/diagnostics/mosfet_diagnostics/)
- A MOSFET running hotter than expected can have increased Rds(on) from partial damage, which gets worse over time. [Applied EE notebook, field failure modes](https://applied-ee.github.io/ee-notebook/docs/debugging/component-field-failures/)

Failure modes and visual signs:

- MOSFET always conducting drain to source: gate oxide breakdown or a D-S short from overcurrent. Open: bond wire or die crack. Causes: overcurrent, avalanche, ESD, Vgs overvoltage. [Applied EE notebook, field failure modes](https://applied-ee.github.io/ee-notebook/docs/debugging/component-field-failures/)
- Visual: "popcorn" craters, PCB discolouration around the pins, burnt smell. With about 1 V injected into the shorted rail a failed MOSFET heats, and sprayed isopropyl alcohol evaporates off it quickly. [PNW Computers, MOSFET diagnostics](https://pnw-computers.github.io/IT-Manual/diagnostics/mosfet_diagnostics/)

### Inferences

- Suggested verdict rules (isolated part, diode mode, after discharging the gate): D-S reads under about 0.1 V in both directions gives "shorted, replace"; body diode 0.4 to 0.9 V in the correct direction and OL in the other, with gate OL to both pins, gives "passes static test"; any non-OL reading from the gate (after the brief capacitive charging blip) gives "gate damaged, replace"; OL in both D-S directions gives "open".
- P-channel: body diode conducts with red on drain and black on source, and the gate is charged with black on gate and red on source. This is the mirror of the cited N-channel procedure ("reverse the probe polarity").
- Power-on rule for a MOSFET used as a switch: when commanded on, the drain-source voltage should be near 0 V (I x Rds(on), usually tens of millivolts at small-board currents). Full supply across D-S with the gate driven beyond threshold means the MOSFET is open or the gate drive is not arriving; near 0 V across D-S with V_GS at 0 V means it is shorted. Derived from the cited Rds(on) definition, not from a cited procedure.
- For a P-channel high-side load switch on a 5 V board: off requires the gate near the source voltage (5 V); on requires the gate pulled toward ground. A gate stuck mid-way suggests a failed driver transistor or pull-up.

### Gaps

- No manufacturer application note (Infineon, onsemi, Vishay) on multimeter testing of MOSFETs was found. The procedures above come from a technician manual, a forum and a practitioner notebook.
- No failure-mode distribution for MOSFETs was retrieved.
- No source gives the expected diode-mode reading for a P-channel body diode as a number separate from N-channel.

## Linear regulators (LDO)

### Takeaway

An LDO is tested powered: input, enable and output voltages at its pins. A low or missing output with a good input points to dropout, current limit (a downstream short or overload), thermal shutdown or a disabled enable pin before it points to a dead regulator.

### Cited Findings

Power on:

- Measure Vin at the regulator pin, the enable or shutdown pin state, and Vout at the regulator pin and at the load. Measure load current and check for downstream shorts. [Applied EE notebook, field failure modes](https://applied-ee.github.io/ee-notebook/docs/debugging/component-field-failures/)
- Symptoms and causes: no output; output low (for example 2.8 V instead of 3.3 V) from current limit or LDO dropout; output oscillating from a missing or wrong output capacitor or ESR out of range; correct but noisy; regulator extremely hot from excessive load, a shorted output or high dropout dissipation. [same page](https://applied-ee.github.io/ee-notebook/docs/debugging/component-field-failures/)
- Rail readings: 0 V means the supply is not running, an open trace or a blown fuse (check upstream); low but non-zero means a short loading the rail or a regulator not regulating (possibly in current limit); measure at the load as well as at the regulator. [Applied EE notebook, is voltage present](https://applied-ee.github.io/ee-notebook/docs/measurement/power-rails-supplies/voltage-present/)
- Reasons an LDO may not regulate: current limit activated, thermal shutdown exceeded, dropout voltage specification not obeyed, capacitor ESR rules not obeyed. [Analog Devices LDO FAQs on DigiKey TechForum](https://forum.digikey.com/t/analog-devices-ldo-low-dropout-faqs/38826) _(via search summary)_
- Dropout voltage is the difference between Vout and the lowest specified Vin at rated load current. [Analog Devices, how to successfully apply low-dropout regulators](https://www.analog.com/en/resources/analog-dialogue/articles/applying-low-dropout-regulators.html) _(via search summary, page timed out)_
- A conventional (non-LDO) linear regulator has a dropout of about 2 V; an LDO's is much lower. _(Via search summary of LDO primers; the exact page was not identified. Candidates: [Electronic Design LDO FAQ](https://www.electronicdesign.com/technologies/power/power-supply/regulators/article/21196577/faqs-low-dropout-ldo-linear-regulators), [Toshiba LDO basics](https://toshiba.semicon-storage.com/us/semiconductor/knowledge/e-learning/basics-of-low-dropout-ldo-regulators.html).)_
- Enable: the EN pin voltage must be above the VIH threshold for the device to be fully enabled. [TI LP5922 datasheet](https://ti.com/document-viewer/LP5922/datasheet) _(via search summary)_
- Thermal shutdown: the device can cycle on and off when thermal shutdown is reached until dissipation is reduced ([TI LP2980-ADJ datasheet](https://ti.com/document-viewer/LP2980-ADJ/datasheet/GUID-42091374-A00D-47C4-904C-9CE9BFAB8AE1)); typical shutdown at 150 to 165 °C junction ([LTC LDO FAQ](https://www.mouser.com/pdfdocs/LTC_LDO_FAQ.pdf)). _(both via search summary)_
- Output differs from the feedback-ratio calculation (adjustable parts): check for drifted feedback resistors or leakage into the feedback pin. The IC regulates the voltage at its feedback pin. [Applied EE notebook, is voltage present](https://applied-ee.github.io/ee-notebook/docs/measurement/power-rails-supplies/voltage-present/)

Power off:

- Output rail to ground and input rail to ground are checked like any rail for a short (see the capacitor section thresholds). [Applied EE notebook, short between nets](https://applied-ee.github.io/ee-notebook/docs/measurement/continuity-connections/short-between-nets)

### Inferences

- Suggested decision tree for a fixed 3.3 V LDO fed from 5 V: (1) Vin at the pin under about 3.3 V plus dropout gives "input problem, go upstream"; (2) EN low gives "disabled, trace EN"; (3) Vin good, EN high, Vout near 0 V: power off and measure the output rail to ground. Shorted gives "load fault, not the regulator"; not shorted gives "regulator failed open, replace"; (4) Vout low and the regulator hot gives "overload or partial short downstream"; (5) Vout equal to Vin gives "pass element shorted, replace, and check what the over-voltage damaged downstream"; (6) Vout within tolerance gives "pass".
- The dropout check is simply Vin minus Vout at the pins under load. If the difference is smaller than the part's datasheet dropout at that load, the output will sag even though the regulator is healthy. With a 5 V input and a 3.3 V output there is 1.7 V of headroom, so dropout is only an issue when the 5 V input itself sags (a weak adapter, a resistive connector or a tripped polyfuse upstream).
- For an unskilled technician the safest quick heat test is the back of a finger near (not on) the part after 30 seconds, or a thermal camera. No temperature threshold was sourced.

### Gaps

- No source gave a typical LDO dropout figure in millivolts (it is part-specific: read the datasheet at the actual load current).
- No source gave a rail tolerance to use as a pass band (commonly ±5 % for logic rails, but this was not verified against a cited document).
- The Analog Devices article could not be read in full.

## Switching regulators (buck and boost), inductors and ferrite beads

### Takeaway

With a multimeter, a switcher is checked at four DC points (VIN, EN, feedback pin, output), and its inductor for continuity. Whether it is actually switching, its ripple and inductor saturation need an oscilloscope. Inductors and beads read as near-shorts when good, so the only multimeter verdict is "open or not".

### Cited Findings

Inductors and ferrite beads (power off, continuity or lowest ohms):

- Expected DC resistance: small ferrite bead under 1 Ω; SMD power inductor (1 to 47 µH) 0.01 to 1 Ω; through-hole choke (100 µH to 10 mH) 1 to 50 Ω. OL means an open winding. Resistance does not reveal a cracked or saturated core. [Applied EE notebook, dead or alive](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/dead-or-alive/)
- Inductor tolerance: ±20 % is common for moulded or shielded power inductors. A ferrite bead is specified by impedance at a frequency, not ±% inductance. [Applied EE notebook, within tolerance](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/within-tolerance/) **[needs: LCR meter to measure inductance]**
- A shorted winding shows as inductance far below nominal, not as a resistance change the meter can see (stepper example: never below 100 µH on a part of a few mH). [TechOverflow, how to check a stepper motor for open or short circuit](https://techoverflow.net/2021/11/16/how-to-check-a-stepper-motor-for-open-short-circuit/) **[needs: LCR meter]**

Buck converter, power on:

- Failure to start: the enable pin or power-good output is not driven or pulled up correctly; heavy load capacitance looks like a short and trips current limit; the input sags and triggers undervoltage lockout. Check enable and power-good levels and input droop at startup. [EEPower, troubleshooting 9 common DC-DC buck converter issues](https://eepower.com/technical-articles/troubleshooting-9-common-dc-dc-buck-converter-issues/)
- Excessive ripple: inductance too low, output capacitance too low, output capacitor ESR too high, switching frequency too low. Output voltage present while disabled: another rail is feeding it through a non-obvious path. Low efficiency (heat): losses are mainly in the MOSFETs and the inductor's DC resistance; a bootstrap capacitor that is too small stops the high-side FET turning fully on. Electrolytic ESR rises and capacitance falls in the cold. [same article](https://eepower.com/technical-articles/troubleshooting-9-common-dc-dc-buck-converter-issues/)
- Field cases: output stuck near the roughly 0.8 V feedback reference with VIN and EN confirmed ([ST community, ST1S10PHR](https://community.st.com/power-management-53/st1s10phr-buck-converter-not-regulating-output-0-79v-165051)); EN and VIN correct, no pulses on SW, 0 V out until power was cycled ([ST community, L6981](https://community.st.com/power-management-53/l6981cdr-stops-working-151435)); FB reading 0.65 V instead of 0.8 V traced to flux contamination, cured by cleaning ([TI E2E, LMZ12001](https://e2e.ti.com/support/power-management-group/power-management/f/power-management-forum/1107567/lmz12001-fb-pin-sitting-at-0-65-v-and-not-at-0-8-v)); TI's startup guide says to verify the top feedback resistor is installed ([TI SLYT638](https://www.ti.com/lit/pdf/slyt638)). _(all via search summary)_
- Switching output capacitors with high ESR show more ripple and may make the converter unstable even when capacitance measures correctly. Check the ESR of output electrolytics first when a supply shows excess ripple after years of service. [Applied EE notebook, ESR, leakage, gain](https://applied-ee.github.io/ee-notebook/docs/measurement/component-testing/esr-leakage-gain/)

Power off:

- Inductor (switch node) to the input rail should read OL; 0 Ω means a shorted high-side MOSFET. [PNW Computers, MOSFET diagnostics](https://pnw-computers.github.io/IT-Manual/diagnostics/mosfet_diagnostics/)

### Inferences

- Multimeter decision tree for a buck or boost stage: (1) VIN at the IC pin; (2) EN above its threshold; (3) output voltage; (4) feedback pin voltage against the datasheet reference (often 0.6 to 0.8 V; a reference of about 0.8 V appears in the cited cases); (5) power off: inductor continuity (under 1 Ω), switch node to VIN and to ground in diode mode (one body diode each way for an integrated or external FET pair, never 0 Ω), catch diode in diode mode (Schottky 0.15 to 0.45 V), output rail to ground for a short.
- FB at its reference with a wrong output means the divider resistors are wrong or drifted. FB below reference with a low output means the converter cannot deliver: overload, a shorted output, an open inductor or a dead IC. FB above reference with a high output means the IC is not controlling (a shorted high-side switch).
- With no oscilloscope, a DMM on AC volts at the switch node is not a reliable switching indicator at hundreds of kilohertz (the cited ESP article notes many multimeters are unusable above roughly 10 kHz). The DC average of the switch node is a usable hint for a buck: it should sit near the output voltage, 0 V means it is not switching (or the high side is open), and VIN means the high side is stuck on.
- A ferrite bead in series with a rail is a hidden fuse: an open bead gives full voltage on one side and 0 V on the other. Voltage drop across a healthy bead should be a few millivolts.

### Gaps

- No vendor document was found that gives a multimeter-only troubleshooting sequence for a buck or boost converter.
- No failure-rate data for inductors or ferrite beads was retrieved (overcurrent open, cracked ferrite). The "open is the only detectable failure" statement rests on the notebook source.
- Boost-specific checks (output equals input minus a diode drop when not switching) were not sourced.

## Fuses and polyfuses (PTC)

### Takeaway

A fuse is good at near 0 Ω and blown at OL; powered, a good fuse drops almost nothing (under about 0.1 V) and a blown one has the full supply across it. A polyfuse is good at a low resistance (order of 0.5 Ω for a small part), may read high for a while after tripping, and is judged only after it has cooled.

### Cited Findings

Fuses:

- Continuity test with the fuse removed and power off: first touch the leads together to confirm a beep or 0 Ω. A good fuse beeps and shows a very low resistance. A blown fuse gives no beep and/or OL. [DigiKey blog, testing and identifying fuse problems](https://www.digikey.com/en/blog/testing-and-identifying-fuse-problems)
- Voltage test in circuit with power on: leads on either side of the fuse. Good: little to no voltage across it. Blown: a voltage difference, "typically the full supply voltage". [same page](https://www.digikey.com/en/blog/testing-and-identifying-fuse-problems)
- A numeric rule from a forum: under 0.1 V across a good fuse, full voltage across a bad one. [the12volt.com forum](https://www.the12volt.com/installbay/forum_posts.asp?tid=57303) _(via search summary)_
- Equivalent check: measure each side to ground. A good fuse shows nearly the same voltage on both sides; a blown one shows supply on one side and none on the other. [MVW Autotechniek, fuses](https://www.mvwautotechniek.nl/en/fuses) _(via search summary)_
- Do not use resistance or continuity on a fuse in a powered circuit. [RV Electricity, testing for a blown fuse](https://rvelectricity.substack.com/p/testing-for-a-blown-fuse-with-a-multimeter) _(via search summary)_
- Replace with identical specifications; keep the original type (slow-blow versus fast-blow). [DigiKey blog, same page](https://www.digikey.com/en/blog/testing-and-identifying-fuse-problems)
- For a blown fuse, find the cause rather than fitting a larger fuse, and look for short or overload signs. [Nuts and Volts, repairing circuit boards](https://www.nutsvolts.com/magazine/article/repairing-circuit-boards)

Polyfuses (PPTC):

- When current exceeds the limit, the device warms above a threshold and its resistance rises by several orders of magnitude (three or more above the cold resistance). The tripped resistance is typically hundreds or thousands of ohms. [Circuit Cellar, PPTC fuses](https://circuitcellar.com/resources/quickbits/pptc-fuses/) and [US patent 8724283](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/8724283) _(via search summary)_
- Cooling usually takes a few seconds, but a tripped device keeps a slightly higher resistance for hours. Return to near-original resistance can take hours, days, weeks or may never happen. [Wikipedia, resettable fuse](https://www.wikipedia.com/wiki/Polyfuse) _(via search summary)_
- R1max is the maximum resistance at 20 °C one hour after being tripped and reset, or after reflow soldering. The part-specific datasheet gives the value. [Littelfuse PolySwitch device selection guide](https://www.littelfuse.com/~/media/electronics/product_brochures/littelfuse_polyswitch_device_selection_guide_product_brochure.pdf.pdf) _(via search summary)_
- If the voltage across a tripped PPTC exceeds its rating, its resistance may not return to the initial state after the fault is removed. [Applications of PPTC in circuit protection (Mouser-hosted)](https://www.mouser.com/pdfDocs/ApplicationsofPPTCinCircuitProtections_en.pdf) _(via search summary)_
- Anecdote: a Bourns MF-R050 measured about 0.5 Ω cold, about 10 Ω when probed hot right after power removal, dropping quickly. [Arduino forum](https://forum.arduino.cc/t/reliability-of-ptc-resettable-fuses-mf-r050-2-after-being-shorted/221485) _(via search summary)_

### Inferences

- Suggested fuse verdicts: power off, lead resistance subtracted: under about 1 Ω is good (small SMD fuses can legitimately read a few tenths of an ohm); OL is blown; anything between is suspect (cracked element or bad joint). Power on: under 0.1 V across is good; near supply voltage across is blown.
- Suggested polyfuse verdicts: power on with the load running, a drop above a few tenths of a volt means it is tripping or degraded, and the real question becomes what draws the excess current. Power off after at least several minutes of cooling: within about 2 times its datasheet resistance is good; tens of ohms or more after an hour at room temperature is degraded, replace.
- A polyfuse on a 5 V input that has aged to a higher resistance is a plausible cause of "resets when the motor starts": the start-up current times the fuse resistance sags the rail. The powered test is to measure the drop across it at the moment the motor starts (min/max mode or oscilloscope).
- A blown fuse or tripped polyfuse is a symptom. The next step is always the rail-to-ground short check downstream before replacing or re-powering.

### Gaps

- The Littelfuse "fuses vs PTCs" page returned 403, so the comparison of fuse and PTC resistance, leakage in the tripped state and derating was not read.
- No source gave typical cold resistances for small SMD chip fuses by current rating.
- No source described visual patterns of blown fuses (overload versus short) for SMD parts.

## Crystals and resonators

### Takeaway

A crystal cannot be verified with a multimeter. The practical checks are indirect (does the processor run, is a clock visible on an output pin) or need an oscilloscope or frequency counter, and even a probe can stop the oscillator.

### Cited Findings

- If the clock is not running, nothing downstream works. Without a schematic: find the crystal (silver can, 4-pin package or 2-pin HC49), read its marking (for example 8.000 MHz, 12.000, 25.000, or 32.768 kHz for a real-time clock), trace it to the IC it drives and scope the output. [Applied EE notebook, fault isolation strategies](https://applied-ee.github.io/ee-notebook/docs/debugging/fault-isolation/) **[needs: oscilloscope]**
- Symptoms of oscillator problems: the device fails to start, delays take longer than expected, timers do not trigger at the expected time. Causes: missing external oscillator, incorrect configuration bits, crystal drive level, board layout, capacitive loading not meeting the crystal's requirement. Checks: enable a clock-out pin and measure its frequency with an oscilloscope or counter; for an external clock, probe the clock input pin; verify the loading capacitors against the crystal datasheet. [Microchip developer help, oscillator problems and delays](https://onlinedocs.microchip.com/oxy/GUID-D6FD9F43-8DC4-476E-A55E-AA21FA1CC865-en-US-4/GUID-40DF8F00-3CD5-4D26-95CC-108A48346A08.html)
- Probing one side of a crystal can show oscillation, but the probe's capacitance may change the crystal's behaviour. Use a high-impedance (10x) probe. [same page](https://onlinedocs.microchip.com/oxy/GUID-D6FD9F43-8DC4-476E-A55E-AA21FA1CC865-en-US-4/GUID-40DF8F00-3CD5-4D26-95CC-108A48346A08.html)
- A standard 10x probe adds 10 to 15 pF, and "you must not probe the crystal directly unless you have high-quality equipment intended for crystal measurements". [Microchip, crystal oscillator design guide, introduction](https://onlinedocs.microchip.com/oxy/GUID-E1A9010A-4FFF-4CCD-912A-926ED28D22D6-en-US-8/GUID-A218AC70-8FDC-4008-A164-8BB9BF9C2278.html) _(via search summary)_
- Low-power 32 kHz oscillators are especially sensitive: probing may stop the oscillation entirely. [ST community thread](https://community.st.com/stm32-mcus-products-25/crystal-oscillator-step-by-step-activation-and-testing-stm32f405-63621) _(via search summary)_
- Flux contamination around high-impedance pins can shift voltages; cleaning the area is a recognized fix (reported for a regulator feedback pin). [TI E2E, LMZ12001 thread](https://e2e.ti.com/support/power-management-group/power-management/f/power-management-forum/1107567/lmz12001-fb-pin-sitting-at-0-65-v-and-not-at-0-8-v) _(via search summary)_

### Inferences

- Multimeter-only checks that are safe to offer, all labelled "indicative, not a verdict": (1) power off, crystal pin to pin should read OL (a crystal is an open circuit at DC; a low reading is a short or contamination); each pin to ground should read as an IC pin (one junction in diode mode), not 0 Ω; the load capacitors must not be shorted; (2) power on, DC volts on each crystal pin: in a running Pierce oscillator both pins usually sit near mid-supply, while a pin stuck at 0 V or at VCC suggests the oscillator is not running. This mid-supply rule is common practice but no source was found for it, and many modern microcontrollers run from an internal oscillator, so a silent crystal may be normal.
- Since the crystal itself is cheap and hard to test, substitution (same frequency and load capacitance) is the definitive test once power, reset and solder joints are confirmed.
- Cracked crystals from a drop and dry joints on the load capacitors are plausible mechanical failures; no frequency data was found.

### Gaps

- No cited source for the DC bias voltage expected on crystal pins.
- No failure-mode distribution for crystals or ceramic resonators was retrieved.
- No source on testing ceramic resonators specifically.

## Tactile switches and connectors

### Takeaway

Switches and connectors are continuity tests with motion: near 0 Ω when closed, OL when open, and stable while pressed, wiggled or pulled. Datasheets specify 100 mΩ maximum when new, which a handheld meter cannot resolve, so the usable threshold is ohms, not milliohms.

### Cited Findings

- Tactile switch contact resistance: 100 mΩ maximum is the common datasheet figure, stated as an initial (new) value, typically measured at 2 to 4 V DC ([Alps Alpine SKSN](https://www.mouser.ca/alps-sksn-tact-switch); [E-Switch TL1018](https://www.mouser.in/new/e-switch/e-switch-tl1018-tact-switches)); some parts are specified at 500 mΩ or less. The datasheets give no end-of-life threshold. _(via search summary)_
- Continuity testing is used to check that switches operate properly and that conductors are not open or shorted, only with no voltage present. [Fluke, what is continuity](https://www.fluke.com/en-my/learn/blog/electrical/what-is-continuity)
- Connector failures: intermittent, position-sensitive connection from corroded pins or worn contact springs; a backed-out terminal; a cracked solder joint on a board-mount connector from insertion and removal stress. Visual sign: green or white deposits. Tests: wiggle test with a continuity meter, pull test on each wire, magnification for solder cracks, reflow and see if behaviour changes. [Applied EE notebook, field failure modes](https://applied-ee.github.io/ee-notebook/docs/debugging/component-field-failures/)
- Check connectors and socketed parts for dislodging first; it is common after shipping. [Nuts and Volts, repairing circuit boards](https://www.nutsvolts.com/magazine/article/repairing-circuit-boards)
- A button line with no internal diode reading where one is expected at the IC pin suggests suspect wiring. [Hackaday, internal ESD diode probing](https://hackaday.com/2023/12/14/hacker-tactic-internal-esd-diode-probing)
- Power on, logic input: a pin in its inactive state should sit at the level its pull-up or pull-down sets; a pin stuck in the active state means tracing upstream for a hold-down or a missing pull-up. [Applied EE notebook, fault isolation strategies](https://applied-ee.github.io/ee-notebook/docs/debugging/fault-isolation/)

### Inferences

- Suggested tactile switch protocol (power off, ohms mode, probes on the two switched terminals; 4-pin switches have two internally linked pairs): released must be OL (a low or drifting reading means a contaminated or stuck switch, or a parallel path through the pull-up and IC); pressed must be under about 1 to 2 Ω after lead subtraction and steady. Tens of ohms, or a reading that jumps while held, is a worn switch. Repeat ten presses.
- In circuit, the "released" reading is across the pull-up resistor and the IC input, so it will not be OL. Expected: roughly the pull-up value (kilohms) or higher. Under about 100 Ω released is a stuck or shorted switch.
- Power-on equivalent: voltage on the switch's signal pin is at the pull-up rail when released and under about 0.1 V when pressed (for a pull-up design). A pressed level that only falls part way indicates high contact resistance.
- Connector protocol: continuity end to end through the mated pair (pin on board A to pin on board B) under about 1 Ω while flexing the cable; power-on voltage drop across the mated power contacts under 0.1 V at load, reusing the fuse criterion.

### Gaps

- No source gives a field replacement threshold for worn tactile switch contact resistance.
- No failure-mode percentages for switches and connectors were retrieved (MIL-HDBK-338B not accessible).
- TE notes for relays that contact resistance should not be judged with an ohmmeter (see relays); whether that caution matters for logic-level tact switches was not addressed by any source.

## DC motors and stepper motors (winding resistance)

### Takeaway

A motor is disconnected and its winding resistance measured: a few ohms, never OL, and for steppers equal between phases with no connection between phases. An ohmmeter over-reads a brushed motor because of brush contact, so the reading is a go/no-go for open circuits, and rotating the shaft through several positions exposes bad commutator segments.

### Cited Findings

Brushed DC motors:

- "Armature circuit resistance cannot be measured accurately with an ohmmeter": the brush-to-commutator contact (oxide film, loose particles) adds resistance that a low-voltage, low-current meter picks up. Example: a 24 V DC motor read 0.674 Ω on a multimeter against 0.196 Ω by the voltage/current method; a 130 V DC motor read 11.41 Ω against 11.13 Ω. [Bodine Electric, measuring armature circuit resistance](https://bodine-electric.com/blog/?p=895)
- Accurate method **[needs: bench supply and current measurement]**: lock the rotor, apply a reduced voltage with a current of at least 10 % of rated current or 0.25 A (whichever is higher), record voltage and current at least five times with the armature in a different angular position each time, compute R = E / I and average. Start cold (about 25 °C) and work quickly, since resistance changes with temperature. [same page](https://bodine-electric.com/blog/?p=895)
- Resistance measurements are used to find open or short circuits: very high points to an open, near zero to a short. [same page](https://bodine-electric.com/blog/?p=895)
- A healthy small DC motor reads between 0.5 and 15 Ω. [aggregator page of uncertain quality](https://my.dev.fusebox.fm/test-dc-motor-2nem.html) _(via search summary; low-confidence source, treat as a rough range)_
- Brushes and commutator are the most common failure points on brushed DC motors. [ClimbTheLadder, how to test an electric motor with a multimeter](https://climbtheladder.com/how-to-test-an-electric-motor-with-a-multimeter/) _(via search summary)_

Stepper motors:

- Phase winding resistance is generally 0.5 to 5 Ω (compare with the datasheet); for a nominal 1.5 Ω motor, 1.0 to 2.0 Ω is acceptable. Open winding: OL (re-check pins and probe contact first). Shorted winding: far below nominal, for example 0.2 Ω on a 1.5 Ω motor. Phase A to phase B isolation: OL, or at least 5.0 MΩ. With an LCR meter, phase inductance is a couple of mH and never below 100 µH, and the two phases should match within ±30 %. [TechOverflow, how to check a stepper motor for open or short circuit](https://techoverflow.net/2021/11/16/how-to-check-a-stepper-motor-for-open-short-circuit/)
- Six-wire (unipolar) motors: the centre tap reads half the end-to-end resistance (4 Ω end to end gives 2 Ω centre to end). [Industrial Monitor Direct, six-wire stepper tests](https://industrialmonitordirect.com/blogs/knowledgebase/selecting-six-wire-stepper-current-and-torque-tests) _(via search summary)_
- Phase balance: windings should measure within ±5 % of each other; a variance above 10 % indicates a winding fault. [Industrial Monitor Direct, testing 4-phase stepper motors](https://industrialmonitordirect.com/blogs/knowledgebase/testing-4-phase-stepper-motors-resistance-torque-direction-bearings) _(via search summary; single non-authoritative source)_
- Stepper coils are usually under 20 Ω, so use the lowest ohms range. [guide via search summary](https://en.avtotachki.com/kak-proverit-shagovyy-dvigatel-s-pomosch-yu-mul-timetra-rukovodstvo/)

### Inferences

- Small geared stepper motors in consumer products (for example permanent-magnet micro steppers) often have much higher coil resistance (tens to a couple of hundred ohms) than the 0.5 to 5 Ω quoted for NEMA-size motors. The transferable rules are the relative ones: every phase equal within about 10 %, no continuity between phases, no continuity from any coil to the metal case.
- Suggested brushed DC motor protocol with a multimeter: disconnect one motor lead; measure across the terminals; rotate the shaft slowly through a full turn and note minimum and maximum. All positions between about 1 Ω and a few tens of ohms and roughly equal gives "windings continuous"; OL at any position gives "open winding or brush not touching"; near 0 Ω (lead-subtracted) at all positions gives "shorted". Then measure each terminal to the metal case: must be OL. Because the Bodine data shows a meter can over-read by 3 times on a low-resistance motor, a high-ish reading is not a fail.
- Stall current estimate: supply voltage divided by winding resistance. For a 5 V motor reading 5 Ω this is 1 A at the instant of starting, which is the load step the supply, polyfuse and driver must survive. This is the quantitative link between a motor test and a "resets when the motor starts" symptom.
- Functional test that isolates the motor from the board: run the disconnected motor from a separate supply (a battery with a series resistor or a current-limited bench supply) and observe that it starts in every shaft position. A motor that fails to start from some positions has a dead commutator segment.
- A suppression capacitor or varistor across the motor terminals can itself be shorted; an in-circuit 0 Ω across the motor needs the motor lead lifted before blaming the windings.

### Gaps

- No reliable source for typical winding resistance of small 3 to 6 V toy or hobby DC motors was found (the 0.5 to 15 Ω range comes from a low-quality page).
- The "turn the shaft and watch the reading" method is inferred from Bodine's five-position requirement; no source describes it as a multimeter diagnostic with thresholds.
- No source for coil-to-case insulation thresholds on low-voltage motors.

## Motor-driver ICs (H-bridge)

### Takeaway

An H-bridge driver fails most often at its outputs: stuck low (shorted to ground), stuck high (shorted to supply), open, or with raised on-resistance. The checks are power-off diode and resistance readings from each output to supply and ground with the motor disconnected, then powered voltages at supply, logic inputs and outputs with and without the motor.

### Cited Findings

Failure modes and frequency:

- TI's functional-safety analysis of the DRV8244-Q1 H-bridge driver gives this die failure mode distribution (random failures, not misuse): output stuck low when commanded off (ground short) 14 %; output stuck high when commanded off (supply short) 14 %; output stuck off when commanded low (open) 8 %; output stuck off when commanded high (open) 8 %; output on-resistance too high when commanded low 12 %; on-resistance too high when commanded high 18 %; slew rate wrong 5 % low side and 5 % high side; dead time too short 1 %; current-sense feedback incorrect 3 %; current regulation incorrect 3 %; incorrect communication or configuration 4 %; incorrect input interpretation 4 %; incorrect fault-pin assertion 1 %. Output modes are split 50/50 between OUT1 and OUT2. [TI SFFS057A, DRV8244-Q1 functional safety FIT rate, FMD and pin FMA](https://www.ti.com/lit/pdf/sffs057)
- A driver can fail in one direction only: it "fails to drive the motor in one direction, but continues driving the motor in the other direction". [NXP community, MC33926 failure mode](https://community.nxp.com/t5/Powertrain-and-Electrification/MC33926-USA-Unusual-MC33926-Motor-Driver-Failure-Mode/m-p/1091602) _(via search summary)_
- A damaged driver can still run the motor: an MC33926 output sat about 0.5 V low while still driving both directions; it was diagnosed at 100 % duty cycle with the motor disconnected. [Pololu forum](https://forum.pololu.com/t/output-voltage-of-mc33926-h-bridge-has-permanently-dropped/5904) _(via search summary)_
- A supply-to-ground short inside a driver was confirmed by isolating the IC's nets and removing the capacitors between VM and ground: continuity remained through the driver. [TI E2E, MCT8316Z](https://e2e.ti.com/support/motor-drivers-group/motor-drivers/f/motor-drivers-forum/1253873/mct8316z-need-help-diagnosing-possible-driver-failure) _(via search summary)_

Power on **[an oscilloscope is needed for transients]**:

- Signals to probe when debugging a brushed or stepper driver: the outputs, the motor supply VM (for spikes and undervoltage), and the fault pin, to determine or rule out overcurrent protection, undervoltage protection or stall detection. [TI E2E FAQ, oscilloscope tips for debugging brushed and stepper motors](https://e2e.ti.com/support/motor-drivers-group/motor-drivers/f/motor-drivers-forum/1182722/faq-oscilloscope-tips-and-tricks-for-debugging-brushed-and-stepper-motors) _(via search summary)_
- On TI drivers with a fault pin, nFAULT is an open-drain output pulled low on a fault; hardware-interface variants make it harder to tell which fault occurred. [TI DRV8244-Q1 datasheet](https://ti.com/document-viewer/DRV8244-Q1/datasheet/GUID-8AB8DAFC-2516-4C42-A791-7FD6BF8D5F8D); [TI E2E FAQ, debugging faults with hardware variant devices](https://e2e.ti.com/support/motor-drivers-group/motor-drivers/f/motor-drivers-forum/1160331/faq-debugging-faults-with-hardware-variant-devices) _(via search summary)_
- General IC rule: check supply pins, control inputs (enable, sleep), then signal inputs; suspect the IC only if all inputs are correct and the outputs are still wrong. [Applied EE notebook, field failure modes](https://applied-ee.github.io/ee-notebook/docs/debugging/component-field-failures/)

Power off:

- MOSFET body diodes show as conduction in one direction only, so always measure both polarities. [Applied EE notebook, short between nets](https://applied-ee.github.io/ee-notebook/docs/measurement/continuity-connections/short-between-nets)

### Inferences

- Expected static signature of a MOSFET H-bridge output, motor disconnected, diode mode: each OUT pin shows one body diode to the supply pin (red on OUT, black on VM: about 0.4 to 0.9 V) and one to ground (red on GND, black on OUT: about 0.4 to 0.9 V), and OL in the opposite directions. Near 0 V in both directions between OUT and GND or OUT and VM is a shorted output transistor. The two outputs should give matching readings, so OUT1 against OUT2 is a built-in known-good comparison. This follows from the bridge structure and the cited body-diode values; no source states it for a specific driver.
- VM to GND on the driver reads through every capacitor on the rail, so a low reading there must be isolated (lift the driver's supply pin or remove the driver) before blaming the IC, as in the cited TI case.
- Suggested powered sequence with a multimeter: (1) VM at the IC pin, idle; (2) logic inputs idle (both low or as the datasheet's standby state); (3) outputs idle (both low, both high-impedance or both at the same level depending on the part); (4) command one direction with the motor disconnected: one output near VM, the other near ground; (5) reverse; (6) reconnect the motor and repeat while watching VM. An output that reaches the rail unloaded but collapses with the motor points to raised on-resistance (30 % of the TI distribution) or a weak supply. VM collapsing at the IC pin when the motor starts points upstream (adapter, connector, polyfuse, bulk capacitor) or to a motor drawing excessive current.
- For a "device resets when the motor starts" fault, the discriminating experiment is substitution of the load: replace the motor with a resistor of similar or higher resistance (or run the motor from a separate supply). If the reset persists with a benign resistive load, the driver or its supply path is at fault; if it disappears, look at the motor's stall current and the bulk capacitance.
- The MX08L driver in the Homestar scenario is a small low-voltage dual H-bridge of the same class; none of the sources retrieved cover it specifically, so its pinout, standby levels and expected output levels must come from its own datasheet.
- Because roughly a third of the TI distribution is "on-resistance too high", a driver can pass every static multimeter test and still be the fault. Measuring the voltage from OUT to its rail under load (ideally under 0.5 V at small-motor currents, given the Pololu case of a 0.5 V shortfall being a fault) is the test that catches it.

### Gaps

- No TI or other vendor document gives a power-off multimeter signature for a healthy H-bridge driver.
- No data sheet or troubleshooting note for the MX08L was sought in this research task.
- The TI distribution is for one automotive driver and reflects random die failures. Field failures from abuse (stall, back-EMF, shorted motor) are probably more weighted toward shorted outputs, but no source quantified that.

## Microcontrollers and general ICs (supply pins, reset, clock, shorted pins)

### Takeaway

An IC is diagnosed by exclusion: correct supply at its pins, reset released, clock running, inputs correct, and only then the IC itself. With power off, each pin's protection diode to ground (about 0.4 to 0.9 V with red on ground, black on the pin) gives a quick way to find shorted, damaged or unsoldered pins by comparing like pins.

### Cited Findings

Order of checks (power on):

- Diagnostic order: (1) supply pins: correct voltage, decoupled, no excessive ripple; (2) control inputs: reset, enable, chip-select at the correct levels; (3) clock: correct frequency, clean edges; (4) data and signal inputs; (5) only if all inputs are correct and outputs are still wrong, suspect the IC. "Most 'bad IC' diagnoses in hobbyist debugging turn out to be bad power, missing pull-ups, or wrong configuration." [Applied EE notebook, field failure modes](https://applied-ee.github.io/ee-notebook/docs/debugging/component-field-failures/)
- Four questions that do not need a complete schematic: is power present, is the clock running, is reset released, is the signal present at the block boundary. Reset: find the pin in the datasheet, trace it to its RC network, supervisor or button, and measure whether it is at the active or inactive level. If stuck active, trace upstream: a supervisor seeing a low rail, an external hold-down or a missing pull-up. Common rails are 5 V, 3.3 V, 1.8 V and 1.2 V. [Applied EE notebook, fault isolation strategies](https://applied-ee.github.io/ee-notebook/docs/debugging/fault-isolation/)
- Measure rail voltages at the IC supply pins first, then at regulator outputs. [Nuts and Volts, repairing circuit boards](https://www.nutsvolts.com/magazine/article/repairing-circuit-boards)
- Hardware indicators: rails wrong, missing or noisy; the processor is not running (no clock or debug activity); symptoms change with temperature or mechanical stress. A brownout example: a 3.3 V rail dipping to 2.8 V. [Applied EE notebook, triage and first response](https://applied-ee.github.io/ee-notebook/docs/debugging/triage-and-first-response/)

Power off, protection-diode probing:

- Method: diode mode, red lead on ground, black lead on the pin under test, and look for the internal diode. Pins of the same type should share a diode signature; a pin that deviates from the rest suggests damage. The method can also check whether QFN or BGA pins are soldered (reader comment). The article gives no numeric values. [Hackaday, internal ESD diode probing](https://hackaday.com/2023/12/14/hacker-tactic-internal-esd-diode-probing)
- Phone repair practice: red on ground, black on the pad, compare with a known-good device or published readings. Example: about 0.7 V on a given connector pin on every working unit. 0 V suggests a short to ground; OL suggests a break; any other value differing from the reference indicates a fault on that line. [iFixit, microsoldering school day two](https://www.ifixit.com/News/98564/microsoldering-school-day-two-to-fix-the-problem-you-first-have-to-find-the-problem)
- A good input or output generally shows a normal junction drop between 0.4 and 0.9 V; a bad IC pin often reads much lower, such as 0.05 or 0.1 V, and sometimes much higher than normal. [rec.games.video.arcade.collecting post](https://groups.google.com/g/rec.games.video.arcade.collecting/c/KMGKbePx9bk) _(via search summary; attribution to this exact post not verified)_
- One TI answer for a specific part: the ESD diode on the pin measures 0.6 to 0.7 V one way and open the other. [TI E2E, UCC24612](https://e2e.ti.com/support/power-management-group/power-management/f/power-management-forum/912292/ucc24612-between-vdd-and-vs-by-diode-mode) _(via search summary)_
- The test does not exercise the internal logic of the device, only the protection junctions. [Polar Instruments, PCB test application note AP205](https://polarinstruments.com/support/pcb_troubleshooting/AP205_2014.html) _(via search summary; attribution not verified)_
- Many pins tied to one rail put many protection diodes in parallel, which lowers the reading. Internal pin-to-VCC and pin-to-GND diodes give misleadingly low readings in resistance mode, so use diode mode. [Applied EE notebook, short between nets](https://applied-ee.github.io/ee-notebook/docs/measurement/continuity-connections/short-between-nets)
- Localizing a rail short to one IC: measure VCC to GND at each IC's bypass capacitor; the lowest reading is nearest the short. A component that warms during current injection is in the short path, and may be the fault or a victim. [same page](https://applied-ee.github.io/ee-notebook/docs/measurement/continuity-connections/short-between-nets)
- Removal test: if the short disappears when the suspect component is removed, it was the source; if it persists, look elsewhere. [same page](https://applied-ee.github.io/ee-notebook/docs/measurement/continuity-connections/short-between-nets)

Failure modes:

- An IC that works for weeks and then fails without a change in conditions may reflect cumulative damage (electromigration, oxide degradation, solder joint fatigue). [Applied EE notebook, field failure modes](https://applied-ee.github.io/ee-notebook/docs/debugging/component-field-failures/)

### Inferences

- Suggested IC pin sweep for the app (power off, diode mode, red on ground, black on each pin): 0.4 to 0.9 V is "normal protection diode"; under about 0.1 V is "pin shorted to ground, or it is a ground pin" (check the pinout); a supply pin reads lower than signal pins and may show a climbing reading as the rail capacitors charge; OL is "no diode: unconnected pin, analog pin, or an open joint or bond" and needs comparison; a pin reading noticeably different from its siblings (same port, same function) is the suspect. Readings are only comparable between pins of the same kind and with the same meter.
- Suggested powered sequence for a microcontroller on a 3.3 V or 5 V board: VDD at the pin (not just at the regulator); reset pin at its inactive level (usually near VDD for an active-low reset) and stable; signs of life (an output toggling, a clock-out pin, current draw that changes at start-up); then the specific outputs that drive the failing function.
- A reset caused by a rail dip cannot be seen on a DC voltmeter. Evidence that can be gathered with a multimeter alone: min/max capture on VDD at the microcontroller pin during the event, and on the reset pin. Without min/max mode the app should state that an oscilloscope is required.
- A microcontroller output that cannot pull to the rail or to ground under no load (for example an output "high" at 1.5 V) points to a damaged output stage or a contending load. No source gave a threshold; logic-level datasheet limits apply.

### Gaps

- No cited rail tolerance for microcontroller supply (part-specific; brown-out thresholds are in each datasheet).
- No published per-pin diode-mode reference values exist for arbitrary ICs; the method depends on comparison.
- No failure-mode distribution for microcontrollers was retrieved.

## Optocouplers and relays

### Takeaway

Both are two-sided parts tested by driving one side and watching the other. An optocoupler's LED side reads about 1.0 to 1.5 V in diode mode, and its output can only be verified by energizing the LED. A relay is a coil-resistance check plus contact continuity in both states, and contact quality cannot be judged with an ohmmeter.

### Cited Findings

Optocouplers:

- Input LED (for example PC817, red on pin 1, black on pin 2): a forward diode reading, OL reversed. A typical infrared LED forward drop is 1.0 to 1.5 V, about 1.2 V. [Best Technology, optocoupler pinout](https://www.bestpcbs.com/blog/2026/10/optocoupler-pinout/) and [Industrial Monitor Direct, optocoupler test circuit](https://industrialmonitordirect.com/hu/blogs/knowledgebase/optocoupler-test-circuit-led-resistor-calculation-guide) _(vendor blogs, via search summary)_
- The transistor side generally cannot be tested statically with a multimeter unless the base is brought out. A diode test on the transistor pins gave inconsistent results across parts that worked in a real circuit. [All About Circuits forum, testing optocoupler](https://forum.allaboutcircuits.com/threads/testing-optocoupler.176792/) and [EEVblog forum](https://eevblog.com/forum/beginners/why-cant-i-test-the-transistor-part-of-an-optocoupler-using-my-multi-meter) _(via search summary)_
- Dynamic test: drive the LED with a safe current (around 10 to 20 mA through a series resistor) and measure the output. The collector-emitter resistance should change when the LED is driven. [All About Circuits forum, how to test optocoupler using multimeter](https://forum.allaboutcircuits.com/threads/how-to-test-optocoupler-using-multimeter.127435/) and [Neoteo, how to test an optocoupler](https://www.neoteo.com/en/how-to-test-an-optocoupler-basic-electronics) _(via search summary)_ **[needs: a supply and resistor, or a second meter]**

Relays:

- Coil: measure across the coil terminals. A standard 12 V relay coil reads around 50 to 200 Ω. OL means a broken coil; an extremely low reading suggests a shorted coil. [JLCPCB, relay pinout guide](https://jlcpcb.com/blog/relay-pinout-guide) and [LCSC blog, how to test a relay](https://www.lcsc.com/blog/?p=4065) _(via search summary)_
- Contacts, coil de-energized: common to normally-closed under 0.1 Ω (a fraction of an ohm); common to normally-open is open (above 10 MΩ). Energize the coil at rated voltage, listen for the click, and re-check: normally-open goes to near zero, normally-closed goes open. [LCSC blog, how to test a relay](https://www.lcsc.com/blog/?p=4065) _(via search summary)_
- TE Connectivity's verification procedure. In circuit: measure the voltage at the coil terminals and confirm it is at or above the minimum; check whether the armature can be heard or seen to move. Off the board: measure coil resistance against the datasheet (open coil: reject; out of specification: let it stand 1 hour and re-test); apply nominal coil voltage; monitor the contacts with a load of at least 6 V DC and 100 mA (12 V DC and 500 mA preferred). "Do not monitor contacts using an ohm-meter or digital logic levels". Contact resistance on new relays is R = E / I at datasheet test conditions, typically about 50 to 200 mΩ; on used relays contact resistance cannot be reliably tested, so use a functional test at about 12 V, 100 mA. Pull-in passes at or below the specified pull-in voltage; drop-out passes at or above the specified drop-out voltage. [TE Connectivity, verification and diagnosis of suspected relay failures](https://te.com/en/products/relays-and-contactors/relays/intersection/verification-diagnosis-suspected-relay-failures.html) **[needs: bench supply and load for the contact test]**
- Relay failure modes listed by TE: contacts fail to close or open, coil fails to operate or release, buzzing with contact chatter, open coil or out-of-specification coil resistance, intermittent operation, contact resistance or dielectric failure after seal damage, physical damage (a drop of more than about 6 inches onto a hard surface: scrap the relay even if it still works), contact wear (pitting and arc residue). [same page](https://te.com/en/products/relays-and-contactors/relays/intersection/verification-diagnosis-suspected-relay-failures.html)
- A cheap multimeter cannot resolve 0.05 Ω and shows the lead resistance as well. [The Drive, how to test a relay](https://www.thedrive.com/maintenance-repair/36048/how-to-test-a-relay) _(via search summary)_

### Inferences

- Optocoupler with two multimeters: meter A in diode mode across the LED (it supplies about 1 mA and reads 1.0 to 1.5 V), meter B on a high ohms range across collector and emitter. The output reading should fall from OL to a much lower value while meter A is connected. Meter diode current is low, so a weak change does not prove a bad part; no change at all on a part that is out of circuit is a fail.
- Optocoupler power on: with the input driven, about 1.0 to 1.5 V across the LED pins; the output transistor's collector-emitter voltage should be low (well under 1 V) when the LED is on and near its pull-up rail when off.
- Relay coil for 5 V boards: the coil resistance is on the part's datasheet (5 V relays are commonly tens to a few hundred ohms). The transferable verdicts are OL (open coil, fail) and near 0 Ω (shorted, fail). A flyback diode across the coil must be respected: measure the coil with red on the diode's cathode side, and note that diode mode will show the diode in the other direction.
- Relay powered check: coil voltage near the rail when commanded on (if not, the driver transistor is the suspect); then the voltage across the closed contacts under load should be near 0 V, which is the practical substitute for TE's loaded contact test.

### Gaps

- No manufacturer document (Vishay, Sharp, Broadcom) on bench-testing optocouplers was found; the forward-voltage band comes from vendor blogs.
- No failure-mode percentages for optocouplers (LED ageing and falling current transfer ratio are commonly cited but were not sourced here) or for relays.
- Coil resistance ranges for 5 V relays were not sourced.

## How do experts batch tests across a board, and in what order?

### Takeaway

The standard order is: gather the history, inspect with power off, sweep with power off (fuses, then each power rail to ground, then semiconductors in diode mode), power up with a current limit, measure every rail at the load, and only then chase signals. Net-level tests (one reading per rail) clear whole groups of parts at once, and a known-good board or a twin part on the same board is the fastest reference.

### Cited Findings

Order of work:

- Methodical narrowing: report, visual, non-powered checks, current-limited power-up, thermal or freezer localization, then voltage and signal comparison against a known-good board. Get the user report first (did it ever work, what changed). Avoid powering a damaged board at first. [Nuts and Volts, repairing circuit boards](https://www.nutsvolts.com/magazine/article/repairing-circuit-boards)
- Five-senses check before power: look (charred parts, bulging capacitors, cracked packages, discoloured PCB, solder bridges, missing parts, bent pins, loose wires), smell (burnt electronics, a chemical smell from a leaking electrolytic), listen, touch (with power off: hot parts, loose connectors, cracked joints), context (what changed). "If anything looks or smells burnt, don't power it up again until the cause is understood." [Applied EE notebook, triage and first response](https://applied-ee.github.io/ee-notebook/docs/debugging/triage-and-first-response/)
- Categorize the failure: never worked (assembly errors first), stopped working (ask what changed; suspect electrolytics, connectors and parts that run hot; a sudden hard failure suggests a part died, so look for the weakest link in the power path), intermittent (characterize by temperature, position, time and load). [same page](https://applied-ee.github.io/ee-notebook/docs/debugging/triage-and-first-response/)
- First measurements go from power toward the symptom: power (is the supply present and correct), then clocks, then signals. [same page](https://applied-ee.github.io/ee-notebook/docs/debugging/triage-and-first-response/)
- Visual checklist: connectors and socketed parts seated; capacitors for leaks, cracks, bulges; broken leads, bent IC legs, cracked boards or traces; burn marks, brown stains, burnt smell (find out why it overheated, not just what failed); dull solder joints; solder bridges; reversed or wrong parts. [Nuts and Volts, same article](https://www.nutsvolts.com/magazine/article/repairing-circuit-boards)
- Forum practice: check fuses first, then look for burnt or exploded parts ([Electro-Tech-Online thread](https://electro-tech-online.com/threads/how-do-you-troubleshoot-a-circuit-without-a-schematic.116280)); resistance or diode-mode checks come before voltage checks ([badcaps.net thread](https://www.badcaps.net/forum/troubleshooting-hardware-devices-and-electronics-theory/troubleshooting-desktop-motherboards-graphics-cards-and-pc-peripherals/3780404-dead-msi-b450-a-pro)); check each main rail, then sub-rails, for shorts and compare rail diode readings with a known-good board ([iFixit answers](https://ts.ifixit.com/Answers/History/577828)). _(all via search summary)_
- Phone-repair order: visual first; schematics if available (locate the power-management IC and the rails branching from it); diode-mode testing against known-good values; thermal camera. Always disconnect all power including the battery before diode-mode work. [iFixit, microsoldering school day two](https://www.ifixit.com/News/98564/microsoldering-school-day-two-to-fix-the-problem-you-first-have-to-find-the-problem)

Standard batch sweeps:

- Rail-to-ground sweep: one resistance and diode-mode reading per power rail, both polarities, with the thresholds given in the capacitor section; then localize at the bypass capacitors (lowest reading is closest). [Applied EE notebook, short between nets](https://applied-ee.github.io/ee-notebook/docs/measurement/continuity-connections/short-between-nets)
- Working without a schematic, in order: power rails (find the input, follow it to the regulators, measure outputs, label where each rail goes); grounds (confirm continuity between ground points before measuring anything); clocks and crystals; reset pin; then signal tracing with continuity mode. [Applied EE notebook, fault isolation strategies](https://applied-ee.github.io/ee-notebook/docs/debugging/fault-isolation/)
- Half-split: probe the midpoint of a chain; a correct midpoint means the fault is in the second half. A 16-stage chain needs at most 4 measurements. Disconnect subsystems one at a time on a shared rail; if the fault clears, investigate that subsystem. Predict before measuring: a contradicted prediction is the most valuable result. [same page](https://applied-ee.github.io/ee-notebook/docs/debugging/fault-isolation/)
- Comparison sweeps: point-to-point comparison with a known-good board; V/I signature comparison on unpowered boards, where most board faults show as shorts or opens. [Nuts and Volts, same article](https://www.nutsvolts.com/magazine/article/repairing-circuit-boards) **[needs: signature analyser for V/I]**
- Twin comparison on the same board: an identical diode channel, identical capacitors in a bank, pins of the same type on an IC. [Siborg, diodes](https://siborg.com/?p=175); [Siborg, capacitors](https://siborg.com/?p=134); [Hackaday, ESD diode probing](https://hackaday.com/2023/12/14/hacker-tactic-internal-esd-diode-probing)
- Current-limited first power-up: feed the rail below nominal with low voltage and current limits and raise both slowly; find the hot part with freezer spray or a thermal camera. [Nuts and Volts, same article](https://www.nutsvolts.com/magazine/article/repairing-circuit-boards) **[needs: bench supply]**
- In-circuit ESR sweep of all electrolytics, since ESR is the one capacitor measurement that is reliable in circuit. [Applied EE notebook, in-circuit vs out-of-circuit testing](https://applied-ee.github.io/ee-notebook/docs/retro-legacy/testing-and-troubleshooting/in-circuit-vs-out-of-circuit-testing/) **[needs: ESR meter]**
- Powered voltage sweep: every rail at the load, DC volts, with the ground reference confirmed first; then at IC supply pins. [Applied EE notebook, is voltage present](https://applied-ee.github.io/ee-notebook/docs/measurement/power-rails-supplies/voltage-present/); [Nuts and Volts, same article](https://www.nutsvolts.com/magazine/article/repairing-circuit-boards)

Failure-rate priors that can order the sweeps:

- Electrolytics are "the most failure-prone passive component"; in consumer units over 5 to 10 years old, electrolytics near heat are the first suspect. [Applied EE notebook, field failure modes](https://applied-ee.github.io/ee-notebook/docs/debugging/component-field-failures/)
- Aluminium electrolytics are low in catastrophic (random) failures compared with semiconductors and solid tantalum capacitors. [Nippon Chemi-Con technical note](https://chemi-con.com/wp-content/uploads/2021/04/Failure-modes.pdf)
- Mode distributions gathered above: film resistors open 59 %, drift 36 %, short 5 %; ceramic capacitors short 49 %, drift 29 %, open 22 %; tantalum short 57 %, open 32 %, drift 11 % ([DSIAC](https://dsiac.dtic.mil/technical-inquiries/notable/film-resistor-and-capacitor-failure-modes-and-distributions)); aluminium electrolytic short 53 %, open 35 % ([NSWC Crane, via search summary](https://www.navsea.navy.mil/Portals/103/Documents/NSWC_Crane/SD-18/PDFs/Products/Capacitors/CapacitorsFailureRevA.pdf)); H-bridge driver outputs: stuck shorted 28 %, stuck open 16 %, on-resistance too high 30 % ([TI SFFS057A](https://www.ti.com/lit/pdf/sffs057)).

### Inferences

- A proposed sweep order for the app, synthesized from the cited sources (each step clears or implicates groups of parts through the netlist):
  1. History and symptom category (never worked, stopped, intermittent).
  2. Visual and smell inspection, power off, with a per-part checklist (bulge, leak, crack, burn, stain, joint).
  3. Meter set-up: lead resistance, beeper not used for verdicts, capacitors discharged.
  4. Continuity of the power entry path: connector, switch, fuse or polyfuse, series diode, ferrite beads, zero-ohm links (all should read near 0 Ω; this is the "all fuses first" sweep).
  5. Rail-to-ground sweep: every power net to ground, ohms and diode mode, both polarities. A clean result marks every capacitor, TVS or Zener and IC supply pin on that net as "not shorted" in one reading.
  6. Semiconductor sweep in diode mode: every discrete diode, LED, transistor and MOSFET, plus the outputs of power ICs (H-bridge outputs to both rails). Twins compared with each other.
  7. Suspect resistors (burnt, in the power path, sense and gate resistors) by the "high reading is real, low reading is ambiguous" rule.
  8. First power-up, current-limited if a bench supply exists, otherwise through the normal adapter with a finger-near heat check; stop on smoke, heat or a collapsed rail.
  9. Powered voltage sweep: input, across the fuse, each regulator's input, enable and output, each rail at the load and at IC supply pins, reset pin, then the function-specific nodes (driver inputs and outputs).
  10. Dynamic or load-dependent tests (min/max capture, oscilloscope, load substitution) for faults that only occur during an event such as a motor start.
  11. Lifting or removing parts, last, and only to resolve a reading the earlier steps left ambiguous.
- Steps 4 to 7 are safe for an unskilled technician and need only a multimeter. Steps 8 to 10 need explicit safety gates in the app (for the Homestar, the existing advice not to trigger the motor repeatedly until the fault is isolated).
- Because the scenario format stores nets with confidence levels, a net-level test result should be recorded against the net and inherited by the parts on it only as "consistent with good". The limit is the same as for connections: a net-level pass does not prove any single part.
- The app can pre-compute, for any two-terminal part, whether an in-circuit test is trustworthy: if the netlist shows no other path between its two nets (other than through unpowered IC pins), the in-circuit reading stands; if a parallel path exists, the app should predict the combined reading (for example two resistors in parallel) or instruct the technician to lift a leg. Unknown connections (pins not on any net) mean the parallel-path analysis is incomplete, which should downgrade the verdict's confidence.

### Gaps

- No single authoritative, published "standard order of sweeps" was found. The order above is a synthesis of a trade-magazine article, a practitioner notebook, iFixit training material and forum practice.
- No published data on the share of consumer-board faults by component class (how often the fault is a capacitor versus a semiconductor versus a connector) was found. The priors above are mode distributions within a class, mostly from military reliability handbooks, plus practitioner statements.
- NEETS troubleshooting modules (the six-step procedure) and the Goldwasser FAQ's troubleshooting chapters could not be consulted and would be the natural primary sources for this question.
