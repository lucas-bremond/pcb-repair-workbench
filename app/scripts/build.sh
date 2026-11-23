#!/bin/sh
# Validate a scenario, regenerate its outputs, and check its KiCad schematic with kicad-cli:
# exports/schematic.svg (shown in the Schematic tab), and the netlist round trip and electrical
# rules check (ERC) reports in generated/kicad/.
# Needs Python 3.10+ with the packages in requirements.txt, and Docker (for kicad-cli 9).
# Usage: app/scripts/build.sh path/to/scenario-folder
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
DIR=$(cd "${1:?usage: build.sh path/to/scenario-folder}" && pwd)
PYTHON=${PYTHON:-python3}

"$PYTHON" -I "$HERE/build.py" "$DIR"
mkdir -p "$DIR/generated/kicad"
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$DIR":/w -w /w kicad/kicad:9.0 sh -c '
  kicad-cli sch export netlist --format kicadsexpr -o generated/kicad/netlist.net exports/schematic.kicad_sch >/dev/null
  kicad-cli sch export svg --exclude-drawing-sheet -o /tmp/svg exports/schematic.kicad_sch >/dev/null
  sed "s| date [0-9/: ]*</title>|</title>|" /tmp/svg/schematic.svg > exports/schematic.svg  # drop the export timestamp
  kicad-cli sch erc --severity-all -o generated/kicad/erc.rpt exports/schematic.kicad_sch >/dev/null'
"$PYTHON" -I "$HERE/build.py" "$DIR" --check-netlist "$DIR/generated/kicad/netlist.net"
echo "ERC findings by type:"
grep -oE '^\[[a-z_]+\]' "$DIR/generated/kicad/erc.rpt" | sort | uniq -c | sort -rn
"$PYTHON" -I "$HERE/build.py" "$DIR"  # put the fresh schematic.svg in the viewer's data
