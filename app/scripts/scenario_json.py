"""scenario.json's layout: two-space indent, arrays of plain values on one line.

    python -I app/scripts/scenario_json.py FILE...   # rewrite files in this layout (after a hand edit)

The server (app/server/scenario-json.mjs) writes the same layout, so a scenario saved by the
app and one written by a script differ only where their content does.
"""

import json


def _scalar(value) -> str:
    if isinstance(value, float) and value.is_integer():
        value = int(value)  # as JavaScript writes it
    return json.dumps(value, ensure_ascii=False)


def dumps(value, indent: str = "") -> str:
    inner = indent + "  "
    if isinstance(value, dict):
        if not value:
            return "{}"
        items = [f"{inner}{json.dumps(k, ensure_ascii=False)}: {dumps(v, inner)}" for k, v in value.items()]
        return "{\n" + ",\n".join(items) + "\n" + indent + "}"
    if isinstance(value, list):
        if not value:
            return "[]"
        if not any(isinstance(v, (dict, list)) for v in value):
            return "[" + ", ".join(_scalar(v) for v in value) + "]"
        return "[\n" + ",\n".join(inner + dumps(v, inner) for v in value) + "\n" + indent + "]"
    return _scalar(value)


def dump_file(value, path) -> None:
    path.write_text(dumps(value) + "\n", encoding="utf-8")


if __name__ == "__main__":
    import sys
    from pathlib import Path

    for name in sys.argv[1:]:
        p = Path(name)
        dump_file(json.loads(p.read_text(encoding="utf-8")), p)
        print(f"formatted {p}")
