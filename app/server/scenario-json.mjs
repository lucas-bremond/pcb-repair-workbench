// scenario.json's layout: two-space indent, arrays of plain values on one line. The same as
// app/scripts/scenario_json.py, so a scenario saved by the app and one written by a script differ
// only where their content does.

const isPlain = (v) => v === null || typeof v !== "object"

export function formatScenario(value, indent = "") {
  const inner = indent + "  "
  if (Array.isArray(value)) {
    if (!value.length) return "[]"
    if (value.every(isPlain)) return "[" + value.map((v) => JSON.stringify(v)).join(", ") + "]"
    return "[\n" + value.map((v) => inner + formatScenario(v, inner)).join(",\n") + "\n" + indent + "]"
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined)
    if (!keys.length) return "{}"
    return "{\n" + keys.map((k) => `${inner}${JSON.stringify(k)}: ${formatScenario(value[k], inner)}`).join(",\n") + "\n" + indent + "}"
  }
  return JSON.stringify(value)
}
